# Fórmulas Matemáticas, Financeiras e Estimativas de Vendas

> Implementação em código: [`lib/meli/formulas.ts`](../lib/meli/formulas.ts)

Este documento detalha todas as fórmulas matemáticas e financeiras utilizadas no **MercadoLivreApp** para estimar demanda, ritmo de vendas, faturamento, tarifas oficiais, recebimento líquido, impostos, lucro unitário e faixa de preço ideal.

---

## 1. Por que Vendas e Ritmo Diário são estimados?

Na API pública do Mercado Livre (`https://api.mercadolibre.com`), o endpoint direto de anúncios (`GET /items/{id}`) é bloqueado pelo firewall **PolicyAgent** com erro `403 Forbidden` para aplicações externas, ocultando o campo `sold_quantity`.

Por outro lado, a API libera **três sinais reais e auditáveis** para qualquer produto do ranking:
1. **`GET /questions/search?item={item_id}&api_version=4`**: retorna o **total histórico exato de perguntas (`total`)** feitas pelos compradores no anúncio e a lista das **últimas 50 perguntas com o timestamp exato (`date_created`)** de cada uma.
2. **`GET /products/{product_id}`**: retorna a **data de criação do produto no catálogo (`date_created`)**, permitindo calcular quantos dias o produto está ativo (`daysActive`).
3. **`GET /highlights/MLB/category/{category_id}`**: retorna a **posição oficial de vendas (`position` de `#1` a `#20`)** dentro da categoria.

---

## 2. Fórmulas de Demanda, Vendas e Faturamento

### 2.1. Constante de Conversão de Perguntas em Vendas ($M_q$)
No e-commerce brasileiro (Mercado Livre), benchmarks de mercado mostram que entre **10% e 12,5% dos compradores fazem uma pergunta antes de comprar** — ou seja, ocorre em média **1 pergunta a cada 8 vendas**:

$$M_q = 8 \text{ vendas por pergunta}$$

### 2.2. Dias Ativos do Produto ($D_{\text{ativo}}$)
Quando o produto de catálogo possui `date_created`, calculamos o número de dias corridos desde o lançamento (com piso mínimo de $1$ dia). Quando não informado (ex.: `USER_PRODUCT`), adota-se a janela padrão de maturidade de $180\text{ dias}$:

$$D_{\text{ativo}} = \max\left(1,\; \text{round}\left(\frac{t_{\text{agora}} - t_{\text{criação}}}{86.400.000\text{ ms}}\right)\right)$$

---

### 2.3. Caso A — Anúncios com Perguntas Registradas ($Q_{\text{total}} > 0$)

1. **Vendas Totais Estimadas ($V_{\text{total}}$):**
   $$V_{\text{total}} = Q_{\text{total}} \times M_q = Q_{\text{total}} \times 8$$

2. **Ritmo Histórico Médio ($R_{\text{hist}}$):**
   $$R_{\text{hist}} = \frac{V_{\text{total}}}{D_{\text{ativo}}}$$

3. **Ritmo Recente pela Janela das Últimas Perguntas ($R_{\text{recente}}$):**
   A API retorna até $N_{\text{lote}} \le 50$ perguntas recentes com suas datas. Seja $t_{\text{mais\_antiga}}$ a data da pergunta mais antiga desse lote recente. O intervalo em dias dessa amostra recente é:
   $$\Delta d_{\text{recente}} = \max\left(1,\; \frac{t_{\text{agora}} - t_{\text{mais\_antiga}}}{86.400.000\text{ ms}}\right)$$
   A velocidade recente estimada de vendas por dia é:
   $$R_{\text{recente}} = \frac{N_{\text{lote}} \times 8}{\Delta d_{\text{recente}}}$$

4. **Ritmo Diário Híbrido Ponderado ($R_{\text{dia}}$):**
   Para capturar tanto o momento atual do anúncio (60% de peso) quanto a consistência histórica (40% de peso):
   $$R_{\text{dia}} = \max\left(0{,}5;\; 0{,}60 \cdot R_{\text{recente}} + 0{,}40 \cdot R_{\text{hist}}\right)$$

---

### 2.4. Caso B — Oferta Recente no Buybox com $0$ Perguntas (Curva de Pareto / Lei de Zipf)

Em produtos de catálogo (`PRODUCT`) com dezenas de vendedores, o vencedor atual do *buybox* (menor preço) pode ser um anúncio recém-cadastrado que ainda tem `questionsTotal = 0`, embora o produto esteja no Top 20 mais vendidos da categoria.

Nesses casos, aplicamos uma **Curva de Potência (Distribuição de Pareto / Zipf)** calibrada para o Top 20 do Mercado Livre a partir da posição $p \in \{1, \dots, 20\}$:

$$R_{\text{dia}}(p) = \max\left(1{,}2;\; \frac{28}{p^{0{,}55}}\right)$$

| Posição no Ranking ($p$) | Ritmo Base Estimado ($R_{\text{dia}}$) | Vendas Mensais Est. ($30 \times R_{\text{dia}}$) |
| :---: | :---: | :---: |
| **#1** | `~28,0 / dia` | `~840 / mês` |
| **#2** | `~19,1 / dia` | `~573 / mês` |
| **#3** | `~15,3 / dia` | `~459 / mês` |
| **#5** | `~11,6 / dia` | `~348 / mês` |
| **#10** | `~7,9 / dia` | `~237 / mês` |
| **#20** | `~5,4 / dia` | `~162 / mês` |

E o acumulado estimado na janela recente (até 120 dias) é:

$$V_{\text{total}} = \text{round}\left(R_{\text{dia}}(p) \times \min(D_{\text{ativo}}, 120)\right)$$

---

### 2.5. Vendas Mensais ($V_{\text{mês}}$) e Faturamento Mensal ($F_{\text{mês}}$)

$$V_{\text{mês}} = \text{round}(R_{\text{dia}} \times 30)$$

$$F_{\text{mês}} = V_{\text{mês}} \times P$$

onde $P$ é o preço atual da oferta vencedora (`price`).

---

## 3. Fórmulas Financeiras, Tarifas, Impostos e Faixa de Preço para Lucro

### 3.1. Dados Oficiais Obtidos Direto da API do Mercado Livre
Para cada produto com preço $P$, subcategoria $C$ e tipo de anúncio $L \in \{\texttt{gold\_special}, \texttt{gold\_pro}\}$:

1. **Tarifa de Venda do Mercado Livre (`GET /sites/MLB/listing_prices`):**
   - $T_{\text{ML}}$ (`sale_fee_amount`): valor total em R$ cobrado pelo Mercado Livre por unidade vendida.
   - $\tau_{\text{ML}}$ (`sale_fee_details.percentage_fee`): percentual de comissão da categoria (tipicamente $11{,}5\%$ a $14\%$ no Clássico e $16{,}5\%$ a $19\%$ no Premium).
   - $T_{\text{fixa}}$ (`sale_fee_details.fixed_fee`): taxa fixa em R$ aplicada pelo ML em itens abaixo de R$ 79 (ex.: R$ 6,00).

2. **Custo de Frete Mercado Envios (`GET /users/{seller_id}/shipping_options/free`):**
   - $S_{\text{lista}}$ (`coverage.all_country.list_cost`): custo de frete em R$ para o peso faturável (`billable_weight` em gramas).
   - Se o anúncio oferece **Frete Grátis** (`free_shipping === true`), o vendedor arca com $S_{\text{vendedor}} = S_{\text{lista}}$. Caso contrário, o frete é pago pelo comprador ($S_{\text{vendedor}} = 0$).

---

### 3.2. Quanto o Anúncio Recebe Líquido do Mercado Livre ($R_{\text{líq\_ML}}$)

$$R_{\text{líq\_ML}} = \max\left(0,\; P - T_{\text{ML}} - S_{\text{vendedor}}\right)$$

---

### 3.3. Imposto, Custo do Produto (CMV) e Lucro Líquido Unitário

No painel interativo do aplicativo, o usuário pode ajustar em tempo real dois parâmetros através dos sliders:
- $\tau_{\text{imp}}$: alíquota de **Imposto sobre o faturamento** (padrão: $6\%$ — Simples Nacional Anexo I Comércio).
- $\tau_{\text{cmv}}$: percentual de **Custo da Mercadoria Vendida / CMV** sobre o preço atual (padrão: $45\%$).

Com base nesses parâmetros:

1. **Imposto Estimado por Venda ($I$):**
   $$I = P \times \tau_{\text{imp}}$$

2. **Sobra Após Imposto ($R_{\text{pós\_imp}}$):**
   $$R_{\text{pós\_imp}} = R_{\text{líq\_ML}} - I$$

3. **Custo Estimado do Produto ($C_{\text{prod}}$):**
   $$C_{\text{prod}} = P \times \tau_{\text{cmv}}$$

4. **Lucro Líquido Unitário ($L_{\text{un}}$) e Margem Líquida ($\text{Margem}\%$):**
   $$L_{\text{un}} = R_{\text{líq\_ML}} - I - C_{\text{prod}}$$
   $$\text{Margem}\% = \text{round}\left(\frac{L_{\text{un}}}{P} \times 100\right)$$

---

### 3.4. Fórmula Inversa da Faixa de Preço para Lucro ($15\%$ a $25\%$)

Para descobrir **por quanto o vendedor precisa vender o produto** ($P_{\text{alvo}}$) para obter uma margem de lucro líquida desejada $m$ (ex.: $m_{\min} = 15\%$ e $m_{\max} = 25\%$) após pagar o Custo do Produto ($C_{\text{prod}}$), o Frete ($S_{\text{vendedor}}$), a Taxa Fixa ($T_{\text{fixa}}$), a Comissão Percentual do ML ($\tau_{\text{ML}}$) e o Imposto ($\tau_{\text{imp}}$), partimos da equação de equilíbrio:

$$P_{\text{alvo}} - \underbrace{\left(P_{\text{alvo}} \cdot \tau_{\text{ML}} + T_{\text{fixa}}\right)}_{\text{Tarifa ML}} - S_{\text{vendedor}} - \underbrace{\left(P_{\text{alvo}} \cdot \tau_{\text{imp}}\right)}_{\text{Imposto}} - C_{\text{prod}} = P_{\text{alvo}} \cdot m$$

Isolando $P_{\text{alvo}}$:

$$P_{\text{alvo}} \cdot \left(1 - \tau_{\text{ML}} - \tau_{\text{imp}} - m\right) = C_{\text{prod}} + S_{\text{vendedor}} + T_{\text{fixa}}$$

$$\boxed{P_{\text{alvo}}(m) = \frac{C_{\text{prod}} + S_{\text{vendedor}} + T_{\text{fixa}}}{1 - \tau_{\text{ML}} - \tau_{\text{imp}} - m}}$$

Assim:
- **Preço Mínimo Recomendado (Margem Líquida de $15\%$):** $P_{\min} = P_{\text{alvo}}(0{,}15)$
- **Preço Ideal Recomendado (Margem Líquida de $25\%$):** $P_{\max} = P_{\text{alvo}}(0{,}25)$

---

## 4. Exemplo Real Passo a Passo

Considere o produto **#2 de Acessórios para Veículos** (*Carregador Inteligente de Bateria Automotiva 12V 6A Woosh* — `MLB65770538`):
- **Preço atual ($P$):** `R$ 38,90` (Anúncio Clássico, sem frete grátis pago pelo vendedor: $S_{\text{vendedor}} = 0$)
- **Tarifa ML oficial (`/listing_prices`):** $\tau_{\text{ML}} = 12\%$, $T_{\text{fixa}} = 0 \implies T_{\text{ML}} = \text{R\$ } 4{,}67$
- **Recebimento Líquido ML ($R_{\text{líq\_ML}}$):** $38{,}90 - 4{,}67 = \mathbf{\text{R\$ } 34{,}23}$
- **Imposto ($6\%$ Simples):** $38{,}90 \times 0{,}06 = \text{R\$ } 2{,}33$
- **Custo estimado do produto ($\text{CMV } 45\%$):** $38{,}90 \times 0{,}45 = \text{R\$ } 17{,}51$
- **Lucro Líquido Unitário atual:** $34{,}23 - 2{,}33 - 17{,}51 = \mathbf{\text{R\$ } 14{,}39}$ (**$37\%$ de margem líquida**)
- **Faixa de Preço para Lucro de $15\%$ a $25\%$:**
  - $P_{\min}(15\%) = \frac{17{,}51 + 0 + 0}{1 - 0{,}12 - 0{,}06 - 0{,}15} = \frac{17{,}51}{0{,}67} = \mathbf{\text{R\$ } 26{,}13}$
  - $P_{\max}(25\%) = \frac{17{,}51 + 0 + 0}{1 - 0{,}12 - 0{,}06 - 0{,}25} = \frac{17{,}51}{0{,}57} = \mathbf{\text{R\$ } 30{,}71}$

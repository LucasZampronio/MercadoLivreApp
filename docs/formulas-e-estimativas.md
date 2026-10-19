# Fórmulas Matemáticas, Financeiras e Estimativas (Padrão Avantpro)

Este documento detalha **todas as fórmulas matemáticas e financeiras** implementadas em [`lib/meli/formulas.ts`](file:///Users/I774243/Desktop/MercadoLivreApp/lib/meli/formulas.ts) e exibidas nos cards de produto ([`components/dashboard/ProductCard.tsx`](file:///Users/I774243/Desktop/MercadoLivreApp/components/dashboard/ProductCard.tsx)).

---

## 1. Seleção da Oferta Vencedora (Buy Box Winner)

Para produtos de catálogo (`type === "PRODUCT"` ou `USER_PRODUCT`), o endpoint `GET /products/{id}/items` retorna as ofertas ativas **ordenadas pelo ranking de Buy Box do Mercado Livre**:

- **Oferta Vencedora (`best`):** `offers[0]` (o vendedor que detém atualmente o Buy Box).
- **Estatísticas de Preço do Catálogo:** além do preço do Buy Box ($P$), calculamos o menor preço ($P_{\min}$), o maior preço ($P_{\max}$) e o preço médio ($P_{\text{med}}$) entre todas as ofertas ativas.

---

## 2. Datas de Criação: Anúncio vs. Catálogo

1. **Catálogo criado em (`dateCreated` e `daysActive`):**
   - Obtido diretamente de `GET /products/{product_id}` (`date_created`).
   - Dias ativos do catálogo:
     $$\text{daysActive} = \max\left(1,\; \text{round}\left(\frac{t_{\text{agora}} - t_{\text{catálogo}}}{86.400.000}\right)\right)$$
2. **Anúncio criado em (`itemDateCreated` e `itemDaysActive`):**
   - Embora `GET /items/{item_id}` retorne `403 Forbidden`, o sub-recurso **`GET /items/{item_id}/description` retorna `200 OK`** e inclui o campo `date_created` exato do anúncio (ex.: `2022-08-12T13:38:24.197Z` $\rightarrow$ `12/08/2022` · `Há 1.528 dias`).
   - Caso um vendedor não tenha cadastrado descrição textual no anúncio, interpolamos a data pela curva monotônica de IDs sequenciais `MLB{id}` (`estimateItemDateFromMlbId`).

---

## 3. Faixa de Vendidos, Vendas Estimadas, Ritmo Atual, Visitas e Conversão

### 3.1. Faixa de Vendidos (`soldQuantity` — ex.: `50.000 Vendidos`)
Calculamos a velocidade diária base pela Lei de Potência (Pareto/Zipf) da posição no ranking ($p \in \{1,\dots,20\}$) combinada com o histórico de perguntas (`questionsTotal`):

$$V_{\text{dia, base}} = \max\left(\frac{26}{p^{0,52}},\; \frac{Q_{\text{total}} \times 8}{\text{daysActive}}\right)$$

Multiplicando pelos dias ativos ($\text{daysActive}$), mapeamos o volume bruto acumulado para os **degraus oficiais exibidos pelo Mercado Livre** (`ML_SOLD_TIERS`):

$$\text{ML\_SOLD\_TIERS} = \{5, 25, 50, 100, 250, 500, 1.000, 5.000, 10.000, 50.000, 100.000, 250.000\}$$

### 3.2. Vendas Estimadas (`estimatedSales` — ex.: `67.500`)
Como o badge do Mercado Livre exibe apenas o piso da faixa (ex.: `+50.000 vendidos` para um produto que pode ter entre $50.000$ e $99.999$ vendas), aplicamos o fator médio de progressão da faixa ($1{,}35\times$):

$$V_{\text{estimadas}} = \max\left(\text{round}(\text{soldQuantity} \times 1{,}35),\; Q_{\text{total}} \times 8\right)$$

> **Exemplo real (`MLB18238727` — Aspirador Electrolux STK15):**
> - Faixa de vendidos: `50.000 Vendidos`
> - Vendas estimadas: $50.000 \times 1{,}35 = \mathbf{67.500}$

### 3.3. Vendas por Dia (`estimatedDailySales`) e Vendas Mensais (`estimatedMonthlySales`)
Representam a média histórica consistente desde a criação do catálogo/anúncio:

$$\text{Vendas por dia} = \max\left(1,\; \text{round}\left(\frac{\text{soldQuantity}}{\text{daysActive}}\right)\right)$$

$$\text{Vendas mensais} = \max\left(1,\; \left\lfloor\frac{\text{soldQuantity}}{\text{daysActive} / 30}\right\rfloor\right)$$

> **Exemplo real (`MLB18238727`, `daysActive = 1.929`):**
> - Vendas por dia: $\text{round}(50.000 / 1.929) = \mathbf{26}$
> - Vendas mensais: $\lfloor 50.000 / (1.929 / 30) \rfloor = \mathbf{777\text{/Mês}}$

### 3.4. Ritmo Atual em Vendas/Mês (`currentMonthlyPace` — ex.: `1.614`)
Representa a velocidade **atual (últimos 30 dias)** enquanto o produto ocupa o Top 20 Mais Vendidos da categoria, ponderando o número de ofertas competindo no catálogo ($N_{\text{ofertas}}$), liderança na subcategoria, logística `Full` e velocidade recente de perguntas:

$$M_{\text{catálogo}} = 1 + \min\left(0{,}85,\; 0{,}52 \cdot \log_{10}(N_{\text{ofertas}})\right) + \Bonus_{\text{subcat}} + \Bonus_{\text{Full}}$$

$$\text{Ritmo atual (vendas/mês)} = \text{round}\left(30 \times \max\left(V_{\text{dia, base}} \cdot M_{\text{catálogo}},\; 1{,}35 \cdot V_{\text{dia, perguntas recentes}}\right)\right)$$

### 3.5. % Conversão (`conversionRatePercent`) e Visitas (`estimatedVisits`)
A taxa de conversão de um anúncio no Top 20 depende diretamente da qualidade da oferta no Buy Box:

$$\text{Conversão (\%)} = 9{,}5 + \frac{1{,}8}{p^{0,45}} + \underbrace{1{,}1}_{\text{se Full}} + \underbrace{0{,}5}_{\text{se Frete Grátis}} + \underbrace{0{,}23}_{\text{se Loja Oficial}}$$

E o total acumulado de visitas é derivado de forma consistente com a conversão:

$$\text{Visitas} = \text{round}\left(\frac{\text{soldQuantity}}{\text{Conversão (\%)} / 100}\right)$$

> **Exemplo real (`MLB18238727` — `#1`, `Full`, `Frete Grátis`, `Loja Oficial`):**
> - Conversão: $9{,}5 + 1{,}8 + 1{,}1 + 0{,}5 + 0{,}23 = \mathbf{13{,}13\%}$
> - Visitas: $50.000 / 0{,}13132 = \mathbf{380.747}$

---

## 4. Fórmulas Financeiras: Imposto, Recebe, Recomendação, Comissão ML e Faturamento

Para um produto com preço de venda $P$:

1. **Comissão ML (`saleFeeAmount`, `saleFeePercent` — Oficial via `/sites/MLB/listing_prices`):**
   - Ex.: para $P = \text{R\$ } 189{,}90$ no anúncio Clássico ($11\%$), $\text{Comissão ML} = \mathbf{\text{R\$ } 20{,}89}$.
2. **Frete (`shippingListCost` — Oficial via `/users/{seller_id}/shipping_options/free`):**
   - Ex.: $\text{Frete} = \mathbf{\text{R\$ } 24{,}35}$ (peso faturável $2.784\text{ g}$).
3. **Imposto (`estimatedTaxAmount` — Alíquota padrão $t = 7{,}00\%$, ajustável no slider):**
   $$\text{Imposto} = \text{round}(P \times t,\; 2)$$
   - Ex.: $189{,}90 \times 0{,}07 = \mathbf{\text{R\$ } 13{,}29}$ ($7{,}00\%$).
4. **Recebe (`netAfterTax` e `netReceivePercent`):**
   Valor líquido que sobra para pagar o produto e gerar lucro após descontar Comissão ML, Frete e Imposto:
   $$\text{Recebe} = P - \text{Comissão ML} - \text{Frete} - \text{Imposto}$$
   $$\%\text{Recebe} = \frac{\text{Recebe}}{P} \times 100$$
   - Ex.: $189{,}90 - 20{,}89 - 24{,}35 - 13{,}29 = \mathbf{\text{R\$ } 131{,}37}$ ($\mathbf{69{,}18\%}$).
5. **Recomendação de Custo (`recommendedCostMin` e `recommendedCostMax`):**
   Faixa recomendada de custo de aquisição do produto (fornecedor) entre **50% e 90% do valor `Recebe`**:
   $$\text{Recomendação}_{\min} = 0{,}50 \times \text{Recebe}, \qquad \text{Recomendação}_{\max} = 0{,}90 \times \text{Recebe}$$
   - Ex.: $\text{Entre } \mathbf{\text{R\$ } 65{,}68} \text{ e } \mathbf{\text{R\$ } 118{,}23}$.
6. **Faturamento Acumulado (`estimatedTotalRevenue` — Banner `Faturando R$ ...`):**
   $$\text{Faturando} = \text{soldQuantity} \times P$$
   - Ex.: $50.000 \times \text{R\$ } 189{,}90 = \mathbf{\text{R\$ } 9.495.000{,}00}$.

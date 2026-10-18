# Documentação Técnica — MercadoLivreApp

Bem-vindo à documentação oficial do **MercadoLivreApp** (Painel de Inteligência de Mercado e Mais Vendidos do Mercado Livre Brasil — `MLB`).

---

## 📚 Índice da Documentação

1. **[Fórmulas Matemáticas, Financeiras e Estimativas de Vendas](./formulas-e-estimativas.md)**
   - Como estimamos **Vendas Totais**, **Ritmo de Vendas por Dia**, **Vendas Mensais** e **Faturamento Mensal** (modelo híbrido por volume/velocidade de perguntas + curva de Pareto/Zipf do ranking).
   - Como calculamos **Tarifa Oficial do ML**, **Custo de Frete Mercado Envios**, **Recebimento Líquido do Anúncio**, **Imposto (Simples Nacional)**, **CMV**, **Lucro Líquido Unitário** e a **Fórmula Inversa de Precificação para Margem de Lucro (15%–25%)**.
   - Exemplos numéricos reais passo a passo.

2. **[Mapa Auditado da API do Mercado Livre (`200 OK` vs `403 Forbidden`)](./api-mercado-livre.md)**
   - Todos os 13 grupos de endpoints oficiais que funcionam (`200 OK`) e seus campos utilizados.
   - Endpoints bloqueados pelo PolicyAgent (`403 Forbidden`) mesmo com OAuth de usuário.
   - Estratégia de enriquecimento cruzado para resolver nome, subcategoria, vendedor, perguntas e imagem de itens `USER_PRODUCT` (`MLBU...`) e `ITEM` (`MLB...`).

3. **[Arquitetura, Organização de Pastas e Pipeline GitHub Pages](./arquitetura-e-pastas.md)**
   - Estrutura modular do código (`lib/meli/`, `components/dashboard/`, `app/`, `scripts/`, `public/data/`, `docs/`).
   - Fluxo de coleta do snapshot estático (`public/data/meli-snapshot.json`).
   - Como funciona a publicação automática na branch `main` para o **GitHub Pages** a cada 6 horas.

4. **[Servidor MCP Oficial do Mercado Livre e Login OAuth PKCE](./mcp-server.md)**
   - Configuração do endpoint correto (`https://mcp.mercadolibre.com/devsite/v1/mcp`).
   - Tools expostas (`search_documentation`, `get_documentation_page`).
   - Fluxo OAuth 2.0 com PKCE em 2 passos (`scripts/meli-login.mjs`).

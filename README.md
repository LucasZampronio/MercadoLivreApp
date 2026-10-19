# Inteligência de Mercado · Mercado Livre (`MLB`)

Aplicação web (Next.js 15 + React 19 + TypeScript) para monitorar os **produtos mais vendidos no Mercado Livre Brasil** em todas as **32 categorias**, com análise financeira por venda, estimativa de demanda/ritmo diário, simulador de impostos/CMV e tendências de busca.

🌐 **Demo publicada no GitHub Pages:**  
**[https://lucaszampronio.github.io/MercadoLivreApp/](https://lucaszampronio.github.io/MercadoLivreApp/)**

---

## ✨ Funcionalidades Principais

- **Catálogo Completo (560 produtos) + Visão Top #1 das 32 Categorias:** alterne instantaneamente entre todas as categorias ou filtre uma categoria específica.
- **Painel de Controle Interativo:**
  - Busca textual instantânea por produto, marca, modelo, subcategoria, vendedor ou código MLB.
  - Ordenação por **Posição no Ranking**, **Maior Faturamento Mensal Est.**, **Maior Ritmo de Vendas/Dia**, **Maior Desconto (`% OFF`)**, **Menor/Maior Preço**, **Maior Líquido Recebido** e **Mais Perguntas**.
  - Filtros rápidos: `⚡ Full`, `🚚 Frete Grátis`, `🏪 Loja Oficial`, `🏅 MercadoLíder Platinum`, `Anúncio Clássico` e `Anúncio Premium`.
  - **Paginação Completa:** escolha entre `12`, `20`, `40` ou `60` itens por página.
- **Simulador Financeiro em Tempo Real:**
  - Ajuste os sliders de **Imposto (%)** e **Custo da Mercadoria / CMV (%)** para recalcular ao vivo o **Lucro Líquido por Unidade** e a **Faixa de Preço Recomendada para Lucro (15%–25%)**.

---

## 📚 Documentação Completa (`docs/`)

Toda a documentação técnica, arquitetura e fórmulas matemáticas estão na pasta [`docs/`](./docs/README.md):

- 📐 **[Fórmulas Matemáticas, Financeiras e Estimativas de Vendas](./docs/formulas-e-estimativas.md)**
- 🔌 **[Mapa Auditado da API do Mercado Livre (`200 OK` vs `403 Forbidden`)](./docs/api-mercado-livre.md)**
- 🏗️ **[Arquitetura, Organização de Pastas e Pipeline GitHub Pages](./docs/arquitetura-e-pastas.md)**
- 🤖 **[Servidor MCP Oficial do Mercado Livre e Login OAuth PKCE](./docs/mcp-server.md)**

---

## 🚀 Como Rodar Localmente

1. Crie um arquivo `.env` na raiz com suas credenciais do Mercado Livre Developers:
   ```env
   MELI_APP_ID=seu_app_id
   MELI_CLIENT_SECRET=seu_client_secret
   MELI_SITE_ID=MLB
   ```
2. Instale as dependências:
   ```bash
   npm install
   ```
3. (Opcional) Atualize o snapshot completo das 32 categorias (`public/data/meli-snapshot.json`):
   ```bash
   npm run update-data:local
   ```
4. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```
   Acesse `http://localhost:3000`.


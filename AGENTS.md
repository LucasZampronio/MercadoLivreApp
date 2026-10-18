# MercadoLivreApp: contexto do projeto

> Arquivo carregado automaticamente em toda conversa neste projeto.
> **Instrução para o agente:** ao concluir uma mudança relevante (nova feature, decisão de arquitetura, bug resolvido, pendência nova ou resolvida), atualize as seções "Estado atual", "Decisões" e "Pendências" abaixo, no mesmo turno. Não registre segredos aqui.

## Objetivo
App para ver os produtos mais vendidos no Mercado Livre e métricas completas de inteligência de mercado (preços, tarifas, frete, lucro líquido, demanda/ritmo de vendas, reputação do vendedor e tendências), usando as APIs e MCPs oficiais.

## Stack
- Next.js 15 (App Router) + React 19 + TypeScript
- Sem banco de dados. Os dados vêm direto da API do Mercado Livre.
- Node v24, npm 11

## Estrutura
- `lib/meli/`: domínio e integração com a API do Mercado Livre
  - `lib/meli/types.ts`: contratos TypeScript (`Product`, `Category`, `CategoryDetails`, `Trend`, `MeliSnapshot`)
  - `lib/meli/client.ts`: autenticação OAuth (`client_credentials`), cache em memória e pool de concorrência (`mapPool`)
  - `lib/meli/formulas.ts`: fórmulas matemáticas e financeiras isoladas (`calculateSalesEstimates`, `calculateFinancialBreakdown`)
  - `lib/meli/service.ts`: coleta, enriquecimento de produtos e gerador de snapshot completo (`generateFullSnapshot`)
  - `lib/meli/index.ts` e `lib/meli.ts`: barrel exports
- `components/dashboard/`: componentes modulares de interface
  - `DashboardClient.tsx`: orquestrador client-side (estado, filtros, ordenação e paginação)
  - `ControlPanel.tsx`: menu de categorias/visão, busca, ordenação, filtros rápidos, sliders de Imposto/CMV e KPIs
  - `ProductCard.tsx`: card individual de produto com fallback de imagem SVG, especificações, demanda e breakdown financeiro
  - `PaginationBar.tsx`: barra de paginação superior e inferior
  - `MethodologyPanel.tsx`: painel explicativo das fórmulas e estimativas
  - `formatters.ts`: formatadores monetários/numéricos e tipos de filtro/ordenação
- `docs/` e `README.md`: documentação completa do projeto
  - `docs/README.md`: índice geral da documentação
  - `docs/formulas-e-estimativas.md`: documentação detalhada de todas as fórmulas financeiras e de estimativa de vendas
  - `docs/api-mercado-livre.md`: auditoria completa dos endpoints públicos vs. bloqueados (`200 OK` vs `403`)
  - `docs/arquitetura-e-pastas.md`: fluxo de dados, arquitetura de pastas e deploy no GitHub Pages
  - `docs/mcp-server.md`: configuração do servidor MCP oficial do Mercado Livre
- `app/page.tsx`, `app/layout.tsx`, `app/globals.css`: rotas e estilos globais do App Router
- `next.config.mjs`: configuração `output: "export"`, `basePath` dinâmico para GitHub Actions e `outputFileTracingRoot`
- `scripts/update-data.ts`: script da pipeline (`npm run update-data` / `npm run update-data:local`) que coleta as 32 categorias e atualiza `public/data/meli-snapshot.json`
- `.github/workflows/deploy-pages.yml`: pipeline do GitHub Actions que atualiza `public/data/meli-snapshot.json` (a cada 6h, em cada push ou manualmente), faz commit do JSON atualizado e publica no GitHub Pages
- `scripts/list-mcp-tools.mjs` e `scripts/meli-login.mjs`: utilitários do MCP e login OAuth PKCE
- `.env` (local, não versionado): `MELI_APP_ID`, `MELI_CLIENT_SECRET`, `MELI_SITE_ID=MLB`. Não existe `.env.example`.

## Mapa completo da API do Mercado Livre (auditado)

### Endpoints que FUNCIONAM (`200 OK`) e são usados no app
1. **`POST /oauth/token`** (`client_credentials` ou `authorization_code` + PKCE): gera `access_token`.
2. **`GET /sites/MLB/categories`**: lista as 32 categorias raiz.
3. **`GET /categories/{id}`**: nome, árvore (`path_from_root`), `total_items_in_this_category` (concorrência total na categoria/subcategoria) e `settings.catalog_domain`.
4. **`GET /highlights/MLB/category/{id}`**: top 20 mais vendidos da categoria (`id`, `position`, `type`: `PRODUCT` | `USER_PRODUCT` | `ITEM`).
5. **`GET /highlights/MLB/product/{id}`** e **`GET /highlights/MLB/item/{id}`**: funciona inclusive para `MLBU...` e `ITEM`! Retorna a subcategoria exata onde o item é destaque (`id`, `label`, `position`).
6. **`GET /products/{id}`** (apenas `type === "PRODUCT"`): ficha completa do catálogo (`name`, `family_name`, `pictures`, `attributes` [Marca, Modelo, Cor, Peso, Dimensões], `main_features`, `quality_type`, `date_created`, `last_updated`).
7. **`GET /products/{id}/items`** (funciona para `PRODUCT` e `USER_PRODUCT` `MLBU...`): retorna até 100 ofertas ativas com `item_id`, `seller_id`, `price`, `original_price`, `condition`, `warranty`, `listing_type_id` (`gold_special`/`gold_pro`), `official_store_id`, `shipping` (`free_shipping`, `logistic_type`: `fulfillment`=Full, `self_service`=Flex, `cross_docking`=Coleta) e `seller_address` (cidade/UF).
8. **`GET /sites/MLB/listing_prices?price={p}&category_id={cat}&listing_type_id={type}`**: retorna a comissão exata do Mercado Livre (`sale_fee_amount`, `sale_fee_details.percentage_fee`, `fixed_fee`) e o nome do anúncio (`Clássico` / `Premium`).
9. **`GET /users/{seller_id}/shipping_options/free?item_id={id}&item_price={p}&listing_type_id={type}&mode=me2&condition=new&logistic_type={log}`**: retorna o custo de frete pago pelo vendedor (`coverage.all_country.list_cost`) e o peso faturável em gramas (`billable_weight`).
10. **`GET /questions/search?item={item_id}&api_version=4`**: funciona para qualquer `item_id` (inclusive itens cujo `/items/{id}` dá 403)! Retorna `total` de perguntas feitas no anúncio, lista de perguntas/respostas com datas e `seller_id`.
11. **`GET /users/{seller_id}`**: perfil público do vendedor (`nickname`, `permalink`, `user_type`, `address`, `seller_reputation.level_id`, `power_seller_status` [MercadoLíder Platinum/Gold], `transactions.total` [total histórico de vendas da conta]).
12. **`GET /trends/MLB`** e **`GET /trends/MLB/{category_id}`**: top 50 palavras-chave mais buscadas no Mercado Livre ou na categoria.
13. **Outros endpoints `200 OK` disponíveis**: `/sites/MLB`, `/sites/MLB/listing_types`, `/sites/MLB/listing_exposures`, `/currencies/BRL`, `/products/search?status=active&site_id=MLB&q=...`, `/items/{id}/shipping_options?zip_code=...`, `/catalog_domains/{domain_id}`, `/users/me`.

### Endpoints BLOQUEADOS (`403` / `404`) mesmo com token de usuário
- **`GET /items/{id}`** e **`GET /items?ids=`**: `403 Access to the requested resource is forbidden` (bloqueado pelo PolicyAgent). Por isso `sold_quantity` direto do item não é acessível via API.
- **`GET /user-products/{id}`** e **`GET /products/MLBU...`**: `403 Forbidden`.
- **`GET /sites/MLB/search`**: `403 Forbidden`.
- **`GET /visits/items?ids=`**: `403 Forbidden`.
- **`GET /reviews/item/{id}`**: `403 Forbidden`.

## Estado atual
- App publicado e funcionando no **GitHub Pages direto da branch `main`** (`https://lucaszampronio.github.io/MercadoLivreApp/`).
- **100% dos 560 produtos possuem imagem** (para `USER_PRODUCT` e `ITEM`, busca foto representativa da subcategoria/domínio em `/products/search`, mais fallback SVG no cliente).
- Interface possui **painel de controle interativo** (dropdown de categorias/visão geral de 560 produtos ou top 1 por categoria, busca textual instantânea, ordenação por 8 critérios, filtros rápidos de Full/Frete Grátis/Loja Oficial/Platinum/Clássico/Premium, **simulador em tempo real de Imposto % e CMV %** e **paginação completa** com 12/20/40/60 itens por página).

## Decisões
- O GitHub Pages serve direto da branch `main` (`/`). A pipeline `.github/workflows/deploy-pages.yml` roda a cada 6h (ou manualmente), atualiza `public/data/meli-snapshot.json`, roda `npm run build` (que atualiza `index.html` e `_next/` na raiz) e faz commit + push direto na `main`.
- **Como as métricas estilo Avantpro são calculadas**:
  - **Recebimento líquido do anúncio (100% oficial)**: `Preço - Tarifa ML (/listing_prices) - Frete vendedor (/shipping_options/free)`.
  - **Imposto, Lucro Líquido e Faixa de preço para lucro (15%–25%)**: calculados dinamicamente com os sliders de Imposto (padrão 6% Simples) e CMV (padrão 45%) usando a fórmula inversa `(Custo + Frete + Taxa Fixa) / (1 - %TarifaML - %Imposto - %Margem)`.
  - **Vendas estimadas, ritmo/dia, vendas/mês e faturamento**: modelo híbrido que combina (a) o total histórico de perguntas do anúncio (`/questions/search`, benchmark ~8 vendas/pergunta) + a velocidade das últimas 50 perguntas (`date_created` do lote recente, peso 60%) com a média desde a criação do catálogo (peso 40%), e (b) curva de Pareto/Zipf pela posição `#1..#20` quando a oferta atual do buybox ainda tem 0 perguntas.
- **Isolamento total de configurações corporativas (SAP)**: o projeto possui `.npmrc` forçando `registry=https://registry.npmjs.org/`. **JAMAIS** usar Artifactory, email, proxy ou qualquer configuração da SAP neste projeto.
- `.env`, `.meli-tokens.json`, `.meli-pkce.json` e `out` estão no `.gitignore`.

## Pendências
- [ ] Cadastrar os Secrets `MELI_APP_ID` e `MELI_CLIENT_SECRET` em Settings > Secrets and variables > Actions no GitHub para a atualização automática de 6 em 6 horas.
- [ ] Reiniciar o Antigravity e conferir se o MCP conecta em Additional Options > MCP Servers.
- [ ] Considerar `npm audit` (2 vulnerabilidades reportadas na instalação).

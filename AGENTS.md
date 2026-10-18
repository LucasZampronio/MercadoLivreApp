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
- `lib/meli.ts`: cliente da API enriquecido com catálogo, ofertas, subcategorias, tarifas de venda, frete do vendedor, perguntas/demanda, reputação do vendedor, tendências de busca e gerador de snapshot completo (`generateFullSnapshot`)
- `app/page.tsx` e `app/DashboardClient.tsx`: página estática/client-side que lê `public/data/meli-snapshot.json` (com fallback para API ao vivo), permitindo trocar entre "Todas as categorias" e qualquer uma das 32 categorias instantaneamente no GitHub Pages
- `app/layout.tsx`, `app/globals.css`: layout e estilos
- `next.config.mjs`: configuração `output: "export"`, `basePath` dinâmico para GitHub Actions e `outputFileTracingRoot`
- `scripts/update-data.ts`: script da pipeline (`npm run update-data` / `npm run update-data:local`) que coleta as 32 categorias e atualiza `public/data/meli-snapshot.json`
- `.github/workflows/deploy-pages.yml`: pipeline do GitHub Actions que atualiza `public/data/meli-snapshot.json` (a cada 6h, em cada push ou manualmente), faz commit do JSON atualizado e publica no GitHub Pages
- `scripts/list-mcp-tools.mjs`: lista as tools do MCP do ML
- `scripts/meli-login.mjs`: login OAuth de usuário (PKCE) em 2 passos (`start` / `finish "<url>"`); salva `.meli-tokens.json`
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
- App configurado com exportação estática (`output: "export"`) para **GitHub Pages** e pipeline automática em `.github/workflows/deploy-pages.yml`.
- `npm run update-data:local` gera `public/data/meli-snapshot.json` com todas as 32 categorias e seus produtos enriquecidos.
- Aviso de múltiplos lockfiles do Next resolvido com `outputFileTracingRoot` em `next.config.mjs`.

## Decisões
- Como o GitHub Pages é estático (sem servidor Node.js e sem expor `MELI_CLIENT_SECRET` no navegador), a pipeline do GitHub Actions roda `scripts/update-data.ts`, atualiza e commita `public/data/meli-snapshot.json`, gera o bundle estático (`out/`) e publica no GitHub Pages.
- Métricas estilo Avantpro calculadas sobre os endpoints oficiais:
  - **Recebimento líquido do anúncio**: `Preço - Tarifa ML (/listing_prices) - Frete vendedor (/shipping_options/free)`.
  - **Imposto e Faixa de preço para lucro (15%–25%)**: calculados sobre a tarifa real da categoria + Simples Nacional (6% ref.) + CMV estimado (45%).
  - **Vendas estimadas, ritmo/dia, vendas/mês e faturamento**: estimados a partir do total real de perguntas do anúncio (`/questions/search`, benchmark ~8 vendas/pergunta) dividido pelos dias ativos do produto (`date_created`).
- **Isolamento total de configurações corporativas (SAP)**: o projeto possui `.npmrc` forçando `registry=https://registry.npmjs.org/`. **JAMAIS** usar Artifactory, email, proxy ou qualquer configuração da SAP neste projeto.
- `.env`, `.meli-tokens.json`, `.meli-pkce.json` e `out` estão no `.gitignore`.

## Pendências
- [ ] Cadastrar os Secrets `MELI_APP_ID` e `MELI_CLIENT_SECRET` em Settings > Secrets and variables > Actions no GitHub e ativar Settings > Pages > Source: **GitHub Actions**.
- [ ] Fazer commit e `git push origin main` do `package-lock.json`, `.npmrc` e `.github/workflows/deploy-pages.yml` para publicar o site no GitHub Pages.
- [ ] Reiniciar o Antigravity e conferir se o MCP conecta em Additional Options > MCP Servers.
- [ ] Considerar `npm audit` (2 vulnerabilidades reportadas na instalação).

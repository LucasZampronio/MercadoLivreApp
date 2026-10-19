# Mapa Auditado da API do Mercado Livre (`MLB`)

> Implementação em código: [`lib/meli/client.ts`](../lib/meli/client.ts) e [`lib/meli/service.ts`](../lib/meli/service.ts)

Este documento registra todos os endpoints oficiais de `https://api.mercadolibre.com` auditados com token OAuth 2.0 (`client_credentials` e `authorization_code` + PKCE), indicando o que retorna `200 OK`, quais campos são extraídos e quais endpoints são bloqueados pelo PolicyAgent (`403 Forbidden`).

---

## 1. Recomendações de Autenticação Aplicadas
Seguindo a [documentação oficial de segurança do Mercado Livre](https://developers.mercadolibre.com.ar/en_us/authorization-and-token-recommendations):
- O `POST /oauth/token` envia todas as credenciais (`grant_type`, `client_id`, `client_secret`) exclusivamente no **body** (`application/x-www-form-urlencoded`), nunca na query string.
- Todas as chamadas subsequentes enviam o header `Authorization: Bearer <access_token>`.

---

## 2. Endpoints que Funcionam (`200 OK`) e são Usados no Projeto

| # | Endpoint | Finalidade | Principais Campos Extraídos |
| :-: | :--- | :--- | :--- |
| **1** | `POST /oauth/token` | Geração do token OAuth | `access_token`, `expires_in`, `refresh_token`, `user_id` |
| **2** | `GET /sites/MLB/categories` | Lista as 32 categorias raiz do Brasil | `id`, `name` |
| **3** | `GET /categories/{id}` | Metadados e concorrência da categoria/subcategoria | `name`, `total_items_in_this_category`, `path_from_root`, `settings.catalog_domain` |
| **4** | `GET /highlights/MLB/category/{id}` | Top 20 mais vendidos da categoria | `content[]`: `id`, `position` (`1..20`), `type` (`PRODUCT` \| `USER_PRODUCT` \| `ITEM`) |
| **5** | `GET /highlights/MLB/product/{id}`<br>`GET /highlights/MLB/item/{id}` | Descobre a subcategoria exata onde o item é destaque (funciona inclusive para `MLBU` e `ITEM`) | `id` (ID da subcategoria), `label` (nome da subcategoria), `position` |
| **6** | `GET /products/{id}` | Ficha técnica completa do produto de catálogo (`type === "PRODUCT"`) | `name`, `family_name`, `pictures[]`, `attributes[]` (`BRAND`, `MODEL`, `COLOR`, `WEIGHT`, `DIMENSIONS`), `main_features[]`, `quality_type`, `date_created`, `last_updated` |
| **7** | `GET /products/{id}/items` | Lista as ofertas ativas ordenadas por prioridade de Buy Box (`results[0]` é o Buy Box Winner!) | `results[]`: `item_id`, `seller_id`, `price`, `original_price`, `condition`, `warranty`, `listing_type_id`, `category_id`, `official_store_id`, `shipping.free_shipping`, `shipping.logistic_type` (`fulfillment`=Full, `self_service`=Flex), `seller_address` |
| **8** | `GET /items/{item_id}/description` | Obtém a descrição e a **data exata de criação do anúncio** (funciona com `200 OK` mesmo quando `GET /items/{id}` dá `403`!) | `date_created` (data de criação do anúncio), `last_updated`, `plain_text` |
| **9** | `GET /sites/MLB/listing_prices` | Calcula a comissão oficial exata do ML por venda (`price`, `category_id`, `listing_type_id`) | `listing_type_name` (`Clássico` / `Premium`), `sale_fee_amount` (R$), `sale_fee_details.percentage_fee` (%), `sale_fee_details.fixed_fee` (R$) |
| **10** | `GET /users/{seller}/shipping_options/free` | Calcula o custo de frete Mercado Envios pago pelo vendedor (`item_id`, `item_price`, `listing_type_id`, `mode`, `condition`, `logistic_type`) | `coverage.all_country.list_cost` (R$), `coverage.all_country.billable_weight` (peso faturável em gramas) |
| **11** | `GET /questions/search?item={item_id}&api_version=4` | Total de perguntas e histórico recente de engajamento (funciona mesmo quando `/items/{id}` dá `403`!) | `total` (total de perguntas), `questions[]`: `date_created`, `seller_id`, `text`, `answer` |
| **12** | `GET /users/{seller_id}` | Perfil e reputação pública do vendedor | `nickname`, `permalink`, `user_type`, `address`, `seller_reputation.level_id` (`5_green`), `seller_reputation.power_seller_status` (`platinum` / `gold`), `seller_reputation.transactions.total` |
| **13** | `GET /trends/MLB`<br>`GET /trends/MLB/{category_id}` | Termos e palavras-chave mais buscadas no momento | `keyword`, `url` |
| **14** | `GET /products/search?status=active&site_id=MLB&q=...&domain_id=...` | Busca de catálogo por palavra-chave e domínio | `results[]`: `id`, `name`, `pictures[]`, `attributes[]`, `date_created` (usado para recuperar foto representativa de itens `MLBU` e `ITEM`) |

---

## 3. Endpoints Bloqueados (`403 Forbidden`) na API Pública

Mesmo utilizando token OAuth de usuário (`authorization_code` + PKCE com todos os escopos de leitura habilitados), o firewall **PolicyAgent** do Mercado Livre bloqueia:
- `GET /items/{item_id}` e `GET /items?ids={item_id}` → `403 Access to the requested resource is forbidden (PA_UNAUTHORIZED_RESULT_FROM_POLICIES)`
- `GET /user-products/{mlbu_id}` e `GET /products/MLBU...` → `403 Forbidden`
- `GET /sites/MLB/search?q=...` → `403 Forbidden`
- `GET /visits/items?ids=...` → `403 Forbidden`
- `GET /reviews/item/{item_id}` → `403 Forbidden`

---

## 4. Como Resolvemos Produtos `USER_PRODUCT` (`MLBU...`) e `ITEM` (`MLB...`)

Quando o ranking `/highlights/MLB/category/{id}` retorna um item do tipo `USER_PRODUCT` (`MLBU...`) ou `ITEM` (`MLB...`), em vez de exibir apenas o código bruto:
1. Consultamos `/products/{mlbu_id}/items` para obter o `item_id`, `seller_id`, `price`, `original_price`, `free_shipping` e `logistic_type`.
2. Consultamos `/highlights/MLB/{product|item}/{id}` para descobrir a **subcategoria exata** onde o item é destaque (ex.: `"Tags de Pagamento de Pedágio"`, `"Capas de Chuva"`).
3. Consultamos `/questions/search?item={item_id}&api_version=4` para obter o **total de perguntas** e o `seller_id` (caso seja um `ITEM` puro).
4. Consultamos `/users/{seller_id}` para obter o **nome do vendedor (`nickname`)**, reputação (`MercadoLíder Platinum`) e total de vendas da conta.
5. Consultamos `/products/search?status=active&site_id=MLB&q={subcategoria}&domain_id={catalog_domain}&limit=1` para obter uma **imagem real do catálogo** daquela subcategoria.


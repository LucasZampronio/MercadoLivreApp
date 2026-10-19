# Servidor MCP do Mercado Livre e Login OAuth PKCE

> Scripts relacionados: [`scripts/list-mcp-tools.mjs`](../scripts/list-mcp-tools.mjs) e [`scripts/meli-login.mjs`](../scripts/meli-login.mjs)

---

## 1. Endpoint Oficial do MCP Server

A documentação oficial do Mercado Livre ([Mercado Libre MCP Server](https://developers.mercadolibre.com.ar/en_us/mcp-server)) define o endpoint HTTP Streamable em:

```text
https://mcp.mercadolibre.com/devsite/v1/mcp
```

> **Atenção:** A URL raiz `https://mcp.mercadolibre.com/mcp` retorna `301 Moved Permanently` redirecionando para a página HTML da documentação. Sempre utilize `/devsite/v1/mcp`.

---

## 2. Configuração no Antigravity / Clientes MCP

No arquivo `~/.gemini/config/mcp_config.json`:

```json
{
  "mcpServers": {
    "mercadolibre-mcp-server": {
      "url": "https://mcp.mercadolibre.com/devsite/v1/mcp"
    }
  }
}
```

### Como testar via linha de comando
```bash
node --env-file=.env scripts/list-mcp-tools.mjs
```

### Ferramentas disponibilizadas pelo MCP do Mercado Livre
- **`search_documentation`**: pesquisa tópicos e guias na documentação oficial do Developers Site do Mercado Livre.
- **`get_documentation_page`**: retorna o conteúdo completo de uma página específica da documentação oficial.

*(O MCP oficial do Mercado Livre é voltado para consulta de documentação durante o desenvolvimento; os dados de produtos, categorias, tarifas e ranking vêm da API REST em `https://api.mercadolibre.com`).*

---

## 3. Login OAuth 2.0 de Usuário com PKCE (`scripts/meli-login.mjs`)

Caso precise gerar um token de usuário (`authorization_code` com `PKCE S256`):

1. **Passo 1 — Gerar a URL de autorização e o desafio PKCE:**
   ```bash
   node --env-file=.env scripts/meli-login.mjs start
   ```
2. Abra a URL impressa no terminal, autorize a aplicação no Mercado Livre e copie a URL final da barra de endereço (`https://example.com/callback?code=TG-...&state=...`).
3. **Passo 2 — Trocar o `code` pelo `access_token` e `refresh_token`:**
   ```bash
   node --env-file=.env scripts/meli-login.mjs finish "<URL_COPIADA>"
   ```
   Os tokens são salvos localmente em `.meli-tokens.json` (ignorado pelo Git).


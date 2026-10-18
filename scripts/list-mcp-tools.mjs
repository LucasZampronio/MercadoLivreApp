// Lista as ferramentas do MCP do Mercado Livre. Uso: node --env-file=.env scripts/list-mcp-tools.mjs
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const tokenRes = await fetch("https://api.mercadolibre.com/oauth/token", {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
  body: new URLSearchParams({
    grant_type: "client_credentials",
    client_id: process.env.MELI_APP_ID,
    client_secret: process.env.MELI_CLIENT_SECRET,
  }),
});
if (!tokenRes.ok) throw new Error(`token ${tokenRes.status}: ${await tokenRes.text()}`);
const { access_token } = await tokenRes.json();

const client = new Client({ name: "meli-top-vendas", version: "0.1.0" });
await client.connect(
  new StreamableHTTPClientTransport(new URL("https://mcp.mercadolibre.com/devsite/v1/mcp"), {
    requestInit: { headers: { Authorization: `Bearer ${access_token}` } },
  }),
);
const { tools } = await client.listTools();
for (const t of tools) console.log(`- ${t.name}: ${t.description?.slice(0, 120)}`);
await client.close();


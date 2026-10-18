// Login OAuth de usuário (authorization_code + PKCE) no Mercado Livre, em dois passos.
// O redirect_uri cadastrado no app é https://example.com/callback (o painel só aceita https),
// então a página vai dar erro/vazia: basta copiar a URL final da barra de endereço.
//
//   1) node --env-file=.env scripts/meli-login.mjs start
//   2) node --env-file=.env scripts/meli-login.mjs finish "<URL final copiada>"
//
// Salva os tokens em .meli-tokens.json (ignorado pelo git).
import { createHash, randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const REDIRECT = process.env.MELI_REDIRECT_URI ?? "https://example.com/callback";
const AUTH = "https://auth.mercadolivre.com.br/authorization";
const TOKEN = "https://api.mercadolibre.com/oauth/token";
const PKCE_FILE = ".meli-pkce.json";
const TOKENS_FILE = ".meli-tokens.json";

const b64url = (buf) => buf.toString("base64url");
const [cmd, arg] = process.argv.slice(2);

if (cmd === "start") {
  const verifier = b64url(randomBytes(48));
  const challenge = b64url(createHash("sha256").update(verifier).digest());
  const state = b64url(randomBytes(16));
  await writeFile(PKCE_FILE, JSON.stringify({ verifier, state }), { mode: 0o600 });
  const url = new URL(AUTH);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: process.env.MELI_APP_ID,
    redirect_uri: REDIRECT,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  console.log("Abra esta URL, autorize e copie a URL final da barra de endereço:\n");
  console.log(url.toString());
} else if (cmd === "finish" && arg) {
  const { verifier, state } = JSON.parse(await readFile(PKCE_FILE, "utf8"));
  const back = new URL(arg);
  if (back.searchParams.get("state") !== state) throw new Error("state não confere");
  const code = back.searchParams.get("code");
  if (!code) throw new Error("URL sem parâmetro code");
  const res = await fetch(TOKEN, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.MELI_APP_ID,
      client_secret: process.env.MELI_CLIENT_SECRET,
      code,
      redirect_uri: REDIRECT,
      code_verifier: verifier,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`token ${res.status}: ${JSON.stringify(data)}`);
  await writeFile(
    TOKENS_FILE,
    JSON.stringify({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + data.expires_in * 1000,
    }),
    { mode: 0o600 },
  );
  console.log("OK. Tokens salvos em", TOKENS_FILE, "| user_id:", data.user_id, "| scope:", data.scope);
} else {
  console.log('Uso: meli-login.mjs start | finish "<url>"');
  process.exit(1);
}


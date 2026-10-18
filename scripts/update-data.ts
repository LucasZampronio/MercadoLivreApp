// Atualiza o snapshot estático com todas as 32 categorias, produtos, tarifas e tendências.
// Uso local: node --env-file=.env scripts/update-data.ts
// Uso na pipeline (GitHub Actions): node scripts/update-data.ts
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { generateFullSnapshot } from "../lib/meli.ts";

const OUT = resolve(process.cwd(), "public/data/meli-snapshot.json");

console.log("Iniciando coleta completa da API do Mercado Livre...");
const started = Date.now();
const snapshot = await generateFullSnapshot((msg) => console.log(msg));

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(snapshot, null, 2), "utf8");

const totalProds = snapshot.categories.reduce((s, c) => s + c.products.length, 0);
console.log(
  `Snapshot salvo em ${OUT} (${snapshot.categories.length} categorias, ${totalProds} produtos) em ${((Date.now() - started) / 1000).toFixed(1)}s`,
);


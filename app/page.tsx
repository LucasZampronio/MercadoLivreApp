import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import DashboardClient from "./DashboardClient";
import {
  getBestSellers,
  getCategories,
  getCategoryDetails,
  getTopOfAllCategories,
  getTrends,
  type MeliSnapshot,
} from "@/lib/meli";

async function getSnapshot(): Promise<MeliSnapshot> {
  const file = resolve(process.cwd(), "public/data/meli-snapshot.json");
  try {
    const raw = await readFile(file, "utf8");
    return JSON.parse(raw) as MeliSnapshot;
  } catch {
    // Fallback caso o arquivo ainda não tenha sido gerado: busca a 1ª categoria + top de todas ao vivo
    const [cats, generalTrends, topOfAll] = await Promise.all([
      getCategories(),
      getTrends(),
      getTopOfAllCategories(),
    ]);
    const first = cats[0];
    const [firstDetails, firstTrends, firstProds] = first
      ? await Promise.all([
          getCategoryDetails(first.id),
          getTrends(first.id),
          getBestSellers(first.id),
        ])
      : [null, [], []];

    return {
      updatedAt: new Date().toISOString(),
      siteId: "MLB",
      generalTrends,
      categories: cats.map((c, idx) => ({
        id: c.id,
        name: c.name,
        details: idx === 0 ? firstDetails : null,
        trends: idx === 0 ? firstTrends : [],
        products: idx === 0 ? firstProds : topOfAll.filter((p) => p.categoryId === c.id),
      })),
      topOfAll,
    };
  }
}

export default async function Home() {
  let error: string | null = null;
  let snapshot: MeliSnapshot | null = null;

  try {
    snapshot = await getSnapshot();
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  if (error || !snapshot) {
    return (
      <main>
        <h1>Mais vendidos no Mercado Livre</h1>
        <pre className="error">{error ?? "Falha ao carregar dados"}</pre>
      </main>
    );
  }

  return <DashboardClient snapshot={snapshot} />;
}

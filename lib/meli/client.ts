const API = "https://api.mercadolibre.com";
export const SITE = process.env.MELI_SITE_ID ?? "MLB";

let cachedToken: { token: string; expires: number } | null = null;
const responseCache = new Map<string, { expires: number; data: unknown }>();
const inflightCache = new Map<string, Promise<unknown>>();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function getToken(): Promise<string> {
  if (cachedToken && cachedToken.expires > Date.now() + 60_000) {
    return cachedToken.token;
  }

  const id = process.env.MELI_APP_ID;
  const secret = process.env.MELI_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error("Defina MELI_APP_ID e MELI_CLIENT_SECRET em .env");
  }

  const res = await fetch(`${API}/oauth/token`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: id,
      client_secret: secret,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Falha ao obter token (${res.status}): ${await res.text()}`);
  }

  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expires: Date.now() + data.expires_in * 1000,
  };
  return cachedToken.token;
}

export async function meli<T>(path: string, revalidate = 900): Promise<T> {
  const hit = responseCache.get(path);
  if (hit && hit.expires > Date.now()) {
    return hit.data as T;
  }

  const pending = inflightCache.get(path);
  if (pending) {
    return pending as Promise<T>;
  }

  const reqPromise = (async () => {
    const token = await getToken();
    let lastStatus = 0;
    let lastBody = "";

    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch(`${API}${path}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const json = (await res.json()) as T;
        responseCache.set(path, {
          expires: Date.now() + revalidate * 1000,
          data: json,
        });
        return json;
      }

      lastStatus = res.status;
      lastBody = await res.text();
      if (res.status === 429 || res.status >= 500) {
        await sleep(350 * (attempt + 1));
        continue;
      }
      break;
    }

    throw new Error(`ML API ${path} -> ${lastStatus}: ${lastBody}`);
  })();

  inflightCache.set(path, reqPromise);
  try {
    return await reqPromise;
  } finally {
    inflightCache.delete(path);
  }
}

export async function mapPool<T, R>(
  list: T[],
  size: number,
  fn: (x: T, idx: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(list.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, list.length) }, async () => {
      while (next < list.length) {
        const i = next++;
        out[i] = await fn(list[i], i);
      }
    }),
  );
  return out;
}

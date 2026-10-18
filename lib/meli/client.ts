const API = "https://api.mercadolibre.com";
export const SITE = process.env.MELI_SITE_ID ?? "MLB";

let cachedToken: { token: string; expires: number } | null = null;
const responseCache = new Map<string, { expires: number; data: unknown }>();

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

  const token = await getToken();
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`ML API ${path} -> ${res.status}: ${await res.text()}`);
  }

  const json = (await res.json()) as T;
  responseCache.set(path, {
    expires: Date.now() + revalidate * 1000,
    data: json,
  });
  return json;
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

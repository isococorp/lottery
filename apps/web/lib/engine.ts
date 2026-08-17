// BFF helper — the ONLY place the web talks to the Python engine.
// No lottery formulas exist in the frontend (guardrail #3 / §7.4).
const ENGINE_URL = process.env.ENGINE_URL ?? "http://localhost:8000";

export async function engineGet(path: string) {
  const r = await fetch(`${ENGINE_URL}${path}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`engine ${path} -> ${r.status}`);
  return r.json();
}

export async function enginePost(path: string, body: unknown) {
  const r = await fetch(`${ENGINE_URL}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`engine ${path} -> ${r.status}`);
  return r.json();
}

export { ENGINE_URL };

// Vercel: тот же прокси к Gemini, что proxy/worker.js, — запасной адрес для тех, у кого режется Cloudflare.
// Ключ в переменной окружения GEMINI_KEY (Vercel → Settings → Environment Variables).
const MODELS = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.5-flash", "gemini-3.5-flash-lite"];

async function ask(m, prompt, key) {
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
      method: "POST", signal: AbortSignal.timeout(9000),
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.9, responseMimeType: "application/json", maxOutputTokens: 1200 } }),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok) return { ok: true, text: j.candidates?.[0]?.content?.parts?.map(p => p.text).join("") || "" };
    return { ok: false, err: `${m}: ${r.status} ${(j.error?.message || "").slice(0, 60)}` };
  } catch (e) { return { ok: false, err: `${m}: timeout` }; }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  const key = process.env.GEMINI_KEY;
  if (req.method === "GET") return res.status(200).json({ ok: true, hasKey: !!key });
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const prompt = String(body.prompt || "").slice(0, 8000);
  if (!prompt) return res.status(400).json({ error: "empty" });
  if (!key) return res.status(500).json({ error: "no key" });
  const errs = [];
  for (const m of MODELS) {
    const r = await ask(m, prompt, key);
    if (r.ok) return res.status(200).json({ text: r.text, model: m });
    errs.push(r.err);
  }
  return res.status(502).json({ error: errs.join(" | ") });
}

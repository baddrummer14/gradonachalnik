// Cloudflare Worker: прокси игры «Градоначальникъ» к Gemini.
// Ключ хранится в секрете GEMINI_KEY (Settings → Variables and Secrets), в код его не вставлять.
const MODELS = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.5-flash", "gemini-3.5-flash-lite"];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
const json = (o, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
    if (req.method === "GET") {
      const u = new URL(req.url);
      if (u.searchParams.has("models")) { const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", { headers: { "x-goog-api-key": env.GEMINI_KEY } });
        const j = await r.json(); return json((j.models || []).filter(x => x.supportedGenerationMethods?.includes("generateContent")).map(x => x.name)); }
      if (!u.searchParams.has("diag")) return json({ ok: true, hasKey: !!env.GEMINI_KEY });
      const out = [];
      for (const m of (u.searchParams.get("diag") ? u.searchParams.get("diag").split(",") : MODELS)) { const t = Date.now(); const r = await ask(m, 'Ответь JSON {"w":"привет"}', env.GEMINI_KEY);
        out.push(`${m}: ${r.status} ${Date.now() - t}мс ${(r.text || r.err || "").slice(0, 80)}`); }
      return json(out);
    }
    if (req.method !== "POST") return json({ error: "method" }, 405);

    let prompt = "";
    try { prompt = String((await req.json()).prompt || "").slice(0, 8000); } catch { return json({ error: "bad json" }, 400); }
    if (!prompt) return json({ error: "empty" }, 400);
    if (!env.GEMINI_KEY) return json({ error: "no key" }, 500);

    const errs = [];
    for (const [i, m] of MODELS.entries()) {
      if (i === MODELS.length - 1) await sleep(1000); // последняя попытка — повтор после паузы
      const r = await ask(m, prompt, env.GEMINI_KEY);
      if (r.ok) return json({ text: r.text, model: m });
      errs.push(`${m}: ${r.status} ${(r.err || "").slice(0, 60)}`);
    }
    return json({ error: errs.join(" | ") }, 502);
  },
};

// Один запрос к модели с ограничением по времени, без «размышлений», чтобы отвечала быстро.
async function ask(m, prompt, key) {
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
      method: "POST", signal: AbortSignal.timeout(9000),
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.9, responseMimeType: "application/json", maxOutputTokens: 1200 },
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok) return { ok: true, status: 200, text: j.candidates?.[0]?.content?.parts?.map(p => p.text).join("") || "" };
    return { ok: false, status: r.status, err: j.error?.message || "" };
  } catch (e) { return { ok: false, status: "timeout", err: e.name }; }
}

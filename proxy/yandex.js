// Yandex Cloud Function: входная точка для игроков из России.
// Адреса Яндекса открываются у всех российских операторов. Функция пересылает запрос
// на наш прокси Vercel (там ключ Gemini), от сервера к серверу блокировок нет.
// Ключа здесь нет и не нужно.
const UPSTREAM = ["https://gradonachalnik.vercel.app/api/judge", "https://gradonachalnik.baddrummer14.workers.dev"];
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json"
};

module.exports.handler = async function (event) {
  const method = event.httpMethod || "POST";
  if (method === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };
  if (method === "GET") return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, via: "yandex" }) };

  let body = event.body || "";
  if (event.isBase64Encoded) body = Buffer.from(body, "base64").toString("utf8");
  if (body.length > 20000) return { statusCode: 413, headers: CORS, body: '{"error":"too big"}' };

  const errs = [];
  for (const url of UPSTREAM) {
    try {
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body, signal: AbortSignal.timeout(25000) });
      const text = await r.text();
      if (r.ok) return { statusCode: 200, headers: CORS, body: text };
      errs.push(url + ": " + r.status);
    } catch (e) { errs.push(url + ": " + e.name); }
  }
  return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: errs.join(" | ") }) };
};

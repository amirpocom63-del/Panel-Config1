
import fs from "node:fs/promises";

const raw = (process.env.SOURCE_URLS || "").trim();
// مثال SECRET: https://intra.example.com/a.txt,https://intra.example.com/b.txt
const URLS = raw.split(",").map(s => s.trim()).filter(Boolean);

if (!URLS.length) {
  console.error("SOURCE_URLS is empty. Set it in GitHub Secrets.");
  process.exit(1);
}

function buildAuthHeaders() {
  const headers = {};
  // Basic Auth (اختیاری)
  const u = process.env.BASIC_USER;
  const p = process.env.BASIC_PASS;
  if (u && p) {
    const token = Buffer.from(`${u}:${p}`).toString("base64");
    headers["Authorization"] = `Basic ${token}`;
  }
  // Bearer token (اختیاری)
  const apiToken = process.env.API_TOKEN;
  if (apiToken) headers["Authorization"] = `Bearer ${apiToken}`;
  headers["Accept"] = "text/plain,*/*";
  return headers;
}

async function fetchText(url, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: buildAuthHeaders(),
    });
    if (!res.ok) return { ok: false, url, error: `HTTP ${res.status}` };
    const text = await res.text();
    return { ok: true, url, text };
  } catch (e) {
    const msg = e?.name === "AbortError" ? "Timeout" : (e?.message || String(e));
    return { ok: false, url, error: msg };
  } finally {
    clearTimeout(t);
  }
}

// معیار سلامت “عمومی” برای متن:
// - حداقل طول
// - تعداد خطوط معتبر از یک حداقل بیشتر باشد
function isHealthyText(text) {
  const t = text.replace(/^\uFEFF/, "").trim();
  if (t.length < 20) return { ok: false, reason: "too_short" };

  const lines = t.replace(/\r\n?/g, "\n").split("\n")
    .map(x => x.trim())
    .filter(Boolean);

  // اگر فایل باید لیست رکوردهای خطی باشد:
  const minLines = 3; // قابل تغییر
  if (lines.length < minLines) return { ok: false, reason: "too_few_lines" };

  return { ok: true, lines };
}

function mergeLines(allLines) {
  // حذف تکراری‌ها
  const seen = new Set();
  const out = [];
  for (const l of allLines) {
    if (seen.has(l)) continue;
    seen.add(l);
    out.push(l);
  }
  return out.join("\n") + "\n";
}

const timeoutMs = 8000;

const results = await Promise.all(URLS.map(u => fetchText(u, timeoutMs)));

const ok = [];
const bad = [];
let mergedLines = [];

for (const r of results) {
  if (!r.ok) {
    bad.push({ url: r.url, error: r.error });
    continue;
  }
  const health = isHealthyText(r.text);
  if (!health.ok) {
    bad.push({ url: r.url, error: `unhealthy:${health.reason}` });
    continue;
  }
  ok.push({ url: r.url, lines: health.lines.length });
  mergedLines = mergedLines.concat(health.lines);
}

const merged = mergeLines(mergedLines);

await fs.mkdir("docs", { recursive: true });
await fs.writeFile("docs/merged.txt", merged, "utf8");
await fs.writeFile("docs/report.json", JSON.stringify({ ok, bad, total_lines: mergedLines.length }, null, 2), "utf8");
await fs.writeFile("docs/last_updated.txt", new Date().toISOString() + "\n", "utf8");

console.log("OK:", ok.length, "BAD:", bad.length, "Merged lines:", mergedLines.length);

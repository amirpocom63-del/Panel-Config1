import fs from "fs";
import { performance } from "perf_hooks";

const raw = process.env.SOURCE_URLS || "";
const urls = raw.split(",").map(u => u.trim()).filter(Boolean);

if (urls.length === 0) {
  console.log("No SOURCE_URLS defined");
  process.exit(0);
}

const TIMEOUT = 8000;
const SLOW_LIMIT = 2000;
const TEST_FILE = "https://speed.hetzner.de/10MB.bin"; // سبک‌تر از 100MB
const results = [];

async function testServer(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT);

  let latency = 0;
  let speedMbps = 0;
  let status = "down";

  try {
    // latency test
    const start = performance.now();
    const res = await fetch(url, { signal: controller.signal });
    latency = Math.round(performance.now() - start);

    if (!res.ok) throw new Error("HTTP " + res.status);

    // download speed test
    const dlStart = performance.now();
    const dlRes = await fetch(TEST_FILE);
    const buffer = await dlRes.arrayBuffer();
    const dlTime = (performance.now() - dlStart) / 1000;
    const sizeMB = buffer.byteLength / (1024 * 1024);
    speedMbps = Math.round((sizeMB / dlTime) * 8);

    if (latency < SLOW_LIMIT) {
      status = "healthy";
    } else {
      status = "slow";
    }

  } catch (err) {
    status = "down";
  } finally {
    clearTimeout(timeout);
  }

  results.push({
    url,
    status,
    latency,
    speedMbps
  });
}

async function run() {
  for (const url of urls) {
    console.log("Testing:", url);
    await testServer(url);
  }

  if (!fs.existsSync("docs")) {
    fs.mkdirSync("docs");
  }

  fs.writeFileSync("docs/report.json", JSON.stringify({
    updated: new Date().toISOString(),
    total: results.length,
    results
  }, null, 2));

  console.log("Report generated.");
}

run();    if (!res.ok) return { ok: false, url, error: `HTTP ${res.status}` };
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

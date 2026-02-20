import fs from "fs";
import { performance } from "perf_hooks";

const raw = process.env.SOURCE_URLS || "";
const urls = raw.split(",").map(u => u.trim()).filter(Boolean);

if (!urls.length) {
  console.log("No SOURCE_URLS defined");
  process.exit(0);
}

const TIMEOUT = 8000;
const SLOW_LIMIT = 2000;
const results = [];

async function testServer(url) {
  let latency = 0;
  let speedMbps = 0;
  let status = "down";

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT);

    const start = performance.now();
    const response = await fetch(url, { signal: controller.signal });
    latency = Math.round(performance.now() - start);

    clearTimeout(timeout);

    if (!response.ok) throw new Error("Bad response");

    // تست سرعت ساده (حجم پاسخ)
    const size = (await response.text()).length;
    speedMbps = Math.round((size / 1024) / (latency / 1000));

    status = latency < SLOW_LIMIT ? "healthy" : "slow";

  } catch (err) {
    status = "down";
  }

  return { url, status, latency, speedMbps };
}

async function run() {
  for (const url of urls) {
    console.log("Testing:", url);
    const result = await testServer(url);
    results.push(result);
  }

  if (!fs.existsSync("docs")) {
    fs.mkdirSync("docs");
  }

  fs.writeFileSync(
    "docs/report.json",
    JSON.stringify({
      updated: new Date().toISOString(),
      total: results.length,
      results
    }, null, 2)
  );

  console.log("Report generated successfully.");
}

run();

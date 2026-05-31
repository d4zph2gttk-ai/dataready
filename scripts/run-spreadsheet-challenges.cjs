const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const assert = require("assert");

const APP_URL = process.env.DATAREADY_URL || "http://127.0.0.1:4180/";
const manifestPath = "C:/Users/prple/OneDrive/Documents/New project/outputs/data-cleaning-samples/challenges/challenge-manifest.json";
const outDir = path.resolve(__dirname, "..", "stress-artifacts", "challenge-runs");

function normalizeHeader(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function expectedForHeader(expected, header) {
  const normalized = normalizeHeader(header);
  const exact = Object.entries(expected).find(([key]) => normalizeHeader(key) === normalized);
  if (exact) return exact[1];
  return null;
}

async function runOne(page, item) {
  await page.goto(APP_URL, { waitUntil: "domcontentloaded" });
  await page.setInputFiles("#fileInput", item.path);
  await page.waitForSelector(".column-map-card select", { timeout: 60000 });

  const mapping = await page.evaluate(() =>
    [...document.querySelectorAll(".column-map-card")].map((card) => ({
      header: card.querySelector("strong")?.textContent || "",
      sample: card.querySelector("span")?.textContent || "",
      type: card.querySelector("select")?.value || "",
    })),
  );

  const expectedEntries = Object.entries(item.expected || {});
  const expectedMatches = expectedEntries.map(([header, expectedType]) => {
    const actual = mapping.find((entry) => normalizeHeader(entry.header) === normalizeHeader(header));
    return {
      header,
      expectedType,
      actualType: actual?.type || "missing",
      sample: actual?.sample || "",
      ok: actual?.type === expectedType,
    };
  });
  const mismatches = expectedMatches.filter((entry) => !entry.ok);

  await page.click("#cleanBtn");
  await page.waitForFunction(() => (document.querySelector("#summaryBox")?.textContent || "").includes("Total cleaned rows:"), null, { timeout: 180000 });

  const cleaned = await page.evaluate(() => ({
    headers: [...document.querySelectorAll("#previewTable thead th")].map((th) => th.textContent || ""),
    firstRow: [...document.querySelectorAll("#previewTable tbody tr:first-child td")].map((td) => td.textContent || ""),
    rows: [...document.querySelectorAll("#previewTable tbody tr")].map((tr) =>
      [...tr.querySelectorAll("td")].map((td) => td.textContent || ""),
    ),
    summary: document.querySelector("#summaryBox")?.textContent || "",
    bodyOverflow: document.documentElement.scrollWidth > window.innerWidth + 2,
    previewRows: document.querySelectorAll("#previewTable tbody tr").length,
    reviewMarkersVisible: (document.querySelector("#previewTable")?.textContent || "").includes("REVIEW:"),
  }));

  assert(cleaned.previewRows <= 100, `${item.name} rendered more than 100 preview rows`);
  assert(!cleaned.bodyOverflow, `${item.name} caused page-level horizontal overflow`);
  assert(!cleaned.reviewMarkersVisible, `${item.name} leaked REVIEW markers into clean preview`);
  if (item.expectedCleanHeaders) {
    const missingHeaders = item.expectedCleanHeaders.filter((header) => !cleaned.headers.some((actual) => normalizeHeader(actual) === normalizeHeader(header)));
    assert(!missingHeaders.length, `${item.name} missing cleaned headers: ${missingHeaders.join(", ")}`);
  }
  if (item.mustContain) {
    const cleanText = [cleaned.headers, ...cleaned.rows].flat().join(" | ");
    const missingValues = item.mustContain.filter((value) => !cleanText.includes(value));
    assert(!missingValues.length, `${item.name} missing expected cleaned values: ${missingValues.join(", ")}`);
  }
  if (item.mustNotContain) {
    const cleanText = [cleaned.headers, ...cleaned.rows].flat().join(" | ").toLowerCase();
    const leakedValues = item.mustNotContain.filter((value) => cleanText.includes(String(value).toLowerCase()));
    assert(!leakedValues.length, `${item.name} leaked values that should be removed: ${leakedValues.join(", ")}`);
  }

  return {
    name: item.name,
    path: item.path,
    expectedCount: expectedEntries.length,
    matchedCount: expectedEntries.length - mismatches.length,
    mismatches,
    mapping,
    cleaned,
  };
}

(async () => {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const results = [];

  for (const item of manifest.files) {
    results.push(await runOne(page, item));
  }

  await browser.close();

  const report = {
    generatedAt: new Date().toISOString(),
    appUrl: APP_URL,
    totals: {
      files: results.length,
      expectedColumns: results.reduce((sum, item) => sum + item.expectedCount, 0),
      matchedColumns: results.reduce((sum, item) => sum + item.matchedCount, 0),
      mismatches: results.reduce((sum, item) => sum + item.mismatches.length, 0),
    },
    results,
  };
  const reportPath = path.join(outDir, `challenge-report-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify({
    reportPath,
    totals: report.totals,
    failures: results.map((item) => ({ name: item.name, mismatches: item.mismatches })).filter((item) => item.mismatches.length),
  }, null, 2));
})();

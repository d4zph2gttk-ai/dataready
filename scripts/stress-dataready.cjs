const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const os = require("os");
const assert = require("assert");
const zlib = require("zlib");

const APP_URL = process.env.DATAREADY_URL || "http://127.0.0.1:4180/";
const ROOT = path.resolve(__dirname, "..");
const RUN_ID = new Date().toISOString().replace(/[:.]/g, "-");
const ARTIFACT_DIR = path.join(ROOT, "stress-artifacts", `run-${RUN_ID}`);

const columns = [
  "customer_id",
  "FULL   NAME",
  "email address",
  "phone-number",
  "city",
  "state",
  "zip / postal",
  "signup date",
  "invoice total",
  "status",
  "lead_source",
  "assigned rep",
  "profile url",
  "notes / free text",
];

const names = ["  mARIA   trujillo  ", "JOSE  chavez", "ana o'connor", "LEE, SAM", "Renée Núñez", "MARTA   GARCIA"];
const cities = ["albuquerque", "SANTA   FE", "rio rancho", "las cruces", "taos", "farmington"];
const states = ["New Mexico", "N.M.", "nm", "TX", "??", ""];
const statuses = ["new", "PAST DUE", "follow_up", " closed ", "", "ACTIVE"];
const sources = ["web form", "PHONE CALL", "email blast", " referral ", "event", ""];

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function makeCsv(rowCount, options = {}) {
  const rows = [columns.map(csvEscape).join(",")];
  for (let i = 0; i < rowCount; i += 1) {
    if (options.emptyRows && i % 47 === 0) {
      rows.push(columns.map(() => "").join(","));
      continue;
    }

    const id = ` C-${String(9000 + i).padStart(6, "0")} `;
    const email =
      i % 11 === 0 ? `bad-email-${i}` :
      i % 7 === 0 ? `USER${i}@Example.CON` :
      `person.${i}@Example.COM `;
    const phone =
      i % 13 === 0 ? "12345" :
      i % 5 === 0 ? `1-505-${String(200 + (i % 700)).padStart(3, "0")}-${String(1000 + i).slice(-4)}` :
      `(505) ${String(200 + (i % 700)).padStart(3, "0")}-${String(1000 + i).slice(-4)}`;
    const date =
      i % 17 === 0 ? "not-a-date" :
      i % 9 === 0 ? `2026-${String((i % 12) + 1).padStart(2, "0")}-${String((i % 28) + 1).padStart(2, "0")}` :
      `${(i % 12) + 1}/${(i % 28) + 1}/26`;
    const amount =
      i % 19 === 0 ? "N/A" :
      i % 8 === 0 ? `($${(100 + i / 10).toFixed(2)})` :
      i % 6 === 0 ? `$${(30 + i / 4).toFixed(2)}` :
      `${30 + i / 4}`;
    const url =
      i % 23 === 0 ? "not a url" :
      i % 4 === 0 ? `example.com/customer/${i}` :
      ` https://example.com/customer/${i} `;
    const note =
      i % 29 === 0 ? "Line one\nLine two, with comma" :
      i % 31 === 0 ? "  needs “review” — odd characters  " :
      " ordinary note ";

    const row = [
      id,
      names[i % names.length],
      email,
      phone,
      cities[i % cities.length],
      states[i % states.length],
      i % 14 === 0 ? "BADZIP" : String(87000 + (i % 900)).padStart(5, "0"),
      date,
      amount,
      statuses[i % statuses.length],
      sources[i % sources.length],
      names[(i + 2) % names.length],
      url,
      note,
    ];
    rows.push(row.map(csvEscape).join(","));

    if (options.duplicates && i % 50 === 0) rows.push(row.map(csvEscape).join(","));
  }
  return rows.join("\r\n");
}

function makeTsv(rowCount) {
  return makeCsv(rowCount, { duplicates: true, emptyRows: true }).replace(/,/g, "\t");
}

function writeFixture(name, content) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  const filePath = path.join(ARTIFACT_DIR, name);
  fs.writeFileSync(filePath, content, "utf8");
  return filePath;
}

async function cleanFixture(page, filePath) {
  await page.goto(APP_URL, { waitUntil: "domcontentloaded" });
  await page.setInputFiles("#fileInput", filePath);
  await page.waitForSelector("#cleanBtn:not([disabled])", { timeout: 30000 });
  const start = Date.now();
  await page.click("#cleanBtn");
  await page.waitForFunction(() => (document.querySelector("#summaryBox")?.textContent || "").includes("Total cleaned rows:"), null, { timeout: 120000 });
  const cleanMs = Date.now() - start;
  await page.check("#termsCheck");
  await page.waitForFunction(() => document.querySelector("#downloadCleanBtn")?.disabled === false, null, { timeout: 30000 });
  const result = {
    cleanMs,
    state: await page.evaluate(() => ({
      summary: document.querySelector("#summaryBox")?.textContent || "",
      upload: document.querySelector("#uploadStatus")?.textContent || "",
      rowCount: Number((document.querySelector("#rowMetric")?.textContent || "0").replace(/,/g, "")),
      quality: document.querySelector("#scoreMetric")?.textContent || "",
      bodyOverflow: document.documentElement.scrollWidth > window.innerWidth + 2,
      tableOverflowContained: (() => {
        const panel = document.querySelector(".preview-panel");
        return panel ? panel.scrollWidth > panel.clientWidth : false;
      })(),
      previewRows: document.querySelectorAll("#previewTable tbody tr").length,
      reviewMarkersVisible: (document.querySelector("#previewTable")?.textContent || "").includes("REVIEW:"),
    })),
  };
  assert(result.state.previewRows <= 100, `${path.basename(filePath)} rendered more than 100 preview rows`);
  assert(result.state.reviewMarkersVisible === false, `${path.basename(filePath)} leaked REVIEW markers into clean preview`);
  assert(result.state.bodyOverflow === false, `${path.basename(filePath)} caused page-level horizontal overflow`);
  return result;
}

async function saveDownload(page, selector, downloadDir) {
  const wait = page.waitForEvent("download", { timeout: 60000 });
  await page.click(selector);
  const download = await wait;
  const filePath = path.join(downloadDir, await download.suggestedFilename());
  await download.saveAs(filePath);
  return filePath;
}

function fileSize(filePath) {
  return fs.statSync(filePath).size;
}

async function paidUnlock(page) {
  return page.evaluate(async () => {
    await window.savePendingPayment("stress_session");
    const pending = await window.loadPendingPayment("stress_session");
    window.restoreStateFromPaidDownload(pending);
    document.querySelector("#termsCheck").checked = true;
    window.enableDeliverables(true);
    return {
      rowCount: pending.rowCount,
      jsonBytes: JSON.stringify(pending).length,
      csvBytes: pending.csv.length,
      xlsxBytes: pending.xlsxBase64.length,
    };
  });
}

async function runDownloadSuite(page, filePath, label) {
  const downloadDir = path.join(ARTIFACT_DIR, `downloads-${label}`);
  fs.rmSync(downloadDir, { recursive: true, force: true });
  fs.mkdirSync(downloadDir, { recursive: true });

  await cleanFixture(page, filePath);
  const preview = await saveDownload(page, "#downloadCleanBtn", downloadDir);
  const pdf = await saveDownload(page, "#downloadReportBtn", downloadDir);
  const paid = await paidUnlock(page);
  await page.waitForFunction(() => document.querySelector("#downloadAllBtn")?.disabled === false, null, { timeout: 30000 });
  const fullCsv = await saveDownload(page, "#downloadFullCsvBtn", downloadDir);
  const workbook = await saveDownload(page, "#unlockFullBtn", downloadDir);
  const bundle = await saveDownload(page, "#downloadAllBtn", downloadDir);

  assert(fileSize(preview) > 500, "preview CSV was empty");
  assert(fileSize(pdf) > 1000, "PDF report was empty");
  assert(fileSize(fullCsv) > fileSize(preview), "full CSV was not larger than preview");
  assert(fileSize(workbook) > 1000, "Excel workbook was empty");
  assert(fileSize(bundle) > 1000, "deliverables zip was empty");

  const zipBytes = fs.readFileSync(bundle);
  assert(zipBytes.includes(Buffer.from("dataready-free-preview.csv")), "zip missing preview CSV");
  assert(zipBytes.includes(Buffer.from("client-cleaning-report.pdf")), "zip missing PDF report");
  assert(zipBytes.includes(Buffer.from("dataready-summary.txt")), "zip missing summary");

  const previewLines = fs.readFileSync(preview, "utf8").split(/\r?\n/).filter(Boolean).length;
  assert(previewLines <= 101, `preview exported too many lines: ${previewLines}`);

  return {
    paid,
    downloads: {
      preview: fileSize(preview),
      pdf: fileSize(pdf),
      fullCsv: fileSize(fullCsv),
      workbook: fileSize(workbook),
      bundle: fileSize(bundle),
    },
  };
}

async function runUnsupportedFileTest(page) {
  const pdfPath = path.join(ARTIFACT_DIR, "fake-upload.pdf");
  fs.writeFileSync(pdfPath, "%PDF-1.4\n% DataReady stress unsupported file\n");
  await page.goto(APP_URL, { waitUntil: "domcontentloaded" });
  await page.setInputFiles("#fileInput", pdfPath);
  await page.waitForFunction(() => (document.querySelector("#uploadStatus")?.textContent || "").includes("not supported"), null, { timeout: 15000 });
  return page.evaluate(() => document.querySelector("#uploadStatus")?.textContent || "");
}

async function runApiSmoke(page) {
  await page.goto(APP_URL, { waitUntil: "domcontentloaded" });
  return page.evaluate(async (appUrl) => {
    const base = new URL(appUrl);
    const read = async (response) => {
      const text = await response.text();
      try {
        return { status: response.status, body: JSON.parse(text) };
      } catch {
        return { status: response.status, body: text.slice(0, 120), json: false };
      }
    };
    const api = await fetch(new URL("/api/", base)).then(read);
    const invalidCheckout = await fetch(new URL("/api/create-checkout-session", base), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tierId: "single", rowCount: 50 }),
    }).then(read);
    const invalidVerify = await fetch(new URL("/api/verify-checkout-session?session_id=cs_bad", base)).then(read);
    return { api, invalidCheckout, invalidVerify };
  }, APP_URL);
}

async function main() {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

  const fixtures = [
    { label: "free-95", rows: 95, content: makeCsv(95, { duplicates: true, emptyRows: true }) },
    { label: "starter-526", rows: 526, content: makeCsv(553, { duplicates: true, emptyRows: true }) },
    { label: "boundary-1000", rows: 1000, content: makeCsv(1000, { duplicates: true, emptyRows: true }) },
    { label: "boundary-1001", rows: 1001, content: makeCsv(1001, { duplicates: true, emptyRows: true }) },
    { label: "work-5000", rows: 5000, content: makeCsv(5000, { duplicates: true, emptyRows: true }) },
    { label: "batch-15000", rows: 15000, content: makeCsv(15000, { duplicates: true, emptyRows: true }) },
    { label: "max-50000", rows: 50000, content: makeCsv(50000, { duplicates: true, emptyRows: true }) },
  ].map((fixture) => ({ ...fixture, path: writeFixture(`${fixture.label}.csv`, fixture.content) }));

  const tsvPath = writeFixture("tab-separated-250.tsv", makeTsv(250));
  const xlsxPath = "C:/Users/prple/OneDrive/Documents/New project/outputs/data-cleaning-samples/really-messy-client-list-practice.xlsx";

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ acceptDownloads: true, viewport: { width: 1440, height: 950 } });
  const results = [];

  for (const fixture of fixtures) {
    const result = await cleanFixture(page, fixture.path);
    results.push({
      label: fixture.label,
      sourceBytes: fs.statSync(fixture.path).size,
      cleanMs: result.cleanMs,
      ...result.state,
    });
  }

  const mobilePage = await browser.newPage({ acceptDownloads: true, viewport: { width: 390, height: 844 } });
  const mobile = await cleanFixture(mobilePage, fixtures[1].path);
  await mobilePage.close();

  const downloadSuite = await runDownloadSuite(page, fixtures[1].path, "starter-526");
  const tsv = await cleanFixture(page, tsvPath);
  const xlsx = fs.existsSync(xlsxPath) ? await cleanFixture(page, xlsxPath) : null;
  const unsupported = await runUnsupportedFileTest(page);
  const apiPage = await browser.newPage({ acceptDownloads: true, viewport: { width: 1024, height: 768 } });
  const api = await runApiSmoke(apiPage);
  await apiPage.close();

  const hugeLocalStorage = await (async () => {
    await cleanFixture(page, fixtures.find((f) => f.label === "max-50000").path);
    try {
      return { ok: true, ...(await paidUnlock(page)) };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  })();

  await browser.close();

  const report = {
    appUrl: APP_URL,
    generatedAt: new Date().toISOString(),
    results,
    mobile: { cleanMs: mobile.cleanMs, ...mobile.state },
    downloadSuite,
    tsv: { cleanMs: tsv.cleanMs, ...tsv.state },
    xlsx: xlsx ? { cleanMs: xlsx.cleanMs, ...xlsx.state } : "Skipped: sample XLSX fixture not found",
    unsupported,
    api,
    hugeLocalStorage,
    artifactDir: ARTIFACT_DIR,
  };

  fs.writeFileSync(path.join(ARTIFACT_DIR, "stress-report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

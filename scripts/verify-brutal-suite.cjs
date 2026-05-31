const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const assert = require("assert");
const JSZip = require("jszip");

const APP_URL = process.env.DATAREADY_URL || "http://127.0.0.1:4186/";
const FIXTURE_DIR = "C:/Users/prple/OneDrive/Documents/New project/outputs/data-cleaning-samples/brutal-raw";
const ARTIFACT_DIR = path.resolve(__dirname, "..", "stress-artifacts", "brutal-suite");

const cases = [
  {
    label: "realtor",
    file: "realtor-leads-brutal-raw-12000.csv",
    expectedHeaders: ["Lead Id", "Client Name", "Phone", "Email", "Street Address", "List Price"],
    mustContain: ["RL-1000001", "(505) 237-1053", "leah.garcia1@example.com", "160917.00"],
    mustNotContain: ["Field A,Field B", "Phone: (505) 237-1053 / Email"],
  },
  {
    label: "stacked-crm",
    file: "stacked-crm-notes-brutal-raw-4000.csv",
    expectedHeaders: ["Lead Id", "Client Name", "Phone", "Email", "Beds", "Raw Notes"],
    mustContain: ["LEAD-300001", "julian.romero1@example.com", "(505) 237-1053", "Gallup"],
    mustNotContain: ["Property Wanted", "https://2%20beds"],
  },
  {
    label: "dirty-sales",
    file: "dirty-sales-orders-brutal-raw-15000.csv",
    expectedHeaders: ["Order No", "Customer", "Email", "Phone", "Order Date", "Total"],
    mustContain: ["ORD-900001", "Carla Herrera", "carla.herrera1@example.com", "(505) 237-1053", "41.46"],
    mustNotContain: ["REVIEW:"],
  },
  {
    label: "mixed-ops",
    file: "mixed-operations-brutal-raw-8000.csv",
    expectedHeaders: ["Record", "Person / Business", "Contact Blob", "Money Ish", "Date Ish"],
    mustContain: ["REFUND-50001", "Leah Reed", "Leah.Reed1@example.com", "(505) 237-1053"],
    mustNotContain: ["REVIEW:"],
  },
  {
    label: "donor-tsv",
    file: "donor-gifts-brutal-raw-5000.tsv",
    expectedHeaders: ["Donor", "Gift Info", "Contact", "Address", "Campaign / Source"],
    mustContain: ["Leah Baca", "Leah.Baca1@example.com", "(505) 237-1053", "Spring Appeal"],
    mustNotContain: ["REVIEW:"],
  },
  {
    label: "multi-tab-xlsx",
    file: "multi-tab-brutal-raw-workbook-3000.xlsx",
    expectedHeaders: ["Lead Id", "Client Name", "Phone", "Email", "Street Address", "List Price"],
    mustContain: ["RL-1000001", "(505) 237-1053", "leah.garcia1@example.com", "160917.00"],
    mustNotContain: ["Instructions", "old,data"],
  },
];

function normalize(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function csvLines(text) {
  return text.split(/\r?\n/).filter((line) => line.trim());
}

async function saveDownload(page, selector, dir) {
  const wait = page.waitForEvent("download", { timeout: 90000 });
  await page.click(selector);
  const download = await wait;
  const outPath = path.join(dir, await download.suggestedFilename());
  await download.saveAs(outPath);
  return outPath;
}

async function inspectWorkbook(xlsxPath) {
  const zip = await JSZip.loadAsync(fs.readFileSync(xlsxPath));
  const workbookXml = await zip.file("xl/workbook.xml").async("text");
  const sheetXml = await zip.file("xl/worksheets/sheet1.xml").async("text");
  return { workbookXml, sheetXml };
}

async function runCase(page, item) {
  const filePath = path.join(FIXTURE_DIR, item.file);
  const caseDir = path.join(ARTIFACT_DIR, item.label);
  fs.rmSync(caseDir, { recursive: true, force: true });
  fs.mkdirSync(caseDir, { recursive: true });

  await page.goto(APP_URL, { waitUntil: "domcontentloaded" });
  await page.setInputFiles("#fileInput", filePath);
  await page.waitForSelector("#cleanBtn:not([disabled])", { timeout: 60000 });
  await page.click("#cleanBtn");
  await page.waitForFunction(() => (document.querySelector("#summaryBox")?.textContent || "").includes("Total cleaned rows:"), null, { timeout: 120000 });
  await page.check("#termsCheck");

  const state = await page.evaluate(() => ({
    headers: [...document.querySelectorAll("#previewTable thead th")].map((th) => th.textContent.trim()),
    previewText: document.querySelector("#previewTable")?.textContent || "",
    summary: document.querySelector("#summaryBox")?.textContent || "",
    rowMetric: document.querySelector("#rowMetric")?.textContent || "",
    bodyOverflow: document.documentElement.scrollWidth > window.innerWidth + 2,
    previewRows: document.querySelectorAll("#previewTable tbody tr").length,
  }));

  const previewCsvPath = await saveDownload(page, "#downloadCleanBtn", caseDir);
  const pdfPath = await saveDownload(page, "#downloadReportBtn", caseDir);
  const previewCsv = fs.readFileSync(previewCsvPath, "utf8");
  const combined = `${state.headers.join(",")}\n${state.previewText}\n${previewCsv}`;

  const missingHeaders = item.expectedHeaders.filter((header) => !state.headers.some((actual) => normalize(actual) === normalize(header)));
  const missingValues = item.mustContain.filter((value) => !combined.includes(value));
  const leakedValues = item.mustNotContain.filter((value) => combined.toLowerCase().includes(String(value).toLowerCase()));

  assert(!state.bodyOverflow, `${item.label} caused page-level horizontal overflow`);
  assert(state.previewRows <= 100, `${item.label} rendered too many preview rows`);
  assert(!missingHeaders.length, `${item.label} missing headers: ${missingHeaders.join(", ")}`);
  assert(!missingValues.length, `${item.label} missing values: ${missingValues.join(", ")}`);
  assert(!leakedValues.length, `${item.label} leaked values: ${leakedValues.join(", ")}`);
  assert(csvLines(previewCsv).length <= 101, `${item.label} free preview exported more than 100 rows`);
  assert(fs.statSync(previewCsvPath).size > 300, `${item.label} preview CSV is too small`);
  assert(fs.statSync(pdfPath).size > 1000, `${item.label} PDF is too small`);

  if (item.label === "realtor") {
    await page.evaluate(async () => {
      await window.savePendingPayment("brutal-suite");
      const pending = await window.loadPendingPayment("brutal-suite");
      window.restoreStateFromPaidDownload(pending);
      document.querySelector("#termsCheck").checked = true;
      window.enableDeliverables(true);
    });
    const fullCsvPath = await saveDownload(page, "#downloadFullCsvBtn", caseDir);
    const workbookPath = await saveDownload(page, "#unlockFullBtn", caseDir);
    const zipPath = await saveDownload(page, "#downloadAllBtn", caseDir);
    const fullCsv = fs.readFileSync(fullCsvPath, "utf8");
    const zip = await JSZip.loadAsync(fs.readFileSync(zipPath));
    const workbook = await inspectWorkbook(workbookPath);
    assert(fullCsv.includes("RL-1011999"), "paid full realtor CSV did not include the final lead");
    assert(workbook.workbookXml.includes('name="Clean Data"') && workbook.workbookXml.includes('name="Original Data"'), "workbook missing expected sheets");
    assert(workbook.sheetXml.includes("RL-1000001"), "workbook Clean Data sheet missing lead ID");
    assert(zip.file("dataready-free-preview.csv"), "zip missing free preview");
    assert(zip.file("client-cleaning-report.pdf"), "zip missing PDF report");
    assert([...Object.keys(zip.files)].some((name) => name.endsWith("-full.csv")), "zip missing full CSV");
  }

  return {
    label: item.label,
    file: item.file,
    rows: state.rowMetric,
    headers: state.headers,
    previewBytes: fs.statSync(previewCsvPath).size,
    pdfBytes: fs.statSync(pdfPath).size,
  };
}

(async () => {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const results = [];
  for (const item of cases) {
    results.push(await runCase(page, item));
  }
  await browser.close();
  const reportPath = path.join(ARTIFACT_DIR, `brutal-suite-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(reportPath, JSON.stringify({ appUrl: APP_URL, results }, null, 2), "utf8");
  console.log(JSON.stringify({ reportPath, cases: results.length, results }, null, 2));
})();

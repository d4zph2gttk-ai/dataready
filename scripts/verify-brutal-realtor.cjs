const { chromium } = require("playwright");
const fs = require("fs");

const url = process.env.DATAREADY_URL || "http://127.0.0.1:4186/";
const filePath =
  process.env.BRUTAL_REALTOR_FILE ||
  "C:/Users/prple/OneDrive/Documents/New project/outputs/data-cleaning-samples/brutal-raw/realtor-leads-brutal-raw-12000.csv";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.setInputFiles("#fileInput", filePath);
  await page.waitForFunction(() => document.querySelector("#cleanBtn") && !document.querySelector("#cleanBtn").disabled, null, { timeout: 60000 });
  await page.click("#cleanBtn");
  await page.waitForFunction(() => document.querySelectorAll("#previewTable tbody tr").length > 0, null, { timeout: 60000 });

  const result = await page.evaluate(() => {
    const headers = [...document.querySelectorAll("#previewTable thead th")].map((th) => th.textContent.trim());
    const rows = [...document.querySelectorAll("#previewTable tbody tr")]
      .slice(0, 10)
      .map((tr) => [...tr.querySelectorAll("td")].map((td) => td.textContent.trim()));
    const summary = document.querySelector("#summaryBox")?.innerText || "";
    return { headers, rows, summary };
  });

  await page.check("#termsCheck");
  const download = await Promise.all([
    page.waitForEvent("download"),
    page.click("#downloadCleanBtn"),
  ]).then(([downloadEvent]) => downloadEvent);
  const downloadPath = await download.path();
  const downloadedCsv = fs.readFileSync(downloadPath, "utf8");
  await browser.close();

  const requiredHeaders = ["Lead Id", "Client Name", "Phone", "Email", "Street Address", "Beds", "List Price", "Raw Notes"];
  const missingHeaders = requiredHeaders.filter((header) => !result.headers.includes(header));
  const firstRegularLead = result.rows.find((row) => row[0] === "RL-1000001");
  const hasContact = firstRegularLead?.includes("(505) 237-1053") && firstRegularLead?.includes("leah.garcia1@example.com");
  const hasPrice = firstRegularLead?.some((cell) => cell === "160917.00");
  const downloadedHeader = downloadedCsv.split(/\r?\n/)[0] || "";
  const downloadedHasStructuredHeader = downloadedHeader.includes("Lead Id,Client Name,Phone,Email,Street Address");
  const downloadedHasContact = downloadedCsv.includes("(505) 237-1053") && downloadedCsv.includes("leah.garcia1@example.com");
  const downloadedHasPrice = downloadedCsv.includes("160917.00");

  if (missingHeaders.length || !hasContact || !hasPrice || !downloadedHasStructuredHeader || !downloadedHasContact || !downloadedHasPrice) {
    console.error(JSON.stringify({ missingHeaders, firstRegularLead, downloadedHeader, downloadedHasContact, downloadedHasPrice, result }, null, 2));
    throw new Error("Brutal realtor cleanup is still losing core contact or price information.");
  }

  console.log(JSON.stringify({ firstRegularLead, downloadedHeader, result: { headers: result.headers, summary: result.summary } }, null, 2));
})();

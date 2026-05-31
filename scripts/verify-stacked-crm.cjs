const { chromium } = require("playwright");

const url = process.env.DATAREADY_URL || "http://127.0.0.1:4186/";
const filePath =
  process.env.STACKED_CRM_FILE ||
  "C:/Users/prple/OneDrive/Documents/New project/outputs/data-cleaning-samples/brutal-raw/stacked-crm-notes-brutal-raw-4000.csv";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const consoleMessages = [];
  page.on("console", (message) => consoleMessages.push(`${message.type()}: ${message.text()}`));
  page.on("pageerror", (error) => consoleMessages.push(`pageerror: ${error.message}`));
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.setInputFiles("#fileInput", filePath);
  await page.waitForFunction(() => document.querySelector("#cleanBtn") && !document.querySelector("#cleanBtn").disabled, null, { timeout: 60000 });
  await page.click("#cleanBtn");
  await page.waitForFunction(() => document.querySelectorAll("#previewTable tbody tr").length > 0, null, { timeout: 60000 });

  const result = await page.evaluate(() => {
    const headers = [...document.querySelectorAll("#previewTable thead th")].map((th) => th.textContent.trim());
    const rows = [...document.querySelectorAll("#previewTable tbody tr")]
      .slice(0, 12)
      .map((tr) => [...tr.querySelectorAll("td")].map((td) => td.textContent.trim()));
    const summary = document.querySelector("#summaryBox")?.innerText || "";
    const uploadStatus = document.querySelector("#uploadStatus")?.textContent || "";
    const analysis = document.querySelector("#analysisText")?.textContent || "";
    return { headers, rows, summary, uploadStatus, analysis };
  });

  await browser.close();

  const firstIds = result.rows.map((row) => row[0]);
  const hasContinuationAsRow = firstIds.some((id) => /property wanted|last note/i.test(id));
  const hasStructuredHeaders =
    (result.headers.includes("Lead ID") || result.headers.includes("Lead Id")) &&
    result.headers.includes("Client Name") &&
    result.headers.includes("Phone") &&
    result.headers.includes("Beds") &&
    result.headers.includes("Raw Notes");

  if (hasContinuationAsRow || !hasStructuredHeaders) {
    console.error(JSON.stringify({ result, consoleMessages }, null, 2));
    throw new Error("Stacked CRM cleanup did not produce structured lead rows.");
  }

  console.log(JSON.stringify({ result, consoleMessages }, null, 2));
})();

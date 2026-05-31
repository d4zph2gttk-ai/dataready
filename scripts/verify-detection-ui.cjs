const { chromium } = require("playwright");

const url = process.env.DATAREADY_URL || "http://127.0.0.1:4186/";
const filePath =
  process.env.BRUTAL_REALTOR_FILE ||
  "C:/Users/prple/OneDrive/Documents/New project/outputs/data-cleaning-samples/brutal-raw/realtor-leads-brutal-raw-12000.csv";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.setInputFiles("#fileInput", filePath);
  await page.waitForFunction(() => document.querySelector("#columnMapSummary")?.innerText.includes("Loose realtor lead export"), null, { timeout: 60000 });
  const result = await page.evaluate(() => ({
    summary: document.querySelector("#columnMapSummary")?.innerText || "",
    advancedOpen: document.querySelector(".advanced-detection")?.open || false,
    visibleCards: document.querySelectorAll("#columnMapSummary .detection-card").length,
    advancedCards: document.querySelectorAll("#columnMapGrid .column-map-card").length,
  }));
  await browser.close();
  if (result.advancedOpen || result.visibleCards !== 3 || result.advancedCards < 1) {
    console.error(JSON.stringify(result, null, 2));
    throw new Error("Detection UI did not render as a collapsed summary.");
  }
  console.log(JSON.stringify(result, null, 2));
})();

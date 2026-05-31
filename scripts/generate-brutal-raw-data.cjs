const fs = require("fs");
const path = require("path");
const JSZip = require("jszip");

const outputDir = "C:/Users/prple/OneDrive/Documents/New project/outputs/data-cleaning-samples/brutal-raw";

const first = ["Ana", "Nora", "Marcus", "Sofia", "Julian", "Leah", "Ramon", "Priya", "Devon", "Marta", "Isaac", "Elena", "Jose", "Carla"];
const last = ["Garcia", "Lopez", "Reed", "Singh", "Chavez", "Romero", "Vigil", "Baca", "Ortega", "Nguyen", "Montoya", "Herrera", "O'Connor"];
const streets = ["Bridge Blvd", "Paseo Del Norte", "Main St", "Mesa Verde Ln", "Adobe Vista Dr", "Central Ave", "Canyon Rd", "Copper Ave", "Camino Real", "Airport Rd"];
const cities = ["Albuquerque", "Santa Fe", "Rio Rancho", "Las Cruces", "Taos", "Farmington", "Roswell", "Clovis", "Gallup", "Los Lunas", "Truth or Consequences"];

function ensureDir() {
  fs.mkdirSync(outputDir, { recursive: true });
}

function pick(list, i, salt = 0) {
  return list[(i * 19 + salt * 11) % list.length];
}

function messyPhone(i) {
  const mid = String(200 + ((i * 37) % 760)).padStart(3, "0");
  const end = String(1000 + ((i * 53) % 9000)).padStart(4, "0");
  if (i % 53 === 0) return "ask spouse";
  if (i % 41 === 0) return "";
  if (i % 17 === 0) return `phone? 505.${mid}.${end}`;
  if (i % 11 === 0) return `+1 (505) ${mid}-${end} ext ${i % 90}`;
  if (i % 7 === 0) return `505${mid}${end}`;
  return `(505) ${mid}-${end}`;
}

function messyEmail(i, fn, ln) {
  if (i % 61 === 0) return "no email";
  if (i % 43 === 0) return `${fn}.${ln}${i} at example dot com`;
  if (i % 29 === 0) return `${fn}_${ln}${i}@example.con`;
  if (i % 13 === 0) return `${fn}.${ln}${i}@EXAMPLE.COM ; alt ${fn}${i}@gmail.com`;
  return `${fn}.${ln}${i}@example.com`;
}

function messyDate(i, offset = 0) {
  if (i % 71 === 0) return "sometime next month";
  if (i % 47 === 0) return "";
  const month = ((i + offset) % 12) + 1;
  const day = ((i * 5 + offset) % 28) + 1;
  const year = 2024 + ((i + offset) % 4);
  if (i % 19 === 0) return `${month}.${day}.${String(year).slice(2)}`;
  if (i % 9 === 0) return `${month}/${day}/${String(year).slice(2)}`;
  if (i % 8 === 0) return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return `${month}/${day}/${year}`;
}

function money(value, i) {
  if (i % 67 === 0) return "need estimate";
  if (i % 37 === 0) return "";
  if (i % 15 === 0) return `about $${Math.round(value).toLocaleString("en-US")}`;
  if (i % 12 === 0) return `$ ${Math.round(value).toLocaleString("en-US")}??`;
  return `$${value.toFixed(2)}`;
}

function csvEscape(value, delimiter = ",") {
  const text = String(value ?? "");
  const needsQuotes = text.includes(delimiter) || /[",\n\r]/.test(text);
  return needsQuotes ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeDelimited(fileName, rows, delimiter = ",") {
  ensureDir();
  const filePath = path.join(outputDir, fileName);
  fs.writeFileSync(filePath, rows.map((row) => row.map((value) => csvEscape(value, delimiter)).join(delimiter)).join("\r\n"), "utf8");
  return filePath;
}

function xmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function columnName(index) {
  let name = "";
  while (index > 0) {
    const mod = (index - 1) % 26;
    name = String.fromCharCode(65 + mod) + name;
    index = Math.floor((index - mod) / 26);
  }
  return name;
}

function worksheetXml(rows) {
  const sheetRows = rows.map((row, rowIndex) => {
    const cells = row.map((value, columnIndex) => {
      const ref = `${columnName(columnIndex + 1)}${rowIndex + 1}`;
      return `<c r="${ref}" t="inlineStr"><is><t>${xmlEscape(value)}</t></is></c>`;
    }).join("");
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`;
}

async function writeXlsx(fileName, sheets) {
  ensureDir();
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`);
  zip.folder("_rels").file(".rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  zip.folder("xl").file("workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((sheet, index) => `<sheet name="${xmlEscape(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("")}</sheets></workbook>`);
  zip.folder("xl").folder("_rels").file("workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("")}</Relationships>`);
  sheets.forEach((sheet, index) => zip.folder("xl").folder("worksheets").file(`sheet${index + 1}.xml`, worksheetXml(sheet.rows)));
  const filePath = path.join(outputDir, fileName);
  fs.writeFileSync(filePath, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
  return filePath;
}

function realtorChaosRows(count) {
  const headers = ["Field A", "Field B", "Field C", "Field D", "Field E", "Field F", "Field G", "Field H", "Field I", "Field J", "Field K", "Field L", "Field M", "Field N"];
  const rows = [
    ["RAW REALTOR LEAD DUMP - multiple source tabs pasted together"],
    ["source: facebook ads / open houses / old CRM / phone logs"],
    headers,
  ];
  for (let i = 0; i < count; i += 1) {
    if (i && i % 97 === 0) rows.push(["--- ABQ NORTH BATCH ---", "", "", "", "", "", "", "", "", "", "", "", "", ""]);
    if (i && i % 173 === 0) rows.push(headers);
    const fn = pick(first, i);
    const ln = pick(last, i, 3);
    const city = pick(cities, i);
    const street = `${100 + i} ${pick(streets, i)}${i % 9 === 0 ? ` Unit ${i % 50}` : ""}`;
    const price = 160000 + ((i * 917) % 720000);
    const contact = `Phone: ${messyPhone(i)} / Email: ${messyEmail(i, fn, ln)}`;
    const property = `Beds ${1 + (i % 6)} Baths ${1 + (i % 4)} SqFt ${700 + ((i * 41) % 4200)} ${i % 12 === 0 ? "pool?" : ""}`;
    const dates = `Dates: last ${messyDate(i)} next ${messyDate(i, 9)} showing ${messyDate(i, 15)}`;
    const row = [
      i % 31 === 0 ? `REVIEW:${i}` : `RL-${1000000 + i}`,
      `${fn} ${ln}${i % 23 === 0 ? ` / spouse ${pick(first, i, 5)}` : ""}`,
      contact,
      `${street}, ${city} ${i % 27 === 0 ? "N.M." : "NM"} ${87000 + (i % 999)}`,
      property,
      `Price ${money(price, i)} Est ${money(price * 1.08, i + 5)} Mortgage ${money(price * 0.61, i + 8)}`,
      dates,
      pick(["Buy", "Sell", "Buy/Sell", "Rent First", "Invest", "Not Sure", ""], i),
      pick(["Pat Morgan", "Jamie Torres", "Unassigned", "Casey Rivera", "Taylor Kim"], i),
      i % 10 === 0 ? "vip; investor; spanish" : "",
      i % 14 === 0 ? "duplicate maybe" : "",
      i % 16 === 0 ? "CALL AFTER 5PM, says Zillow value is wrong" : "",
      i % 20 === 0 ? "old import id " + (2000 + i) : "",
      i % 25 === 0 ? "row copied from notes app" : "",
    ];
    if (i % 37 === 0) row.splice(2, 0, "EXTRA SHIFTED CELL");
    if (i % 44 === 0) row[3] = `${street} ${city} ${87000 + (i % 999)} no commas`;
    rows.push(row);
  }
  rows.push(["TOTAL RECORDS", count, "", "", "", "", "", "", "", "", "", "", "", ""]);
  return rows;
}

function mixedOpsRows(count) {
  const headers = ["Record", "Person / Business", "Contact blob", "Thing purchased or requested", "Money-ish", "Date-ish", "Status-ish", "Owner-ish", "Location-ish", "Loose Notes", "", "Import Flag"];
  const rows = [
    ["Mixed business export from 4 tools"],
    ["Invoice rows, appointment rows, and customer rows are mixed together"],
    headers,
  ];
  for (let i = 0; i < count; i += 1) {
    if (i && i % 121 === 0) rows.push(["PAGE " + Math.ceil(i / 121), "", "", "", "", "", "", "", "", "", "", ""]);
    if (i && i % 205 === 0) rows.push(headers);
    const fn = pick(first, i);
    const ln = pick(last, i, 2);
    const kind = pick(["INV", "APPT", "CUST", "TASK", "REFUND"], i);
    rows.push([
      `${kind}-${50000 + i}`,
      i % 33 === 0 ? `${pick(["Mesa Plumbing", "Rio HVAC", "North Shop"], i)} attn ${fn}` : `${fn} ${ln}`,
      `email ${messyEmail(i, fn, ln)} phone ${messyPhone(i)}`,
      pick(["repair call", "new install", "monthly service", "refund request", "estimate", "follow-up"], i),
      money(45 + ((i * 71) % 9900), i),
      messyDate(i, 4),
      pick(["open", "paid", "waiting", "cancelled", "urgent", "needs human review"], i),
      pick(["front desk", "manager", "Pat", "unassigned", "night shift"], i),
      `${pick(cities, i)} / ${87000 + (i % 999)}`,
      i % 19 === 0 ? "copied from email thread; do not trust all fields" : "",
      "",
      i % 41 === 0 ? "bad row maybe" : "",
    ]);
  }
  return rows;
}

function donationChaosRows(count) {
  const headers = ["Donor", "Gift Info", "Contact", "Address", "Campaign / Source", "Soft Credit", "Thank You?", "Restrictions", "Internal Notes"];
  const rows = [
    ["Development office export - very raw"],
    ["Do not mail until reviewed"],
    headers,
  ];
  for (let i = 0; i < count; i += 1) {
    const fn = pick(first, i);
    const ln = pick(last, i, 6);
    rows.push([
      `${fn} ${ln}${i % 40 === 0 ? " (household)" : ""}`,
      `Gift ${money(10 + ((i * 29) % 20000), i)} on ${messyDate(i)} pledge ${i % 8 === 0 ? money(100 + i * 3, i + 2) : "none"}`,
      `${messyEmail(i, fn, ln)} | ${messyPhone(i)}`,
      `${1000 + i} ${pick(streets, i)}, ${pick(cities, i)} NM ${87000 + (i % 999)}`,
      pick(["Gala", "Spring Appeal", "Online", "Board Ask", "Major Gift", "Facebook"], i),
      i % 7 === 0 ? `${pick(first, i, 4)} ${pick(last, i, 5)}` : "",
      pick(["yes", "no", "pending", "mail returned", ""], i, 2),
      i % 11 === 0 ? "restricted to youth program" : "",
      i % 18 === 0 ? "check scan had handwriting in memo line" : "",
    ]);
  }
  return rows;
}

function dirtySalesRows(count) {
  const products = ["Monthly plan", "Setup fee", "Cleaning kit", "Rush service", "Data import", "Consult call", "Refund", "Discount"];
  const headers = ["Order No", "Customer", "Email", "Phone", "Order Date", "Ship Date", "Product", "Qty", "Unit Price", "Tax", "Total", "Payment", "Fulfillment", "Address", "Notes"];
  const rows = [
    ["Export created by shop system", "", "", "", "currency mixed with text", "", "", "", "", "", "", "", "", "", ""],
    ["Rows below contain duplicates, invalid totals, bad dates, and comment rows"],
    headers,
  ];
  for (let i = 0; i < count; i += 1) {
    if (i && i % 88 === 0) rows.push(["SUBTOTAL", "", "", "", "", "", "", "", "", "", money(1000 + i * 7, i), "", "", "", "not a real order"]);
    if (i && i % 311 === 0) rows.push(headers);
    const fn = pick(first, i, 2);
    const ln = pick(last, i, 4);
    const qty = i % 46 === 0 ? "two" : 1 + (i % 9);
    const unit = 7 + ((i * 13) % 440);
    const tax = unit * 0.073;
    const total = unit * (Number.isFinite(Number(qty)) ? Number(qty) : 2) + tax;
    const row = [
      i % 59 === 0 ? `DUP-${9000 + Math.floor(i / 2)}` : `ORD-${900000 + i}`,
      i % 17 === 0 ? `${ln}, ${fn}` : `${fn} ${ln}`,
      messyEmail(i, fn, ln),
      messyPhone(i),
      messyDate(i),
      i % 27 === 0 ? "not shipped" : messyDate(i, 6),
      pick(products, i),
      qty,
      money(unit, i),
      i % 31 === 0 ? "included?" : money(tax, i + 1),
      i % 23 === 0 ? `total maybe ${Math.round(total)}` : money(total, i + 2),
      pick(["paid", "failed", "cash", "stripe", "check", "partial", "refunded"], i),
      pick(["fulfilled", "pending", "pickup", "returned", "address issue"], i),
      `${100 + i} ${pick(streets, i)}, ${pick(cities, i)} ${i % 9 === 0 ? "New Mexico" : "NM"} ${87000 + (i % 999)}`,
      i % 21 === 0 ? "customer wrote note in payment field; verify manually" : "",
    ];
    if (i % 73 === 0) row[14] = "multi-line note: first line\nsecond line says refund requested";
    if (i % 64 === 0) row.splice(6, 0, "EXTRA PRODUCT CELL");
    rows.push(row);
  }
  return rows;
}

function stackedCrmRows(count) {
  const rows = [
    ["Loose CRM notes export"],
    ["Each lead may use 1 to 4 rows. Humans can read it; software has to work harder."],
    ["Record", "Field 1", "Field 2", "Field 3", "Field 4", "Field 5", "Field 6"],
  ];
  for (let i = 0; i < count; i += 1) {
    const fn = pick(first, i, 5);
    const ln = pick(last, i, 7);
    const id = `LEAD ${300000 + i}`;
    rows.push([
      id,
      `name=${fn} ${ln}`,
      `source:${pick(["website", "phone", "open house", "facebook", "referral", "old import"], i)}`,
      `stage ${pick(["new", "hot", "cold", "lost", "needs review"], i)}`,
      i % 12 === 0 ? "missing contact below" : `phone ${messyPhone(i)}`,
      `email ${messyEmail(i, fn, ln)}`,
      "",
    ]);
    if (i % 3 !== 0) {
      rows.push([
        "",
        "property wanted",
        `${1 + (i % 5)} beds`,
        `${1 + (i % 4)} baths`,
        `${pick(cities, i)} / ${87000 + (i % 999)}`,
        `budget ${money(180000 + i * 41, i)}`,
        i % 20 === 0 ? "cash buyer maybe" : "",
      ]);
    }
    if (i % 5 === 0) {
      rows.push(["", "last note", `called ${messyDate(i)}`, "said spouse has another email", `assigned ${pick(["Pat", "Jamie", "Unassigned"], i)}`, "", ""]);
    }
    if (i && i % 250 === 0) rows.push(["*** copied from another export below ***", "", "", "", "", "", ""]);
  }
  return rows;
}

(async () => {
  ensureDir();
  const files = [];
  files.push(writeDelimited("realtor-leads-brutal-raw-12000.csv", realtorChaosRows(12000)));
  files.push(writeDelimited("mixed-operations-brutal-raw-8000.csv", mixedOpsRows(8000)));
  files.push(writeDelimited("donor-gifts-brutal-raw-5000.tsv", donationChaosRows(5000), "\t"));
  files.push(writeDelimited("dirty-sales-orders-brutal-raw-15000.csv", dirtySalesRows(15000)));
  files.push(writeDelimited("stacked-crm-notes-brutal-raw-4000.csv", stackedCrmRows(4000)));
  files.push(await writeXlsx("multi-tab-brutal-raw-workbook-3000.xlsx", [
    { name: "Read Me", rows: [["Instructions"], ["This workbook intentionally starts with junk"], ["Useful data is on Raw Dump"]] },
    { name: "Old Export", rows: [["old", "data"], ["do", "not", "use"]] },
    { name: "Raw Dump", rows: realtorChaosRows(3000) },
  ]));

  const summary = files.map((filePath) => ({
    name: path.basename(filePath),
    path: filePath,
    bytes: fs.statSync(filePath).size,
  }));
  fs.writeFileSync(path.join(outputDir, "README.txt"), [
    "Brutal raw DataReady test files",
    "These are intentionally worse than normal QA samples.",
    "Expect scattered fields, repeated headers, note rows, shifted cells, bad emails, bad phones, weird money, and mixed source exports.",
    "",
    ...summary.map((item) => `${item.name} - ${item.bytes.toLocaleString()} bytes`),
  ].join("\r\n"), "utf8");
  console.log(JSON.stringify({ outputDir, files: summary }, null, 2));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

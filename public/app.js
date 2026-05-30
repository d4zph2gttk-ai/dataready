const state = {
  fileName: "",
  headers: [],
  rawRows: [],
  cleanHeaders: [],
  cleanRows: [],
  removedDuplicates: 0,
  removedEmptyRows: 0,
  removedStructureRows: 0,
  issues: [],
  profiles: [],
  reviewNotes: [],
  changeLog: [],
  activeView: "table",
  paidDownload: null,
};

const FREE_ROW_LIMIT = 100;
const PRICING_TIERS = [
  { id: "preview", label: "Preview", min: 0, max: 100, price: 0, cents: 0 },
  { id: "single", label: "Starter File", min: 101, max: 1000, price: 5, cents: 500 },
  { id: "large", label: "Work File", min: 1001, max: 10000, price: 12, cents: 1200 },
  { id: "batch", label: "Batch File", min: 10001, max: 50000, price: 19, cents: 1900 },
];

const FILE_RULES = {
  csv: "Allowed. Best for clean exports and most customer lists.",
  tsv: "Allowed. Good for tab-separated exports from spreadsheets and databases.",
  txt: "Allowed if the text has rows and columns separated by commas, tabs, or pipes.",
  xlsx: "Allowed. The first usable worksheet will be cleaned.",
  pdf: "Not supported yet. Export the table as CSV or XLSX first.",
  xls: "Not supported yet. Save the workbook as .xlsx or CSV first.",
};

const PENDING_PAYMENT_KEY = "dataready_pending_checkout";
const PENDING_PAYMENT_SESSION_KEY = "dataready_pending_checkout_session";
const PENDING_PAYMENT_DB = "dataready_paid_downloads";
const PENDING_PAYMENT_STORE = "pending_downloads";

const sampleCsv = `Full Name, Email Address, Phone, Signup Date, City, Amount, Notes
 ana   lopez , ANA.LOPEZ@Example.COM , (505) 222-1199, 1/5/26, Albuquerque, $120.00, first order
Ana Lopez, ana.lopez@example.com, 5052221199, 2026-01-05, Albuquerque, 120, duplicate
MARCUS reed, marcus.reed@EXAMPLE.com, 505.333.4411, 02-14-2026, santa fe, $84.50, 
Tina Yazzie, tina.yazzie example.com, 5054448123, 3/2/2026, Gallup, thirty, bad email and amount
 , , , , , , 
Joseph Martinez, joseph.martinez@example.com, +1 505 888 9012, March 9 2026, Las Cruces, $199.99, rush client
Leah Chavez, leah.chavez@example.com, 5057770000, 13/40/2026, Roswell, $60.00, bad date`;

const els = {
  fileInput: document.querySelector("#fileInput"),
  fileBadge: document.querySelector("#fileBadge"),
  uploadStatus: document.querySelector("#uploadStatus"),
  dropZone: document.querySelector("#dropZone"),
  pasteInput: document.querySelector("#pasteInput"),
  parsePasteBtn: document.querySelector("#parsePasteBtn"),
  loadSampleBtn: document.querySelector("#loadSampleBtn"),
  resetBtn: document.querySelector("#resetBtn"),
  cleanBtn: document.querySelector("#cleanBtn"),
  rowMetric: document.querySelector("#rowMetric"),
  columnMetric: document.querySelector("#columnMetric"),
  issueMetric: document.querySelector("#issueMetric"),
  scoreMetric: document.querySelector("#scoreMetric"),
  emptyState: document.querySelector("#emptyState"),
  tableView: document.querySelector("#tableView"),
  changesView: document.querySelector("#changesView"),
  issuesView: document.querySelector("#issuesView"),
  profileView: document.querySelector("#profileView"),
  previewTable: document.querySelector("#previewTable"),
  changesTable: document.querySelector("#changesTable"),
  issuesList: document.querySelector("#issuesList"),
  profileGrid: document.querySelector("#profileGrid"),
  downloadCleanBtn: document.querySelector("#downloadCleanBtn"),
  downloadReportBtn: document.querySelector("#downloadReportBtn"),
  copySummaryBtn: document.querySelector("#copySummaryBtn"),
  downloadFullCsvBtn: document.querySelector("#downloadFullCsvBtn"),
  downloadAllBtn: document.querySelector("#downloadAllBtn"),
  unlockFullBtn: document.querySelector("#unlockFullBtn"),
  fullFilePrice: document.querySelector("#fullFilePrice"),
  fullFileStatus: document.querySelector("#fullFileStatus"),
  fileRulesList: document.querySelector("#fileRulesList"),
  termsCheck: document.querySelector("#termsCheck"),
  analysisTitle: document.querySelector("#analysisTitle"),
  analysisText: document.querySelector("#analysisText"),
  emailHealth: document.querySelector("#emailHealth"),
  phoneHealth: document.querySelector("#phoneHealth"),
  dateHealth: document.querySelector("#dateHealth"),
  emptyHealth: document.querySelector("#emptyHealth"),
  duplicateHealth: document.querySelector("#duplicateHealth"),
  amountHealth: document.querySelector("#amountHealth"),
  summaryBox: document.querySelector("#summaryBox"),
};

const ruleIds = [
  "trimCells",
  "normalizeHeaders",
  "removeEmptyRows",
  "removeDuplicates",
  "formatPhones",
  "formatEmails",
  "formatDates",
  "formatNames",
];

function getRules() {
  return Object.fromEntries(ruleIds.map((id) => [id, document.querySelector(`#${id}`).checked]));
}

function fileExtension(fileName = "") {
  return fileName.toLowerCase().split(".").pop() || "";
}

function isSupportedFile(fileName = "") {
  return ["csv", "tsv", "txt", "xlsx"].includes(fileExtension(fileName));
}

function pricingTier(rowCount) {
  const rows = Number(rowCount) || 0;
  return PRICING_TIERS.find((tier) => rows >= tier.min && rows <= tier.max) || {
    id: "enterprise",
    label: "Large File Review",
    min: 50001,
    max: Infinity,
    price: null,
    cents: null,
    contactOnly: true,
  };
}

function renderFileRules(fileName = state.fileName) {
  if (!els.fileRulesList) return;
  const extension = fileExtension(fileName);
  const ruleText = FILE_RULES[extension] || "Upload CSV, TSV, TXT, or XLSX files. PDF and old .xls files are not supported yet.";
  els.fileRulesList.innerHTML = [
    `<li>${ruleText}</li>`,
    `<li>Free downloads include the first ${FREE_ROW_LIMIT} cleaned rows.</li>`,
    "<li>Paid tiers are based on cleaned row count, not file type.</li>",
  ].join("");
}

function parseDelimited(text) {
  const delimiter = detectDelimiter(text);
  const rows = [];
  let current = "";
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      row.push(current);
      current = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(current);
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
      current = "";
    } else {
      current += char;
    }
  }

  row.push(current);
  if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  if (!rows.length) return { headers: [], rows: [] };

  return tableFromRows(rows);
}

function tableFromRows(rows) {
  const nonEmptyRows = rows.filter((row) => row.some((cell) => String(cell).trim() !== ""));
  if (!nonEmptyRows.length) return { headers: [], rows: [] };

  const headerIndex = findLikelyHeaderRow(nonEmptyRows);
  const tableRows = nonEmptyRows.slice(headerIndex);
  const width = Math.max(...tableRows.map((items) => items.length));
  const headers = tableRows[0].map((header, index) => String(header ?? "").trim() || `Column ${index + 1}`);
  while (headers.length < width) headers.push(`Column ${headers.length + 1}`);

  const dataRows = tableRows.slice(1).map((items) => {
    const padded = [...items];
    while (padded.length < width) padded.push("");
    return padded.slice(0, width);
  });

  return { headers, rows: dataRows };
}

function findLikelyHeaderRow(rows) {
  let bestIndex = 0;
  let bestScore = -Infinity;
  rows.slice(0, 80).forEach((row, index) => {
    const score = headerScore(row);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });
  return bestIndex;
}

function headerScore(row) {
  const cells = row.map((cell) => String(cell ?? "").trim()).filter(Boolean);
  if (!cells.length) return -100;
  const normalized = cells.map((cell) => normalizeHeaderToken(cell));
  if (isGenericFieldHeaderRow(normalized)) return 85;
  const uniqueCount = new Set(normalized).size;
  const knownCount = normalized.filter(isKnownHeaderToken).length;
  const genericCount = normalized.filter((cell) => /^field [a-z]$|^column \d+$/.test(cell)).length;
  const longNoteCount = normalized.filter((cell) => cell.length > 45 || /export|generated|subtotal|section|note only|do not import/.test(cell)).length;
  const dataLikeCount = normalized.filter((cell) => /^rl-\d+/.test(cell) || /^re-\d+/.test(cell) || /^c-\d+/.test(cell) || /phone:|email:|price |dates:|beds /.test(cell)).length;
  return (knownCount * 8) + uniqueCount + Math.min(cells.length, 50) - (genericCount * 3) - (longNoteCount * 12) - (dataLikeCount * 20);
}

function normalizeHeaderToken(value) {
  return String(value ?? "").trim().toLowerCase().replace(/[_/-]+/g, " ").replace(/\s+/g, " ");
}

function isGenericFieldHeaderRow(tokens) {
  const filled = tokens.filter(Boolean);
  if (filled.length < 4) return false;
  return filled.every((token, index) => token === `field ${String.fromCharCode(97 + index)}`);
}

function isKnownHeaderToken(token) {
  return /\b(lead|id|source|status|client|customer|name|spouse|buyer|seller|email|phone|contact|street|address|unit|city|state|zip|postal|county|neighborhood|mls|property|type|beds?|baths?|sq ?ft|square|lot|year|built|price|value|mortgage|balance|hoa|tax|insurance|goal|timeline|loan|preapproval|agent|date|follow|showing|offer|deadline|tags?|notes?|owner|duplicate)\b/.test(token);
}

function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/).find((line) => line.trim()) || "";
  const comma = (firstLine.match(/,/g) || []).length;
  const tab = (firstLine.match(/\t/g) || []).length;
  const pipe = (firstLine.match(/\|/g) || []).length;
  if (tab > comma && tab >= pipe) return "\t";
  if (pipe > comma) return "|";
  return ",";
}

function loadData(text, fileName = "Pasted data") {
  loadParsedData(parseDelimited(text), fileName);
}

function loadParsedData(parsed, fileName = "Pasted data") {
  if (!parsed.headers.length || !parsed.rows.length) {
    throw new Error("No table rows were found. Try the first worksheet or export the sheet as CSV.");
  }

  state.fileName = fileName;
  state.headers = parsed.headers;
  state.rawRows = parsed.rows;
  state.cleanHeaders = [];
  state.cleanRows = [];
  state.issues = [];
  state.profiles = [];
  state.reviewNotes = [];
  state.changeLog = [];
  state.removedDuplicates = 0;
  state.removedEmptyRows = 0;
  state.removedStructureRows = 0;
  els.fileBadge.textContent = `${fileName} loaded`;
  setUploadStatus(`Loaded ${parsed.rows.length.toLocaleString()} rows from ${fileName}.`);
  els.cleanBtn.disabled = parsed.rows.length === 0;
  renderFileRules(fileName);
  updatePaymentState();
  updateMetrics();
  showEmptyPreview(false);
  renderRawPreview();
  updateSummary("Data loaded. Choose cleaning rules, then click Clean Data.");
}

async function loadFile(file) {
  setUploadStatus(`Reading ${file.name}...`);
  if (!isSupportedFile(file.name)) {
    renderFileRules(file.name);
    throw new Error(`${fileExtension(file.name).toUpperCase() || "This"} file type is not supported yet. Use CSV, TSV, TXT, or XLSX.`);
  }
  const extension = fileExtension(file.name);
  if (extension === "xlsx") {
    loadParsedData(await parseXlsx(file), file.name);
    return;
  }
  loadData(await file.text(), file.name);
}

async function parseXlsx(file) {
  if (!window.JSZip) {
    throw new Error("Excel parser is not available. Refresh the app and try again.");
  }

  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const workbookXml = await zip.file("xl/workbook.xml")?.async("text");
  const relsXml = await zip.file("xl/_rels/workbook.xml.rels")?.async("text");
  if (!workbookXml || !relsXml) throw new Error("This does not look like a readable Excel workbook.");

  const workbookDoc = parseXml(workbookXml);
  const relsDoc = parseXml(relsXml);
  const sharedStrings = await readSharedStrings(zip);
  const sheets = [...workbookDoc.getElementsByTagNameNS("*", "sheet")];
  const relationships = new Map(
    [...relsDoc.getElementsByTagNameNS("*", "Relationship")].map((rel) => [rel.getAttribute("Id"), rel.getAttribute("Target")]),
  );

  for (const sheet of sheets) {
    const relId = sheet.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id") || sheet.getAttribute("r:id") || sheet.getAttribute("id");
    const target = relationships.get(relId);
    if (!target) continue;
    const sheetPath = `xl/${target.replace(/^\/?xl\//, "")}`;
    const sheetXml = await zip.file(sheetPath)?.async("text");
    if (!sheetXml) continue;
    const parsed = parseWorksheet(sheetXml, sharedStrings);
    if (parsed.headers.length && parsed.rows.length) return parsed;
  }

  throw new Error("No usable worksheet data was found in this Excel file.");
}

function parseXml(xml) {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const parseError = doc.getElementsByTagName("parsererror")[0];
  if (parseError) throw new Error("Excel XML could not be read.");
  return doc;
}

async function readSharedStrings(zip) {
  const xml = await zip.file("xl/sharedStrings.xml")?.async("text");
  if (!xml) return [];
  const doc = parseXml(xml);
  return [...doc.getElementsByTagNameNS("*", "si")].map((item) =>
    [...item.getElementsByTagNameNS("*", "t")].map((textNode) => textNode.textContent || "").join(""),
  );
}

function parseWorksheet(xml, sharedStrings) {
  const doc = parseXml(xml);
  const rowNodes = [...doc.getElementsByTagNameNS("*", "row")];
  const rows = rowNodes.map((rowNode) => {
    const cells = [...rowNode.getElementsByTagNameNS("*", "c")];
    const row = [];
    cells.forEach((cell) => {
      const ref = cell.getAttribute("r") || "";
      const colIndex = columnIndexFromRef(ref) ?? row.length;
      row[colIndex] = readCellValue(cell, sharedStrings);
    });
    return row.map((value) => value ?? "");
  });

  return tableFromRows(rows);
}

function readCellValue(cell, sharedStrings) {
  const type = cell.getAttribute("t");
  if (type === "inlineStr") {
    return [...cell.getElementsByTagNameNS("*", "t")].map((node) => node.textContent || "").join("");
  }

  const value = cell.getElementsByTagNameNS("*", "v")[0]?.textContent || "";
  if (type === "s") return sharedStrings[Number(value)] ?? "";
  if (type === "b") return value === "1" ? "TRUE" : "FALSE";
  return value;
}

function columnIndexFromRef(ref) {
  const letters = ref.match(/[A-Z]+/i)?.[0];
  if (!letters) return null;
  return [...letters.toUpperCase()].reduce((total, char) => total * 26 + char.charCodeAt(0) - 64, 0) - 1;
}

function cleanData() {
  const rules = getRules();
  state.issues = [];
  state.changeLog = [];
  state.removedDuplicates = 0;
  state.removedEmptyRows = 0;

  const prepared = prepareRowsForCleaning(state.headers, state.rawRows);
  const originalHeaders = prepared.headers.map((header) => String(header ?? ""));
  const headers = rules.normalizeHeaders
    ? makeUniqueHeaders(originalHeaders.map((header, index) => {
        const normalized = normalizeHeader(header);
        if (normalized !== header) {
          state.changeLog.push({
            row: "Header",
            column: header || `Column ${index + 1}`,
            original: header,
            cleaned: normalized,
            action: "Normalized header",
          });
        }
        return normalized;
      }))
    : makeUniqueHeaders(originalHeaders.map((header) => header.trim() || "Column"));

  const columnTypes = headers.map((header, index) => detectColumnType(header, prepared.rows.map((row) => row[index])));
  let rowRecords = prepared.rows.map((row, rowIndex) => ({
    originalRowNumber: prepared.rowNumbers[rowIndex] || rowIndex + 2,
    originalRow: row,
    row: row.map((cell, index) => cleanCell(cell, columnTypes[index], rules, headers[index], rowIndex + 2)),
  }));

  const beforeStructure = rowRecords.length;
  rowRecords = rowRecords.filter((record) => {
    const structural = classifyStructuralRow(record.originalRow, originalHeaders, headers);
    if (!structural.remove) return true;
    state.changeLog.push({
      row: record.originalRowNumber,
      column: "Entire row",
      original: record.originalRow.map((cell) => String(cell ?? "").trim()).filter(Boolean).join(" | "),
      cleaned: "(removed)",
      action: structural.reason,
    });
    return false;
  });
  state.removedStructureRows = beforeStructure - rowRecords.length;
  if (state.removedStructureRows) {
    state.issues.push({
      level: "warning",
      title: "Structural rows removed",
      detail: `${state.removedStructureRows.toLocaleString()} repeated header, note, subtotal, or section rows were removed before cleaning.`,
    });
  }

  if (rules.removeEmptyRows) {
    const before = rowRecords.length;
    rowRecords = rowRecords.filter((record) => {
      const keep = record.row.some((cell) => String(cell).trim() !== "");
      if (!keep) {
        state.changeLog.push({
          row: record.originalRowNumber,
          column: "Entire row",
          original: "(empty row)",
          cleaned: "(removed)",
          action: "Removed empty row",
        });
      }
      return keep;
    });
    state.removedEmptyRows = before - rowRecords.length;
  }

  if (rules.removeDuplicates) {
    const seen = new Set();
    const deduped = [];
    rowRecords.forEach((record) => {
      const key = record.row.map((cell) => String(cell).trim().toLowerCase()).join("\u241f");
      if (seen.has(key)) {
        state.removedDuplicates += 1;
        state.issues.push({
          level: "warning",
          title: "Duplicate row removed",
          detail: `Original row ${record.originalRowNumber} matched another row after cleaning.`,
        });
        state.changeLog.push({
          row: record.originalRowNumber,
          column: "Entire row",
          original: record.row.join(" | "),
          cleaned: "(removed)",
          action: "Removed duplicate row",
        });
      } else {
        seen.add(key);
        deduped.push(record);
      }
    });
    rowRecords = deduped;
  }

  state.cleanHeaders = headers;
  state.cleanRows = rowRecords.map((record) => record.row);
  buildIssues(columnTypes);
  moveReviewMarkersToNotes();
  state.profiles = buildProfiles(columnTypes);
  updateMetrics();
  renderActiveView();
  enableDeliverables(true);
  updateSummary(buildSummary());
}

function prepareRowsForCleaning(headers, rows) {
  if (!isLooseCrmDump(headers, rows)) {
    return {
      headers,
      rows,
      rowNumbers: rows.map((_, index) => index + 2),
    };
  }

  const extractedHeaders = [
    "Lead ID",
    "Client Name",
    "Phone",
    "Email",
    "Street Address",
    "City",
    "State",
    "Zip",
    "Beds",
    "Baths",
    "Sq Ft",
    "List Price",
    "Estimated Value",
    "Mortgage Balance",
    "Last Contacted",
    "Next Follow Up",
    "Showing Date",
    "Client Goal",
    "Agent",
    "Tags",
    "Raw Notes",
    "Duplicate Hint",
  ];

  const extractedRows = [];
  const rowNumbers = [];
  rows.forEach((row, index) => {
    const first = String(row[0] ?? "").trim();
    if (!/^RL-\d+/i.test(first)) return;

    const contact = extractContact(String(row[2] ?? ""));
    const address = extractLooseAddress(String(row[3] ?? ""));
    const property = extractPropertyStats(String(row[4] ?? ""));
    const money = extractLooseMoney(String(row[5] ?? ""));
    const dates = extractLooseDates(String(row[6] ?? ""));

    extractedRows.push([
      first,
      row[1] || "",
      contact.phone,
      contact.email,
      address.street,
      address.city,
      address.state,
      address.zip,
      property.beds,
      property.baths,
      property.sqft,
      money.price,
      money.estimated,
      money.mortgage,
      dates.last,
      dates.next,
      dates.showing,
      row[7] || "",
      row[8] || "",
      row[9] || "",
      row[10] || "",
      row[11] || "",
    ]);
    rowNumbers.push(index + 2);
  });

  state.changeLog.push({
    row: "Import",
    column: "CRM dump",
    original: "Loose CRM columns",
    cleaned: "Structured lead columns",
    action: "Extracted phone, email, address, property, price, and date fields",
  });

  return { headers: extractedHeaders, rows: extractedRows, rowNumbers };
}

function isLooseCrmDump(headers, rows) {
  const tokens = headers.map(normalizeHeaderToken);
  if (!isGenericFieldHeaderRow(tokens)) return false;
  const sample = rows.slice(0, 80).map((row) => row.join(" ").toLowerCase()).join(" ");
  return /phone:|email:|beds|sqft|price|dates:/.test(sample);
}

function extractContact(value) {
  const text = String(value ?? "");
  const emailMatch = text.match(/email:\s*([^/|]+)|([^\s/@]+@[^\s/@]+\.[^\s/@]+)/i);
  const phoneMatch = text.match(/phone:\s*([^/|]+)/i);
  return {
    phone: phoneMatch ? phoneMatch[1].trim() : "",
    email: emailMatch ? (emailMatch[1] || emailMatch[2] || "").trim() : "",
  };
}

function extractLooseAddress(value) {
  const text = normalizeText(value);
  const zipMatch = text.match(/\b(\d{5})(?:-\d{4})?\b/);
  const zip = zipMatch ? zipMatch[1] : "";
  const beforeZip = zip ? text.slice(0, text.lastIndexOf(zip)).trim() : text;
  const parts = beforeZip.split(",").map((part) => part.trim()).filter(Boolean);
  const street = parts[0] || beforeZip;
  const cityState = parts.slice(1).join(" ");
  const stateMatch = cityState.match(/\b([A-Z]{2}|\?\?|New Mexico|N\.M\.)\b/i);
  const state = stateMatch ? stateMatch[1] : "";
  const city = state ? cityState.slice(0, cityState.toLowerCase().lastIndexOf(state.toLowerCase())).trim() : cityState;
  return { street, city, state, zip };
}

function extractPropertyStats(value) {
  const text = String(value ?? "");
  return {
    beds: text.match(/beds?\s+([^\s]+)/i)?.[1] || "",
    baths: text.match(/baths?\s+([^\s]+)/i)?.[1] || "",
    sqft: text.match(/sq\s*ft|sqft/i) ? text.replace(/^.*?sq\s*ft\s*/i, "").replace(/^.*?sqft\s*/i, "").trim() : "",
  };
}

function extractLooseMoney(value) {
  const text = String(value ?? "");
  return {
    price: sliceBetweenLooseLabels(text, "price", "est"),
    estimated: sliceBetweenLooseLabels(text, "est", "mortgage"),
    mortgage: sliceAfterLooseLabel(text, "mortgage"),
  };
}

function extractLooseDates(value) {
  const text = String(value ?? "");
  return {
    last: sliceBetweenLooseLabels(text, "last", "next"),
    next: sliceBetweenLooseLabels(text, "next", "showing"),
    showing: sliceAfterLooseLabel(text, "showing"),
  };
}

function sliceBetweenLooseLabels(text, startLabel, endLabel) {
  const pattern = new RegExp(`${startLabel}:?\\s*(.*?)\\s+${endLabel}:?\\s*`, "i");
  return text.match(pattern)?.[1]?.trim() || "";
}

function sliceAfterLooseLabel(text, label) {
  const pattern = new RegExp(`${label}:?\\s*(.*)$`, "i");
  return text.match(pattern)?.[1]?.trim() || "";
}

function classifyStructuralRow(rawRow, originalHeaders, cleanHeaders) {
  const cells = rawRow.map((cell) => String(cell ?? "").trim());
  const nonEmpty = cells.filter(Boolean);
  if (!nonEmpty.length) return { remove: true, reason: "Removed empty row" };

  const rowText = nonEmpty.join(" ").toLowerCase();
  if (/\b(batch totals below|do not import this row|subtotal \d+|rows in source tab|old tab:|end of export)\b/.test(rowText)) {
    return { remove: true, reason: "Removed section or subtotal row" };
  }
  if (
    nonEmpty.length <= 3 &&
    /\b(export|generated|region break|section|subtotal|rows in source|end of export|old tab|raw .*dump|pasted section|do not import)\b/.test(rowText)
  ) {
    return { remove: true, reason: "Removed section or subtotal row" };
  }

  if (/^note only\b/i.test(nonEmpty[0]) || /^note:/i.test(nonEmpty[0])) {
    return { remove: true, reason: "Removed note-only row" };
  }

  if (looksLikeRepeatedHeader(cells, originalHeaders) || looksLikeRepeatedHeader(cells, cleanHeaders)) {
    return { remove: true, reason: "Removed repeated header row" };
  }

  const firstCell = String(cells[0] || "").toLowerCase();
  if (/^(total|subtotal|grand total|batch total|rows in source|end of export)\b/.test(firstCell)) {
    return { remove: true, reason: "Removed subtotal or footer row" };
  }

  return { remove: false, reason: "" };
}

function looksLikeRepeatedHeader(cells, headers) {
  const normalizedHeaders = headers.map(normalizeHeaderToken);
  let compared = 0;
  let matches = 0;
  cells.forEach((cell, index) => {
    const normalized = normalizeHeaderToken(cell);
    if (!normalized) return;
    compared += 1;
    if (normalized === normalizedHeaders[index] || normalizedHeaders.includes(normalized)) matches += 1;
  });
  if (compared < 4) return false;
  return matches / compared >= 0.55;
}

function cleanCell(value, type, rules, header, rowNumber) {
  let cell = String(value ?? "");
  const original = cell;
  const addChange = (before, after, action) => {
    if (before !== after) {
      state.changeLog.push({
        row: rowNumber,
        column: header,
        original: before,
        cleaned: after,
        action,
      });
    }
  };

  if (rules.trimCells) {
    const trimmed = normalizeText(cell);
    addChange(cell, trimmed, "Trimmed spacing");
    cell = trimmed;
  }

  if (type === "email" && rules.formatEmails) {
    const formatted = formatEmail(cell);
    addChange(cell, formatted, formatted.startsWith("REVIEW:") ? "Flagged invalid email" : "Lowercased email");
    cell = formatted;
  }
  if (type === "phone" && rules.formatPhones) {
    const formatted = formatPhone(cell);
    addChange(cell, formatted, formatted.startsWith("REVIEW:") ? "Flagged invalid phone" : "Formatted phone");
    cell = formatted;
  }
  if (type === "date" && rules.formatDates) {
    const formatted = formatDate(cell);
    addChange(cell, formatted, formatted.startsWith("REVIEW:") ? "Flagged invalid date" : "Standardized date");
    cell = formatted;
  }
  if (type === "year") {
    const formatted = formatYear(cell);
    addChange(cell, formatted, formatted.startsWith("REVIEW:") ? "Flagged invalid year" : "Standardized year");
    cell = formatted;
  }
  if (type === "money") {
    const formatted = formatMoney(cell);
    addChange(cell, formatted, formatted.startsWith("REVIEW:") ? "Flagged invalid amount" : "Standardized amount");
    cell = formatted;
  }
  if (type === "number") {
    const formatted = formatNumber(cell);
    addChange(cell, formatted, formatted.startsWith("REVIEW:") ? "Flagged invalid number" : "Standardized number");
    cell = formatted;
  }
  if (type === "percent") {
    const formatted = formatPercent(cell);
    addChange(cell, formatted, formatted.startsWith("REVIEW:") ? "Flagged invalid percent" : "Standardized percent");
    cell = formatted;
  }
  if (type === "state") {
    const formatted = formatState(cell);
    addChange(cell, formatted, formatted.startsWith("REVIEW:") ? "Flagged state" : "Standardized state");
    cell = formatted;
  }
  if (type === "postal") {
    const formatted = formatPostal(cell);
    addChange(cell, formatted, formatted.startsWith("REVIEW:") ? "Flagged postal code" : "Standardized postal code");
    cell = formatted;
  }
  if (type === "url") {
    const formatted = formatUrl(cell);
    addChange(cell, formatted, formatted.startsWith("REVIEW:") ? "Flagged invalid URL" : "Standardized URL");
    cell = formatted;
  }
  if (type === "name" && rules.formatNames) {
    const formatted = titleCase(cell);
    addChange(cell, formatted, "Title-cased name");
    cell = formatted;
  }
  if (type === "city" && rules.formatNames) {
    const formatted = titleCase(cell);
    addChange(cell, formatted, "Title-cased city");
    cell = formatted;
  }
  if (type === "status" || type === "source") {
    const formatted = titleCase(cell);
    addChange(cell, formatted, "Standardized label");
    cell = formatted;
  }

  if (original !== cell && state.changeLog.length > 20000) {
    state.changeLog.length = 20000;
  }
  return cell;
}

function normalizeHeader(header) {
  const cleaned = String(header)
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
  return titleCase(cleaned || "Column");
}

function makeUniqueHeaders(headers) {
  const counts = new Map();
  return headers.map((header) => {
    const count = counts.get(header) || 0;
    counts.set(header, count + 1);
    return count ? `${header} ${count + 1}` : header;
  });
}

function detectColumnType(header, values) {
  const name = header.toLowerCase();
  if (/batch|import batch|owner|tags?|notes?|raw notes|duplicate hint/.test(name)) return "text";
  if (/\bid\b|customer id|client id|account id/.test(name)) return "id";
  if (/e-?mail/.test(name)) return "email";
  if (/phone|mobile|cell|tel/.test(name)) return "phone";
  if (/year built|\bbuilt\b/.test(name)) return "year";
  if (/date|dob|created|updated|signup|contacted|follow up|follow-up|showing|deadline/.test(name)) return "date";
  if (/commission|percent|pct|%/.test(name)) return "percent";
  if (/amount|price|total|cost|balance|revenue|paid|due|value|hoa|preapproval|mortgage/.test(name)) return "money";
  if (/beds?|baths?|sq ft|square feet|sqft|lot acres?|acres?/.test(name)) return "number";
  if (/name|contact|customer|client/.test(name)) return "name";
  if (/city|town/.test(name)) return "city";
  if (/state|province|region/.test(name)) return "state";
  if (/zip|postal/.test(name)) return "postal";
  if (/url|website|link/.test(name)) return "url";
  if (/status|stage/.test(name)) return "status";
  if (/source|channel/.test(name)) return "source";

  const filled = values.map((v) => String(v).trim()).filter(Boolean).slice(0, 50);
  if (!filled.length) return "text";
  const emailHits = filled.filter(isEmail).length / filled.length;
  const phoneHits = filled.filter((v) => digitsOnly(v).length >= 10).length / filled.length;
  const dateHits = filled.filter((v) => Boolean(parseDate(v))).length / filled.length;
  const moneyHits = filled.filter((v) => Boolean(parseMoney(v))).length / filled.length;
  const numberHits = filled.filter((v) => Boolean(parsePlainNumber(v))).length / filled.length;
  if (emailHits > 0.6) return "email";
  if (phoneHits > 0.6) return "phone";
  if (dateHits > 0.6) return "date";
  if (moneyHits > 0.6) return "money";
  if (numberHits > 0.8) return "number";
  return "text";
}

function formatPhone(value) {
  const digits = digitsOnly(value);
  const normalized = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (!String(value).trim()) return "";
  if (normalized.length !== 10) return reviewValue("Invalid phone", value);
  return `(${normalized.slice(0, 3)}) ${normalized.slice(3, 6)}-${normalized.slice(6)}`;
}

function digitsOnly(value) {
  return String(value).replace(/\D/g, "");
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
}

function formatEmail(value) {
  let email = String(value).trim().toLowerCase();
  if (!email) return "";
  email = email.replace(/\.con$/i, ".com");
  return isEmail(email) ? email : reviewValue("Invalid email", value);
}

function parseDate(value) {
  const text = String(value).trim();
  if (!text) return null;
  const iso = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (iso) return validLocalDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const slash = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);
  if (slash) {
    const year = Number(slash[3].length === 2 ? `20${slash[3]}` : slash[3]);
    return validLocalDate(year, Number(slash[1]), Number(slash[2]));
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  if (parsed.getFullYear() < 1900 || parsed.getFullYear() > 2100) return null;
  return parsed;
}

function validLocalDate(year, month, day) {
  const parsed = new Date(year, month - 1, day);
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) return null;
  if (year < 1900 || year > 2100) return null;
  return parsed;
}

function formatDate(value) {
  if (!String(value).trim()) return "";
  const parsed = parseDate(value);
  if (!parsed) return reviewValue("Invalid date", value);
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatMoney(value) {
  const text = String(value).trim();
  if (!text) return "";
  const parsed = parseMoney(text);
  if (!parsed) return reviewValue("Invalid amount", value);
  return `${parsed.negative ? "-" : ""}${parsed.amount.toFixed(2)}`;
}

function parseMoney(value) {
  const text = String(value).trim();
  if (!text) return null;
  const negative = /^\(.+\)$/.test(text) || /^-/.test(text);
  const cleaned = text
    .replace(/[,$]/g, "")
    .replace(/^usd\s*/i, "")
    .replace(/[()]/g, "")
    .replace(/\b(approx|approximately|est|estimated|about|around|usd|dollars?)\b/gi, "")
    .trim();
  if (!cleaned || Number.isNaN(Number(cleaned))) return null;
  const amount = Math.abs(Number(cleaned));
  return { amount, negative };
}

function formatNumber(value) {
  if (!String(value).trim()) return "";
  const parsed = parsePlainNumber(value);
  if (parsed === null) return reviewValue("Invalid number", value);
  return Number.isInteger(parsed) ? String(parsed) : String(parsed);
}

function parsePlainNumber(value) {
  const text = String(value)
    .trim()
    .replace(/,/g, "")
    .replace(/\b(sq\.?\s*ft\.?|sqft|square feet|acres?|approx|approximately|about|around)\b/gi, "")
    .trim();
  if (!text || Number.isNaN(Number(text))) return null;
  return Number(text);
}

function formatPercent(value) {
  const text = String(value).trim();
  if (!text) return "";
  const cleaned = text.replace("%", "").trim();
  if (!cleaned || Number.isNaN(Number(cleaned))) return reviewValue("Invalid percent", value);
  return `${Number(cleaned).toFixed(2)}%`;
}

function formatYear(value) {
  const text = String(value).trim();
  if (!text) return "";
  const year = Number(text);
  if (!/^\d{4}$/.test(text) || !Number.isInteger(year) || year < 1700 || year > 2100) return reviewValue("Invalid year", value);
  return String(year);
}

function formatState(value) {
  const text = String(value).trim();
  if (!text) return "";
  const normalized = text.replace(/\./g, "").replace(/\s+/g, " ").toLowerCase();
  const states = {
    nm: "NM",
    "new mexico": "NM",
    nmx: "NM",
    az: "AZ",
    arizona: "AZ",
    co: "CO",
    colorado: "CO",
    tx: "TX",
    texas: "TX",
  };
  return states[normalized] || reviewValue("Check state", value);
}

function formatPostal(value) {
  const text = String(value).trim();
  if (!text) return "";
  const digits = digitsOnly(text);
  if (digits.length === 5) return digits;
  if (digits.length === 9) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return reviewValue("Invalid postal code", value);
}

function formatUrl(value) {
  const text = String(value).trim();
  if (!text) return "";
  try {
    const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
    return url.toString();
  } catch {
    return reviewValue("Invalid URL", value);
  }
}

function normalizeText(value) {
  return String(value)
    .replace(/[\uFFFD\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function reviewValue(reason, value) {
  const text = normalizeText(value);
  return text ? `REVIEW: ${reason} - ${text}` : "";
}

function moveReviewMarkersToNotes() {
  const cleanedRows = [];
  let hasNotes = false;
  state.reviewNotes = [];

  state.cleanRows.forEach((row, rowIndex) => {
    const cleanedRow = row.map((cell, columnIndex) => {
      const text = String(cell ?? "");
      const match = text.match(/^REVIEW:\s*([^-]+?)\s*-\s*(.*)$/);
      if (!match) return cell;

      hasNotes = true;
      const field = state.cleanHeaders[columnIndex] || `Column ${columnIndex + 1}`;
      const reason = match[1].trim();
      const original = match[2].trim();
      state.reviewNotes.push({
        row: rowIndex + 2,
        field,
        issue: reason,
        original,
      });
      return "";
    });
    cleanedRows.push(cleanedRow);
  });

  if (!hasNotes) return;

  state.cleanRows = cleanedRows;
  state.changeLog.push({
    row: "All",
    column: "Review notes",
    original: "Inline review markers",
    cleaned: "Moved to separate workbook sheet",
    action: "Separated review notes",
  });
}

function titleCase(value) {
  return String(value)
    .toLowerCase()
    .replace(/\b([a-z])/g, (match) => match.toUpperCase())
    .replace(/\b(Mc)([a-z])/g, (_, prefix, letter) => `${prefix}${letter.toUpperCase()}`);
}

function buildIssues(columnTypes) {
  state.cleanRows.forEach((row, rowIndex) => {
    row.forEach((cell, columnIndex) => {
      const value = String(cell).trim();
      const header = state.cleanHeaders[columnIndex];
      const type = columnTypes[columnIndex];

      if (!value) {
        state.issues.push({
          level: "warning",
          title: "Missing value",
          detail: `Row ${rowIndex + 2}, ${header} is blank.`,
        });
      } else if (type === "email" && !isEmail(value)) {
        state.issues.push({
          level: "error",
          title: "Invalid email",
          detail: `Row ${rowIndex + 2}, ${header}: "${value}"`,
        });
      } else if (type === "phone" && digitsOnly(value).length !== 10) {
        state.issues.push({
          level: "warning",
          title: "Questionable phone",
          detail: `Row ${rowIndex + 2}, ${header}: "${value}"`,
        });
      } else if (type === "date" && !parseDate(value)) {
        state.issues.push({
          level: "error",
          title: "Invalid date",
          detail: `Row ${rowIndex + 2}, ${header}: "${value}"`,
        });
      } else if (type === "money" && value && Number.isNaN(Number(value.replace(/[$,]/g, "")))) {
        state.issues.push({
          level: "warning",
          title: "Non-numeric amount",
          detail: `Row ${rowIndex + 2}, ${header}: "${value}"`,
        });
      } else if (type === "number" && value && Number.isNaN(Number(value.replace(/,/g, "")))) {
        state.issues.push({
          level: "warning",
          title: "Non-numeric value",
          detail: `Row ${rowIndex + 2}, ${header}: "${value}"`,
        });
      } else if (type === "percent" && value && !/^-?\d+(\.\d+)?%$/.test(value)) {
        state.issues.push({
          level: "warning",
          title: "Invalid percent",
          detail: `Row ${rowIndex + 2}, ${header}: "${value}"`,
        });
      } else if (type === "year" && value && !/^\d{4}$/.test(value)) {
        state.issues.push({
          level: "warning",
          title: "Invalid year",
          detail: `Row ${rowIndex + 2}, ${header}: "${value}"`,
        });
      }
    });
  });
}

function buildProfiles(columnTypes) {
  return state.cleanHeaders.map((header, index) => {
    const values = state.cleanRows.map((row) => String(row[index] ?? "").trim());
    const filled = values.filter(Boolean);
    const unique = new Set(filled.map((value) => value.toLowerCase()));
    return {
      header,
      type: columnTypes[index],
      filled: filled.length,
      missing: values.length - filled.length,
      unique: unique.size,
    };
  });
}

function qualityScore() {
  if (!state.cleanRows.length) return null;
  const issueCounts = state.issues.reduce(
    (counts, issue) => {
      counts[issue.level] = (counts[issue.level] || 0) + 1;
      return counts;
    },
    { error: 0, warning: 0 },
  );
  const weightedIssues = issueCounts.error * 2 + issueCounts.warning;
  const penalty = Math.min(95, Math.round((weightedIssues / state.cleanRows.length) * 50));
  const duplicateCredit = Math.min(5, Math.round((state.removedDuplicates / state.cleanRows.length) * 100));
  return Math.max(0, Math.min(100, 100 - penalty + duplicateCredit));
}

function renderRawPreview() {
  state.cleanHeaders = state.headers;
  state.cleanRows = state.rawRows;
  state.activeView = "table";
  renderActiveView();
}

function renderActiveView() {
  showEmptyPreview(state.cleanRows.length === 0);
  document.querySelectorAll(".segmented button").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === state.activeView);
  });
  els.tableView.classList.toggle("hidden", state.activeView !== "table");
  els.changesView.classList.toggle("hidden", state.activeView !== "changes");
  els.issuesView.classList.toggle("hidden", state.activeView !== "issues");
  els.profileView.classList.toggle("hidden", state.activeView !== "profile");
  if (state.activeView === "table") renderTable();
  if (state.activeView === "changes") renderChanges();
  if (state.activeView === "issues") renderIssues();
  if (state.activeView === "profile") renderProfiles();
}

function showEmptyPreview(show) {
  els.emptyState.classList.toggle("hidden", !show);
  [els.tableView, els.changesView, els.issuesView, els.profileView].forEach((el) => el.classList.toggle("hidden", show));
}

function renderTable() {
  const headers = state.cleanHeaders;
  const rows = state.cleanRows.slice(0, 100);
  els.previewTable.innerHTML = `
    <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
    <tbody>
      ${rows.map((row) => `<tr>${headers.map((_, index) => `<td>${escapeHtml(row[index] ?? "")}</td>`).join("")}</tr>`).join("")}
    </tbody>
  `;
}

function renderIssues() {
  if (!state.issues.length) {
    els.issuesList.innerHTML = `<div class="issue"><strong>No issues found</strong><p>This file is looking clean.</p></div>`;
    return;
  }
  els.issuesList.innerHTML = state.issues
    .slice(0, 200)
    .map((issue) => `<div class="issue ${issue.level}"><strong>${escapeHtml(issue.title)}</strong><p>${escapeHtml(issue.detail)}</p></div>`)
    .join("");
}

function renderChanges() {
  if (!state.changeLog.length) {
    els.changesTable.innerHTML = `
      <thead><tr><th>Status</th><th>Message</th></tr></thead>
      <tbody><tr><td>No changes</td><td>The cleaner did not alter any values with the selected rules.</td></tr></tbody>
    `;
    return;
  }

  const rows = state.changeLog.slice(0, 250);
  els.changesTable.innerHTML = `
    <thead>
      <tr>
        <th>Row</th>
        <th>Column</th>
        <th>Original</th>
        <th>Cleaned</th>
        <th>Action</th>
      </tr>
    </thead>
    <tbody>
      ${rows.map((change) => `
        <tr>
          <td>${escapeHtml(change.row)}</td>
          <td>${escapeHtml(change.column)}</td>
          <td>${escapeHtml(shorten(change.original, 120))}</td>
          <td>${escapeHtml(shorten(change.cleaned, 120))}</td>
          <td>${escapeHtml(change.action)}</td>
        </tr>
      `).join("")}
    </tbody>
  `;
}

function renderProfiles() {
  if (!state.profiles.length) {
    els.profileGrid.innerHTML = `<div class="profile-card"><strong>Clean first</strong><p>Column profiles appear after cleaning.</p></div>`;
    return;
  }
  els.profileGrid.innerHTML = state.profiles
    .map(
      (profile) => `
        <div class="profile-card">
          <strong>${escapeHtml(profile.header)}</strong>
          <p>Type: ${profile.type} | Filled: ${profile.filled} | Missing: ${profile.missing} | Unique: ${profile.unique}</p>
        </div>
      `,
    )
    .join("");
}

function updateMetrics() {
  const rows = state.cleanRows.length || state.rawRows.length;
  const columns = state.cleanHeaders.length || state.headers.length;
  const score = qualityScore();
  const health = healthAudit();
  els.rowMetric.textContent = rows.toLocaleString();
  els.columnMetric.textContent = columns.toLocaleString();
  els.issueMetric.textContent = state.issues.length.toLocaleString();
  els.scoreMetric.textContent = score === null ? "--" : `${score}%`;
  els.emailHealth.textContent = health.email.toLocaleString();
  els.phoneHealth.textContent = health.phone.toLocaleString();
  els.dateHealth.textContent = health.date.toLocaleString();
  els.emptyHealth.textContent = health.empty.toLocaleString();
  els.duplicateHealth.textContent = state.removedDuplicates.toLocaleString();
  els.amountHealth.textContent = health.amount.toLocaleString();

  if (!state.cleanRows.length) {
    els.analysisTitle.textContent = state.rawRows.length ? "Ready to clean" : "Waiting for a file";
    els.analysisText.textContent = state.rawRows.length
      ? "Data loaded. Run the cleaner to calculate quality score, validation issues, and export files."
      : "Upload a spreadsheet, run the cleaner, then review what changed before downloading.";
  } else {
    els.analysisTitle.textContent = state.issues.length ? "Cleaning completed with review items" : "Cleaning completed";
    els.analysisText.textContent = `${state.removedDuplicates.toLocaleString()} duplicate rows and ${state.removedEmptyRows.toLocaleString()} empty rows were removed. ${state.issues.length.toLocaleString()} validation items are available for review.`;
  }
}

function enableDeliverables(enabled) {
  const canDownload = (enabled || Boolean(state.paidDownload)) && els.termsCheck.checked;
  els.downloadCleanBtn.disabled = !canDownload;
  els.downloadReportBtn.disabled = !canDownload;
  els.copySummaryBtn.disabled = !canDownload;
  els.downloadFullCsvBtn.disabled = !state.paidDownload;
  els.downloadAllBtn.disabled = !state.paidDownload;
  els.downloadFullCsvBtn.textContent = state.paidDownload ? "Download Full CSV" : "Download Full CSV";
  updatePaymentState();
}

function updatePaymentState(message) {
  if (!els.fullFilePrice || !els.fullFileStatus || !els.unlockFullBtn) return;

  if (state.paidDownload) {
    els.fullFilePrice.textContent = "Payment verified";
    els.fullFileStatus.textContent = message || `Your full cleaned Excel workbook is ready: ${state.paidDownload.rowCount.toLocaleString()} rows.`;
    els.unlockFullBtn.textContent = "Download full Excel";
    els.unlockFullBtn.disabled = false;
    return;
  }

  const rowCount = state.cleanRows.length || state.rawRows.length;
  if (!rowCount) {
    els.fullFilePrice.textContent = "Upload a file to price it";
    els.fullFileStatus.textContent = "CSV, TSV, TXT, and XLSX files are accepted. PDF and old .xls files are not supported yet.";
    els.unlockFullBtn.textContent = "Unlock full file";
    els.unlockFullBtn.disabled = true;
    return;
  }

  const tier = pricingTier(rowCount);
  if (tier.id === "preview") {
    els.fullFilePrice.textContent = "$0 preview";
    els.fullFileStatus.textContent = `This file has ${rowCount.toLocaleString()} rows, so the full cleaned CSV is included in the free preview.`;
    els.unlockFullBtn.textContent = "Full file included";
    els.unlockFullBtn.disabled = true;
    return;
  }
  if (tier.contactOnly) {
    els.fullFilePrice.textContent = "Large file quote";
    els.fullFileStatus.textContent = `${rowCount.toLocaleString()} cleaned rows is over the self-serve checkout limit. This should be handled as a custom request, not the $49 human-review add-on.`;
    els.unlockFullBtn.textContent = "Contact for large file";
    els.unlockFullBtn.disabled = true;
    return;
  }

  els.fullFilePrice.textContent = `$${tier.price} ${tier.label}`;
  els.fullFileStatus.textContent = message || `${rowCount.toLocaleString()} cleaned rows. Free download is capped at ${FREE_ROW_LIMIT} rows; checkout unlocks the full cleaned CSV.`;
  els.unlockFullBtn.textContent = `Unlock full file - $${tier.price}`;
  els.unlockFullBtn.disabled = !state.cleanRows.length || !els.termsCheck.checked;
}

function healthAudit() {
  return state.issues.reduce(
    (totals, issue) => {
      if (issue.title.includes("email")) totals.email += 1;
      if (issue.title.includes("phone")) totals.phone += 1;
      if (issue.title.includes("date")) totals.date += 1;
      if (issue.title.includes("Missing")) totals.empty += 1;
      if (issue.title.includes("amount")) totals.amount += 1;
      return totals;
    },
    { email: 0, phone: 0, date: 0, empty: 0, amount: 0 },
  );
}

function buildSummary() {
  const score = qualityScore();
  const deliveredRows = getDeliverableRows();
  const issueCounts = state.issues.reduce((acc, issue) => {
    acc[issue.level] = (acc[issue.level] || 0) + 1;
    return acc;
  }, {});

  return [
    "DataReady Client Summary",
    `Source: ${state.fileName}`,
    `Rows delivered: ${deliveredRows.length}`,
    `Total cleaned rows: ${state.cleanRows.length}`,
    `Columns delivered: ${state.cleanHeaders.length}`,
    `Structural rows removed: ${state.removedStructureRows}`,
    `Empty rows removed: ${state.removedEmptyRows}`,
    `Duplicate rows removed: ${state.removedDuplicates}`,
    `Logged changes: ${state.changeLog.length}`,
    `Issues flagged: ${state.issues.length}`,
    `Errors: ${issueCounts.error || 0}`,
    `Warnings: ${issueCounts.warning || 0}`,
    `Quality score: ${score}%`,
    state.cleanRows.length > FREE_ROW_LIMIT
      ? `Free preview includes the first ${FREE_ROW_LIMIT} cleaned rows. Checkout unlocks the full cleaned file.`
      : "Full cleaned file included in this preview.",
    "",
    "Recommended client note:",
    "DataReady helped clean and standardize this file to save time. Please verify important records, totals, and flagged items before using the data for final decisions.",
  ].join("\n");
}

function updateSummary(text) {
  els.summaryBox.textContent = text;
}

function setUploadStatus(message, type = "info") {
  els.uploadStatus.textContent = message;
  els.uploadStatus.classList.toggle("error", type === "error");
}

function toCsv(headers, rows) {
  return [headers, ...rows]
    .map((row) =>
      row
        .map((cell) => {
          const value = String(cell ?? "");
          return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
        })
        .join(","),
    )
    .join("\r\n");
}

function getDeliverableRows() {
  return state.cleanRows.slice(0, FREE_ROW_LIMIT);
}

async function savePendingPayment(sessionId) {
  const fileName = cleanFileName(state.fileName || "dataready-cleaned").replace(/\.(csv|xlsx|tsv|txt)$/i, "");
  const payload = {
    sessionId,
    fileName,
    rowCount: state.cleanRows.length,
    headers: state.cleanHeaders,
    rows: state.cleanRows,
    rawHeaders: state.headers,
    rawRows: state.rawRows,
    issues: state.issues,
    profiles: state.profiles,
    reviewNotes: state.reviewNotes,
    changeLog: state.changeLog,
    removedDuplicates: state.removedDuplicates,
    removedEmptyRows: state.removedEmptyRows,
    removedStructureRows: state.removedStructureRows,
    summary: buildSummary(),
    createdAt: Date.now(),
  };
  await savePendingPayload(payload);
}

async function savePendingPayload(payload) {
  if (window.indexedDB) {
    const db = await openPendingPaymentDb();
    await idbRequest(db.transaction(PENDING_PAYMENT_STORE, "readwrite").objectStore(PENDING_PAYMENT_STORE).put(payload));
    localStorage.setItem(PENDING_PAYMENT_SESSION_KEY, payload.sessionId);
    localStorage.removeItem(PENDING_PAYMENT_KEY);
    return;
  }

  localStorage.setItem(PENDING_PAYMENT_KEY, JSON.stringify(payload));
}

async function loadPendingPayment(sessionId) {
  const targetSessionId = sessionId || localStorage.getItem(PENDING_PAYMENT_SESSION_KEY);
  if (targetSessionId && window.indexedDB) {
    try {
      const db = await openPendingPaymentDb();
      const payload = await idbRequest(db.transaction(PENDING_PAYMENT_STORE, "readonly").objectStore(PENDING_PAYMENT_STORE).get(targetSessionId));
      if (payload) return payload;
    } catch {
      // Fall back to the older localStorage handoff below.
    }
  }

  try {
    const payload = JSON.parse(localStorage.getItem(PENDING_PAYMENT_KEY) || "null");
    if (!payload || Date.now() - Number(payload.createdAt || 0) > 2 * 60 * 60 * 1000) {
      localStorage.removeItem(PENDING_PAYMENT_KEY);
      return null;
    }
    return payload;
  } catch {
    localStorage.removeItem(PENDING_PAYMENT_KEY);
    return null;
  }
}

async function removePendingPayment(sessionId) {
  localStorage.removeItem(PENDING_PAYMENT_KEY);
  localStorage.removeItem(PENDING_PAYMENT_SESSION_KEY);
  if (!sessionId || !window.indexedDB) return;
  try {
    const db = await openPendingPaymentDb();
    await idbRequest(db.transaction(PENDING_PAYMENT_STORE, "readwrite").objectStore(PENDING_PAYMENT_STORE).delete(sessionId));
  } catch {
    // Best-effort cleanup only.
  }
}

function openPendingPaymentDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(PENDING_PAYMENT_DB, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(PENDING_PAYMENT_STORE, { keyPath: "sessionId" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open browser storage."));
  });
}

function idbRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Browser storage request failed."));
  });
}

function restoreStateFromPaidDownload(payload) {
  state.paidDownload = payload;

  if (Array.isArray(payload.headers) && Array.isArray(payload.rows)) {
    state.cleanHeaders = payload.headers;
    state.cleanRows = payload.rows;
  } else if (payload.csv) {
    const parsed = parseDelimited(payload.csv);
    state.cleanHeaders = parsed.headers;
    state.cleanRows = parsed.rows;
  }

  state.fileName = payload.fileName || state.fileName || "Paid cleanup";
  state.headers = Array.isArray(payload.rawHeaders) ? payload.rawHeaders : state.headers;
  state.rawRows = Array.isArray(payload.rawRows) ? payload.rawRows : state.rawRows;
  state.issues = Array.isArray(payload.issues) ? payload.issues : [];
  state.profiles = Array.isArray(payload.profiles) ? payload.profiles : buildProfiles(state.cleanHeaders.map(() => "text"));
  state.reviewNotes = Array.isArray(payload.reviewNotes) ? payload.reviewNotes : [];
  state.changeLog = Array.isArray(payload.changeLog) ? payload.changeLog : [];
  state.removedDuplicates = Number(payload.removedDuplicates || 0);
  state.removedEmptyRows = Number(payload.removedEmptyRows || 0);
  state.removedStructureRows = Number(payload.removedStructureRows || 0);
  state.activeView = "table";
  els.fileBadge.textContent = `${state.fileName} paid`;
  setUploadStatus(`Payment verified. Restored ${state.cleanRows.length.toLocaleString()} cleaned rows.`);
  renderActiveView();
  updateMetrics();
  updateSummary(payload.summary || buildSummary());
}

function cleanFileName(name) {
  return String(name || "cleaned-data").replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "") || "cleaned-data";
}

async function buildXlsxWorkbookBase64(fileName) {
  if (!window.JSZip) throw new Error("Excel export is not available. Refresh the app and try again.");
  const zip = new JSZip();
  const reviewRows = state.reviewNotes.length
    ? state.reviewNotes.map((note) => [note.row, note.field, note.issue, note.original])
    : [["", "", "No review notes", ""]];

  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`);
  zip.folder("_rels").file(".rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`);
  zip.folder("xl").file("workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>
<sheet name="Clean Data" sheetId="1" r:id="rId1"/>
<sheet name="Review Notes" sheetId="2" r:id="rId2"/>
<sheet name="Original Data" sheetId="3" r:id="rId3"/>
</sheets>
</workbook>`);
  zip.folder("xl").folder("_rels").file("workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/>
</Relationships>`);
  zip.folder("xl").folder("worksheets").file("sheet1.xml", worksheetXml(state.cleanHeaders, state.cleanRows));
  zip.folder("xl").folder("worksheets").file("sheet2.xml", worksheetXml(["Row", "Field", "Issue", "Original Value"], reviewRows));
  zip.folder("xl").folder("worksheets").file("sheet3.xml", worksheetXml(state.headers, state.rawRows));
  return zip.generateAsync({ type: "base64", compression: "DEFLATE" });
}

function worksheetXml(headers, rows) {
  const allRows = [headers, ...rows];
  const sheetRows = allRows
    .map((row, rowIndex) => {
      const cells = row.map((value, columnIndex) => {
        const ref = `${columnName(columnIndex + 1)}${rowIndex + 1}`;
        return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`;
      }).join("");
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<sheetData>${sheetRows}</sheetData>
</worksheet>`;
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

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function downloadBase64File(name, base64, type) {
  if (!base64) throw new Error("The Excel workbook was not found in this browser session.");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  downloadBlob(name, new Blob([bytes], { type }));
}

async function ensurePaidWorkbookBase64() {
  if (state.paidDownload?.xlsxBase64) return state.paidDownload.xlsxBase64;
  const baseName = cleanFileName(state.paidDownload?.fileName || state.fileName || "dataready-cleaned").replace(/\.(csv|xlsx|tsv|txt)$/i, "");
  updatePaymentState("Building your Excel workbook now. Large files can take a little bit.");
  const xlsxBase64 = await buildXlsxWorkbookBase64(baseName);
  state.paidDownload.xlsxBase64 = xlsxBase64;
  savePendingPayload(state.paidDownload).catch(() => {
    // The file can still download even if the cached copy cannot be updated.
  });
  return xlsxBase64;
}

function paidCsv() {
  if (state.paidDownload?.csv) return state.paidDownload.csv;
  return toCsv(state.cleanHeaders, state.cleanRows);
}

async function downloadPaidFile() {
  if (!state.paidDownload) return false;
  const name = state.paidDownload.fileName || "dataready-cleaned";
  try {
    const xlsxBase64 = await ensurePaidWorkbookBase64();
    downloadBase64File(
      `${name}-cleaned-workbook.xlsx`,
      xlsxBase64,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    updatePaymentState(`Your full cleaned Excel workbook is ready: ${state.paidDownload.rowCount.toLocaleString()} rows.`);
    return true;
  } catch (error) {
    updatePaymentState(`${error.message} Please re-upload the file and run checkout again in this same browser tab.`);
    updateSummary(`Download problem: ${error.message}\nPlease re-upload the file, clean it again, and run checkout again.`);
    return false;
  }
}

async function downloadAllFiles() {
  if (!state.paidDownload) {
    updatePaymentState("Upload and unlock the full file before downloading the complete package.");
    return false;
  }

  if (!window.JSZip) {
    updatePaymentState("Download package is not available. Refresh the app and try again.");
    return false;
  }

  const baseName = cleanFileName(state.paidDownload.fileName || state.fileName || "dataready-cleaned").replace(/\.(csv|xlsx|tsv|txt)$/i, "");
  const zip = new JSZip();

  try {
    const xlsxBase64 = await ensurePaidWorkbookBase64();
    zip.file(`${baseName}-cleaned-workbook.xlsx`, xlsxBase64, { base64: true });
    zip.file(`${baseName}-full.csv`, paidCsv());

    zip.file("dataready-free-preview.csv", toCsv(state.cleanHeaders, getDeliverableRows()));
    zip.file("client-cleaning-report.pdf", buildPdfReport(), { binary: true });
    zip.file(`${baseName}-original.csv`, toCsv(state.headers, state.rawRows));
    zip.file("dataready-summary.txt", els.summaryBox.textContent || state.paidDownload.summary || buildSummary());

    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
    downloadBlob(`${baseName}-dataready-deliverables.zip`, blob);
    updatePaymentState("All customer deliverables are packaged: Excel workbook, CSV, PDF report, preview, and summary.");
    return true;
  } catch (error) {
    updatePaymentState(`${error.message} Please re-upload the file and run checkout again in this same browser tab.`);
    updateSummary(`Download package problem: ${error.message}\nPlease re-upload the file, clean it again, and run checkout again.`);
    return false;
  }
}

function downloadFile(name, content, type) {
  downloadBlob(name, new Blob([content], { type }));
}

function downloadBlob(name, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildPdfReport() {
  const score = qualityScore() ?? 0;
  const health = healthAudit();
  const deliveredRows = getDeliverableRows();
  const issueCounts = state.issues.reduce((acc, issue) => {
    acc[issue.level] = (acc[issue.level] || 0) + 1;
    return acc;
  }, {});

  const sections = [
    {
      title: "Executive Summary",
      lines: [
        `Source file: ${state.fileName || "Untitled upload"}`,
        `Rows delivered: ${deliveredRows.length.toLocaleString()}`,
        `Total cleaned rows: ${state.cleanRows.length.toLocaleString()}`,
        state.cleanRows.length > FREE_ROW_LIMIT
          ? `Free preview includes the first ${FREE_ROW_LIMIT.toLocaleString()} cleaned rows. Checkout unlocks the full cleaned file.`
          : "Full cleaned file included in this preview.",
        `Columns delivered: ${state.cleanHeaders.length.toLocaleString()}`,
        `Quality score: ${score}%`,
        `Logged changes: ${state.changeLog.length.toLocaleString()}`,
        `Issues flagged: ${state.issues.length.toLocaleString()} (${issueCounts.error || 0} errors, ${issueCounts.warning || 0} warnings)`,
        `Empty rows removed: ${state.removedEmptyRows.toLocaleString()}`,
        `Duplicate rows removed: ${state.removedDuplicates.toLocaleString()}`,
      ],
    },
    {
      title: "Health Audit",
      lines: [
        `Invalid emails: ${health.email.toLocaleString()}`,
        `Questionable phones: ${health.phone.toLocaleString()}`,
        `Invalid dates: ${health.date.toLocaleString()}`,
        `Missing values: ${health.empty.toLocaleString()}`,
        `Duplicate rows removed: ${state.removedDuplicates.toLocaleString()}`,
        `Questionable amounts: ${health.amount.toLocaleString()}`,
      ],
    },
    {
      title: "Top Changes",
      lines: state.changeLog.slice(0, 40).map((change) =>
        `Row ${change.row} | ${change.column} | ${change.action}: "${shorten(change.original, 52)}" -> "${shorten(change.cleaned, 52)}"`,
      ),
      empty: "No automated changes were logged.",
    },
    {
      title: "Top Issues For Human Review",
      lines: state.issues.slice(0, 45).map((issue) => `${issue.level.toUpperCase()} | ${issue.title}: ${issue.detail}`),
      empty: "No validation issues were found.",
    },
    {
      title: "Column Profile",
      lines: state.profiles.slice(0, 32).map((profile) =>
        `${profile.header}: ${profile.type}; ${profile.filled} filled; ${profile.missing} missing; ${profile.unique} unique`,
      ),
      empty: "No column profile is available.",
    },
  ];

  const pages = [];
  let commands = [];
  let y = 748;

  const newPage = () => {
    if (commands.length) pages.push(commands.join("\n"));
    commands = [];
    y = 748;
    commands.push("1 1 1 rg");
    commands.push("0 0 612 792 re f");
    commands.push("0.93 0.97 0.94 rg");
    commands.push("42 724 528 34 re f");
    commands.push("0.07 0.13 0.1 rg");
    drawText(commands, "DataReady Client Data Cleaning Report", 54, 738, 18, "F2");
    commands.push("0.36 0.42 0.39 rg");
    drawText(commands, `Generated ${new Date().toLocaleDateString()} | Local browser audit`, 54, 710, 9, "F1");
    y = 676;
  };

  const ensureSpace = (needed = 44) => {
    if (y < 72 + needed) newPage();
  };

  newPage();
  sections.forEach((section) => {
    ensureSpace(62);
    commands.push("0.95 0.97 0.95 rg");
    commands.push(`42 ${y - 10} 528 28 re f`);
    commands.push("0.09 0.45 0.27 rg");
    drawText(commands, section.title, 54, y, 13, "F2");
    y -= 34;

    const lines = section.lines.length ? section.lines : [section.empty || "None"];
    lines.forEach((line) => {
      wrapPdfText(line, 92).forEach((wrapped, index) => {
        ensureSpace(16);
        commands.push(index === 0 ? "0.08 0.11 0.09 rg" : "0.36 0.42 0.39 rg");
        drawText(commands, `${index === 0 ? "- " : "  "}${wrapped}`, 58, y, 9.5, "F1");
        y -= 15;
      });
    });
    y -= 18;
  });
  pages.push(commands.join("\n"));

  return assemblePdf(pages);
}

function drawText(commands, text, x, y, size, font) {
  commands.push(`BT /${font} ${size} Tf ${x} ${y} Td (${escapePdfText(sanitizePdfText(text))}) Tj ET`);
}

function wrapPdfText(text, maxChars) {
  const words = sanitizePdfText(text).split(/\s+/);
  const lines = [];
  let line = "";
  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  });
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function sanitizePdfText(text) {
  return String(text ?? "")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function escapePdfText(text) {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function assemblePdf(pageStreams) {
  const objects = [];
  const add = (body) => {
    objects.push(body);
    return objects.length;
  };

  const catalogId = add("<< /Type /Catalog /Pages 2 0 R >>");
  const pagesId = add("PAGES");
  const fontId = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const boldFontId = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  const pageIds = [];

  pageStreams.forEach((stream) => {
    const streamId = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    const pageId = add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R /F2 ${boldFontId} 0 R >> >> /Contents ${streamId} 0 R >>`);
    pageIds.push(pageId);
  });

  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  objects[catalogId - 1] = objects[catalogId - 1];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return pdf;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function shorten(value, maxLength) {
  const text = String(value ?? "");
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

function reset() {
  state.fileName = "";
  state.headers = [];
  state.rawRows = [];
  state.cleanHeaders = [];
  state.cleanRows = [];
  state.issues = [];
  state.profiles = [];
  state.changeLog = [];
  state.removedDuplicates = 0;
  state.removedEmptyRows = 0;
  state.paidDownload = null;
  els.fileInput.value = "";
  els.pasteInput.value = "";
  els.fileBadge.textContent = "No file loaded";
  setUploadStatus("Ready for Excel, CSV, TSV, or pasted data.");
  els.cleanBtn.disabled = true;
  els.termsCheck.checked = false;
  enableDeliverables(false);
  renderFileRules("");
  updatePaymentState();
  updateMetrics();
  showEmptyPreview(true);
  updateSummary("No cleaned data yet.");
}

async function startCheckout() {
  if (state.paidDownload) {
    await downloadPaidFile();
    return;
  }

  const rowCount = state.cleanRows.length;
  const tier = pricingTier(rowCount);
  if (!rowCount || tier.id === "preview") return;
  if (tier.contactOnly) {
    updatePaymentState("Large files over 50,000 rows should be quoted or requested by email instead of automatic checkout.");
    return;
  }

  els.unlockFullBtn.disabled = true;
  els.unlockFullBtn.textContent = "Preparing checkout...";
  try {
    try {
      await savePendingPayment(`pending-${Date.now()}`);
    } catch (error) {
      throw new Error(`Could not prepare the cleaned file for download: ${error.message}`);
    }
    els.unlockFullBtn.textContent = "Opening checkout...";
    const response = await fetch("/api/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tierId: tier.id,
        rowCount,
        fileName: state.fileName || "Uploaded file",
        successUrl: window.location.href,
        cancelUrl: window.location.href,
      }),
    });
    const result = await response.json();
    if (!response.ok || !result.url || !result.sessionId) throw new Error(result.error || "Checkout is not ready yet.");
    try {
      const pending = await loadPendingPayment();
      pending.sessionId = result.sessionId;
      await savePendingPayload(pending);
    } catch (error) {
      throw new Error(`Could not prepare the cleaned file for download: ${error.message}`);
    }
    window.location.href = result.url;
  } catch (error) {
    updatePaymentState(`${error.message} Add your Stripe secret key in Cloudflare to activate paid downloads.`);
  }
}

async function restorePaidDownloadFromReturn() {
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get("session_id");
  if (params.get("checkout") !== "success" || !sessionId) return;

  const pending = await loadPendingPayment(sessionId);
  if (!pending || pending.sessionId !== sessionId) {
    updatePaymentState("Payment returned, but the cleaned file was not found on this device. Please clean the file again.");
    return;
  }

  updatePaymentState("Verifying Stripe payment...");
  try {
    const response = await fetch(`/api/verify-checkout-session?session_id=${encodeURIComponent(sessionId)}`);
    const result = await response.json();
    if (!response.ok || !result.paid) throw new Error(result.error || "Payment was not verified yet.");
    state.paidDownload = pending;
    restoreStateFromPaidDownload(pending);
    await removePendingPayment(sessionId);
    updatePaymentState("Payment verified. Your cleaned Excel workbook should download automatically. If it does not, click Download full Excel.");
    updateSummary(`${pending.summary || buildSummary()}\n\nPayment verified.\nCleaned Excel workbook ready: ${pending.rowCount.toLocaleString()} rows.\nSheet 1: Clean Data. Sheet 2: Review Notes. Sheet 3: Original Data.\nYour download should start automatically. If it does not, click Download full Excel.`);
    els.termsCheck.checked = true;
    enableDeliverables(true);
    setTimeout(downloadPaidFile, 300);
    window.history.replaceState({}, "", window.location.pathname + window.location.hash);
  } catch (error) {
    updatePaymentState(`Payment check failed: ${error.message}`);
  }
}

els.fileInput.addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    await loadFile(file);
  } catch (error) {
    setUploadStatus(`Upload problem: ${error.message}`, "error");
    updateSummary(`Upload problem: ${error.message}`);
  }
});

els.fileInput.addEventListener("click", () => {
  els.fileInput.value = "";
});

els.dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  els.dropZone.classList.add("dragging");
});

els.dropZone.addEventListener("dragleave", () => els.dropZone.classList.remove("dragging"));

els.dropZone.addEventListener("drop", async (event) => {
  event.preventDefault();
  els.dropZone.classList.remove("dragging");
  const file = event.dataTransfer.files[0];
  if (!file) return;
  try {
    await loadFile(file);
  } catch (error) {
    setUploadStatus(`Upload problem: ${error.message}`, "error");
    updateSummary(`Upload problem: ${error.message}`);
  }
});

els.parsePasteBtn.addEventListener("click", () => {
  const text = els.pasteInput.value.trim();
  if (!text) return;
  try {
    loadData(text, "Pasted data");
  } catch (error) {
    setUploadStatus(`Paste problem: ${error.message}`, "error");
    updateSummary(`Paste problem: ${error.message}`);
  }
});

if (els.loadSampleBtn) {
  els.loadSampleBtn.addEventListener("click", () => {
    els.pasteInput.value = sampleCsv;
    loadData(sampleCsv, "Sample messy client list");
  });
}

els.cleanBtn.addEventListener("click", cleanData);
els.resetBtn.addEventListener("click", reset);
els.termsCheck.addEventListener("change", () => enableDeliverables(state.cleanRows.length > 0));
els.unlockFullBtn.addEventListener("click", startCheckout);

document.querySelectorAll(".segmented button").forEach((button) => {
  button.addEventListener("click", () => {
    state.activeView = button.dataset.view;
    renderActiveView();
  });
});

els.downloadCleanBtn.addEventListener("click", () => {
  downloadFile("dataready-free-preview.csv", toCsv(state.cleanHeaders, getDeliverableRows()), "text/csv;charset=utf-8");
});

els.downloadFullCsvBtn.addEventListener("click", () => {
  if (state.paidDownload) {
    downloadFile(`${state.paidDownload.fileName || "dataready-cleaned"}-full.csv`, paidCsv(), "text/csv;charset=utf-8");
  }
});

els.downloadAllBtn.addEventListener("click", downloadAllFiles);

els.downloadReportBtn.addEventListener("click", () => {
  downloadFile("client-cleaning-report.pdf", buildPdfReport(), "application/pdf");
});

els.copySummaryBtn.addEventListener("click", async () => {
  await navigator.clipboard.writeText(els.summaryBox.textContent);
  els.copySummaryBtn.textContent = "Copied";
  setTimeout(() => {
    els.copySummaryBtn.textContent = "Copy Summary";
  }, 1200);
});

reset();
restorePaidDownloadFromReturn();

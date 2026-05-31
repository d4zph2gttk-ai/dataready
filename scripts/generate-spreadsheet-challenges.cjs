const fs = require("fs");
const path = require("path");
const JSZip = require("jszip");

const outputDir = "C:/Users/prple/OneDrive/Documents/New project/outputs/data-cleaning-samples/challenges";

function csvEscape(value, delimiter = ",") {
  const text = String(value ?? "");
  const needsQuotes = text.includes(delimiter) || /[",\n\r]/.test(text);
  return needsQuotes ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(name, rows, delimiter = ",") {
  fs.mkdirSync(outputDir, { recursive: true });
  const filePath = path.join(outputDir, name);
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
  const sheetRows = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((value, columnIndex) => {
          const ref = `${columnName(columnIndex + 1)}${rowIndex + 1}`;
          return `<c r="${ref}" t="inlineStr"><is><t>${xmlEscape(value)}</t></is></c>`;
        })
        .join("");
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`;
}

async function writeXlsx(name, sheets) {
  fs.mkdirSync(outputDir, { recursive: true });
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`);
  zip.folder("_rels").file(".rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  zip.folder("xl").file("workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((sheet, index) => `<sheet name="${xmlEscape(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("")}</sheets></workbook>`);
  zip.folder("xl").folder("_rels").file("workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("")}</Relationships>`);
  sheets.forEach((sheet, index) => {
    zip.folder("xl").folder("worksheets").file(`sheet${index + 1}.xml`, worksheetXml(sheet.rows));
  });
  const filePath = path.join(outputDir, name);
  fs.writeFileSync(filePath, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
  return filePath;
}

function pick(list, i, salt = 0) {
  return list[(i * 17 + salt * 9) % list.length];
}

function messyPhone(i) {
  const mid = String(200 + ((i * 29) % 740)).padStart(3, "0");
  const end = String(1000 + ((i * 37) % 9000)).padStart(4, "0");
  if (i % 37 === 0) return "call office";
  if (i % 19 === 0) return "";
  if (i % 7 === 0) return `505${mid}${end}`;
  if (i % 5 === 0) return `1-505-${mid}-${end}`;
  return `(505) ${mid}-${end}`;
}

function messyMoney(value, i) {
  if (i % 43 === 0) return "TBD";
  if (i % 29 === 0) return "";
  if (i % 13 === 0) return `$${Math.round(value).toLocaleString("en-US")}`;
  if (i % 11 === 0) return `USD ${Math.round(value).toLocaleString("en-US")}`;
  return value.toFixed(2);
}

function messyDate(i, offset = 0) {
  if (i % 41 === 0) return "not sure";
  if (i % 23 === 0) return "";
  const month = ((i + offset) % 12) + 1;
  const day = ((i * 3 + offset) % 28) + 1;
  const year = 2024 + ((i + offset) % 4);
  if (i % 9 === 0) return `${month}/${day}/${String(year).slice(2)}`;
  if (i % 7 === 0) return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return `${month}/${day}/${year}`;
}

const first = ["Ana", "Nora", "Marcus", "Sofia", "Julian", "Leah", "Ramon", "Priya", "Devon", "Marta"];
const last = ["Garcia", "Lopez", "Reed", "Singh", "Chavez", "Romero", "Vigil", "Baca", "Ortega", "Nguyen"];
const cities = ["Albuquerque", "Santa Fe", "Rio Rancho", "Las Cruces", "Taos", "Farmington", "Roswell"];

const scenarios = [
  {
    name: "invoice-aging-messy-800.csv",
    expected: {
      "Invoice #": "id",
      "Customer Name": "name",
      "Customer Email": "email",
      "Billing Phone": "phone",
      "Invoice Date": "date",
      "Due Date": "date",
      "Subtotal": "money",
      "Tax": "money",
      "Amount Due": "money",
      "Paid?": "status",
      "Rep": "name",
      "Notes": "text",
    },
    rows() {
      const rows = [
        ["AR EXPORT - do not import this title row", "", "", "", "", "", "", "", "", "", "", ""],
        ["Invoice #", "Customer Name", "Customer Email", "Billing Phone", "Invoice Date", "Due Date", "Subtotal", "Tax", "Amount Due", "Paid?", "Rep", "Notes"],
      ];
      for (let i = 0; i < 800; i += 1) {
        if (i && i % 167 === 0) rows.push(rows[1]);
        const fn = pick(first, i);
        const ln = pick(last, i, 2);
        const subtotal = 80 + ((i * 31) % 4400);
        rows.push([
          `INV-${10000 + i}`,
          `${fn} ${ln}`,
          i % 31 === 0 ? `${fn}.${ln}${i} at example dot com` : `${fn}.${ln}${i}@Example.COM`,
          messyPhone(i),
          messyDate(i),
          messyDate(i, 8),
          messyMoney(subtotal, i),
          messyMoney(subtotal * 0.07, i + 4),
          messyMoney(subtotal * 1.07, i + 8),
          pick(["paid", "PAST DUE", "partial", "open", ""], i),
          `${pick(first, i, 4)} ${pick(last, i, 6)}`,
          i % 73 === 0 ? "customer disputes late fee" : "",
        ]);
      }
      rows.push(["TOTAL", "", "", "", "", "", "ignore", "", "", "", "", ""]);
      return rows;
    },
  },
  {
    name: "bank-transactions-messy-1500.csv",
    expected: {
      "Transaction ID": "id",
      "Posted Date": "date",
      "Description": "text",
      "Merchant": "text",
      "Category": "status",
      "Debit": "money",
      "Credit": "money",
      "Balance": "money",
      "Account Last 4": "id",
      "Memo": "text",
    },
    rows() {
      const rows = [["Exported from bank portal", "", "", "", "", "", "", "", "", ""], ["Transaction ID", "Posted Date", "Description", "Merchant", "Category", "Debit", "Credit", "Balance", "Account Last 4", "Memo"]];
      let balance = 3200;
      for (let i = 0; i < 1500; i += 1) {
        const debit = i % 6 === 0 ? 0 : 8 + ((i * 13) % 700);
        const credit = i % 6 === 0 ? 200 + ((i * 19) % 1300) : 0;
        balance += credit - debit;
        rows.push([
          `TX-${202600000 + i}`,
          messyDate(i),
          pick(["POS PURCHASE", "ACH CREDIT", "ONLINE TRANSFER", "CHECK", "CARD AUTOPAY"], i),
          pick(["Smith Supply", "Adobe Utilities", "Stripe", "Square", "City Water", "Payroll"], i, 2),
          pick(["office", "utilities", "income", "payroll", "unknown"], i, 3),
          debit ? messyMoney(debit, i) : "",
          credit ? messyMoney(credit, i + 2) : "",
          messyMoney(balance, i + 4),
          String(1000 + (i % 9000)),
          i % 101 === 0 ? "possible duplicate bank export row" : "",
        ]);
      }
      return rows;
    },
  },
  {
    name: "event-roster-messy-1200.csv",
    expected: {
      "Registration ID": "id",
      "Attendee Name": "name",
      "Email": "email",
      "Mobile": "phone",
      "Ticket Type": "status",
      "Registration Date": "date",
      "Check-in Status": "status",
      "Company": "text",
      "City": "city",
      "State": "state",
      "Zip Code": "postal",
      "Dietary Notes": "text",
    },
    rows() {
      const rows = [["Registration ID", "Attendee Name", "Email", "Mobile", "Ticket Type", "Registration Date", "Check-in Status", "Company", "City", "State", "Zip Code", "Dietary Notes"]];
      for (let i = 0; i < 1200; i += 1) {
        rows.push([
          `REG-${5000 + i}`,
          `${pick(first, i)} ${pick(last, i)}`,
          i % 27 === 0 ? `bad-email-${i}` : `${pick(first, i)}.${pick(last, i)}${i}@mail.com`,
          messyPhone(i),
          pick(["General", "VIP", "Sponsor", "Staff", "Student"], i),
          messyDate(i),
          pick(["checked in", "NO SHOW", "pending", ""], i, 2),
          pick(["Mesa Labs", "Northwind", "Desert Co", "Solo", ""], i, 3),
          pick(cities, i),
          i % 43 === 0 ? "New Mexico" : "NM",
          i % 37 === 0 ? "BADZIP" : String(87000 + (i % 999)),
          i % 50 === 0 ? "gluten free" : "",
        ]);
      }
      return rows;
    },
  },
  {
    name: "inventory-product-messy-1000.csv",
    expected: {
      "SKU": "id",
      "Product Name": "text",
      "Category": "status",
      "Vendor": "text",
      "Unit Cost": "money",
      "Retail Price": "money",
      "Quantity On Hand": "number",
      "Reorder Level": "number",
      "Last Ordered": "date",
      "Active?": "status",
      "Product URL": "url",
    },
    rows() {
      const rows = [["SKU", "Product Name", "Category", "Vendor", "Unit Cost", "Retail Price", "Quantity On Hand", "Reorder Level", "Last Ordered", "Active?", "Product URL"]];
      for (let i = 0; i < 1000; i += 1) {
        rows.push([
          `SKU-${String(i).padStart(5, "0")}`,
          pick(["Widget A", "Cable Pack", "Office Chair", "Sensor Kit", "Label Roll"], i),
          pick(["hardware", "supplies", "furniture", "electronics"], i, 2),
          pick(["Acme", "SupplyHub", "Local Vendor", "Warehouse Direct"], i, 3),
          messyMoney(5 + ((i * 7) % 240), i),
          messyMoney(15 + ((i * 11) % 400), i + 3),
          i % 47 === 0 ? "unknown" : String((i * 13) % 900),
          i % 31 === 0 ? "" : String(10 + (i % 90)),
          messyDate(i),
          pick(["yes", "no", "ACTIVE", "discontinued"], i),
          i % 41 === 0 ? "not a url" : `example.com/products/${i}`,
        ]);
      }
      return rows;
    },
  },
  {
    name: "donor-list-messy-900.csv",
    expected: {
      "Donor ID": "id",
      "Donor Name": "name",
      "Email Address": "email",
      "Phone": "phone",
      "Street": "text",
      "City": "city",
      "State": "state",
      "Postal": "postal",
      "Gift Date": "date",
      "Gift Amount": "money",
      "Campaign": "source",
      "Thanked": "status",
    },
    rows() {
      const rows = [["Donor ID", "Donor Name", "Email Address", "Phone", "Street", "City", "State", "Postal", "Gift Date", "Gift Amount", "Campaign", "Thanked"]];
      for (let i = 0; i < 900; i += 1) {
        rows.push([
          `D-${90000 + i}`,
          `${pick(first, i)} ${pick(last, i, 2)}`,
          `${pick(first, i)}.${pick(last, i, 2)}${i}@Example.ORG`,
          messyPhone(i),
          `${100 + i} ${pick(["Main St", "Oak Ave", "Mesa Dr", "Canyon Rd"], i)}`,
          pick(cities, i),
          i % 39 === 0 ? "N.M." : "NM",
          String(87000 + (i % 999)),
          messyDate(i),
          messyMoney(10 + ((i * 17) % 2500), i),
          pick(["Spring Appeal", "Gala", "Online", "Major Gift"], i),
          pick(["yes", "NO", "pending", ""], i, 3),
        ]);
      }
      return rows;
    },
  },
  {
    name: "appointment-schedule-messy-700.csv",
    expected: {
      "Appointment ID": "id",
      "Patient Name": "name",
      "Contact Phone": "phone",
      "Email": "email",
      "Appointment Date": "date",
      "Provider": "name",
      "Visit Type": "status",
      "Status": "status",
      "Balance Due": "money",
      "Clinic City": "city",
      "Clinic State": "state",
      "Notes": "text",
    },
    rows() {
      const rows = [["SCHEDULE EXPORT", "", "", "", "", "", "", "", "", "", "", ""], ["Appointment ID", "Patient Name", "Contact Phone", "Email", "Appointment Date", "Provider", "Visit Type", "Status", "Balance Due", "Clinic City", "Clinic State", "Notes"]];
      for (let i = 0; i < 700; i += 1) {
        rows.push([
          `APT-${70000 + i}`,
          `${pick(first, i)} ${pick(last, i, 3)}`,
          messyPhone(i),
          i % 33 === 0 ? "" : `${pick(first, i)}.${pick(last, i, 3)}${i}@clinicmail.com`,
          messyDate(i),
          `${pick(first, i, 4)} ${pick(last, i, 5)}`,
          pick(["new patient", "follow up", "telehealth", "lab", "consult"], i),
          pick(["scheduled", "cancelled", "completed", "no show"], i, 2),
          messyMoney((i * 11) % 900, i),
          pick(cities, i),
          i % 41 === 0 ? "New Mexico" : "NM",
          i % 79 === 0 ? "verify insurance" : "",
        ]);
      }
      return rows;
    },
  },
  {
    name: "subscription-users-messy-1100.csv",
    expected: {
      "User ID": "id",
      "Full Name": "name",
      "Login Email": "email",
      "Phone Number": "phone",
      "Plan": "status",
      "Signup Date": "date",
      "Last Login": "date",
      "Monthly Fee": "money",
      "Account Status": "status",
      "Referral Source": "source",
      "Profile Link": "url",
    },
    rows() {
      const rows = [["User ID", "Full Name", "Login Email", "Phone Number", "Plan", "Signup Date", "Last Login", "Monthly Fee", "Account Status", "Referral Source", "Profile Link"]];
      for (let i = 0; i < 1100; i += 1) {
        rows.push([
          `U-${300000 + i}`,
          `${pick(first, i)} ${pick(last, i, 2)}`,
          `${pick(first, i)}.${pick(last, i, 2)}${i}@Example.COM`,
          messyPhone(i),
          pick(["free", "starter", "pro", "enterprise"], i),
          messyDate(i),
          messyDate(i, 15),
          messyMoney(pick([0, 9, 19, 49, 99], i), i),
          pick(["active", "PAUSED", "cancelled", "trial"], i, 4),
          pick(["Google", "Referral", "Facebook", "Partner", "Direct"], i, 5),
          i % 57 === 0 ? "broken link" : `app.example.com/users/${i}`,
        ]);
      }
      return rows;
    },
  },
  {
    name: "school-student-roster-messy-950.csv",
    expected: {
      "Student ID": "id",
      "Student Name": "name",
      "Guardian Name": "name",
      "Guardian Email": "email",
      "Guardian Phone": "phone",
      "Grade": "status",
      "Enrollment Date": "date",
      "Balance": "money",
      "Homeroom": "text",
      "City": "city",
      "State": "state",
      "Zip": "postal",
    },
    rows() {
      const rows = [["Student ID", "Student Name", "Guardian Name", "Guardian Email", "Guardian Phone", "Grade", "Enrollment Date", "Balance", "Homeroom", "City", "State", "Zip"]];
      for (let i = 0; i < 950; i += 1) {
        rows.push([
          `S-${120000 + i}`,
          `${pick(first, i)} ${pick(last, i, 1)}`,
          `${pick(first, i, 5)} ${pick(last, i, 7)}`,
          `${pick(first, i, 5)}.${pick(last, i, 7)}${i}@schoolmail.org`,
          messyPhone(i),
          pick(["K", "1", "2", "3", "4", "5", "6", "7", "8"], i),
          messyDate(i),
          messyMoney((i * 5) % 300, i),
          pick(["A101", "B204", "C310", "D118"], i),
          pick(cities, i),
          "NM",
          String(87000 + (i % 999)),
        ]);
      }
      return rows;
    },
  },
  {
    name: "work-order-service-messy-1000.csv",
    expected: {
      "Work Order": "id",
      "Customer": "name",
      "Service Address": "text",
      "City": "city",
      "State": "state",
      "Zip": "postal",
      "Contact Phone": "phone",
      "Contact Email": "email",
      "Scheduled Date": "date",
      "Completed Date": "date",
      "Service Type": "status",
      "Labor Hours": "number",
      "Total Charge": "money",
      "Technician": "name",
    },
    rows() {
      const rows = [["Work Order", "Customer", "Service Address", "City", "State", "Zip", "Contact Phone", "Contact Email", "Scheduled Date", "Completed Date", "Service Type", "Labor Hours", "Total Charge", "Technician"]];
      for (let i = 0; i < 1000; i += 1) {
        rows.push([
          `WO-${80000 + i}`,
          `${pick(first, i)} ${pick(last, i, 2)}`,
          `${100 + i} ${pick(["Main St", "Copper Ave", "Mesa Dr", "Airport Rd"], i)}`,
          pick(cities, i),
          i % 39 === 0 ? "N.M." : "NM",
          String(87000 + (i % 999)),
          messyPhone(i),
          `${pick(first, i)}.${pick(last, i, 2)}${i}@example.com`,
          messyDate(i),
          i % 7 === 0 ? "" : messyDate(i, 4),
          pick(["repair", "install", "inspection", "warranty", "maintenance"], i),
          i % 47 === 0 ? "unknown" : String(((i * 3) % 16) + 0.5),
          messyMoney(95 + ((i * 37) % 1800), i),
          `${pick(first, i, 8)} ${pick(last, i, 9)}`,
        ]);
      }
      return rows;
    },
  },
  {
    name: "retail-orders-messy-1800.csv",
    expected: {
      "Order #": "id",
      "Order Date": "date",
      "Buyer Name": "name",
      "Buyer Email": "email",
      "Ship Phone": "phone",
      "Ship City": "city",
      "Ship State": "state",
      "Ship Zip": "postal",
      "Product SKU": "id",
      "Product Name": "text",
      "Qty": "number",
      "Order Total": "money",
      "Fulfillment Status": "status",
      "Sales Channel": "source",
    },
    rows() {
      const headers = ["Order #", "Order Date", "Buyer Name", "Buyer Email", "Ship Phone", "Ship City", "Ship State", "Ship Zip", "Product SKU", "Product Name", "Qty", "Order Total", "Fulfillment Status", "Sales Channel"];
      const rows = [["Shop export generated by plugin", "", "", "", "", "", "", "", "", "", "", "", "", ""], headers];
      for (let i = 0; i < 1800; i += 1) {
        if (i && i % 450 === 0) rows.push(["PAGE BREAK", "", "", "", "", "", "", "", "", "", "", "", "", ""]);
        rows.push([
          `SO-${600000 + i}`,
          messyDate(i),
          `${pick(first, i)} ${pick(last, i, 4)}`,
          i % 44 === 0 ? `${pick(first, i)}.${pick(last, i, 4)} at buyer dot com` : `${pick(first, i)}.${pick(last, i, 4)}${i}@buyer.com`,
          messyPhone(i),
          pick(cities, i),
          i % 31 === 0 ? "New Mexico" : "NM",
          String(87000 + (i % 999)),
          `SKU-${String(i % 300).padStart(4, "0")}`,
          pick(["Starter Kit", "Replacement Filter", "Label Bundle", "Premium Cable", "Desk Mat"], i),
          i % 57 === 0 ? "two" : String(1 + (i % 7)),
          messyMoney(18 + ((i * 23) % 1200), i),
          pick(["shipped", "pending", "refunded", "partial", "needs review"], i),
          pick(["Website", "Etsy", "Amazon", "Wholesale", "Phone Order"], i, 3),
        ]);
      }
      return rows;
    },
  },
  {
    name: "property-management-rentroll-messy-1300.csv",
    expected: {
      "Tenant ID": "id",
      "Tenant Name": "name",
      "Tenant Email": "email",
      "Tenant Phone": "phone",
      "Property Address": "text",
      "Unit": "id",
      "City": "city",
      "State": "state",
      "Zip": "postal",
      "Lease Start": "date",
      "Lease End": "date",
      "Monthly Rent": "money",
      "Deposit Balance": "money",
      "Rent Status": "status",
      "Property Manager": "name",
    },
    rows() {
      const headers = ["Tenant ID", "Tenant Name", "Tenant Email", "Tenant Phone", "Property Address", "Unit", "City", "State", "Zip", "Lease Start", "Lease End", "Monthly Rent", "Deposit Balance", "Rent Status", "Property Manager"];
      const rows = [["Rent Roll Export", "", "", "", "", "", "", "", "", "", "", "", "", "", ""], headers];
      for (let i = 0; i < 1300; i += 1) {
        rows.push([
          `TEN-${20000 + i}`,
          `${pick(first, i)} ${pick(last, i, 2)}`,
          `${pick(first, i)}.${pick(last, i, 2)}${i}@tenantmail.com`,
          messyPhone(i),
          `${100 + i} ${pick(["Central Ave", "Lohman Ave", "Bridge Blvd", "Canyon Rd"], i)}`,
          i % 9 === 0 ? `Unit ${i % 80}` : `${i % 80}`,
          pick(cities, i),
          i % 23 === 0 ? "N.M." : "NM",
          String(87000 + (i % 999)),
          messyDate(i),
          messyDate(i, 24),
          messyMoney(650 + ((i * 37) % 2600), i),
          messyMoney((i * 29) % 1800, i + 3),
          pick(["current", "late", "notice sent", "move-out", "payment plan"], i),
          `${pick(first, i, 4)} ${pick(last, i, 5)}`,
        ]);
      }
      return rows;
    },
  },
  {
    name: "survey-responses-messy-1600.csv",
    expected: {
      "Response ID": "id",
      "Submitted At": "date",
      "Respondent Name": "name",
      "Respondent Email": "email",
      "Phone": "phone",
      "Satisfaction Score": "number",
      "NPS": "number",
      "Would Recommend": "status",
      "Product Used": "text",
      "Feedback Category": "status",
      "Follow-up Needed": "status",
      "Comments": "text",
    },
    rows() {
      const headers = ["Response ID", "Submitted At", "Respondent Name", "Respondent Email", "Phone", "Satisfaction Score", "NPS", "Would Recommend", "Product Used", "Feedback Category", "Follow-up Needed", "Comments"];
      const rows = [headers];
      for (let i = 0; i < 1600; i += 1) {
        if (i && i % 320 === 0) rows.push(headers);
        rows.push([
          `RESP-${900000 + i}`,
          messyDate(i),
          `${pick(first, i)} ${pick(last, i, 1)}`,
          i % 53 === 0 ? "" : `${pick(first, i)}.${pick(last, i, 1)}${i}@survey.example`,
          messyPhone(i),
          i % 49 === 0 ? "n/a" : String(1 + (i % 5)),
          i % 61 === 0 ? "unknown" : String(i % 11),
          pick(["yes", "no", "maybe", "Already did"], i),
          pick(["Cleaner", "Report", "Dashboard", "Mobile App"], i),
          pick(["bug", "billing", "feature request", "support", "praise"], i, 2),
          pick(["yes", "NO", "urgent", ""], i, 3),
          i % 45 === 0 ? "Customer wants a call back, do not ignore." : "",
        ]);
      }
      return rows;
    },
  },
  {
    name: "volunteer-signups-messy-850.csv",
    expected: {
      "Volunteer ID": "id",
      "Volunteer Name": "name",
      "Email": "email",
      "Mobile Phone": "phone",
      "Signup Date": "date",
      "Preferred Role": "status",
      "Availability": "text",
      "City": "city",
      "State": "state",
      "Zip": "postal",
      "Background Checked": "status",
      "Hours Pledged": "number",
      "Coordinator": "name",
    },
    rows() {
      const headers = ["Volunteer ID", "Volunteer Name", "Email", "Mobile Phone", "Signup Date", "Preferred Role", "Availability", "City", "State", "Zip", "Background Checked", "Hours Pledged", "Coordinator"];
      const rows = [["Volunteer list - exported from form", "", "", "", "", "", "", "", "", "", "", "", ""], headers];
      for (let i = 0; i < 850; i += 1) {
        rows.push([
          `VOL-${40000 + i}`,
          `${pick(first, i)} ${pick(last, i, 6)}`,
          `${pick(first, i)}.${pick(last, i, 6)}${i}@volunteer.org`,
          messyPhone(i),
          messyDate(i),
          pick(["driver", "check-in", "food prep", "phone bank", "cleanup"], i),
          pick(["weekends", "evenings", "weekday mornings", "flexible"], i, 3),
          pick(cities, i),
          i % 17 === 0 ? "New Mexico" : "NM",
          String(87000 + (i % 999)),
          pick(["yes", "no", "pending", "expired"], i, 2),
          i % 51 === 0 ? "a lot" : String(2 + (i % 30)),
          `${pick(first, i, 7)} ${pick(last, i, 8)}`,
        ]);
      }
      return rows;
    },
  },
  {
    name: "payroll-timesheet-messy-1400.csv",
    expected: {
      "Employee ID": "id",
      "Employee Name": "name",
      "Work Date": "date",
      "Department": "status",
      "Job Code": "id",
      "Regular Hours": "number",
      "Overtime Hours": "number",
      "Hourly Rate": "money",
      "Gross Pay": "money",
      "Approval Status": "status",
      "Supervisor": "name",
      "Notes": "text",
    },
    rows() {
      const headers = ["Employee ID", "Employee Name", "Work Date", "Department", "Job Code", "Regular Hours", "Overtime Hours", "Hourly Rate", "Gross Pay", "Approval Status", "Supervisor", "Notes"];
      const rows = [["Payroll timesheet export", "", "", "", "", "", "", "", "", "", "", ""], headers];
      for (let i = 0; i < 1400; i += 1) {
        const regular = 4 + (i % 9);
        const overtime = i % 6 === 0 ? 2.5 : 0;
        const rate = 14 + (i % 22);
        rows.push([
          `EMP-${1000 + (i % 240)}`,
          `${pick(first, i)} ${pick(last, i, 9)}`,
          messyDate(i),
          pick(["front desk", "sales", "operations", "warehouse", "admin"], i),
          `JOB-${100 + (i % 80)}`,
          i % 44 === 0 ? "missing" : String(regular),
          overtime ? String(overtime) : "",
          messyMoney(rate, i),
          messyMoney((regular + overtime * 1.5) * rate, i + 2),
          pick(["approved", "pending", "rejected", "needs correction"], i),
          `${pick(first, i, 1)} ${pick(last, i, 2)}`,
          i % 100 === 0 ? "manager changed shift after export" : "",
        ]);
      }
      return rows;
    },
  },
  {
    name: "medical-claims-messy-1250.csv",
    expected: {
      "Claim #": "id",
      "Patient ID": "id",
      "Patient Name": "name",
      "DOB": "date",
      "Contact Phone": "phone",
      "Insurance Carrier": "text",
      "Policy #": "id",
      "Service Date": "date",
      "Provider Name": "name",
      "Billed Amount": "money",
      "Allowed Amount": "money",
      "Patient Balance": "money",
      "Claim Status": "status",
      "Denial Reason": "text",
    },
    rows() {
      const headers = ["Claim #", "Patient ID", "Patient Name", "DOB", "Contact Phone", "Insurance Carrier", "Policy #", "Service Date", "Provider Name", "Billed Amount", "Allowed Amount", "Patient Balance", "Claim Status", "Denial Reason"];
      const rows = [["Claims export - verify all PHI before use", "", "", "", "", "", "", "", "", "", "", "", "", ""], ["Report period", "2026", "", "", "", "", "", "", "", "", "", "", "", ""], headers];
      for (let i = 0; i < 1250; i += 1) {
        if (i && i % 300 === 0) rows.push(headers);
        const billed = 90 + ((i * 43) % 2400);
        rows.push([
          `CLM-${700000 + i}`,
          `P-${30000 + (i % 900)}`,
          `${pick(first, i)} ${pick(last, i, 4)}`,
          messyDate(i, -60),
          messyPhone(i),
          pick(["Blue Cross", "United", "Medicaid", "Self Pay", "Aetna"], i),
          `POL-${100000 + i}`,
          messyDate(i),
          `${pick(first, i, 3)} ${pick(last, i, 7)}`,
          messyMoney(billed, i),
          messyMoney(billed * 0.72, i + 1),
          messyMoney(billed * 0.18, i + 2),
          pick(["paid", "pending", "denied", "appeal", "patient due"], i),
          i % 67 === 0 ? "missing prior authorization" : "",
        ]);
      }
      return rows;
    },
  },
  {
    name: "mortgage-loan-pipeline-messy-1000.csv",
    expected: {
      "Loan #": "id",
      "Borrower": "name",
      "Co-Borrower": "name",
      "Email": "email",
      "Mobile": "phone",
      "Loan Stage": "status",
      "Loan Purpose": "status",
      "Property City": "city",
      "Property State": "state",
      "Property Zip": "postal",
      "Loan Amount": "money",
      "Interest Rate": "percent",
      "LTV": "percent",
      "Closing Date": "date",
      "Loan Officer": "name",
    },
    rows() {
      const headers = ["Loan #", "Borrower", "Co-Borrower", "Email", "Mobile", "Loan Stage", "Loan Purpose", "Property City", "Property State", "Property Zip", "Loan Amount", "Interest Rate", "LTV", "Closing Date", "Loan Officer"];
      const rows = [["Mortgage pipeline export", "", "", "", "", "", "", "", "", "", "", "", "", "", ""], headers];
      for (let i = 0; i < 1000; i += 1) {
        rows.push([
          `LN-${2026000 + i}`,
          `${pick(first, i)} ${pick(last, i, 1)}`,
          i % 4 === 0 ? "" : `${pick(first, i, 5)} ${pick(last, i, 8)}`,
          `${pick(first, i)}.${pick(last, i, 1)}${i}@borrower.com`,
          messyPhone(i),
          pick(["lead", "application", "processing", "underwriting", "clear to close", "funded"], i),
          pick(["purchase", "refinance", "cash-out", "investment"], i, 2),
          pick(cities, i),
          i % 31 === 0 ? "N.M." : "NM",
          String(87000 + (i % 999)),
          messyMoney(150000 + ((i * 739) % 550000), i),
          i % 42 === 0 ? "floating" : `${(5 + (i % 4) + (i % 10) / 10).toFixed(2)}%`,
          i % 51 === 0 ? "" : `${65 + (i % 30)}%`,
          messyDate(i, 20),
          `${pick(first, i, 3)} ${pick(last, i, 4)}`,
        ]);
      }
      return rows;
    },
  },
  {
    name: "support-tickets-messy-1700.csv",
    expected: {
      "Ticket #": "id",
      "Created At": "date",
      "Customer": "name",
      "Customer Email": "email",
      "Customer Phone": "phone",
      "Issue Category": "status",
      "Priority": "status",
      "Ticket Status": "status",
      "Assigned To": "name",
      "SLA Hours": "number",
      "Resolution Date": "date",
      "Refund Amount": "money",
      "Internal Notes": "text",
    },
    rows() {
      const headers = ["Ticket #", "Created At", "Customer", "Customer Email", "Customer Phone", "Issue Category", "Priority", "Ticket Status", "Assigned To", "SLA Hours", "Resolution Date", "Refund Amount", "Internal Notes"];
      const rows = [["Ticket system export", "", "", "", "", "", "", "", "", "", "", "", ""], headers];
      for (let i = 0; i < 1700; i += 1) {
        if (i && i % 425 === 0) rows.push(["Subtotal for page", "", "", "", "", "", "", "", "", "", "", "", ""]);
        rows.push([
          `TCK-${800000 + i}`,
          messyDate(i),
          `${pick(first, i)} ${pick(last, i, 2)}`,
          `${pick(first, i)}.${pick(last, i, 2)}${i}@customer.com`,
          messyPhone(i),
          pick(["billing", "bug", "account access", "data issue", "feature request"], i),
          pick(["low", "medium", "high", "urgent"], i, 3),
          pick(["open", "waiting", "solved", "closed", "escalated"], i, 4),
          `${pick(first, i, 5)} ${pick(last, i, 6)}`,
          i % 49 === 0 ? "unknown" : String(4 + (i % 72)),
          i % 5 === 0 ? "" : messyDate(i, 3),
          i % 8 === 0 ? messyMoney((i * 13) % 350, i) : "",
          i % 80 === 0 ? "customer attached screenshot and asked for manager" : "",
        ]);
      }
      return rows;
    },
  },
  {
    name: "hotel-reservations-messy-900.csv",
    expected: {
      "Confirmation Code": "id",
      "Guest Name": "name",
      "Guest Email": "email",
      "Guest Phone": "phone",
      "Arrival": "date",
      "Departure": "date",
      "Room Type": "status",
      "Nights": "number",
      "Nightly Rate": "money",
      "Taxes": "money",
      "Total": "money",
      "Booking Source": "source",
      "Reservation Status": "status",
      "Special Requests": "text",
    },
    rows() {
      const headers = ["Confirmation Code", "Guest Name", "Guest Email", "Guest Phone", "Arrival", "Departure", "Room Type", "Nights", "Nightly Rate", "Taxes", "Total", "Booking Source", "Reservation Status", "Special Requests"];
      const rows = [["Hotel PMS Export", "", "", "", "", "", "", "", "", "", "", "", "", ""], ["Generated", new Date().toISOString(), "", "", "", "", "", "", "", "", "", "", "", ""], headers];
      for (let i = 0; i < 900; i += 1) {
        const nights = 1 + (i % 8);
        const rate = 79 + ((i * 11) % 320);
        rows.push([
          `CNF${500000 + i}`,
          `${pick(first, i)} ${pick(last, i, 3)}`,
          `${pick(first, i)}.${pick(last, i, 3)}${i}@guestmail.com`,
          messyPhone(i),
          messyDate(i),
          messyDate(i, nights),
          pick(["king", "double queen", "suite", "accessible", "pet friendly"], i),
          i % 58 === 0 ? "several" : String(nights),
          messyMoney(rate, i),
          messyMoney(rate * nights * 0.08, i + 4),
          messyMoney(rate * nights * 1.08, i + 5),
          pick(["Website", "Expedia", "Booking.com", "Walk-in", "Phone"], i, 2),
          pick(["confirmed", "checked in", "cancelled", "no show", "checked out"], i, 3),
          i % 44 === 0 ? "late arrival, extra towels" : "",
        ]);
      }
      return rows;
    },
  },
  {
    name: "service-invoices-hash-fields-messy-1100.csv",
    expected: {
      "Invoice #": "id",
      "Account #": "id",
      "Client": "name",
      "Client Contact": "name",
      "Contact Email": "email",
      "Contact Phone": "phone",
      "Service Type": "status",
      "Invoice Status": "status",
      "Service Date": "date",
      "Technician": "name",
      "Labor Hrs": "number",
      "Parts Cost": "money",
      "Amount Owed": "money",
      "Due By": "date",
    },
    rows() {
      const headers = ["Invoice #", "Account #", "Client", "Client Contact", "Contact Email", "Contact Phone", "Service Type", "Invoice Status", "Service Date", "Technician", "Labor Hrs", "Parts Cost", "Amount Owed", "Due By"];
      const rows = [["Service invoice detail export", "", "", "", "", "", "", "", "", "", "", "", "", ""], headers];
      for (let i = 0; i < 1100; i += 1) {
        const parts = 25 + ((i * 17) % 950);
        const labor = ((i * 3) % 10) + 0.5;
        rows.push([
          `SI-${910000 + i}`,
          `ACCT-${4000 + (i % 500)}`,
          pick(["Mesa Plumbing", "Rio HVAC", "Desert Electric", "High Road Realty", "North Shop"], i),
          `${pick(first, i, 6)} ${pick(last, i, 7)}`,
          `${pick(first, i, 6)}.${pick(last, i, 7)}${i}@clientco.com`,
          messyPhone(i),
          pick(["repair", "maintenance", "installation", "warranty", "inspection"], i),
          pick(["open", "paid", "past due", "partial", "void"], i, 2),
          messyDate(i),
          `${pick(first, i, 8)} ${pick(last, i, 9)}`,
          i % 43 === 0 ? "unknown" : String(labor),
          messyMoney(parts, i),
          messyMoney(parts + labor * 85, i + 1),
          messyDate(i, 12),
        ]);
      }
      return rows;
    },
  },
  {
    name: "messy-pipe-crm-export-600.txt",
    delimiter: "|",
    expected: {
      "Contact ID": "id",
      "Full Name": "name",
      "Primary Email": "email",
      "Cell Phone": "phone",
      "Lead Status": "status",
      "Lead Source": "source",
      "Budget": "money",
      "Close Probability": "percent",
      "Next Step Date": "date",
      "Owner": "text",
      "Notes": "text",
    },
    expectedCleanHeaders: ["Contact ID", "Full Name", "Primary Email", "Cell Phone", "Lead Status", "Lead Source", "Budget", "Close Probability", "Next Step Date", "Owner", "Notes"],
    mustContain: ["CRM-10000", "Ana Vigil", "Website"],
    mustNotContain: ["Generated by legacy CRM", "Do not import"],
    rows() {
      const rows = [
        ["Generated by legacy CRM", "", "", "", "", "", "", "", "", "", ""],
        ["Do not import", "Report metadata only", "", "", "", "", "", "", "", "", ""],
        ["Contact ID", "Full Name", "Primary Email", "Cell Phone", "Lead Status", "Lead Source", "Budget", "Close Probability", "Next Step Date", "Owner", "Notes"],
      ];
      for (let i = 0; i < 600; i += 1) {
        if (i && i % 175 === 0) rows.push(["SECTION", "West leads", "", "", "", "", "", "", "", "", ""]);
        rows.push([
          `CRM-${10000 + i}`,
          `${pick(first, i)} ${pick(last, i, 4)}`,
          `${pick(first, i)}.${pick(last, i, 4)}${i}@leadmail.com`,
          messyPhone(i),
          pick(["new", "qualified", "nurture", "lost", "won"], i),
          pick(["Website", "Referral", "Open House", "Phone", "Paid Search"], i, 2),
          messyMoney(5000 + ((i * 97) % 90000), i),
          i % 47 === 0 ? "maybe" : `${10 + (i % 90)}%`,
          messyDate(i, 10),
          pick(["sales desk", "inside team", "broker desk"], i),
          i % 68 === 0 ? "asked for callback, verify manually" : "",
        ]);
      }
      return rows;
    },
  },
  {
    name: "county-permit-applications-messy-750.csv",
    expected: {
      "Permit No": "id",
      "Applicant": "name",
      "Applicant Email": "email",
      "Applicant Phone": "phone",
      "Parcel": "id",
      "Permit Type": "status",
      "Application Date": "date",
      "Fee Paid": "money",
      "Review Status": "status",
      "Inspector": "name",
      "Inspection Date": "date",
      "Site Address": "text",
      "City": "city",
      "Zip": "postal",
    },
    expectedCleanHeaders: ["Permit No", "Applicant", "Parcel", "Permit Type", "Review Status"],
    mustNotContain: ["County permit system export", "Rows in source tab"],
    rows() {
      const headers = ["Permit No", "Applicant", "Applicant Email", "Applicant Phone", "Parcel", "Permit Type", "Application Date", "Fee Paid", "Review Status", "Inspector", "Inspection Date", "Site Address", "City", "Zip"];
      const rows = [["County permit system export", "", "", "", "", "", "", "", "", "", "", "", "", ""], ["Rows in source tab", "750", "", "", "", "", "", "", "", "", "", "", "", ""], headers];
      for (let i = 0; i < 750; i += 1) {
        rows.push([
          `PMT-${50000 + i}`,
          `${pick(first, i)} ${pick(last, i, 5)}`,
          `${pick(first, i)}.${pick(last, i, 5)}${i}@permitmail.gov`,
          messyPhone(i),
          `PAR-${30 + (i % 70)}-${1000 + i}`,
          pick(["building", "electrical", "plumbing", "roof", "solar"], i),
          messyDate(i),
          messyMoney(55 + ((i * 23) % 2400), i),
          pick(["submitted", "under review", "approved", "rejected", "needs info"], i, 2),
          `${pick(first, i, 7)} ${pick(last, i, 8)}`,
          i % 6 === 0 ? "" : messyDate(i, 8),
          `${100 + i} ${pick(["Main St", "Canyon Rd", "Bridge Blvd", "Mesa Verde Ln"], i)}`,
          pick(cities, i),
          String(87000 + (i % 999)),
        ]);
      }
      return rows;
    },
  },
  {
    name: "fleet-maintenance-messy-950.csv",
    expected: {
      "Vehicle VIN": "id",
      "Unit Number": "id",
      "Plate": "id",
      "Driver Name": "name",
      "Driver Phone": "phone",
      "Service Date": "date",
      "Odometer": "number",
      "Service Category": "status",
      "Vendor": "text",
      "Invoice Total": "money",
      "Warranty Claim": "status",
      "Next Service Due": "date",
      "Fleet Manager": "name",
    },
    rows() {
      const headers = ["Vehicle VIN", "Unit Number", "Plate", "Driver Name", "Driver Phone", "Service Date", "Odometer", "Service Category", "Vendor", "Invoice Total", "Warranty Claim", "Next Service Due", "Fleet Manager"];
      const rows = [["Fleet maintenance export", "", "", "", "", "", "", "", "", "", "", "", ""], headers];
      for (let i = 0; i < 950; i += 1) {
        rows.push([
          `1HGCM82633A${String(100000 + i).slice(-6)}`,
          `UNIT-${100 + (i % 120)}`,
          `NM-${2000 + (i % 800)}`,
          `${pick(first, i)} ${pick(last, i, 3)}`,
          messyPhone(i),
          messyDate(i),
          i % 55 === 0 ? "unknown" : String(15000 + ((i * 811) % 180000)),
          pick(["oil change", "tires", "brakes", "inspection", "repair"], i),
          pick(["Quick Lube", "FleetPro", "Dealer Service", "Local Garage"], i, 2),
          messyMoney(49 + ((i * 31) % 3600), i),
          pick(["yes", "no", "pending", ""], i, 3),
          messyDate(i, 90),
          `${pick(first, i, 5)} ${pick(last, i, 6)}`,
        ]);
      }
      return rows;
    },
  },
  {
    name: "multi-sheet-sales-leads-messy-500.xlsx",
    format: "xlsx",
    expected: {
      "Lead ID": "id",
      "Prospect Name": "name",
      "Prospect Email": "email",
      "Mobile Phone": "phone",
      "Company": "text",
      "Lead Stage": "status",
      "Deal Value": "money",
      "Probability": "percent",
      "Expected Close Date": "date",
      "Sales Rep": "name",
      "Lead Source": "source",
      "Notes": "text",
    },
    expectedCleanHeaders: ["Lead ID", "Prospect Name", "Prospect Email", "Mobile Phone", "Company", "Lead Stage", "Deal Value", "Probability", "Expected Close Date", "Sales Rep", "Lead Source", "Notes"],
    mustContain: ["XL-LEAD-1000", "Ana Nguyen", "Trade Show"],
    mustNotContain: ["Instructions", "metadata-only"],
    sheets() {
      const metadata = [
        ["Instructions"],
        ["metadata-only workbook cover sheet"],
        ["The useful table is on the next worksheet"],
      ];
      const headers = ["Lead ID", "Prospect Name", "Prospect Email", "Mobile Phone", "Company", "Lead Stage", "Deal Value", "Probability", "Expected Close Date", "Sales Rep", "Lead Source", "Notes"];
      const data = [["Sales lead export", "", "", "", "", "", "", "", "", "", "", ""], headers];
      for (let i = 0; i < 500; i += 1) {
        if (i && i % 125 === 0) data.push(headers);
        data.push([
          `XL-LEAD-${1000 + i}`,
          `${pick(first, i)} ${pick(last, i, 4)}`,
          `${pick(first, i)}.${pick(last, i, 4)}${i}@prospect.com`,
          messyPhone(i),
          pick(["Mesa Labs", "Rio Works", "North Shop", "Desert Co", "High Road"], i),
          pick(["new", "qualified", "proposal", "negotiation", "closed"], i),
          messyMoney(1000 + ((i * 211) % 120000), i),
          i % 39 === 0 ? "not sure" : `${5 + (i % 90)}%`,
          messyDate(i, 18),
          `${pick(first, i, 2)} ${pick(last, i, 3)}`,
          pick(["Website", "Referral", "Trade Show", "Partner", "Outbound"], i, 2),
          i % 77 === 0 ? "asked for follow-up next month" : "",
        ]);
      }
      return [
        { name: "Read Me", rows: metadata },
        { name: "Raw Leads", rows: data },
      ];
    },
  },
];

(async () => {
  const files = await Promise.all(scenarios.map(async (scenario) => {
    const filePath = scenario.format === "xlsx"
      ? await writeXlsx(scenario.name, scenario.sheets())
      : writeCsv(scenario.name, scenario.rows(), scenario.delimiter || ",");
    return {
      name: scenario.name,
      path: filePath,
      bytes: fs.statSync(filePath).size,
      expected: scenario.expected,
      expectedCleanHeaders: scenario.expectedCleanHeaders,
      mustContain: scenario.mustContain,
      mustNotContain: scenario.mustNotContain,
    };
  }));

  const manifestPath = path.join(outputDir, "challenge-manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify({ generatedAt: new Date().toISOString(), files }, null, 2), "utf8");

  console.log(JSON.stringify({ outputDir, manifestPath, files: files.map(({ name, path, bytes }) => ({ name, path, bytes })) }, null, 2));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

const fs = require("fs");
const path = require("path");

const outputDir = "C:/Users/prple/OneDrive/Documents/New project/outputs/data-cleaning-samples";

const headers = [
  "Lead ID",
  "Import Batch",
  "Source",
  "Lead Status",
  "Client Name",
  "Spouse / Co-Buyer",
  "Email",
  "Primary Phone",
  "Secondary Phone",
  "Preferred Contact",
  "Street Address",
  "Unit",
  "City",
  "State",
  "Zip",
  "County",
  "Neighborhood",
  "MLS #",
  "Property Type",
  "Beds",
  "Baths",
  "Sq Ft",
  "Lot Size",
  "Year Built",
  "List Price",
  "Estimated Value",
  "Mortgage Balance",
  "HOA",
  "Taxes",
  "Insurance",
  "Client Goal",
  "Timeline",
  "Loan Status",
  "Preapproval Amount",
  "Agent",
  "Agent Phone",
  "Last Contacted",
  "Next Follow Up",
  "Showing Date",
  "Offer Deadline",
  "Tags",
  "Raw Notes",
  "CRM Owner",
  "Duplicate Hint",
];

const firstNames = ["Maria", "Jose", "Ana", "Daniel", "Sofia", "Ramon", "Leah", "Isaac", "Nora", "Luis", "Carla", "Elena", "Julian", "Veronica", "Marta", "Sam", "Tanya", "Marcus", "Priya", "Devon"];
const lastNames = ["Garcia", "Martinez", "Trujillo", "Chavez", "Padilla", "Montoya", "Benitez", "Ortega", "Reed", "Lopez", "Sanchez", "Herrera", "Nunez", "O'Connor", "Lee", "Nguyen", "Vigil", "Romero", "Baca", "Singh"];
const cities = ["Albuquerque", "Santa Fe", "Rio Rancho", "Las Cruces", "Taos", "Farmington", "Roswell", "Hobbs", "Clovis", "Gallup", "Los Lunas", "Edgewood", "Truth or Consequences", "Silver City"];
const counties = ["Bernalillo", "Santa Fe", "Sandoval", "Dona Ana", "Taos", "San Juan", "Chaves", "Lea", "Curry", "McKinley", "Valencia", "Santa Fe", "Sierra", "Grant"];
const streets = ["Central Ave", "Unser Blvd", "Paseo Del Norte", "Canyon Rd", "Lohman Ave", "Main St", "Copper Ave", "Yucca Dr", "Mesa Verde Ln", "Camino Real", "Bosque Loop", "Adobe Vista Dr", "Airport Rd", "Bridge Blvd"];
const sources = ["Zillow", "Realtor.com", "Open House", "Facebook Lead Ad", "Google PPC", "Referral", "Past Client", "Yard Sign", "Website Form", "Imported CRM", "Phone log", "Walk-in sheet"];
const statuses = ["new", "HOT", "follow_up", "NURTURE", "cold", "UNDER CONTRACT", "closed", "lost", "", "needs review", "do not call?", "duplicate maybe"];
const propertyTypes = ["Single Family", "Condo", "Townhome", "Multi-family", "Land", "Manufactured", "Luxury", "Investment", "SFH?", "unknown"];
const goals = ["Buy", "Sell", "Buy/Sell", "Invest", "Relocate", "Refi question", "Rent first", "", "not sure"];
const timelines = ["ASAP", "0-30 days", "1-3 months", "3-6 months", "6-12 months", "Next year", "Just browsing", "", "after school year"];
const agents = ["Jamie Torres", "Pat Morgan", "Chris Silva", "Avery Lopez", "Morgan Reed", "Taylor Kim", "Jordan Martinez", "Casey Rivera", "Unassigned"];
const owners = ["imports@brokerage.local", "frontdesk", "agent upload", "old crm", "spreadsheet merge", "assistant"];

function pick(list, i, salt = 0) {
  return list[(i * 17 + salt * 11) % list.length];
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(filePath, rows) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, rows.map((row) => row.map(csvEscape).join(",")).join("\r\n"), "utf8");
}

function messyPhone(i, salt = 0) {
  const mid = String(200 + ((i * 23 + salt) % 760)).padStart(3, "0");
  const end = String(1000 + ((i * 41 + salt) % 9000)).padStart(4, "0");
  if (i % 71 === 0) return "call spouse";
  if (i % 53 === 0) return "555";
  if (i % 31 === 0) return "";
  if (i % 19 === 0) return `+1 505 ${mid} ${end}`;
  if (i % 11 === 0) return `1-505-${mid}-${end}`;
  if (i % 5 === 0) return `505${mid}${end}`;
  if (i % 3 === 0) return `(505)${mid}-${end}`;
  return `(505) ${mid}-${end}`;
}

function messyMoney(value, i) {
  const whole = Math.round(value);
  if (i % 89 === 0) return "seller says high";
  if (i % 61 === 0) return "TBD";
  if (i % 43 === 0) return "";
  if (i % 29 === 0) return `${whole.toLocaleString("en-US")} approx`;
  if (i % 23 === 0) return `USD ${whole.toLocaleString("en-US")}`;
  if (i % 17 === 0) return `$ ${whole.toLocaleString("en-US")}`;
  if (i % 13 === 0) return `$${whole.toLocaleString("en-US")}.00`;
  if (i % 7 === 0) return `${whole}`;
  return value.toFixed(2);
}

function messyDate(i, offset = 0) {
  if (i % 97 === 0) return "before closing";
  if (i % 79 === 0) return "next Friday";
  if (i % 59 === 0) return "not sure";
  if (i % 37 === 0) return "";
  const month = ((i + offset) % 12) + 1;
  const day = ((i * 5 + offset) % 28) + 1;
  const year = 2024 + ((i + offset) % 4);
  if (i % 23 === 0) return `${year}.${month}.${day}`;
  if (i % 17 === 0) return `${month}-${day}-${String(year).slice(2)}`;
  if (i % 11 === 0) return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  if (i % 9 === 0) return `${month}/${day}/${String(year).slice(2)}`;
  return `${month}/${day}/${year}`;
}

function messyNumber(value, i, options = {}) {
  if (i % 83 === 0) return "unknown";
  if (i % 67 === 0) return "??";
  if (i % 41 === 0) return "";
  if (options.sqft && i % 13 === 0) return `${value.toLocaleString("en-US")} sq ft`;
  if (options.acres && i % 17 === 0) return `${value} acres`;
  if (i % 7 === 0) return ` ${value} `;
  return String(value);
}

function clientName(first, last, i) {
  if (i % 47 === 0) return `${last}, ${first}`;
  if (i % 31 === 0) return `${first.toUpperCase()}   ${last.toUpperCase()}`;
  if (i % 23 === 0) return `${first} & ${pick(firstNames, i, 9)} ${last}`;
  if (i % 19 === 0) return ` ${first}  ${last} `;
  return `${first} ${last}`;
}

function email(first, last, i) {
  if (i % 73 === 0) return `missing email, call ${messyPhone(i, 3)}`;
  if (i % 61 === 0) return "";
  if (i % 43 === 0) return `${first}.${last}${i}@`;
  if (i % 37 === 0) return `${first}.${last}${i} at example dot com`;
  if (i % 17 === 0) return `${first}.${last}${i}@example.con`;
  if (i % 13 === 0) return `${first}_${last}${i}@GMAIL.COM `;
  return `${first}.${last}${i}@Example.COM`;
}

function baseDataRow(i) {
  const first = pick(firstNames, i, 1);
  const last = pick(lastNames, i, 2);
  const city = pick(cities, i, 3);
  const cityIndex = cities.indexOf(city);
  const price = 155000 + ((i * 9941) % 1250000);
  const duplicateRoot = i > 0 && i % 149 === 0 ? i - 1 : i;
  const leadId = i % 401 === 0 ? "" : `RL-${String(duplicateRoot + 1000000).slice(-7)}`;
  const streetNo = 100 + ((i * 47) % 9800);
  const notes = [
    i % 29 === 0 ? "copied from showing sheet; budget and lender notes are in same cell" : "lead form import",
    i % 41 === 0 ? "CALL AFTER 6PM, spouse has different email" : "",
    i % 53 === 0 ? "duplicate? same address as another buyer, but different phone" : "",
    i % 67 === 0 ? "Seller mentioned roof, solar payoff, HOA, and unpaid tax question" : "",
  ].filter(Boolean).join(" | ");

  const row = [
    leadId,
    i % 997 === 0 ? "BATCH TOTALS BELOW" : `batch-${2024 + (i % 3)}-${String((i % 12) + 1).padStart(2, "0")}`,
    pick(sources, i, 4),
    pick(statuses, i, 5),
    clientName(first, last, i),
    i % 16 === 0 ? `${pick(firstNames, i, 8)} ${last}` : "",
    email(first, last, i),
    messyPhone(i, 12),
    messyPhone(i, 88),
    i % 6 === 0 ? "text" : i % 5 === 0 ? "email" : i % 4 === 0 ? "phone" : "",
    `${streetNo} ${pick(streets, i, 6)}`,
    i % 9 === 0 ? `Unit ${1 + (i % 44)}` : i % 14 === 0 ? "back house" : "",
    i % 18 === 0 ? city.toUpperCase() : city,
    i % 97 === 0 ? "Texas?" : i % 46 === 0 ? "??" : i % 31 === 0 ? "N.M." : i % 17 === 0 ? "New Mexico" : "NM",
    i % 71 === 0 ? "871xx" : i % 53 === 0 ? "" : String(87000 + ((i * 19) % 999)).padStart(5, "0"),
    counties[cityIndex] || "Bernalillo",
    i % 28 === 0 ? "" : `${pick(["Nob Hill", "North Valley", "Eldorado", "Mesilla", "Placitas", "Westside", "Downtown", "Foothills"], i, 4)}`,
    i % 39 === 0 ? "MLS pending" : `MLS${202500000 + i}`,
    pick(propertyTypes, i, 7),
    messyNumber(1 + (i % 7), i),
    messyNumber((1 + ((i * 2) % 6) * 0.5).toFixed(1), i + 5),
    messyNumber(650 + ((i * 89) % 6100), i + 11, { sqft: true }),
    messyNumber((0.04 + ((i * 7) % 420) / 100).toFixed(2), i + 17, { acres: true }),
    i % 101 === 0 ? "19??" : i % 67 === 0 ? "" : String(1935 + (i % 91)),
    messyMoney(price, i),
    messyMoney(price * (0.9 + (i % 25) / 100), i + 9),
    messyMoney(price * (0.25 + (i % 44) / 100), i + 13),
    i % 3 === 0 ? "" : messyMoney(70 + (i % 530), i + 21),
    messyMoney(850 + (i % 4900), i + 29),
    messyMoney(600 + (i % 2500), i + 33),
    pick(goals, i, 8),
    pick(timelines, i, 9),
    i % 22 === 0 ? "cash maybe" : i % 19 === 0 ? "needs lender" : i % 11 === 0 ? "preapproved" : "",
    messyMoney(price * 0.82, i + 41),
    pick(agents, i, 10),
    messyPhone(i, 144),
    messyDate(i, 3),
    messyDate(i, 9),
    messyDate(i, 15),
    messyDate(i, 21),
    i % 10 === 0 ? "vip;investor;spanish" : i % 7 === 0 ? "seller lead, urgent" : "",
    i % 113 === 0 ? `${notes}\nSecond line pasted from CRM: "wants comps, schools, repairs"` : notes,
    pick(owners, i, 11),
    i % 149 === 0 ? "possible duplicate of previous row" : "",
  ];

  if (i % 223 === 0) {
    const emailIndex = headers.indexOf("Email");
    const phoneIndex = headers.indexOf("Primary Phone");
    [row[emailIndex], row[phoneIndex]] = [row[phoneIndex], row[emailIndex]];
  }
  if (i % 337 === 0) {
    const priceIndex = headers.indexOf("List Price");
    const dateIndex = headers.indexOf("Last Contacted");
    [row[priceIndex], row[dateIndex]] = [row[dateIndex], row[priceIndex]];
  }

  return row;
}

function sectionRow(label) {
  return [label, "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""];
}

function makeChaosTable(rowCount) {
  const rows = [
    sectionRow("EXPORT: broker CRM + open house sheets + copied phone notes"),
    sectionRow(`GENERATED: ${new Date().toISOString()}`),
    headers,
  ];

  for (let i = 0; i < rowCount; i += 1) {
    if (i > 0 && i % 1200 === 0) rows.push(sectionRow(`--- REGION BREAK ${i / 1200}: ${pick(cities, i, 2)} office export ---`));
    if (i > 0 && i % 777 === 0) rows.push(headers);
    if (i > 0 && i % 631 === 0) rows.push(sectionRow(`NOTE: ${pick(agents, i, 7)} uploaded a partial duplicate block below`));
    if (i % 389 === 0) rows.push(headers.map(() => ""));

    const row = baseDataRow(i);
    rows.push(row);
    if (i > 0 && i % 149 === 0) rows.push(row.slice());
    if (i > 0 && i % 997 === 0) {
      rows.push(sectionRow(`SUBTOTAL ${i}: do not import this row`));
      rows.push(sectionRow(`Rows in source tab: ${i + 1}`));
    }
  }

  rows.push(sectionRow("END OF EXPORT"));
  rows.push(sectionRow("Generated from three copied sheets; rows below are old notes"));
  rows.push(sectionRow("old tab: buyers March - do not import"));
  return rows;
}

function makeLooseDump(rowCount) {
  const dumpHeaders = ["Field A", "Field B", "Field C", "Field D", "Field E", "Field F", "Field G", "Field H", "Field I", "Field J", "Field K", "Field L"];
  const rows = [
    ["RAW REALTOR LEAD DUMP - not a clean table", "", "", "", "", "", "", "", "", "", "", ""],
    ["This is what a copied CRM/export/email dump can look like", "", "", "", "", "", "", "", "", "", "", ""],
    dumpHeaders,
  ];

  for (let i = 0; i < rowCount; i += 1) {
    const full = baseDataRow(i);
    if (i % 101 === 0) rows.push(["----- pasted section -----", pick(sources, i, 4), pick(agents, i, 7), "", "", "", "", "", "", "", "", ""]);
    if (i % 211 === 0) rows.push(dumpHeaders);
    rows.push([
      full[0],
      full[4],
      `phone: ${full[7]} / email: ${full[6]}`,
      `${full[10]} ${full[11]}, ${full[12]} ${full[13]} ${full[14]}`,
      `Beds ${full[19]} Baths ${full[20]} SqFt ${full[21]}`,
      `Price ${full[24]} Est ${full[25]} Mortgage ${full[26]}`,
      `Dates: last ${full[36]} next ${full[37]} showing ${full[38]}`,
      full[30],
      full[34],
      full[40],
      full[41],
      full[43],
    ]);
    if (i % 157 === 0) rows.push(["NOTE ONLY", full[41], "", "", "", "", "", "", "", "", "", ""]);
  }
  return rows;
}

fs.mkdirSync(outputDir, { recursive: true });

const chaosPath = path.join(outputDir, "realtor-leads-chaotic-raw-50000.csv");
const dumpPath = path.join(outputDir, "realtor-leads-loose-crm-dump-12000.csv");

writeCsv(chaosPath, makeChaosTable(50000));
writeCsv(dumpPath, makeLooseDump(12000));

const result = {
  files: [
    {
      path: chaosPath,
      rowsIncludingHeaderAndNoise: fs.readFileSync(chaosPath, "utf8").split(/\r?\n/).length,
      bytes: fs.statSync(chaosPath).size,
      columns: headers.length,
    },
    {
      path: dumpPath,
      rowsIncludingHeaderAndNoise: fs.readFileSync(dumpPath, "utf8").split(/\r?\n/).length,
      bytes: fs.statSync(dumpPath).size,
      columns: 12,
    },
  ],
};

console.log(JSON.stringify(result, null, 2));

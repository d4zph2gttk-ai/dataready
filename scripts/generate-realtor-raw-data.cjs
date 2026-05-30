const fs = require("fs");
const path = require("path");

const outputDir = "C:/Users/prple/OneDrive/Documents/New project/outputs/data-cleaning-samples";
const outputPath = path.join(outputDir, "realtor-leads-property-raw-25000.csv");
const rowCount = 25000;

const headers = [
  "lead id",
  "date_added",
  "lead_source",
  "lead status",
  "agent name",
  "agent phone",
  "brokerage",
  "contact first name",
  "contact last name",
  "email address",
  "primary phone",
  "alt_phone",
  "property street",
  "unit",
  "city",
  "state",
  "zip / postal",
  "county",
  "mls number",
  "property type",
  "beds",
  "baths",
  "sq ft",
  "lot acres",
  "year built",
  "list price",
  "estimated value",
  "mortgage balance",
  "hoa monthly",
  "property status",
  "client goal",
  "timeline",
  "last contacted",
  "next follow up",
  "showing date",
  "offer deadline",
  "commission %",
  "preferred lender",
  "preapproval amount",
  "notes / raw crm text",
];

const firstNames = ["Maria", "Jose", "Ana", "Daniel", "Sofia", "Ramon", "Leah", "Isaac", "Nora", "Luis", "Carla", "Elena", "Julian", "Veronica", "Marta", "Sam"];
const lastNames = ["Garcia", "Martinez", "Trujillo", "Chavez", "Padilla", "Montoya", "Benitez", "Ortega", "Reed", "Lopez", "Sanchez", "Herrera", "Nunez", "O'Connor", "Lee", "Nguyen"];
const agents = ["Jamie Torres", "Pat Morgan", "Chris Silva", "Avery Lopez", "Morgan Reed", "Taylor Kim", "Jordan Martinez", "Casey Rivera"];
const brokerages = ["Mesa Vista Realty", "High Desert Homes", "Rio Grande Properties", "Sunstone Realty Group", "Blue Adobe Realty", "ABQ Premier Homes"];
const cities = ["Albuquerque", "Santa Fe", "Rio Rancho", "Las Cruces", "Taos", "Farmington", "Roswell", "Hobbs", "Clovis", "Gallup", "Los Lunas", "Edgewood"];
const counties = ["Bernalillo", "Santa Fe", "Sandoval", "Dona Ana", "Taos", "San Juan", "Chaves", "Lea", "Curry", "McKinley", "Valencia", "Santa Fe"];
const streets = ["Central Ave", "Unser Blvd", "Paseo Del Norte", "Canyon Rd", "Lohman Ave", "Main St", "Copper Ave", "Yucca Dr", "Mesa Verde Ln", "Camino Real", "Bosque Loop", "Adobe Vista Dr"];
const sources = ["Zillow", "Realtor.com", "Open House", "Facebook Lead Ad", "Google PPC", "Referral", "Past Client", "Yard Sign", "Website Form", "Imported CRM"];
const statuses = ["new", "HOT LEAD", "follow_up", "nurture", "cold", "UNDER CONTRACT", "closed", "lost", "", "needs review"];
const propertyTypes = ["Single Family", "Condo", "Townhome", "Multi-family", "Land", "Manufactured", "Luxury", "Investment"];
const propertyStatuses = ["Active", "Pending", "Coming Soon", "Sold", "Expired", "Withdrawn", "Off Market", "Pre-Foreclosure", "Unknown", ""];
const goals = ["Buy", "Sell", "Buy and Sell", "Invest", "Relocate", "Refinance Question", "Rent First", ""];
const timelines = ["ASAP", "0-30 days", "1-3 months", "3-6 months", "6-12 months", "Next year", "Just browsing", ""];
const lenders = ["Desert Bank", "First NM Credit Union", "Rocket Mortgage", "Local Lender TBD", "Cash Buyer", "", "needs lender"];

function pick(list, index, salt = 0) {
  return list[(index * 17 + salt * 7) % list.length];
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function maybeBlank(value, index, every) {
  return index % every === 0 ? "" : value;
}

function messyMoney(value, index) {
  if (index % 41 === 0) return "TBD";
  if (index % 29 === 0) return "";
  if (index % 17 === 0) return `USD ${Math.round(value).toLocaleString("en-US")}`;
  if (index % 11 === 0) return `$${Math.round(value).toLocaleString("en-US")}`;
  if (index % 7 === 0) return `${Math.round(value)}`;
  return value.toFixed(2);
}

function messyDate(index, offset = 0) {
  if (index % 53 === 0) return "not sure";
  if (index % 31 === 0) return "";
  const month = ((index + offset) % 12) + 1;
  const day = ((index * 3 + offset) % 28) + 1;
  const year = 2024 + ((index + offset) % 3);
  if (index % 13 === 0) return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  if (index % 9 === 0) return `${month}/${day}/${String(year).slice(-2)}`;
  return `${month}/${day}/${year}`;
}

function messyPhone(index, salt = 0) {
  const middle = String(200 + ((index * 13 + salt) % 700)).padStart(3, "0");
  const last = String(1000 + ((index * 19 + salt) % 9000)).padStart(4, "0");
  if (index % 37 === 0) return "555";
  if (index % 19 === 0) return "";
  if (index % 11 === 0) return `1-505-${middle}-${last}`;
  if (index % 5 === 0) return `505${middle}${last}`;
  return `(505) ${middle}-${last}`;
}

function buildRow(i) {
  const first = pick(firstNames, i, 1);
  const last = pick(lastNames, i, 2);
  const city = pick(cities, i, 3);
  const cityIndex = cities.indexOf(city);
  const source = pick(sources, i, 4);
  const agent = pick(agents, i, 5);
  const basePrice = 145000 + ((i * 9371) % 980000);
  const beds = i % 23 === 0 ? "" : (1 + (i % 6));
  const baths = i % 29 === 0 ? "??" : (1 + ((i * 2) % 5) * 0.5).toFixed(1);
  const sqft = i % 31 === 0 ? "unknown" : String(650 + ((i * 71) % 4600));
  const duplicateId = i > 0 && i % 101 === 0 ? i - 1 : i;
  const leadId = `RE-${String(duplicateId + 100000).padStart(7, "0")}`;
  const email = i % 43 === 0 ? `bad-email-${i}` : i % 17 === 0 ? `${first}.${last}${i}@example.con` : `${first}.${last}${i}@Example.COM`;
  const streetNo = 100 + ((i * 29) % 9800);
  const notes = i % 67 === 0
    ? "Imported from CRM\nLead said: \"call after 5\", spouse may be co-buyer"
    : i % 37 === 0
      ? "Duplicate? same phone as another lead, budget unclear, wants school district info"
      : i % 23 === 0
        ? "Needs cleanup -- mixed source fields; asked about HOA, roof, inspection, and seller concessions"
        : "Raw import from lead form";

  return [
    leadId,
    messyDate(i),
    source,
    pick(statuses, i, 6),
    i % 14 === 0 ? agent.toUpperCase() : ` ${agent} `,
    messyPhone(i, 88),
    pick(brokerages, i, 7),
    i % 18 === 0 ? first.toUpperCase() : ` ${first} `,
    i % 21 === 0 ? last.toLowerCase() : ` ${last} `,
    maybeBlank(email, i, 59),
    messyPhone(i, 12),
    messyPhone(i, 44),
    `${streetNo} ${pick(streets, i, 8)}`,
    i % 8 === 0 ? `#${(i % 40) + 1}` : "",
    i % 16 === 0 ? city.toUpperCase() : city,
    i % 22 === 0 ? "New Mexico" : i % 39 === 0 ? "N.M." : i % 46 === 0 ? "??" : "NM",
    i % 34 === 0 ? "BADZIP" : String(87000 + ((i * 11) % 999)).padStart(5, "0"),
    counties[cityIndex] || "Bernalillo",
    i % 27 === 0 ? "" : `MLS${202400000 + i}`,
    pick(propertyTypes, i, 9),
    beds,
    baths,
    sqft,
    i % 42 === 0 ? "" : (0.05 + ((i * 3) % 200) / 100).toFixed(2),
    i % 33 === 0 ? "19??" : String(1940 + (i % 84)),
    messyMoney(basePrice, i),
    messyMoney(basePrice * (0.92 + (i % 20) / 100), i + 5),
    messyMoney(basePrice * (0.35 + (i % 30) / 100), i + 9),
    i % 4 === 0 ? "" : messyMoney(75 + (i % 450), i + 13),
    pick(propertyStatuses, i, 10),
    pick(goals, i, 11),
    pick(timelines, i, 12),
    messyDate(i, 6),
    messyDate(i, 11),
    messyDate(i, 17),
    messyDate(i, 23),
    i % 47 === 0 ? "three percent" : `${(2.25 + (i % 6) * 0.25).toFixed(2)}%`,
    pick(lenders, i, 13),
    messyMoney(basePrice * 0.85, i + 21),
    notes,
  ];
}

fs.mkdirSync(outputDir, { recursive: true });

const lines = [headers.map(csvEscape).join(",")];
for (let i = 0; i < rowCount; i += 1) {
  if (i % 389 === 0) {
    lines.push(headers.map(() => "").join(","));
  }
  const row = buildRow(i);
  lines.push(row.map(csvEscape).join(","));
  if (i % 251 === 0) {
    lines.push(row.map(csvEscape).join(","));
  }
}

fs.writeFileSync(outputPath, lines.join("\r\n"), "utf8");

console.log(JSON.stringify({
  outputPath,
  logicalRows: rowCount,
  physicalRowsIncludingHeader: lines.length,
  bytes: fs.statSync(outputPath).size,
  columns: headers.length,
}, null, 2));

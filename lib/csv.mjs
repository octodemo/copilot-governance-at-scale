// Minimal RFC 4180 CSV reader/writer (no dependencies). Shared by the offline
// content validator.

export class CsvError extends Error {
  constructor(message, line) {
    super(message);
    this.line = line;
  }
}

/** Returns row arrays; `rows.lines[i]` is the 1-based physical line where record i starts. */
export function parseCsv(text) {
  const rows = [];
  const starts = [];
  Object.defineProperty(rows, "lines", { value: starts });
  let line = 1;
  let rowLine = 1;
  let row = [];
  let field = "";
  let quoted = false;
  let closedQuote = false;
  let i = 0;
  const src = text.replace(/^\uFEFF/, "");
  while (i < src.length) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
        closedQuote = true;
      } else {
        if (ch === "\n" || (ch === "\r" && src[i + 1] !== "\n")) line += 1;
        field += ch;
      }
      i += 1;
      continue;
    }
    if (closedQuote && ![",", "\n", "\r"].includes(ch)) throw new CsvError("Unexpected text after a quoted CSV field.", line);
    if (ch === '"') {
      if (field !== "") throw new CsvError("Quote inside an unquoted CSV field.", line);
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
      closedQuote = false;
    } else if (ch === "\n" || ch === "\r") {
      row.push(field);
      rows.push(row);
      starts.push(rowLine);
      row = [];
      field = "";
      closedQuote = false;
      if (ch === "\r" && src[i + 1] === "\n") i += 1;
      line += 1;
      rowLine = line;
    } else {
      field += ch;
    }
    i += 1;
  }
  if (quoted) throw new CsvError("Unterminated quoted CSV field.", rowLine);
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
    starts.push(rowLine);
  }
  return rows;
}

/** Parse CSV text with a header row into `{ columns, rows }` (rows are objects). */
export function parseTable(text) {
  const parsed = parseCsv(text);
  const [header = [], ...body] = parsed;
  const columns = header.map((c) => c.trim());
  if (new Set(columns).size !== columns.length || columns.some((c) => !c)) throw new CsvError("CSV headers must be nonempty and unique.", 1);
  const lines = [];
  const rows = [];
  body.forEach((cells, index) => {
    if (!cells.some((c) => c !== "")) return;
    const line = parsed.lines[index + 1];
    if (cells.length !== columns.length) throw new CsvError("CSV row width does not match its header.", line);
    rows.push(Object.fromEntries(columns.map((c, idx) => [c, cells[idx]])));
    lines.push(line);
  });
  const table = { columns, rows };
  Object.defineProperty(table, "lines", { value: lines }); // non-enumerable: physical start line per row
  return table;
}

function escapeField(value) {
  const s = value == null ? "" : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function serializeTable({ columns, rows }) {
  const lines = [columns.map(escapeField).join(",")];
  for (const row of rows) lines.push(columns.map((c) => escapeField(row[c])).join(","));
  return `${lines.join("\n")}\n`;
}

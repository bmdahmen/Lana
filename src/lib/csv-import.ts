export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      pushField();
    } else if (char === "\n") {
      pushRow();
    } else if (char === "\r") {
      // skip, \n handles the row break
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    pushRow();
  }

  return rows.filter((r) => r.some((cell) => cell.trim().length > 0));
}

const DATE_HEADERS = ["date", "transaction date", "posted date", "trans date", "post date"];
const DESCRIPTION_HEADERS = [
  "description",
  "merchant",
  "name",
  "payee",
  "transaction description",
];
const AMOUNT_HEADERS = ["amount", "transaction amount"];
const DEBIT_HEADERS = ["debit", "withdrawal", "charge"];
const CREDIT_HEADERS = ["credit", "deposit", "payment"];
const CATEGORY_HEADERS = ["category", "type"];

interface ColumnMap {
  date: number;
  description: number;
  amount: number | null;
  debit: number | null;
  credit: number | null;
  category: number | null;
}

function findColumn(headers: string[], candidates: string[]): number {
  const lower = headers.map((h) => h.trim().toLowerCase());
  for (const candidate of candidates) {
    const idx = lower.indexOf(candidate);
    if (idx !== -1) return idx;
  }
  return -1;
}

export function detectColumns(headers: string[]): ColumnMap | null {
  const date = findColumn(headers, DATE_HEADERS);
  const description = findColumn(headers, DESCRIPTION_HEADERS);
  const amount = findColumn(headers, AMOUNT_HEADERS);
  const debit = findColumn(headers, DEBIT_HEADERS);
  const credit = findColumn(headers, CREDIT_HEADERS);
  const category = findColumn(headers, CATEGORY_HEADERS);

  if (date === -1 || description === -1) return null;
  if (amount === -1 && debit === -1 && credit === -1) return null;

  return {
    date,
    description,
    amount: amount === -1 ? null : amount,
    debit: debit === -1 ? null : debit,
    credit: credit === -1 ? null : credit,
    category: category === -1 ? null : category,
  };
}

export interface ParsedCsvTransaction {
  date: string;
  description: string;
  amount: number; // positive = money out, following Lana's convention
  category: string | null;
}

function normalizeDate(raw: string): string {
  const trimmed = raw.trim();
  // Already ISO (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  // MM/DD/YYYY or M/D/YYYY
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (match) {
    const [, month, day, year] = match;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  return trimmed;
}

export function parseTransactionsFromCsv(
  text: string,
  flipSign: boolean
): ParsedCsvTransaction[] {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];

  const headers = rows[0];
  const columns = detectColumns(headers);
  if (!columns) {
    throw new Error(
      `Couldn't find recognizable date/description/amount columns in headers: ${headers.join(", ")}`
    );
  }

  const transactions: ParsedCsvTransaction[] = [];

  for (const row of rows.slice(1)) {
    const dateRaw = row[columns.date];
    const description = row[columns.description]?.trim();
    if (!dateRaw || !description) continue;

    let amount: number;
    if (columns.amount !== null) {
      amount = Number.parseFloat(row[columns.amount].replace(/[^0-9.-]/g, ""));
    } else {
      const debit = columns.debit !== null ? row[columns.debit] : "";
      const credit = columns.credit !== null ? row[columns.credit] : "";
      const debitNum = Number.parseFloat(debit.replace(/[^0-9.-]/g, "")) || 0;
      const creditNum = Number.parseFloat(credit.replace(/[^0-9.-]/g, "")) || 0;
      amount = debitNum - creditNum;
    }

    if (Number.isNaN(amount)) continue;
    if (flipSign) amount = -amount;

    transactions.push({
      date: normalizeDate(dateRaw),
      description,
      amount,
      category: columns.category !== null ? row[columns.category]?.trim() || null : null,
    });
  }

  return transactions;
}

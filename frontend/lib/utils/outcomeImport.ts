/**
 * Parse XLS, XLSX or TXT file for outcome rows.
 * Expected columns: code (kod) and description (açıklama).
 * - Excel: first sheet, first column = code, second = description (or header row with kod/açıklama/code/description).
 * - TXT/CSV: one row per line, tab or comma separated: code \t description or code, description.
 */
export interface OutcomeRow {
  code: string;
  description: string;
}

function normalizeHeader(h: string): string {
  const s = String(h ?? "").trim().toLowerCase();
  if (/^(kod|code|pç|öç|no)$/.test(s)) return "code";
  if (/^(açıklama|description|desc|aciklama)$/.test(s)) return "description";
  return s;
}

export async function parseOutcomeFile(file: File): Promise<OutcomeRow[]> {
  const isExcel = /\.(xlsx?|xls)$/i.test(file.name);
  const rows: OutcomeRow[] = [];

  if (isExcel) {
    const XLSX = await import("xlsx");
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, { header: 1, defval: "" });

    if (!raw.length) return [];

    const firstRow = raw[0] as (string | number)[];
    const h0 = firstRow.length >= 1 ? normalizeHeader(String(firstRow[0])) : "";
    const h1 = firstRow.length >= 2 ? normalizeHeader(String(firstRow[1])) : "";
    const hasHeaderRow = h0 === "code" || h1 === "description" || h0 === "description" || h1 === "code";
    let codeCol = 0;
    let descCol = 1;
    if (hasHeaderRow && firstRow.length >= 2) {
      if (h0 === "code" && h1 === "description") {
        codeCol = 0;
        descCol = 1;
      } else if (h0 === "description" && h1 === "code") {
        codeCol = 1;
        descCol = 0;
      }
    }
    const startIndex = hasHeaderRow ? 1 : 0;

    for (let i = startIndex; i < raw.length; i++) {
      const row = raw[i] as (string | number)[];
      if (!row || row.length < 2) continue;
      const code = String(row[codeCol] ?? "").trim();
      const description = String(row[descCol] ?? "").trim();
      if (!code) continue;
      rows.push({ code, description: description || code });
    }
  } else {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const tabParts = trimmed.split(/\t/);
      const commaParts = trimmed.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map((p) => p.replace(/^"|"$/g, "").trim());
      const parts = tabParts.length >= 2 ? tabParts : commaParts.length >= 2 ? commaParts : trimmed.split(/\s{2,}/);
      if (parts.length >= 2) {
        const code = String(parts[0]).trim();
        const description = parts.slice(1).join(parts.length > 2 ? " " : "\t").trim();
        if (code) rows.push({ code, description: description || code });
      } else if (parts.length === 1 && parts[0]) {
        rows.push({ code: parts[0], description: parts[0] });
      }
    }
  }

  return rows;
}

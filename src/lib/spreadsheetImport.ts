import readXlsxFile, { type CellValue, type SheetData } from "read-excel-file/browser";

export const SPREADSHEET_FILE_ACCEPT =
  ".csv,.xlsx,.xlsm,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel";

type SpreadsheetRows = SheetData | readonly (readonly (CellValue | null | undefined)[])[];

function formatUtcExcelDate(date: Date): string {
  if (Number.isNaN(date.getTime())) return "";
  const day = date.getUTCDate();
  const month = date.getUTCMonth() + 1;
  const year = date.getUTCFullYear();
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  const baseDate = `${day}/${month}/${year}`;
  if (hours !== 0 || minutes !== 0) {
    return `${baseDate} ${hours}:${String(minutes).padStart(2, "0")}`;
  }
  return baseDate;
}

function serializeCsvCell(value: CellValue | null | undefined): string {
  if (value === null || value === undefined) return "";
  let text: string;
  if (value instanceof Date) {
    text = formatUtcExcelDate(value);
  } else if (typeof value === "boolean") {
    text = value ? "TRUE" : "FALSE";
  } else if (typeof value === "number") {
    text = Number.isFinite(value) ? String(value) : "";
  } else {
    text = String(value).replace(/\r?\n/g, " ").trim();
  }
  if (text.includes('"') || text.includes(",") || text.includes(";") || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function rowsToCsvText(rows: SpreadsheetRows): string {
  return rows
    .filter((row) => Array.isArray(row) && row.some((cell) => cell !== null && cell !== undefined && String(cell).trim() !== ""))
    .map((row) => row.map((cell) => serializeCsvCell(cell)).join(","))
    .join("\n");
}

function parseHtmlOrXmlSpreadsheetText(rawText: string): string | null {
  if (typeof DOMParser === "undefined") return null;
  const trimmed = rawText.trimStart();
  if (!trimmed.startsWith("<")) return null;

  const lowerHead = trimmed.slice(0, 600).toLowerCase();
  if (lowerHead.includes("<table") || lowerHead.includes("<html") || lowerHead.includes("<!doctype")) {
    const doc = new DOMParser().parseFromString(rawText, "text/html");
    const tables = Array.from(doc.querySelectorAll("table"));
    if (tables.length > 0) {
      let bestRows: CellValue[][] = [];
      for (const table of tables) {
        const tableRows = Array.from(table.querySelectorAll("tr")).map((tr) =>
          Array.from(tr.querySelectorAll("th, td")).map((cell) =>
            (cell.textContent || "").replace(/\s+/g, " ").trim()
          )
        );
        if (tableRows.length > bestRows.length) {
          bestRows = tableRows;
        }
      }
      if (bestRows.length > 0) return rowsToCsvText(bestRows);
    }
  }

  if (lowerHead.includes("<workbook") || lowerHead.includes("schemas-microsoft-com:office:spreadsheet")) {
    const xml = new DOMParser().parseFromString(rawText, "text/xml");
    const rowNodes = Array.from(xml.getElementsByTagName("Row"));
    if (rowNodes.length > 0) {
      const parsedRows: CellValue[][] = rowNodes.map((rowEl) => {
        const out: CellValue[] = [];
        const cells = Array.from(rowEl.getElementsByTagName("Cell"));
        for (const cell of cells) {
          const explicitIdx = cell.getAttribute("ss:Index") || cell.getAttribute("Index");
          if (explicitIdx) {
            const targetIdx = parseInt(explicitIdx, 10) - 1;
            while (out.length < targetIdx) out.push("");
          }
          const dataEl = cell.getElementsByTagName("Data")[0];
          const val = (dataEl?.textContent ?? cell.textContent ?? "").replace(/\s+/g, " ").trim();
          out.push(val);
        }
        return out;
      });
      return rowsToCsvText(parsedRows);
    }
  }

  return null;
}

function hasHeaderCandidate(rows: SpreadsheetRows): boolean {
  const maxCheck = Math.min(rows.length, 8);
  for (let i = 0; i < maxCheck; i++) {
    const row = rows[i];
    if (!Array.isArray(row)) continue;
    const joined = row
      .map((c) => String(c ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""))
      .join(" ");
    if (joined.includes("orden") || (joined.includes("cliente") && (joined.includes("estado") || joined.includes("serial") || joined.includes("equipo")))) {
      return true;
    }
  }
  return false;
}

/**
 * Lee un archivo CSV, XLSX o XLS (HTML/XML) y lo normaliza a texto CSV estándar
 * para que todos los importadores SATI funcionen de forma uniforme.
 */
export async function readSpreadsheetAsCsvText(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  const headerBytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const isZipXlsx = headerBytes[0] === 0x50 && headerBytes[1] === 0x4b;
  const isBinaryLegacyXls =
    headerBytes[0] === 0xd0 &&
    headerBytes[1] === 0xcf &&
    headerBytes[2] === 0x11 &&
    headerBytes[3] === 0xe0;

  if (isBinaryLegacyXls) {
    throw new Error(
      "El archivo .xls está en formato binario antiguo (Excel 97-2003). Abrilo en Excel y guardalo como 'Libro de Excel (.xlsx)' o 'CSV (.csv)' para importarlo."
    );
  }

  if (ext === "xlsx" || ext === "xlsm" || isZipXlsx) {
    const sheets = await readXlsxFile(file);
    if (!sheets || sheets.length === 0) {
      throw new Error("El archivo Excel no contiene hojas con datos.");
    }
    const matchingSheet = sheets.find((s) => hasHeaderCandidate(s.data));
    const largestSheet = [...sheets].sort((a, b) => b.data.length - a.data.length)[0];
    const targetSheet = matchingSheet || largestSheet;
    const csvText = rowsToCsvText(targetSheet.data);
    if (!csvText.trim()) {
      throw new Error("La hoja seleccionada del archivo Excel está vacía.");
    }
    return csvText;
  }

  const rawText = await file.text();
  if (ext === "xls" || rawText.trimStart().startsWith("<")) {
    const converted = parseHtmlOrXmlSpreadsheetText(rawText);
    if (converted !== null) {
      return converted;
    }
  }

  return rawText;
}

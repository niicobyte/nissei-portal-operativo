import readXlsxFile, { type CellValue, type SheetData } from "read-excel-file/browser";
import {
  SATI_CDE_RANGE_START,
  SATI_MIN_ID_ASU,
  SATI_MIN_ID_CDE,
  yieldToBrowser,
  type SatiPreparedSheetInput,
} from "./satiRawDepurator";

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
 * Detecta la fila de cabecera y la columna de idOrden en una grilla Excel/CSV.
 */
function detectHeaderAndIdColumn(rows: SpreadsheetRows): {
  headerRowIdx: number;
  idColIdx: number;
} {
  const maxScan = Math.min(rows.length, 8);
  for (let r = 0; r < maxScan; r++) {
    const row = rows[r];
    if (!Array.isArray(row)) continue;
    let idCol = -1;
    let matches = 0;
    for (let c = 0; c < row.length; c++) {
      const h = String(row[c] ?? "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "");
      if (!h) continue;
      if (
        ["idorden", "orden", "nroorden", "norden", "id", "ticket", "nrodeorden"].includes(h) ||
        h.includes("idorden")
      ) {
        if (idCol === -1) idCol = c;
        matches++;
      } else if (
        h.includes("cliente") ||
        h.includes("estado") ||
        h.includes("serial") ||
        h.includes("modelo") ||
        h.includes("marca")
      ) {
        matches++;
      }
    }
    if (idCol !== -1 && matches >= 2) {
      return { headerRowIdx: r, idColIdx: idCol };
    }
  }
  return { headerRowIdx: -1, idColIdx: -1 };
}

function classifyHistoricalOrderSkip(rawCell: unknown): "ASU" | "CDE" | null {
  if (rawCell === null || rawCell === undefined) return null;
  let numId: number;
  if (typeof rawCell === "number") {
    if (!Number.isInteger(rawCell) || rawCell <= 0) return null;
    numId = rawCell;
  } else {
    const clean = String(rawCell).replace(/^#/, "").trim();
    if (!/^\d+$/.test(clean)) return null;
    numId = parseInt(clean, 10);
  }
  if (numId < SATI_CDE_RANGE_START) {
    return numId < SATI_MIN_ID_ASU ? "ASU" : null;
  }
  return numId < SATI_MIN_ID_CDE ? "CDE" : null;
}

/**
 * Convierte una hoja Excel en CSV compacto pre-filtrando filas históricas (<29403 ASU / <125650 CDE)
 * antes de formatear fechas o serializar celdas, cediendo el hilo al navegador cada 10,000 filas.
 */
async function rowsToPreparedSatiAsync(rows: SpreadsheetRows): Promise<SatiPreparedSheetInput> {
  const { headerRowIdx, idColIdx } = detectHeaderAndIdColumn(rows);
  const canQuickSkip = headerRowIdx !== -1 && idColIdx !== -1;

  const lines: string[] = [];
  let preSkippedHistoricasAsu = 0;
  let preSkippedHistoricasCde = 0;

  for (let r = 0; r < rows.length; r++) {
    if (r > 0 && r % 10000 === 0) {
      await yieldToBrowser();
    }

    const row = rows[r];
    if (!Array.isArray(row) || row.length === 0) continue;

    if (canQuickSkip && r > headerRowIdx) {
      const skipBranch = classifyHistoricalOrderSkip(row[idColIdx]);
      if (skipBranch === "ASU") {
        preSkippedHistoricasAsu++;
        continue;
      }
      if (skipBranch === "CDE") {
        preSkippedHistoricasCde++;
        continue;
      }
    }

    let hasContent = false;
    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      if (cell !== null && cell !== undefined && String(cell).trim() !== "") {
        hasContent = true;
        break;
      }
    }
    if (!hasContent) continue;

    lines.push(row.map((cell) => serializeCsvCell(cell)).join(","));
  }

  return {
    csvText: lines.join("\n"),
    preSkippedHistoricasAsu,
    preSkippedHistoricasCde,
  };
}

function extractCsvCellAt(record: string, delimiter: string, targetIdx: number): string {
  let col = 0;
  let start = 0;
  let inQuotes = false;
  for (let i = 0; i <= record.length; i++) {
    const ch = i < record.length ? record[i] : delimiter;
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < record.length && record[i + 1] === '"') {
          i++;
        } else {
          inQuotes = false;
        }
      }
    } else {
      if (ch === '"' && i < record.length) {
        inQuotes = true;
      } else if (ch === delimiter) {
        if (col === targetIdx) {
          let raw = record.slice(start, i).trim();
          if (raw.startsWith('"') && raw.endsWith('"') && raw.length >= 2) {
            raw = raw.slice(1, -1).replace(/""/g, '"').trim();
          }
          return raw;
        }
        col++;
        start = i + 1;
      }
    }
  }
  return "";
}

function detectDelimiterQuick(sampleLine: string): string {
  const semi = (sampleLine.match(/;/g) || []).length;
  const comma = (sampleLine.match(/,/g) || []).length;
  const tab = (sampleLine.match(/\t/g) || []).length;
  if (semi > comma && semi > tab) return ";";
  if (tab > comma && tab > semi) return "\t";
  return ",";
}

/**
 * Pre-filtra CSV gigantes (> 4,000 líneas) en bloques sin bloquear el navegador,
 * eliminando órdenes históricas antes de invocar al parser completo.
 */
async function csvTextToPreparedSatiAsync(rawText: string): Promise<SatiPreparedSheetInput> {
  const clean = rawText.replace(/^\uFEFF/, "");
  if (!clean.trim()) {
    return { csvText: "", preSkippedHistoricasAsu: 0, preSkippedHistoricasCde: 0 };
  }

  const rawLines = clean.split(/\r?\n/);
  if (rawLines.length < 4000) {
    return { csvText: clean, preSkippedHistoricasAsu: 0, preSkippedHistoricasCde: 0 };
  }

  // Reconstruir registros lógicos (soportando saltos de línea dentro de comillas)
  const records: string[] = [];
  let buf = "";
  let inQuotes = false;
  for (let i = 0; i < rawLines.length; i++) {
    if (i > 0 && i % 20000 === 0) {
      await yieldToBrowser();
    }
    const line = rawLines[i];
    if (!inQuotes && !line.trim()) continue;
    buf = buf ? `${buf}\n${line}` : line;
    for (let j = 0; j < line.length; j++) {
      if (line[j] === '"') inQuotes = !inQuotes;
    }
    if (!inQuotes) {
      records.push(buf);
      buf = "";
    }
  }
  if (buf) records.push(buf);

  if (records.length === 0) {
    return { csvText: "", preSkippedHistoricasAsu: 0, preSkippedHistoricasCde: 0 };
  }

  const delimiter = detectDelimiterQuick(records[0]);
  const previewRows = records.slice(0, 8).map((rec) => {
    const out: string[] = [];
    for (let c = 0; c < 15; c++) out.push(extractCsvCellAt(rec, delimiter, c));
    return out;
  });
  const { headerRowIdx, idColIdx } = detectHeaderAndIdColumn(previewRows);
  const canQuickSkip = headerRowIdx !== -1 && idColIdx !== -1;

  if (!canQuickSkip) {
    return { csvText: clean, preSkippedHistoricasAsu: 0, preSkippedHistoricasCde: 0 };
  }

  const kept: string[] = [];
  let preSkippedHistoricasAsu = 0;
  let preSkippedHistoricasCde = 0;

  for (let i = 0; i < records.length; i++) {
    if (i > 0 && i % 10000 === 0) {
      await yieldToBrowser();
    }
    const rec = records[i];
    if (i > headerRowIdx) {
      const idCell = extractCsvCellAt(rec, delimiter, idColIdx);
      const skipBranch = classifyHistoricalOrderSkip(idCell);
      if (skipBranch === "ASU") {
        preSkippedHistoricasAsu++;
        continue;
      }
      if (skipBranch === "CDE") {
        preSkippedHistoricasCde++;
        continue;
      }
    }
    kept.push(rec);
  }

  return {
    csvText: kept.join("\n"),
    preSkippedHistoricasAsu,
    preSkippedHistoricasCde,
  };
}

/**
 * Lee uno o múltiples archivos CSV/Excel SATI de manera secuencial (sin duplicar uso de RAM)
 * pre-filtrando filas históricas y cediendo el hilo entre bloques para evitar congelamientos.
 */
export async function readMultipleSpreadsheetsForSati(
  files: FileList | File[]
): Promise<{
  preparedSheets: SatiPreparedSheetInput[];
  fileNamesLabel: string;
  fileCount: number;
}> {
  const list = Array.from(files);
  if (list.length === 0) {
    return { preparedSheets: [], fileNamesLabel: "", fileCount: 0 };
  }

  const preparedSheets: SatiPreparedSheetInput[] = [];

  for (const file of list) {
    await yieldToBrowser();
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
        `El archivo "${file.name}" está en formato binario antiguo (.xls Excel 97-2003). Abrilo en Excel y guardalo como 'Libro de Excel (.xlsx)' o 'CSV (.csv)' para importarlo.`
      );
    }

    if (ext === "xlsx" || ext === "xlsm" || isZipXlsx) {
      const sheets = await readXlsxFile(file);
      await yieldToBrowser();
      if (!sheets || sheets.length === 0) {
        throw new Error(`El archivo Excel "${file.name}" no contiene hojas con datos.`);
      }
      const candidateSheets = sheets.filter((s) => hasHeaderCandidate(s.data));
      const sheetsToRead =
        candidateSheets.length > 0
          ? candidateSheets
          : [[...sheets].sort((a, b) => b.data.length - a.data.length)[0]];

      for (const sheet of sheetsToRead) {
        const prepared = await rowsToPreparedSatiAsync(sheet.data);
        if (
          prepared.csvText.trim() ||
          prepared.preSkippedHistoricasAsu > 0 ||
          prepared.preSkippedHistoricasCde > 0
        ) {
          preparedSheets.push(prepared);
        }
        await yieldToBrowser();
      }
    } else {
      const rawText = await file.text();
      await yieldToBrowser();
      let textToPrep = rawText;
      if (ext === "xls" || rawText.trimStart().startsWith("<")) {
        const converted = parseHtmlOrXmlSpreadsheetText(rawText);
        if (converted !== null) {
          textToPrep = converted;
        }
      }
      const prepared = await csvTextToPreparedSatiAsync(textToPrep);
      if (
        prepared.csvText.trim() ||
        prepared.preSkippedHistoricasAsu > 0 ||
        prepared.preSkippedHistoricasCde > 0
      ) {
        preparedSheets.push(prepared);
      }
    }
  }

  const fileNamesLabel =
    list.length <= 2
      ? list.map((f) => f.name).join(" + ")
      : `${list[0].name} + ${list.length - 1} archivo(s) más`;

  return {
    preparedSheets,
    fileNamesLabel,
    fileCount: list.length,
  };
}

/**
 * Lee un archivo CSV, XLSX o XLS (HTML/XML) y devuelve un arreglo de textos CSV estándar
 * (si un libro Excel tiene múltiples hojas SATI válidas, por ejemplo ASU + CDE, lee todas).
 */
export async function readSpreadsheetAllTexts(file: File): Promise<string[]> {
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
      `El archivo "${file.name}" está en formato binario antiguo (.xls Excel 97-2003). Abrilo en Excel y guardalo como 'Libro de Excel (.xlsx)' o 'CSV (.csv)' para importarlo.`
    );
  }

  if (ext === "xlsx" || ext === "xlsm" || isZipXlsx) {
    const sheets = await readXlsxFile(file);
    if (!sheets || sheets.length === 0) {
      throw new Error(`El archivo Excel "${file.name}" no contiene hojas con datos.`);
    }

    const candidateSheets = sheets.filter((s) => hasHeaderCandidate(s.data));
    const sheetsToRead =
      candidateSheets.length > 0
        ? candidateSheets
        : [[...sheets].sort((a, b) => b.data.length - a.data.length)[0]];

    const texts = sheetsToRead
      .map((s) => rowsToCsvText(s.data))
      .filter((t) => t.trim().length > 0);

    if (texts.length === 0) {
      throw new Error(`Las hojas seleccionadas de "${file.name}" están vacías.`);
    }
    return texts;
  }

  const rawText = await file.text();
  if (ext === "xls" || rawText.trimStart().startsWith("<")) {
    const converted = parseHtmlOrXmlSpreadsheetText(rawText);
    if (converted !== null) {
      return [converted];
    }
  }

  return [rawText];
}

/**
 * Lee un archivo CSV, XLSX o XLS (HTML/XML) y lo normaliza a texto CSV estándar
 * para que todos los importadores SATI funcionen de forma uniforme.
 */
export async function readSpreadsheetAsCsvText(file: File): Promise<string> {
  const texts = await readSpreadsheetAllTexts(file);
  return texts[0] || "";
}

/**
 * Lee uno o múltiples archivos CSV/Excel seleccionados simultáneamente y devuelve
 * todas sus hojas/archivos convertidos a textos CSV listos para consolidar.
 */
export async function readMultipleSpreadsheetsAsCsvTexts(
  files: FileList | File[]
): Promise<{ texts: string[]; fileNamesLabel: string; fileCount: number }> {
  const list = Array.from(files);
  if (list.length === 0) {
    return { texts: [], fileNamesLabel: "", fileCount: 0 };
  }

  const nested = await Promise.all(list.map((f) => readSpreadsheetAllTexts(f)));
  const texts = nested.flat();
  const fileNamesLabel =
    list.length <= 2
      ? list.map((f) => f.name).join(" + ")
      : `${list[0].name} + ${list.length - 1} archivo(s) más`;

  return {
    texts,
    fileNamesLabel,
    fileCount: list.length,
  };
}

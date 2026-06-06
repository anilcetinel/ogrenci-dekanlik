import * as XLSX from "xlsx";

export const EMBEDDED_FILE_SIZE_LIMIT = 750 * 1024;

const fileTypeMap = {
  xlsx: "Excel Dosyaları",
  xls: "Excel Dosyaları",
  csv: "Excel Dosyaları",
  doc: "Resmi Yazılar",
  docx: "Resmi Yazılar",
  pdf: "Resmi Yazılar",
  txt: "Formlar",
};

export function getFileExtension(fileName) {
  return fileName.split(".").pop()?.toLocaleLowerCase("tr-TR") || "";
}

export function getDocumentType(fileName) {
  return fileTypeMap[getFileExtension(fileName)] || "Formlar";
}

export function formatFileSize(size) {
  if (!size) return "0 KB";
  if (size < 1024 * 1024) return `${Math.ceil(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function canEmbedFile(file) {
  return file.size <= EMBEDDED_FILE_SIZE_LIMIT;
}

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function extractSpreadsheetText(file) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });

  return workbook.SheetNames.map((sheetName) => {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "" });
    const textRows = rows
      .map((row) => row.filter((cell) => String(cell).trim()).join(" | "))
      .filter(Boolean);
    return [`[${sheetName}]`, ...textRows].join("\n");
  }).join("\n\n");
}

async function extractPdfText(file) {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.mjs",
    import.meta.url,
  ).toString();

  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const pages = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => item.str).join(" ").replace(/\s+/g, " ").trim());
  }

  return pages.filter(Boolean).join("\n\n");
}

async function extractDocxText(file) {
  const mammoth = await import("mammoth/mammoth.browser.js");
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return result.value || "";
}

export async function extractTextFromFile(file) {
  const extension = getFileExtension(file.name);

  if (["xlsx", "xls"].includes(extension)) {
    return extractSpreadsheetText(file);
  }

  if (["csv", "txt"].includes(extension)) {
    return file.text();
  }

  if (extension === "pdf") {
    return extractPdfText(file);
  }

  if (extension === "docx") {
    return extractDocxText(file);
  }

  return "";
}

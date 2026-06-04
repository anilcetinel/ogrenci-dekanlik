import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import Badge from "../components/Badge";
import FormModal from "../components/FormModal";
import SuccessMessage from "../components/SuccessMessage";
import useStoredCollection from "../hooks/useStoredCollection";
import takvimData from "../data/akademik-takvim.json";
import operasyonData from "../data/operasyon-kutuphanesi.json";
import { getCalendarAlert, inferOperationIds, normalizeDate } from "../utils/calendar";

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const monthFormatter = new Intl.DateTimeFormat("tr-TR", {
  month: "long",
  year: "numeric",
});

const shortMonthFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "short",
});

const weekDays = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const minimumAcademicYearStart = 2026;

const emptyForm = {
  ad: "",
  baslangic: "",
  bitis: "",
  kategori: "",
  donem: "",
  kritiklik: "orta",
  durum: "Planlandı",
  aciklama: "",
  operasyonIds: [],
};

const columnAliases = {
  ad: ["olay", "olay adı", "etkinlik", "başlık", "faaliyet", "işlem", "açıklama"],
  baslangic: [
    "başlangıç",
    "başlangıç tarihi",
    "başlangic",
    "baslangic",
    "başlangic tarihi",
    "baslangic tarihi",
    "start",
    "tarih",
    "ilk tarih",
  ],
  bitis: ["bitiş", "bitiş tarihi", "bitis", "bitis tarihi", "end", "son tarih"],
  kategori: ["kategori", "tür"],
  donem: ["dönem"],
  kritiklik: ["kritiklik", "önem"],
};

const turkishMonths = {
  ocak: 1,
  şubat: 2,
  subat: 2,
  mart: 3,
  nisan: 4,
  mayıs: 5,
  mayis: 5,
  haziran: 6,
  temmuz: 7,
  ağustos: 8,
  agustos: 8,
  eylül: 9,
  eylul: 9,
  ekim: 10,
  kasım: 11,
  kasim: 11,
  aralık: 12,
  aralik: 12,
};

const turkishMonthNamesPattern =
  "Ocak|Şubat|Subat|Mart|Nisan|Mayıs|Mayis|Haziran|Temmuz|Ağustos|Agustos|Eylül|Eylul|Ekim|Kasım|Kasim|Aralık|Aralik";

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("tr-TR");
}

function getValue(row, aliases) {
  const foundKey = Object.keys(row).find((key) => aliases.includes(normalizeHeader(key)));
  return foundKey ? row[foundKey] : "";
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("tr-TR");
}

function findColumnIndex(headerRow, aliases) {
  return headerRow.findIndex((cell) => aliases.includes(normalizeHeader(cell)));
}

function parseTurkishDateParts(day, monthName, year) {
  const month = turkishMonths[normalizeText(monthName)];
  if (!month || !year) {
    return "";
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseDateRange(value) {
  if (typeof value === "number" || value instanceof Date) {
    const date = normalizeDate(value);
    return date ? { baslangic: date, bitis: date } : null;
  }

  const text = String(value || "")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) {
    return null;
  }

  const normalizedSingle = normalizeDate(text);
  if (normalizedSingle) {
    return { baslangic: normalizedSingle, bitis: normalizedSingle };
  }

  const matchDateRange = (pattern, mapper) => {
    const match = text.match(pattern);
    if (!match) {
      return null;
    }

    return { ...mapper(match), matchedText: match[0] };
  };

  const numericRange = text.match(
    /^(\d{1,2})[./](\d{1,2})[./](\d{4})\s*-\s*(\d{1,2})[./](\d{1,2})[./](\d{4})$/,
  );
  if (numericRange) {
    const [, startDay, startMonth, startYear, endDay, endMonth, endYear] = numericRange;
    return {
      baslangic: `${startYear}-${startMonth.padStart(2, "0")}-${startDay.padStart(2, "0")}`,
      bitis: `${endYear}-${endMonth.padStart(2, "0")}-${endDay.padStart(2, "0")}`,
    };
  }

  const fullTextRangeWithStartYear = matchDateRange(
    new RegExp(
      `(\\d{1,2})\\s+(${turkishMonthNamesPattern})\\s+(\\d{4})\\s*-\\s*(\\d{1,2})\\s+(${turkishMonthNamesPattern})\\s+(\\d{4})`,
      "i",
    ),
    ([, startDay, startMonthName, startYear, endDay, endMonthName, endYear]) => {
      const adjustedStartYear =
        Number(endYear) - Number(startYear) > 1 ? String(Number(endYear) - 1) : startYear;

      return {
        baslangic: parseTurkishDateParts(startDay, startMonthName, adjustedStartYear),
        bitis: parseTurkishDateParts(endDay, endMonthName, endYear),
      };
    },
  );
  if (fullTextRangeWithStartYear) {
    return fullTextRangeWithStartYear;
  }

  const fullTextRange = matchDateRange(
    new RegExp(
      `(\\d{1,2})\\s+(${turkishMonthNamesPattern})\\s*-\\s*(\\d{1,2})\\s+(${turkishMonthNamesPattern})\\s+(\\d{4})`,
      "i",
    ),
    ([, startDay, startMonthName, endDay, endMonthName, year]) => ({
      baslangic: parseTurkishDateParts(startDay, startMonthName, year),
      bitis: parseTurkishDateParts(endDay, endMonthName, year),
    }),
  );
  if (fullTextRange) {
    return fullTextRange;
  }

  const multiDaySameMonthRange = matchDateRange(
    new RegExp(`(\\d{1,2}(?:\\s*-\\s*\\d{1,2})+)\\s+(${turkishMonthNamesPattern})\\s+(\\d{4})`, "i"),
    ([, daySequence, monthName, year]) => {
      const days = daySequence
        .split(/\s*-\s*/)
        .map((day) => Number(day))
        .filter(Boolean);
      const firstDay = Math.min(...days);
      const lastDay = Math.max(...days);

      return {
        baslangic: parseTurkishDateParts(firstDay, monthName, year),
        bitis: parseTurkishDateParts(lastDay, monthName, year),
      };
    },
  );
  if (multiDaySameMonthRange) {
    return multiDaySameMonthRange;
  }

  const shortTextRange = matchDateRange(
    new RegExp(`(\\d{1,2})\\s*-\\s*(\\d{1,2})\\s+(${turkishMonthNamesPattern})\\s+(\\d{4})`, "i"),
    ([, startDay, endDay, monthName, year]) => ({
      baslangic: parseTurkishDateParts(startDay, monthName, year),
      bitis: parseTurkishDateParts(endDay, monthName, year),
    }),
  );
  if (shortTextRange) {
    return shortTextRange;
  }

  const splitRange = text.split(/\s+-\s+/);
  if (splitRange.length === 2) {
    const start = normalizeDate(splitRange[0]);
    const end = normalizeDate(splitRange[1]);
    if (start && end) {
      return { baslangic: start, bitis: end };
    }
  }

  return null;
}

function findHeaderInfo(rows) {
  const rowsToScan = rows.slice(0, 20);

  for (let rowIndex = 0; rowIndex < rowsToScan.length; rowIndex += 1) {
    const row = rowsToScan[rowIndex];
    const matchedColumns = {
      ad: findColumnIndex(row, columnAliases.ad),
      baslangic: findColumnIndex(row, columnAliases.baslangic),
      bitis: findColumnIndex(row, columnAliases.bitis),
      kategori: findColumnIndex(row, columnAliases.kategori),
      donem: findColumnIndex(row, columnAliases.donem),
      kritiklik: findColumnIndex(row, columnAliases.kritiklik),
    };

    if (matchedColumns.ad !== -1 && (matchedColumns.baslangic !== -1 || matchedColumns.bitis !== -1)) {
      return { headerRowIndex: rowIndex, matchedColumns, fallbackTwoColumns: false };
    }
  }

  const firstDataRowIndex = rows.findIndex(
    (row) => String(row[0] || "").trim() && parseDateRange(row[1]),
  );
  if (firstDataRowIndex !== -1) {
    return {
      headerRowIndex: firstDataRowIndex - 1,
      matchedColumns: { ad: 0, baslangic: 1, bitis: -1, kategori: 2, donem: -1, kritiklik: -1 },
      fallbackTwoColumns: true,
      firstDataRowIndex,
    };
  }

  return null;
}

function cleanEventName(value, dateText) {
  return String(value || "")
    .replace(dateText || "", "")
    .replace(/\s{2,}/g, " ")
    .replace(/[-–—;,:\s]+$/g, "")
    .trim();
}

function isLikelySectionHeader(value) {
  const text = String(value || "").trim();
  const normalized = normalizeText(text);

  if (!text || text.length < 8 || parseDateRange(text)) {
    return false;
  }

  if (
    normalized.includes("sakarya üniversitesi") ||
    normalized.includes("akademik takvimi") ||
    normalized.includes("ögr.") ||
    normalized.includes("öğr.") ||
    normalized.startsWith("t.c.") ||
    normalized.startsWith("(*)") ||
    normalized.startsWith("(**)") ||
    normalized.includes("güz yarıyılı") ||
    normalized.includes("bahar yarıyılı") ||
    normalized.includes("yaz okulu dönemi") ||
    normalized.includes("yarıyılı takvimi") ||
    normalized.includes("akademik yılı") ||
    /^\d+$/.test(normalized)
  ) {
    return false;
  }

  return true;
}

function normalizeSectionTitle(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/\s+;/g, ";")
    .trim();
}

function inferCategoryFromText(name, sectionTitle, fallback = "Akademik") {
  const source = normalizeText(`${sectionTitle || ""} ${name || ""}`);

  if (source.includes("muafiyet") || source.includes("önceki öğrenme")) return "Muafiyet";
  if (source.includes("çap") || source.includes("yandal")) return "Başvuru";
  if (source.includes("sınav") || source.includes("bütünleme") || source.includes("final")) return "Sınav";
  if (source.includes("mezuniyet") || source.includes("diploma")) return "Mezuniyet";
  if (source.includes("derse yazıl") || source.includes("ders kay")) return "Kayıt";
  if (source.includes("azami süre") || source.includes("ilişik kesme")) return "Azami Süre";

  return fallback;
}

const categoryStyles = {
  sınav:     { bg: "bg-red-100",    text: "text-red-700",    border: "border-red-500"    },
  kayıt:     { bg: "bg-blue-100",   text: "text-blue-800",   border: "border-blue-600"   },
  muafiyet:  { bg: "bg-emerald-100",text: "text-emerald-800",border: "border-emerald-600"},
  mezuniyet: { bg: "bg-purple-100", text: "text-purple-800", border: "border-purple-600" },
  başvuru:   { bg: "bg-orange-100", text: "text-orange-800", border: "border-orange-500" },
  akademik:  { bg: "bg-slate-100",  text: "text-slate-700",  border: "border-slate-400"  },
};

function getCategoryStyle(category) {
  const key = normalizeText(category);
  const matchedKey = Object.keys(categoryStyles).find((item) => key.includes(item));
  return categoryStyles[matchedKey] || categoryStyles.akademik;
}

function getCategoryAccentColor(category) {
  const key = normalizeText(category);
  if (key.includes("sınav")) return "#DC2626";
  if (key.includes("kayıt")) return "#2563EB";
  if (key.includes("muafiyet")) return "#059669";
  if (key.includes("mezuniyet")) return "#7C3AED";
  if (key.includes("başvuru")) return "#EA580C";
  return "#64748B";
}

function dateOnly(date) {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

function eventIncludesDay(event, day) {
  const start = dateOnly(event.baslangic);
  const end = dateOnly(event.bitis || event.baslangic);
  const target = dateOnly(day);
  return target >= start && target <= end;
}

function eventSpansMonthDate(event, monthDate) {
  const start = dateOnly(event.baslangic);
  const end = dateOnly(event.bitis || event.baslangic);
  const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);

  return start <= monthEnd && end >= monthStart;
}

function buildMonthGrid(monthDate) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - startOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + index);
    return day;
  });
}

function getAcademicYearStart(events) {
  const years = events
    .map((event) => new Date(event.baslangic))
    .filter((date) => !Number.isNaN(date.getTime()))
    .map((date) => (date.getMonth() >= 8 ? date.getFullYear() : date.getFullYear() - 1));

  return years.length > 0
    ? Math.max(minimumAcademicYearStart, Math.min(...years))
    : minimumAcademicYearStart;
}

function buildVisibleMonthDates(events, academicYearStart) {
  const start = new Date(academicYearStart, 8, 1);
  const defaultEnd = new Date(academicYearStart + 1, 7, 1);
  const latestEventMonth = events
    .map((event) => new Date(event.bitis || event.baslangic))
    .filter((date) => !Number.isNaN(date.getTime()))
    .map((date) => new Date(date.getFullYear(), date.getMonth(), 1))
    .reduce((latest, date) => (date > latest ? date : latest), defaultEnd);
  const months = [];
  const cursor = new Date(start);

  while (cursor <= latestEventMonth) {
    months.push(new Date(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return months;
}

function AkademikTakvim() {
  const { records: events, addRecord, upsertRecords, clearRecords } = useStoredCollection(
    "akademikTakvimRecords",
    takvimData,
  );
  const { records: operations } = useStoredCollection("operasyonRecords", operasyonData);
  const fileInputRef = useRef(null);
  const [viewMode, setViewMode] = useState("Yıllık");
  const [selectedMonth, setSelectedMonth] = useState(() => new Date(2026, 8, 1));
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [previewRows, setPreviewRows] = useState([]);
  const [importError, setImportError] = useState("");

  const calendarEvents = previewRows.length > 0 ? previewRows : events;
  const academicYearStart = useMemo(() => getAcademicYearStart(calendarEvents), [calendarEvents]);
  const visibleMonthDates = useMemo(
    () => buildVisibleMonthDates(calendarEvents, academicYearStart),
    [academicYearStart, calendarEvents],
  );

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => {
      if (name === "baslangic" && prev.bitis && value > prev.bitis) {
        return { ...prev, [name]: value, bitis: value };
      }
      return { ...prev, [name]: value };
    });
  };

  const handleOperationToggle = (operationId) => {
    setFormData((prev) => {
      const currentIds = prev.operasyonIds || [];
      return {
        ...prev,
        operasyonIds: currentIds.includes(operationId)
          ? currentIds.filter((id) => id !== operationId)
          : [...currentIds, operationId],
      };
    });
  };

  const buildEventFromRow = (row, index) => {
    const ad = String(getValue(row, columnAliases.ad) || "").trim();
    const baslangic = normalizeDate(getValue(row, columnAliases.baslangic));
    const bitis = normalizeDate(getValue(row, columnAliases.bitis)) || baslangic;

    if (!ad || !baslangic || !bitis) {
      return null;
    }

    return {
      id: `excel-preview-${Date.now()}-${index}`,
      ad,
      baslangic,
      bitis,
      kategori: String(getValue(row, columnAliases.kategori) || "Akademik").trim(),
      donem: String(getValue(row, columnAliases.donem) || "Belirtilmedi").trim(),
      kritiklik: String(getValue(row, columnAliases.kritiklik) || "orta")
        .trim()
        .toLocaleLowerCase("tr-TR"),
      aciklama: "",
      operasyonIds: inferOperationIds(ad, operations),
    };
  };

  const buildEventFromArrayRow = (row, index, matchedColumns, sectionTitle = "") => {
    const rawName = String(row[matchedColumns.ad] || "").trim();
    const startValue =
      matchedColumns.baslangic !== -1 ? row[matchedColumns.baslangic] : row[matchedColumns.bitis];
    const endValue = matchedColumns.bitis !== -1 ? row[matchedColumns.bitis] : "";
    const startRange = parseDateRange(startValue) || parseDateRange(rawName);
    const endRange = parseDateRange(endValue);
    const baslangic = startRange?.baslangic || "";
    const bitis = endRange?.bitis || startRange?.bitis || baslangic;
    const ad = startRange?.matchedText && !String(startValue || "").trim()
      ? cleanEventName(rawName, startRange.matchedText)
      : rawName;

    if (!ad || !baslangic || !bitis) {
      return null;
    }

    return {
      id: `excel-preview-${Date.now()}-${index}`,
      ad,
      baslangic,
      bitis,
      bolum: sectionTitle,
      kategori: inferCategoryFromText(
        ad,
        sectionTitle,
        String(row[matchedColumns.kategori] || "Akademik").trim(),
      ),
      donem: String(row[matchedColumns.donem] || "Belirtilmedi").trim(),
      kritiklik: String(row[matchedColumns.kritiklik] || "orta")
        .trim()
        .toLocaleLowerCase("tr-TR"),
      durum: "Planlandı",
      aciklama: "",
      operasyonIds: inferOperationIds(ad, operations),
    };
  };

  const parseSheetRows = (sheetRows) => {
    const headerInfo = findHeaderInfo(sheetRows);
    if (!headerInfo) {
      return { headerInfo: null, parsedRows: [] };
    }

    const firstDataRowIndex = headerInfo.fallbackTwoColumns ? 0 : headerInfo.headerRowIndex + 1;
    let currentSectionTitle = "";
    const parsedRows = [];

    sheetRows.slice(firstDataRowIndex).forEach((row, index) => {
      const rawName = String(row[headerInfo.matchedColumns.ad] || "").trim();
      const startValue =
        headerInfo.matchedColumns.baslangic !== -1
          ? row[headerInfo.matchedColumns.baslangic]
          : row[headerInfo.matchedColumns.bitis];
      const rowHasDate = parseDateRange(startValue) || parseDateRange(rawName);

      if (!rowHasDate && isLikelySectionHeader(rawName)) {
        currentSectionTitle = normalizeSectionTitle(rawName);
        return;
      }

      const parsedRow = buildEventFromArrayRow(row, index, headerInfo.matchedColumns, currentSectionTitle);
      if (parsedRow) {
        parsedRows.push(parsedRow);
      }
    });

    return { headerInfo, parsedRows };
  };

  const handleExcelFile = async (event) => {
    const file = event.target.files?.[0];
    setImportError("");
    setPreviewRows([]);

    if (!file) {
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
      const parsedSheets = workbook.SheetNames.map((sheetName) => {
        const sheet = workbook.Sheets[sheetName];
        const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", blankrows: false });
        const result = parseSheetRows(rawRows);
        return { sheetName, ...result };
      });
      const bestSheet = parsedSheets.sort((a, b) => b.parsedRows.length - a.parsedRows.length)[0];

      if (!bestSheet?.headerInfo) {
        setImportError(
          "Excel dosyasında Olay ve Tarih alanları bulunamadı. Lütfen dosyada Olay, Başlangıç Tarihi ve Bitiş Tarihi başlıklı sütunlar olduğundan emin olun.",
        );
        return;
      }

      console.log("Akademik takvim Excel import", {
        sheetName: bestSheet.sheetName,
        headerRowIndex: bestSheet.headerInfo.headerRowIndex,
        matchedColumns: bestSheet.headerInfo.matchedColumns,
      });

      const parsedRows = bestSheet.parsedRows;

      if (parsedRows.length === 0) {
        setImportError(
          "Excel dosyasında Olay ve Tarih alanları bulunamadı. Lütfen dosyada Olay, Başlangıç Tarihi ve Bitiş Tarihi başlıklı sütunlar olduğundan emin olun.",
        );
        return;
      }

      setPreviewRows(parsedRows);
      setViewMode("Yıllık");
      setSuccessMessage("Excel önizlemesi takvime yerleştirildi. Kalıcı kaydetmek için İçe Aktar seçin.");
    } catch {
      setImportError("Excel dosyası okunamadı. Lütfen .xlsx formatını ve sütun başlıklarını kontrol edin.");
    } finally {
      event.target.value = "";
    }
  };

  const importPreviewRows = () => {
    const rowsToSave = previewRows.map((item, index) => ({
      ...item,
      id: item.id?.startsWith("excel-preview")
        ? `excel-${item.ad}-${item.baslangic}-${index}`.replace(/\s+/g, "-")
        : item.id,
    }));

    if (rowsToSave.length === 0) {
      setImportError("İçe aktarılacak kayıt bulunamadı.");
      return;
    }

    upsertRecords(rowsToSave, (item) => `${item.ad}__${item.baslangic}`);
    setPreviewRows([]);
    setViewMode("Yıllık");
    setSuccessMessage("Akademik takvim olayları kaydedildi.");
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setFormError("");

    if (!formData.ad || !formData.baslangic || !formData.bitis || !formData.kategori || !formData.donem) {
      setFormError("Lütfen zorunlu alanları doldurun.");
      return;
    }

    if (formData.bitis < formData.baslangic) {
      setFormError("Bitiş tarihi başlangıç tarihinden önce olamaz.");
      return;
    }

    addRecord({
      id: `user-${Date.now()}`,
      ...formData,
    });
    setFormData(emptyForm);
    setModalOpen(false);
    setSuccessMessage("Akademik olay eklendi.");
  };

  // Aylık görünüm için seçili ayın günlerini yeniden hesapla
  const monthGridDays = buildMonthGrid(selectedMonth);
  const selectedMonthEvents = calendarEvents.filter((e) => eventSpansMonthDate(e, selectedMonth));

  return (
    <div className="space-y-5">
      <SuccessMessage>{successMessage}</SuccessMessage>
      {importError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{importError}</div>
      )}

      {/* Excel önizleme bandı */}
      {previewRows.length > 0 && (
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-[#00377B]/30 bg-[#EEF3FA] px-5 py-4">
          <div>
            <p className="font-semibold text-[#1F2D5C]">{previewRows.length} kayıt takvime önizlendi</p>
            <p className="mt-0.5 text-sm text-slate-500">Kalıcı kaydetmek için "İçe Aktar"a tıklayın.</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button type="button" onClick={importPreviewRows}
              className="rounded-xl bg-[#00377B] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1F2D5C]">
              İçe Aktar
            </button>
            <button type="button" onClick={() => setPreviewRows([])}
              className="rounded-xl border border-[#D6DEEA] bg-white px-4 py-2.5 text-sm font-medium text-slate-600">
              İptal
            </button>
          </div>
        </div>
      )}

      {/* Üst araç çubuğu */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Akademik Takvim</p>
          <h2 className="text-xl font-bold text-[#1F2D5C]">2026-2027 Akademik Yılı</h2>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleExcelFile} className="hidden" />
          <button type="button" onClick={() => fileInputRef.current?.click()}
            className="rounded-xl border border-[#D6DEEA] bg-white px-3 py-2 text-sm font-medium text-[#1F2D5C] hover:border-[#00377B]">
            Excel Yükle
          </button>
          <button type="button" onClick={() => setModalOpen(true)}
            className="rounded-xl bg-[#00377B] px-3 py-2 text-sm font-medium text-white hover:bg-[#1F2D5C]">
            + Olay Ekle
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm("Kullanıcı tarafından içe aktarılan takvim kayıtları silinecek. Demo kayıtlar korunur. Devam?")) {
                clearRecords();
                setPreviewRows([]);
                setSuccessMessage("İçe aktarılan takvim kayıtları temizlendi. Demo kayıtlar korunur.");
              }
            }}
            className="rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Sıfırla
          </button>
          <div className="flex rounded-xl border border-[#D6DEEA] bg-[#F8FAFD] p-0.5">
            {["Yıllık", "Aylık", "Liste"].map((v) => (
              <button key={v} type="button" onClick={() => setViewMode(v)}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${viewMode === v ? "bg-[#00377B] text-white" : "text-[#1F2D5C] hover:bg-white"}`}>
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Yıllık: 4×3 ay ızgarası */}
      {viewMode === "Yıllık" && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {visibleMonthDates.map((monthDate) => {
            const monthEvents = calendarEvents.filter((e) => eventSpansMonthDate(e, monthDate));
            const days = buildMonthGrid(monthDate);
            const isSelected = monthDate.getFullYear() === selectedMonth.getFullYear() &&
              monthDate.getMonth() === selectedMonth.getMonth();

            return (
              <div
                key={`${monthDate.getFullYear()}-${monthDate.getMonth()}`}
                onClick={() => { setSelectedMonth(monthDate); setViewMode("Aylık"); }}
                className={`cursor-pointer rounded-2xl border p-4 shadow-sm transition hover:border-[#00377B] hover:shadow-md ${
                  isSelected ? "border-[#00377B] bg-[#EEF3FA]" : "border-[#E5E7EB] bg-white"
                }`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-bold capitalize text-[#1F2D5C]">
                    {monthFormatter.format(monthDate)}
                  </h3>
                  {monthEvents.length > 0 && (
                    <span className="rounded-full bg-[#00377B] px-2 py-0.5 text-[10px] font-bold text-white">
                      {monthEvents.length}
                    </span>
                  )}
                </div>
                {/* Mini takvim */}
                <div className="grid grid-cols-7 text-center">
                  {weekDays.map((d) => <span key={d} className="text-[9px] text-slate-400">{d}</span>)}
                </div>
                <div className="mt-1 grid grid-cols-7 gap-y-0.5">
                  {days.map((day) => {
                    const inMonth = day.getMonth() === monthDate.getMonth();
                    const dayEvts = monthEvents.filter((e) => eventIncludesDay(e, day));
                    const color = dayEvts[0] ? getCategoryAccentColor(dayEvts[0].kategori) : null;
                    return (
                      <div key={day.toISOString()} className="relative flex flex-col items-center">
                        <span className={`text-[10px] ${inMonth ? "text-slate-600 font-medium" : "text-slate-200"}`}>
                          {day.getDate()}
                        </span>
                        {color && inMonth && (
                          <span className="h-1 w-1 rounded-full" style={{ backgroundColor: color }} />
                        )}
                      </div>
                    );
                  })}
                </div>
                {/* Ay etkinlik özeti */}
                {monthEvents.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {monthEvents.map((e) => {
                      const s = getCategoryStyle(e.kategori);
                      return (
                        <div key={e.id} className={`rounded-md border-l-2 ${s.border} ${s.bg} px-2 py-1.5`}>
                          <p className={`line-clamp-1 text-xs font-semibold leading-snug ${s.text}`}>{e.ad}</p>
                          <p className="mt-0.5 text-[10px] text-slate-500">
                            {shortMonthFormatter.format(new Date(e.baslangic))}
                            {e.bitis !== e.baslangic ? ` – ${shortMonthFormatter.format(new Date(e.bitis))}` : ""}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Aylık: Tam takvim görünümü */}
      {viewMode === "Aylık" && (
        <div className="rounded-2xl border border-[#E5E7EB] bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-[#E5E7EB] px-5 py-4">
            <h3 className="text-lg font-bold capitalize text-[#1F2D5C]">{monthFormatter.format(selectedMonth)}</h3>
            <div className="flex gap-2">
              <button type="button"
                onClick={() => setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1, 1))}
                className="rounded-lg border border-[#D6DEEA] px-3 py-1.5 text-sm text-[#1F2D5C] hover:border-[#00377B]">‹ Önceki</button>
              <button type="button"
                onClick={() => setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 1))}
                className="rounded-lg border border-[#D6DEEA] px-3 py-1.5 text-sm text-[#1F2D5C] hover:border-[#00377B]">Sonraki ›</button>
            </div>
          </div>
          <div className="overflow-x-auto p-4">
            <div className="grid min-w-[700px] grid-cols-7">
              {["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"].map((d) => (
                <div key={d} className="border-b border-[#E5E7EB] bg-[#EEF3FA] py-2 text-center text-xs font-semibold text-[#1F2D5C]">{d}</div>
              ))}
              {monthGridDays.map((day) => {
                const inMonth = day.getMonth() === selectedMonth.getMonth();
                const dayEvts = selectedMonthEvents.filter((e) => eventIncludesDay(e, day));
                return (
                  <div key={day.toISOString()} className={`min-h-28 border-b border-r border-[#E5E7EB] p-1.5 ${inMonth ? "bg-white" : "bg-slate-50"}`}>
                    <p className={`mb-1 text-xs font-semibold ${inMonth ? "text-[#1F2D5C]" : "text-slate-300"}`}>{day.getDate()}</p>
                    <div className="space-y-1">
                      {dayEvts.slice(0, 2).map((e) => {
                        const s = getCategoryStyle(e.kategori);
                        return (
                          <div key={e.id} className={`rounded border-l-2 ${s.border} ${s.bg} px-1.5 py-0.5`}>
                            <p className={`line-clamp-1 text-[10px] font-semibold ${s.text}`}>{e.ad}</p>
                          </div>
                        );
                      })}
                      {dayEvts.length > 2 && <p className="text-[10px] text-slate-400">+{dayEvts.length - 2}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Liste görünümü */}
      {viewMode === "Liste" && (
        <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-sm">
          <table className="min-w-full divide-y divide-[#E5E7EB] text-sm">
            <thead className="bg-[#F8FAFD]">
              <tr className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3 text-left">Olay</th>
                <th className="px-4 py-3 text-left">Tarih Aralığı</th>
                <th className="px-4 py-3 text-left">Kategori</th>
                <th className="px-4 py-3 text-left">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2F7]">
              {calendarEvents
                .slice()
                .filter((item) => {
                  const d = new Date(item.baslangic);
                  return !isNaN(d.getTime()) && d.getFullYear() >= 2024;
                })
                .sort((a, b) => new Date(a.baslangic) - new Date(b.baslangic))
                .map((item) => {
                  const alert = getCalendarAlert(item);
                  const s = getCategoryStyle(item.kategori);
                  const startD = new Date(item.baslangic);
                  const endD = item.bitis ? new Date(item.bitis) : null;
                  const validEnd = endD && !isNaN(endD.getTime()) && endD.getFullYear() >= 2024;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3 font-medium text-[#1F2D5C]">{item.ad}</td>
                      <td className="px-4 py-3 text-slate-600 text-sm">
                        {dateFormatter.format(startD)}
                        {validEnd && endD.toDateString() !== startD.toDateString() && (
                          <span className="text-slate-400"> – {dateFormatter.format(endD)}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${s.bg} ${s.text}`}>{item.kategori}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={alert.tone}>{alert.label}</Badge>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}

      {/* Olay ekleme modalı */}
      {modalOpen && (
        <FormModal title="Akademik Olay Ekle" onClose={() => setModalOpen(false)} onSubmit={handleSubmit} error={formError}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm text-slate-600 md:col-span-2">
              <span>Olay adı</span>
              <input required name="ad" value={formData.ad} onChange={handleChange} className="w-full rounded-xl border border-[#D6DEEA] px-4 py-3 outline-none" />
            </label>
            <label className="space-y-2 text-sm text-slate-600">
              <span>Kategori</span>
              <select name="kategori" value={formData.kategori} onChange={handleChange} className="w-full rounded-xl border border-[#D6DEEA] px-4 py-3 outline-none">
                <option value="">Seçin</option>
                <option>Sınav</option><option>Kayıt</option><option>Muafiyet</option>
                <option>Mezuniyet</option><option>Başvuru</option><option>Akademik</option>
              </select>
            </label>
            <label className="space-y-2 text-sm text-slate-600">
              <span>Dönem</span>
              <select name="donem" value={formData.donem} onChange={handleChange} className="w-full rounded-xl border border-[#D6DEEA] px-4 py-3 outline-none">
                <option value="">Seçin</option>
                <option>2026-2027 Güz</option><option>2026-2027 Bahar</option><option>2026-2027 Yaz</option>
              </select>
            </label>
            <label className="space-y-2 text-sm text-slate-600">
              <span>Başlangıç</span>
              <input required type="date" name="baslangic" value={formData.baslangic} onChange={handleChange} className="w-full rounded-xl border border-[#D6DEEA] px-4 py-3 outline-none" />
            </label>
            <label className="space-y-2 text-sm text-slate-600">
              <span>Bitiş</span>
              <input required type="date" name="bitis" min={formData.baslangic} value={formData.bitis} onChange={handleChange} className="w-full rounded-xl border border-[#D6DEEA] px-4 py-3 outline-none" />
            </label>
            <label className="space-y-2 text-sm text-slate-600">
              <span>Kritiklik</span>
              <select name="kritiklik" value={formData.kritiklik} onChange={handleChange} className="w-full rounded-xl border border-[#D6DEEA] px-4 py-3 outline-none">
                <option value="yüksek">yüksek</option>
                <option value="orta">orta</option>
                <option value="düşük">düşük</option>
              </select>
            </label>
            <label className="space-y-2 text-sm text-slate-600">
              <span>Durum</span>
              <select name="durum" value={formData.durum} onChange={handleChange} className="w-full rounded-xl border border-[#D6DEEA] px-4 py-3 outline-none">
                <option>Planlandı</option>
                <option>Devam Ediyor</option>
                <option>Beklemede</option>
                <option>Tamamlandı</option>
                <option>Riskli</option>
              </select>
            </label>
          </div>
          <label className="block space-y-2 text-sm text-slate-600">
            <span>Açıklama</span>
            <textarea name="aciklama" rows="3" value={formData.aciklama} onChange={handleChange}
              placeholder="Olayla ilgili kısa not veya koordinasyon bilgisi" className="w-full rounded-xl border border-[#D6DEEA] px-4 py-3 outline-none" />
          </label>
          <div className="rounded-2xl border border-[#D6DEEA] bg-[#F8FAFD] p-4">
            <p className="mb-3 text-sm font-semibold text-[#1F2D5C]">İlgili operasyonlar</p>
            <div className="grid gap-2 md:grid-cols-2">
              {operations.map((operation) => {
                const operationId = String(operation.id);
                const checked = (formData.operasyonIds || []).includes(operationId);
                return (
                  <label key={operation.id} className={`flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2 text-xs transition ${
                    checked ? "border-[#00377B] bg-white text-[#00377B]" : "border-[#E5E7EB] bg-white text-slate-600"
                  }`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleOperationToggle(operationId)}
                      className="mt-0.5 h-4 w-4"
                    />
                    <span className="font-medium leading-5">{operation.ad}</span>
                  </label>
                );
              })}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)}
              className="rounded-xl border border-[#D6DEEA] px-4 py-3 text-sm font-medium text-slate-600">Vazgeç</button>
            <button type="submit"
              className="rounded-xl bg-[#00377B] px-4 py-3 text-sm font-medium text-white">Kaydet</button>
          </div>
        </FormModal>
      )}
    </div>
  );
}

export default AkademikTakvim;

import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import Badge from "../components/Badge";
import FormModal from "../components/FormModal";
import SuccessMessage from "../components/SuccessMessage";
import useStoredCollection from "../hooks/useStoredCollection";
import takvimData from "../data/akademik-takvim.json";
import operasyonData from "../data/operasyon-kutuphanesi.json";
import { canEditData } from "../utils/auth";
import { getCalendarAlert, inferOperationIds, normalizeDate } from "../utils/calendar";
import { getSharedStorageDebugInfo, isSharedStorageEnabled, upsertSharedRecords } from "../utils/sharedStorage";

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

const audioStorageKey = "akademikTakvimSesliUyariAktif";
const audioNoticeStorageKey = "akademikTakvimSonSesliUyari";

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

  // Boş, çok kısa veya tarih içeriyorsa section header değil
  if (!text || text.length < 4 || parseDateRange(text)) return false;

  // Kesinlikle section header olmayan kalıplar
  const notHeaders = [
    "sakarya üniversitesi", "akademik takvimi", "ögr.", "öğr.",
    "güz yarıyılı", "bahar yarıyılı", "yaz okulu dönemi",
    "yarıyılı takvimi", "akademik yılı",
  ];
  if (notHeaders.some((h) => normalized.includes(h))) return false;
  if (normalized.startsWith("t.c.") || normalized.startsWith("(*")) return false;
  if (/^\d+$/.test(normalized)) return false;

  // Section header olduğuna dair pozitif işaretler
  const sectionKeywords = [
    "dönem", "yarıyıl", "yıl", "takvim", "program", "bölüm",
    "fakülte", "enstitü", "okul", "güz", "bahar", "yaz dönemi",
  ];
  if (sectionKeywords.some((k) => normalized.includes(k))) return true;

  // Tamamen büyük harf yazılmışsa (Türkçe) — kurumsal başlık
  if (text.length > 4 && text === text.toLocaleUpperCase("tr-TR")) return true;

  // Belirsizse section header SAYMA.
  // Tarihsiz satır zaten event olarak import edilmez (baslangic boş → null döner).
  return false;
}

function isAcademicPeriodTitle(value) {
  const normalized = normalizeText(value);
  return (
    normalized.includes("güz yarıyılı") ||
    normalized.includes("bahar yarıyılı") ||
    normalized.includes("yaz okulu dönemi") ||
    normalized.includes("yarıyılı takvimi") ||
    normalized.includes("akademik yılı")
  );
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
  sınav: {
    bg: "bg-[#FFF4EA]",
    text: "text-[#9A4A00]",
    border: "border-[#F58220]",
    dot: "bg-[#F58220]",
  },
  kayıt: {
    bg: "bg-[#EEF3FA]",
    text: "text-[#00377B]",
    border: "border-[#00377B]",
    dot: "bg-[#00377B]",
  },
  muafiyet: {
    bg: "bg-[#EEF7F0]",
    text: "text-[#1F4D2C]",
    border: "border-[#1F4D2C]",
    dot: "bg-[#1F4D2C]",
  },
  mezuniyet: {
    bg: "bg-[#F4F7FB]",
    text: "text-[#1F2D5C]",
    border: "border-[#1F2D5C]",
    dot: "bg-[#1F2D5C]",
  },
  başvuru: {
    bg: "bg-[#FFF8F1]",
    text: "text-[#9A4A00]",
    border: "border-[#F58220]",
    dot: "bg-[#F58220]",
  },
  akademik: {
    bg: "bg-[#F8FAFD]",
    text: "text-[#1F2D5C]",
    border: "border-[#BFD0E6]",
    dot: "bg-[#7A8AA6]",
  },
};

function getCategoryStyle(category) {
  const key = normalizeText(category);
  const matchedKey = Object.keys(categoryStyles).find((item) => key.includes(item));
  return categoryStyles[matchedKey] || categoryStyles.akademik;
}

function getCategoryAccentColor(category) {
  const key = normalizeText(category);
  if (key.includes("sınav")) return "#F58220";
  if (key.includes("kayıt")) return "#00377B";
  if (key.includes("muafiyet")) return "#1F4D2C";
  if (key.includes("mezuniyet")) return "#1F2D5C";
  if (key.includes("başvuru")) return "#F58220";
  return "#7A8AA6";
}

function CalendarSyncStatus({ syncStatus, count, debugInfo }) {
  const states = {
    "ortak-veri-aktif": {
      label: `Ortak veri aktif · ${count} kayıt`,
      className: "border-[#BDEFD1] bg-[#F0FFF6] text-[#1F4D2C]",
    },
    "ortak-veri-hatasi": {
      label: `Ortak veri bağlantısı kurulamadı · Anahtar: ${debugInfo.keyType}`,
      className: "border-red-200 bg-red-50 text-red-700",
    },
    "ortak-veri-baglaniyor": {
      label: "Ortak veri bağlanıyor",
      className: "border-[#BFD0E6] bg-[#EEF3FA] text-[#00377B]",
    },
    yerel: {
      label: `Yerel mod · URL ${debugInfo.hasUrl ? "var" : "yok"} / Key ${debugInfo.hasKey ? "var" : "yok"}`,
      className: "border-[#E5E7EB] bg-white text-[#60708B]",
    },
  };
  const state = states[syncStatus] || states.yerel;

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold ${state.className}`}>
      {state.label}
    </span>
  );
}

async function playAcademicAlertTone() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) {
    return;
  }

  const context = new AudioContext();
  if (context.state === "suspended") {
    await context.resume();
  }

  const notes = [
    { frequency: 740, start: 0, duration: 0.12 },
    { frequency: 988, start: 0.16, duration: 0.16 },
  ];

  notes.forEach((note) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(note.frequency, context.currentTime + note.start);
    gain.gain.setValueAtTime(0.0001, context.currentTime + note.start);
    gain.gain.exponentialRampToValueAtTime(0.16, context.currentTime + note.start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + note.start + note.duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(context.currentTime + note.start);
    oscillator.stop(context.currentTime + note.start + note.duration + 0.02);
  });

  window.setTimeout(() => context.close(), 600);
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

function safeColumnValue(row, columnIndex, fallback = "") {
  return columnIndex !== -1 ? row[columnIndex] : fallback;
}

function AkademikTakvim() {
  const editable = canEditData();
  const sharedDebugInfo = getSharedStorageDebugInfo();
  const { records: events, addRecord, upsertRecords, clearRecords, syncStatus } = useStoredCollection(
    "akademikTakvimRecords",
    takvimData,
  );
  const { records: operations } = useStoredCollection("operasyonRecords", operasyonData);
  const fileInputRef = useRef(null);
  const [viewMode, setViewMode] = useState("Yıllık");
  const [selectedMonth, setSelectedMonth] = useState(() => new Date(2026, 8, 1));
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [previewRows, setPreviewRows] = useState([]);
  const [importError, setImportError] = useState("");
  const [importReport, setImportReport] = useState(null);

  const calendarEvents = (previewRows.length > 0 ? previewRows : events).filter(
    (event) => !isAcademicPeriodTitle(event.ad),
  );
  const academicYearStart = useMemo(() => getAcademicYearStart(calendarEvents), [calendarEvents]);
  const visibleMonthDates = useMemo(
    () => buildVisibleMonthDates(calendarEvents, academicYearStart),
    [academicYearStart, calendarEvents],
  );
  const [audioAlertsEnabled, setAudioAlertsEnabled] = useState(() => {
    try {
      return localStorage.getItem(audioStorageKey) === "true";
    } catch {
      return false;
    }
  });
  const [audioAlertMessage, setAudioAlertMessage] = useState("");
  const audibleAlerts = useMemo(
    () =>
      calendarEvents
        .map((item) => ({ ...item, alert: getCalendarAlert(item) }))
        .filter((item) => ["kritik", "dikkat", "devam"].includes(item.alert.level))
        .sort((a, b) => {
          const order = { kritik: 0, devam: 1, dikkat: 2 };
          return order[a.alert.level] - order[b.alert.level] || new Date(a.baslangic) - new Date(b.baslangic);
        }),
    [calendarEvents],
  );
  const audioAlertSignature = audibleAlerts
    .slice(0, 5)
    .map((item) => `${item.id}-${item.alert.level}-${item.baslangic}`)
    .join("|");

  useEffect(() => {
    if (!audioAlertsEnabled || !audioAlertSignature) {
      return;
    }

    const todayKey = new Date().toISOString().slice(0, 10);
    const noticeKey = `${todayKey}:${audioAlertSignature}`;
    const lastNoticeKey = localStorage.getItem(audioNoticeStorageKey);
    if (lastNoticeKey === noticeKey) {
      return;
    }

    playAcademicAlertTone()
      .then(() => {
        localStorage.setItem(audioNoticeStorageKey, noticeKey);
        setAudioAlertMessage(`${audibleAlerts.length} yaklaşan/aktif akademik olay için sesli uyarı verildi.`);
      })
      .catch(() => {
        setAudioAlertMessage("Ses çalmak için tarayıcı kullanıcı etkileşimi isteyebilir. Lütfen düğmeye tekrar basın.");
      });
  }, [audibleAlerts.length, audioAlertsEnabled, audioAlertSignature]);

  const toggleAudioAlerts = async () => {
    const nextValue = !audioAlertsEnabled;
    setAudioAlertsEnabled(nextValue);
    localStorage.setItem(audioStorageKey, String(nextValue));

    if (!nextValue) {
      setAudioAlertMessage("Sesli uyarılar kapatıldı.");
      return;
    }

    if (audibleAlerts.length === 0) {
      setAudioAlertMessage("Sesli uyarılar açıldı. Şu an kritik veya yakın tarihli akademik olay yok.");
      return;
    }

    try {
      await playAcademicAlertTone();
      localStorage.removeItem(audioNoticeStorageKey);
      setAudioAlertMessage(`${audibleAlerts.length} yaklaşan/aktif akademik olay için sesli uyarılar açıldı.`);
    } catch {
      setAudioAlertMessage("Ses başlatılamadı. Tarayıcı izin vermediyse düğmeye tekrar basın.");
    }
  };

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
        String(safeColumnValue(row, matchedColumns.kategori, "Akademik")).trim(),
      ),
      donem: String(safeColumnValue(row, matchedColumns.donem, "Belirtilmedi")).trim(),
      kritiklik: String(safeColumnValue(row, matchedColumns.kritiklik, "orta"))
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
      return { headerInfo: null, parsedRows: [], skippedRows: [], totalDataRows: 0 };
    }

    const firstDataRowIndex = headerInfo.fallbackTwoColumns
      ? headerInfo.firstDataRowIndex || 0
      : headerInfo.headerRowIndex + 1;
    let currentSectionTitle = "";
    const parsedRows = [];
    const skippedRows = [];
    let totalDataRows = 0;

    sheetRows.slice(firstDataRowIndex).forEach((row, index) => {
      const rowNumber = firstDataRowIndex + index + 1;
      const hasContent = row.some((cell) => String(cell || "").trim());
      if (!hasContent) {
        return;
      }

      const rawName = String(row[headerInfo.matchedColumns.ad] || "").trim();
      const startValue =
        headerInfo.matchedColumns.baslangic !== -1
          ? row[headerInfo.matchedColumns.baslangic]
          : row[headerInfo.matchedColumns.bitis];
      const rowHasDate = parseDateRange(startValue) || parseDateRange(rawName);

      if (!rowHasDate && isLikelySectionHeader(rawName)) {
        currentSectionTitle = normalizeSectionTitle(rawName);
        skippedRows.push({
          rowNumber,
          neden: "Bölüm/kategori başlığı olarak algılandı",
          deger: rawName,
        });
        return;
      }

      totalDataRows += 1;
      const parsedRow = buildEventFromArrayRow(row, index, headerInfo.matchedColumns, currentSectionTitle);
      if (parsedRow && !isAcademicPeriodTitle(parsedRow.ad)) {
        parsedRows.push(parsedRow);
        return;
      }

      skippedRows.push({
        rowNumber,
        neden: parsedRow ? "Akademik dönem başlığı olduğu için takvime eklenmedi" : "Olay adı veya tarih okunamadı",
        deger: row
          .filter((cell) => String(cell || "").trim())
          .join(" | ")
          .slice(0, 180),
      });
    });

    return { headerInfo, parsedRows, skippedRows, totalDataRows };
  };

  const handleExcelFile = async (event) => {
    const file = event.target.files?.[0];
    setImportError("");
    setPreviewRows([]);
    setImportReport(null);

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
        return { sheetName, totalRows: rawRows.length, ...result };
      });
      const readableSheets = parsedSheets.filter((sheet) => sheet.headerInfo);

      if (readableSheets.length === 0) {
        setImportError(
          "Excel dosyasında Olay ve Tarih alanları bulunamadı. Lütfen dosyada Olay, Başlangıç Tarihi ve Bitiş Tarihi başlıklı sütunlar olduğundan emin olun.",
        );
        return;
      }

      const parsedRows = readableSheets.flatMap((sheet) =>
        sheet.parsedRows.map((row) => ({
          ...row,
          kaynakSayfa: sheet.sheetName,
        })),
      );
      const skippedRows = readableSheets.flatMap((sheet) =>
        sheet.skippedRows.map((row) => ({
          ...row,
          sheetName: sheet.sheetName,
        })),
      );

      setImportReport({
        fileName: file.name,
        sheetName: readableSheets.map((sheet) => sheet.sheetName).join(", "),
        headerRowIndex: readableSheets.map((sheet) => `${sheet.sheetName}: ${sheet.headerInfo.headerRowIndex + 1}`).join(", "),
        matchedColumns: readableSheets.map((sheet) => sheet.headerInfo.matchedColumns),
        totalRows: readableSheets.reduce((total, sheet) => total + sheet.totalRows, 0),
        totalDataRows: readableSheets.reduce((total, sheet) => total + sheet.totalDataRows, 0),
        parsedCount: parsedRows.length,
        skippedRows,
      });

      if (parsedRows.length === 0) {
        setImportError(
          "Excel dosyasında Olay ve Tarih alanları bulunamadı. Lütfen dosyada Olay, Başlangıç Tarihi ve Bitiş Tarihi başlıklı sütunlar olduğundan emin olun.",
        );
        return;
      }

      setPreviewRows(parsedRows);
      setViewMode("Yıllık");
      setSuccessMessage("Excel önizlemesi takvime yerleştirildi. Diğer kullanıcıların görmesi için İçe Aktar'a basın.");
    } catch {
      setImportError("Excel dosyası okunamadı. Lütfen .xlsx formatını ve sütun başlıklarını kontrol edin.");
    } finally {
      event.target.value = "";
    }
  };

  const importPreviewRows = async () => {
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

    try {
      if (isSharedStorageEnabled()) {
        await upsertSharedRecords("akademikTakvimRecords", rowsToSave);
      }

      upsertRecords(rowsToSave, (item) => `${item.ad}__${item.baslangic}`);
      setPreviewRows([]);
      setImportReport(null);
      setViewMode("Yıllık");
      setImportError("");
      setSuccessMessage("Akademik takvim olayları ortak takvime kaydedildi. Diğer kullanıcıların ekranı kısa süre içinde otomatik güncellenir.");
    } catch (error) {
      console.error("Akademik takvim ortak veriye kaydedilemedi:", error);
      setImportError("Akademik takvim ortak veriye kaydedilemedi. Supabase API anahtarı, tablo izinleri veya internet bağlantısını kontrol edin.");
    }
  };

  const openEditModal = (event) => {
    setEditingEventId(event.id);
    setFormData({
      ad: event.ad || "",
      baslangic: event.baslangic || "",
      bitis: event.bitis || "",
      kategori: event.kategori || "",
      donem: event.donem || "",
      kritiklik: event.kritiklik || "orta",
      durum: event.durum || "Planlandı",
      aciklama: event.aciklama || "",
      operasyonIds: event.operasyonIds || [],
    });
    setModalOpen(true);
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

    if (editingEventId) {
      upsertRecords([{ ...formData, id: editingEventId }], (r) => r.id);
      setSuccessMessage("Akademik olay güncellendi.");
    } else {
      addRecord({ id: `user-${Date.now()}`, ...formData });
      setSuccessMessage("Akademik olay eklendi.");
    }
    setFormData(emptyForm);
    setEditingEventId(null);
    setModalOpen(false);
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
      {editable && previewRows.length > 0 && (
        <div className="rounded-2xl border border-[#00377B]/30 bg-[#EEF3FA] px-5 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="font-semibold text-[#1F2D5C]">{previewRows.length} kayıt takvime önizlendi</p>
              <p className="mt-0.5 text-sm text-slate-500">
                Bu aşamada yalnızca siz görürsünüz. Herkesin görmesi için "İçe Aktar"a tıklayın.
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button type="button" onClick={importPreviewRows}
                className="rounded-xl bg-[#00377B] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1F2D5C]">
                İçe Aktar
              </button>
              <button type="button" onClick={() => { setPreviewRows([]); setImportReport(null); }}
                className="rounded-xl border border-[#D6DEEA] bg-white px-4 py-2.5 text-sm font-medium text-slate-600">
                İptal
              </button>
            </div>
          </div>
          {importReport && (
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              {[
                { label: "Dosya", value: importReport.fileName },
                { label: "Sayfa", value: importReport.sheetName },
                { label: "Okunan satır", value: importReport.totalDataRows },
                { label: "Takvime yerleşen", value: importReport.parsedCount },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-white/70 bg-white px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{item.label}</p>
                  <p className="mt-1 truncate text-sm font-semibold text-[#1F2D5C]">{item.value}</p>
                </div>
              ))}
              {importReport.skippedRows?.length > 0 && (
                <details className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 md:col-span-4">
                  <summary className="cursor-pointer font-semibold">
                    {importReport.skippedRows.length} satır takvime eklenmedi, ayrıntıları göster
                  </summary>
                  <div className="mt-2 max-h-40 space-y-1 overflow-auto pr-2 text-xs">
                    {importReport.skippedRows.slice(0, 20).map((row) => (
                      <p key={`${row.sheetName || "sheet"}-${row.rowNumber}-${row.deger}`}>
                        <span className="font-semibold">
                          {row.sheetName ? `${row.sheetName} · ` : ""}Satır {row.rowNumber}:
                        </span>{" "}
                        {row.neden}
                        {row.deger ? <span className="text-amber-800"> · {row.deger}</span> : null}
                      </p>
                    ))}
                    {importReport.skippedRows.length > 20 && (
                      <p className="font-medium">İlk 20 satır gösteriliyor.</p>
                    )}
                  </div>
                </details>
              )}
            </div>
          )}
        </div>
      )}

      {/* Üst kontrol alanı */}
      <div className="overflow-hidden rounded-[1.6rem] border border-[#D6DEEA] bg-white shadow-sm">
        <div className="h-2 bg-gradient-to-r from-[#00377B] via-[#1F2D5C] to-[#F58220]" />
        <div className="flex flex-col gap-5 px-5 py-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#8A9AB5]">Akademik Takvim</p>
            <h2 className="mt-1 text-2xl font-extrabold text-[#1F2D5C]">2026-2027 Akademik Yılı</h2>
            <p className="mt-2 text-sm text-[#60708B]">
              Excel veya manuel girişlerden gelen olaylar akademik yıl aylarına otomatik yerleşir.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-[#D6DEEA] bg-[#F8FAFD] px-3 py-1.5 text-xs font-semibold text-[#1F2D5C]">
                {calendarEvents.length} takvim olayı
              </span>
              <span className="rounded-full border border-[#D6DEEA] bg-[#F8FAFD] px-3 py-1.5 text-xs font-semibold text-[#1F2D5C]">
                {visibleMonthDates.length} ay gösteriliyor
              </span>
              <CalendarSyncStatus syncStatus={syncStatus} count={events.length} debugInfo={sharedDebugInfo} />
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center xl:justify-end">
            {editable && (
              <>
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleExcelFile} className="hidden" />
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  className="rounded-xl border border-[#D6DEEA] bg-white px-4 py-2.5 text-sm font-bold text-[#1F2D5C] shadow-sm transition hover:border-[#00377B] hover:text-[#00377B]">
                  Excel Yükle
                </button>
                <button type="button" onClick={() => setModalOpen(true)}
                  className="rounded-xl bg-[#00377B] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#1F2D5C]">
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
                  className="rounded-xl border border-[#F2C8C8] bg-white px-4 py-2.5 text-sm font-bold text-[#B42318] shadow-sm transition hover:bg-red-50"
                >
                  Sıfırla
                </button>
              </>
            )}
            <div className="flex rounded-xl border border-[#D6DEEA] bg-[#F8FAFD] p-1 shadow-inner">
              {["Yıllık", "Aylık", "Liste"].map((v) => (
                <button key={v} type="button" onClick={() => setViewMode(v)}
                  className={`rounded-lg px-4 py-2 text-sm font-bold transition ${
                    viewMode === v ? "bg-[#00377B] text-white shadow-sm" : "text-[#1F2D5C] hover:bg-white"
                  }`}>
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className={`rounded-[1.35rem] border px-5 py-4 shadow-sm ${
        audibleAlerts.length > 0
          ? "border-[#F58220]/35 bg-[#FFF8F1]"
          : "border-[#D6DEEA] bg-white"
      }`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-lg ${
              audioAlertsEnabled ? "bg-[#00377B] text-white" : "bg-[#EEF3FA] text-[#00377B]"
            }`}>
              <span className="text-[11px] font-extrabold uppercase tracking-wide">Ses</span>
            </div>
            <div>
              <p className="text-sm font-extrabold text-[#1F2D5C]">Sesli akademik takvim uyarıları</p>
              <p className="mt-1 text-sm text-[#60708B]">
                {audibleAlerts.length > 0
                  ? `${audibleAlerts.length} olay dikkat gerektiriyor. Kritik, dikkat veya devam eden olaylarda kısa uyarı sesi verilir.`
                  : "Kritik veya yakın tarihli akademik olay olduğunda kısa bir uyarı sesi verilebilir."}
              </p>
              {audioAlertMessage && (
                <p className="mt-2 text-xs font-semibold text-[#1F4D2C]">{audioAlertMessage}</p>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {audibleAlerts[0] && (
              <div className="rounded-2xl border border-white bg-white/80 px-4 py-2 text-sm shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#8A9AB5]">İlk uyarı</p>
                <p className="mt-0.5 line-clamp-1 font-extrabold text-[#1F2D5C]">{audibleAlerts[0].ad}</p>
              </div>
            )}
            <button
              type="button"
              onClick={toggleAudioAlerts}
              className={`rounded-xl px-4 py-2.5 text-sm font-extrabold shadow-sm transition ${
                audioAlertsEnabled
                  ? "border border-[#D6DEEA] bg-white text-[#1F2D5C] hover:border-[#00377B]"
                  : "bg-[#00377B] text-white hover:bg-[#1F2D5C]"
              }`}
            >
              {audioAlertsEnabled ? "Sesli uyarıları kapat" : "Sesli uyarıları aç"}
            </button>
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

            const visibleEvents = monthEvents.slice(0, 5);
            const hiddenEventCount = Math.max(monthEvents.length - visibleEvents.length, 0);

            return (
              <div
                key={`${monthDate.getFullYear()}-${monthDate.getMonth()}`}
                onClick={() => { setSelectedMonth(monthDate); setViewMode("Aylık"); }}
                className={`group cursor-pointer overflow-hidden rounded-[1.35rem] border bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-[#00377B] hover:shadow-lg ${
                  isSelected ? "border-[#00377B] ring-2 ring-[#00377B]/10" : "border-[#E5E7EB]"
                }`}
              >
                <div className="h-1.5 bg-gradient-to-r from-[#00377B] via-[#1F2D5C] to-[#1F4D2C]" />
                <div className={`${isSelected ? "bg-[#F4F7FB]" : "bg-white"} p-4`}>
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-extrabold capitalize text-[#1F2D5C]">
                        {monthFormatter.format(monthDate)}
                      </h3>
                      <p className="mt-0.5 text-[11px] font-medium text-[#8A9AB5]">Aylık akademik plan</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${
                      monthEvents.length > 0 ? "bg-[#00377B] text-white" : "bg-[#F1F5F9] text-[#8A9AB5]"
                    }`}>
                      {monthEvents.length}
                    </span>
                  </div>
                  {/* Mini takvim */}
                  <div className="rounded-xl border border-[#E5EAF2] bg-[#F8FAFD] p-2.5">
                    <div className="grid grid-cols-7 text-center">
                      {weekDays.map((d) => <span key={d} className="text-[9px] font-bold text-[#8A9AB5]">{d}</span>)}
                    </div>
                    <div className="mt-1.5 grid grid-cols-7 gap-y-1">
                      {days.map((day) => {
                        const inMonth = day.getMonth() === monthDate.getMonth();
                        const dayEvts = monthEvents.filter((e) => eventIncludesDay(e, day));
                        const color = dayEvts[0] ? getCategoryAccentColor(dayEvts[0].kategori) : null;
                        return (
                          <div key={day.toISOString()} className="relative flex min-h-5 flex-col items-center justify-center">
                            <span className={`text-[10px] ${inMonth ? "font-bold text-[#42526E]" : "text-slate-200"}`}>
                              {day.getDate()}
                            </span>
                            {color && inMonth && (
                              <span className="mt-0.5 h-1.5 w-1.5 rounded-full shadow-sm" style={{ backgroundColor: color }} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
                {/* Ay etkinlik özeti */}
                {monthEvents.length > 0 && (
                  <div className="space-y-2 border-t border-[#EEF2F7] bg-white px-4 py-3">
                    {visibleEvents.map((e) => {
                      const s = getCategoryStyle(e.kategori);
                      return (
                        <div key={e.id} className={`rounded-xl border border-[#E5EAF2] border-l-4 ${s.border} ${s.bg} px-3 py-2`}>
                          <div className="flex items-start gap-2">
                            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${s.dot}`} />
                            <div className="min-w-0">
                              <p className={`line-clamp-1 text-xs font-extrabold leading-snug ${s.text}`}>{e.ad}</p>
                              <p className="mt-1 text-[10px] font-semibold text-[#60708B]">
                                {shortMonthFormatter.format(new Date(e.baslangic))}
                                {e.bitis !== e.baslangic ? ` – ${shortMonthFormatter.format(new Date(e.bitis))}` : ""}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {hiddenEventCount > 0 && (
                      <div className="rounded-xl border border-dashed border-[#BFD0E6] bg-[#F8FAFD] px-3 py-2 text-center text-xs font-bold text-[#00377B]">
                        +{hiddenEventCount} olay daha · Aylık takvimde görüntüle
                      </div>
                    )}
                  </div>
                )}
                {monthEvents.length === 0 && (
                  <div className="border-t border-[#EEF2F7] px-4 py-3 text-xs font-semibold text-[#8A9AB5]">
                    Bu ay için kayıt yok
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Aylık: Tam takvim görünümü */}
      {viewMode === "Aylık" && (
        <div className="overflow-hidden rounded-[1.6rem] border border-[#D6DEEA] bg-white shadow-sm">
          <div className="h-1.5 bg-gradient-to-r from-[#00377B] via-[#1F2D5C] to-[#1F4D2C]" />
          <div className="flex flex-col gap-3 border-b border-[#E5E7EB] px-5 py-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#8A9AB5]">Aylık Takvim</p>
              <h3 className="mt-1 text-xl font-extrabold capitalize text-[#1F2D5C]">{monthFormatter.format(selectedMonth)}</h3>
              <p className="mt-1 text-sm text-[#60708B]">{selectedMonthEvents.length} akademik olay bu ay içinde görünüyor.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button"
                onClick={() => setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1, 1))}
                className="rounded-xl border border-[#D6DEEA] bg-white px-3 py-2 text-sm font-bold text-[#1F2D5C] shadow-sm hover:border-[#00377B]">‹ Önceki</button>
              <button type="button"
                onClick={() => setSelectedMonth(new Date())}
                className="rounded-xl border border-[#D6DEEA] bg-[#F8FAFD] px-3 py-2 text-sm font-bold text-[#00377B] shadow-sm hover:border-[#00377B]">Bugün</button>
              <button type="button"
                onClick={() => setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 1))}
                className="rounded-xl border border-[#D6DEEA] bg-white px-3 py-2 text-sm font-bold text-[#1F2D5C] shadow-sm hover:border-[#00377B]">Sonraki ›</button>
            </div>
          </div>
          <div className="overflow-x-auto p-4">
            <div className="grid min-w-[760px] grid-cols-7 overflow-hidden rounded-2xl border border-[#E5EAF2]">
              {["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"].map((d) => (
                <div key={d} className="border-b border-[#E5E7EB] bg-[#EEF3FA] py-3 text-center text-xs font-extrabold text-[#1F2D5C]">{d}</div>
              ))}
              {monthGridDays.map((day) => {
                const inMonth = day.getMonth() === selectedMonth.getMonth();
                const dayEvts = selectedMonthEvents.filter((e) => eventIncludesDay(e, day));
                const isToday = dateOnly(day).getTime() === dateOnly(new Date()).getTime();
                return (
                  <div key={day.toISOString()} className={`min-h-32 border-b border-r border-[#E5E7EB] p-2 ${
                    inMonth ? "bg-white" : "bg-[#F8FAFD]"
                  }`}>
                    <div className="mb-2 flex items-center justify-between">
                      <p className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-extrabold ${
                        isToday ? "bg-[#00377B] text-white" : inMonth ? "text-[#1F2D5C]" : "text-slate-300"
                      }`}>{day.getDate()}</p>
                      {dayEvts.length > 0 && (
                        <span className="rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[10px] font-bold text-[#60708B]">
                          {dayEvts.length}
                        </span>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      {dayEvts.slice(0, 2).map((e) => {
                        const s = getCategoryStyle(e.kategori);
                        return (
                          <div key={e.id} className={`rounded-lg border border-l-4 ${s.border} ${s.bg} px-2 py-1.5`}>
                            <p className={`line-clamp-2 text-[10px] font-extrabold leading-snug ${s.text}`}>{e.ad}</p>
                            <p className="mt-0.5 text-[9px] font-semibold text-[#60708B]">
                              {shortMonthFormatter.format(new Date(e.baslangic))}
                              {e.bitis !== e.baslangic ? ` – ${shortMonthFormatter.format(new Date(e.bitis))}` : ""}
                            </p>
                          </div>
                        );
                      })}
                      {dayEvts.length > 2 && <p className="text-[10px] font-bold text-[#00377B]">+{dayEvts.length - 2} olay</p>}
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
                <th className="px-4 py-3 text-left"></th>
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
                      <td className="px-4 py-3">
                        {editable && (
                          <button type="button" onClick={() => openEditModal(item)}
                            className="rounded-lg border border-[#D6DEEA] px-2.5 py-1 text-xs font-medium text-[#1F2D5C] hover:border-[#00377B] hover:text-[#00377B]">
                            Düzenle
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}

      {/* Olay ekleme modalı */}
      {editable && modalOpen && (
        <FormModal
          title={editingEventId ? "Akademik Olay Düzenle" : "Akademik Olay Ekle"}
          onClose={() => { setModalOpen(false); setEditingEventId(null); setFormData(emptyForm); }}
          onSubmit={handleSubmit}
          error={formError}
        >
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
            <button type="button" onClick={() => { setModalOpen(false); setEditingEventId(null); setFormData(emptyForm); }}
              className="rounded-xl border border-[#D6DEEA] px-4 py-3 text-sm font-medium text-slate-600">Vazgeç</button>
            <button type="submit"
              className="rounded-xl bg-[#00377B] px-4 py-3 text-sm font-medium text-white">
              {editingEventId ? "Güncelle" : "Kaydet"}
            </button>
          </div>
        </FormModal>
      )}
    </div>
  );
}

export default AkademikTakvim;

export const academicMonths = [
  { index: 8, label: "Eylül" },
  { index: 9, label: "Ekim" },
  { index: 10, label: "Kasım" },
  { index: 11, label: "Aralık" },
  { index: 0, label: "Ocak" },
  { index: 1, label: "Şubat" },
  { index: 2, label: "Mart" },
  { index: 3, label: "Nisan" },
  { index: 4, label: "Mayıs" },
  { index: 5, label: "Haziran" },
  { index: 6, label: "Temmuz" },
  { index: 7, label: "Ağustos" },
];

export function normalizeDate(value) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  if (typeof value === "number") {
    const excelEpoch = Date.UTC(1899, 11, 30);
    return new Date(excelEpoch + value * 86400000).toISOString().slice(0, 10);
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  const text = String(value).trim();
  const dotted = text.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (dotted) {
    const [, day, month, year] = dotted;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const [, year, month, day] = iso;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return "";
}

export function getCalendarAlert(event, today = new Date()) {
  const start = new Date(event.baslangic);
  const end = new Date(event.bitis || event.baslangic);
  const todayStart = new Date(today);
  todayStart.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  if (todayStart > end) {
    return { label: "Tamamlandı", tone: "yapildi", daysLeft: 0, level: "tamamlandi" };
  }

  if (todayStart >= start && todayStart <= end) {
    return { label: "Devam Ediyor", tone: "devam", daysLeft: 0, level: "devam" };
  }

  const daysLeft = Math.ceil((start - todayStart) / 86400000);

  if (daysLeft <= 7) {
    return { label: "Kritik", tone: "sorun", daysLeft, level: "kritik" };
  }

  if (daysLeft <= 15) {
    return { label: "Dikkat", tone: "orta", daysLeft, level: "dikkat" };
  }

  if (daysLeft <= 30) {
    return { label: "Bilgilendirme", tone: "devam", daysLeft, level: "bilgi" };
  }

  return { label: "Planlandı", tone: "bekliyor", daysLeft, level: "planlandi" };
}

export function eventSpansMonth(event, monthIndex) {
  const start = new Date(event.baslangic);
  const end = new Date(event.bitis || event.baslangic);
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const endCursor = new Date(end.getFullYear(), end.getMonth(), 1);

  while (cursor <= endCursor) {
    if (cursor.getMonth() === monthIndex) {
      return true;
    }
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return false;
}

export function inferOperationIds(eventName, operations) {
  const name = eventName.toLocaleLowerCase("tr-TR");
  const rules = [
    { keyword: "final", operations: ["Final Sınav Programı Hazırlama", "Gözetmen Planlaması"] },
    { keyword: "ara sınav", operations: ["Vize Sınav Programı Hazırlama"] },
    { keyword: "vize", operations: ["Vize Sınav Programı Hazırlama"] },
    { keyword: "muafiyet", operations: ["Muafiyet İşlemleri"] },
    { keyword: "mezuniyet", operations: ["Mezuniyet Kontrolleri"] },
    { keyword: "ders kayıt", operations: ["OİS Ders Açma / Güncelleme İşlemleri"] },
  ];

  return rules
    .filter((rule) => name.includes(rule.keyword))
    .flatMap((rule) => rule.operations)
    .map((operationName) => operations.find((operation) => operation.ad === operationName)?.id)
    .filter(Boolean);
}

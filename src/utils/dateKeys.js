export function parseDateOnly(value) {
  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  const parsed = new Date(value);
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

export function toDateKey(value) {
  const date = parseDateOnly(value);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function getWeekStart(value) {
  const date = parseDateOnly(value);
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  return date;
}

export function getWeekKey(value) {
  return toDateKey(getWeekStart(value));
}

export function getDateMonthKey(value) {
  const date = parseDateOnly(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function getWeeklyLogMonthKey(log) {
  const start = getWeeklyLogStart(log);
  return getDateMonthKey(start);
}

export function getWeeklyLogStart(log) {
  const start = parseDateOnly(log.haftaBaslangic);
  const end = log.haftaBitis ? parseDateOnly(log.haftaBitis) : null;

  // Eski UTC dönüşümü bazı haftaları Pazar günü ve önceki ay olarak kaydetmişti.
  // Böyle kayıtları bir gün ileri alarak gerçek Pazartesi başlangıcına taşır.
  if (end && start.getDay() === 0 && end.getMonth() !== start.getMonth()) {
    const normalized = new Date(start);
    normalized.setDate(normalized.getDate() + 1);
    return normalized;
  }

  return start;
}

import { getDateMonthKey, getWeeklyLogMonthKey } from "./dateKeys";

const monthFmt = new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric" });

export function getMonthKey(date) {
  return getDateMonthKey(date);
}

export function getLogMonthKey(log) {
  return getWeeklyLogMonthKey(log);
}

export function getMonthLabel(key) {
  const [year, month] = key.split("-");
  return monthFmt.format(new Date(Number(year), Number(month) - 1, 1));
}

export function buildYearMonthKeys(year) {
  return Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`);
}

export function buildVisibleMonthKeys(logs = [], today = new Date()) {
  const currentYear = today.getFullYear();
  const plannedMonths = [
    ...buildYearMonthKeys(currentYear),
    ...buildYearMonthKeys(currentYear + 1),
  ];
  const logMonths = logs
    .map((log) => (log.haftaBaslangic ? getLogMonthKey(log) : log.baslangic || log.tarih))
    .filter(Boolean)
    .map((value) => (String(value).match(/^\d{4}-\d{2}$/) ? value : getMonthKey(value)));

  return [...new Set([...plannedMonths, ...logMonths])].sort();
}

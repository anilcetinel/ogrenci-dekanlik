const monthFmt = new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric" });

export function getMonthKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
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
    .map((log) => log.haftaBaslangic || log.baslangic || log.tarih)
    .filter(Boolean)
    .map(getMonthKey);

  return [...new Set([...plannedMonths, ...logMonths])].sort();
}

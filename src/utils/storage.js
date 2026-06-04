export function splitLines(value) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function readStoredCollection(key) {
  try {
    const rawValue = window.localStorage.getItem(key);
    return rawValue ? JSON.parse(rawValue) : [];
  } catch {
    return [];
  }
}

export function writeStoredCollection(key, records) {
  window.localStorage.setItem(key, JSON.stringify(records));
}

export function mergeDemoAndStored(demoRecords, storedRecords) {
  const storedIds = new Set(storedRecords.map((record) => String(record.id)));
  const visibleDemoRecords = demoRecords.filter((record) => !storedIds.has(String(record.id)));
  return [...visibleDemoRecords, ...storedRecords];
}

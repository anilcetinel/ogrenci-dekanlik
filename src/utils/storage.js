export function splitLines(value) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

const testDataPatterns = ["memati", "polat", "çakır", "cakir"];

function includesTestData(value) {
  if (value === null || value === undefined) {
    return false;
  }

  if (Array.isArray(value)) {
    return value.some(includesTestData);
  }

  if (typeof value === "object") {
    return Object.values(value).some(includesTestData);
  }

  const normalized = String(value).toLocaleLowerCase("tr-TR");
  return testDataPatterns.some((pattern) => normalized.includes(pattern));
}

function removeTestRecords(records) {
  return records.filter((record) => !includesTestData(record));
}

export function readStoredCollection(key) {
  try {
    const rawValue = window.localStorage.getItem(key);
    if (!rawValue) {
      return [];
    }

    const records = JSON.parse(rawValue);
    const cleanRecords = removeTestRecords(Array.isArray(records) ? records : []);

    if (cleanRecords.length !== records.length) {
      writeStoredCollection(key, cleanRecords);
    }

    return cleanRecords;
  } catch {
    return [];
  }
}

export function writeStoredCollection(key, records) {
  window.localStorage.setItem(key, JSON.stringify(removeTestRecords(records)));
}

export function mergeDemoAndStored(demoRecords, storedRecords) {
  const storedIds = new Set(storedRecords.map((record) => String(record.id)));
  const visibleDemoRecords = demoRecords.filter((record) => !storedIds.has(String(record.id)));
  return [...visibleDemoRecords, ...storedRecords];
}

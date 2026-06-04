import { useMemo, useState } from "react";
import { mergeDemoAndStored, readStoredCollection, writeStoredCollection } from "../utils/storage";

function useStoredCollection(storageKey, demoRecords, options = {}) {
  const { sortByDateField } = options;
  const [storedRecords, setStoredRecords] = useState(() => {
    if (typeof window === "undefined") {
      return [];
    }

    return readStoredCollection(storageKey);
  });

  const records = useMemo(() => {
    const merged = mergeDemoAndStored(demoRecords, storedRecords);

    if (!sortByDateField) {
      return merged;
    }

    return [...merged].sort(
      (a, b) => new Date(b[sortByDateField]) - new Date(a[sortByDateField]),
    );
  }, [demoRecords, sortByDateField, storedRecords]);

  const addRecord = (record) => {
    const nextRecords = [...storedRecords, record];
    setStoredRecords(nextRecords);
    writeStoredCollection(storageKey, nextRecords);
  };

  const addRecords = (newRecords) => {
    const nextRecords = [...storedRecords, ...newRecords];
    setStoredRecords(nextRecords);
    writeStoredCollection(storageKey, nextRecords);
  };

  const upsertRecords = (newRecords, getKey) => {
    const demoKeys = new Set(demoRecords.map((record) => getKey(record)));
    const nextRecordsByKey = new Map(storedRecords.map((record) => [getKey(record), record]));

    newRecords.forEach((record) => {
      const key = getKey(record);
      if (demoKeys.has(key) && !nextRecordsByKey.has(key)) {
        return;
      }
      const existingRecord = nextRecordsByKey.get(key);
      nextRecordsByKey.set(key, existingRecord ? { ...existingRecord, ...record } : record);
    });

    const nextRecords = Array.from(nextRecordsByKey.values());
    setStoredRecords(nextRecords);
    writeStoredCollection(storageKey, nextRecords);
  };

  const mergeRecord = (record, getKey, mergeFn) => {
    const key = getKey(record);
    const existingStoredRecord = storedRecords.find((item) => getKey(item) === key);
    const existingDemoRecord = demoRecords.find((item) => getKey(item) === key);
    const existingRecord = existingStoredRecord || existingDemoRecord;
    const nextRecord = existingRecord ? mergeFn(existingRecord, record) : record;
    let updated = false;

    const nextRecords = storedRecords.map((item) => {
      if (getKey(item) !== key) {
        return item;
      }

      updated = true;
      return nextRecord;
    });

    if (!updated) {
      nextRecords.push(nextRecord);
    }

    setStoredRecords(nextRecords);
    writeStoredCollection(storageKey, nextRecords);
  };

  const clearRecords = () => {
    setStoredRecords([]);
    writeStoredCollection(storageKey, []);
  };

  return { records, storedRecords, addRecord, addRecords, upsertRecords, mergeRecord, clearRecords };
}

export default useStoredCollection;

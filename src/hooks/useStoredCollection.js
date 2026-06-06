import { useEffect, useMemo, useState } from "react";
import { mergeDemoAndStored, readStoredCollection, writeStoredCollection } from "../utils/storage";
import {
  clearSharedCollection,
  deleteSharedRecord,
  fetchSharedRecords,
  isSharedStorageEnabled,
  upsertSharedRecords,
} from "../utils/sharedStorage";
import { canEditData } from "../utils/auth";

function useStoredCollection(storageKey, demoRecords, options = {}) {
  const { sortByDateField } = options;
  const [syncStatus, setSyncStatus] = useState(
    isSharedStorageEnabled() ? "ortak-veri-baglaniyor" : "yerel",
  );
  const [storedRecords, setStoredRecords] = useState(() => {
    if (typeof window === "undefined") {
      return [];
    }

    return readStoredCollection(storageKey);
  });

  useEffect(() => {
    let cancelled = false;

    async function loadSharedRecords() {
      if (!isSharedStorageEnabled()) {
        setSyncStatus("yerel");
        return;
      }

      try {
        setSyncStatus("ortak-veri-baglaniyor");
        const sharedRecords = await fetchSharedRecords(storageKey);
        if (cancelled) return;
        setStoredRecords(sharedRecords);
        writeStoredCollection(storageKey, sharedRecords);
        setSyncStatus("ortak-veri-aktif");
      } catch (error) {
        console.warn("Ortak veri okunamadı, yerel kayıtlar kullanılacak:", storageKey, error);
        if (!cancelled) setSyncStatus("ortak-veri-hatasi");
      }
    }

    loadSharedRecords();

    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  const records = useMemo(() => {
    const merged = mergeDemoAndStored(demoRecords, storedRecords);

    if (!sortByDateField) {
      return merged;
    }

    return [...merged].sort(
      (a, b) => new Date(b[sortByDateField]) - new Date(a[sortByDateField]),
    );
  }, [demoRecords, sortByDateField, storedRecords]);

  const persistRecords = (nextRecords, recordsToSync = nextRecords) => {
    if (!canEditData()) {
      console.warn("İzleyici modunda veri değişikliği engellendi:", storageKey);
      return;
    }

    setStoredRecords(nextRecords);
    writeStoredCollection(storageKey, nextRecords);

    if (!isSharedStorageEnabled() || recordsToSync.length === 0) {
      return;
    }

    upsertSharedRecords(storageKey, recordsToSync).catch((error) => {
      console.warn("Ortak veri yazılamadı:", storageKey, error);
      setSyncStatus("ortak-veri-hatasi");
    });
  };

  const addRecord = (record) => {
    const nextRecords = [...storedRecords, record];
    persistRecords(nextRecords, [record]);
  };

  const addRecords = (newRecords) => {
    const nextRecords = [...storedRecords, ...newRecords];
    persistRecords(nextRecords, newRecords);
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
    persistRecords(nextRecords, newRecords);
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

    persistRecords(nextRecords, [nextRecord]);
  };

  const clearRecords = () => {
    persistRecords([], []);
    if (isSharedStorageEnabled()) {
      clearSharedCollection(storageKey).catch((error) => {
        console.warn("Ortak veri koleksiyonu temizlenemedi:", storageKey, error);
        setSyncStatus("ortak-veri-hatasi");
      });
    }
  };

  const deleteRecord = (recordId) => {
    const nextRecords = storedRecords.filter((record) => String(record.id) !== String(recordId));
    persistRecords(nextRecords, []);
    if (isSharedStorageEnabled()) {
      deleteSharedRecord(storageKey, recordId).catch((error) => {
        console.warn("Ortak veriden kayıt silinemedi:", storageKey, error);
        setSyncStatus("ortak-veri-hatasi");
      });
    }
  };

  return {
    records,
    storedRecords,
    syncStatus,
    addRecord,
    addRecords,
    upsertRecords,
    mergeRecord,
    deleteRecord,
    clearRecords,
  };
}

export default useStoredCollection;

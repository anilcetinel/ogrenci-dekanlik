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
import { AUDIT_LOG_KEY, appendAuditLog, summarizeRecord } from "../utils/auditLog";

function mergeById(primaryRecords, secondaryRecords) {
  const recordsById = new Map();

  secondaryRecords.forEach((record) => {
    recordsById.set(String(record.id), record);
  });
  primaryRecords.forEach((record) => {
    recordsById.set(String(record.id), record);
  });

  return Array.from(recordsById.values());
}

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
        const localRecords = readStoredCollection(storageKey);
        const mergedRecords = mergeById(sharedRecords, localRecords);
        const localOnlyRecords = localRecords.filter(
          (localRecord) => !sharedRecords.some((sharedRecord) => String(sharedRecord.id) === String(localRecord.id)),
        );

        setStoredRecords(mergedRecords);
        writeStoredCollection(storageKey, mergedRecords);
        setSyncStatus("ortak-veri-aktif");

        if (localOnlyRecords.length > 0 && canEditData()) {
          upsertSharedRecords(storageKey, localOnlyRecords).catch((error) => {
            console.warn("Yerel kayıtlar ortak alana tamamlanamadı:", storageKey, error);
          });
        }
      } catch (error) {
        console.warn("Ortak veri okunamadı, yerel kayıtlar kullanılacak:", storageKey, error);
        if (!cancelled) setSyncStatus("ortak-veri-hatasi");
      }
    }

    loadSharedRecords();
    const refreshInterval = isSharedStorageEnabled()
      ? window.setInterval(loadSharedRecords, 30000)
      : null;

    const handleFocus = () => {
      loadSharedRecords();
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadSharedRecords();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      if (refreshInterval) {
        window.clearInterval(refreshInterval);
      }
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
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
    appendAuditLog({
      action: "Kayıt eklendi",
      collectionKey: storageKey,
      recordId: record.id,
      summary: summarizeRecord(record),
    });
  };

  const addRecords = (newRecords) => {
    const nextRecords = [...storedRecords, ...newRecords];
    persistRecords(nextRecords, newRecords);
    if (newRecords.length === 1) {
      appendAuditLog({
        action: "Kayıt eklendi",
        collectionKey: storageKey,
        recordId: newRecords[0].id,
        summary: summarizeRecord(newRecords[0]),
      });
    } else if (newRecords.length > 1) {
      appendAuditLog({
        action: "Toplu kayıt eklendi",
        collectionKey: storageKey,
        recordId: `bulk-${Date.now()}`,
        summary: `${newRecords.length} kayıt işlendi`,
        count: newRecords.length,
      });
    }
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
    if (newRecords.length === 1) {
      appendAuditLog({
        action: "Kayıt güncellendi",
        collectionKey: storageKey,
        recordId: newRecords[0].id,
        summary: summarizeRecord(newRecords[0]),
      });
    } else if (newRecords.length > 1) {
      appendAuditLog({
        action: "Toplu kayıt güncellendi",
        collectionKey: storageKey,
        recordId: `bulk-${Date.now()}`,
        summary: `${newRecords.length} kayıt işlendi`,
        count: newRecords.length,
      });
    }
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
    appendAuditLog({
      action: updated ? "Kayıt güncellendi" : "Kayıt eklendi",
      collectionKey: storageKey,
      recordId: nextRecord.id,
      summary: summarizeRecord(nextRecord),
    });
  };

  const clearRecords = () => {
    persistRecords([], []);
    if (storageKey !== AUDIT_LOG_KEY && storedRecords.length > 0) {
      appendAuditLog({
        action: "Koleksiyon temizlendi",
        collectionKey: storageKey,
        recordId: `clear-${Date.now()}`,
        summary: `${storedRecords.length} kayıt silindi`,
        count: storedRecords.length,
      });
    }
    if (isSharedStorageEnabled()) {
      clearSharedCollection(storageKey).catch((error) => {
        console.warn("Ortak veri koleksiyonu temizlenemedi:", storageKey, error);
        setSyncStatus("ortak-veri-hatasi");
      });
    }
  };

  const deleteRecord = (recordId) => {
    const deletedRecord = storedRecords.find((record) => String(record.id) === String(recordId));
    const nextRecords = storedRecords.filter((record) => String(record.id) !== String(recordId));
    persistRecords(nextRecords, []);
    appendAuditLog({
      action: "Kayıt silindi",
      collectionKey: storageKey,
      recordId,
      summary: summarizeRecord(deletedRecord) || String(recordId),
    });
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

import { AUTH_ROLES, getCurrentRole } from "./auth";
import { isSharedStorageEnabled, upsertSharedRecords } from "./sharedStorage";
import { readStoredCollection, writeStoredCollection } from "./storage";

export const AUDIT_LOG_KEY = "auditLogRecords";

const COLLECTION_LABELS = {
  akademikTakvimRecords: "Akademik Takvim",
  haftalikLogRecords: "Haftalık Faaliyetler",
  operasyonRecords: "Operasyonlar",
  evrakRecords: "Evrak ve Şablonlar",
  hizliNotRecords: "Hızlı Notlar",
  workItemRecords: "Yapılan İşler Takibi",
  auditLogRecords: "İşlem Geçmişi",
};

export function getCollectionLabel(collectionKey) {
  return COLLECTION_LABELS[collectionKey] || collectionKey;
}

export function summarizeRecord(record = {}) {
  return (
    record.ad ||
    record.olay ||
    record.baslik ||
    record.haftaLabel ||
    record.title ||
    record.icerik ||
    record.aciklama ||
    record.id ||
    "Kayıt"
  );
}

function buildAuditRecord({ action, collectionKey, recordId, summary, count }) {
  const now = new Date().toISOString();
  const safeSummary = String(summary || "Kayıt").slice(0, 180);

  return {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    action,
    collectionKey,
    collectionLabel: getCollectionLabel(collectionKey),
    recordId: recordId ? String(recordId) : "",
    summary: safeSummary,
    count: count || 1,
    role: getCurrentRole(),
    createdAt: now,
  };
}

export function appendAuditLog(input) {
  if (input.collectionKey === AUDIT_LOG_KEY) return null;
  if (getCurrentRole() !== AUTH_ROLES.ADMIN) return null;

  const entry = buildAuditRecord(input);
  const currentRecords = readStoredCollection(AUDIT_LOG_KEY);
  const nextRecords = [entry, ...currentRecords].slice(0, 500);

  writeStoredCollection(AUDIT_LOG_KEY, nextRecords);

  if (isSharedStorageEnabled()) {
    upsertSharedRecords(AUDIT_LOG_KEY, [entry]).catch((error) => {
      console.warn("İşlem geçmişi ortak alana yazılamadı:", error);
    });
  }

  return entry;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const TABLE_NAME = "dekanlik_records";

function getRestUrl(path = "") {
  return `${SUPABASE_URL?.replace(/\/$/, "")}/rest/v1/${TABLE_NAME}${path}`;
}

function getHeaders(extraHeaders = {}) {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json",
    ...extraHeaders,
  };
}

export function isSharedStorageEnabled() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export function getSharedStorageInfo() {
  return {
    enabled: isSharedStorageEnabled(),
    tableName: TABLE_NAME,
    projectUrl: SUPABASE_URL || "",
  };
}

async function request(url, options = {}) {
  if (!isSharedStorageEnabled()) {
    throw new Error("Supabase ayarları bulunamadı.");
  }

  const response = await fetch(url, {
    ...options,
    headers: getHeaders(options.headers),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Supabase bağlantısı başarısız.");
  }

  if (response.status === 204) return null;
  return response.json();
}

export async function fetchSharedRecords(collectionKey) {
  const params = new URLSearchParams({
    select: "record_id,payload,updated_at",
    collection_key: `eq.${collectionKey}`,
    order: "updated_at.desc",
  });

  const rows = await request(`${getRestUrl()}?${params.toString()}`);
  return rows.map((row) => row.payload).filter(Boolean);
}

export async function upsertSharedRecords(collectionKey, records) {
  if (!records.length) return [];

  const rows = records.map((record) => ({
    collection_key: collectionKey,
    record_id: String(record.id),
    payload: record,
  }));

  const params = new URLSearchParams({
    on_conflict: "collection_key,record_id",
  });

  return request(`${getRestUrl()}?${params.toString()}`, {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify(rows),
  });
}

export async function deleteSharedRecord(collectionKey, recordId) {
  const params = new URLSearchParams({
    collection_key: `eq.${collectionKey}`,
    record_id: `eq.${recordId}`,
  });

  return request(`${getRestUrl()}?${params.toString()}`, {
    method: "DELETE",
    headers: {
      Prefer: "return=minimal",
    },
  });
}

export async function clearSharedCollection(collectionKey) {
  const params = new URLSearchParams({
    collection_key: `eq.${collectionKey}`,
  });

  return request(`${getRestUrl()}?${params.toString()}`, {
    method: "DELETE",
    headers: {
      Prefer: "return=minimal",
    },
  });
}

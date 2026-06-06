import {
  getSharedStorageConfig,
  getSharedStorageHeaders,
  isSharedStorageEnabled,
} from "./sharedStorage";

const DEFAULT_BUCKET = "dekanlik-files";
const FILE_BUCKET = import.meta.env.VITE_SUPABASE_FILE_BUCKET || DEFAULT_BUCKET;

function sanitizeFileName(fileName) {
  const extension = fileName.includes(".") ? `.${fileName.split(".").pop()}` : "";
  const baseName = fileName.replace(extension, "");

  return `${baseName}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/İ/g, "I")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90)
    .concat(extension.toLocaleLowerCase("tr-TR"));
}

export function getSharedFileInfo() {
  return {
    enabled: isSharedStorageEnabled(),
    bucket: FILE_BUCKET,
  };
}

export async function uploadSharedFile(file, folder = "evraklar") {
  if (!isSharedStorageEnabled()) {
    return { ok: false, reason: "Supabase ortak veri ayarı yok." };
  }

  const { url } = getSharedStorageConfig();
  const safeName = sanitizeFileName(file.name);
  const datePrefix = new Date().toISOString().slice(0, 10);
  const filePath = `${folder}/${datePrefix}/${Date.now()}-${safeName}`;
  const uploadUrl = `${url.replace(/\/$/, "")}/storage/v1/object/${FILE_BUCKET}/${filePath}`;

  try {
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: getSharedStorageHeaders({
        "Content-Type": file.type || "application/octet-stream",
        "x-upsert": "true",
      }),
      body: file,
    });

    if (!response.ok) {
      const message = await response.text();
      return { ok: false, reason: message || "Supabase Storage yükleme başarısız." };
    }

    return {
      ok: true,
      bucket: FILE_BUCKET,
      path: filePath,
      publicUrl: `${url.replace(/\/$/, "")}/storage/v1/object/public/${FILE_BUCKET}/${filePath}`,
    };
  } catch (error) {
    return { ok: false, reason: error.message || "Supabase Storage bağlantısı kurulamadı." };
  }
}

export async function testSharedFileStorage() {
  const testFile = new File(
    [`Storage test kaydı: ${new Date().toISOString()}`],
    "storage-test.txt",
    { type: "text/plain" },
  );

  return uploadSharedFile(testFile, "sistem-testleri");
}

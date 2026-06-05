import { useState } from "react";

const COLLECTIONS = [
  { key: "akademikTakvimRecords", label: "Akademik Takvim" },
  { key: "haftalikLogRecords",    label: "Haftalık Faaliyetler" },
  { key: "operasyonRecords",      label: "Operasyonlar" },
  { key: "hizliNotRecords",       label: "Hızlı Notlar" },
];

function getCount(key) {
  try { return JSON.parse(localStorage.getItem(key) || "[]").length; } catch { return 0; }
}

function Ayarlar() {
  const [importStatus, setImportStatus] = useState("");
  const [counts, setCounts] = useState(() => Object.fromEntries(COLLECTIONS.map((c) => [c.key, getCount(c.key)])));

  const refreshCounts = () => setCounts(Object.fromEntries(COLLECTIONS.map((c) => [c.key, getCount(c.key)])));

  const handleExport = () => {
    const data = { _exportDate: new Date().toISOString(), _version: "1.0" };
    COLLECTIONS.forEach(({ key }) => {
      try { data[key] = JSON.parse(localStorage.getItem(key) || "[]"); } catch { data[key] = []; }
    });
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sau-dekanlik-yedek-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        let restored = 0;
        COLLECTIONS.forEach(({ key }) => {
          if (Array.isArray(data[key])) {
            localStorage.setItem(key, JSON.stringify(data[key]));
            restored++;
          }
        });
        if (restored === 0) throw new Error("Geçersiz format");
        const exportDate = data._exportDate
          ? new Date(data._exportDate).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" })
          : "bilinmiyor";
        setImportStatus(`success:${exportDate} tarihli yedek geri yüklendi. Sayfa yenileniyor…`);
        refreshCounts();
        setTimeout(() => window.location.reload(), 1800);
      } catch {
        setImportStatus("error:Dosya okunamadı. Geçerli bir SAÜ yedek dosyası (.json) seçin.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleClearAll = () => {
    if (!window.confirm("TÜM veriler silinecek (takvim, haftalık kayıtlar, notlar). Bu işlem geri alınamaz. Devam?")) return;
    COLLECTIONS.forEach(({ key }) => localStorage.removeItem(key));
    refreshCounts();
    setImportStatus("success:Tüm veriler silindi.");
  };

  const statusType = importStatus.startsWith("success:") ? "success" : importStatus.startsWith("error:") ? "error" : null;
  const statusText = statusType ? importStatus.slice(importStatus.indexOf(":") + 1) : "";

  const totalRecords = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="max-w-2xl space-y-6">
      {/* Başlık */}
      <section className="rounded-2xl border border-[#D6DEEA] bg-gradient-to-r from-[#0E2650] to-[#1F2D5C] px-6 py-5 text-white shadow-md">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Sistem</p>
        <h2 className="mt-1 text-xl font-bold">Ayarlar ve Veri Yönetimi</h2>
        <p className="mt-0.5 text-sm text-white/55">Yedekleme, geri yükleme ve veri sıfırlama</p>
      </section>

      {/* Durum mesajı */}
      {statusType && (
        <div className={`rounded-xl border px-4 py-3 text-sm font-medium ${
          statusType === "success"
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border-red-200 bg-red-50 text-red-700"
        }`}>
          {statusText}
        </div>
      )}

      {/* Veri özeti */}
      <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-bold text-[#1F2D5C]">Kayıtlı Veri Özeti</h3>
        <div className="space-y-2">
          {COLLECTIONS.map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between rounded-xl border border-[#E5E7EB] px-4 py-2.5">
              <span className="text-sm text-slate-600">{label}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                counts[key] > 0 ? "bg-[#EEF3FA] text-[#00377B]" : "bg-slate-100 text-slate-400"
              }`}>
                {counts[key]} kayıt
              </span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-right text-xs text-slate-400">Toplam {totalRecords} kayıt · Tarayıcı yerel depolaması</p>
      </div>

      {/* Yedekleme */}
      <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
        <h3 className="mb-1 text-sm font-bold text-[#1F2D5C]">Veri Yedekleme</h3>
        <p className="mb-4 text-xs leading-5 text-slate-500">
          Veriler tarayıcınızda saklanıyor. Tarayıcı önbelleği temizlenirse veya farklı bir cihaz kullanılırsa
          veriler kaybolabilir. Düzenli yedek alın.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-[#D6DEEA] bg-[#F8FAFD] p-4">
            <p className="mb-0.5 text-sm font-semibold text-[#1F2D5C]">Yedek Al</p>
            <p className="mb-3 text-xs text-slate-500">Tüm veriler .json dosyasına indirilir</p>
            <button
              type="button"
              onClick={handleExport}
              disabled={totalRecords === 0}
              className="w-full rounded-xl bg-[#00377B] py-2.5 text-sm font-semibold text-white transition hover:bg-[#1F2D5C] disabled:opacity-40"
            >
              ↓ Yedek İndir
            </button>
          </div>
          <div className="rounded-xl border border-[#D6DEEA] bg-[#F8FAFD] p-4">
            <p className="mb-0.5 text-sm font-semibold text-[#1F2D5C]">Yedekten Geri Yükle</p>
            <p className="mb-3 text-xs text-slate-500">Mevcut verilerin üzerine yazar</p>
            <label className="block w-full cursor-pointer rounded-xl border border-[#00377B] py-2.5 text-center text-sm font-semibold text-[#00377B] transition hover:bg-[#EEF3FA]">
              ↑ Dosya Seç (.json)
              <input type="file" accept=".json" onChange={handleImport} className="hidden" />
            </label>
          </div>
        </div>
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs leading-5 text-amber-800">
          <strong>Uyarı:</strong> Geri yükleme mevcut tüm verilerin üzerine yazar. Önce yedek alın.
        </div>
      </div>

      {/* Tehlikeli alan */}
      <div className="rounded-2xl border border-red-200 bg-white p-5 shadow-sm">
        <h3 className="mb-1 text-sm font-bold text-red-700">Veri Sıfırlama</h3>
        <p className="mb-4 text-xs leading-5 text-slate-500">
          Tüm haftalık kayıtlar, akademik takvim olayları ve notlar kalıcı olarak silinir.
          Bu işlem geri alınamaz.
        </p>
        <button
          type="button"
          onClick={handleClearAll}
          className="rounded-xl border border-red-300 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100"
        >
          Tüm Verileri Sil
        </button>
      </div>
    </div>
  );
}

export default Ayarlar;

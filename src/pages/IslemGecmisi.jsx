import { useMemo, useState } from "react";
import SharedStatus from "../components/SharedStatus";
import useStoredCollection from "../hooks/useStoredCollection";
import { AUDIT_LOG_KEY } from "../utils/auditLog";

const dateTimeFmt = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const actionStyles = {
  "Kayıt eklendi": "border-emerald-200 bg-emerald-50 text-emerald-700",
  "Toplu kayıt eklendi": "border-blue-200 bg-blue-50 text-[#00377B]",
  "Kayıt güncellendi": "border-[#D6DEEA] bg-[#EEF3FA] text-[#1F2D5C]",
  "Toplu kayıt güncellendi": "border-[#D6DEEA] bg-[#EEF3FA] text-[#1F2D5C]",
  "Kayıt silindi": "border-red-200 bg-red-50 text-red-700",
  "Koleksiyon temizlendi": "border-red-200 bg-red-50 text-red-700",
};

function formatDateTime(value) {
  if (!value) return "Tarih yok";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Tarih okunamadı";
  return dateTimeFmt.format(date);
}

function IslemGecmisi() {
  const [collectionFilter, setCollectionFilter] = useState("Tümü");
  const { records, syncStatus } = useStoredCollection(AUDIT_LOG_KEY, [], {
    sortByDateField: "createdAt",
  });

  const collectionOptions = useMemo(() => {
    const labels = records.map((record) => record.collectionLabel).filter(Boolean);
    return ["Tümü", ...Array.from(new Set(labels))];
  }, [records]);

  const filteredRecords = useMemo(() => {
    if (collectionFilter === "Tümü") return records;
    return records.filter((record) => record.collectionLabel === collectionFilter);
  }, [collectionFilter, records]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-[#D6DEEA] bg-gradient-to-r from-[#0E2650] to-[#1F2D5C] px-6 py-5 text-white shadow-md">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Kurumsal iz kaydı</p>
        <h2 className="mt-1 text-xl font-bold">İşlem Geçmişi</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-white/60">
          Akademik takvim, haftalık faaliyet, evrak ve not kayıtlarında yapılan ekleme, güncelleme ve silme işlemleri burada izlenir.
        </p>
      </section>

      <SharedStatus syncStatus={syncStatus} count={records.length} label="İşlem geçmişi ortak veri durumu" />

      <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#1F2D5C]">Kayıt Defteri</h3>
            <p className="mt-1 text-xs text-slate-500">
              Son {filteredRecords.length} işlem gösteriliyor. Kayıtlar hem yerel yedekte hem de Supabase tanımlıysa ortak alanda tutulur.
            </p>
          </div>
          <select
            value={collectionFilter}
            onChange={(event) => setCollectionFilter(event.target.value)}
            className="rounded-xl border border-[#D6DEEA] bg-white px-3 py-2 text-sm font-medium text-[#1F2D5C] outline-none focus:border-[#00377B]"
          >
            {collectionOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>

        {filteredRecords.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-[#D6DEEA] bg-[#F8FAFD] px-5 py-8 text-center">
            <p className="text-sm font-semibold text-[#1F2D5C]">Henüz işlem kaydı yok</p>
            <p className="mt-1 text-xs text-slate-500">
              Yeni kayıt eklediğinizde veya mevcut kayıtları güncellediğinizde burada otomatik iz oluşacak.
            </p>
          </div>
        ) : (
          <div className="mt-5 overflow-hidden rounded-2xl border border-[#E5E7EB]">
            <div className="divide-y divide-[#E5E7EB]">
              {filteredRecords.map((record) => (
                <article key={record.id} className="grid gap-3 bg-white px-4 py-4 md:grid-cols-[160px_1fr_150px] md:items-center">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                      {formatDateTime(record.createdAt)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Rol: {record.role === "admin" ? "Yönetici" : "İzleyici"}
                    </p>
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${actionStyles[record.action] || "border-slate-200 bg-slate-50 text-slate-600"}`}>
                        {record.action}
                      </span>
                      <span className="rounded-full bg-[#EEF3FA] px-2.5 py-1 text-xs font-bold text-[#00377B]">
                        {record.collectionLabel}
                      </span>
                      {record.count > 1 && (
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
                          {record.count} kayıt
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm font-semibold text-[#1F2D5C]">{record.summary}</p>
                    {record.recordId && (
                      <p className="mt-1 text-xs text-slate-400">Kayıt ID: {record.recordId}</p>
                    )}
                  </div>
                  <div className="rounded-xl border border-[#E5E7EB] bg-[#F8FAFD] px-3 py-2 text-xs leading-5 text-slate-500">
                    Bu iz kaydı, kurumsal hafızada geriye dönük kontrol için saklanır.
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

export default IslemGecmisi;

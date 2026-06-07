import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import FormModal from "../components/FormModal";
import SharedStatus from "../components/SharedStatus";
import SuccessMessage from "../components/SuccessMessage";
import useStoredCollection from "../hooks/useStoredCollection";
import initialLogs from "../data/haftalik-log.json";
import operasyonData from "../data/operasyon-kutuphanesi.json";
import { canEditData } from "../utils/auth";
import { splitLines } from "../utils/storage";

const dayFmt = new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short" });
const monthFmt = new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric" });
const weekDayLabels = ["Pt", "Sa", "Ça", "Pe", "Cu", "Ct", "Pz"];

// Haftanın Pazartesi başlangıcını bul
function weekStart(date) {
  const d = new Date(date);
  const day = d.getDay() || 7;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day + 1);
  return d;
}

function sameWeek(a, b) {
  return weekStart(a).getTime() === weekStart(b).getTime();
}

function buildMonthGrid(monthDate) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // Pazartesi = 0
  const start = new Date(year, month, 1 - offset);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function getMonthKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function uniqueItems(items) {
  return [...new Set(items.filter(Boolean))];
}

function mergeWeeklyItems(existingItems = [], newItems = []) {
  return uniqueItems([...existingItems, ...newItems]);
}

function getWeekKey(date) {
  return weekStart(date).toISOString().slice(0, 10);
}

function defaultEmptyForm() {
  const bugun = new Date();
  const baslangic = weekStart(bugun);
  const bitis = new Date(baslangic);
  bitis.setDate(baslangic.getDate() + 6);
  return {
    haftaBaslangic: baslangic.toISOString().slice(0, 10),
    haftaBitis: bitis.toISOString().slice(0, 10),
    yapilanlar: "",
    yapilacaklar: "",
    bekleyenler: "",
    sorunlar: "",
    hazirlayan: "",
    operasyonIds: [],
  };
}

const boardCols = [
  { key: "yapilanlar", label: "Yapılanlar", bg: "bg-[#EEF7F0]", text: "text-[#1F4D2C]", dot: "bg-[#1F4D2C]", icon: "✓" },
  { key: "yapilacaklar", label: "Yapılacaklar", bg: "bg-[#EEF3FA]", text: "text-[#00377B]", dot: "bg-[#00377B]", icon: "→" },
  { key: "bekleyenler", label: "Bekleyenler", bg: "bg-[#FFF3E8]", text: "text-[#A34D00]", dot: "bg-[#F58220]", icon: "⏳" },
  { key: "sorunlar", label: "Sorunlar / Riskler", bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500", icon: "!" },
];

function HaftalikFaaliyetler() {
  const editable = canEditData();
  const [searchParams, setSearchParams] = useSearchParams();
  const { records: logs, mergeRecord, deleteRecord, syncStatus } = useStoredCollection("haftalikLogRecords", initialLogs, {
    sortByDateField: "haftaBaslangic",
  });
  const { records: operations } = useStoredCollection("operasyonRecords", operasyonData);

  // Ortak veri sonradan yüklenebildiği için başlangıç tarihi dinamik tutulur.
  const defaultDate = useMemo(() => {
    if (logs.length > 0) return new Date(logs[0].haftaBaslangic);
    return new Date();
  }, [logs]);

  const [currentMonth, setCurrentMonth] = useState(() => new Date(defaultDate.getFullYear(), defaultDate.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(() => {
    return logs.length > 0 ? new Date(logs[0].haftaBaslangic) : new Date();
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState(defaultEmptyForm);
  const [editingItem, setEditingItem] = useState(null); // { colKey, index, text }
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [userSelectedWeek, setUserSelectedWeek] = useState(false);

  useEffect(() => {
    if (logs.length === 0 || userSelectedWeek) return;
    const hasSelectedLog = logs.some((log) => sameWeek(log.haftaBaslangic, selectedDate));
    if (!hasSelectedLog) {
      const latestLogDate = new Date(logs[0].haftaBaslangic);
      setSelectedDate(latestLogDate);
      setCurrentMonth(new Date(latestLogDate.getFullYear(), latestLogDate.getMonth(), 1));
    }
  }, [logs, selectedDate, userSelectedWeek]);

  useEffect(() => {
    const operationId = searchParams.get("operasyonId");
    if (!operationId) return;

    const today = new Date();
    setFormData((prev) => ({
      ...prev,
      haftaBaslangic: prev.haftaBaslangic || weekStart(today).toISOString().slice(0, 10),
      operasyonIds: uniqueItems([...(prev.operasyonIds || []), operationId]),
    }));
    if (editable) {
      setModalOpen(true);
    }
    setSearchParams({}, { replace: true });
  }, [editable, searchParams, setSearchParams]);

  const days = buildMonthGrid(currentMonth);

  // Seçili haftanın kaydı
  const selectedLog = useMemo(
    () => logs.find((log) => sameWeek(log.haftaBaslangic, selectedDate)) || null,
    [logs, selectedDate],
  );

  // Bir günün kaydı var mı?
  const hasLog = (day) => logs.some((log) => sameWeek(log.haftaBaslangic, day));
  const visibleMonthLogs = useMemo(
    () =>
      logs
        .filter((log) => getMonthKey(log.haftaBaslangic) === getMonthKey(currentMonth))
        .sort((a, b) => new Date(a.haftaBaslangic) - new Date(b.haftaBaslangic)),
    [currentMonth, logs],
  );

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleOperationToggle = (operationId) => {
    setFormData((prev) => {
      const currentIds = prev.operasyonIds || [];
      return {
        ...prev,
        operasyonIds: currentIds.includes(operationId)
          ? currentIds.filter((id) => id !== operationId)
          : [...currentIds, operationId],
      };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError("");
    if (!formData.haftaBaslangic) {
      setFormError("Hafta başlangıcı zorunludur.");
      return;
    }
    const ws = new Date(formData.haftaBaslangic);
    const we = formData.haftaBitis ? new Date(formData.haftaBitis) : (() => { const d = new Date(ws); d.setDate(ws.getDate() + 6); return d; })();
    const label = `${dayFmt.format(ws)} – ${dayFmt.format(we)} ${ws.getFullYear()} Haftası`;
    const newRecord = {
      id: `week-${getWeekKey(ws)}`,
      haftaLabel: label,
      haftaBaslangic: ws.toISOString().slice(0, 10),
      haftaBitis: we.toISOString().slice(0, 10),
      yapilanlar: splitLines(formData.yapilanlar),
      yapilacaklar: splitLines(formData.yapilacaklar),
      bekleyenler: splitLines(formData.bekleyenler),
      sorunlar: splitLines(formData.sorunlar),
      hazirlayan: formData.hazirlayan || "Öğrenci Destek Koordinatörlüğü",
      operasyonIds: formData.operasyonIds || [],
    };

    mergeRecord(
      newRecord,
      (record) => getWeekKey(record.haftaBaslangic),
      (existingRecord, incomingRecord) => ({
        ...existingRecord,
        ...incomingRecord,
        id: existingRecord.id,
        haftaLabel: existingRecord.haftaLabel || incomingRecord.haftaLabel,
        haftaBaslangic: getWeekKey(incomingRecord.haftaBaslangic),
        haftaBitis: incomingRecord.haftaBitis || existingRecord.haftaBitis,
        operasyonIds: uniqueItems([...(existingRecord.operasyonIds || []), ...(incomingRecord.operasyonIds || [])]),
        yapilanlar: mergeWeeklyItems(existingRecord.yapilanlar, incomingRecord.yapilanlar),
        yapilacaklar: mergeWeeklyItems(existingRecord.yapilacaklar, incomingRecord.yapilacaklar),
        bekleyenler: mergeWeeklyItems(existingRecord.bekleyenler, incomingRecord.bekleyenler),
        sorunlar: mergeWeeklyItems(existingRecord.sorunlar, incomingRecord.sorunlar),
        hazirlayan: incomingRecord.hazirlayan || existingRecord.hazirlayan,
      }),
    );
    setSelectedDate(ws);
    setCurrentMonth(new Date(ws.getFullYear(), ws.getMonth(), 1));
    setModalOpen(false);
    setFormData(defaultEmptyForm());
    setSuccessMessage("Haftalık kayıt eklendi. Aynı haftadaki eski maddeler korundu.");
  };

  const getOpName = (id) => operations.find((op) => String(op.id) === String(id))?.ad || "";

  const handleDeleteSelectedLog = () => {
    if (!selectedLog) return;
    if (window.confirm(`"${selectedLog.haftaLabel}" haftalık kaydı silinsin mi?`)) {
      deleteRecord(selectedLog.id);
      setSuccessMessage("Haftalık faaliyet kaydı silindi.");
    }
  };

  // Belirli bir maddeyi sil
  const handleDeleteItem = (colKey, index) => {
    if (!selectedLog) return;
    const updated = {
      ...selectedLog,
      [colKey]: (selectedLog[colKey] || []).filter((_, i) => i !== index),
    };
    mergeRecord(updated, (r) => getWeekKey(r.haftaBaslangic), (_, inc) => inc);
  };

  // Belirli bir maddeyi kaydet (düzenleme sonrası)
  const handleSaveItem = (colKey, index, newText) => {
    if (!selectedLog || !newText.trim()) return;
    const arr = [...(selectedLog[colKey] || [])];
    arr[index] = newText.trim();
    const updated = { ...selectedLog, [colKey]: arr };
    mergeRecord(updated, (r) => getWeekKey(r.haftaBaslangic), (_, inc) => inc);
    setEditingItem(null);
  };

  const ws = weekStart(selectedDate);
  const we = new Date(ws);
  we.setDate(ws.getDate() + 6);

  return (
    <div className="space-y-5">
      <SuccessMessage>{successMessage}</SuccessMessage>
      <SharedStatus syncStatus={syncStatus} count={logs.length} label="Haftalık faaliyet ortak veri durumu" />

      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">

        {/* Sol: Mini takvim */}
        <div className="space-y-3">
          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
            {/* Ay gezinme */}
            <div className="mb-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
                className="rounded-lg border border-[#D6DEEA] px-2.5 py-1.5 text-sm text-[#1F2D5C] hover:border-[#00377B]"
              >‹</button>
              <p className="text-sm font-bold text-[#1F2D5C] capitalize">{monthFmt.format(currentMonth)}</p>
              <button
                type="button"
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
                className="rounded-lg border border-[#D6DEEA] px-2.5 py-1.5 text-sm text-[#1F2D5C] hover:border-[#00377B]"
              >›</button>
            </div>

            <div className="mb-3 rounded-xl border border-[#D6DEEA] bg-[#F8FAFD] px-3 py-2">
              <p className="text-xs font-semibold text-[#1F2D5C]">Hafta seçmek için takvimde bir güne tıklayın</p>
              <p className="mt-0.5 text-[11px] leading-4 text-slate-500">
                Turuncu işaretli haftalarda faaliyet kaydı var. Hızlı Not Girişi’nden kaydedilen notlar da not tarihinin haftasına otomatik düşer.
              </p>
            </div>

            {/* Gün başlıkları */}
            <div className="grid grid-cols-7 text-center mb-1">
              {weekDayLabels.map((d) => (
                <span key={d} className="text-[10px] font-semibold text-slate-400">{d}</span>
              ))}
            </div>

            {/* Takvim günleri */}
            <div className="grid grid-cols-7 gap-y-0.5">
              {days.map((day) => {
                const isThisMonth = day.getMonth() === currentMonth.getMonth();
                const isSelected = sameWeek(day, selectedDate);
                const hasEntry = hasLog(day);
                const isToday = day.toDateString() === new Date().toDateString();

                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => {
                      setUserSelectedWeek(true);
                      setSelectedDate(day);
                    }}
                    title={hasEntry ? "Bu haftada faaliyet kaydı var" : "Bu haftayı seç"}
                    aria-label={`${dayFmt.format(day)} tarihinin haftasını seç${hasEntry ? ", kayıt var" : ""}`}
                    className={`relative rounded-md py-1.5 text-[12px] font-medium transition
                      ${!isThisMonth ? "text-slate-300" : "text-slate-700"}
                      ${isSelected ? "bg-[#00377B] text-white ring-2 ring-[#F58220]/50" : hasEntry ? "bg-[#FFF3E8] text-[#A34D00] hover:bg-[#FFE8D2]" : isThisMonth ? "hover:bg-[#EEF3FA]" : ""}
                    `}
                  >
                    {day.getDate()}
                    {hasEntry && !isSelected && (
                      <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-[#F58220]" />
                    )}
                    {isToday && !isSelected && (
                      <span className="absolute top-0.5 right-0.5 h-1 w-1 rounded-full bg-[#00377B]" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex items-center gap-3 text-[11px] text-slate-400">
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-[#F58220]" /> Kayıt var</span>
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-[#00377B]" /> Bugün</span>
            </div>
          </div>

          {visibleMonthLogs.length > 0 && (
            <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">Bu aydaki kayıtlı haftalar</p>
              <div className="space-y-2">
                {visibleMonthLogs.map((log) => {
                  const isActive = sameWeek(log.haftaBaslangic, selectedDate);
                  return (
                    <button
                      key={log.id}
                      type="button"
                      onClick={() => {
                        setUserSelectedWeek(true);
                        setSelectedDate(new Date(log.haftaBaslangic));
                      }}
                      className={`w-full rounded-xl border px-3 py-2 text-left text-xs transition ${
                        isActive
                          ? "border-[#00377B] bg-[#EEF3FA] text-[#00377B]"
                          : "border-[#D6DEEA] bg-[#F8FAFD] text-slate-600 hover:border-[#00377B] hover:bg-white"
                      }`}
                    >
                      <span className="font-semibold">{log.haftaLabel}</span>
                      <span className="mt-1 block text-[10px] text-slate-400">
                        {(log.yapilanlar?.length || 0) + (log.yapilacaklar?.length || 0) + (log.bekleyenler?.length || 0) + (log.sorunlar?.length || 0)} madde
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {editable && (
            <button
              type="button"
              onClick={() => {
                if (selectedLog) {
                  // Mevcut haftanın verilerini forma doldur
                  setFormData({
                    haftaBaslangic: selectedLog.haftaBaslangic,
                    haftaBitis: selectedLog.haftaBitis || "",
                    yapilanlar: (selectedLog.yapilanlar || []).join("\n"),
                    yapilacaklar: (selectedLog.yapilacaklar || []).join("\n"),
                    bekleyenler: (selectedLog.bekleyenler || []).join("\n"),
                    sorunlar: (selectedLog.sorunlar || []).join("\n"),
                    hazirlayan: selectedLog.hazirlayan || "",
                    operasyonIds: selectedLog.operasyonIds || [],
                  });
                } else {
                  const f = defaultEmptyForm();
                  setFormData({ ...f, haftaBaslangic: ws.toISOString().slice(0, 10) });
                }
                setModalOpen(true);
              }}
              className="w-full rounded-xl bg-[#00377B] py-2.5 text-sm font-medium text-white transition hover:bg-[#1F2D5C]"
            >
              {selectedLog ? "✎ Haftayı Düzenle" : "+ Yeni Haftalık Kayıt"}
            </button>
          )}

          <button
            type="button"
            onClick={() => window.print()}
            className="w-full rounded-xl border border-[#D6DEEA] py-2.5 text-sm font-medium text-[#1F2D5C] transition hover:border-[#00377B] print:hidden"
          >
            Yazdır / PDF
          </button>
        </div>

        {/* Sağ: Seçili hafta panosu */}
        <div>
          {selectedLog ? (
            <div className="space-y-4">
              {/* Başlık */}
              <div className="rounded-2xl border border-[#E5E7EB] bg-white px-5 py-4 shadow-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Takvimden seçilen hafta
                  </p>
                  <span className="rounded-full bg-[#EEF7F0] px-3 py-1 text-xs font-semibold text-[#1F4D2C]">
                    Kayıt görüntüleniyor
                  </span>
                </div>
                <h2 className="mt-1 text-lg font-bold text-[#1F2D5C]">{selectedLog.haftaLabel}</h2>
                <p className="mt-1 text-xs text-slate-400">
                  Farklı bir haftanın faaliyetlerini görmek için soldaki takvimden kayıtlı bir haftaya tıklayın.
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                  <span>{selectedLog.hazirlayan}</span>
                  {(selectedLog.operasyonIds || []).map((id) => (
                    <span key={id} className="rounded-md bg-[#EEF3FA] px-2 py-0.5 text-xs font-semibold text-[#00377B]">
                      {getOpName(id)}
                    </span>
                  ))}
                  {editable && (
                    <button
                      type="button"
                      onClick={handleDeleteSelectedLog}
                      className="ml-auto rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700"
                    >
                      Haftayı Sil
                    </button>
                  )}
                </div>
              </div>

              {/* Yönetici pano kolonları */}
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {boardCols.map((col) => {
                  const items = selectedLog[col.key] || [];
                  return (
                    <div key={col.key} className={`rounded-2xl border border-[#E5E7EB] ${col.bg} p-4`}>
                      <div className="mb-3 flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${col.dot}`} />
                        <p className={`text-xs font-bold uppercase tracking-wide ${col.text}`}>{col.label}</p>
                        <span className="ml-auto rounded-full bg-white/70 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">{items.length}</span>
                      </div>
                      {items.length > 0 ? (
                        <ul className="space-y-2">
                          {items.map((item, idx) =>
                            editingItem?.colKey === col.key && editingItem?.index === idx ? (
                              <li key={idx} className="rounded-xl bg-white px-3 py-2.5 shadow-sm">
                                <textarea
                                  value={editingItem.text}
                                  onChange={(e) => setEditingItem((p) => ({ ...p, text: e.target.value }))}
                                  rows={2}
                                  className="w-full resize-none rounded-lg border border-[#00377B] px-2 py-1 text-sm outline-none"
                                />
                                <div className="mt-1.5 flex gap-2">
                                  <button type="button" onClick={() => handleSaveItem(col.key, idx, editingItem.text)}
                                    className="rounded-lg bg-[#00377B] px-3 py-1 text-xs font-semibold text-white">Kaydet</button>
                                  <button type="button" onClick={() => setEditingItem(null)}
                                    className="rounded-lg border border-[#D6DEEA] px-3 py-1 text-xs text-slate-500">İptal</button>
                                </div>
                              </li>
                            ) : (
                              <li key={item + idx} className="group flex items-start gap-2 rounded-xl bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm">
                                <span className={`shrink-0 font-bold ${col.text}`}>{col.icon}</span>
                                <span className="flex-1 leading-relaxed">{item}</span>
                                {editable && (
                                <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                  <button type="button" title="Düzenle"
                                    onClick={() => setEditingItem({ colKey: col.key, index: idx, text: item })}
                                    className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-[#00377B]">
                                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                                      <path d="M18.5 2.5a2.1 2.1 0 013 3L12 15l-4 1 1-4z" />
                                    </svg>
                                  </button>
                                  <button type="button" title="Sil"
                                    onClick={() => handleDeleteItem(col.key, idx)}
                                    className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600">
                                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" />
                                      <path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
                                    </svg>
                                  </button>
                                </div>
                                )}
                              </li>
                            )
                          )}
                        </ul>
                      ) : (
                        <p className="text-xs text-slate-400">Bu haftada kayıt yok.</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex h-full min-h-64 items-center justify-center rounded-2xl border border-dashed border-[#D6DEEA] bg-white">
              <div className="text-center">
                <p className="text-sm font-semibold text-[#1F2D5C]">Bu hafta için kayıt bulunamadı</p>
                <p className="mt-1 text-xs text-slate-400">
                  {dayFmt.format(ws)} – {dayFmt.format(we)} haftası
                </p>
                <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-slate-500">
                  Kayıtlı haftaları görmek için soldaki turuncu işaretli günlere veya “Bu aydaki kayıtlı haftalar” listesine tıklayın.
                  Hızlı notlar, not tarihinin içinde bulunduğu haftada görünür.
                </p>
                {editable && (
                  <button
                    type="button"
                    onClick={() => {
                      const f = defaultEmptyForm();
                      setFormData({ ...f, haftaBaslangic: ws.toISOString().slice(0, 10), haftaBitis: we.toISOString().slice(0, 10) });
                      setModalOpen(true);
                    }}
                    className="mt-4 rounded-xl bg-[#00377B] px-4 py-2 text-sm font-medium text-white"
                  >
                    Bu Haftayı Ekle
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Form Modal */}
      {modalOpen && (
        <FormModal title="Haftalık Faaliyet Girişi" onClose={() => setModalOpen(false)} onSubmit={handleSubmit} error={formError}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block space-y-2 text-sm text-slate-600">
              <span>Başlangıç Tarihi</span>
              <input required type="date" name="haftaBaslangic" value={formData.haftaBaslangic} onChange={handleChange}
                className="w-full rounded-xl border border-[#D6DEEA] px-4 py-3 outline-none" />
            </label>
            <label className="block space-y-2 text-sm text-slate-600">
              <span>Bitiş Tarihi</span>
              <input type="date" name="haftaBitis" value={formData.haftaBitis} min={formData.haftaBaslangic} onChange={handleChange}
                className="w-full rounded-xl border border-[#D6DEEA] px-4 py-3 outline-none" />
            </label>
          </div>
          <label className="block space-y-2 text-sm text-slate-600">
            <span>Yapılanlar</span>
            <textarea name="yapilanlar" rows="4" value={formData.yapilanlar} onChange={handleChange}
              placeholder="Her satıra bir madde" className="w-full rounded-xl border border-[#D6DEEA] px-4 py-3 outline-none" />
          </label>
          <label className="block space-y-2 text-sm text-slate-600">
            <span>Yapılacaklar</span>
            <textarea name="yapilacaklar" rows="4" value={formData.yapilacaklar} onChange={handleChange}
              placeholder="Her satıra bir madde" className="w-full rounded-xl border border-[#D6DEEA] px-4 py-3 outline-none" />
          </label>
          <label className="block space-y-2 text-sm text-slate-600">
            <span>Bekleyenler</span>
            <textarea name="bekleyenler" rows="3" value={formData.bekleyenler} onChange={handleChange}
              placeholder="Her satıra bir madde" className="w-full rounded-xl border border-[#D6DEEA] px-4 py-3 outline-none" />
          </label>
          <div className="rounded-2xl border border-[#D6DEEA] bg-[#F8FAFD] p-4">
            <p className="mb-3 text-sm font-semibold text-[#1F2D5C]">Bağlı operasyonlar</p>
            <div className="grid gap-2 md:grid-cols-2">
              {operations.map((operation) => {
                const operationId = String(operation.id);
                const checked = (formData.operasyonIds || []).includes(operationId);
                return (
                  <label key={operation.id} className={`flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2 text-xs transition ${
                    checked ? "border-[#00377B] bg-white text-[#00377B]" : "border-[#E5E7EB] bg-white text-slate-600"
                  }`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleOperationToggle(operationId)}
                      className="mt-0.5 h-4 w-4"
                    />
                    <span className="font-medium leading-5">{operation.ad}</span>
                  </label>
                );
              })}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)}
              className="rounded-xl border border-[#D6DEEA] px-4 py-3 text-sm font-medium text-slate-600">Vazgeç</button>
            <button type="submit"
              className="rounded-xl bg-[#00377B] px-4 py-3 text-sm font-medium text-white">Kaydet</button>
          </div>
        </FormModal>
      )}
    </div>
  );
}

export default HaftalikFaaliyetler;

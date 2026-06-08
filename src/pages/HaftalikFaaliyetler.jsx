import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import FormModal from "../components/FormModal";
import SuccessMessage from "../components/SuccessMessage";
import useStoredCollection from "../hooks/useStoredCollection";
import initialLogs from "../data/haftalik-log.json";
import operasyonData from "../data/operasyon-kutuphanesi.json";
import { canEditData } from "../utils/auth";
import { getDateMonthKey, getWeeklyLogMonthKey, getWeeklyLogStart, getWeekKey, getWeekStart, parseDateOnly, toDateKey } from "../utils/dateKeys";
import { splitLines } from "../utils/storage";

const dayFmt = new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short" });
const monthFmt = new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric" });
const weekDayLabels = ["Pt", "Sa", "Ça", "Pe", "Cu", "Ct", "Pz"];

// Haftanın Pazartesi başlangıcını bul
function weekStart(date) {
  return getWeekStart(date);
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
  return getDateMonthKey(date);
}

function uniqueItems(items) {
  return [...new Set(items.filter(Boolean))];
}

function mergeWeeklyItems(existingItems = [], newItems = []) {
  return uniqueItems([...existingItems, ...newItems]);
}

function WeeklySyncStatus({ syncStatus, count }) {
  const meta = {
    "ortak-veri-aktif": {
      label: "Ortak veri aktif",
      detail: `${count} kayıt izleniyor`,
      className: "border-[#BFD0E6] bg-[#EEF3FA] text-[#00377B]",
    },
    "ortak-veri-hatasi": {
      label: "Ortak veri bağlantısı yok",
      detail: "Yerel yedek gösteriliyor",
      className: "border-red-200 bg-red-50 text-red-700",
    },
    "ortak-veri-baglaniyor": {
      label: "Ortak veri alınıyor",
      detail: "Bağlantı kontrol ediliyor",
      className: "border-[#BFD0E6] bg-[#EEF3FA] text-[#00377B]",
    },
    yerel: {
      label: "Yerel mod",
      detail: "Supabase ayarı görünmüyor",
      className: "border-[#D6DEEA] bg-white text-[#1F2D5C]",
    },
  };
  const current = meta[syncStatus] || meta.yerel;

  return (
    <div className="flex justify-end">
      <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${current.className}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        <span>{current.label}</span>
        <span className="font-medium opacity-65">· {current.detail}</span>
      </div>
    </div>
  );
}

function defaultEmptyForm() {
  const bugun = new Date();
  const baslangic = weekStart(bugun);
  const bitis = new Date(baslangic);
  bitis.setDate(baslangic.getDate() + 6);
  return {
    haftaBaslangic: toDateKey(baslangic),
    haftaBitis: toDateKey(bitis),
    yapilanlar: "",
    yapilacaklar: "",
    bekleyenler: "",
    hazirlayan: "",
    operasyonIds: [],
  };
}

const boardCols = [
  { key: "yapilanlar", label: "Yapılanlar", bg: "bg-[#EEF3FA]", text: "text-[#00377B]", dot: "bg-[#00377B]", icon: "✓" },
  { key: "yapilacaklar", label: "Yapılacaklar", bg: "bg-[#EEF3FA]", text: "text-[#00377B]", dot: "bg-[#00377B]", icon: "→" },
  { key: "bekleyenler", label: "Bekleyenler", bg: "bg-[#F8FAFD]", text: "text-[#1F2D5C]", dot: "bg-[#1F2D5C]", icon: "•" },
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
  const [formMode, setFormMode] = useState("new");
  const [formData, setFormData] = useState(defaultEmptyForm);
  const [editingItem, setEditingItem] = useState(null); // { colKey, index, text }
  const [addingItem, setAddingItem] = useState(null); // { colKey, text }
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [userSelectedWeek, setUserSelectedWeek] = useState(false);

  useEffect(() => {
    if (logs.length === 0 || userSelectedWeek) return;
    const hasSelectedLog = logs.some((log) => sameWeek(getWeeklyLogStart(log), selectedDate));
    if (!hasSelectedLog) {
      const latestLogDate = getWeeklyLogStart(logs[0]);
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
      haftaBaslangic: prev.haftaBaslangic || toDateKey(weekStart(today)),
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
    () => logs.find((log) => sameWeek(getWeeklyLogStart(log), selectedDate)) || null,
    [logs, selectedDate],
  );

  // Bir günün kaydı var mı?
  const hasLog = (day) => logs.some((log) => sameWeek(getWeeklyLogStart(log), day));
  const visibleMonthLogs = useMemo(
    () =>
      logs
        .filter((log) => getWeeklyLogMonthKey(log) === getMonthKey(currentMonth))
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
    const ws = parseDateOnly(formData.haftaBaslangic);
    const we = formData.haftaBitis ? parseDateOnly(formData.haftaBitis) : (() => { const d = new Date(ws); d.setDate(ws.getDate() + 6); return d; })();
    const label = `${dayFmt.format(ws)} – ${dayFmt.format(we)} ${ws.getFullYear()} Haftası`;
    const newRecord = {
      id: `week-${getWeekKey(ws)}`,
      haftaLabel: label,
      haftaBaslangic: toDateKey(ws),
      haftaBitis: toDateKey(we),
      yapilanlar: splitLines(formData.yapilanlar),
      yapilacaklar: splitLines(formData.yapilacaklar),
      bekleyenler: splitLines(formData.bekleyenler),
      hazirlayan: formData.hazirlayan || "Öğrenci Destek Koordinatörlüğü",
      operasyonIds: formData.operasyonIds || [],
    };

    mergeRecord(
      newRecord,
      (record) => getWeekKey(record.haftaBaslangic),
      (existingRecord, incomingRecord) =>
        formMode === "edit"
          ? {
              ...existingRecord,
              ...incomingRecord,
              id: existingRecord.id,
            }
          : {
              ...existingRecord,
              ...incomingRecord,
              id: existingRecord.id,
              haftaLabel: existingRecord.haftaLabel || incomingRecord.haftaLabel,
              haftaBaslangic: incomingRecord.haftaBaslangic,
              haftaBitis: incomingRecord.haftaBitis || existingRecord.haftaBitis,
              operasyonIds: uniqueItems([...(existingRecord.operasyonIds || []), ...(incomingRecord.operasyonIds || [])]),
              yapilanlar: mergeWeeklyItems(existingRecord.yapilanlar, incomingRecord.yapilanlar),
              yapilacaklar: mergeWeeklyItems(existingRecord.yapilacaklar, incomingRecord.yapilacaklar),
              bekleyenler: mergeWeeklyItems(existingRecord.bekleyenler, incomingRecord.bekleyenler),
              hazirlayan: incomingRecord.hazirlayan || existingRecord.hazirlayan,
            },
    );
    setSelectedDate(ws);
    setCurrentMonth(new Date(ws.getFullYear(), ws.getMonth(), 1));
    setModalOpen(false);
    setFormData(defaultEmptyForm());
    setFormMode("new");
    setSuccessMessage(formMode === "edit" ? "Haftalık kayıt güncellendi." : "Haftalık kayıt eklendi. Aynı haftadaki eski maddeler korundu.");
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
    setSuccessMessage("Madde silindi.");
  };

  const handleMoveItemToDone = (colKey, index) => {
    if (!selectedLog || colKey === "yapilanlar") return;
    const item = (selectedLog[colKey] || [])[index];
    if (!item) return;
    const updated = {
      ...selectedLog,
      [colKey]: (selectedLog[colKey] || []).filter((_, i) => i !== index),
      yapilanlar: mergeWeeklyItems(selectedLog.yapilanlar, [item]),
    };
    mergeRecord(updated, (r) => getWeekKey(r.haftaBaslangic), (_, inc) => inc);
    setSuccessMessage("Madde Yapılanlar alanına taşındı.");
  };

  // Belirli bir maddeyi kaydet (düzenleme sonrası)
  const handleSaveItem = (colKey, index, newText) => {
    if (!selectedLog || !newText.trim()) return;
    const arr = [...(selectedLog[colKey] || [])];
    arr[index] = newText.trim();
    const updated = { ...selectedLog, [colKey]: arr };
    mergeRecord(updated, (r) => getWeekKey(r.haftaBaslangic), (_, inc) => inc);
    setEditingItem(null);
    setSuccessMessage("Madde güncellendi.");
  };

  const openNewWeekForm = () => {
    const f = defaultEmptyForm();
    setFormMode("new");
    setFormData({ ...f, haftaBaslangic: toDateKey(ws), haftaBitis: toDateKey(we) });
    setModalOpen(true);
  };

  const openEditWeekForm = () => {
    if (!selectedLog) {
      openNewWeekForm();
      return;
    }

    setFormMode("edit");
    setFormData({
      haftaBaslangic: selectedLog.haftaBaslangic,
      haftaBitis: selectedLog.haftaBitis || "",
      yapilanlar: (selectedLog.yapilanlar || []).join("\n"),
      yapilacaklar: (selectedLog.yapilacaklar || []).join("\n"),
      bekleyenler: (selectedLog.bekleyenler || []).join("\n"),
      hazirlayan: selectedLog.hazirlayan || "",
      operasyonIds: selectedLog.operasyonIds || [],
    });
    setModalOpen(true);
  };

  const handleAddItem = (colKey) => {
    const text = addingItem?.colKey === colKey ? addingItem.text.trim() : "";
    if (!text) return;

    const baseRecord = selectedLog || {
      id: `week-${getWeekKey(ws)}`,
      haftaLabel: `${dayFmt.format(ws)} – ${dayFmt.format(we)} ${ws.getFullYear()} Haftası`,
      haftaBaslangic: toDateKey(ws),
      haftaBitis: toDateKey(we),
      yapilanlar: [],
      yapilacaklar: [],
      bekleyenler: [],
      hazirlayan: "Öğrenci Destek Koordinatörlüğü",
      operasyonIds: [],
    };

    const updated = {
      ...baseRecord,
      [colKey]: mergeWeeklyItems(baseRecord[colKey], [text]),
    };

    mergeRecord(updated, (r) => getWeekKey(r.haftaBaslangic), (_, inc) => inc);
    setAddingItem(null);
    setSuccessMessage("Yeni madde eklendi.");
  };

  const ws = weekStart(selectedDate);
  const we = new Date(ws);
  we.setDate(ws.getDate() + 6);

  return (
    <div className="space-y-5">
      <SuccessMessage>{successMessage}</SuccessMessage>
      <WeeklySyncStatus syncStatus={syncStatus} count={logs.length} />

      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">

        {/* Sol: Mini takvim */}
        <div className="space-y-3">
          <div className="overflow-hidden rounded-3xl border border-[#D6DEEA] bg-white shadow-sm">
            <div className="h-1.5 bg-gradient-to-r from-[#00377B] via-[#1F2D5C] to-[#F58220]" />
            <div className="p-4">
            {/* Ay gezinme */}
            <div className="mb-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
                className="rounded-xl border border-[#D6DEEA] bg-[#F8FAFD] px-3 py-2 text-sm font-bold text-[#1F2D5C] hover:border-[#00377B]"
              >‹</button>
              <div className="text-center">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Takvim</p>
                <p className="text-base font-black text-[#1F2D5C] capitalize">{monthFmt.format(currentMonth)}</p>
              </div>
              <button
                type="button"
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
                className="rounded-xl border border-[#D6DEEA] bg-[#F8FAFD] px-3 py-2 text-sm font-bold text-[#1F2D5C] hover:border-[#00377B]"
              >›</button>
            </div>

            <div className="mb-3 rounded-2xl border border-[#D6DEEA] bg-[#F8FAFD] px-3 py-2">
              <p className="text-[11px] leading-4 text-slate-500">
                Kayıtlı haftalar turuncu nokta ile gösterilir. Haftayı görmek için ilgili güne tıklayın.
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
          </div>

          {visibleMonthLogs.length > 0 && (
            <div className="rounded-3xl border border-[#D6DEEA] bg-white p-4 shadow-sm">
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">Bu aydaki kayıtlı haftalar</p>
              <div className="space-y-2">
                {visibleMonthLogs.map((log) => {
                  const isActive = sameWeek(getWeeklyLogStart(log), selectedDate);
                  return (
                    <button
                      key={log.id}
                      type="button"
                      onClick={() => {
                        setUserSelectedWeek(true);
                        setSelectedDate(getWeeklyLogStart(log));
                      }}
                      className={`w-full rounded-xl border px-3 py-2 text-left text-xs transition ${
                        isActive
                          ? "border-[#00377B] bg-[#EEF3FA] text-[#00377B]"
                          : "border-[#D6DEEA] bg-[#F8FAFD] text-slate-600 hover:border-[#00377B] hover:bg-white"
                      }`}
                    >
                      <span className="font-semibold">{log.haftaLabel}</span>
                      <span className="mt-1 block text-[10px] text-slate-400">
                        {(log.yapilanlar?.length || 0) + (log.yapilacaklar?.length || 0) + (log.bekleyenler?.length || 0)} madde
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {editable && (
            <div className="grid gap-2">
              <button
                type="button"
                onClick={openNewWeekForm}
                className="w-full rounded-xl bg-[#00377B] py-2.5 text-sm font-bold text-white transition hover:bg-[#1F2D5C]"
              >
                + Yeni Haftalık Kayıt
              </button>
              {selectedLog && (
                <button
                  type="button"
                  onClick={openEditWeekForm}
                  className="w-full rounded-xl border border-[#BFD0E6] bg-[#EEF3FA] py-2.5 text-sm font-bold text-[#00377B] transition hover:border-[#00377B] hover:bg-white"
                >
                  Haftayı Düzenle
                </button>
              )}
            </div>
          )}
        </div>

        {/* Sağ: Seçili hafta panosu */}
        <div>
          {selectedLog ? (
            <div className="space-y-4">
              {/* Başlık */}
              <div className="overflow-hidden rounded-3xl border border-[#D6DEEA] bg-white shadow-sm">
                <div className="h-1.5 bg-gradient-to-r from-[#00377B] via-[#1F2D5C] to-[#F58220]" />
                <div className="px-6 py-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
                        Seçili hafta
                      </p>
                      <h2 className="mt-2 text-2xl font-black tracking-tight text-[#1F2D5C]">{selectedLog.haftaLabel}</h2>
                      <p className="mt-1 text-sm text-slate-500">{selectedLog.hazirlayan}</p>
                    </div>
                    {editable && (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={openNewWeekForm}
                          className="rounded-xl bg-[#00377B] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#1F2D5C]"
                        >
                          + Yeni Kayıt
                        </button>
                        <button
                          type="button"
                          onClick={openEditWeekForm}
                          className="rounded-xl border border-[#BFD0E6] bg-[#EEF3FA] px-3 py-2 text-xs font-bold text-[#00377B] transition hover:border-[#00377B] hover:bg-white"
                        >
                          Düzenle
                        </button>
                      </div>
                    )}
                  </div>
                <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-slate-500">
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
              </div>

              {/* Yönetici pano kolonları */}
              <div className="grid gap-4 md:grid-cols-3">
                {boardCols.map((col) => {
                  const items = selectedLog[col.key] || [];
                  return (
                    <div key={col.key} className={`overflow-hidden rounded-3xl border ${col.bg} shadow-sm`}>
                      <div className="h-1 bg-[#00377B]" />
                      <div className="p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${col.dot}`} />
                        <p className={`text-xs font-bold uppercase tracking-wide ${col.text}`}>{col.label}</p>
                        <span className="ml-auto rounded-full bg-white/70 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">{items.length}</span>
                      </div>
                      {editable && (
                        <div className="mb-3">
                          {addingItem?.colKey === col.key ? (
                            <div className="rounded-2xl border border-[#BFD0E6] bg-white p-2 shadow-sm">
                              <textarea
                                value={addingItem.text}
                                onChange={(event) => setAddingItem({ colKey: col.key, text: event.target.value })}
                                rows={2}
                                autoFocus
                                placeholder={`${col.label} için yeni madde yazın`}
                                className="w-full resize-none rounded-xl border border-[#D6DEEA] px-3 py-2 text-sm outline-none focus:border-[#00377B]"
                              />
                              <div className="mt-2 flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleAddItem(col.key)}
                                  className="rounded-lg bg-[#00377B] px-3 py-1.5 text-xs font-bold text-white"
                                >
                                  Ekle
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setAddingItem(null)}
                                  className="rounded-lg border border-[#D6DEEA] px-3 py-1.5 text-xs font-semibold text-slate-500"
                                >
                                  Vazgeç
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setAddingItem({ colKey: col.key, text: "" })}
                              className="w-full rounded-xl border border-dashed border-[#BFD0E6] bg-white/70 px-3 py-2 text-xs font-bold text-[#00377B] transition hover:border-[#00377B] hover:bg-white"
                            >
                              + Madde Ekle
                            </button>
                          )}
                        </div>
                      )}
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
                                <div className="flex shrink-0 flex-wrap justify-end gap-1">
                                  {col.key !== "yapilanlar" && (
                                    <button type="button" title="Yapılanlara taşı"
                                      onClick={() => handleMoveItemToDone(col.key, idx)}
                                      className="rounded-lg border border-[#BFD0E6] bg-[#EEF3FA] px-2 py-1 text-[10px] font-bold text-[#00377B] hover:border-[#00377B] hover:bg-white">
                                      Yapıldı
                                    </button>
                                  )}
                                  <button type="button" title="Düzenle"
                                    onClick={() => setEditingItem({ colKey: col.key, index: idx, text: item })}
                                    className="rounded-lg border border-[#D6DEEA] bg-white px-2 py-1 text-[10px] font-bold text-[#1F2D5C] hover:border-[#00377B] hover:text-[#00377B]">
                                    Düzenle
                                  </button>
                                  <button type="button" title="Sil"
                                    onClick={() => handleDeleteItem(col.key, idx)}
                                    className="rounded-lg border border-red-100 bg-red-50 px-2 py-1 text-[10px] font-bold text-red-600 hover:border-red-200 hover:bg-red-100">
                                    Sil
                                  </button>
                                </div>
                                )}
                              </li>
                            )
                          )}
                        </ul>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-[#D6DEEA] bg-white/70 px-3 py-5 text-center">
                          <p className="text-xs font-medium text-slate-400">Bu haftada kayıt yok.</p>
                        </div>
                      )}
                      </div>
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
                      setFormData({ ...f, haftaBaslangic: toDateKey(ws), haftaBitis: toDateKey(we) });
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
        <FormModal
          title={formMode === "edit" ? "Haftalık Kaydı Düzenle" : "Yeni Haftalık Kayıt"}
          onClose={() => {
            setModalOpen(false);
            setFormMode("new");
            setFormError("");
          }}
          onSubmit={handleSubmit}
          error={formError}
        >
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
            <button type="button" onClick={() => {
              setModalOpen(false);
              setFormMode("new");
              setFormError("");
            }}
              className="rounded-xl border border-[#D6DEEA] px-4 py-3 text-sm font-medium text-slate-600">Vazgeç</button>
            <button type="submit"
              className="rounded-xl bg-[#00377B] px-4 py-3 text-sm font-medium text-white">
              {formMode === "edit" ? "Güncelle" : "Kaydet"}
            </button>
          </div>
        </FormModal>
      )}
    </div>
  );
}

export default HaftalikFaaliyetler;

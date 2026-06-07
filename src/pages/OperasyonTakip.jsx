import { useMemo, useState } from "react";
import useStoredCollection from "../hooks/useStoredCollection";
import haftalikLogData from "../data/haftalik-log.json";
import { buildVisibleMonthKeys, getLogMonthKey, getMonthKey, getMonthLabel } from "../utils/months";

const shortFmt  = new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short" });

const TYPES = [
  { key: "yapilanlar", label: "Yapılan", color: "#1F4D2C", bg: "bg-[#F0FFF6]", border: "border-[#BDEFD1]", text: "text-[#1F4D2C]", dot: "bg-[#1F4D2C]" },
  { key: "yapilacaklar", label: "Yapılacak", color: "#00377B", bg: "bg-[#EEF3FA]", border: "border-[#BFD0E6]", text: "text-[#00377B]", dot: "bg-[#00377B]" },
  { key: "bekleyenler", label: "Bekleyen", color: "#F58220", bg: "bg-[#FFF8F1]", border: "border-[#F7D7B7]", text: "text-[#9A4A00]", dot: "bg-[#F58220]" },
  { key: "sorunlar", label: "Riskli", color: "#B42318", bg: "bg-[#FFF7F7]", border: "border-[#F2C8C8]", text: "text-[#B42318]", dot: "bg-[#B42318]" },
];

function ProgressBar({ value, max, color }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}

function WorkSyncPill({ syncStatus, count }) {
  const isActive = syncStatus === "ortak-veri-aktif";
  const isError = syncStatus === "ortak-veri-hatasi";
  const label = isActive
    ? `Ortak veri aktif · ${count} kayıt`
    : isError
      ? "Ortak veri bağlantısı yok"
      : syncStatus === "ortak-veri-baglaniyor"
        ? "Ortak veri bağlanıyor"
        : "Yerel mod";

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-bold ${
      isActive
        ? "border-[#BDEFD1] bg-[#F0FFF6] text-[#1F4D2C]"
        : isError
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-[#D6DEEA] bg-white text-[#60708B]"
    }`}>
      {label}
    </span>
  );
}

function YapilanIslerTakibi() {
  const { records: logs, syncStatus } = useStoredCollection("haftalikLogRecords", haftalikLogData, {
    sortByDateField: "haftaBaslangic",
  });

  const [activeType,    setActiveType]    = useState("yapilanlar");
  const [selectedMonth, setSelectedMonth] = useState(() => getMonthKey(new Date()));
  const [search,        setSearch]        = useState("");

  const monthKeys = useMemo(() => {
    return buildVisibleMonthKeys(logs, new Date());
  }, [logs]);

  // Aylık dağılım (her zaman TÜM loglar — grafik için)
  const monthlyStats = useMemo(() => {
    const map = new Map();
    logs.forEach((log) => {
      const key = getLogMonthKey(log);
      const prev = map.get(key) || { key, yapilanlar: 0, yapilacaklar: 0, bekleyenler: 0, sorunlar: 0, haftaSayisi: 0 };
      map.set(key, {
        key,
        yapilanlar:   prev.yapilanlar   + (log.yapilanlar?.length   || 0),
        yapilacaklar: prev.yapilacaklar + (log.yapilacaklar?.length  || 0),
        bekleyenler:  prev.bekleyenler  + (log.bekleyenler?.length   || 0),
        sorunlar:     prev.sorunlar     + (log.sorunlar?.length      || 0),
        haftaSayisi:  prev.haftaSayisi  + 1,
      });
    });
    return Array.from(map.values()).sort((a, b) => b.key.localeCompare(a.key));
  }, [logs]);

  // Grafik için max değer
  const maxMonthly = useMemo(
    () => Math.max(...monthlyStats.map((m) => m[activeType]), 1),
    [monthlyStats, activeType],
  );

  // Seçili aya göre filtrelenmiş loglar
  const filteredLogs = useMemo(
    () => selectedMonth === "Tümü"
      ? logs
      : logs.filter((l) => getLogMonthKey(l) === selectedMonth),
    [logs, selectedMonth],
  );

  // Filtrelenmiş totaller (kartlar için)
  const filteredTotals = useMemo(
    () => TYPES.reduce((acc, t) => {
      acc[t.key] = filteredLogs.reduce((s, l) => s + (l[t.key]?.length || 0), 0);
      return acc;
    }, {}),
    [filteredLogs],
  );

  const maxFiltered = Math.max(...Object.values(filteredTotals), 1);

  // Tüm maddeler düz liste (filtrelenmiş + arama)
  const allItems = useMemo(() => {
    const items = [];
    filteredLogs.forEach((log) => {
      (log[activeType] || []).forEach((item) => {
        if (!search || item.toLowerCase().includes(search.toLowerCase())) {
          items.push({ text: item, hafta: log.haftaLabel, tarih: log.haftaBaslangic, logId: log.id });
        }
      });
    });
    return items;
  }, [filteredLogs, activeType, search]);

  const typeInfo = TYPES.find((t) => t.key === activeType);
  const activeMonthLabel = selectedMonth === "Tümü" ? "Tüm Zamanlar" : getMonthLabel(selectedMonth);

  return (
    <div className="space-y-6">
      {/* Başlık ve kontrol alanı */}
      <section className="overflow-hidden rounded-[1.6rem] border border-[#D6DEEA] bg-white shadow-sm">
        <div className="h-2 bg-gradient-to-r from-[#00377B] via-[#1F2D5C] to-[#1F4D2C]" />
        <div className="flex flex-col gap-5 px-6 py-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.26em] text-[#8A9AB5]">2026-2027 Akademik Yılı</p>
            <h2 className="mt-1 text-2xl font-extrabold text-[#1F2D5C]">Yapılan İşler Takibi</h2>
            <p className="mt-2 text-sm leading-6 text-[#60708B]">
              Haftalık faaliyetlerden gelen yapılan, yapılacak ve bekleyen işleri tek ekranda izleyin.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <WorkSyncPill syncStatus={syncStatus} count={logs.length} />
              <span className="inline-flex items-center rounded-full border border-[#D6DEEA] bg-[#F8FAFD] px-3 py-1.5 text-xs font-bold text-[#1F2D5C]">
                {activeMonthLabel}
              </span>
              <span className="inline-flex items-center rounded-full border border-[#D6DEEA] bg-[#F8FAFD] px-3 py-1.5 text-xs font-bold text-[#1F2D5C]">
                {filteredLogs.length} haftalık kayıt
              </span>
            </div>
          </div>
          <div className="w-full max-w-sm">
            <label className="space-y-2 text-sm font-bold text-[#60708B]">
              <span>Ay seçimi</span>
              <select
                value={selectedMonth}
                onChange={(event) => setSelectedMonth(event.target.value)}
                className="w-full rounded-xl border border-[#D6DEEA] bg-[#F8FAFD] px-4 py-3 text-sm font-extrabold text-[#1F2D5C] outline-none transition focus:border-[#00377B] focus:ring-4 focus:ring-[#00377B]/10"
              >
                <option value="Tümü">Tüm Zamanlar</option>
                {monthKeys.map((key) => (
                  <option key={key} value={key}>{getMonthLabel(key)}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </section>

      {/* Ay seçici */}
      <div className="rounded-[1.35rem] border border-[#D6DEEA] bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#8A9AB5]">Hızlı Ay Seçimi</p>
            <p className="text-xs text-[#60708B]">Sık kullanılan aylar için hızlı geçiş.</p>
          </div>
          <button
            type="button"
            onClick={() => setSelectedMonth(getMonthKey(new Date()))}
            className="rounded-xl border border-[#D6DEEA] bg-[#F8FAFD] px-3 py-2 text-xs font-bold text-[#00377B] hover:border-[#00377B]"
          >
            Bu aya dön
          </button>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
        {["Tümü", ...monthKeys].map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setSelectedMonth(key)}
            className={`shrink-0 rounded-xl px-3 py-2 text-sm font-bold transition ${
              selectedMonth === key
                ? "bg-[#00377B] text-white shadow-sm"
                : "border border-[#D6DEEA] bg-white text-[#1F2D5C] hover:border-[#00377B] hover:bg-[#F8FAFD]"
            }`}
          >
            {key === "Tümü" ? "Tüm Zamanlar" : getMonthLabel(key)}
          </button>
        ))}
        </div>
      </div>

      {/* Sayaç kartları */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {TYPES.map((t) => (
          <button key={t.key} type="button" onClick={() => setActiveType(t.key)}
            className={`overflow-hidden rounded-[1.35rem] border bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
              activeType === t.key ? `${t.border} ring-2 ring-[#00377B]/10` : "border-[#E5E7EB] hover:border-[#BFD0E6]"
            }`}
          >
            <div className="h-1.5" style={{ backgroundColor: t.color }} />
            <div className={`${activeType === t.key ? t.bg : "bg-white"} p-4`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${t.dot}`} />
                  <p className={`text-sm font-extrabold ${activeType === t.key ? t.text : "text-[#1F2D5C]"}`}>
                    {t.label}
                  </p>
                </div>
                <span className={`text-3xl font-extrabold leading-none ${activeType === t.key ? t.text : "text-[#1F2D5C]"}`}>
                  {filteredTotals[t.key]}
                </span>
              </div>
              <div className="mt-4">
                <ProgressBar value={filteredTotals[t.key]} max={maxFiltered} color={t.color} />
              </div>
              <p className="mt-2 text-xs font-semibold text-[#8A9AB5]">{filteredLogs.length} haftalık kayıt</p>
            </div>
          </button>
        ))}
      </div>

      {/* Aylık dağılım grafiği */}
      <div className="rounded-[1.35rem] border border-[#D6DEEA] bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#8A9AB5]">Aylık Dağılım</p>
            <h3 className="mt-1 text-lg font-extrabold text-[#1F2D5C]">{typeInfo.label} maddeleri</h3>
          </div>
          <div className="flex rounded-xl border border-[#D6DEEA] bg-[#F8FAFD] p-1">
            {TYPES.map((t) => (
              <button key={t.key} type="button" onClick={() => setActiveType(t.key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  activeType === t.key ? "bg-[#00377B] text-white shadow-sm" : "text-[#60708B] hover:bg-white"
                }`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          {monthlyStats.length === 0 && <p className="text-sm text-slate-400">Henüz kayıt yok.</p>}
          {monthlyStats.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setSelectedMonth(selectedMonth === m.key ? "Tümü" : m.key)}
              className={`grid w-full grid-cols-[150px_1fr_40px] items-center gap-3 rounded-xl p-2 text-left transition ${
                selectedMonth === m.key ? "bg-[#EEF3FA] ring-1 ring-[#BFD0E6]" : "hover:bg-[#F8FAFD]"
              }`}
            >
              <p className={`truncate text-sm font-bold ${selectedMonth === m.key ? "text-[#00377B]" : "text-[#42526E]"}`}>
                {getMonthLabel(m.key)}
              </p>
              <ProgressBar value={m[activeType]} max={maxMonthly} color={typeInfo.color} />
              <span className={`text-sm font-bold text-right ${typeInfo.text}`}>{m[activeType]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tüm maddeler */}
      <div className="overflow-hidden rounded-[1.35rem] border border-[#D6DEEA] bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-[#E5E7EB] px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <span className={`h-3 w-3 rounded-full ${typeInfo.dot}`} />
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#8A9AB5]">Detay Liste</p>
              <h3 className="mt-1 text-lg font-extrabold text-[#1F2D5C]">
                {typeInfo.label} Maddeleri
                <span className="ml-2 text-sm font-semibold text-[#8A9AB5]">({allItems.length})</span>
              </h3>
            </div>
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ara…"
            className="w-full rounded-xl border border-[#D6DEEA] bg-[#F8FAFD] px-4 py-3 text-sm font-semibold text-[#1F2D5C] outline-none transition placeholder:text-[#A8B3C6] focus:border-[#00377B] focus:bg-white focus:ring-4 focus:ring-[#00377B]/10 md:w-64"
          />
        </div>
        {allItems.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm font-semibold text-[#8A9AB5]">
              {search ? `"${search}" için sonuç bulunamadı.` : "Bu kategoride kayıt yok."}
            </p>
            <p className="mt-1 text-xs text-[#A8B3C6]">Haftalık faaliyet veya hızlı not kaydı girildiğinde burada listelenir.</p>
          </div>
        ) : (
          <div className="grid gap-3 p-5 lg:grid-cols-2">
            {allItems.map((item, i) => (
              <div key={`${item.logId}-${i}`} className={`rounded-2xl border ${typeInfo.border} ${typeInfo.bg} p-4`}>
                <div className="flex items-start gap-3">
                  <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${typeInfo.dot}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-6 text-[#42526E]">{item.text}</p>
                    <p className="mt-2 text-xs font-semibold text-[#8A9AB5]">
                    {item.hafta || shortFmt.format(new Date(item.tarih))}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default YapilanIslerTakibi;

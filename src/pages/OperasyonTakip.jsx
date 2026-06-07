import { useMemo, useState } from "react";
import SharedStatus from "../components/SharedStatus";
import useStoredCollection from "../hooks/useStoredCollection";
import haftalikLogData from "../data/haftalik-log.json";
import { buildVisibleMonthKeys, getMonthKey, getMonthLabel } from "../utils/months";

const shortFmt  = new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short" });

const TYPES = [
  { key: "yapilanlar",   label: "Yapılan",   color: "#1F4D2C", bg: "bg-[#EEF7F0]", text: "text-[#1F4D2C]", dot: "bg-[#1F4D2C]", icon: "✓" },
  { key: "yapilacaklar", label: "Yapılacak", color: "#00377B", bg: "bg-[#EEF3FA]", text: "text-[#00377B]", dot: "bg-[#00377B]", icon: "→" },
  { key: "bekleyenler",  label: "Bekleyen",  color: "#A34D00", bg: "bg-[#FFF3E8]", text: "text-[#A34D00]", dot: "bg-[#F58220]", icon: "⏳" },
  { key: "sorunlar",     label: "Riskli",    color: "#B91C1C", bg: "bg-red-50",    text: "text-red-700", dot: "bg-red-500", icon: "!" },
];

function ProgressBar({ value, max, color }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
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
      const key = getMonthKey(log.haftaBaslangic);
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
      : logs.filter((l) => getMonthKey(l.haftaBaslangic) === selectedMonth),
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

  return (
    <div className="space-y-5">
      <SharedStatus syncStatus={syncStatus} count={logs.length} label="Yapılan işler ortak veri durumu" />

      {/* Başlık */}
      <div className="rounded-2xl border border-[#D6DEEA] bg-gradient-to-r from-[#0E2650] to-[#1F2D5C] px-6 py-5 text-white">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">2026-2027 Akademik Yılı</p>
        <h2 className="mt-1 text-xl font-bold">Yapılan İşler Takibi</h2>
        <p className="mt-1 text-sm text-white/55">Tüm haftalık kayıtların özeti ve detayı</p>
      </div>

      {/* Ay seçici */}
      <div className="rounded-2xl border border-[#D6DEEA] bg-white p-3 shadow-sm">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Ay seçimi</p>
            <p className="text-xs text-slate-500">Varsayılan olarak içinde bulunduğumuz ay açılır; tüm zamanlar veya başka ay seçilebilir.</p>
          </div>
          <select
            value={selectedMonth}
            onChange={(event) => setSelectedMonth(event.target.value)}
            className="rounded-xl border border-[#D6DEEA] bg-[#F8FAFD] px-3 py-2 text-sm font-semibold text-[#1F2D5C] outline-none focus:border-[#00377B]"
          >
            <option value="Tümü">Tüm Zamanlar</option>
            {monthKeys.map((key) => (
              <option key={key} value={key}>{getMonthLabel(key)}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
        {["Tümü", ...monthKeys].map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setSelectedMonth(key)}
            className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
              selectedMonth === key
                ? "bg-[#00377B] text-white shadow-sm"
                : "border border-[#D6DEEA] bg-white text-[#1F2D5C] hover:border-[#00377B]"
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
            className={`rounded-2xl border p-4 text-left transition ${
              activeType === t.key ? `border-2 border-current ${t.bg} shadow-sm` : "border-[#E5E7EB] bg-white hover:border-slate-300"
            }`}
          >
            <div className="flex items-center justify-between">
              <p className={`text-xs font-bold uppercase tracking-wide ${activeType === t.key ? t.text : "text-slate-500"}`}>
                {t.icon} {t.label}
              </p>
              <span className={`text-2xl font-bold ${activeType === t.key ? t.text : "text-slate-700"}`}>
                {filteredTotals[t.key]}
              </span>
            </div>
            <ProgressBar value={filteredTotals[t.key]} max={maxFiltered} color={t.color} />
            <p className="mt-1.5 text-xs text-slate-400">{filteredLogs.length} haftalık kayıt</p>
          </button>
        ))}
      </div>

      {/* Aylık dağılım grafiği */}
      <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#1F2D5C]">Aylık Dağılım</h3>
          <div className="flex rounded-xl border border-[#D6DEEA] bg-[#F8FAFD] p-0.5">
            {TYPES.map((t) => (
              <button key={t.key} type="button" onClick={() => setActiveType(t.key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  activeType === t.key ? "bg-[#00377B] text-white" : "text-slate-500 hover:bg-white"
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
              className={`grid w-full grid-cols-[140px_1fr_32px] items-center gap-3 rounded-lg p-1.5 text-left transition ${
                selectedMonth === m.key ? "bg-[#EEF3FA]" : "hover:bg-slate-50"
              }`}
            >
              <p className={`text-xs font-semibold truncate ${selectedMonth === m.key ? "text-[#00377B]" : "text-slate-600"}`}>
                {getMonthLabel(m.key)}
              </p>
              <ProgressBar value={m[activeType]} max={maxMonthly} color={typeInfo.color} />
              <span className={`text-sm font-bold text-right ${typeInfo.text}`}>{m[activeType]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tüm maddeler */}
      <div className="rounded-2xl border border-[#E5E7EB] bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-[#E5E7EB] px-5 py-4">
          <div className={`h-2.5 w-2.5 rounded-full ${typeInfo.dot}`} />
          <h3 className="text-sm font-bold text-[#1F2D5C]">
            {typeInfo.label} Maddeleri
            <span className="ml-2 font-normal text-slate-400">({allItems.length})</span>
          </h3>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ara…"
            className="ml-auto w-44 rounded-xl border border-[#D6DEEA] px-3 py-2 text-sm outline-none focus:border-[#00377B]"
          />
        </div>
        {allItems.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-400">
            {search ? `"${search}" için sonuç bulunamadı.` : "Bu kategoride kayıt yok."}
          </p>
        ) : (
          <div className="divide-y divide-[#EEF2F7]">
            {allItems.map((item, i) => (
              <div key={`${item.logId}-${i}`} className="flex items-start gap-3 px-5 py-3 hover:bg-slate-50">
                <span className={`mt-0.5 h-5 w-5 shrink-0 rounded-full text-center text-[11px] font-bold leading-5 text-white ${typeInfo.dot}`}>
                  {typeInfo.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700 leading-relaxed">{item.text}</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    {item.hafta || shortFmt.format(new Date(item.tarih))}
                  </p>
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

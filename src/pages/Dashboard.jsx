import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Badge from "../components/Badge";
import SectionCard from "../components/SectionCard";
import SharedStatus from "../components/SharedStatus";
import StatCard from "../components/StatCard";
import useStoredCollection from "../hooks/useStoredCollection";
import takvimData from "../data/akademik-takvim.json";
import haftalikLogData from "../data/haftalik-log.json";
import operasyonData from "../data/operasyon-kutuphanesi.json";
import { canEditData } from "../utils/auth";
import { getCalendarAlert } from "../utils/calendar";
import { buildVisibleMonthKeys, getMonthKey, getMonthLabel } from "../utils/months";

const dateFormatter = new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "long", year: "numeric" });
const shortDateFormatter = new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short" });
const weekdayFormatter = new Intl.DateTimeFormat("tr-TR", { weekday: "long" });

function weekStart(date) {
  const d = new Date(date);
  const day = d.getDay() || 7;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day + 1);
  return d;
}

function getWeekRange(date) {
  const d = new Date(date);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  const start = new Date(d);
  d.setDate(d.getDate() + 4);
  return `${shortDateFormatter.format(start)} – ${shortDateFormatter.format(d)}`;
}

const TYPES = [
  { key: "yapilanlar",   label: "Yapılanlar",   icon: "✓", bg: "bg-emerald-50",  text: "text-[#1F4D2C]", border: "border-emerald-200" },
  { key: "yapilacaklar", label: "Yapılacaklar",  icon: "→", bg: "bg-blue-50",     text: "text-[#00377B]", border: "border-blue-200"    },
  { key: "bekleyenler",  label: "Bekleyenler",   icon: "⏳", bg: "bg-amber-50",   text: "text-[#A34D00]", border: "border-amber-200"   },
  { key: "sorunlar",     label: "Riskli Konular", icon: "!", bg: "bg-red-50",     text: "text-red-700",   border: "border-red-200"     },
];

function Dashboard() {
  const editable = canEditData();
  const { records: takvimRecords, syncStatus: takvimSyncStatus } = useStoredCollection("akademikTakvimRecords", takvimData);
  const { records: operasyonRecords, syncStatus: operasyonSyncStatus } = useStoredCollection("operasyonRecords", operasyonData);
  const { records: logs, syncStatus: logsSyncStatus } = useStoredCollection("haftalikLogRecords", haftalikLogData, {
    sortByDateField: "haftaBaslangic",
  });
  const dashboardSyncStatus = [takvimSyncStatus, operasyonSyncStatus, logsSyncStatus].includes("ortak-veri-hatasi")
    ? "ortak-veri-hatasi"
    : [takvimSyncStatus, operasyonSyncStatus, logsSyncStatus].includes("ortak-veri-baglaniyor")
    ? "ortak-veri-baglaniyor"
    : [takvimSyncStatus, operasyonSyncStatus, logsSyncStatus].every((status) => status === "ortak-veri-aktif")
    ? "ortak-veri-aktif"
    : "yerel";

  const today = new Date();

  const monthKeys = useMemo(() => {
    return buildVisibleMonthKeys(logs, today);
  }, [logs]);

  const [selectedMonth, setSelectedMonth] = useState(() => getMonthKey(today));

  // Seçili aya ait loglar
  const monthLogs = useMemo(
    () => logs.filter((l) => getMonthKey(l.haftaBaslangic) === selectedMonth),
    [logs, selectedMonth],
  );

  // Seçili ayın birleşik maddeleri
  const combined = useMemo(
    () =>
      TYPES.reduce((acc, t) => {
        acc[t.key] = monthLogs.flatMap((l) => (l[t.key] || []).map((item) => ({ text: item, hafta: l.haftaLabel })));
        return acc;
      }, {}),
    [monthLogs],
  );

  const calendarAlerts = useMemo(
    () =>
      takvimRecords
        .map((item) => ({ ...item, alert: getCalendarAlert(item, today) }))
        .filter((item) => ["bilgi", "dikkat", "kritik", "devam"].includes(item.alert.level))
        .sort((a, b) => {
          const order = { kritik: 0, dikkat: 1, devam: 2, bilgi: 3 };
          return (order[a.alert.level] ?? 9) - (order[b.alert.level] ?? 9);
        }),
    [takvimRecords],
  );

  const urgentCount = calendarAlerts.filter((e) => ["kritik", "dikkat"].includes(e.alert.level)).length;

  // Bu haftanın kaydı
  const thisWeekLog = useMemo(() => {
    const ws = weekStart(today);
    return logs.find((l) => weekStart(new Date(l.haftaBaslangic)).getTime() === ws.getTime()) || null;
  }, [logs]);

  const groupedMonthKeys = useMemo(
    () =>
      monthKeys.reduce((groups, key) => {
        const year = key.slice(0, 4);
        groups[year] = groups[year] || [];
        groups[year].push(key);
        return groups;
      }, {}),
    [monthKeys],
  );

  return (
    <div className="space-y-5">
      <SharedStatus
        syncStatus={dashboardSyncStatus}
        count={takvimRecords.length + operasyonRecords.length + logs.length}
        label="Yönetim paneli ortak veri durumu"
      />

      {/* Üst bilgi bandı */}
      <section className="rounded-2xl border border-[#D6DEEA] bg-gradient-to-r from-[#0E2650] to-[#1F2D5C] px-6 py-5 text-white shadow-md">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">
              Sakarya Üniversitesi · Öğrenci Destek Koordinatörlüğü
            </p>
            <h1 className="mt-1 text-xl font-bold">
              {weekdayFormatter.format(today)}, {dateFormatter.format(today)}
            </h1>
            <p className="mt-0.5 text-sm text-white/60">2026-2027 Akademik Yılı</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-center">
              <p className="text-[10px] text-white/50">Bu Hafta</p>
              <p className="text-sm font-semibold text-white">{getWeekRange(today)}</p>
            </div>
            {urgentCount > 0 && (
              <div className="flex items-center gap-2 rounded-xl border border-red-400/40 bg-red-500/20 px-3 py-2">
                <span className="h-2 w-2 rounded-full bg-red-400" />
                <p className="text-sm font-semibold text-red-200">{urgentCount} acil takvim uyarısı</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Bu haftanın özet kartı */}
      <section className={`rounded-2xl border p-4 ${thisWeekLog ? "border-emerald-200 bg-[#EEF7F0]" : "border-dashed border-[#D6DEEA] bg-white"}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Bu Hafta</p>
            <p className="mt-0.5 text-sm font-semibold text-[#1F2D5C]">{getWeekRange(today)}</p>
          </div>
          {thisWeekLog ? (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex gap-4 text-sm">
                <span className="flex items-center gap-1.5 font-semibold text-[#1F4D2C]">
                  <span className="h-2 w-2 rounded-full bg-[#1F4D2C]" />
                  {thisWeekLog.yapilanlar?.length || 0} yapıldı
                </span>
                <span className="flex items-center gap-1.5 font-semibold text-[#00377B]">
                  <span className="h-2 w-2 rounded-full bg-[#00377B]" />
                  {thisWeekLog.yapilacaklar?.length || 0} planlı
                </span>
                <span className="flex items-center gap-1.5 font-semibold text-[#A34D00]">
                  <span className="h-2 w-2 rounded-full bg-[#F58220]" />
                  {thisWeekLog.bekleyenler?.length || 0} bekliyor
                </span>
                <span className="flex items-center gap-1.5 font-semibold text-red-700">
                  <span className="h-2 w-2 rounded-full bg-red-500" />
                  {thisWeekLog.sorunlar?.length || 0} risk
                </span>
              </div>
              <Link to="/haftalik-faaliyetler"
                className="rounded-xl border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-[#1F4D2C] hover:bg-emerald-50">
                Haftayı Görüntüle →
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <p className="text-sm text-slate-400">Bu hafta için henüz kayıt girilmemiş.</p>
              <Link to="/haftalik-faaliyetler"
                className="rounded-xl bg-[#00377B] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1F2D5C]">
                {editable ? "+ Haftalık Kayıt Ekle" : "Haftalıkları Görüntüle"}
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Ay seçici */}
      <div className="space-y-2">
        <div className="flex flex-col gap-2 rounded-2xl border border-[#D6DEEA] bg-white p-3 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Ay seçimi</p>
              <p className="text-xs text-slate-500">Sayfa otomatik olarak içinde olduğumuz ayı açar; istediğiniz aya geçebilirsiniz.</p>
            </div>
            <select
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
              className="rounded-xl border border-[#D6DEEA] bg-[#F8FAFD] px-3 py-2 text-sm font-semibold text-[#1F2D5C] outline-none focus:border-[#00377B]"
            >
              {monthKeys.map((key) => (
                <option key={key} value={key}>{getMonthLabel(key)}</option>
              ))}
            </select>
          </div>
          {Object.entries(groupedMonthKeys).map(([year, keys]) => (
            <MonthGroup
              key={year}
              label={year}
              keys={keys}
              selected={selectedMonth}
              logs={logs}
              onSelect={setSelectedMonth}
              getLabel={getMonthLabel}
            />
          ))}
        </div>
      </div>

      {/* Stat kartları */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Yapılanlar" value={combined.yapilanlar?.length || 0} detail={`${getMonthLabel(selectedMonth)} · ${monthLogs.length} hafta`} accent="green" />
        <StatCard title="Yapılacaklar" value={combined.yapilacaklar?.length || 0} detail="Planlanan maddeler" accent="navy" />
        <StatCard title="Bekleyenler" value={combined.bekleyenler?.length || 0} detail="Geri dönüş bekleniyor" accent="orange" />
        <StatCard title="Riskli Konular" value={combined.sorunlar?.length || 0} detail="Takip gerektiren konular" accent="red" />
      </section>

      {/* Madde listesi */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {TYPES.map((t) => {
          const items = combined[t.key] || [];
          return (
            <div key={t.key} className={`rounded-2xl border ${t.border} ${t.bg} p-4`}>
              <div className="mb-3 flex items-center justify-between">
                <h3 className={`text-sm font-bold ${t.text}`}>{t.label}</h3>
                <span className={`rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-semibold ${t.text}`}>{items.length}</span>
              </div>
              {items.length > 0 ? (
                <ul className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                  {items.map((item, i) => (
                    <li key={i} className="rounded-lg bg-white/80 px-3 py-2 text-xs text-slate-700 leading-relaxed shadow-sm">
                      <span className={`font-bold ${t.text} mr-1`}>{t.icon}</span>
                      {item.text}
                      <p className="mt-0.5 text-[10px] text-slate-400">{item.hafta}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-400 italic">
                  {getMonthLabel(selectedMonth)} ayı için kayıt girilmemiş.
                </p>
              )}
            </div>
          );
        })}
      </section>

      {/* Takvim uyarıları + Hızlı erişim */}
      <section className="grid gap-4 xl:grid-cols-[1.5fr_0.5fr]">
        <SectionCard title="Yaklaşan Takvim Uyarıları">
          <div className="space-y-2">
            {calendarAlerts.length > 0 ? (
              calendarAlerts.slice(0, 6).map((event) => (
                <div key={event.id} className="flex items-center gap-3 rounded-xl border border-[#E5E7EB] bg-slate-50 px-4 py-3">
                  <AlertDot level={event.alert.level} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#1F2D5C] truncate">{event.ad}</p>
                    <p className="text-xs text-slate-500">{dateFormatter.format(new Date(event.baslangic))}</p>
                  </div>
                  <div className="shrink-0">
                    <Badge tone={event.alert.tone}>{event.alert.label}</Badge>
                    {event.alert.daysLeft > 0 && (
                      <p className="mt-0.5 text-center text-[10px] text-slate-400">{event.alert.daysLeft} gün</p>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="rounded-xl border border-dashed border-[#D6DEEA] bg-slate-50 px-4 py-5 text-sm text-slate-500">
                Önümüzdeki 30 gün içinde takvim uyarısı yok.
              </p>
            )}
            {calendarAlerts.length > 6 && (
              <Link to="/akademik-takvim" className="block rounded-xl border border-dashed border-[#D6DEEA] py-2 text-center text-xs text-[#00377B] hover:bg-[#EEF3FA]">
                +{calendarAlerts.length - 6} uyarı daha →
              </Link>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Hızlı Erişim">
          <div className="grid gap-2">
            {[
              { to: "/haftalik-faaliyetler", label: editable ? "Haftalık Kayıt Ekle" : "Haftalıkları Görüntüle" },
              { to: "/akademik-takvim", label: "Akademik Takvim" },
              { to: "/operasyon-takip", label: "Yapılan İşler Takibi" },
              { to: "/sunum-hazirla", label: "Sunum Hazırla" },
            ].map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="flex items-center justify-between rounded-xl border border-[#D6DEEA] bg-[#F8FAFD] px-4 py-3 text-sm font-medium text-[#1F2D5C] transition hover:border-[#00377B] hover:bg-white"
              >
                {link.label}
                <span className="text-slate-400">›</span>
              </Link>
            ))}
          </div>
        </SectionCard>
      </section>
    </div>
  );
}

function AlertDot({ level }) {
  const colors = { kritik: "bg-red-500", dikkat: "bg-amber-500", bilgi: "bg-blue-400", devam: "bg-emerald-500" };
  return <span className={`h-2 w-2 shrink-0 rounded-full ${colors[level] || "bg-slate-300"}`} />;
}

function MonthGroup({ label, keys, selected, logs, onSelect, getLabel }) {
  return (
    <div className="flex items-center gap-2">
      <span className="shrink-0 rounded-lg bg-[#1F2D5C] px-2.5 py-1.5 text-[11px] font-bold text-white tracking-wider">
        {label}
      </span>
      <div className="overflow-x-auto pb-0.5">
        <div className="flex gap-1.5 min-w-max">
          {keys.map((key) => {
            const hasData = logs.some((l) => getMonthKey(l.haftaBaslangic) === key);
            const isSelected = selected === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onSelect(key)}
                className={`relative rounded-xl px-3 py-2 text-xs font-semibold transition whitespace-nowrap ${
                  isSelected
                    ? "bg-[#00377B] text-white shadow-sm"
                    : hasData
                    ? "border border-[#F58220] bg-[#FFF7F1] text-[#A34D00] hover:border-[#00377B] hover:bg-white hover:text-[#1F2D5C]"
                    : "border border-[#D6DEEA] bg-white text-slate-400 hover:border-[#00377B] hover:text-[#1F2D5C]"
                }`}
              >
                {getLabel(key)}
                {hasData && !isSelected && (
                  <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-[#F58220] border border-white" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;

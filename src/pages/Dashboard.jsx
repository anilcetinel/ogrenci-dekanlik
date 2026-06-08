import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Badge from "../components/Badge";
import SectionCard from "../components/SectionCard";
import StatCard from "../components/StatCard";
import useStoredCollection from "../hooks/useStoredCollection";
import takvimData from "../data/akademik-takvim.json";
import haftalikLogData from "../data/haftalik-log.json";
import operasyonData from "../data/operasyon-kutuphanesi.json";
import { canEditData } from "../utils/auth";
import { getCalendarAlert } from "../utils/calendar";
import { getWeeklyLogStart, getWeekKey } from "../utils/dateKeys";
import { buildVisibleMonthKeys, getLogMonthKey, getMonthKey, getMonthLabel } from "../utils/months";

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
  { key: "yapilanlar",   label: "Yapılanlar",   icon: "✓", bg: "bg-[#EEF3FA]", text: "text-[#00377B]", border: "border-[#BFD0E6]" },
  { key: "yapilacaklar", label: "Yapılacaklar", icon: "→", bg: "bg-[#EEF3FA]", text: "text-[#00377B]", border: "border-[#BFD0E6]" },
  { key: "bekleyenler",  label: "Bekleyenler",  icon: "•", bg: "bg-[#F8FAFD]", text: "text-[#1F2D5C]", border: "border-[#D6DEEA]" },
];

function Dashboard() {
  const editable = canEditData();
  const { records: takvimRecords, syncStatus: takvimSyncStatus } = useStoredCollection("akademikTakvimRecords", takvimData);
  const { records: operasyonRecords, syncStatus: operasyonSyncStatus } = useStoredCollection("operasyonRecords", operasyonData);
  const { records: logs, mergeRecord, syncStatus: logsSyncStatus } = useStoredCollection("haftalikLogRecords", haftalikLogData, {
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
    () => logs.filter((l) => getLogMonthKey(l) === selectedMonth),
    [logs, selectedMonth],
  );

  // Seçili ayın birleşik maddeleri
  const combined = useMemo(
    () =>
      TYPES.reduce((acc, t) => {
        acc[t.key] = monthLogs
          .slice()
          .sort((a, b) => new Date(a.haftaBaslangic) - new Date(b.haftaBaslangic))
          .flatMap((l) =>
            (l[t.key] || []).map((item, itemIndex) => ({
              text: item,
              hafta: l.haftaLabel,
              tarih: l.haftaBaslangic,
              itemIndex,
              logId: l.id,
            })),
          );
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
    return logs.find((l) => weekStart(getWeeklyLogStart(l)).getTime() === ws.getTime()) || null;
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

  const visibleYears = useMemo(() => Object.keys(groupedMonthKeys).sort(), [groupedMonthKeys]);
  const selectedYear = selectedMonth.slice(0, 4);
  const visibleMonthKeys = groupedMonthKeys[selectedYear] || monthKeys;

  const thisWeekCounts = {
    yapilanlar: thisWeekLog?.yapilanlar?.length || 0,
    yapilacaklar: thisWeekLog?.yapilacaklar?.length || 0,
    bekleyenler: thisWeekLog?.bekleyenler?.length || 0,
  };

  const handleDeleteDashboardItem = (item, colKey) => {
    const log = logs.find((record) => String(record.id) === String(item.logId));
    if (!log) return;

    if (!window.confirm("Bu madde yönetim panelinden ve haftalık faaliyet kaydından silinsin mi?")) {
      return;
    }

    const nextItems = (log[colKey] || []).filter((_, index) => index !== item.itemIndex);
    mergeRecord(
      { ...log, [colKey]: nextItems },
      (record) => getWeekKey(getWeeklyLogStart(record)),
      (_, incomingRecord) => incomingRecord,
    );
  };

  const handleMoveDashboardItemToDone = (item, colKey) => {
    const log = logs.find((record) => String(record.id) === String(item.logId));
    if (!log || colKey === "yapilanlar") return;

    const nextSourceItems = (log[colKey] || []).filter((_, index) => index !== item.itemIndex);
    const nextDoneItems = [...new Set([...(log.yapilanlar || []), item.text].filter(Boolean))];

    mergeRecord(
      { ...log, [colKey]: nextSourceItems, yapilanlar: nextDoneItems },
      (record) => getWeekKey(getWeeklyLogStart(record)),
      (_, incomingRecord) => incomingRecord,
    );
  };

  return (
    <div className="space-y-5">
      {/* Üst bilgi bandı */}
      <section className="overflow-hidden rounded-3xl border border-[#D6DEEA] bg-white shadow-sm">
        <div className="h-2 bg-gradient-to-r from-[#00377B] via-[#1F2D5C] to-[#1F4D2C]" />
        <div className="grid gap-5 p-5 lg:grid-cols-[1fr_auto] lg:items-start lg:p-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400">
              Öğrenci Destek Koordinatörlüğü
            </p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-[#1F2D5C]">
              {weekdayFormatter.format(today)}, {dateFormatter.format(today)}
            </h1>
            <p className="mt-1 text-sm font-medium text-slate-500">2026-2027 Akademik Yılı · Yönetim özeti</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <MiniMetric label="Yapıldı" value={thisWeekCounts.yapilanlar} color="blue" />
              <MiniMetric label="Planlı" value={thisWeekCounts.yapilacaklar} color="blue" />
              <MiniMetric label="Bekliyor" value={thisWeekCounts.bekleyenler} color="slate" />
            </div>
          </div>

          <div className="space-y-2 lg:min-w-[330px]">
            <div className="flex items-center justify-between rounded-2xl border border-[#D6DEEA] bg-[#F8FAFD] px-4 py-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Bu Hafta</p>
                <p className="mt-1 text-base font-black text-[#00377B]">{getWeekRange(today)}</p>
              </div>
              <Link
                to="/haftalik-faaliyetler"
                className="rounded-xl bg-[#00377B] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#1F2D5C]"
              >
                {thisWeekLog ? "Haftayı Aç" : editable ? "+ Kayıt" : "Görüntüle"}
              </Link>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              <StatusPill syncStatus={dashboardSyncStatus} count={takvimRecords.length + operasyonRecords.length + logs.length} />
              <div className={`rounded-2xl border px-4 py-3 ${urgentCount > 0 ? "border-red-200 bg-red-50" : "border-[#BFD0E6] bg-[#EEF3FA]"}`}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Takvim Uyarısı</p>
                <p className={`mt-1 text-sm font-black ${urgentCount > 0 ? "text-red-700" : "text-[#00377B]"}`}>
                  {urgentCount > 0 ? `${urgentCount} kritik konu` : "Kritik uyarı yok"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Ay seçici */}
      <div className="space-y-2">
        <div className="rounded-3xl border border-[#D6DEEA] bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Ay seçimi</p>
              <p className="text-xs text-slate-500">İçinde olduğumuz ay otomatik seçilir; yıl ve ayı buradan değiştirin.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {visibleYears.map((year) => (
                <button
                  key={year}
                  type="button"
                  onClick={() => setSelectedMonth(`${year}-${selectedMonth.slice(5, 7)}`)}
                  className={`rounded-xl px-3 py-2 text-xs font-bold transition ${
                    selectedYear === year
                      ? "bg-[#1F2D5C] text-white"
                      : "border border-[#D6DEEA] bg-white text-slate-500 hover:border-[#00377B] hover:text-[#00377B]"
                  }`}
                >
                  {year}
                </button>
              ))}
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
          </div>
          <div className="mt-3 overflow-x-auto pb-1">
            <div className="flex min-w-max gap-1.5">
              {visibleMonthKeys.map((key) => {
                const hasData = logs.some((l) => getLogMonthKey(l) === key);
                const isSelected = selectedMonth === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedMonth(key)}
                    className={`relative rounded-xl px-3 py-2 text-xs font-semibold transition whitespace-nowrap ${
                      isSelected
                        ? "bg-[#00377B] text-white shadow-sm"
                        : hasData
                        ? "border border-[#F58220] bg-[#FFF7F1] text-[#A34D00] hover:border-[#00377B] hover:bg-white hover:text-[#1F2D5C]"
                        : "border border-[#D6DEEA] bg-white text-slate-400 hover:border-[#00377B] hover:text-[#1F2D5C]"
                    }`}
                  >
                    {getMonthLabel(key).replace(` ${selectedYear}`, "")}
                    {hasData && !isSelected && (
                      <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-[#F58220] border border-white" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Bu haftanın kayıt uyarısı */}
      {!thisWeekLog && (
        <section className="rounded-2xl border border-dashed border-[#D6DEEA] bg-white px-4 py-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">Bu hafta için henüz faaliyet kaydı girilmemiş.</p>
            <Link
              to="/haftalik-faaliyetler"
              className="rounded-xl bg-[#00377B] px-3 py-2 text-center text-xs font-semibold text-white hover:bg-[#1F2D5C]"
            >
              {editable ? "+ Haftalık Kayıt Ekle" : "Haftalıkları Görüntüle"}
            </Link>
          </div>
        </section>
      )}

      {/* Stat kartları */}
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard title="Yapılanlar" value={combined.yapilanlar?.length || 0} detail={`${getMonthLabel(selectedMonth)} · ${monthLogs.length} hafta`} accent="navy" />
        <StatCard title="Yapılacaklar" value={combined.yapilacaklar?.length || 0} detail="Planlanan maddeler" accent="navy" />
        <StatCard title="Bekleyenler" value={combined.bekleyenler?.length || 0} detail="Geri dönüş bekleniyor" accent="navy" />
      </section>

      {/* Madde listesi */}
      <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1.25fr)_minmax(0,0.8fr)]">
        {TYPES.map((t) => {
          const items = combined[t.key] || [];
          return (
            <div key={t.key} className={`rounded-2xl border ${t.border} ${t.bg} p-4`}>
              <div className="mb-3 flex items-center justify-between">
                <h3 className={`text-sm font-bold ${t.text}`}>{t.label}</h3>
                <span className={`rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-semibold ${t.text}`}>{items.length}</span>
              </div>
              {items.length > 0 ? (
                <ul className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {items.map((item, i) => (
                    <li key={`${item.logId}-${t.key}-${item.itemIndex}-${i}`} className="group rounded-xl bg-white/90 px-3 py-2.5 text-sm text-slate-700 leading-relaxed shadow-sm">
                      <div className="flex items-start gap-2">
                        <span className={`font-bold ${t.text}`}>{t.icon}</span>
                        <span className="flex-1">{item.text}</span>
                        {editable && (
                          <div className="flex shrink-0 gap-1">
                            {t.key !== "yapilanlar" && (
                              <button
                                type="button"
                                onClick={() => handleMoveDashboardItemToDone(item, t.key)}
                                className="rounded-md border border-[#BFD0E6] bg-[#EEF3FA] px-2 py-0.5 text-[10px] font-semibold text-[#00377B] transition hover:border-[#00377B] hover:bg-white"
                              >
                                Yapıldı
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteDashboardItem(item, t.key)}
                              className="rounded-md border border-red-100 bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600 transition hover:border-red-200 hover:bg-red-100"
                            >
                              Sil
                            </button>
                          </div>
                        )}
                      </div>
                      <p className="mt-0.5 text-[10px] text-slate-400">
                        {item.tarih ? dateFormatter.format(new Date(item.tarih)) : item.hafta} · {item.hafta}
                      </p>
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

function MiniMetric({ label, value, color }) {
  const styles = {
    blue: "border-[#BFD0E6] bg-[#EEF3FA] text-[#00377B]",
    slate: "border-[#D6DEEA] bg-[#F8FAFD] text-[#1F2D5C]",
  };

  return (
    <div className={`rounded-2xl border px-3 py-2 ${styles[color] || styles.blue}`}>
      <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">{label}</p>
      <p className="mt-0.5 text-xl font-black leading-none">{value}</p>
    </div>
  );
}

function StatusPill({ syncStatus, count }) {
  const meta = {
    "ortak-veri-aktif": {
      label: "Ortak veri aktif",
      detail: typeof count === "number" ? `${count} kayıt izleniyor` : "Kayıtlar ortak alanda",
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
      className: "border-[#D6DEEA] bg-[#F8FAFD] text-[#1F2D5C]",
    },
  };
  const current = meta[syncStatus] || meta.yerel;

  return (
    <div className={`rounded-2xl border px-4 py-3 ${current.className}`}>
      <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">Veri Durumu</p>
      <p className="mt-1 text-sm font-black">{current.label}</p>
      <p className="mt-0.5 text-[11px] opacity-75">{current.detail}</p>
    </div>
  );
}

export default Dashboard;

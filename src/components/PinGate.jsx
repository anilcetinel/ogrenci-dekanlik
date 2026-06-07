import { useState } from "react";
import {
  AUTH_ROLES,
  AUTH_SESSION_KEY,
  getAccessPins,
  setAuthenticatedRole,
} from "../utils/auth";

const quickLinks = [
  "Akademik Takvim",
  "Haftalık Faaliyetler",
  "Yapılan İşler Takibi",
  "Sunum Hazırlama",
];

const announcements = [
  {
    title: "Haftalık faaliyet verileri tek ekranda izlenir",
    text: "Yapılan, yapılacak, bekleyen ve riskli işler yönetim panelinde özetlenir.",
  },
  {
    title: "Akademik takvim ve operasyon kayıtları birlikte çalışır",
    text: "Excel’den alınan takvim olayları ilgili süreçlerle ilişkilendirilebilir.",
  },
  {
    title: "Kurumsal hafıza dosya ve notlarla güçlenir",
    text: "PDF, Word ve Excel kaynaklarından çıkarılan notlar haftalık kayıtlara bağlanır.",
  },
];

function PinGate({ children }) {
  const [authenticated, setAuthenticated] = useState(
    () => sessionStorage.getItem(AUTH_SESSION_KEY) === "ok",
  );
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);
  const { adminPin, viewerPin } = getAccessPins();
  const accessConfigured = Boolean(adminPin || viewerPin);

  if (authenticated) return children;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!accessConfigured) {
      setError(true);
      return;
    }

    if (adminPin && pin === adminPin) {
      setAuthenticatedRole(AUTH_ROLES.ADMIN);
      setAuthenticated(true);
    } else if (viewerPin && pin === viewerPin) {
      setAuthenticatedRole(AUTH_ROLES.VIEWER);
      setAuthenticated(true);
    } else {
      setError(true);
      setShake(true);
      setPin("");
      setTimeout(() => setShake(false), 500);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA] text-[#1F2D5C]">
      <header className="border-b border-[#E5E7EB] bg-white">
        <div className="bg-[#00377B] text-white">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-2 text-xs sm:flex-row sm:items-center sm:justify-between">
            <p className="font-semibold tracking-wide">Sakarya Üniversitesi</p>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-white/75">
              <span>sakarya.edu.tr</span>
              <span>Öğrenci İşleri</span>
              <span>İletişim</span>
            </div>
          </div>
        </div>
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-[#F58220]/45 bg-[#FFF3E8] text-xl font-black text-[#F58220] shadow-sm">
              SAÜ
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.26em] text-[#F58220]">Sakarya Üniversitesi</p>
              <h1 className="mt-1 text-xl font-black tracking-tight text-[#00377B] sm:text-2xl">
                Öğrenci Destek Koordinatörlüğü
              </h1>
              <p className="mt-1 text-sm font-medium text-slate-500">Faaliyet ve Takip Sistemi</p>
            </div>
          </div>
          <nav className="flex flex-wrap gap-2">
            {quickLinks.map((link) => (
              <span
                key={link}
                className="rounded-full border border-[#D6DEEA] bg-[#F8FAFD] px-4 py-2 text-xs font-bold text-[#1F2D5C]"
              >
                {link}
              </span>
            ))}
          </nav>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden bg-[#0E2650]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_22%,rgba(245,130,32,0.28),transparent_30%),radial-gradient(circle_at_82%_15%,rgba(255,255,255,0.16),transparent_24%)]" />
          <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#F5F7FA] to-transparent" />

          <div className="relative mx-auto grid max-w-7xl gap-8 px-5 py-12 lg:grid-cols-[1.2fr_420px] lg:items-center lg:py-16">
            <div className="text-white">
              <p className="inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-white/75">
                Kurumsal faaliyet izleme portalı
              </p>
              <h2 className="mt-6 max-w-3xl text-4xl font-black leading-tight tracking-tight sm:text-5xl">
                Öğrenci destek süreçleri için tek merkezli takip ekranı
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-7 text-white/72">
                Akademik takvim, haftalık faaliyetler, hızlı notlar, dosya kaynakları ve yönetim sunumları
                SAÜ kurumsal renkleriyle tek bir güvenli alanda izlenir.
              </p>
              <div className="mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">
                {[
                  ["Ortak Veri", "Supabase ile eş zamanlı kayıt"],
                  ["Akademik Takvim", "Excel aktarımı ve uyarılar"],
                  ["Yönetim Paneli", "Anlık faaliyet özeti"],
                ].map(([title, text]) => (
                  <div key={title} className="rounded-2xl border border-white/12 bg-white/10 p-4 backdrop-blur-sm">
                    <p className="text-sm font-black text-white">{title}</p>
                    <p className="mt-1 text-xs leading-5 text-white/58">{text}</p>
                  </div>
                ))}
              </div>
            </div>

            <form
              onSubmit={handleSubmit}
              className={`rounded-[1.75rem] border border-white/15 bg-white p-7 shadow-2xl transition-transform ${shake ? "animate-bounce" : ""}`}
            >
              <div className="mb-6 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#00377B] text-sm font-black text-white">
                  SAÜ
                </div>
                <h3 className="mt-4 text-xl font-black text-[#00377B]">Sisteme Giriş</h3>
                <p className="mt-1 text-sm text-slate-500">Yetkili erişim kodunuzu giriniz.</p>
              </div>

              <label className="block text-sm font-bold text-[#1F2D5C]">
                Erişim Kodu
                <input
                  type="password"
                  value={pin}
                  onChange={(e) => { setPin(e.target.value); setError(false); }}
                  placeholder="••••••••"
                  autoFocus
                  autoComplete="off"
                  className={`mt-2 w-full rounded-2xl border px-4 py-4 text-center text-lg font-black tracking-[0.42em] text-[#1F2D5C] outline-none transition ${
                    error
                      ? "border-red-400 bg-red-50 placeholder-red-300"
                      : "border-[#D6DEEA] bg-[#F8FAFD] placeholder-slate-400 focus:border-[#F58220] focus:bg-white"
                  }`}
                />
              </label>

              {error && (
                <p className="mt-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-center text-xs font-bold text-red-600">
                  {accessConfigured ? "Yanlış kod. Tekrar deneyin." : "Canlı yayın için erişim kodu tanımlı değil."}
                </p>
              )}

              <p className="mt-4 rounded-2xl border border-[#E5E7EB] bg-[#F8FAFD] px-4 py-3 text-xs leading-5 text-slate-500">
                Yönetici kodu veri girişi sağlar. İzleyici kodu yalnızca görüntüleme içindir.
              </p>

              <button
                type="submit"
                className="mt-5 w-full rounded-2xl bg-[#F58220] py-4 text-sm font-black text-white shadow-lg shadow-[#F58220]/25 transition hover:bg-[#d96e10] active:scale-[0.99]"
              >
                Giriş Yap
              </button>
            </form>
          </div>
        </section>

        <section className="mx-auto -mt-4 grid max-w-7xl gap-4 px-5 pb-10 md:grid-cols-3">
          {announcements.map((item) => (
            <article key={item.title} className="rounded-3xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
              <span className="mb-4 block h-1.5 w-12 rounded-full bg-[#F58220]" />
              <h3 className="text-base font-black text-[#00377B]">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">{item.text}</p>
            </article>
          ))}
        </section>
      </main>

      <footer className="border-t border-[#E5E7EB] bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-semibold">Sakarya Üniversitesi · Öğrenci Destek Koordinatörlüğü · 2026-2027</p>
          <p>Prototip sürüm - gerçek kişisel veri içermez.</p>
        </div>
      </footer>
    </div>
  );
}

export default PinGate;

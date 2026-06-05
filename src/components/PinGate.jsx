import { useState } from "react";

const SESSION_KEY = "sau_dekanlik_auth";
const CORRECT_PIN = import.meta.env.VITE_APP_PIN || "sau2026";

function PinGate({ children }) {
  const [authenticated, setAuthenticated] = useState(
    () => sessionStorage.getItem(SESSION_KEY) === "ok",
  );
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  if (authenticated) return children;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (pin === CORRECT_PIN) {
      sessionStorage.setItem(SESSION_KEY, "ok");
      setAuthenticated(true);
    } else {
      setError(true);
      setShake(true);
      setPin("");
      setTimeout(() => setShake(false), 500);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0E2650]">
      {/* Arka plan deseni */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-[#00377B]/40 blur-3xl" />
        <div className="absolute -bottom-32 -right-16 h-80 w-80 rounded-full bg-[#F58220]/20 blur-3xl" />
      </div>

      <div className={`relative w-full max-w-sm px-4 transition-transform ${shake ? "animate-bounce" : ""}`}>
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#F58220]/40 bg-[#F58220]/15 text-xl font-bold text-[#F58220]">
            SAÜ
          </div>
          <h1 className="text-xl font-bold text-white">Öğrenci Dekanlığı</h1>
          <p className="mt-1 text-sm text-white/50">Faaliyet ve Operasyon Takip Sistemi</p>
        </div>

        {/* PIN formu */}
        <form onSubmit={handleSubmit} className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
          <p className="mb-4 text-center text-sm font-semibold text-white/70">Erişim Kodu</p>
          <input
            type="password"
            value={pin}
            onChange={(e) => { setPin(e.target.value); setError(false); }}
            placeholder="••••••••"
            autoFocus
            autoComplete="off"
            className={`w-full rounded-xl border px-4 py-3 text-center text-lg font-bold tracking-[0.4em] text-[#1F2D5C] outline-none transition ${
              error
                ? "border-red-400 bg-red-50 placeholder-red-300"
                : "border-white/20 bg-white placeholder-slate-400 focus:border-[#F58220]"
            }`}
          />
          {error && (
            <p className="mt-2 text-center text-xs font-semibold text-red-400">
              Yanlış kod. Tekrar deneyin.
            </p>
          )}
          <button
            type="submit"
            className="mt-4 w-full rounded-xl bg-[#F58220] py-3 text-sm font-bold text-white transition hover:bg-[#d96e10] active:scale-95"
          >
            Giriş
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-white/25">
          Sakarya Üniversitesi · Öğrenci Dekanlığı · 2026-2027
        </p>
      </div>
    </div>
  );
}

export default PinGate;

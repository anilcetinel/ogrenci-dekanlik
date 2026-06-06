import { useMemo, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

const titles = {
  "/": "Yönetim Paneli",
  "/akademik-takvim": "Akademik Takvim",
  "/hizli-not": "Hızlı Not Girişi",
  "/operasyon-takip": "Yapılan İşler Takibi",
  "/haftalik-faaliyetler": "Haftalık Faaliyetler",
  "/is-nasil-yapilir": "İş Nasıl Yapılır",
  "/evraklar": "Evrak ve Şablonlar",
  "/sunum-hazirla": "Sunum Hazırla",
  "/ayarlar": "Ayarlar & Veri Yönetimi",
};

function Layout() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const title = useMemo(() => {
    if (location.pathname.startsWith("/operasyonlar/")) {
      return "Operasyon Detayı";
    }
    return titles[location.pathname] || "Öğrenci Destek Koordinatörlüğü";
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-transparent">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="md:pl-[240px]">
        <Topbar title={title} onMenuClick={() => setMobileOpen(true)} />
        <main className="px-4 py-6 md:px-8 md:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default Layout;

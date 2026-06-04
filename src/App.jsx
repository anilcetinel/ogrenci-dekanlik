import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import AkademikTakvim from "./pages/AkademikTakvim";
import OperasyonKutuphane from "./pages/OperasyonKutuphane";
import OperasyonTakip from "./pages/OperasyonTakip";
import OperasyonDetay from "./pages/OperasyonDetay";
import HaftalikFaaliyetler from "./pages/HaftalikFaaliyetler";
import SunumHazirla from "./pages/SunumHazirla";
import Evraklar from "./pages/Evraklar";

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="/akademik-takvim" element={<AkademikTakvim />} />
        <Route path="/operasyon-takip" element={<OperasyonTakip />} />
        <Route path="/operasyonlar/:id" element={<OperasyonDetay />} />
        <Route path="/haftalik-faaliyetler" element={<HaftalikFaaliyetler />} />
        <Route path="/is-nasil-yapilir" element={<OperasyonKutuphane />} />
        <Route path="/evraklar" element={<Evraklar />} />
        <Route path="/sunum-hazirla" element={<SunumHazirla />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default App;

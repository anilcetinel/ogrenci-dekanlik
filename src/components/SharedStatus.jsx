function SharedStatus({ syncStatus, count, label = "Ortak veri durumu" }) {
  const styles = {
    "ortak-veri-aktif": "border-emerald-200 bg-emerald-50 text-emerald-800",
    "ortak-veri-hatasi": "border-red-200 bg-red-50 text-red-700",
    "ortak-veri-baglaniyor": "border-blue-200 bg-blue-50 text-[#00377B]",
    yerel: "border-amber-200 bg-amber-50 text-amber-800",
  };

  const messages = {
    "ortak-veri-aktif": `Bağlantı aktif${typeof count === "number" ? ` · ${count} kayıt izleniyor` : ""}.`,
    "ortak-veri-hatasi": "Ortak veri bağlantısı kurulamadı. Bu ekrandaki kayıtlar yerel yedekten gelebilir.",
    "ortak-veri-baglaniyor": "Ortak veriler alınıyor...",
    yerel: "Yerel mod. Bu yayında Supabase ayarı görünmüyor.",
  };

  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${styles[syncStatus] || styles.yerel}`}>
      <span className="font-semibold">{label}:</span>{" "}
      {messages[syncStatus] || messages.yerel}
    </div>
  );
}

export default SharedStatus;

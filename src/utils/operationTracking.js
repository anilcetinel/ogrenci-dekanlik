const defaultTracking = {
  1: {
    durum: "Devam ediyor",
    sorumluKisi: "Operasyon Koordinasyon Birimi",
    sonTarih: "2026-06-20",
    riskSeviyesi: "yüksek",
  },
  2: {
    durum: "Planlandı",
    sorumluKisi: "Planlama Ekibi",
    sonTarih: "2026-10-12",
    riskSeviyesi: "orta",
  },
  3: {
    durum: "Devam ediyor",
    sorumluKisi: "Sınav Koordinasyon Masası",
    sonTarih: "2026-06-18",
    riskSeviyesi: "yüksek",
  },
  4: {
    durum: "Takipte",
    sorumluKisi: "Öğrenci Danışmanlık Birimi",
    sonTarih: "2026-09-18",
    riskSeviyesi: "orta",
  },
  5: {
    durum: "Planlandı",
    sorumluKisi: "Muafiyet Komisyonu Sekretaryası",
    sonTarih: "2026-09-05",
    riskSeviyesi: "orta",
  },
  6: {
    durum: "Planlandı",
    sorumluKisi: "Öğrenci İşleri Koordinasyon Ofisi",
    sonTarih: "2026-08-20",
    riskSeviyesi: "düşük",
  },
  7: {
    durum: "Devam ediyor",
    sorumluKisi: "Mezuniyet Takip Masası",
    sonTarih: "2026-06-24",
    riskSeviyesi: "yüksek",
  },
  8: {
    durum: "Takipte",
    sorumluKisi: "Bilgi İşlem Koordinasyonu",
    sonTarih: "2026-06-07",
    riskSeviyesi: "orta",
  },
};

export function getOperationTracking(operation) {
  const fallback = defaultTracking[operation.id] || {
    durum: "Planlandı",
    sorumluKisi: operation.sorumluBirim,
    sonTarih: operation.sonGuncelleme,
    riskSeviyesi: operation.sorunlar?.length > 2 ? "yüksek" : "orta",
  };

  return {
    ...fallback,
    ...(operation.takip || {}),
  };
}

export function getRiskTone(riskSeviyesi) {
  if (riskSeviyesi === "yüksek") {
    return "yuksek";
  }

  if (riskSeviyesi === "orta") {
    return "orta";
  }

  return "dusuk";
}

export function getStatusTone(durum) {
  if (durum === "Tamamlandı") {
    return "yapildi";
  }

  if (durum === "Devam ediyor" || durum === "Takipte") {
    return "devam";
  }

  return "bekliyor";
}

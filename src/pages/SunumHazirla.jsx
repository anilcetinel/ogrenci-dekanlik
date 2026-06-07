import { useEffect, useMemo, useState } from "react";
import useStoredCollection from "../hooks/useStoredCollection";
import haftalikLogData from "../data/haftalik-log.json";
import takvimData from "../data/akademik-takvim.json";
import { getCalendarAlert } from "../utils/calendar";

// SAÜ Kurumsal Renkler
const SAU_NAVY   = "00377B";
const SAU_DARK   = "1F2D5C";
const SAU_ORANGE = "F58220";
const SAU_LIGHT  = "EEF3FA";
const WHITE      = "FFFFFF";
const SLATE      = "64748B";
const GREEN      = "1F4D2C";
const RED        = "B91C1C";
const AMBER      = "A34D00";
const GOLD       = "D9BF73";
const SKY        = "A7C7E7";
const SLIDE_W    = 13.333;
const SLIDE_H    = 7.5;
const UNIT_NAME  = "Öğrenci Destek Koordinatörlüğü";

const dateFormatter = new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "long", year: "numeric" });
const shortFmt     = new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short" });

function fmt(d) { return dateFormatter.format(new Date(d)); }

function addSauBackdrop(pptx, slide, { accent = SAU_ORANGE, footer = true, photoBand = true } = {}) {
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: SLIDE_W, h: SLIDE_H,
    fill: { color: SAU_NAVY },
    line: { color: SAU_NAVY, transparency: 100 },
  });

  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: SLIDE_W, h: SLIDE_H,
    fill: { color: "082B67", transparency: 12 },
    line: { color: "082B67", transparency: 100 },
  });

  slide.addShape(pptx.ShapeType.parallelogram, {
    x: -1.1, y: 0.95, w: 3.5, h: 5.4,
    fill: { color: "0E4C9A", transparency: 62 },
    line: { color: "0E4C9A", transparency: 100 },
    rotate: 180,
  });
  slide.addShape(pptx.ShapeType.parallelogram, {
    x: 9.7, y: 0.6, w: 4.2, h: 6.2,
    fill: { color: "0B438B", transparency: 68 },
    line: { color: "0B438B", transparency: 100 },
  });
  slide.addShape(pptx.ShapeType.ellipse, {
    x: 8.7, y: -1.4, w: 5.2, h: 5.2,
    fill: { color: "0B4EA2", transparency: 78 },
    line: { color: "0B4EA2", transparency: 100 },
  });

  if (photoBand) {
    slide.addShape(pptx.ShapeType.rect, {
      x: 0, y: 4.45, w: SLIDE_W, h: 3.05,
      fill: { color: "08285D", transparency: 12 },
      line: { color: "08285D", transparency: 100 },
    });
    slide.addShape(pptx.ShapeType.rect, {
      x: 0, y: 4.45, w: SLIDE_W, h: 3.05,
      fill: { color: "113F86", transparency: 58 },
      line: { color: "113F86", transparency: 100 },
    });

    // Fotoğraf yerine soyut mezuniyet/kalabalık silüeti: gerçek görsel gerektirmez, kurumsal zemin hissi verir.
    for (let i = 0; i < 9; i += 1) {
      const x = 1.05 + i * 1.35;
      const h = 0.45 + (i % 3) * 0.12;
      slide.addShape(pptx.ShapeType.ellipse, {
        x, y: 5.72 - h * 0.18, w: 0.34, h: 0.34,
        fill: { color: SKY, transparency: 73 },
        line: { color: SKY, transparency: 100 },
      });
      slide.addShape(pptx.ShapeType.rect, {
        x: x - 0.18, y: 6.08, w: 0.7, h: h,
        fill: { color: SKY, transparency: 79 },
        line: { color: SKY, transparency: 100 },
      });
      if (i % 2 === 0) {
        slide.addShape(pptx.ShapeType.parallelogram, {
          x: x - 0.16, y: 5.52, w: 0.62, h: 0.18,
          fill: { color: WHITE, transparency: 76 },
          line: { color: WHITE, transparency: 100 },
        });
      }
    }
  }

  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: SLIDE_W, h: 0.13,
    fill: { color: accent },
    line: { color: accent, transparency: 100 },
  });

  if (footer) {
    slide.addText("SAKARYA\nÜNİVERSİTESİ", {
      x: 0.65, y: 6.72, w: 3.3, h: 0.62,
      fontSize: 18, bold: true, color: WHITE, fontFace: "Georgia",
      breakLine: false,
    });
    slide.addText("sakarya.edu.tr", {
      x: 10.3, y: 6.9, w: 2.25, h: 0.32,
      fontSize: 13, bold: true, color: WHITE, fontFace: "Arial",
      align: "right",
    });
  }
}

function addHeader(pptx, slide, title, eyebrow = "", color = WHITE) {
  if (eyebrow) {
    slide.addText(eyebrow.toUpperCase(), {
      x: 0.65, y: 0.45, w: 6.8, h: 0.25,
      fontSize: 8.5, bold: true, color: SKY, fontFace: "Arial", charSpacing: 2,
    });
  }
  slide.addText(title, {
    x: 0.65, y: 0.72, w: 9.7, h: 0.48,
    fontSize: 20, bold: true, color, fontFace: "Arial",
    margin: 0,
  });
  slide.addShape(pptx.ShapeType.line, {
    x: 0.65, y: 1.28, w: 11.95, h: 0,
    line: { color: SAU_ORANGE, width: 1.2, transparency: 8 },
  });
}

function addTitleSlide(pptx, title, subtitle) {
  const slide = pptx.addSlide();
  addSauBackdrop(pptx, slide);

  slide.addText("ÖĞRENCİ DESTEK KOORDİNATÖRLÜĞÜ", {
    x: 0.8, y: 0.72, w: 4.8, h: 0.28,
    fontSize: 10, bold: true, color: SKY, fontFace: "Arial", charSpacing: 3,
  });
  slide.addText("SAÜ", {
    x: 0.8, y: 1.17, w: 1.25, h: 0.55,
    fontSize: 28, bold: true, color: GOLD, fontFace: "Georgia",
  });
  slide.addText("Sakarya Üniversitesi\nİş Hafızası ve Faaliyet Takibi", {
    x: 2.02, y: 1.17, w: 4.2, h: 0.55,
    fontSize: 10.5, color: "C7D8EE", fontFace: "Arial",
  });
  slide.addShape(pptx.ShapeType.line, {
    x: 0.8, y: 2.23, w: 10.5, h: 0,
    line: { color: GOLD, width: 1.4, transparency: 2 },
  });
  slide.addText(title, {
    x: 0.8, y: 2.52, w: 10.9, h: 1.15,
    fontSize: 34, bold: true, color: WHITE, fontFace: "Georgia", wrap: true,
    margin: 0.02,
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.82, y: 3.82, w: 6.8, h: 0.38,
      fontSize: 13.5, color: "C7D8EE", fontFace: "Arial",
    });
  }
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 9.25, y: 3.75, w: 2.7, h: 0.68,
    fill: { color: WHITE, transparency: 87 },
    line: { color: WHITE, transparency: 100 },
    rectRadius: 0.08,
  });
  slide.addText(dateFormatter.format(new Date()), {
    x: 9.38, y: 3.95, w: 2.42, h: 0.24,
    fontSize: 10.5, bold: true, color: WHITE, fontFace: "Arial", align: "center",
  });
}

function addSectionSlide(pptx, sectionTitle) {
  const slide = pptx.addSlide();
  addSauBackdrop(pptx, slide, { accent: GOLD, photoBand: false });
  slide.addText("HAFTALIK FAALİYET ODAĞI", {
    x: 0.82, y: 2.05, w: 5.8, h: 0.3,
    fontSize: 9, color: SKY, bold: true, charSpacing: 2.5, fontFace: "Arial",
  });
  slide.addText(sectionTitle, {
    x: 0.82, y: 2.43, w: 9.8, h: 0.95,
    fontSize: 34, bold: true, color: WHITE, fontFace: "Georgia",
  });
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.82, y: 3.6, w: 5.45, h: 0.55,
    fill: { color: WHITE, transparency: 88 },
    line: { color: WHITE, transparency: 100 },
    rectRadius: 0.08,
  });
  slide.addText("Yapılanlar · Planlananlar · Bekleyenler · Riskler", {
    x: 1.0, y: 3.78, w: 5.1, h: 0.2,
    fontSize: 10, color: "D6E6F9", fontFace: "Arial",
  });
}

function addContentSlide(pptx, { title, items, color = SAU_NAVY, icon = "•", eyebrow = "" }) {
  const ITEMS_PER_SLIDE = 6;
  const chunks = [];
  for (let i = 0; i < items.length; i += ITEMS_PER_SLIDE) {
    chunks.push(items.slice(i, i + ITEMS_PER_SLIDE));
  }
  if (chunks.length === 0) chunks.push([]);

  chunks.forEach((chunk, ci) => {
    const slide = pptx.addSlide();
    addSauBackdrop(pptx, slide, { accent: color, photoBand: false });
    addHeader(pptx, slide, title + (chunks.length > 1 ? ` (${ci + 1}/${chunks.length})` : ""), eyebrow || "Faaliyet Detayı");

    slide.addShape(pptx.ShapeType.roundRect, {
      x: 0.65, y: 1.55, w: 2.65, h: 4.55,
      fill: { color, transparency: 8 },
      line: { color, transparency: 100 },
      rectRadius: 0.12,
    });
    slide.addText(icon, {
      x: 1.1, y: 2.0, w: 1.7, h: 1.05,
      fontSize: 44, bold: true, color: WHITE, align: "center", fontFace: "Arial",
    });
    slide.addText(title, {
      x: 0.98, y: 3.25, w: 1.95, h: 0.68,
      fontSize: 15, bold: true, color: WHITE, align: "center", fontFace: "Arial", wrap: true,
    });
    slide.addText(`${chunk.length} kayıt`, {
      x: 1.03, y: 4.25, w: 1.85, h: 0.3,
      fontSize: 10.5, bold: true, color: "DCEAFB", align: "center", fontFace: "Arial",
    });

    if (chunk.length === 0) {
      slide.addText("Bu bölümde kayıt bulunmuyor.", {
        x: 3.75, y: 2.65, w: 7.5, h: 0.5,
        fontSize: 15, color: "C7D8EE", fontFace: "Arial", italic: true,
      });
    } else {
      chunk.forEach((item, idx) => {
        const col = idx % 2;
        const row = Math.floor(idx / 2);
        const x = 3.65 + col * 4.25;
        const y = 1.62 + row * 1.45;
        slide.addShape(pptx.ShapeType.roundRect, {
          x, y, w: 3.85, h: 1.12,
          fill: { color: WHITE, transparency: 91 },
          line: { color: WHITE, transparency: 85 },
          rectRadius: 0.12,
        });
        slide.addShape(pptx.ShapeType.ellipse, {
          x: x + 0.18, y: y + 0.2, w: 0.48, h: 0.48,
          fill: { color },
          line: { color, transparency: 100 },
        });
        slide.addText(icon, {
          x: x + 0.18, y: y + 0.31, w: 0.48, h: 0.18,
          fontSize: 10, bold: true, color: WHITE, fontFace: "Arial", align: "center",
        });
        slide.addText(String(item), {
          x: x + 0.82, y: y + 0.18, w: 2.85, h: 0.72,
          fontSize: 10.5, color: WHITE, fontFace: "Arial", wrap: true,
          breakLine: false,
        });
      });
    }
  });
}

function addSummarySlide(pptx, { eyebrow, yapilanlar, yapilacaklar, bekleyenler, sorunlar, haftaSayisi }) {
  const slide = pptx.addSlide();
  addSauBackdrop(pptx, slide, { accent: SAU_ORANGE, photoBand: false });
  addHeader(pptx, slide, "Dönem Özeti", eyebrow || "Faaliyet Panosu");

  // 4 büyük sayı kartı: yönetici sunumunda riskleri ayrı göstermek kritik.
  const cards = [
    { label: "Tamamlanan İş", count: yapilanlar, color: GREEN,    icon: "✓", sub: "yapılan madde" },
    { label: "Planlanan İş",  count: yapilacaklar, color: SAU_NAVY, icon: "→", sub: "yapılacak madde" },
    { label: "Bekleyen",      count: bekleyenler, color: AMBER,    icon: "⏳", sub: "geri dönüş bekleniyor" },
    { label: "Riskli Konu",   count: sorunlar, color: RED,         icon: "!", sub: "takip gerektiriyor" },
  ];

  cards.forEach((card, i) => {
    const x = 0.72 + i * 3.16;
    const w = 2.78;
    slide.addShape(pptx.ShapeType.roundRect, {
      x, y: 1.58, w, h: 3.85,
      fill: { color: WHITE, transparency: 88 },
      line: { color: WHITE, transparency: 82 },
      rectRadius: 0.14,
    });
    slide.addShape(pptx.ShapeType.rect, {
      x, y: 1.58, w, h: 0.22,
      fill: { color: card.color },
      line: { color: card.color, transparency: 100 },
    });
    slide.addText(card.icon, {
      x: x + 0.3, y: 2.1, w: 0.6, h: 0.5,
      fontSize: 22, bold: true, color: card.color, fontFace: "Arial", align: "center",
    });
    slide.addText(card.label, {
      x: x + 0.2, y: 2.68, w: w - 0.4, h: 0.38,
      fontSize: 11.5, bold: true, color: "DDEBFA", fontFace: "Arial", align: "center",
    });
    slide.addText(String(card.count), {
      x: x + 0.2, y: 3.1, w: w - 0.4, h: 1.15,
      fontSize: 52, bold: true, color: WHITE, fontFace: "Georgia", align: "center",
    });
    slide.addText(card.sub, {
      x: x + 0.2, y: 4.42, w: w - 0.4, h: 0.28,
      fontSize: 9.5, color: "AACCF0", fontFace: "Arial", align: "center", italic: true,
    });
  });

  // Hafta sayısı alt band
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 4.45, y: 5.72, w: 4.4, h: 0.52,
    fill: { color: "0B438B", transparency: 40 },
    line: { color: "0B438B", transparency: 100 },
    rectRadius: 0.1,
  });
  slide.addText(`${haftaSayisi} haftalık dönem verisi`, {
    x: 4.55, y: 5.88, w: 4.2, h: 0.2,
    fontSize: 10.5, bold: true, color: "DDEBFA", fontFace: "Arial", align: "center",
  });
}

function addCalendarAlerts(pptx, alerts) {
  if (alerts.length === 0) return;
  const slide = pptx.addSlide();
  addSauBackdrop(pptx, slide, { accent: SAU_ORANGE, photoBand: false });
  addHeader(pptx, slide, "Yaklaşan Akademik Takvim", "2026-2027 Akademik Yılı");

  alerts.slice(0, 6).forEach((a, idx) => {
    const y = 1.58 + idx * 0.78;
    const levelColor = a.alert.level === "kritik" ? RED : a.alert.level === "dikkat" ? SAU_ORANGE : a.alert.level === "devam" ? SAU_DARK : SAU_NAVY;
    const days = a.alert.daysLeft > 0 ? `${a.alert.daysLeft} gün` : a.alert.label;
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 0.9, y, w: 11.45, h: 0.58,
      fill: { color: WHITE, transparency: 91 },
      line: { color: WHITE, transparency: 86 },
      rectRadius: 0.08,
    });
    slide.addShape(pptx.ShapeType.rect, {
      x: 0.9, y, w: 0.13, h: 0.58,
      fill: { color: levelColor },
      line: { color: levelColor, transparency: 100 },
    });
    slide.addText(a.ad, {
      x: 1.18, y: y + 0.12, w: 6.15, h: 0.22,
      fontSize: 11.5, bold: true, color: WHITE, fontFace: "Arial",
    });
    slide.addText(`${shortFmt.format(new Date(a.baslangic))} - ${shortFmt.format(new Date(a.bitis))}`, {
      x: 7.25, y: y + 0.15, w: 1.5, h: 0.18,
      fontSize: 9.5, color: "DDEBFA", fontFace: "Arial", align: "center",
    });
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 9.0, y: y + 0.11, w: 1.15, h: 0.33,
      fill: { color: levelColor, transparency: 5 },
      line: { color: levelColor, transparency: 100 },
      rectRadius: 0.06,
    });
    slide.addText(a.alert.label, {
      x: 9.05, y: y + 0.2, w: 1.05, h: 0.12,
      fontSize: 7.5, bold: true, color: WHITE, fontFace: "Arial", align: "center",
    });
    slide.addText(days, {
      x: 10.45, y: y + 0.15, w: 1.45, h: 0.18,
      fontSize: 9.5, bold: true, color: SKY, fontFace: "Arial", align: "center",
    });
  });
}

function addClosingSlide(pptx) {
  const slide = pptx.addSlide();
  addSauBackdrop(pptx, slide, { accent: GOLD });
  slide.addText("TEŞEKKÜRLER", {
    x: 1.6, y: 2.15, w: 10.2, h: 0.7,
    fontSize: 34, bold: true, color: WHITE, fontFace: "Georgia", align: "center",
  });
  slide.addText(`Sakarya Üniversitesi · ${UNIT_NAME}`, {
    x: 1.6, y: 3.12, w: 10.2, h: 0.42,
    fontSize: 16, color: "DDEBFA", fontFace: "Arial", align: "center",
  });
  slide.addShape(pptx.ShapeType.line, {
    x: 4.35, y: 3.85, w: 4.7, h: 0,
    line: { color: GOLD, width: 1.3 },
  });
}

function SunumHazirla() {
  const { records: logs } = useStoredCollection("haftalikLogRecords", haftalikLogData, {
    sortByDateField: "haftaBaslangic",
  });
  const { records: takvimRecords } = useStoredCollection("akademikTakvimRecords", takvimData);

  const [sunumBasligi, setSunumBasligi] = useState("Haftalık Faaliyet Raporu");
  const [selectedLogIds, setSelectedLogIds] = useState(() =>
    logs.slice(0, 3).map((l) => l.id),
  );
  const [includeCalendar, setIncludeCalendar] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [done, setDone] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (selectedLogIds.length === 0 && logs.length > 0) {
      setSelectedLogIds(logs.slice(0, 3).map((log) => log.id));
    }
  }, [logs, selectedLogIds.length]);

  const calendarAlerts = useMemo(() => {
    const today = new Date();
    return takvimRecords
      .map((item) => ({ ...item, alert: getCalendarAlert(item, today) }))
      .filter((item) => ["bilgi", "dikkat", "kritik", "devam"].includes(item.alert.level))
      .sort((a, b) => {
        const order = { kritik: 0, dikkat: 1, devam: 2, bilgi: 3 };
        return (order[a.alert.level] ?? 9) - (order[b.alert.level] ?? 9);
      })
      .slice(0, 10);
  }, [takvimRecords]);

  const selectedLogs = useMemo(
    () => logs.filter((l) => selectedLogIds.includes(l.id)),
    [logs, selectedLogIds],
  );

  const toggleLog = (id) => {
    setSelectedLogIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setDone(false);
    setErrorMessage("");

    try {
      const { default: PptxGenJS } = await import("pptxgenjs");
      const pptx = new PptxGenJS();
      pptx.layout = "LAYOUT_WIDE";
      pptx.author = `Sakarya Üniversitesi ${UNIT_NAME}`;
      pptx.company = "Sakarya Üniversitesi";
      pptx.subject = sunumBasligi;

      // Tüm seçili haftaları tarihe göre sırala
      const sortedLogs = [...selectedLogs].sort(
        (a, b) => new Date(a.haftaBaslangic) - new Date(b.haftaBaslangic),
      );

      // Toplu veriler
      const allYapilanlar  = sortedLogs.flatMap((l) => l.yapilanlar  || []);
      const allYapilacaklar = sortedLogs.flatMap((l) => l.yapilacaklar || []);
      const allBekleyenler = sortedLogs.flatMap((l) => l.bekleyenler  || []);
      const allSorunlar = sortedLogs.flatMap((l) => l.sorunlar || []);

      const startLog = sortedLogs[0];
      const endLog   = sortedLogs[sortedLogs.length - 1];
      const subtitle = startLog
        ? startLog === endLog
          ? (startLog.haftaLabel || fmt(startLog.haftaBaslangic))
          : `${shortFmt.format(new Date(startLog.haftaBaslangic))} – ${shortFmt.format(new Date(endLog.haftaBaslangic))}`
        : "2026-2027 Akademik Yılı";

      // ── Slayt 1: Kapak ──────────────────────────────────────────
      addTitleSlide(pptx, sunumBasligi, subtitle);

      // ── Slayt 2: Dönem özeti (büyük sayılar) ────────────────────
      addSummarySlide(pptx, {
        eyebrow: subtitle,
        yapilanlar:  allYapilanlar.length,
        yapilacaklar: allYapilacaklar.length,
        bekleyenler: allBekleyenler.length,
        sorunlar: allSorunlar.length,
        haftaSayisi: sortedLogs.length,
      });

      // ── Slayt 3: Öne çıkan başarılar (ilk 6 yapılan) ────────────
      if (allYapilanlar.length > 0) {
        addContentSlide(pptx, {
          title: "Bu Dönemde Yapılanlar",
          eyebrow: subtitle,
          color: GREEN,
          icon: "✓",
          items: allYapilanlar.slice(0, 6),
        });
      }

      // ── Slayt 4: Devam eden & bekleyenler (max 6) ────────────────
      const devamItems = [
        ...allYapilacaklar.map((t) => `→ ${t}`),
        ...allBekleyenler.map((t) => `⏳ ${t}`),
      ];
      if (devamItems.length > 0) {
        addContentSlide(pptx, {
          title: "Planlanan & Bekleyen İşler",
          eyebrow: subtitle,
          color: SAU_NAVY,
          icon: "→",
          items: devamItems.slice(0, 6),
        });
      }

      if (allSorunlar.length > 0) {
        addContentSlide(pptx, {
          title: "Riskler ve İzlenecek Konular",
          eyebrow: subtitle,
          color: RED,
          icon: "!",
          items: allSorunlar.slice(0, 6),
        });
      }

      // ── Slayt 5: Akademik takvim uyarıları (opsiyonel) ───────────
      if (includeCalendar && calendarAlerts.length > 0) {
        addCalendarAlerts(pptx, calendarAlerts);
      }

      // ── Slayt 6: Kapanış ─────────────────────────────────────────
      addClosingSlide(pptx);

      const safeTitle = sunumBasligi.replace(/[^a-z0-9ğüşıöçA-ZĞÜŞİÖÇ\s-]/gi, "");
      await pptx.writeFile({ fileName: `${safeTitle}.pptx` });
      setDone(true);
    } catch (err) {
      console.error("Sunum oluşturma hatası:", err);
      setErrorMessage("Sunum oluşturulamadı. Lütfen kayıt seçimini kontrol edip tekrar deneyin.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-5 max-w-3xl">

      {/* Başlık ve açıklama */}
      <div className="rounded-2xl border border-[#D6DEEA] bg-gradient-to-r from-[#0E2650] to-[#1F2D5C] px-6 py-5 text-white">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">SAÜ Kurumsal</p>
        <h2 className="mt-1 text-xl font-bold">Sunum Hazırla</h2>
        <p className="mt-1 text-sm text-white/60">
          Haftalık faaliyet verilerinden SAÜ kurumsal renklerde PPTX sunum oluşturur.
        </p>
      </div>

      {/* Sunum başlığı */}
      <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm space-y-4">
        <label className="block space-y-2 text-sm font-medium text-slate-700">
          Sunum Başlığı
          <input
            value={sunumBasligi}
            onChange={(e) => setSunumBasligi(e.target.value)}
            className="mt-1 block w-full rounded-xl border border-[#D6DEEA] px-4 py-3 text-sm text-[#1F2D5C] outline-none focus:border-[#00377B]"
            placeholder="Örn. Mayıs 2026 Faaliyet Raporu"
          />
        </label>

        {/* Takvim uyarıları dahil */}
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={includeCalendar}
            onChange={(e) => setIncludeCalendar(e.target.checked)}
            className="h-4 w-4 rounded"
          />
          <span className="text-sm text-slate-700">
            Yaklaşan akademik takvim uyarılarını ekle ({calendarAlerts.length} uyarı)
          </span>
        </label>
      </div>

      {/* Hafta seçimi */}
      <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-[#1F2D5C]">Dahil edilecek haftalar</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setSelectedLogIds(logs.map((l) => l.id))}
              className="text-xs text-[#00377B] hover:underline">Tümünü seç</button>
            <span className="text-slate-300">|</span>
            <button type="button" onClick={() => setSelectedLogIds([])}
              className="text-xs text-slate-400 hover:underline">Temizle</button>
          </div>
        </div>
        <div className="space-y-2">
          {logs.map((log) => {
            const isSelected = selectedLogIds.includes(log.id);
            return (
              <label key={log.id}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition ${
                  isSelected ? "border-[#00377B] bg-[#EEF3FA]" : "border-[#E5E7EB] bg-white hover:border-[#D6DEEA]"
                }`}>
                <input type="checkbox" checked={isSelected} onChange={() => toggleLog(log.id)} className="h-4 w-4" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[#1F2D5C]">{log.haftaLabel}</p>
                  <div className="mt-1 flex gap-3 text-xs text-slate-500">
                    <span className="text-[#1F4D2C]">✓ {(log.yapilanlar || []).length} yapılan</span>
                    <span className="text-[#00377B]">→ {(log.yapilacaklar || []).length} yapılacak</span>
                    {(log.bekleyenler || []).length > 0 && (
                      <span className="text-[#A34D00]">⏳ {log.bekleyenler.length} bekleyen</span>
                    )}
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* Sunum önizleme */}
      {selectedLogs.length > 0 && (() => {
        const allY = selectedLogs.flatMap((l) => l.yapilanlar || []);
        const allP = selectedLogs.flatMap((l) => l.yapilacaklar || []);
        const allB = selectedLogs.flatMap((l) => l.bekleyenler || []);
        const slideCount = 2
          + (allY.length > 0 ? 1 : 0)
          + (allP.length + allB.length > 0 ? 1 : 0)
          + (includeCalendar && calendarAlerts.length > 0 ? 1 : 0)
          + 1; // kapanış
        return (
          <div className="rounded-xl border border-[#D6DEEA] bg-[#F8FAFD] px-5 py-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Sunum içeriği</p>
            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
              {[
                { label: "Kapak slaytı", val: "1" },
                { label: "Dönem özeti", val: "1" },
                { label: "Yapılanlar", val: `${Math.min(allY.length, 6)} madde` },
                { label: "Planlanan & Bekleyen", val: `${Math.min(allP.length + allB.length, 6)} madde` },
                includeCalendar && calendarAlerts.length > 0 ? { label: "Takvim uyarıları", val: `${Math.min(calendarAlerts.length, 6)} olay` } : null,
                { label: "Kapanış", val: "1" },
              ].filter(Boolean).map((row) => (
                <div key={row.label} className="flex items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#00377B]" />
                  <span className="text-slate-600">{row.label}</span>
                  <span className="ml-auto text-xs font-semibold text-[#00377B]">{row.val}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-right text-xs font-semibold text-[#1F2D5C]">
              Toplam <span className="text-[#F58220]">{slideCount} slayt</span> · SAÜ kurumsal renkleri · PPTX
            </p>
          </div>
        );
      })()}

      {/* Oluştur butonu */}
      {done && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          ✓ Sunum başarıyla oluşturuldu ve indirildi!
        </div>
      )}
      {errorMessage && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <button
        type="button"
        onClick={handleGenerate}
        disabled={generating || selectedLogs.length === 0}
        className="w-full rounded-xl bg-[#00377B] py-3.5 text-sm font-semibold text-white transition hover:bg-[#1F2D5C] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {generating ? "Sunum oluşturuluyor…" : "⬇ PPTX Sunum İndir"}
      </button>
    </div>
  );
}

export default SunumHazirla;

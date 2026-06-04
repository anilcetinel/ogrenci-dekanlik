import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import Accordion from "../components/Accordion";
import Badge from "../components/Badge";
import Checklist from "../components/Checklist";
import KnowledgeTimeline from "../components/KnowledgeTimeline";
import SectionCard from "../components/SectionCard";
import useStoredCollection from "../hooks/useStoredCollection";
import haftalikLogData from "../data/haftalik-log.json";
import operasyonData from "../data/operasyon-kutuphanesi.json";

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

const tabs = [
  "Genel Bilgi",
  "Süreç Adımları",
  "Kontrol Listesi",
  "Geçmiş Yıllar",
  "Sorunlar ve Çözümler",
  "Evraklar",
  "Mail Şablonları",
  "Operasyon Kayıtları",
];

function formatDate(date) {
  return date ? dateFormatter.format(new Date(date)) : "Henüz girilmedi";
}

function EmptyTab({ text }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#D6DEEA] bg-slate-50 p-6 text-sm text-slate-500">
      {text}
    </div>
  );
}

function OperasyonDetay() {
  const { id } = useParams();
  const { records: operations } = useStoredCollection("operasyonRecords", operasyonData);
  const { records: weeklyLogs } = useStoredCollection("haftalikLogRecords", haftalikLogData, {
    sortByDateField: "haftaBaslangic",
  });
  const [activeTab, setActiveTab] = useState(tabs[0]);
  const operation = operations.find((item) => String(item.id) === id);
  const relatedWeeklyLogs = weeklyLogs.filter((log) =>
    (log.operasyonIds || []).some((operationId) => String(operationId) === String(id)),
  );

  if (!operation) {
    return (
      <SectionCard title="Operasyon bulunamadı">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            İstenen operasyon kaydı bulunamadı. Kütüphaneye dönerek farklı bir kayıt seçebilirsiniz.
          </p>
          <Link
            to="/is-nasil-yapilir"
            className="inline-flex rounded-lg bg-[#00377B] px-4 py-3 text-sm font-medium text-white"
          >
            Operasyon Kütüphanesine Dön
          </Link>
        </div>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-6">
      <section className="institutional-shadow rounded-lg border border-[#E5E7EB] bg-white">
        <div className="border-b border-[#E5E7EB] px-6 py-6 md:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="max-w-4xl">
              <div className="flex flex-wrap gap-2">
                <Badge>{operation.kategori}</Badge>
                <Badge tone="devam">{operation.ilgiliTakvimOlayi}</Badge>
              </div>
              <h1 className="mt-4 text-2xl font-semibold text-[#1F2D5C] md:text-3xl">
                {operation.ad}
              </h1>
              <p className="mt-4 text-sm leading-7 text-slate-600">{operation.kisaAciklama}</p>
            </div>
            <Link
              to={`/haftalik-faaliyetler?operasyonId=${operation.id}`}
              className="inline-flex rounded-lg border border-[#D6DEEA] bg-[#F8FAFD] px-4 py-3 text-sm font-medium text-[#1F2D5C]"
            >
              Haftalık faaliyete ekle
            </Link>
          </div>
        </div>

        <div className="overflow-x-auto border-b border-[#E5E7EB] px-4 py-3 md:px-6">
          <div className="flex min-w-max gap-2">
            {tabs.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`rounded-lg px-4 py-2.5 text-sm font-medium transition ${
                  activeTab === tab
                    ? "bg-[#00377B] text-white"
                    : "border border-[#D6DEEA] bg-white text-[#1F2D5C] hover:bg-[#F8FAFD]"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5 md:p-6">
          {activeTab === "Genel Bilgi" && (
            <div className="grid gap-px overflow-hidden rounded-lg border border-[#E5E7EB] bg-[#E5E7EB] md:grid-cols-2 xl:grid-cols-4">
              <div className="bg-white px-5 py-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Operasyon adı
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-800">{operation.ad}</p>
              </div>
              <div className="bg-white px-5 py-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Sorumlu birim
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-800">
                  {operation.sorumluBirim}
                </p>
              </div>
              <div className="bg-white px-5 py-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Takvim olayı
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-800">
                  {operation.ilgiliTakvimOlayi}
                </p>
              </div>
              <div className="bg-white px-5 py-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Son güncelleme
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-800">
                  {formatDate(operation.sonGuncelleme)}
                </p>
              </div>
            </div>
          )}

          {activeTab === "Süreç Adımları" &&
            (operation.adimlar?.length ? (
              <ol className="space-y-3">
                {operation.adimlar.map((step, index) => (
                  <li
                    key={step}
                    className="flex gap-4 rounded-lg border border-[#E5E7EB] bg-slate-50 p-4"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#00377B] text-sm font-semibold text-white">
                      {index + 1}
                    </div>
                    <p className="pt-1 text-sm leading-6 text-slate-700">{step}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyTab text="Bu operasyon için süreç adımı henüz girilmedi." />
            ))}

          {activeTab === "Kontrol Listesi" &&
            (operation.kontrolListesi?.length ? (
              <Checklist items={operation.kontrolListesi} />
            ) : (
              <EmptyTab text="Bu operasyon için kontrol listesi henüz girilmedi." />
            ))}

          {activeTab === "Geçmiş Yıllar" &&
            (operation.gecmisYilNotlari?.length ? (
              <KnowledgeTimeline
                items={operation.gecmisYilNotlari}
                renderContent={(yearItem) => (
                  <>
                    <h3 className="text-base font-semibold text-[#1F2D5C]">{yearItem.yil}</h3>
                    <ul className="mt-3 space-y-2">
                      {yearItem.notlar.map((note) => (
                        <li key={note} className="flex gap-2 text-sm leading-6 text-slate-700">
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#F58220]" />
                          <span>{note}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              />
            ) : (
              <EmptyTab text="Bu operasyon için geçmiş yıl notu henüz girilmedi." />
            ))}

          {activeTab === "Sorunlar ve Çözümler" &&
            (operation.sorunlar?.length ? (
              <Accordion items={operation.sorunlar} />
            ) : (
              <EmptyTab text="Bu operasyon için sorun ve çözüm kaydı henüz girilmedi." />
            ))}

          {activeTab === "Evraklar" &&
            (operation.dosyalar?.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {operation.dosyalar.map((file) => (
                  <div key={file.ad} className="rounded-lg border border-[#E5E7EB] bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-[#1F2D5C]">{file.ad}</h3>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{file.aciklama}</p>
                      </div>
                      <Badge>{file.tur}</Badge>
                    </div>
                    <button
                      type="button"
                      className="mt-4 rounded-lg border border-[#D6DEEA] bg-white px-3 py-2 text-xs font-medium text-[#1F2D5C]"
                    >
                      Görüntüle
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyTab text="Bu operasyon için evrak veya şablon henüz girilmedi." />
            ))}

          {activeTab === "Mail Şablonları" &&
            (operation.mailSablonlari?.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {operation.mailSablonlari.map((mail) => (
                  <div key={mail.konu} className="rounded-lg border border-[#E5E7EB] bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Konu
                    </p>
                    <h3 className="mt-1 text-sm font-semibold text-[#1F2D5C]">{mail.konu}</h3>
                    <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Alıcı
                    </p>
                    <p className="mt-1 text-sm text-slate-700">{mail.alici}</p>
                    <p className="mt-3 text-sm leading-6 text-slate-600">{mail.onizleme}</p>
                    <button
                      type="button"
                      className="mt-4 rounded-lg bg-[#00377B] px-3 py-2 text-xs font-medium text-white"
                    >
                      Önizle
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyTab text="Bu operasyon için e-posta şablonu henüz girilmedi." />
            ))}

          {activeTab === "Operasyon Kayıtları" &&
            (operation.gecmisOperasyonlar?.length || relatedWeeklyLogs.length ? (
              <div className="space-y-6">
                <div>
                  <h3 className="mb-4 text-base font-semibold text-[#1F2D5C]">
                    Bağlı Haftalık Faaliyet Kayıtları
                  </h3>
                  {relatedWeeklyLogs.length > 0 ? (
                    <div className="space-y-3">
                      {relatedWeeklyLogs.map((log) => (
                        <div key={log.id} className="rounded-lg border border-[#E5E7EB] bg-slate-50 p-4">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="font-semibold text-[#1F2D5C]">{log.haftaLabel}</p>
                              <p className="mt-1 text-sm text-slate-500">
                                {formatDate(log.haftaBaslangic)} · {log.hazirlayan}
                              </p>
                            </div>
                            <Badge tone={log.sorunlar?.length ? "sorun" : "yapildi"}>
                              {log.sorunlar?.length ? "Risk var" : "Takipte"}
                            </Badge>
                          </div>
                          <div className="mt-4 grid gap-2 text-sm text-slate-700 md:grid-cols-4">
                            <p className="rounded-lg bg-white px-3 py-2">
                              Yapılan: {log.yapilanlar?.length || 0}
                            </p>
                            <p className="rounded-lg bg-white px-3 py-2">
                              Yapılacak: {log.yapilacaklar?.length || 0}
                            </p>
                            <p className="rounded-lg bg-white px-3 py-2">
                              Bekleyen: {log.bekleyenler?.length || 0}
                            </p>
                            <p className="rounded-lg bg-white px-3 py-2">
                              Sorun: {log.sorunlar?.length || 0}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyTab text="Bu operasyonla bağlantılı haftalık faaliyet kaydı yok." />
                  )}
                </div>

                <div>
                  <h3 className="mb-4 text-base font-semibold text-[#1F2D5C]">
                    Geçmiş Operasyon Dönemleri
                  </h3>
                  {operation.gecmisOperasyonlar?.length ? (
                    <KnowledgeTimeline
                      items={operation.gecmisOperasyonlar}
                      renderContent={(item) => (
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <h3 className="text-base font-semibold text-[#1F2D5C]">{item.donem}</h3>
                            <p className="mt-1 text-sm text-slate-500">Dönem operasyon kaydı</p>
                          </div>
                          <Badge tone={item.durum === "Tamamlandı" ? "yapildi" : "devam"}>
                            {item.durum}
                          </Badge>
                        </div>
                      )}
                    />
                  ) : (
                    <EmptyTab text="Bu operasyon için geçmiş dönem kaydı henüz girilmedi." />
                  )}
                </div>
              </div>
            ) : (
              <EmptyTab text="Bu operasyon için geçmiş operasyon kaydı henüz girilmedi." />
            ))}
        </div>
      </section>
    </div>
  );
}

export default OperasyonDetay;

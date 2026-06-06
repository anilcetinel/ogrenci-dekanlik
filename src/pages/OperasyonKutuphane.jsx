import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Badge from "../components/Badge";
import FormModal from "../components/FormModal";
import SectionCard from "../components/SectionCard";
import SharedStatus from "../components/SharedStatus";
import SuccessMessage from "../components/SuccessMessage";
import useStoredCollection from "../hooks/useStoredCollection";
import operasyonData from "../data/operasyon-kutuphanesi.json";
import { canEditData } from "../utils/auth";
import { splitLines } from "../utils/storage";

const emptyForm = {
  ad: "",
  kategori: "",
  sorumluBirim: "",
  ilgiliTakvimOlayi: "",
  kisaAciklama: "",
  adimlar: "",
  kontrolListesi: "",
  ilgiliBirimler: "",
  gecmisYilNotu: "",
  durum: "Planlandı",
  sorumluKisi: "",
  sonTarih: "",
  riskSeviyesi: "orta",
};

function OperasyonKutuphane() {
  const editable = canEditData();
  const { records: operations, addRecord, syncStatus } = useStoredCollection("operasyonRecords", operasyonData);
  const [search, setSearch] = useState("");
  const [kategori, setKategori] = useState("Tümü");
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const kategoriler = ["Tümü", ...new Set(operations.map((item) => item.kategori))];

  const filteredOperations = useMemo(
    () =>
      operations.filter((item) => {
        const matchesSearch =
          item.ad.toLowerCase().includes(search.toLowerCase()) ||
          item.kisaAciklama.toLowerCase().includes(search.toLowerCase());
        const matchesKategori = kategori === "Tümü" || item.kategori === kategori;
        return matchesSearch && matchesKategori;
      }),
    [kategori, operations, search],
  );

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setFormError("");

    if (
      !formData.ad ||
      !formData.kategori ||
      !formData.sorumluBirim ||
      !formData.ilgiliTakvimOlayi ||
      !formData.kisaAciklama
    ) {
      setFormError("Lütfen zorunlu alanları doldurun.");
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const firstYearNote = formData.gecmisYilNotu
      ? [{ yil: "2026", notlar: splitLines(formData.gecmisYilNotu) }]
      : [{ yil: "2026", notlar: ["Yeni eklenen operasyon için geçmiş yıl notu henüz girilmedi."] }];

    addRecord({
      id: `user-${Date.now()}`,
      ad: formData.ad,
      kategori: formData.kategori,
      sorumluBirim: formData.sorumluBirim,
      ilgiliTakvimOlayi: formData.ilgiliTakvimOlayi,
      sonGuncelleme: today,
      kisaAciklama: formData.kisaAciklama,
      adimlar: splitLines(formData.adimlar),
      kontrolListesi: splitLines(formData.kontrolListesi),
      gecmisYilNotlari: firstYearNote,
      sorunlar: [],
      ilgiliBirimler: splitLines(formData.ilgiliBirimler),
      dosyalar: [],
      mailSablonlari: [],
      gecmisOperasyonlar: [{ donem: "2026", durum: "Yeni kayıt" }],
      takip: {
        durum: formData.durum,
        sorumluKisi: formData.sorumluKisi || formData.sorumluBirim,
        sonTarih: formData.sonTarih || today,
        riskSeviyesi: formData.riskSeviyesi,
      },
    });

    setFormData(emptyForm);
    setModalOpen(false);
    setSuccessMessage("Operasyon başarıyla eklendi.");
  };

  return (
    <div className="space-y-6">
      <SuccessMessage>{successMessage}</SuccessMessage>
      <SharedStatus syncStatus={syncStatus} count={operations.length} label="Operasyon kütüphanesi ortak veri durumu" />

      <SectionCard
        title="İş Hafızası Araması"
        action={editable ? (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="rounded-xl bg-[#00377B] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#1F2D5C]"
          >
            Yeni Operasyon Ekle
          </button>
        ) : null}
      >
        <div className="grid gap-4 md:grid-cols-[1fr_260px]">
          <label className="space-y-2 text-sm text-slate-600">
            <span>Operasyon ara</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Örn. final, muafiyet, mezuniyet"
              className="w-full rounded-xl border border-[#D6DEEA] bg-white px-4 py-3 text-sm text-[#1F2D5C] outline-none"
            />
          </label>
          <label className="space-y-2 text-sm text-slate-600">
            <span>Kategori</span>
            <select
              value={kategori}
              onChange={(event) => setKategori(event.target.value)}
              className="w-full rounded-xl border border-[#D6DEEA] bg-white px-4 py-3 text-sm text-[#1F2D5C] outline-none"
            >
              {kategoriler.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
        </div>
      </SectionCard>

      {filteredOperations.length > 0 ? (
        <div className="grid grid-autofit gap-5">
          {filteredOperations.map((operation) => (
            <article
              key={operation.id}
              className="institutional-shadow rounded-2xl border border-[#E5E7EB] bg-white p-5"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{operation.kategori}</Badge>
                <Badge tone="devam">{operation.ilgiliTakvimOlayi}</Badge>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-[#1F2D5C]">{operation.ad}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">{operation.kisaAciklama}</p>
              <div className="mt-5 space-y-2 text-sm text-slate-500">
                <p>
                  <span className="font-semibold text-slate-700">Sorumlu birim:</span>{" "}
                  {operation.sorumluBirim}
                </p>
                <p>
                  <span className="font-semibold text-slate-700">İlgili olay:</span>{" "}
                  {operation.ilgiliTakvimOlayi}
                </p>
              </div>
              <Link
                to={`/operasyonlar/${operation.id}`}
                className="mt-6 inline-flex rounded-xl bg-[#00377B] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#1F2D5C]"
              >
                Detaya Git
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <SectionCard title="Sonuç bulunamadı">
          <div className="rounded-2xl border border-dashed border-[#D6DEEA] bg-slate-50 p-6 text-sm text-slate-500">
            Arama ve kategori filtresine uygun operasyon kaydı bulunamadı.
          </div>
        </SectionCard>
      )}

      {editable && modalOpen && (
        <FormModal
          title="Operasyon Girişi"
          onClose={() => setModalOpen(false)}
          onSubmit={handleSubmit}
          error={formError}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm text-slate-600">
              <span>Operasyon adı</span>
              <input required name="ad" value={formData.ad} onChange={handleChange} className="w-full rounded-xl border border-[#D6DEEA] px-4 py-3 outline-none" />
            </label>
            <label className="space-y-2 text-sm text-slate-600">
              <span>Kategori</span>
              <input required name="kategori" value={formData.kategori} onChange={handleChange} className="w-full rounded-xl border border-[#D6DEEA] px-4 py-3 outline-none" />
            </label>
            <label className="space-y-2 text-sm text-slate-600">
              <span>Sorumlu birim</span>
              <input required name="sorumluBirim" value={formData.sorumluBirim} onChange={handleChange} className="w-full rounded-xl border border-[#D6DEEA] px-4 py-3 outline-none" />
            </label>
            <label className="space-y-2 text-sm text-slate-600">
              <span>İlgili takvim olayı</span>
              <input required name="ilgiliTakvimOlayi" value={formData.ilgiliTakvimOlayi} onChange={handleChange} className="w-full rounded-xl border border-[#D6DEEA] px-4 py-3 outline-none" />
            </label>
          </div>
          <label className="block space-y-2 text-sm text-slate-600">
            <span>Kısa açıklama</span>
            <textarea required name="kisaAciklama" rows="3" value={formData.kisaAciklama} onChange={handleChange} className="w-full rounded-xl border border-[#D6DEEA] px-4 py-3 outline-none" />
          </label>
          <label className="block space-y-2 text-sm text-slate-600">
            <span>Süreç adımları</span>
            <textarea name="adimlar" rows="4" value={formData.adimlar} onChange={handleChange} placeholder="Her satıra bir madde yazın" className="w-full rounded-xl border border-[#D6DEEA] px-4 py-3 outline-none" />
          </label>
          <label className="block space-y-2 text-sm text-slate-600">
            <span>Kontrol listesi</span>
            <textarea name="kontrolListesi" rows="3" value={formData.kontrolListesi} onChange={handleChange} placeholder="Her satıra bir madde yazın" className="w-full rounded-xl border border-[#D6DEEA] px-4 py-3 outline-none" />
          </label>
          <label className="block space-y-2 text-sm text-slate-600">
            <span>İlgili birimler</span>
            <textarea name="ilgiliBirimler" rows="3" value={formData.ilgiliBirimler} onChange={handleChange} placeholder="Her satıra bir birim yazın" className="w-full rounded-xl border border-[#D6DEEA] px-4 py-3 outline-none" />
          </label>
          <label className="block space-y-2 text-sm text-slate-600">
            <span>Geçmiş yıl notu</span>
            <textarea name="gecmisYilNotu" rows="3" value={formData.gecmisYilNotu} onChange={handleChange} placeholder="Her satıra bir not yazın" className="w-full rounded-xl border border-[#D6DEEA] px-4 py-3 outline-none" />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm text-slate-600">
              <span>Durum</span>
              <select name="durum" value={formData.durum} onChange={handleChange} className="w-full rounded-xl border border-[#D6DEEA] px-4 py-3 outline-none">
                <option>Planlandı</option>
                <option>Devam ediyor</option>
                <option>Takipte</option>
                <option>Tamamlandı</option>
              </select>
            </label>
            <label className="space-y-2 text-sm text-slate-600">
              <span>Sorumlu kişi</span>
              <input name="sorumluKisi" value={formData.sorumluKisi} onChange={handleChange} placeholder="Örn. Operasyon Koordinasyon Birimi" className="w-full rounded-xl border border-[#D6DEEA] px-4 py-3 outline-none" />
            </label>
            <label className="space-y-2 text-sm text-slate-600">
              <span>Son tarih</span>
              <input type="date" name="sonTarih" value={formData.sonTarih} onChange={handleChange} className="w-full rounded-xl border border-[#D6DEEA] px-4 py-3 outline-none" />
            </label>
            <label className="space-y-2 text-sm text-slate-600">
              <span>Risk seviyesi</span>
              <select name="riskSeviyesi" value={formData.riskSeviyesi} onChange={handleChange} className="w-full rounded-xl border border-[#D6DEEA] px-4 py-3 outline-none">
                <option>yüksek</option>
                <option>orta</option>
                <option>düşük</option>
              </select>
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="rounded-xl border border-[#D6DEEA] px-4 py-3 text-sm font-medium text-slate-600">
              Vazgeç
            </button>
            <button type="submit" className="rounded-xl bg-[#00377B] px-4 py-3 text-sm font-medium text-white">
              Kaydet
            </button>
          </div>
        </FormModal>
      )}
    </div>
  );
}

export default OperasyonKutuphane;

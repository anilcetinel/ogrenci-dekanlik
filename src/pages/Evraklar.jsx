import { useMemo, useState } from "react";
import Badge from "../components/Badge";
import FormModal from "../components/FormModal";
import SectionCard from "../components/SectionCard";
import SuccessMessage from "../components/SuccessMessage";
import useStoredCollection from "../hooks/useStoredCollection";
import evrakData from "../data/evraklar.json";

const tabs = ["Mail Şablonları", "Excel Dosyaları", "Resmi Yazılar", "Formlar"];

const emptyForm = {
  ad: "",
  tur: tabs[0],
  ilgiliOperasyon: "",
  aciklama: "",
  dosyaLinki: "",
};

function Evraklar() {
  const { records: docs, addRecord } = useStoredCollection("evrakRecords", evrakData);
  const [activeTab, setActiveTab] = useState(tabs[0]);
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const filteredDocs = useMemo(
    () => docs.filter((item) => item.tur === activeTab),
    [activeTab, docs],
  );

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setFormError("");

    if (!formData.ad || !formData.tur || !formData.ilgiliOperasyon || !formData.aciklama) {
      setFormError("Lütfen zorunlu alanları doldurun.");
      return;
    }

    addRecord({
      id: `user-${Date.now()}`,
      ...formData,
    });
    setActiveTab(formData.tur);
    setFormData(emptyForm);
    setModalOpen(false);
    setSuccessMessage("Evrak / şablon kaydı başarıyla eklendi.");
  };

  return (
    <div className="space-y-6">
      <SuccessMessage>{successMessage}</SuccessMessage>

      <SectionCard
        title="Evrak Kategorileri"
        action={
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="rounded-xl bg-[#00377B] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#1F2D5C]"
          >
            Yeni Evrak / Şablon Ekle
          </button>
        }
      >
        <div className="flex flex-wrap gap-3">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`rounded-xl px-4 py-3 text-sm font-medium transition ${
                activeTab === tab
                  ? "bg-[#00377B] text-white"
                  : "border border-[#D6DEEA] bg-white text-[#1F2D5C]"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </SectionCard>

      {filteredDocs.length > 0 ? (
        <div className="grid grid-autofit gap-5">
          {filteredDocs.map((doc) => (
            <article
              key={doc.id}
              className="institutional-shadow rounded-2xl border border-[#E5E7EB] bg-white p-5"
            >
              <div className="flex items-center justify-between gap-3">
                <Badge>{doc.tur}</Badge>
                <button
                  type="button"
                  className="rounded-xl border border-[#D6DEEA] bg-[#F8FAFD] px-3 py-2 text-xs font-medium text-[#1F2D5C]"
                >
                  İndir
                </button>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-[#1F2D5C]">{doc.ad}</h3>
              <p className="mt-2 text-sm font-medium text-slate-500">{doc.ilgiliOperasyon}</p>
              <p className="mt-3 text-sm leading-6 text-slate-600">{doc.aciklama}</p>
              {doc.dosyaLinki && (
                <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
                  Dosya linki: {doc.dosyaLinki}
                </p>
              )}
            </article>
          ))}
        </div>
      ) : (
        <SectionCard title="Belge bulunamadı">
          <div className="rounded-2xl border border-dashed border-[#D6DEEA] bg-slate-50 p-6 text-sm text-slate-500">
            Bu kategori için henüz belge kaydı bulunmuyor.
          </div>
        </SectionCard>
      )}

      {modalOpen && (
        <FormModal
          title="Evrak / Şablon Girişi"
          onClose={() => setModalOpen(false)}
          onSubmit={handleSubmit}
          error={formError}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm text-slate-600">
              <span>Belge adı</span>
              <input required name="ad" value={formData.ad} onChange={handleChange} className="w-full rounded-xl border border-[#D6DEEA] px-4 py-3 outline-none" />
            </label>
            <label className="space-y-2 text-sm text-slate-600">
              <span>Tür</span>
              <select name="tur" value={formData.tur} onChange={handleChange} className="w-full rounded-xl border border-[#D6DEEA] px-4 py-3 outline-none">
                {tabs.map((tab) => (
                  <option key={tab}>{tab}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="block space-y-2 text-sm text-slate-600">
            <span>İlgili operasyon</span>
            <input required name="ilgiliOperasyon" value={formData.ilgiliOperasyon} onChange={handleChange} className="w-full rounded-xl border border-[#D6DEEA] px-4 py-3 outline-none" />
          </label>
          <label className="block space-y-2 text-sm text-slate-600">
            <span>Açıklama</span>
            <textarea required name="aciklama" rows="3" value={formData.aciklama} onChange={handleChange} className="w-full rounded-xl border border-[#D6DEEA] px-4 py-3 outline-none" />
          </label>
          <label className="block space-y-2 text-sm text-slate-600">
            <span>Dosya linki placeholder</span>
            <input name="dosyaLinki" value={formData.dosyaLinki} onChange={handleChange} placeholder="Örn. /sablonlar/final-programi.xlsx" className="w-full rounded-xl border border-[#D6DEEA] px-4 py-3 outline-none" />
          </label>
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

export default Evraklar;

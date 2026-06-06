import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Badge from "../components/Badge";
import FormModal from "../components/FormModal";
import SectionCard from "../components/SectionCard";
import SuccessMessage from "../components/SuccessMessage";
import useStoredCollection from "../hooks/useStoredCollection";
import evrakData from "../data/evraklar.json";
import { canEditData } from "../utils/auth";
import { extractTextFromFile, formatFileSize, getDocumentType } from "../utils/fileText";

const tabs = ["Mail Şablonları", "Excel Dosyaları", "Resmi Yazılar", "Formlar"];

const emptyForm = {
  ad: "",
  tur: tabs[0],
  ilgiliOperasyon: "",
  aciklama: "",
  dosyaLinki: "",
  dosyaOzet: "",
  dosyaMetni: "",
};

function cleanExtractedText(value) {
  const seen = new Set();
  return String(value || "")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => {
      if (!line || line.length < 4) return false;
      const normalized = line.toLocaleLowerCase("tr-TR");
      if (/^sayfa\s+\d+/.test(normalized) || /^\d+$/.test(normalized)) return false;
      if (normalized.includes("prototip") || normalized.includes("kişisel veri")) return false;
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    })
    .join("\n");
}

function buildDocumentSummary(value) {
  const lines = cleanExtractedText(value)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return "";
  }

  const usefulLines = lines.filter((line) => {
    const normalized = line.toLocaleLowerCase("tr-TR");
    return (
      line.length > 18 &&
      !normalized.includes("sakarya üniversitesi") &&
      !normalized.includes("öğrenci destek koordinatörlüğü")
    );
  });

  return (usefulLines.length ? usefulLines : lines)
    .slice(0, 8)
    .map((line) => `- ${line}`)
    .join("\n");
}

function Evraklar() {
  const editable = canEditData();
  const { records: docs, addRecord, deleteRecord } = useStoredCollection("evrakRecords", evrakData);
  const [activeTab, setActiveTab] = useState(tabs[0]);
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileNotice, setFileNotice] = useState("");

  const filteredDocs = useMemo(
    () => docs.filter((item) => item.tur === activeTab),
    [activeTab, docs],
  );

  const closeModal = () => {
    setModalOpen(false);
    setFormData(emptyForm);
    setFormError("");
    setSelectedFile(null);
    setFileNotice("");
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileNotice("");

    const fileInfo = {
      ad: file.name,
      boyut: formatFileSize(file.size),
      tur: getDocumentType(file.name),
    };
    const extractedText = await extractTextFromFile(file);
    const cleanedText = cleanExtractedText(extractedText);
    const summary = buildDocumentSummary(cleanedText);

    setSelectedFile(fileInfo);
    setFormData((prev) => ({
      ...prev,
      ad: prev.ad || fileInfo.ad,
      tur: fileInfo.tur,
      aciklama: summary
        ? [prev.aciklama, `Dosyadan çıkarılan özet:\n${summary}`].filter(Boolean).join("\n\n")
        : prev.aciklama,
      dosyaLinki: `Tarayıcı içi kaynak kaydı · ${fileInfo.boyut}`,
      dosyaOzet: summary,
      dosyaMetni: cleanedText.slice(0, 6000),
    }));
    setFileNotice(
      summary
        ? "Dosya içeriği temizlendi ve açıklama alanına özet olarak aktarıldı."
        : "Bu dosya kaynak olarak kaydedilir; bu türden otomatik metin çıkarılamadı.",
    );
    event.target.value = "";
  };

  const handleDelete = (doc) => {
    if (window.confirm(`"${doc.ad}" kaydı silinsin mi?`)) {
      deleteRecord(doc.id);
      setSuccessMessage("Evrak / şablon kaydı silindi.");
    }
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
    closeModal();
    setSuccessMessage("Evrak / şablon kaydı başarıyla eklendi.");
  };

  return (
    <div className="space-y-6">
      <SuccessMessage>{successMessage}</SuccessMessage>

      <SectionCard
        title="Kaynak Evrak ve Şablon Arşivi"
        action={
          <div className="flex flex-wrap gap-2">
            {editable && (
              <>
                <Link
                  to="/hizli-not"
                  className="rounded-xl border border-[#D6DEEA] bg-white px-4 py-2.5 text-sm font-medium text-[#1F2D5C] transition hover:border-[#00377B]"
                >
                  Dosyadan Not Çıkar
                </Link>
                <button
                  type="button"
                  onClick={() => setModalOpen(true)}
                  className="rounded-xl bg-[#00377B] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#1F2D5C]"
                >
                  Yeni Evrak / Şablon Ekle
                </button>
              </>
            )}
          </div>
        }
      >
        <p className="mb-4 max-w-4xl text-sm leading-6 text-slate-600">
          Bu alan tek başına dosya vitrini değil; hızlı notlardan, Excel/PDF/Word kaynaklarından ve operasyon süreçlerinde kullanılan
          şablonlardan oluşan kurumsal evrak hafızasıdır. Dosyadan faaliyet çıkarmak için önce Hızlı Not Girişi kullanılabilir.
        </p>
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
                <div className="flex gap-2">
                  <span className="rounded-xl border border-[#D6DEEA] bg-[#F8FAFD] px-3 py-2 text-xs font-medium text-[#1F2D5C]">
                    Kayıt
                  </span>
                  {editable && (
                    <button
                      type="button"
                      onClick={() => handleDelete(doc)}
                      className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700"
                    >
                      Sil
                    </button>
                  )}
                </div>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-[#1F2D5C]">{doc.ad}</h3>
              <p className="mt-2 text-sm font-medium text-slate-500">{doc.ilgiliOperasyon}</p>
              <p className="mt-3 text-sm leading-6 text-slate-600">{doc.aciklama}</p>
              {doc.dosyaOzet && (
                <div className="mt-3 rounded-xl border border-[#D6DEEA] bg-[#F8FAFD] px-3 py-2">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Dosyadan çıkarılan düzenli özet</p>
                  <pre className="whitespace-pre-wrap font-sans text-xs leading-5 text-slate-600">{doc.dosyaOzet}</pre>
                </div>
              )}
              {doc.dosyaLinki && (
                <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
                  Kaynak: {doc.dosyaLinki}
                </p>
              )}
            </article>
          ))}
        </div>
      ) : (
        <SectionCard title="Belge bulunamadı">
          <div className="rounded-2xl border border-dashed border-[#D6DEEA] bg-slate-50 p-6 text-sm text-slate-500">
            Bu kategori için henüz belge kaydı yok. Dosyadan faaliyet çıkarmak için Hızlı Not Girişi sayfasını kullanabilirsiniz.
          </div>
        </SectionCard>
      )}

      {editable && modalOpen && (
        <FormModal
          title="Evrak / Şablon Girişi"
          onClose={closeModal}
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
          {formData.dosyaOzet && (
            <div className="rounded-2xl border border-[#D6DEEA] bg-[#F8FAFD] p-4">
              <p className="mb-2 text-sm font-semibold text-[#1F2D5C]">Dosyadan çıkarılan düzenli özet</p>
              <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap font-sans text-xs leading-5 text-slate-600">
                {formData.dosyaOzet}
              </pre>
            </div>
          )}
          <label className="block space-y-2 text-sm text-slate-600">
            <span>Dosya linki placeholder</span>
            <input name="dosyaLinki" value={formData.dosyaLinki} onChange={handleChange} placeholder="Örn. /sablonlar/final-programi.xlsx" className="w-full rounded-xl border border-[#D6DEEA] px-4 py-3 outline-none" />
          </label>
          <div className="rounded-2xl border border-dashed border-[#D6DEEA] bg-[#F8FAFD] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-[#1F2D5C]">Yerel dosya seç</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Dosya sunucuya yüklenmez. Excel, CSV, TXT, PDF ve DOCX içerikleri açıklama alanına aktarılabilir.
                </p>
              </div>
              <label className="inline-flex cursor-pointer rounded-xl border border-[#D6DEEA] bg-white px-4 py-3 text-sm font-semibold text-[#1F2D5C]">
                Dosya Seç
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv,.txt,.pdf,.doc,.docx"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>
            {selectedFile && (
              <p className="mt-3 rounded-xl bg-white px-3 py-2 text-xs text-slate-600">
                Seçilen dosya: <span className="font-semibold text-[#1F2D5C]">{selectedFile.ad}</span> · {selectedFile.tur} · {selectedFile.boyut}
              </p>
            )}
            {fileNotice && (
              <p className="mt-2 rounded-xl border border-[#D6DEEA] bg-white px-3 py-2 text-xs leading-5 text-slate-600">
                {fileNotice}
              </p>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={closeModal} className="rounded-xl border border-[#D6DEEA] px-4 py-3 text-sm font-medium text-slate-600">
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

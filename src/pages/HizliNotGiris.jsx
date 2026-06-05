import { useMemo, useState } from "react";
import Badge from "../components/Badge";
import FormModal from "../components/FormModal";
import SectionCard from "../components/SectionCard";
import SuccessMessage from "../components/SuccessMessage";
import useStoredCollection from "../hooks/useStoredCollection";
import haftalikLogData from "../data/haftalik-log.json";
import operasyonData from "../data/operasyon-kutuphanesi.json";
import evrakData from "../data/evraklar.json";
import { extractTextFromFile, formatFileSize, getDocumentType, getFileExtension } from "../utils/fileText";
import { splitLines } from "../utils/storage";

const dayFmt = new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short" });
const dateFmt = new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "long", year: "numeric" });

const emptyForm = {
  tarih: new Date().toISOString().slice(0, 10),
  kaynak: "Serbest not",
  hazirlayan: "Öğrenci Dekanlığı",
  icerik: "",
  operasyonIds: [],
};

const categoryRules = [
  {
    key: "sorunlar",
    label: "Sorunlar / Riskler",
    tone: "sorun",
    words: ["sorun", "risk", "kapasite", "gecik", "aksama", "çakış", "eksik", "yetersiz", "iptal", "acil"],
  },
  {
    key: "bekleyenler",
    label: "Bekleyenler",
    tone: "bekliyor",
    words: ["beklen", "bekliyor", "onay", "dönüş", "teyit", "cevap", "netleş", "gelmedi"],
  },
  {
    key: "yapilacaklar",
    label: "Yapılacaklar",
    tone: "devam",
    words: ["yapılacak", "planlan", "iletilecek", "hazırlanacak", "kontrol edilecek", "gönderilecek", "tamamlanacak"],
  },
  {
    key: "yapilanlar",
    label: "Yapılanlar",
    tone: "yapildi",
    words: ["yapıldı", "tamamlandı", "hazırlandı", "iletildi", "gönderildi", "alındı", "toplandı", "güncellendi"],
  },
];

function weekStart(date) {
  const d = new Date(date);
  const day = d.getDay() || 7;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day + 1);
  return d;
}

function getWeekKey(date) {
  return weekStart(date).toISOString().slice(0, 10);
}

function uniqueItems(items) {
  return [...new Set(items.filter(Boolean))];
}

function mergeWeeklyItems(existingItems = [], newItems = []) {
  return uniqueItems([...existingItems, ...newItems]);
}

function splitNoteSentences(value) {
  return splitLines(value)
    .flatMap((line) => line.split(/(?<=[.!?])\s+|;\s+/))
    .map((item) => item.replace(/^[-•*\d.)\s]+/, "").trim())
    .filter(Boolean);
}

function classifySentence(sentence) {
  const normalized = sentence.toLocaleLowerCase("tr-TR");
  return categoryRules.find((rule) => rule.words.some((word) => normalized.includes(word)))?.key || "yapilanlar";
}

function inferOperationIdsFromNote(note, operations) {
  const normalized = note.toLocaleLowerCase("tr-TR");
  return operations
    .filter((operation) => {
      const operationName = operation.ad.toLocaleLowerCase("tr-TR");
      const calendarName = String(operation.ilgiliTakvimOlayi || "").toLocaleLowerCase("tr-TR");
      return operationName.split(/\s+|\/|-/).some((part) => part.length > 4 && normalized.includes(part)) ||
        (calendarName && normalized.includes(calendarName));
    })
    .map((operation) => String(operation.id));
}

function buildPreview(formData, operations) {
  const buckets = { yapilanlar: [], yapilacaklar: [], bekleyenler: [], sorunlar: [] };
  splitNoteSentences(formData.icerik).forEach((sentence) => {
    buckets[classifySentence(sentence)].push(sentence);
  });

  return {
    ...buckets,
    operasyonIds: uniqueItems([...(formData.operasyonIds || []), ...inferOperationIdsFromNote(formData.icerik, operations)]),
  };
}

function HizliNotGiris() {
  const { records: logs, mergeRecord } = useStoredCollection("haftalikLogRecords", haftalikLogData, {
    sortByDateField: "haftaBaslangic",
  });
  const { records: operations } = useStoredCollection("operasyonRecords", operasyonData);
  const { records: notes, addRecord: addNote, deleteRecord: deleteNote } = useStoredCollection("hizliNotRecords", []);
  const { addRecord: addDocument } = useStoredCollection("evrakRecords", evrakData);
  const [formData, setFormData] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [fileNotice, setFileNotice] = useState("");
  const [expandedFile, setExpandedFile] = useState(null); // hangi dosyanın içeriği açık

  const preview = useMemo(() => buildPreview(formData, operations), [formData, operations]);
  const selectedOperations = operations.filter((operation) =>
    (preview.operasyonIds || []).some((id) => String(id) === String(operation.id)),
  );

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleOperationToggle = (operationId) => {
    setFormData((prev) => {
      const ids = prev.operasyonIds || [];
      return {
        ...prev,
        operasyonIds: ids.includes(operationId) ? ids.filter((id) => id !== operationId) : [...ids, operationId],
      };
    });
  };

  const handleFiles = async (event) => {
    const files = Array.from(event.target.files || []);
    setFileNotice("");
    if (files.length === 0) return;

    const nextAttachments = [];

    for (const file of files) {
      const extension = getFileExtension(file.name);
      const extractedText = await extractTextFromFile(file);
      nextAttachments.push({
        id: `file-${Date.now()}-${Math.random().toString(36).slice(2)}-${file.name}`,
        ad: file.name,
        tur: getDocumentType(file.name),
        boyut: formatFileSize(file.size),
        uzanti: extension,
        extractedText: extractedText || "", // ham metin — sadece önizleme için
        metinCikarildi: Boolean(extractedText),
      });
    }

    setAttachedFiles((prev) => [...prev, ...nextAttachments]);
    // NOT ALANINA OTOMATİK METİN DOLDURULMAZ.
    // Kullanıcı "İçeriği Görüntüle" ile okur, gerekli kısmı kendisi yazar.
    setFormData((prev) => ({ ...prev, kaynak: "Dosya" }));
    setFileNotice(`${nextAttachments.length} dosya eklendi. İlgili kısımları not alanına kendiniz yazın.`);
    event.target.value = "";
  };

  const removeAttachment = (attachmentId) => {
    setAttachedFiles((prev) => prev.filter((file) => file.id !== attachmentId));
  };

  const handleDeleteNote = (note) => {
    if (window.confirm("Bu hızlı not kaydı silinsin mi? Haftalık faaliyete işlenmiş maddeler ayrıca haftalık kayıtta kalır.")) {
      deleteNote(note.id);
      setSuccessMessage("Hızlı not kaydı silindi.");
    }
  };

  const saveNote = (event) => {
    event.preventDefault();
    setFormError("");

    if (!formData.tarih || !formData.icerik.trim()) {
      setFormError("Tarih ve not içeriği zorunludur.");
      return;
    }

    const weekStartDate = weekStart(formData.tarih);
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekStartDate.getDate() + 6);
    const haftaLabel = `${dayFmt.format(weekStartDate)} – ${dayFmt.format(weekEndDate)} ${weekStartDate.getFullYear()} Haftası`;
    const incomingRecord = {
      id: `week-${getWeekKey(formData.tarih)}`,
      haftaLabel,
      haftaBaslangic: weekStartDate.toISOString().slice(0, 10),
      haftaBitis: weekEndDate.toISOString().slice(0, 10),
      hazirlayan: formData.hazirlayan || "Öğrenci Dekanlığı",
      operasyonIds: preview.operasyonIds,
      yapilanlar: preview.yapilanlar,
      yapilacaklar: preview.yapilacaklar,
      bekleyenler: preview.bekleyenler,
      sorunlar: preview.sorunlar,
    };
    const noteId = `note-${Date.now()}`;

    mergeRecord(
      incomingRecord,
      (record) => getWeekKey(record.haftaBaslangic),
      (existingRecord, nextRecord) => ({
        ...existingRecord,
        ...nextRecord,
        id: existingRecord.id,
        operasyonIds: uniqueItems([...(existingRecord.operasyonIds || []), ...(nextRecord.operasyonIds || [])]),
        yapilanlar: mergeWeeklyItems(existingRecord.yapilanlar, nextRecord.yapilanlar),
        yapilacaklar: mergeWeeklyItems(existingRecord.yapilacaklar, nextRecord.yapilacaklar),
        bekleyenler: mergeWeeklyItems(existingRecord.bekleyenler, nextRecord.bekleyenler),
        sorunlar: mergeWeeklyItems(existingRecord.sorunlar, nextRecord.sorunlar),
        hazirlayan: nextRecord.hazirlayan || existingRecord.hazirlayan,
      }),
    );

    addNote({
      id: noteId,
      tarih: formData.tarih,
      kaynak: formData.kaynak,
      hazirlayan: formData.hazirlayan,
      icerik: formData.icerik,
      operasyonIds: preview.operasyonIds,
      dosyalar: attachedFiles,
      olusturulma: new Date().toISOString(),
    });

    attachedFiles.forEach((file) => {
      addDocument({
        id: `doc-${Date.now()}-${file.ad}`,
        ad: file.ad,
        tur: file.tur,
        ilgiliOperasyon: selectedOperations.map((operation) => operation.ad).join(", ") || "Hızlı Not Girişi",
        aciklama: `${dateFmt.format(new Date(formData.tarih))} tarihli hızlı nottan eklenen kaynak dosya. Boyut: ${file.boyut}.`,
        dosyaLinki: "Tarayıcı içi kaynak kaydı",
        kaynakNotId: noteId,
      });
    });

    setFormData({ ...emptyForm, tarih: formData.tarih, hazirlayan: formData.hazirlayan });
    setAttachedFiles([]);
    setSuccessMessage("Hızlı not haftalık faaliyet kaydına işlendi.");
  };

  return (
    <div className="space-y-6">
      <SuccessMessage>{successMessage}</SuccessMessage>

      <section className="rounded-2xl border border-[#D6DEEA] bg-gradient-to-r from-[#0E2650] to-[#1F2D5C] px-6 py-5 text-white shadow-md">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">Bilgi yakalama alanı</p>
        <h2 className="mt-1 text-xl font-bold">Hızlı Not Girişi</h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-white/65">
          Mail, WhatsApp, toplantı notu veya telefon görüşmesi gibi dağınık bilgileri buraya yapıştırın.
          Sistem notu haftalık faaliyet panosuna yapılan, yapılacak, bekleyen ve risk başlıklarıyla işler.
        </p>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard title="Ham Not">
          <form onSubmit={saveNote} className="space-y-4">
            {formError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {formError}
              </div>
            )}
            <div className="grid gap-4 md:grid-cols-3">
              <label className="space-y-2 text-sm text-slate-600">
                <span>Tarih</span>
                <input type="date" name="tarih" value={formData.tarih} onChange={handleChange}
                  className="w-full rounded-xl border border-[#D6DEEA] px-4 py-3 outline-none" />
              </label>
              <label className="space-y-2 text-sm text-slate-600">
                <span>Kaynak</span>
                <select name="kaynak" value={formData.kaynak} onChange={handleChange}
                  className="w-full rounded-xl border border-[#D6DEEA] px-4 py-3 outline-none">
                  <option>Serbest not</option>
                  <option>Mail</option>
                  <option>Toplantı</option>
                  <option>Telefon</option>
                  <option>WhatsApp / Mesaj</option>
                  <option>Resmi yazı</option>
                </select>
              </label>
              <label className="space-y-2 text-sm text-slate-600">
                <span>Hazırlayan</span>
                <input name="hazirlayan" value={formData.hazirlayan} onChange={handleChange}
                  className="w-full rounded-xl border border-[#D6DEEA] px-4 py-3 outline-none" />
              </label>
            </div>
            <label className="block space-y-2 text-sm text-slate-600">
              <span>Not içeriği</span>
              <textarea name="icerik" rows="9" value={formData.icerik} onChange={handleChange}
                placeholder="Örn. Final programı için salon talepleri alındı. Mühendislikte kapasite sorunu var. Gözetmen listesi cuma gününe kadar bekleniyor."
                className="w-full rounded-xl border border-[#D6DEEA] px-4 py-3 leading-6 outline-none" />
            </label>
            <div className="rounded-2xl border border-dashed border-[#D6DEEA] bg-[#F8FAFD] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-[#1F2D5C]">Dosyadan bilgi çek</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Excel, CSV, TXT, PDF ve DOCX içerikleri not alanına aktarılır. Eski .doc dosyaları kaynak evrak olarak bağlanır.
                  </p>
                </div>
                <label className="inline-flex cursor-pointer rounded-xl bg-[#00377B] px-4 py-3 text-sm font-semibold text-white">
                  Dosya Seç
                  <input
                    type="file"
                    multiple
                    accept=".xlsx,.xls,.csv,.txt,.pdf,.doc,.docx"
                    onChange={handleFiles}
                    className="hidden"
                  />
                </label>
              </div>
              {fileNotice && (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700">
                  {fileNotice}
                </div>
              )}
              {attachedFiles.length > 0 && (
                <div className="mt-3 space-y-2">
                  {attachedFiles.map((file) => (
                    <div key={file.id} className="rounded-xl border border-[#E5E7EB] bg-white">
                      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-[#1F2D5C]">{file.ad}</p>
                          <p className="mt-0.5 text-xs text-slate-400">{file.tur} · {file.boyut}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {file.metinCikarildi && (
                            <button
                              type="button"
                              onClick={() => setExpandedFile(expandedFile === file.id ? null : file.id)}
                              className="rounded-lg border border-[#D6DEEA] px-2.5 py-1 text-xs font-medium text-[#1F2D5C] hover:border-[#00377B]"
                            >
                              {expandedFile === file.id ? "Gizle" : "İçeriği Görüntüle"}
                            </button>
                          )}
                          <button type="button" onClick={() => removeAttachment(file.id)}
                            className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50">
                            Kaldır
                          </button>
                        </div>
                      </div>
                      {expandedFile === file.id && file.extractedText && (
                        <div className="border-t border-[#E5E7EB] bg-slate-50 px-3 py-3">
                          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                            Dosya içeriği — ilgili kısımları not alanına kopyalayın
                          </p>
                          <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap text-xs leading-5 text-slate-600 font-sans">
                            {file.extractedText}
                          </pre>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-wrap justify-end gap-3">
              <button type="button" onClick={() => setModalOpen(true)}
                className="rounded-xl border border-[#D6DEEA] px-4 py-3 text-sm font-medium text-[#1F2D5C]">
                Operasyon Seç
              </button>
              <button type="submit" className="rounded-xl bg-[#00377B] px-5 py-3 text-sm font-semibold text-white">
                Haftalık Kayda İşle
              </button>
            </div>
          </form>
        </SectionCard>

        <SectionCard title="Otomatik Önizleme">
          <div className="space-y-4">
            <div className="rounded-xl border border-[#D6DEEA] bg-[#F8FAFD] px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">İlgili operasyonlar</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedOperations.length > 0 ? (
                  selectedOperations.map((operation) => <Badge key={operation.id}>{operation.ad}</Badge>)
                ) : (
                  <span className="text-sm text-slate-400">Operasyon bağlantısı bulunamadı. Gerekirse manuel seçin.</span>
                )}
              </div>
            </div>
            {categoryRules.map((rule) => {
              const items = preview[rule.key] || [];
              return (
                <div key={rule.key} className="rounded-xl border border-[#E5E7EB] bg-white p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <Badge tone={rule.tone}>{rule.label}</Badge>
                    <span className="text-xs font-semibold text-slate-400">{items.length}</span>
                  </div>
                  {items.length > 0 ? (
                    <ul className="space-y-2">
                      {items.map((item) => (
                        <li key={item} className="rounded-lg bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-700">
                          {item}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-400">Bu başlık için madde çıkarılmadı.</p>
                  )}
                </div>
              );
            })}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Son Hızlı Notlar">
        {notes.length > 0 ? (
          <div className="space-y-3">
            {notes.slice().reverse().slice(0, 5).map((note) => (
              <article key={note.id} className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-3">
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <Badge tone="bekliyor">{note.kaynak}</Badge>
                  <span>{dateFmt.format(new Date(note.tarih))}</span>
                  <span>{note.hazirlayan}</span>
                  <button
                    type="button"
                    onClick={() => handleDeleteNote(note)}
                    className="ml-auto rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700"
                  >
                    Sil
                  </button>
                </div>
                <p className="line-clamp-2 text-sm leading-6 text-slate-600">{note.icerik}</p>
                {note.dosyalar?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {note.dosyalar.map((file) => (
                      <span key={file.id} className="rounded-full bg-[#EEF3FA] px-2 py-1 text-[11px] font-semibold text-[#00377B]">
                        {file.ad}
                      </span>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[#D6DEEA] bg-slate-50 p-6 text-sm text-slate-500">
            Henüz hızlı not girilmedi.
          </div>
        )}
      </SectionCard>

      {modalOpen && (
        <FormModal
          title="Operasyon Bağlantısı"
          eyebrow="Manuel seçim"
          onClose={() => setModalOpen(false)}
          onSubmit={(event) => {
            event.preventDefault();
            setModalOpen(false);
          }}
        >
          {operations.length > 0 ? (
            <div className="grid gap-2 md:grid-cols-2">
              {operations.map((operation) => {
                const operationId = String(operation.id);
                const checked = (formData.operasyonIds || []).includes(operationId);
                return (
                  <label key={operation.id} className={`flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2 text-xs transition ${
                    checked ? "border-[#00377B] bg-[#EEF3FA] text-[#00377B]" : "border-[#E5E7EB] bg-white text-slate-600"
                  }`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleOperationToggle(operationId)}
                      className="mt-0.5 h-4 w-4"
                    />
                    <span className="font-medium leading-5">{operation.ad}</span>
                  </label>
                );
              })}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-[#D6DEEA] bg-slate-50 p-4 text-sm text-slate-500">
              Henüz operasyon kaydı yok. Önce İş Nasıl Yapılır sayfasından gerçek operasyonları ekleyebilirsiniz.
            </p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="rounded-xl border border-[#D6DEEA] px-4 py-3 text-sm font-medium text-slate-600">
              Kapat
            </button>
            <button type="submit" className="rounded-xl bg-[#00377B] px-4 py-3 text-sm font-medium text-white">
              Seçimi Kullan
            </button>
          </div>
        </FormModal>
      )}
    </div>
  );
}

export default HizliNotGiris;

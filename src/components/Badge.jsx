const tones = {
  yuksek: "bg-red-50 text-red-700 ring-red-200",
  orta: "bg-amber-50 text-amber-700 ring-amber-200",
  dusuk: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  yapildi: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  bekliyor: "bg-slate-100 text-slate-700 ring-slate-200",
  sorun: "bg-red-50 text-red-700 ring-red-200",
  devam: "bg-blue-50 text-blue-700 ring-blue-200",
  kategori: "bg-[#EEF3FF] text-[#00377B] ring-[#D8E3FF]",
};

function Badge({ children, tone = "kategori" }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${tones[tone] || tones.kategori}`}
    >
      {children}
    </span>
  );
}

export default Badge;

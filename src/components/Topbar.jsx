import { canEditData } from "../utils/auth";

function Topbar({ title, onMenuClick }) {
  const editable = canEditData();

  return (
    <header className="sticky top-0 z-20 border-b border-[#E5E7EB] bg-[#F5F7FA]/90 backdrop-blur print:hidden">
      <div className="flex items-center justify-between gap-4 px-4 py-4 md:px-8">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onMenuClick}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#D6DEEA] bg-white text-[#1F2D5C] md:hidden"
          >
            ☰
          </button>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Öğrenci Dekanlığı</p>
            <h2 className="text-xl font-semibold text-[#1F2D5C]">{title}</h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`hidden rounded-xl border px-3 py-2 text-xs font-bold md:inline-flex ${
            editable
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-[#D6DEEA] bg-white text-slate-500"
          }`}>
            {editable ? "Yönetici" : "İzleyici"}
          </span>
          <div className="rounded-xl border border-[#D6DEEA] bg-white px-4 py-2.5 text-sm font-medium text-[#1F2D5C]">
            2026-2027
          </div>
        </div>
      </div>
    </header>
  );
}

export default Topbar;

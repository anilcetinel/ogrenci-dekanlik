function FormModal({ title, eyebrow = "Yeni kayıt", children, onClose, onSubmit, error }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-8">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{eyebrow}</p>
            <h3 className="mt-1 text-2xl font-semibold text-[#1F2D5C]">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#D6DEEA] px-3 py-2 text-sm text-slate-600"
          >
            Kapat
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          {children}
        </form>
      </div>
    </div>
  );
}

export default FormModal;

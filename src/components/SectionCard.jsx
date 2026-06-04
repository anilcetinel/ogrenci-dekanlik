function SectionCard({ title, action, children, className = "" }) {
  return (
    <section
      className={`institutional-shadow rounded-2xl border border-[#E5E7EB] bg-white ${className}`}
    >
      <div className="flex items-center justify-between gap-4 border-b border-[#E5E7EB] px-5 py-4">
        <h2 className="text-base font-semibold text-[#1F2D5C]">{title}</h2>
        {action}
      </div>
      <div className="px-5 py-5">{children}</div>
    </section>
  );
}

export default SectionCard;

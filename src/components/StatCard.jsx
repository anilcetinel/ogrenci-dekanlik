function StatCard({ title, value, detail, accent = "navy" }) {
  const accents = {
    navy: "from-[#00377B] to-[#1F2D5C]",
    green: "from-[#1F4D2C] to-[#2A6A3E]",
    orange: "from-[#F58220] to-[#D66A0A]",
    red: "from-[#B91C1C] to-[#7F1D1D]",
    slate: "from-slate-600 to-slate-700",
  };

  return (
    <div className="institutional-shadow overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white">
      <div className={`h-1.5 bg-gradient-to-r ${accents[accent] || accents.navy}`} />
      <div className="p-5">
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <p className="mt-3 text-3xl font-semibold tracking-tight text-[#1F2D5C]">{value}</p>
        <p className="mt-2 text-sm text-slate-500">{detail}</p>
      </div>
    </div>
  );
}

export default StatCard;

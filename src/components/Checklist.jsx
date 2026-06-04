function Checklist({ items }) {
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li
          key={item}
          className="flex items-start gap-3 rounded-lg border border-[#E5E7EB] bg-slate-50 px-4 py-3"
        >
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-[#9CA3AF] bg-white" />
          <span className="text-sm leading-6 text-slate-700">{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default Checklist;

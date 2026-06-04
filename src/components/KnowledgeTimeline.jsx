function KnowledgeTimeline({ items, renderContent }) {
  return (
    <div className="relative space-y-5 before:absolute before:left-4 before:top-2 before:h-[calc(100%-1rem)] before:w-px before:bg-[#D6DEEA]">
      {items.map((item) => (
        <div key={item.yil || item.donem} className="relative flex gap-4">
          <div className="z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#00377B] text-[10px] font-semibold text-white">
            {(item.yil || item.donem).slice(0, 4)}
          </div>
          <div className="min-w-0 flex-1 rounded-lg border border-[#E5E7EB] bg-white p-4">
            {renderContent(item)}
          </div>
        </div>
      ))}
    </div>
  );
}

export default KnowledgeTimeline;

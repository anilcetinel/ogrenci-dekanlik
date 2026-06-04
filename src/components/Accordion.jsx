import { useState } from "react";

function Accordion({ items }) {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <div className="space-y-3">
      {items.map((item, index) => {
        const isOpen = openIndex === index;

        return (
          <div key={item.problem} className="overflow-hidden rounded-lg border border-[#E5E7EB] bg-white">
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? -1 : index)}
              className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left"
            >
              <span className="text-sm font-semibold text-[#1F2D5C]">{item.problem}</span>
              <span className="text-lg leading-none text-[#00377B]">{isOpen ? "−" : "+"}</span>
            </button>
            {isOpen && (
              <div className="border-t border-[#E5E7EB] bg-slate-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#1F4D2C]">
                  Çözüm
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-700">{item.cozum}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default Accordion;

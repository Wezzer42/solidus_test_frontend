const steps = [
  { label: "FLOW", detail: "in circulation" },
  { label: "Activity", detail: "transfers and fees" },
  { label: "PRIME", detail: "earned" },
  { label: "Reserve power", detail: "accumulated" },
  { label: "Redemption", detail: "PRIME burned, FLOW released" },
];

export function EconomicCycleDiagram() {
  return (
    <div
      className="my-6 rounded-2xl border border-[#cddcff] bg-[#eaf0ff] p-5"
      aria-label="Economic cycle: FLOW to activity to PRIME to reserve power to redemption back to FLOW"
    >
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#0052ff]">Economic cycle</p>
      <ol className="mt-4 space-y-0">
        {steps.map((step, index) => (
          <li key={step.label} className="flex flex-col items-center">
            <div className="w-full max-w-xs rounded-xl border border-[#9cb8ff] bg-white px-4 py-3 text-center">
              <p className="font-display text-sm font-black tracking-[-0.04em] text-[#0b1736]">{step.label}</p>
              <p className="mt-1 text-xs font-semibold text-[#496ab3]">{step.detail}</p>
            </div>
            {index < steps.length - 1 && (
              <span className="my-1 text-lg font-black text-[#0052ff]" aria-hidden>
                ↓
              </span>
            )}
          </li>
        ))}
        <li className="flex flex-col items-center">
          <span className="my-1 text-lg font-black text-[#0052ff]" aria-hidden>
            ↓
          </span>
          <div className="w-full max-w-xs rounded-xl border-2 border-[#0052ff] bg-[#0052ff] px-4 py-3 text-center text-white">
            <p className="font-display text-sm font-black tracking-[-0.04em]">FLOW</p>
            <p className="mt-1 text-xs font-semibold text-[#d6e2ff]">returns to circulation</p>
          </div>
        </li>
      </ol>
    </div>
  );
}

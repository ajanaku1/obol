/** The x402 vendor market — the stalls Obol shops. */
interface Vendor {
  id: string;
  name: string;
  description: string;
  priceBaseUnits: string;
}

const price = (baseUnits: string): string => `$${(Number(baseUnits) / 1_000_000).toFixed(3)}`;

export function Market({ vendors }: { vendors: Vendor[] }) {
  if (vendors.length === 0) return null;
  return (
    <div className="card p-5 sm:p-6">
      <div className="flex items-baseline justify-between">
        <span className="label">The market</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-bronzeDim">
          {vendors.length} stalls open
        </span>
      </div>
      <ul className="mt-4 space-y-px">
        {vendors.map((vendor) => (
          <li
            key={vendor.id}
            className="group flex items-baseline justify-between gap-4 rounded
              px-2 py-2.5 -mx-2 transition-colors hover:bg-stone2"
          >
            <div className="flex min-w-0 items-baseline gap-3">
              <span className="text-bronzeDim transition-colors group-hover:text-bronze">
                ◇
              </span>
              <div className="min-w-0">
                <span className="font-display text-base text-parchment">{vendor.name}</span>
                <p className="truncate text-sm text-muted">{vendor.description}</p>
              </div>
            </div>
            <span className="shrink-0 font-mono text-sm tabular-nums text-bronze">
              {price(vendor.priceBaseUnits)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

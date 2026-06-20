import { WATCHES } from '../config/watches';
import { useARStore } from '../store/useARStore';

/** Luxury horizontal watch carousel pinned to the bottom of the screen. */
export function WatchSelector() {
  const selectedWatchId = useARStore((s) => s.selectedWatchId);
  const selectWatch = useARStore((s) => s.selectWatch);
  const modelLoading = useARStore((s) => s.modelLoading);

  const active = WATCHES.find((w) => w.id === selectedWatchId) ?? WATCHES[0];

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex flex-col items-center pb-6">
      {/* Active watch label */}
      <div className="mb-3 text-center animate-fade-in">
        <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-white/50">
          {active.brand}
        </p>
        <p className="text-lg font-semibold tracking-wide text-white">{active.name}</p>
        {active.credit && (
          <p className="mt-0.5 text-[9px] tracking-wide text-white/30">{active.credit}</p>
        )}
      </div>

      {/* Carousel */}
      <div className="no-scrollbar pointer-events-auto flex max-w-full gap-3 overflow-x-auto px-5 py-2">
        {WATCHES.map((w) => {
          const isActive = w.id === selectedWatchId;
          return (
            <button
              key={w.id}
              onClick={() => !isActive && selectWatch(w.id)}
              className={`relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl transition-all duration-300 ${
                isActive
                  ? 'scale-110 ring-2 ring-gold'
                  : 'opacity-70 ring-1 ring-white/10 hover:opacity-100'
              } glass`}
              aria-label={`${w.brand} ${w.name}`}
            >
              <span
                className="h-9 w-9 rounded-full border-2"
                style={{
                  background: `radial-gradient(circle at 30% 30%, ${w.metal}, ${w.dial} 75%)`,
                  borderColor: w.accent,
                }}
              />
              {isActive && modelLoading && (
                <span className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/40">
                  <span className="h-4 w-4 rounded-full border-2 border-t-gold border-white/20 animate-spinslow" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

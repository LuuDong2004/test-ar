interface LoadingScreenProps {
  label?: string;
}

/** Elegant full-screen loader used while the tracking model / GLB initialises. */
export function LoadingScreen({ label = 'Preparing AR experience' }: LoadingScreenProps) {
  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black animate-fade-in">
      <div className="relative h-16 w-16">
        <div className="absolute inset-0 rounded-full border-2 border-white/10" />
        <div className="absolute inset-0 rounded-full border-2 border-t-gold border-r-gold/40 border-b-transparent border-l-transparent animate-spinslow" />
      </div>
      <p className="mt-6 text-sm font-light tracking-[0.25em] uppercase text-shimmer animate-shimmer">
        {label}
      </p>
    </div>
  );
}

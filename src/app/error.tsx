'use client';

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 pt-24 text-center">
      <p className="text-meta uppercase tracking-[0.18em] text-layali-gold-light mb-4">Something went wrong</p>
      <h1 className="font-serif text-heading-lg text-white mb-3">Please try again</h1>
      <p className="text-body text-white/55 mb-8 max-w-md">
        We could not load this page right now. Your cart and checkout were not changed.
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="inline-flex min-h-11 items-center rounded-full bg-layali-pink-glow px-6 text-sm uppercase tracking-[0.12em] text-white"
      >
        Try again
      </button>
    </div>
  );
}

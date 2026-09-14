import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 pt-24 text-center">
      <p className="text-meta uppercase tracking-[0.18em] text-layali-gold-light mb-4">404</p>
      <h1 className="font-serif text-heading-lg text-white mb-3">Page not found</h1>
      <p className="text-body text-white/55 mb-8 max-w-md">
        This page is not in the Layali collection. Continue to the shop or return home.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-4">
        <Link
          href="/shop"
          className="inline-flex min-h-11 items-center rounded-full bg-layali-pink-glow px-6 text-sm uppercase tracking-[0.12em] text-white"
        >
          Shop the Collection
        </Link>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center text-sm uppercase tracking-[0.12em] text-white/70 hover:text-white"
        >
          Home
        </Link>
      </div>
    </div>
  );
}

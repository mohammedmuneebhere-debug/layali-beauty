import type { Metadata } from 'next';
import { Cormorant_Garamond, Outfit, Great_Vibes, Noto_Sans_Arabic } from 'next/font/google';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { StageBackdrop } from '@/components/layout/StageBackdrop';
import { LanguageProvider } from '@/lib/i18n/LanguageProvider';
import { SITE_URL } from '@/lib/constants';
import './globals.css';

const cormorant = Cormorant_Garamond({
  variable: '--font-cormorant',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
});

const outfit = Outfit({
  variable: '--font-outfit',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
});

const greatVibes = Great_Vibes({
  variable: '--font-great-vibes',
  subsets: ['latin'],
  weight: '400',
  display: 'swap',
});

const notoArabic = Noto_Sans_Arabic({
  variable: '--font-arabic',
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Layali | Authentic Korean Skincare',
  description:
    'Your trusted destination for authentic Korean skincare in Saudi Arabia.',
  keywords: [
    'korean skincare',
    'k-beauty',
    'COSRX',
    'Isntree',
    'Torriden',
    'TOCOBO',
    'layali',
    'saudi arabia',
    'skincare',
  ],
  openGraph: {
    title: 'Layali | Authentic Korean Skincare',
    description:
      'Your trusted destination for authentic Korean skincare in Saudi Arabia.',
    url: SITE_URL,
    siteName: 'Layali',
    type: 'website',
    locale: 'en_US',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Layali — Beauty Redefined',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Layali | Authentic Korean Skincare',
    description:
      'Your trusted destination for authentic Korean skincare in Saudi Arabia.',
    images: ['/og-image.jpg'],
  },
  icons: {
    icon: [{ url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' }],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${cormorant.variable} ${outfit.variable} ${greatVibes.variable} ${notoArabic.variable} h-full`}
      style={{ colorScheme: 'dark', background: '#000000' }}
      suppressHydrationWarning
    >
      <body className="film-grain min-h-full flex flex-col antialiased bg-transparent text-white">
        <LanguageProvider>
          <StageBackdrop />
          <div className="relative z-10 flex min-h-full flex-1 flex-col">
            <Navbar />
            <main className="flex-1 bg-transparent">{children}</main>
            <Footer />
          </div>
        </LanguageProvider>
      </body>
    </html>
  );
}

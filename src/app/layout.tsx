import type { Metadata } from 'next';
import { Manrope, IBM_Plex_Sans_Arabic } from 'next/font/google';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { StageBackdrop } from '@/components/layout/StageBackdrop';
import { CartHydrator } from '@/components/cart/CartHydrator';
import { LanguageProvider } from '@/lib/i18n/LanguageProvider';
import { SITE_URL } from '@/lib/constants';
import './globals.css';

const manrope = Manrope({
  variable: '--font-manrope',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

const ibmPlexArabic = IBM_Plex_Sans_Arabic({
  variable: '--font-arabic',
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Layali | Beauty & Lifestyle',
  description:
    'Layali is a premium beauty, self-care and lifestyle destination for women across Saudi Arabia and the Gulf — makeup, skincare, haircare, fragrance, and more.',
  keywords: [
    'beauty & lifestyle',
    'beauty store',
    'self-care',
    'makeup',
    'skincare',
    'korean beauty',
    'k-beauty',
    'haircare',
    'fragrance',
    'body care',
    'layali',
    'saudi arabia',
    'gulf beauty',
  ],
  openGraph: {
    title: 'Layali | Beauty & Lifestyle',
    description:
      'A premium beauty, self-care and lifestyle destination — curated essentials for women who glow with confidence.',
    url: SITE_URL,
    siteName: 'Layali',
    type: 'website',
    locale: 'en_US',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Layali — Beauty & Lifestyle',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Layali | Beauty & Lifestyle',
    description:
      'A premium beauty, self-care and lifestyle destination — curated essentials for women who glow with confidence.',
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
      className={`${manrope.variable} ${ibmPlexArabic.variable} h-full`}
      style={{ colorScheme: 'dark', background: '#000000' }}
      suppressHydrationWarning
    >
      <body className="film-grain min-h-full flex flex-col antialiased bg-transparent text-white">
        <LanguageProvider>
          <StageBackdrop />
          <div className="relative z-10 flex min-h-full flex-1 flex-col">
            <CartHydrator />
            <Navbar />
            <main className="flex-1 bg-transparent">{children}</main>
            <Footer />
          </div>
        </LanguageProvider>
      </body>
    </html>
  );
}

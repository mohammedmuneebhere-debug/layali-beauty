import type { Metadata } from 'next';
import { Manrope, IBM_Plex_Sans_Arabic } from 'next/font/google';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { StageBackdrop } from '@/components/layout/StageBackdrop';
import { CartHydrator } from '@/components/cart/CartHydrator';
import { LanguageProvider } from '@/lib/i18n/LanguageProvider';
import { SITE_URL } from '@/lib/constants';
import {
  HOME_DESCRIPTION,
  HOME_OG_DESCRIPTION,
  HOME_TITLE,
  OG_IMAGE_PATH,
} from '@/lib/seo';
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

/**
 * Site-wide defaults. Page-level metadata (/, /about, …) must set its own
 * title, description, canonical, and openGraph.url — do not put a homepage
 * canonical here or every route would inherit it.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: HOME_TITLE,
    template: '%s | Layali',
  },
  description: HOME_DESCRIPTION,
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
    siteName: 'Layali',
    type: 'website',
    locale: 'en_US',
    images: [
      {
        url: OG_IMAGE_PATH,
        width: 1200,
        height: 630,
        alt: 'Layali — Beauty & Lifestyle',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: HOME_TITLE,
    description: HOME_OG_DESCRIPTION,
    images: [OG_IMAGE_PATH],
  },
  icons: {
    icon: [{ url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' }],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  robots: {
    index: true,
    follow: true,
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

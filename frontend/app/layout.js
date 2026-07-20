import { Playfair_Display, Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import Providers from '../components/Providers';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import InstallPrompt from '../components/InstallPrompt';

const display = Playfair_Display({
  subsets: ['latin'],
  weight: ['600', '700', '800', '900'],
  variable: '--font-display',
});

const body = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
});

const siteUrl = 'https://www.opinionplus.online';
const siteTitle = 'OPINIONPLUS — Every voice, a masthead';
const siteDescription =
  'A platform to tell your story, with your name and logo at the top, and the tools to build an audience around your truth.';

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteTitle,
    template: '%s — OPINIONPLUS',
  },
  description: siteDescription,
  alternates: {
    canonical: siteUrl,
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'OPINIONPLUS',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    url: siteUrl,
    siteName: 'OPINIONPLUS',
    type: 'website',
    locale: 'en_US',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: siteTitle,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: siteTitle,
    description: siteDescription,
    images: ['/og-image.png'],
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: '#111111',
};

export default function RootLayout({ children }) {
  const websiteSchema = {
    '@type': 'WebSite',
    '@id': `${siteUrl}#website`,
    url: siteUrl,
    name: 'OPINIONPLUS',
    description: siteDescription,
    publisher: { '@id': `${siteUrl}#publisher` },
  };

  const orgSchema = {
    '@type': 'NewsMediaOrganization',
    '@id': `${siteUrl}#publisher`,
    name: 'OPINIONPLUS',
    url: siteUrl,
    logo: {
      '@type': 'ImageObject',
      url: `${siteUrl}/android-chrome-512x512.png`,
      width: 512,
      height: 512,
    },
    sameAs: [],
    ethicalPolicy: `${siteUrl}/about`,
    diversityPolicy: `${siteUrl}/about`,
  };

  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <head>
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="author" content="OPINIONPLUS" />
        <meta name="application-name" content="OpinionPlus" />
        <meta name="theme-color" content="#111111" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://generativelanguage.googleapis.com" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify([websiteSchema, orgSchema]) }}
        />
        {/* Service Worker Auto-Registration Script for Android/PWA */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').catch(function(err) {
                    console.log('ServiceWorker registration failed: ', err);
                  });
                });
              }
            `,
          }}
        />
      </head>
      <body className="font-body bg-paper text-ink min-h-screen flex flex-col antialiased selection:bg-signal selection:text-white">
        <Providers>
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
          <InstallPrompt />
        </Providers>
      </body>
    </html>
  );
}
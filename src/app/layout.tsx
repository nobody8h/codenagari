import type { Metadata } from "next";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import EmailNotice from "@/components/EmailNotice";
import CaptureMode from "@/components/CaptureMode";
import PostHogIdentify from "@/components/PostHogIdentify";
import { CodeNagariOverlay } from "@/components/CodeNagariOverlay";
import "./globals.css";

const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL ??
  (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "https://codenagari.in");

const SITE_TITLE =
  "CodeNagari — Your GitHub as a 3D Skyscraper in India's Campus & Tech Skyline";
const SITE_DESCRIPTION =
  "Explore Indian engineering campuses (IITs, NITs, BITS, VIT, SRM, DTU) and tech corridors (Bengaluru, Hyderabad, Pune, Gurugram, Chennai) in a live 3D developer metropolis. Compete in Weekly 1v1 Campus Skyline Wars, compare 1v1 stats, and upgrade your tower via 0%-fee UPI.";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  keywords: [
    "codenagari",
    "github",
    "3d city",
    "indian engineering campuses",
    "campus skyline wars",
    "bengaluru tech hub",
    "open to sde",
    "pixel art",
    "open source",
    "git visualization",
  ],
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: "https://codenagari.in",
    siteName: "CodeNagari",
    type: "website",
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    creator: "@samuelrizzondev",
    site: "@samuelrizzondev",
  },
  authors: [{ name: "Samuel Rizzon", url: "https://x.com/samuelrizzondev" }],
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-icon.png",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "CodeNagari",
  description: SITE_DESCRIPTION,
  url: BASE_URL,
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Web",
  author: {
    "@type": "Person",
    name: "Samuel Rizzon",
    url: "https://x.com/samuelrizzondev",
  },
  offers: {
    "@type": "Offer",
    price: "29",
    priceCurrency: "INR",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Silkscreen&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-bg font-pixel text-warm" suppressHydrationWarning>
        {children}
        <CodeNagariOverlay />
        <EmailNotice />
        <CaptureMode />
        <PostHogIdentify />
        <Analytics />
        <SpeedInsights />
        {process.env.NEXT_PUBLIC_HIMETRICA_API_KEY && (
          <>
            <Script
              src="https://cdn.himetrica.com/tracker.js"
              data-api-key={process.env.NEXT_PUBLIC_HIMETRICA_API_KEY}
              strategy="afterInteractive"
            />
            <Script
              src="https://cdn.himetrica.com/vitals.js"
              data-api-key={process.env.NEXT_PUBLIC_HIMETRICA_API_KEY}
              strategy="afterInteractive"
            />
            <Script
              src="https://cdn.himetrica.com/errors.js"
              data-api-key={process.env.NEXT_PUBLIC_HIMETRICA_API_KEY}
              strategy="afterInteractive"
            />
          </>
        )}
      </body>
    </html>
  );
}

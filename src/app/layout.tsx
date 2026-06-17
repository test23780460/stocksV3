import type { Metadata, Viewport } from "next";
import "../styles.css";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://stocks-v111.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Market Signal Deck | Stocks V3",
    template: "%s | Market Signal Deck"
  },
  description:
    "A premium Robinhood-inspired stock, crypto, ETF, index, news, screener, prediction, watchlist, and alert research dashboard.",
  applicationName: "Market Signal Deck",
  keywords: [
    "stock market research",
    "market dashboard",
    "stock screener",
    "crypto research",
    "watchlists",
    "market news",
    "predictions"
  ],
  authors: [{ name: "Stocks V3" }],
  creator: "Stocks V3",
  publisher: "Stocks V3",
  alternates: {
    canonical: "/"
  },
  openGraph: {
    title: "Market Signal Deck | Stocks V3",
    description:
      "A Vercel-ready market research command center with transparent Demo Mode fallbacks and serverless data routes.",
    url: siteUrl,
    siteName: "Market Signal Deck",
    images: [{ url: "/og.svg", width: 1200, height: 630, alt: "Market Signal Deck dashboard preview" }],
    locale: "en_US",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "Market Signal Deck | Stocks V3",
    description:
      "Research stocks, crypto, ETFs, indexes, market news, alerts, watchlists, and predictions in one dashboard.",
    images: ["/og.svg"]
  },
  robots: {
    index: true,
    follow: true
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#061019"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

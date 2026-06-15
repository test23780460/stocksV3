import App from "../App";

const structuredData = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Market Signal Deck",
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD"
  },
  description:
    "Educational stock market research dashboard with Demo Mode, charts, screeners, news, predictions, watchlists, alerts, and Vercel serverless APIs."
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <noscript>
        <section className="noscript-panel">
          <h1>Market Signal Deck</h1>
          <p>
            Enable JavaScript to use the full research dashboard. The platform includes Demo Mode market data,
            charts, screeners, market news, predictions, watchlists, alerts, glossary, and system status pages.
          </p>
          <p>Educational market research only. Nothing here is financial advice.</p>
        </section>
      </noscript>
      <App />
    </>
  );
}

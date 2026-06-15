import Link from "next/link";

export default function NotFound() {
  return (
    <main className="not-found-shell">
      <section className="panel">
        <span className="eyebrow">404</span>
        <h1>Page not found</h1>
        <p>The research dashboard is still available from the main command center.</p>
        <Link className="primary-button" href="/">
          Return to dashboard
        </Link>
      </section>
    </main>
  );
}

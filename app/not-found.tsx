import Link from "next/link";
import { SiteHeader, SiteFooter } from "@/components/site-shell";
export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="container section">
        <div className="state-card">
          <span className="state-symbol">⌕</span>
          <h1>This page took a little detour.</h1>
          <p>Let’s get you back to finding your kind of learning.</p>
          <Link className="button primary-button" href="/search">
            Explore tuition →
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

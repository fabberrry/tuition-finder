import Link from "next/link";
import { Brand } from "./brand";
export { Brand } from "./brand";
export { SiteHeader } from "./site-header";

export function SiteFooter() {
  return (
    <footer className="site-footer container">
      <div>
        <Brand />
        <p>A little guidance. A brighter tomorrow.</p>
      </div>
      <nav aria-label="Footer navigation">
        <Link prefetch={false} href="/search">
          Find tuition
        </Link>
        <Link prefetch={false} href="/#how-it-works">
          How it works
        </Link>
        <Link prefetch={false} href="/my-learning">
          My learning
        </Link>
      </nav>
      <span className="copyright">
        © {new Date().getFullYear()} TuitionLens
      </span>
    </footer>
  );
}

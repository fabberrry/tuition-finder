"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/client-api";
import { Brand } from "./brand";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<{ full_name: string } | null>(null);
  const pathname = usePathname();
  useEffect(() => {
    const controller = new AbortController();
    api<{ full_name: string }>("/auth/me", { signal: controller.signal })
      .then(setUser)
      .catch(() => {});
    return () => controller.abort();
  }, [pathname]);
  return (
    <header className="site-header">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <div className="container header-inner">
        <Brand />
        <nav className="desktop-nav" aria-label="Main navigation">
          <Link
            href="/search"
            aria-current={pathname === "/search" ? "page" : undefined}
          >
            Find tuition
          </Link>
          <Link href="/#subjects">Explore subjects</Link>
          <Link href="/#how-it-works">How it works</Link>
        </nav>
        <div className="header-actions">
          <Link className="login-link" href={user ? "/my-learning" : "/login"}>
            {user ? "My learning" : "Log in"}
          </Link>
          <Link
            className="button primary-button header-cta"
            href={user ? "/search" : "/register"}
          >
            {user ? "Find tuition" : "Get started"}
            <span aria-hidden="true">↗</span>
          </Link>
          <button
            className="menu-button"
            aria-label={open ? "Close navigation" : "Open navigation"}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen(!open)}
          >
            {open ? "×" : "☰"}
          </button>
        </div>
      </div>
      {open && (
        <nav
          className="mobile-nav"
          id="mobile-menu"
          aria-label="Mobile navigation"
          onClick={() => setOpen(false)}
        >
          <Link href="/search">Find tuition</Link>
          <Link href="/#subjects">Explore subjects</Link>
          <Link href="/#how-it-works">How it works</Link>
          <Link href={user ? "/my-learning" : "/login"}>
            {user ? "My learning" : "Log in"}
          </Link>
        </nav>
      )}
    </header>
  );
}

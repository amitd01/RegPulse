"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RegPulseLogo } from "@/components/auth/RegPulseLogo";

const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how", label: "How it Works" },
  { href: "#circulars", label: "Circulars" },
  { href: "#testimonials", label: "Testimonials" },
];

export function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('a[href^="#"]');
      if (!target || !(target instanceof HTMLAnchorElement)) return;
      const id = target.getAttribute("href");
      if (!id || id === "#") return;
      const el = document.querySelector(id);
      if (el) {
        e.preventDefault();
        el.scrollIntoView({ behavior: "smooth" });
      }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  return (
    <nav className={`landing-navbar${scrolled ? " scrolled" : ""}`} id="navbar">
      <RegPulseLogo href="/" size="sm" />
      <div className="landing-nav-links">
        {NAV_LINKS.map((link) => (
          <a key={link.href} className="landing-nav-link" href={link.href}>
            {link.label}
          </a>
        ))}
      </div>
      <div className="landing-nav-right">
        <Link href="/login" className="landing-btn-ghost">
          Sign in
        </Link>
        <Link href="/register" className="landing-btn-primary">
          Get Started
        </Link>
      </div>
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/proposals", label: "Proposals" },
  { href: "/vote", label: "My Votes" },
  { href: "/profile", label: "Profile" },
  { href: "/manifesto", label: "Manifesto" },
  { href: "/about", label: "About" },
];

export function Header() {
  const pathname = usePathname();

  return (
    <header className="border-b border-zinc-800 bg-zinc-950">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="text-xl font-bold text-white">
          SK<span className="text-emerald-400">Architect</span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {nav.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "text-sm transition-colors hover:text-white",
                pathname === href || pathname.startsWith(href + "/")
                  ? "text-emerald-400"
                  : "text-zinc-400"
              )}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div id="auth-slot" />
      </div>
    </header>
  );
}

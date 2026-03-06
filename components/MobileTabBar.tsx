"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { icon: "🏠", label: "홈", href: "/" },
  { icon: "💰", label: "돈벌기", href: "/earn" },
  { icon: "💬", label: "채팅", href: "/chat", dot: true },
  { icon: "❤️", label: "즐겨찾기", href: "/favorites" },
  { icon: "👤", label: "MY", href: "/profile" },
];

export default function MobileTabBar() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-mint/10 flex z-50 pb-safe">
      {TABS.map((tab) => (
        <Link
          key={tab.label}
          href={tab.href}
          className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold transition-colors relative ${
            isActive(tab.href) ? "text-mint-dark" : "text-brand-light"
          }`}
        >
          <span className="text-xl">{tab.icon}</span>
          {tab.label}
          {tab.dot && (
            <span className="absolute top-1.5 right-[calc(50%-10px)] w-1.5 h-1.5 bg-coral rounded-full border border-white" />
          )}
        </Link>
      ))}
    </nav>
  );
}

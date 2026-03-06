"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const NAV_ITEMS = [
  { icon: "🏠", label: "홈", badge: null, href: "/" },
  { icon: "📋", label: "내가 올린 부탁", badge: null, href: "/my-tasks" },
  { icon: "✅", label: "내가 한 일", badge: null, href: "/my-tasks/done" },
  { icon: "💬", label: "채팅", badge: null, href: "/chat" },
];

const NAV_ITEMS2 = [
  { icon: "📍", label: "내 동네 설정", href: "/location" },
];

const NAV_ITEMS3 = [
  { icon: "👤", label: "프로필", href: "/profile" },
  { icon: "⚙️", label: "설정", href: "/settings" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [user, setUser] = useState<{ name: string; rating: number; completed_count: number } | null>(null);

  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("name, rating, completed_count")
        .eq("id", authUser.id)
        .single();
      if (profile) setUser(profile);
    };
    init();
  }, []);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const linkClass = (href: string) =>
    `w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium mb-0.5 transition-all ${
      isActive(href)
        ? "bg-gradient-to-r from-mint/12 to-sky/8 text-mint-dark font-bold"
        : "text-brand-sub hover:bg-bg-2 hover:text-brand-text"
    }`;

  return (
    <aside className="fixed left-0 top-0 w-[260px] min-h-screen bg-white border-r border-mint/10 flex flex-col py-7 z-50">
      {/* Logo */}
      <Link href="/" className="px-6 pb-8 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-mint to-sky flex items-center justify-center text-xl">
          🙏
        </div>
        <span className="text-[22px] font-black tracking-tight">
          부탁<span className="text-mint">해</span>
        </span>
      </Link>

      {/* Nav */}
      <nav className="flex-1 px-3">
        <p className="text-[10px] font-bold text-brand-light tracking-[1.5px] uppercase px-3 mb-1.5">
          메뉴
        </p>
        {NAV_ITEMS.map((item) => (
          <Link key={item.label} href={item.href} className={linkClass(item.href)}>
            <span className="text-lg w-6 text-center">{item.icon}</span>
            <span className="flex-1 text-left">{item.label}</span>
            {item.badge && (
              <span className="bg-coral text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {item.badge}
              </span>
            )}
          </Link>
        ))}

        <p className="text-[10px] font-bold text-brand-light tracking-[1.5px] uppercase px-3 mb-1.5 mt-4">
          동네
        </p>
        {NAV_ITEMS2.map((item) => (
          <Link key={item.label} href={item.href} className={linkClass(item.href)}>
            <span className="text-lg w-6 text-center">{item.icon}</span>
            {item.label}
          </Link>
        ))}

        <p className="text-[10px] font-bold text-brand-light tracking-[1.5px] uppercase px-3 mb-1.5 mt-4">
          MY
        </p>
        {NAV_ITEMS3.map((item) => (
          <Link key={item.label} href={item.href} className={linkClass(item.href)}>
            <span className="text-lg w-6 text-center">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      {/* User */}
      <div className="px-6 pt-4 border-t border-mint/10 mt-auto">
        <Link href="/profile" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-mint to-sky flex items-center justify-center text-white text-sm font-bold">
            {user?.name?.[0] ?? "?"}
          </div>
          <div>
            <p className="text-sm font-bold">{user?.name ?? "로딩중..."}님</p>
            <p className="text-xs text-brand-light">
              ⭐ {user?.rating?.toFixed(1) ?? "5.0"} · {user?.completed_count ?? 0}회 완료
            </p>
          </div>
        </Link>
      </div>
    </aside>
  );
}

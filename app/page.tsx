"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import MobileTabBar from "@/components/MobileTabBar";
import TaskCard from "@/components/TaskCard";
import { CATEGORIES } from "@/lib/data";
import { createClient } from "@/lib/supabase/client";
import { Task, TaskCategory } from "@/types";
import NotificationBell from "@/components/NotificationBell";

function toDisplayTask(t: any): Task {
  return {
    id: t.id,
    title: t.title,
    description: t.description ?? "",
    price: t.price,
    category: t.category,
    location: t.location,
    distance_km: 0,
    is_urgent: t.is_urgent,
    created_at: t.created_at,
    status: t.status,
    requester_id: t.requester_id,
    requester_name: t.requester?.name ?? "익명",
    requester_rating: t.requester?.rating ?? 5.0,
  };
}

export default function HomePage() {
  const [selectedCategory, setSelectedCategory] = useState<string>("전체");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<string>("수원시 영통구");

  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("location")
          .eq("id", user.id)
          .single();
        if (profile?.location) setUserLocation(profile.location);
      }

      const { data } = await supabase
        .from("tasks")
        .select("*, requester:profiles!requester_id(*)")
        .eq("status", "open")
        .order("created_at", { ascending: false });

      if (data) setTasks(data.map(toDisplayTask));
      setLoading(false);
    };
    init();
  }, []);

  const filtered =
    selectedCategory === "전체"
      ? tasks
      : tasks.filter((t) => t.category === (selectedCategory as TaskCategory));

  const LoadingSkeleton = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-white rounded-[18px] p-5 border border-mint/10 animate-pulse">
          <div className="h-4 bg-bg-2 rounded w-16 mb-3" />
          <div className="h-5 bg-bg-2 rounded w-3/4 mb-2" />
          <div className="h-4 bg-bg-2 rounded w-full mb-4" />
          <div className="h-3 bg-bg-2 rounded w-1/3" />
        </div>
      ))}
    </div>
  );

  return (
    <>
      {/* PC LAYOUT */}
      <div className="hidden md:flex min-h-screen">
        <Sidebar />
        <main className="ml-[260px] flex-1">
          <header className="sticky top-0 z-40 flex items-center justify-between px-8 py-4 bg-bg/90 backdrop-blur-xl border-b border-mint/10">
            <Link href="/location" className="flex items-center gap-1.5 bg-white border border-mint/25 rounded-full px-3.5 py-1.5 text-sm font-semibold hover:border-mint transition-colors">
              📍 {userLocation} ▾
            </Link>
            <div className="flex items-center gap-2.5">
              <button className="w-9 h-9 rounded-full bg-white border border-mint/15 flex items-center justify-center text-base hover:border-mint hover:scale-105 transition-all">
                🔍
              </button>
              <NotificationBell />
              <Link href="/create" className="bg-gradient-to-r from-coral to-coral-dark text-white px-5 py-2 rounded-full text-sm font-bold shadow-coral hover:-translate-y-px hover:shadow-lg transition-all">
                ✏️ 부탁 올리기
              </Link>
            </div>
          </header>

          <div className="p-8">
            {/* Hero */}
            <div className="relative bg-gradient-to-r from-mint via-sky to-[#0096C7] rounded-3xl p-9 text-white overflow-hidden mb-7">
              <div className="absolute -top-10 -right-10 w-52 h-52 rounded-full bg-white/10" />
              <div className="absolute -bottom-14 right-20 w-40 h-40 rounded-full bg-white/7" />
              <p className="text-sm font-medium opacity-85 mb-2">🌟 오늘 내 주변 부탁 {tasks.length}건</p>
              <h1 className="text-3xl font-black leading-snug mb-5">
                작은 부탁도<br />
                <span className="text-yellow-300">큰 도움</span>이 됩니다
              </h1>
              <Link href="/create" className="inline-flex items-center gap-2 bg-white text-mint-dark font-bold text-sm px-5 py-2.5 rounded-full hover:-translate-y-0.5 hover:shadow-xl transition-all">
                지금 부탁 올리기 →
              </Link>
              <span className="absolute right-10 top-1/2 -translate-y-1/2 text-[90px] opacity-90">
                🙏
              </span>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              {[
                { icon: "📋", num: String(tasks.length), unit: "건", label: "현재 올라온 부탁" },
                { icon: "⚡", num: "평균 8", unit: "분", label: "매칭 소요 시간" },
                { icon: "💰", num: "38,500", unit: "원", label: "오늘 평균 수익" },
              ].map((s) => (
                <div key={s.label} className="bg-white rounded-[18px] p-5 text-center border border-mint/10">
                  <div className="text-3xl mb-2">{s.icon}</div>
                  <div className="text-2xl font-black">
                    <span className="text-mint">{s.num}</span>
                    {s.unit}
                  </div>
                  <p className="text-xs text-brand-light mt-1">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Categories */}
            <p className="text-lg font-extrabold mb-4">카테고리</p>
            <div className="flex flex-wrap gap-2.5 mb-8">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.label}
                  onClick={() => setSelectedCategory(cat.label)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
                    selectedCategory === cat.label
                      ? "border-mint bg-mint/6 text-mint-dark"
                      : "border-mint/15 bg-white text-brand-sub hover:border-mint hover:text-mint-dark"
                  }`}
                >
                  {cat.emoji} {cat.label}
                </button>
              ))}
            </div>

            {/* Tasks grid */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-lg font-extrabold">📍 내 주변 부탁</p>
            </div>
            {loading ? (
              <LoadingSkeleton />
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 text-brand-light">
                <p className="text-4xl mb-3">📭</p>
                <p className="font-semibold">아직 올라온 부탁이 없어요</p>
                <Link href="/create" className="text-mint-dark text-sm font-bold mt-2 inline-block">
                  첫 부탁 올리기 →
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {filtered.map((task, i) => (
                  <div key={task.id} className={`fade-up fade-up-${i}`}>
                    <TaskCard task={task} variant="pc" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* MOBILE LAYOUT */}
      <div className="md:hidden min-h-screen bg-bg">
        <header className="sticky top-0 z-50 bg-white border-b border-mint/10 flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-1.5 text-lg font-black">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-mint to-sky flex items-center justify-center text-sm">
              🙏
            </div>
            부탁<span className="text-mint">해</span>
          </div>
          <Link href="/location" className="flex items-center gap-1 bg-mint/10 text-mint-dark rounded-xl px-2.5 py-1 text-xs font-bold">
            📍 {userLocation} ▾
          </Link>
          <div className="flex gap-2">
            <button className="w-8 h-8 rounded-full bg-bg flex items-center justify-center text-sm">🔍</button>
            <Link href="/notifications" className="w-8 h-8 rounded-full bg-bg flex items-center justify-center text-sm relative">
              🔔
            </Link>
          </div>
        </header>

        <div className="pb-20">
          {/* Banner */}
          <div className="m-3 bg-gradient-to-r from-mint to-sky rounded-[18px] p-5 text-white relative overflow-hidden">
            <p className="text-xs opacity-85 mb-1">🌟 내 주변 부탁 {tasks.length}건</p>
            <h2 className="text-lg font-black leading-snug">
              작은 부탁도<br />
              <span className="text-yellow-300">큰 도움</span>이 됩니다
            </h2>
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-5xl opacity-90">🙏</span>
          </div>

          {/* Categories */}
          <div className="flex gap-3 px-3 py-3 overflow-x-auto scrollbar-hide">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.label}
                onClick={() => setSelectedCategory(cat.label)}
                className="flex flex-col items-center gap-1 min-w-[58px]"
              >
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl transition-transform active:scale-95 ${
                    selectedCategory === cat.label
                      ? "bg-mint/20 scale-105"
                      : "bg-white"
                  }`}
                >
                  {cat.emoji}
                </div>
                <span className="text-[11px] font-semibold text-brand-sub">{cat.label}</span>
              </button>
            ))}
          </div>

          {/* Tasks */}
          <div className="px-3">
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[15px] font-extrabold">📍 내 주변 부탁</p>
            </div>
            {loading ? (
              <div className="flex flex-col gap-2.5">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-white rounded-2xl p-3.5 border border-mint/8 animate-pulse">
                    <div className="h-4 bg-bg-2 rounded w-3/4 mb-2" />
                    <div className="h-3 bg-bg-2 rounded w-full mb-2" />
                    <div className="h-3 bg-bg-2 rounded w-1/3" />
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-brand-light">
                <p className="text-3xl mb-2">📭</p>
                <p className="text-sm font-semibold">아직 올라온 부탁이 없어요</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {filtered.map((task) => (
                  <TaskCard key={task.id} task={task} variant="mobile" />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* FAB */}
        <Link href="/create" className="fixed bottom-20 right-4 w-14 h-14 bg-gradient-to-br from-coral to-coral-dark rounded-full flex items-center justify-center text-2xl shadow-coral z-40 active:scale-90 transition-transform">
          ✏️
        </Link>

        <MobileTabBar />
      </div>
    </>
  );
}

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import MobileTabBar from "@/components/MobileTabBar";
import TaskCard from "@/components/TaskCard";
import { CATEGORIES } from "@/lib/data";
import { createClient } from "@/lib/supabase/client";
import { Task } from "@/types";

interface HelperTask extends Task {
  is_favorited?: boolean;
  application_count?: number;
  score?: number;
}

function toHelperTask(t: any): HelperTask {
  return {
    id: t.id,
    title: t.title,
    description: t.description ?? "",
    price: t.price,
    category: t.category,
    location: t.location,
    distance_km: t.distance_km ?? 0,
    is_urgent: t.is_urgent,
    created_at: t.created_at,
    status: t.status,
    requester_id: t.requester_id,
    requester_name: t.requester_name ?? "익명",
    requester_rating: t.requester_rating ?? 5.0,
    is_favorited: t.is_favorited ?? false,
    application_count: t.application_count ?? 0,
    score: t.score ?? 0,
  };
}

interface UserPreferences {
  preferred_categories: string[];
  max_distance_km: number;
  min_price: number;
  helper_mode: boolean;
}

export default function EarnPage() {
  const [tasks, setTasks] = useState<HelperTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [prefs, setPrefs] = useState<UserPreferences>({
    preferred_categories: [],
    max_distance_km: 5.0,
    min_price: 0,
    helper_mode: true,
  });
  const [showSettings, setShowSettings] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string>("전체");
  const [sortBy, setSortBy] = useState<"score" | "price" | "distance">("score");

  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      // 프로필 + 선호설정 동시 로딩
      const [profileRes, prefsRes] = await Promise.all([
        supabase.from("profiles").select("lat, lng").eq("id", user.id).single(),
        supabase.from("user_preferences").select("*").eq("user_id", user.id).single(),
      ]);

      if (profileRes.data) {
        setUserLat(profileRes.data.lat);
        setUserLng(profileRes.data.lng);
      }

      if (prefsRes.data) {
        setPrefs({
          preferred_categories: prefsRes.data.preferred_categories ?? [],
          max_distance_km: prefsRes.data.max_distance_km ?? 5.0,
          min_price: prefsRes.data.min_price ?? 0,
          helper_mode: prefsRes.data.helper_mode ?? true,
        });
      } else {
        // 첫 방문이면 기본 설정 생성
        await supabase.from("user_preferences").insert({
          user_id: user.id,
          helper_mode: true,
          preferred_categories: [],
          max_distance_km: 5.0,
          min_price: 0,
        });
      }

      // 도우미 피드 로드
      await fetchHelperFeed(user.id, profileRes.data?.lat, profileRes.data?.lng);
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchHelperFeed = async (uid: string, lat?: number | null, lng?: number | null) => {
    setLoading(true);
    const supabase = createClient();

    // helper feed RPC
    const { data, error } = await supabase.rpc("get_helper_feed", {
      p_user_id: uid,
      p_user_lat: lat ?? null,
      p_user_lng: lng ?? null,
      p_limit: 30,
      p_offset: 0,
    });

    if (!error && data) {
      setTasks(data.map(toHelperTask));
    } else {
      // fallback: 일반 쿼리
      const { data: fallback } = await supabase
        .from("tasks")
        .select("*, requester:profiles!requester_id(*)")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(30);

      if (fallback) {
        setTasks(fallback.map((t: any) => toHelperTask({
          ...t,
          requester_name: t.requester?.name ?? "익명",
          requester_rating: t.requester?.rating ?? 5.0,
        })));
      }
    }
    setLoading(false);
  };

  const savePreferences = async () => {
    if (!userId) return;
    const supabase = createClient();
    await supabase.from("user_preferences").upsert({
      user_id: userId,
      preferred_categories: prefs.preferred_categories,
      max_distance_km: prefs.max_distance_km,
      min_price: prefs.min_price,
      helper_mode: prefs.helper_mode,
      updated_at: new Date().toISOString(),
    });
    setShowSettings(false);
    await fetchHelperFeed(userId, userLat, userLng);
  };

  const toggleCategory = (cat: string) => {
    setPrefs((prev) => ({
      ...prev,
      preferred_categories: prev.preferred_categories.includes(cat)
        ? prev.preferred_categories.filter((c) => c !== cat)
        : [...prev.preferred_categories, cat],
    }));
  };

  // 클라이언트 필터 + 정렬
  const displayTasks = tasks
    .filter((t) => selectedFilter === "전체" || t.category === selectedFilter)
    .sort((a, b) => {
      if (sortBy === "price") return b.price - a.price;
      if (sortBy === "distance") return (a.distance_km ?? 9999) - (b.distance_km ?? 9999);
      return (b.score ?? 0) - (a.score ?? 0);
    });

  const totalEarnable = displayTasks.reduce((sum, t) => sum + t.price, 0);

  const LoadingSkeleton = () => (
    <div className="flex flex-col gap-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-white rounded-2xl p-4 border border-mint/8 animate-pulse">
          <div className="h-4 bg-bg-2 rounded w-3/4 mb-2" />
          <div className="h-3 bg-bg-2 rounded w-full mb-2" />
          <div className="h-3 bg-bg-2 rounded w-1/3" />
        </div>
      ))}
    </div>
  );

  // 설정 모달
  const SettingsModal = () => (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-end md:items-center justify-center" onClick={() => setShowSettings(false)}>
      <div className="bg-white w-full md:w-[480px] md:rounded-3xl rounded-t-3xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-black">⚙️ 돈벌기 설정</h2>
            <button onClick={() => setShowSettings(false)} className="text-2xl text-brand-light">×</button>
          </div>

          {/* 선호 카테고리 */}
          <div className="mb-6">
            <p className="text-sm font-bold mb-3">선호 카테고리 (선택하면 우선 표시)</p>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.filter((c) => c.label !== "전체").map((cat) => (
                <button
                  key={cat.label}
                  onClick={() => toggleCategory(cat.label)}
                  className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition-all ${
                    prefs.preferred_categories.includes(cat.label)
                      ? "border-mint bg-mint/10 text-mint-dark"
                      : "border-gray-200 bg-white text-brand-sub"
                  }`}
                >
                  {cat.emoji} {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* 최대 거리 */}
          <div className="mb-6">
            <p className="text-sm font-bold mb-3">최대 거리: {prefs.max_distance_km}km</p>
            <input
              type="range"
              min="1"
              max="20"
              step="0.5"
              value={prefs.max_distance_km}
              onChange={(e) => setPrefs((p) => ({ ...p, max_distance_km: parseFloat(e.target.value) }))}
              className="w-full accent-mint"
            />
            <div className="flex justify-between text-xs text-brand-light mt-1">
              <span>1km</span>
              <span>10km</span>
              <span>20km</span>
            </div>
          </div>

          {/* 최소 금액 */}
          <div className="mb-6">
            <p className="text-sm font-bold mb-3">최소 금액</p>
            <div className="flex gap-2">
              {[0, 5000, 10000, 20000, 30000].map((amt) => (
                <button
                  key={amt}
                  onClick={() => setPrefs((p) => ({ ...p, min_price: amt }))}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                    prefs.min_price === amt
                      ? "border-coral bg-coral/10 text-coral-dark"
                      : "border-gray-200 bg-white text-brand-sub"
                  }`}
                >
                  {amt === 0 ? "전체" : `${(amt / 10000).toFixed(0)}만원+`}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={savePreferences}
            className="w-full bg-gradient-to-r from-mint to-sky text-white py-3 rounded-2xl font-bold text-base"
          >
            설정 저장하기
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {showSettings && <SettingsModal />}

      {/* PC LAYOUT */}
      <div className="hidden md:flex min-h-screen">
        <Sidebar />
        <main className="ml-[260px] flex-1">
          <header className="sticky top-0 z-40 flex items-center justify-between px-8 py-4 bg-bg/90 backdrop-blur-xl border-b border-mint/10">
            <h1 className="text-xl font-black">💰 돈벌기</h1>
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setShowSettings(true)}
                className="flex items-center gap-1.5 bg-white border border-mint/25 rounded-full px-3.5 py-1.5 text-sm font-semibold hover:border-mint transition-colors"
              >
                ⚙️ 필터 설정
              </button>
              <Link href="/create" className="bg-gradient-to-r from-coral to-coral-dark text-white px-5 py-2 rounded-full text-sm font-bold shadow-coral hover:-translate-y-px hover:shadow-lg transition-all">
                ✏️ 부탁 올리기
              </Link>
            </div>
          </header>

          <div className="p-8">
            {/* 수익 요약 카드 */}
            <div className="bg-gradient-to-r from-[#667eea] via-[#764ba2] to-[#f093fb] rounded-3xl p-8 text-white mb-7 relative overflow-hidden">
              <div className="absolute -top-10 -right-10 w-52 h-52 rounded-full bg-white/10" />
              <p className="text-sm font-medium opacity-85 mb-2">💰 지금 벌 수 있는 금액</p>
              <h2 className="text-3xl font-black mb-1">{totalEarnable.toLocaleString()}원</h2>
              <p className="text-sm opacity-75">{displayTasks.length}건의 부탁이 기다리고 있어요</p>
              {prefs.preferred_categories.length > 0 && (
                <div className="flex gap-1.5 mt-3 flex-wrap">
                  {prefs.preferred_categories.map((cat) => (
                    <span key={cat} className="bg-white/20 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                      {cat}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* 정렬 + 필터 */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex gap-2">
                {(["score", "price", "distance"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSortBy(s)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                      sortBy === s
                        ? "border-mint bg-mint/10 text-mint-dark"
                        : "border-gray-200 text-brand-sub"
                    }`}
                  >
                    {s === "score" ? "🔥 추천순" : s === "price" ? "💵 금액순" : "📍 가까운순"}
                  </button>
                ))}
              </div>
              <p className="text-sm text-brand-light font-medium">{displayTasks.length}건</p>
            </div>

            {/* 카테고리 빠른 필터 */}
            <div className="flex flex-wrap gap-2 mb-6">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.label}
                  onClick={() => setSelectedFilter(cat.label)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    selectedFilter === cat.label
                      ? "border-mint bg-mint/6 text-mint-dark"
                      : "border-mint/15 bg-white text-brand-sub hover:border-mint"
                  }`}
                >
                  {cat.emoji} {cat.label}
                </button>
              ))}
            </div>

            {/* 태스크 목록 */}
            {loading ? (
              <LoadingSkeleton />
            ) : displayTasks.length === 0 ? (
              <div className="text-center py-16 text-brand-light">
                <p className="text-5xl mb-3">🔍</p>
                <p className="font-bold text-lg mb-1">조건에 맞는 부탁이 없어요</p>
                <p className="text-sm">필터 설정을 조정해보세요</p>
                <button onClick={() => setShowSettings(true)} className="mt-4 text-mint-dark font-bold text-sm">
                  설정 변경하기 →
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {displayTasks.map((task, i) => (
                  <div key={task.id} className={`fade-up fade-up-${i} relative`}>
                    <TaskCard task={task} variant="pc" />
                    {(task.application_count ?? 0) > 0 && (
                      <div className="absolute top-3 right-3 bg-yellow-100 text-yellow-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        🙋 {task.application_count}명 지원
                      </div>
                    )}
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
          <h1 className="text-lg font-black">💰 돈벌기</h1>
          <button
            onClick={() => setShowSettings(true)}
            className="w-8 h-8 rounded-full bg-bg flex items-center justify-center text-sm"
          >
            ⚙️
          </button>
        </header>

        <div className="pb-20">
          {/* 수익 배너 */}
          <div className="m-3 bg-gradient-to-r from-[#667eea] to-[#764ba2] rounded-[18px] p-5 text-white relative overflow-hidden">
            <p className="text-xs opacity-85 mb-1">💰 벌 수 있는 금액</p>
            <h2 className="text-xl font-black">{totalEarnable.toLocaleString()}원</h2>
            <p className="text-xs opacity-75 mt-0.5">{displayTasks.length}건의 부탁</p>
          </div>

          {/* 정렬 */}
          <div className="flex gap-2 px-3 mb-2">
            {(["score", "price", "distance"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all ${
                  sortBy === s
                    ? "border-mint bg-mint/10 text-mint-dark"
                    : "border-gray-200 text-brand-sub"
                }`}
              >
                {s === "score" ? "🔥 추천" : s === "price" ? "💵 금액" : "📍 가까운"}
              </button>
            ))}
          </div>

          {/* 카테고리 */}
          <div className="flex gap-2 px-3 py-2 overflow-x-auto scrollbar-hide">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.label}
                onClick={() => setSelectedFilter(cat.label)}
                className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all ${
                  selectedFilter === cat.label
                    ? "border-mint bg-mint/10 text-mint-dark"
                    : "border-gray-200 text-brand-sub"
                }`}
              >
                {cat.emoji} {cat.label}
              </button>
            ))}
          </div>

          {/* 태스크 목록 */}
          <div className="px-3 mt-2">
            {loading ? (
              <LoadingSkeleton />
            ) : displayTasks.length === 0 ? (
              <div className="text-center py-12 text-brand-light">
                <p className="text-4xl mb-2">🔍</p>
                <p className="text-sm font-bold">조건에 맞는 부탁이 없어요</p>
                <button onClick={() => setShowSettings(true)} className="mt-2 text-mint-dark font-bold text-xs">
                  설정 변경 →
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {displayTasks.map((task) => (
                  <div key={task.id} className="relative">
                    <TaskCard task={task} variant="mobile" />
                    {(task.application_count ?? 0) > 0 && (
                      <div className="absolute top-2 right-2 bg-yellow-100 text-yellow-700 text-[9px] font-bold px-2 py-0.5 rounded-full z-10">
                        🙋 {task.application_count}명
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <MobileTabBar />
      </div>
    </>
  );
}

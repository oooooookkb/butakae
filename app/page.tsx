"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import MobileTabBar from "@/components/MobileTabBar";
import NotificationBell from "@/components/NotificationBell";
import { CATEGORIES, formatPrice, timeAgo, CATEGORY_COLORS, CATEGORY_EMOJI } from "@/lib/data";
import { createClient } from "@/lib/supabase/client";
import { Task } from "@/types";

function toTask(t: any): Task {
  return {
    id: t.id, title: t.title, description: t.description ?? "",
    price: t.price, category: t.category, location: t.location,
    distance_km: t.distance_km ?? 0, is_urgent: t.is_urgent,
    created_at: t.created_at, status: t.status,
    requester_id: t.requester_id,
    requester_name: t.requester_name ?? t.requester?.name ?? "익명",
    requester_rating: t.requester_rating ?? t.requester?.rating ?? 5.0,
  };
}

function distanceText(km: number): string {
  if (!km || km <= 0 || km > 9000) return "";
  const walkMin = Math.round(km * 12); // 약 5km/h 도보
  if (walkMin <= 1) return "도보 1분";
  if (walkMin <= 60) return `도보 ${walkMin}분`;
  return `${km.toFixed(1)}km`;
}

export default function HomePage() {
  const [mode, setMode] = useState<"find" | "request">("find");
  const [selectedCategory, setSelectedCategory] = useState<string>("전체");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState("동네 설정");
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [accepting, setAccepting] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        const { data: profile } = await supabase
          .from("profiles")
          .select("location, lat, lng")
          .eq("id", user.id)
          .single();
        if (profile) {
          if (profile.location) setUserLocation(profile.location);
          setUserLat(profile.lat);
          setUserLng(profile.lng);
        }

        // 내가 올린 부탁 (요청하기 모드용)
        const { data: mine } = await supabase
          .from("tasks")
          .select("*")
          .eq("requester_id", user.id)
          .in("status", ["open", "in_progress"])
          .order("created_at", { ascending: false })
          .limit(5);
        if (mine) setMyTasks(mine.map(toTask));
      }
      await fetchTasks();
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchTasks = useCallback(async (category?: string) => {
    setLoading(true);
    const supabase = createClient();
    const cat = category === "전체" ? null : category;

    // 스마트 피드 RPC
    const { data: smartData, error } = await supabase.rpc("get_smart_feed", {
      p_user_lat: userLat ?? null,
      p_user_lng: userLng ?? null,
      p_user_location: userLocation ?? null,
      p_category: cat ?? null,
      p_limit: 30,
      p_offset: 0,
    });

    if (!error && smartData) {
      setTasks(smartData.map(toTask));
    } else {
      let query = supabase
        .from("tasks")
        .select("*, requester:profiles!requester_id(*)")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(30);
      if (cat) query = query.eq("category", cat);
      const { data } = await query;
      if (data) setTasks(data.map(toTask));
    }
    setLoading(false);
  }, [userLat, userLng, userLocation]);

  useEffect(() => {
    if (loading) return;
    fetchTasks(selectedCategory);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory]);

  // 즉시 수락
  const handleAccept = async (taskId: string) => {
    if (!userId || accepting) return;
    setAccepting(taskId);
    const supabase = createClient();
    const { error } = await supabase.rpc("accept_task", {
      p_task_id: taskId,
      p_helper_id: userId,
    });
    if (!error) {
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      alert("수락 완료! 채팅방이 생성되었어요 💬");
    } else {
      alert("수락에 실패했어요. 이미 다른 사람이 수락했을 수 있어요.");
    }
    setAccepting(null);
  };

  const urgentTasks = tasks.filter((t) => t.is_urgent);
  const nearbyCount = tasks.length;
  const avgPrice = tasks.length > 0
    ? Math.round(tasks.reduce((s, t) => s + t.price, 0) / tasks.length)
    : 0;

  // ====== 돈벌기 모드 피드 카드 ======
  const FeedCard = ({ task }: { task: Task }) => {
    const dist = distanceText(task.distance_km);
    const isAccepting = accepting === task.id;

    return (
      <div className="bg-white rounded-2xl border border-mint/10 overflow-hidden hover:border-mint/25 transition-all">
        {/* 상단 태그 */}
        <div className="px-4 pt-3.5 pb-0 flex items-center gap-2">
          {task.is_urgent && (
            <span className="bg-coral text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full">⚡ 급구</span>
          )}
          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${CATEGORY_COLORS[task.category] ?? CATEGORY_COLORS["기타"]}`}>
            {CATEGORY_EMOJI[task.category] ?? "✨"} {task.category}
          </span>
          <span className="text-[10px] text-brand-light ml-auto">{timeAgo(task.created_at)}</span>
        </div>

        {/* 제목 + 설명 */}
        <Link href={`/tasks/${task.id}`} className="block px-4 pt-2 pb-2">
          <h3 className="text-[15px] font-bold leading-snug mb-1">{task.title}</h3>
          <p className="text-xs text-brand-sub line-clamp-1 leading-relaxed">{task.description}</p>
        </Link>

        {/* 가격 + 위치 */}
        <div className="px-4 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-lg font-black text-coral">{formatPrice(task.price)}</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-brand-light">
            {dist && <span>📍 {dist}</span>}
            {!dist && <span>📍 {task.location}</span>}
            <span>⭐ {task.requester_rating.toFixed(1)}</span>
          </div>
        </div>

        {/* 수락 버튼 영역 */}
        <div className="px-4 pb-3.5 flex gap-2">
          {task.requester_id !== userId ? (
            <>
              <button
                onClick={() => handleAccept(task.id)}
                disabled={isAccepting}
                className="flex-1 bg-gradient-to-r from-mint to-sky text-white py-2.5 rounded-xl text-sm font-bold active:scale-[0.97] transition-all disabled:opacity-60"
              >
                {isAccepting ? "수락 중..." : "👆 수락하기"}
              </button>
              <Link
                href={`/tasks/${task.id}`}
                className="px-4 py-2.5 rounded-xl text-sm font-bold border border-mint/20 text-mint-dark hover:bg-mint/5 transition-colors"
              >
                상세
              </Link>
            </>
          ) : (
            <Link
              href={`/tasks/${task.id}`}
              className="flex-1 text-center bg-bg text-brand-sub py-2.5 rounded-xl text-sm font-bold"
            >
              내가 올린 부탁 · 상세보기
            </Link>
          )}
        </div>
      </div>
    );
  };

  // ====== 부탁하기 모드 ======
  const RequestMode = () => (
    <div>
      {/* CTA */}
      <Link href="/create">
        <div className="bg-gradient-to-r from-coral to-coral-dark rounded-2xl p-6 text-white mb-5 relative overflow-hidden active:scale-[0.98] transition-transform">
          <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10" />
          <p className="text-sm opacity-85 mb-1">💡 도움이 필요할 때</p>
          <h2 className="text-xl font-black mb-2">지금 부탁 올리기</h2>
          <p className="text-sm opacity-80 mb-3">주변 도우미가 빠르게 매칭돼요</p>
          <span className="bg-white text-coral-dark font-bold text-sm px-5 py-2.5 rounded-full inline-block">
            ✏️ 부탁 작성하기 →
          </span>
        </div>
      </Link>

      {/* 내가 올린 부탁 */}
      {myTasks.length > 0 && (
        <div className="mb-5">
          <p className="text-base font-black mb-3">📋 내가 올린 부탁</p>
          <div className="flex flex-col gap-2.5">
            {myTasks.map((task) => (
              <Link key={task.id} href={`/tasks/${task.id}`} className="block">
                <div className="bg-white rounded-2xl p-4 border border-mint/10">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[task.category] ?? CATEGORY_COLORS["기타"]}`}>
                      {task.category}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      task.status === "open" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                    }`}>
                      {task.status === "open" ? "매칭 대기" : "진행 중"}
                    </span>
                  </div>
                  <p className="text-sm font-bold mb-1">{task.title}</p>
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] text-brand-light">{timeAgo(task.created_at)}</span>
                    <span className="text-sm font-black text-coral">{formatPrice(task.price)}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 부탁 잘 올리는 팁 */}
      <div className="bg-white rounded-2xl border border-mint/10 p-5">
        <p className="text-base font-black mb-3">💡 부탁 잘 올리는 팁</p>
        <div className="flex flex-col gap-3">
          {[
            { emoji: "📸", tip: "사진이나 위치를 구체적으로 적으면 매칭이 빨라요" },
            { emoji: "💰", tip: "적정 가격을 제시하면 지원자가 늘어요 (동네 평균: 15,000원)" },
            { emoji: "⏰", tip: "급한 부탁은 '급해요' 옵션을 켜면 우선 노출돼요" },
            { emoji: "⭐", tip: "완료 후 리뷰를 남기면 다음 매칭이 더 빨라져요" },
          ].map((item) => (
            <div key={item.tip} className="flex gap-3 items-start">
              <span className="text-xl">{item.emoji}</span>
              <p className="text-sm text-brand-sub leading-relaxed">{item.tip}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ====== 토글 버튼 ======
  const ModeToggle = ({ className = "" }: { className?: string }) => (
    <div className={`flex bg-bg-2 rounded-2xl p-1 ${className}`}>
      <button
        onClick={() => setMode("find")}
        className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
          mode === "find"
            ? "bg-gradient-to-r from-mint to-sky text-white shadow-mint"
            : "text-brand-light"
        }`}
      >
        💰 돈벌기
      </button>
      <button
        onClick={() => setMode("request")}
        className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
          mode === "request"
            ? "bg-gradient-to-r from-coral to-coral-dark text-white shadow-coral"
            : "text-brand-light"
        }`}
      >
        🙏 부탁하기
      </button>
    </div>
  );

  const LoadingSkeleton = () => (
    <div className="flex flex-col gap-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-white rounded-2xl p-4 border border-mint/10 animate-pulse">
          <div className="h-3 bg-bg-2 rounded w-24 mb-2" />
          <div className="h-5 bg-bg-2 rounded w-3/4 mb-2" />
          <div className="h-3 bg-bg-2 rounded w-full mb-3" />
          <div className="flex gap-2">
            <div className="h-10 bg-bg-2 rounded-xl flex-1" />
            <div className="h-10 bg-bg-2 rounded-xl w-16" />
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <>
      {/* ========== PC LAYOUT ========== */}
      <div className="hidden md:flex min-h-screen">
        <Sidebar />
        <main className="ml-[260px] flex-1">
          {/* PC Header */}
          <header className="sticky top-0 z-40 flex items-center justify-between px-8 py-3 bg-bg/90 backdrop-blur-xl border-b border-mint/10">
            <div className="flex items-center gap-4">
              <Link href="/location" className="flex items-center gap-1.5 bg-white border border-mint/25 rounded-full px-3.5 py-1.5 text-sm font-semibold hover:border-mint transition-colors">
                📍 {userLocation} ▾
              </Link>
              <ModeToggle className="w-[300px]" />
            </div>
            <div className="flex items-center gap-2.5">
              <NotificationBell />
              {mode === "request" && (
                <Link href="/create" className="bg-gradient-to-r from-coral to-coral-dark text-white px-5 py-2 rounded-full text-sm font-bold shadow-coral">
                  ✏️ 부탁 올리기
                </Link>
              )}
            </div>
          </header>

          <div className="p-8">
            {mode === "find" ? (
              <>
                {/* 통계 */}
                <div className="flex gap-4 mb-7">
                  <div className="bg-gradient-to-br from-mint to-sky rounded-2xl p-5 text-white flex-1">
                    <p className="text-xs opacity-80">주변 매칭 대기</p>
                    <p className="text-3xl font-black mt-1">{nearbyCount}<span className="text-lg">건</span></p>
                    <p className="text-[10px] opacity-70 mt-1">반경 2km 이내</p>
                  </div>
                  <div className="bg-white rounded-2xl border border-mint/10 p-5 flex-1">
                    <p className="text-xs text-brand-light">평균 보상</p>
                    <p className="text-2xl font-black text-coral mt-1">{formatPrice(avgPrice)}</p>
                  </div>
                  {urgentTasks.length > 0 && (
                    <div className="bg-coral/5 border border-coral/15 rounded-2xl p-5 flex-1">
                      <p className="text-xs text-coral-dark">⚡ 급구</p>
                      <p className="text-2xl font-black text-coral mt-1">{urgentTasks.length}<span className="text-sm">건</span></p>
                    </div>
                  )}
                </div>

                {/* 카테고리 필터 */}
                <div className="flex flex-wrap gap-2 mb-6">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.label}
                      onClick={() => setSelectedCategory(cat.label)}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
                        selectedCategory === cat.label
                          ? "border-mint bg-mint/8 text-mint-dark"
                          : "border-mint/15 bg-white text-brand-sub hover:border-mint"
                      }`}
                    >
                      {cat.emoji} {cat.label}
                    </button>
                  ))}
                </div>

                {/* 피드 */}
                <div className="flex items-center justify-between mb-4">
                  <p className="text-lg font-black">🔥 실시간 매칭 피드</p>
                  <p className="text-sm text-brand-light">{tasks.length}건</p>
                </div>
                {loading ? (
                  <LoadingSkeleton />
                ) : tasks.length === 0 ? (
                  <div className="text-center py-16 text-brand-light">
                    <p className="text-4xl mb-3">📭</p>
                    <p className="font-bold">이 카테고리에 부탁이 없어요</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                    {tasks.map((task) => (
                      <FeedCard key={task.id} task={task} />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <RequestMode />
            )}
          </div>
        </main>
      </div>

      {/* ========== MOBILE LAYOUT ========== */}
      <div className="md:hidden min-h-screen bg-bg">
        {/* 모바일 헤더 */}
        <header className="sticky top-0 z-50 bg-white border-b border-mint/10">
          <div className="flex items-center justify-between px-4 py-2.5">
            <div className="flex items-center gap-1.5 text-lg font-black">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-mint to-sky flex items-center justify-center text-sm">🙏</div>
              부탁<span className="text-mint">해</span>
            </div>
            <Link href="/location" className="flex items-center gap-1 bg-mint/10 text-mint-dark rounded-xl px-2.5 py-1 text-xs font-bold">
              📍 {userLocation} ▾
            </Link>
            <div className="flex gap-1.5">
              <Link href="/notifications" className="w-8 h-8 rounded-full bg-bg flex items-center justify-center text-sm">🔔</Link>
            </div>
          </div>
          {/* 듀얼 토글 */}
          <div className="px-3 pb-2.5">
            <ModeToggle />
          </div>
        </header>

        <div className="pb-20">
          {mode === "find" ? (
            <>
              {/* 통계 바 */}
              <div className="flex items-center gap-2 mx-3 mt-2.5 mb-2">
                <div className="flex-1 bg-white rounded-xl py-2 px-3 border border-mint/10 text-center">
                  <p className="text-base font-black text-mint">{nearbyCount}<span className="text-xs text-brand-light">건</span></p>
                  <p className="text-[9px] text-brand-light">주변 매칭</p>
                </div>
                <div className="flex-1 bg-white rounded-xl py-2 px-3 border border-mint/10 text-center">
                  <p className="text-base font-black text-coral">{formatPrice(avgPrice)}</p>
                  <p className="text-[9px] text-brand-light">평균 보상</p>
                </div>
                {urgentTasks.length > 0 && (
                  <div className="flex-1 bg-coral/5 rounded-xl py-2 px-3 border border-coral/15 text-center">
                    <p className="text-base font-black text-coral">⚡{urgentTasks.length}</p>
                    <p className="text-[9px] text-coral-dark">급구</p>
                  </div>
                )}
              </div>

              {/* 카테고리 */}
              <div className="flex gap-2 px-3 py-2 overflow-x-auto scrollbar-hide">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.label}
                    onClick={() => setSelectedCategory(cat.label)}
                    className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all ${
                      selectedCategory === cat.label
                        ? "border-mint bg-mint/10 text-mint-dark"
                        : "border-gray-200 bg-white text-brand-sub"
                    }`}
                  >
                    {cat.emoji} {cat.label}
                  </button>
                ))}
              </div>

              {/* 피드 */}
              <div className="px-3 mt-1">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[13px] font-black">🔥 실시간 매칭 피드</p>
                  <p className="text-[11px] text-brand-light">{tasks.length}건</p>
                </div>
                {loading ? (
                  <LoadingSkeleton />
                ) : tasks.length === 0 ? (
                  <div className="text-center py-12 text-brand-light">
                    <p className="text-3xl mb-2">📭</p>
                    <p className="text-sm font-bold">부탁이 없어요</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {tasks.map((task) => (
                      <FeedCard key={task.id} task={task} />
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="px-3 pt-3">
              <RequestMode />
            </div>
          )}
        </div>

        {/* FAB (부탁하기 모드일 때만) */}
        {mode === "request" && (
          <Link href="/create" className="fixed bottom-20 right-4 w-14 h-14 bg-gradient-to-br from-coral to-coral-dark rounded-full flex items-center justify-center text-2xl shadow-coral z-40 active:scale-90 transition-transform">
            ✏️
          </Link>
        )}

        <MobileTabBar />
      </div>
    </>
  );
}

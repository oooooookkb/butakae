"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import MobileTabBar from "@/components/MobileTabBar";
import { createClient } from "@/lib/supabase/client";
import { Task } from "@/types";
import { CATEGORIES, formatPrice, timeAgo, CATEGORY_COLORS, CATEGORY_EMOJI } from "@/lib/data";

// Leaflet은 SSR 불가 → dynamic import
const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

export default function MapPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLat, setUserLat] = useState(37.2636);
  const [userLng, setUserLng] = useState(127.0286);
  const [selectedCategory, setSelectedCategory] = useState("전체");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 유저 위치
      const { data: profile } = await supabase
        .from("profiles")
        .select("lat, lng, location")
        .eq("id", user.id)
        .single();

      if (profile?.lat && profile?.lng) {
        setUserLat(profile.lat);
        setUserLng(profile.lng);
      }

      // 오픈 상태 부탁들 (좌표 있는 것만)
      const { data: tasksData } = await supabase
        .from("tasks")
        .select("*")
        .eq("status", "open")
        .not("lat", "is", null)
        .not("lng", "is", null)
        .limit(100);

      if (tasksData) {
        setTasks(tasksData.map((t: any) => ({
          ...t,
          requester_name: "익명",
          requester_rating: 5.0,
          distance_km: 0,
        })));
      }
      setLoading(false);
    };
    init();
  }, []);

  const filteredCount = selectedCategory === "전체"
    ? tasks.length
    : tasks.filter((t) => t.category === selectedCategory).length;

  // 선택된 태스크 하단 카드
  const TaskPreview = ({ task }: { task: Task }) => (
    <div className="absolute bottom-20 md:bottom-4 left-3 right-3 md:left-auto md:right-4 md:w-[360px] z-[1000] animate-slide-up">
      <Link href={`/tasks/${task.id}`}>
        <div className="bg-white rounded-2xl p-4 border border-mint/15 shadow-mint-lg">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-bg flex items-center justify-center text-2xl flex-shrink-0">
              {CATEGORY_EMOJI[task.category] || "📍"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[task.category] ?? CATEGORY_COLORS["기타"]}`}>
                  {task.category}
                </span>
                {task.is_urgent && (
                  <span className="text-[10px] font-bold text-coral">⚡ 급해요</span>
                )}
              </div>
              <h3 className="text-sm font-bold mb-1 truncate">{task.title}</h3>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-brand-light">📍 {task.location} · ⏰ {timeAgo(task.created_at)}</span>
                <span className="text-sm font-black text-coral">{formatPrice(task.price)}</span>
              </div>
            </div>
          </div>
          <div className="mt-3 bg-gradient-to-r from-mint to-sky text-white text-center py-2 rounded-xl text-xs font-bold">
            상세보기 →
          </div>
        </div>
      </Link>
      <button
        onClick={(e) => { e.preventDefault(); setSelectedTask(null); }}
        className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-white border border-gray-200 flex items-center justify-center text-xs text-brand-light shadow-sm z-10"
      >
        ✕
      </button>
    </div>
  );

  return (
    <>
      {/* PC LAYOUT */}
      <div className="hidden md:flex min-h-screen">
        <Sidebar />
        <main className="ml-[260px] flex-1 relative">
          {/* 상단 컨트롤 */}
          <div className="absolute top-4 left-4 right-4 z-[1000] flex items-center justify-between">
            <div className="bg-white/95 backdrop-blur-xl rounded-2xl border border-mint/15 shadow-mint px-4 py-2.5 flex items-center gap-2">
              <span className="text-lg">🗺️</span>
              <h1 className="text-base font-black">지도</h1>
              <span className="text-xs text-brand-light ml-2">{filteredCount}건</span>
            </div>
            <div className="flex gap-2 bg-white/95 backdrop-blur-xl rounded-2xl border border-mint/15 shadow-mint px-3 py-2">
              {CATEGORIES.slice(0, 6).map((cat) => (
                <button
                  key={cat.label}
                  onClick={() => setSelectedCategory(cat.label)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                    selectedCategory === cat.label
                      ? "bg-mint/15 text-mint-dark"
                      : "text-brand-light hover:text-brand-sub"
                  }`}
                >
                  {cat.emoji} {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* 지도 */}
          <div className="h-screen">
            {loading ? (
              <div className="h-full flex items-center justify-center bg-bg">
                <div className="text-center">
                  <div className="w-10 h-10 rounded-full border-4 border-mint border-t-transparent animate-spin mx-auto mb-3" />
                  <p className="text-sm text-brand-light">지도 로딩 중...</p>
                </div>
              </div>
            ) : (
              <MapView
                tasks={tasks}
                userLat={userLat}
                userLng={userLng}
                selectedCategory={selectedCategory}
                onTaskSelect={(task) => setSelectedTask(task)}
              />
            )}
          </div>

          {/* 선택된 태스크 카드 */}
          {selectedTask && <TaskPreview task={selectedTask} />}
        </main>
      </div>

      {/* MOBILE LAYOUT */}
      <div className="md:hidden min-h-screen bg-bg relative">
        {/* 상단 컨트롤 */}
        <div className="absolute top-3 left-3 right-3 z-[1000]">
          <div className="flex items-center justify-between mb-2">
            <div className="bg-white/95 backdrop-blur-xl rounded-xl border border-mint/15 shadow-sm px-3 py-2 flex items-center gap-2">
              <button onClick={() => router.back()} className="text-sm">←</button>
              <span className="text-sm font-black">🗺️ 지도</span>
              <span className="text-[10px] text-brand-light">{filteredCount}건</span>
            </div>
          </div>
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.label}
                onClick={() => setSelectedCategory(cat.label)}
                className={`flex-shrink-0 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all bg-white/95 backdrop-blur-xl border shadow-sm ${
                  selectedCategory === cat.label
                    ? "border-mint bg-mint/10 text-mint-dark"
                    : "border-gray-200 text-brand-sub"
                }`}
              >
                {cat.emoji} {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* 지도 */}
        <div className="h-screen">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="w-10 h-10 rounded-full border-4 border-mint border-t-transparent animate-spin mx-auto mb-3" />
                <p className="text-sm text-brand-light">지도 로딩 중...</p>
              </div>
            </div>
          ) : (
            <MapView
              tasks={tasks}
              userLat={userLat}
              userLng={userLng}
              selectedCategory={selectedCategory}
              onTaskSelect={(task) => setSelectedTask(task)}
            />
          )}
        </div>

        {/* 선택된 태스크 카드 */}
        {selectedTask && <TaskPreview task={selectedTask} />}

        <MobileTabBar />
      </div>
    </>
  );
}

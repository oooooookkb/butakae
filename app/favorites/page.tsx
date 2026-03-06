"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import MobileTabBar from "@/components/MobileTabBar";
import { createClient } from "@/lib/supabase/client";
import { Task } from "@/types";
import { CATEGORY_COLORS, formatPrice, timeAgo } from "@/lib/data";

function toFavTask(t: any): Task & { favorited_at: string } {
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
    favorited_at: t.favorited_at,
  };
}

export default function FavoritesPage() {
  const [tasks, setTasks] = useState<(Task & { favorited_at: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      await fetchFavorites(user.id);
    };
    init();
  }, []);

  const fetchFavorites = async (uid: string) => {
    setLoading(true);
    const supabase = createClient();

    const { data, error } = await supabase.rpc("get_my_favorites", {
      p_user_id: uid,
      p_limit: 30,
      p_offset: 0,
    });

    if (!error && data) {
      setTasks(data.map(toFavTask));
    } else {
      // fallback: 직접 조인 쿼리
      const { data: fallback } = await supabase
        .from("favorites")
        .select("created_at, task:tasks(*, requester:profiles!requester_id(name, rating))")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(30);

      if (fallback) {
        setTasks(
          fallback
            .filter((f: any) => f.task)
            .map((f: any) => ({
              ...f.task,
              requester_name: f.task.requester?.name ?? "익명",
              requester_rating: f.task.requester?.rating ?? 5.0,
              distance_km: 0,
              favorited_at: f.created_at,
            }))
        );
      }
    }
    setLoading(false);
  };

  const removeFavorite = async (taskId: string) => {
    if (!userId) return;
    const supabase = createClient();
    await supabase.rpc("toggle_favorite", { p_user_id: userId, p_task_id: taskId });
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  };

  const openTasks = tasks.filter((t) => t.status === "open");
  const closedTasks = tasks.filter((t) => t.status !== "open");

  const FavCard = ({ task }: { task: Task & { favorited_at: string } }) => (
    <div className="bg-white rounded-2xl p-4 border border-mint/10 relative group">
      <button
        onClick={(e) => {
          e.preventDefault();
          removeFavorite(task.id);
        }}
        className="absolute top-3 right-3 text-lg opacity-60 hover:opacity-100 transition-opacity z-10"
        title="즐겨찾기 제거"
      >
        ❤️
      </button>
      <Link href={`/tasks/${task.id}`} className="block">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[task.category] ?? CATEGORY_COLORS["기타"]}`}>
                {task.category}
              </span>
              {task.status !== "open" && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                  {task.status === "in_progress" ? "진행중" : task.status === "done" ? "완료" : "취소"}
                </span>
              )}
              {task.is_urgent && (
                <span className="text-[10px] font-bold text-coral">⚡ 급해요</span>
              )}
            </div>
            <h3 className="text-sm font-bold mb-1 leading-snug">{task.title}</h3>
            <p className="text-xs text-brand-sub mb-2 leading-relaxed line-clamp-1">{task.description}</p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[11px] text-brand-light">
                <span>📍 {task.location}</span>
                <span>⏰ {timeAgo(task.created_at)}</span>
              </div>
              <span className="text-sm font-black text-coral">{formatPrice(task.price)}</span>
            </div>
          </div>
        </div>
      </Link>
    </div>
  );

  const LoadingSkeleton = () => (
    <div className="flex flex-col gap-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-white rounded-2xl p-4 border border-mint/10 animate-pulse">
          <div className="h-3 bg-bg-2 rounded w-16 mb-2" />
          <div className="h-4 bg-bg-2 rounded w-3/4 mb-2" />
          <div className="h-3 bg-bg-2 rounded w-full mb-2" />
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
            <h1 className="text-xl font-black">❤️ 즐겨찾기</h1>
            <p className="text-sm text-brand-light">{tasks.length}개의 부탁을 저장했어요</p>
          </header>

          <div className="p-8">
            {loading ? (
              <LoadingSkeleton />
            ) : tasks.length === 0 ? (
              <div className="text-center py-20 text-brand-light">
                <p className="text-5xl mb-4">💝</p>
                <p className="text-lg font-bold mb-1">아직 즐겨찾기한 부탁이 없어요</p>
                <p className="text-sm mb-4">마음에 드는 부탁을 ❤️ 버튼으로 저장해보세요</p>
                <Link href="/" className="text-mint-dark font-bold text-sm">
                  부탁 둘러보기 →
                </Link>
              </div>
            ) : (
              <>
                {openTasks.length > 0 && (
                  <>
                    <p className="text-lg font-extrabold mb-4">📋 진행 가능한 부탁 ({openTasks.length})</p>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
                      {openTasks.map((task) => (
                        <FavCard key={task.id} task={task} />
                      ))}
                    </div>
                  </>
                )}
                {closedTasks.length > 0 && (
                  <>
                    <p className="text-lg font-extrabold mb-4 text-brand-light">🔒 마감된 부탁 ({closedTasks.length})</p>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 opacity-60">
                      {closedTasks.map((task) => (
                        <FavCard key={task.id} task={task} />
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </main>
      </div>

      {/* MOBILE LAYOUT */}
      <div className="md:hidden min-h-screen bg-bg">
        <header className="sticky top-0 z-50 bg-white border-b border-mint/10 flex items-center justify-between px-4 py-3">
          <h1 className="text-lg font-black">❤️ 즐겨찾기</h1>
          <p className="text-xs text-brand-light">{tasks.length}개</p>
        </header>

        <div className="pb-20">
          <div className="px-3 pt-3">
            {loading ? (
              <LoadingSkeleton />
            ) : tasks.length === 0 ? (
              <div className="text-center py-16 text-brand-light">
                <p className="text-4xl mb-3">💝</p>
                <p className="text-sm font-bold mb-1">즐겨찾기한 부탁이 없어요</p>
                <p className="text-xs mb-3">❤️ 버튼으로 저장해보세요</p>
                <Link href="/" className="text-mint-dark font-bold text-xs">
                  둘러보기 →
                </Link>
              </div>
            ) : (
              <>
                {openTasks.length > 0 && (
                  <>
                    <p className="text-[13px] font-extrabold mb-2.5">📋 진행 가능 ({openTasks.length})</p>
                    <div className="flex flex-col gap-2.5 mb-5">
                      {openTasks.map((task) => (
                        <FavCard key={task.id} task={task} />
                      ))}
                    </div>
                  </>
                )}
                {closedTasks.length > 0 && (
                  <>
                    <p className="text-[13px] font-extrabold mb-2.5 text-brand-light">🔒 마감됨 ({closedTasks.length})</p>
                    <div className="flex flex-col gap-2.5 opacity-60">
                      {closedTasks.map((task) => (
                        <FavCard key={task.id} task={task} />
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        <MobileTabBar />
      </div>
    </>
  );
}

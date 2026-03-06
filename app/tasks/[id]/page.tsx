"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { CATEGORY_COLORS, formatPrice, timeAgo } from "@/lib/data";

export default function TaskDetailPage() {
  const router = useRouter();
  const params = useParams();
  const taskId = params.id as string;

  const [task, setTask] = useState<any>(null);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);

      const { data } = await supabase
        .from("tasks")
        .select("*, requester:profiles!requester_id(*), helper:profiles!helper_id(*)")
        .eq("id", taskId)
        .single();

      setTask(data);
      setLoading(false);
    };
    init();
  }, [taskId]);

  const handleAccept = async () => {
    setActionLoading(true);
    const supabase = createClient();

    // Update task
    await supabase
      .from("tasks")
      .update({ status: "in_progress", helper_id: currentUserId, updated_at: new Date().toISOString() })
      .eq("id", taskId);

    // Create chat room
    const { data: room } = await supabase
      .from("chat_rooms")
      .insert({
        task_id: taskId,
        requester_id: task.requester_id,
        helper_id: currentUserId,
      })
      .select()
      .single();

    if (room) {
      router.push(`/chat/${room.id}`);
    }
  };

  const handleComplete = async () => {
    setActionLoading(true);
    const supabase = createClient();
    await supabase
      .from("tasks")
      .update({ status: "done", updated_at: new Date().toISOString() })
      .eq("id", taskId);
    router.push(`/review/${taskId}`);
  };

  const handleCancel = async () => {
    setActionLoading(true);
    const supabase = createClient();
    await supabase
      .from("tasks")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", taskId);
    router.push("/my-tasks");
  };

  const goToChat = async () => {
    const supabase = createClient();
    const { data: rooms } = await supabase
      .from("chat_rooms")
      .select("id")
      .eq("task_id", taskId)
      .limit(1);
    if (rooms && rooms.length > 0) {
      router.push(`/chat/${rooms[0].id}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-4 border-mint border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center text-brand-light">
        <p className="text-4xl mb-3">😢</p>
        <p className="font-semibold">부탁을 찾을 수 없어요</p>
        <Link href="/" className="text-mint-dark text-sm font-bold mt-2">홈으로 돌아가기</Link>
      </div>
    );
  }

  const isRequester = currentUserId === task.requester_id;
  const isHelper = currentUserId === task.helper_id;

  return (
    <div className="min-h-screen bg-bg pb-28">
      <header className="sticky top-0 z-40 bg-white border-b border-mint/10 px-4 py-4 flex items-center gap-3">
        <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-bg flex items-center justify-center text-lg">
          ←
        </button>
        <h1 className="text-base font-black flex-1">부탁 상세</h1>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
          task.status === "open" ? "bg-mint/10 text-mint-dark" :
          task.status === "in_progress" ? "bg-yellow-100 text-yellow-700" :
          task.status === "done" ? "bg-green-100 text-green-700" :
          "bg-gray-100 text-gray-600"
        }`}>
          {task.status === "open" ? "모집중" :
           task.status === "in_progress" ? "진행중" :
           task.status === "done" ? "완료" : "취소됨"}
        </span>
      </header>

      <div className="max-w-xl mx-auto px-4 py-6 flex flex-col gap-4">
        {/* Urgent badge */}
        {task.is_urgent && (
          <div className="bg-coral/10 text-coral font-bold text-sm px-4 py-2.5 rounded-xl flex items-center gap-2">
            ⚡ 급한 부탁이에요!
          </div>
        )}

        {/* Main info */}
        <div className="bg-white rounded-2xl p-5 border border-mint/10">
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${CATEGORY_COLORS[task.category] ?? CATEGORY_COLORS["기타"]}`}>
            {task.category}
          </span>
          <h2 className="text-xl font-black mt-3 mb-2">{task.title}</h2>
          <p className="text-sm text-brand-sub leading-relaxed mb-4">{task.description}</p>
          <div className="flex items-center gap-4 text-xs text-brand-light">
            <span>📍 {task.location}</span>
            <span>⏰ {timeAgo(task.created_at)}</span>
          </div>
        </div>

        {/* Price */}
        <div className="bg-white rounded-2xl p-5 border border-mint/10 flex items-center justify-between">
          <span className="text-sm font-bold">보수</span>
          <span className="text-2xl font-black text-coral">{formatPrice(task.price)}</span>
        </div>

        {/* Requester */}
        <div className="bg-white rounded-2xl p-5 border border-mint/10">
          <p className="text-sm font-bold mb-3">요청자 정보</p>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-mint to-sky flex items-center justify-center text-white text-lg font-bold">
              {task.requester?.name?.[0] ?? "?"}
            </div>
            <div>
              <p className="font-bold">{task.requester?.name ?? "익명"}</p>
              <p className="text-xs text-brand-light">
                ⭐ {Number(task.requester?.rating ?? 5).toFixed(1)} · {task.requester?.completed_count ?? 0}회 완료
              </p>
            </div>
          </div>
        </div>

        {/* Helper (if assigned) */}
        {task.helper && (
          <div className="bg-white rounded-2xl p-5 border border-mint/10">
            <p className="text-sm font-bold mb-3">도우미 정보</p>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-coral to-coral-dark flex items-center justify-center text-white text-lg font-bold">
                {task.helper?.name?.[0] ?? "?"}
              </div>
              <div>
                <p className="font-bold">{task.helper?.name ?? "익명"}</p>
                <p className="text-xs text-brand-light">
                  ⭐ {Number(task.helper?.rating ?? 5).toFixed(1)} · {task.helper?.completed_count ?? 0}회 완료
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-mint/10">
        <div className="max-w-xl mx-auto flex gap-3">
          {task.status === "open" && !isRequester && (
            <button
              onClick={handleAccept}
              disabled={actionLoading}
              className="flex-1 bg-gradient-to-r from-mint to-sky text-white font-bold py-3.5 rounded-xl active:scale-[0.98] transition-all disabled:opacity-60"
            >
              {actionLoading ? "처리 중..." : "수락하기"}
            </button>
          )}

          {task.status === "open" && isRequester && (
            <button
              onClick={handleCancel}
              disabled={actionLoading}
              className="flex-1 bg-gray-100 text-brand-sub font-bold py-3.5 rounded-xl active:scale-[0.98] transition-all disabled:opacity-60"
            >
              취소하기
            </button>
          )}

          {task.status === "in_progress" && (isRequester || isHelper) && (
            <>
              <button
                onClick={goToChat}
                className="flex-1 bg-gradient-to-r from-mint to-sky text-white font-bold py-3.5 rounded-xl active:scale-[0.98] transition-all"
              >
                💬 채팅하기
              </button>
              {isRequester && (
                <button
                  onClick={handleComplete}
                  disabled={actionLoading}
                  className="flex-1 bg-gradient-to-r from-coral to-coral-dark text-white font-bold py-3.5 rounded-xl active:scale-[0.98] transition-all disabled:opacity-60"
                >
                  {actionLoading ? "처리 중..." : "완료하기"}
                </button>
              )}
            </>
          )}

          {task.status === "done" && isRequester && (
            <Link
              href={`/review/${taskId}`}
              className="flex-1 bg-gradient-to-r from-coral to-coral-dark text-white font-bold py-3.5 rounded-xl text-center active:scale-[0.98] transition-all"
            >
              리뷰 작성하기
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

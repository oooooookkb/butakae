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

  // 지원자 시스템
  const [applications, setApplications] = useState<any[]>([]);
  const [myApplication, setMyApplication] = useState<any>(null);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [offerPrice, setOfferPrice] = useState("");
  const [offerMessage, setOfferMessage] = useState("");

  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);

      const { data } = await supabase
        .from("tasks")
        .select(
          "*, requester:profiles!requester_id(*), helper:profiles!helper_id(*)"
        )
        .eq("id", taskId)
        .single();

      setTask(data);

      // 지원자 목록 가져오기
      if (data && data.status === "open") {
        const { data: apps } = await supabase
          .from("task_applications")
          .select("*, applicant:profiles!user_id(*)")
          .eq("task_id", taskId)
          .eq("status", "pending")
          .order("created_at", { ascending: true });

        if (apps) setApplications(apps);

        // 내 지원 확인
        if (user) {
          const myApp = apps?.find((a: any) => a.user_id === user.id);
          if (myApp) setMyApplication(myApp);
        }
      }

      setLoading(false);
    };
    init();
  }, [taskId]);

  // 즉시 수락 (기존 가격)
  const handleInstantAccept = async () => {
    setActionLoading(true);
    const supabase = createClient();

    const { data: result, error } = await supabase.rpc("accept_task", {
      p_task_id: taskId,
      p_helper_id: currentUserId,
    });

    if (error || !result?.success) {
      alert(
        result?.error === "already_taken"
          ? "이미 다른 분이 수락했어요!"
          : "수락에 실패했어요. 다시 시도해주세요."
      );
      setActionLoading(false);
      router.refresh();
      return;
    }

    if (result.chat_room_id) {
      router.push(`/chat/${result.chat_room_id}`);
    }
  };

  // 가격 제안 지원
  const handleApply = async () => {
    if (!offerPrice || Number(offerPrice) <= 0) return;
    setActionLoading(true);
    const supabase = createClient();

    const { data: result, error } = await supabase.rpc("apply_to_task", {
      p_task_id: taskId,
      p_user_id: currentUserId,
      p_offer_price: Number(offerPrice),
      p_message: offerMessage.trim() || null,
    });

    if (error || !result?.success) {
      const msg =
        result?.error === "already_applied"
          ? "이미 지원했어요!"
          : result?.error === "cannot_apply_own"
            ? "본인 부탁에는 지원할 수 없어요"
            : "지원에 실패했어요.";
      alert(msg);
      setActionLoading(false);
      return;
    }

    setShowOfferModal(false);
    setMyApplication({ offer_price: Number(offerPrice), status: "pending" });
    setActionLoading(false);
  };

  // 요청자가 지원자 선택
  const handleSelectApplicant = async (applicationId: string) => {
    setActionLoading(true);
    const supabase = createClient();

    const { data: result, error } = await supabase.rpc("accept_application", {
      p_application_id: applicationId,
      p_requester_id: currentUserId,
    });

    if (error || !result?.success) {
      alert("선택에 실패했어요. 다시 시도해주세요.");
      setActionLoading(false);
      return;
    }

    if (result.chat_room_id) {
      router.push(`/chat/${result.chat_room_id}`);
    }
  };

  const handleComplete = async () => {
    setActionLoading(true);
    const supabase = createClient();
    const { data: result } = await supabase.rpc("complete_task", {
      p_task_id: taskId,
      p_user_id: currentUserId,
    });

    if (!result?.success) {
      alert("완료 처리에 실패했어요.");
      setActionLoading(false);
      return;
    }
    router.push(`/review/${taskId}`);
  };

  const handleCancel = async () => {
    setActionLoading(true);
    const supabase = createClient();
    const { data: result } = await supabase.rpc("cancel_task", {
      p_task_id: taskId,
      p_user_id: currentUserId,
    });

    if (!result?.success) {
      alert("취소 처리에 실패했어요.");
      setActionLoading(false);
      return;
    }
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
        <Link href="/" className="text-mint-dark text-sm font-bold mt-2">
          홈으로 돌아가기
        </Link>
      </div>
    );
  }

  const isRequester = currentUserId === task.requester_id;
  const isHelper = currentUserId === task.helper_id;
  const displayPrice = task.final_price ?? task.price;

  return (
    <div className="min-h-screen bg-bg pb-28">
      <header className="sticky top-0 z-40 bg-white border-b border-mint/10 px-4 py-4 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 rounded-full bg-bg flex items-center justify-center text-lg"
        >
          ←
        </button>
        <h1 className="text-base font-black flex-1">부탁 상세</h1>
        <span
          className={`text-xs font-bold px-2.5 py-1 rounded-full ${
            task.status === "open"
              ? "bg-mint/10 text-mint-dark"
              : task.status === "in_progress"
                ? "bg-yellow-100 text-yellow-700"
                : task.status === "done"
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-100 text-gray-600"
          }`}
        >
          {task.status === "open"
            ? "모집중"
            : task.status === "in_progress"
              ? "진행중"
              : task.status === "done"
                ? "완료"
                : "취소됨"}
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
          <span
            className={`text-xs font-bold px-2.5 py-1 rounded-full ${CATEGORY_COLORS[task.category] ?? CATEGORY_COLORS["기타"]}`}
          >
            {task.category}
          </span>
          <h2 className="text-xl font-black mt-3 mb-2">{task.title}</h2>
          <p className="text-sm text-brand-sub leading-relaxed mb-4">
            {task.description}
          </p>
          <div className="flex items-center gap-4 text-xs text-brand-light">
            <span>📍 {task.location}</span>
            <span>⏰ {timeAgo(task.created_at)}</span>
          </div>
        </div>

        {/* Price */}
        <div className="bg-white rounded-2xl p-5 border border-mint/10">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold">
              {task.final_price ? "최종 금액" : "제시 금액"}
            </span>
            <span className="text-2xl font-black text-coral">
              {formatPrice(displayPrice)}
            </span>
          </div>
          {task.final_price && task.final_price !== task.price && (
            <p className="text-xs text-brand-light mt-1 text-right">
              원래 제시: {formatPrice(task.price)}
            </p>
          )}
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
                ⭐ {Number(task.requester?.rating ?? 5).toFixed(1)} ·{" "}
                {task.requester?.completed_count ?? 0}회 완료
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
                  ⭐ {Number(task.helper?.rating ?? 5).toFixed(1)} ·{" "}
                  {task.helper?.completed_count ?? 0}회 완료
                </p>
              </div>
            </div>
          </div>
        )}

        {/* === 지원자 목록 (요청자에게만 표시) === */}
        {task.status === "open" && isRequester && applications.length > 0 && (
          <div className="bg-white rounded-2xl p-5 border border-mint/10">
            <p className="text-sm font-bold mb-3">
              🙋 지원자 {applications.length}명
            </p>
            <div className="flex flex-col gap-3">
              {applications.map((app: any) => (
                <div
                  key={app.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-bg border border-mint/8"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky to-mint flex items-center justify-center text-white font-bold shrink-0">
                    {app.applicant?.name?.[0] ?? "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-sm">
                        {app.applicant?.name ?? "익명"}
                      </p>
                      <span className="text-[11px] text-brand-light">
                        ⭐ {Number(app.applicant?.rating ?? 5).toFixed(1)}
                      </span>
                    </div>
                    <p className="text-sm font-black text-coral">
                      {formatPrice(app.offer_price)}
                    </p>
                    {app.message && (
                      <p className="text-xs text-brand-sub mt-0.5 truncate">
                        &quot;{app.message}&quot;
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleSelectApplicant(app.id)}
                    disabled={actionLoading}
                    className="px-3 py-1.5 bg-gradient-to-r from-mint to-sky text-white text-xs font-bold rounded-lg shrink-0 active:scale-95 transition-transform disabled:opacity-60"
                  >
                    선택
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 내 지원 상태 (도우미에게 표시) */}
        {task.status === "open" && !isRequester && myApplication && (
          <div className="bg-mint/5 rounded-2xl p-4 border border-mint/15 text-center">
            <p className="text-sm font-bold text-mint-dark">
              ✅ {formatPrice(myApplication.offer_price)}에 지원 완료
            </p>
            <p className="text-xs text-brand-light mt-1">
              요청자가 선택하면 알림을 보내드릴게요
            </p>
          </div>
        )}
      </div>

      {/* === 가격 제안 모달 === */}
      {showOfferModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
          <div className="w-full max-w-xl bg-white rounded-t-3xl p-6 pb-8">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-black">💰 가격 제안</h3>
              <button
                onClick={() => setShowOfferModal(false)}
                className="text-brand-light text-lg"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-brand-light mb-4">
              요청자 제시 금액:{" "}
              <span className="font-bold text-brand-text">
                {formatPrice(task.price)}
              </span>
            </p>

            <label className="text-sm font-bold mb-2 block">
              제안할 금액 (원)
            </label>
            <input
              type="number"
              value={offerPrice}
              onChange={(e) => setOfferPrice(e.target.value)}
              placeholder={String(task.price)}
              className="w-full px-4 py-3 rounded-xl border border-mint/15 bg-bg text-sm focus:outline-none focus:border-mint transition-colors mb-3"
            />
            {offerPrice && Number(offerPrice) > 0 && (
              <p className="text-xs text-mint-dark font-bold mb-4">
                {Number(offerPrice).toLocaleString("ko-KR")}원
                {Number(offerPrice) < task.price && (
                  <span className="text-brand-light ml-1">
                    ({formatPrice(task.price - Number(offerPrice))} 저렴)
                  </span>
                )}
                {Number(offerPrice) > task.price && (
                  <span className="text-coral ml-1">
                    ({formatPrice(Number(offerPrice) - task.price)} 비쌈)
                  </span>
                )}
              </p>
            )}

            <label className="text-sm font-bold mb-2 block">
              한마디 (선택)
            </label>
            <input
              type="text"
              value={offerMessage}
              onChange={(e) => setOfferMessage(e.target.value)}
              placeholder="예: 30분 안에 해드릴 수 있어요!"
              className="w-full px-4 py-3 rounded-xl border border-mint/15 bg-bg text-sm focus:outline-none focus:border-mint transition-colors mb-5"
            />

            <button
              onClick={handleApply}
              disabled={
                actionLoading || !offerPrice || Number(offerPrice) <= 0
              }
              className="w-full bg-gradient-to-r from-coral to-coral-dark text-white font-bold py-3.5 rounded-xl active:scale-[0.98] transition-all disabled:opacity-60"
            >
              {actionLoading ? "지원 중..." : "지원하기"}
            </button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-mint/10">
        <div className="max-w-xl mx-auto flex gap-3">
          {/* 도우미 — open 상태, 아직 지원 안 함 */}
          {task.status === "open" && !isRequester && !myApplication && (
            <>
              <button
                onClick={handleInstantAccept}
                disabled={actionLoading}
                className="flex-1 bg-gradient-to-r from-mint to-sky text-white font-bold py-3.5 rounded-xl active:scale-[0.98] transition-all disabled:opacity-60"
              >
                {actionLoading
                  ? "처리 중..."
                  : `${formatPrice(task.price)}에 바로 하기`}
              </button>
              <button
                onClick={() => {
                  setOfferPrice(String(task.price));
                  setShowOfferModal(true);
                }}
                className="flex-1 bg-white border-2 border-coral text-coral font-bold py-3.5 rounded-xl active:scale-[0.98] transition-all"
              >
                💰 가격 제안
              </button>
            </>
          )}

          {/* 요청자 — open 상태 */}
          {task.status === "open" && isRequester && (
            <button
              onClick={handleCancel}
              disabled={actionLoading}
              className="flex-1 bg-gray-100 text-brand-sub font-bold py-3.5 rounded-xl active:scale-[0.98] transition-all disabled:opacity-60"
            >
              취소하기
            </button>
          )}

          {/* 진행중 */}
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

          {/* 완료 → 리뷰 */}
          {task.status === "done" && (isRequester || isHelper) && (
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

"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const QUICK_CHIPS = [
  "친절해요 😊",
  "빨라요 ⚡",
  "꼼꼼해요 ✨",
  "다시 부탁하고 싶어요 💛",
];

export default function ReviewPage() {
  const router = useRouter();
  const params = useParams();
  const taskId = params.taskId as string;

  const [task, setTask] = useState<any>(null);
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);

  const [currentUserId, setCurrentUserId] = useState("");
  const [reviewTarget, setReviewTarget] = useState<any>(null);

  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setCurrentUserId(user.id);

      const { data: t } = await supabase
        .from("tasks")
        .select("*, helper:profiles!helper_id(*), requester:profiles!requester_id(*)")
        .eq("id", taskId)
        .single();

      setTask(t);

      // 양방향 리뷰: 내가 요청자면 도우미를 평가, 도우미면 요청자를 평가
      if (t) {
        if (user.id === t.requester_id) {
          setReviewTarget(t.helper);
        } else if (user.id === t.helper_id) {
          setReviewTarget(t.requester);
        }
      }

      // 내가 이미 리뷰했는지 확인 (양방향이므로 reviewer_id로 체크)
      const { data: existing } = await supabase
        .from("reviews")
        .select("id")
        .eq("task_id", taskId)
        .eq("reviewer_id", user.id)
        .limit(1);

      if (existing && existing.length > 0) setAlreadyReviewed(true);
      setLoading(false);
    };
    init();
  }, [taskId, router]);

  const handleSubmit = async () => {
    if (!reviewTarget) return;
    setSubmitting(true);

    const supabase = createClient();

    const revieweeId = reviewTarget.id;

    // Insert review
    await supabase.from("reviews").insert({
      task_id: taskId,
      reviewer_id: currentUserId,
      reviewee_id: revieweeId,
      rating,
      content: content.trim() || null,
    });

    // 상대방 평균 rating 재계산
    const { data: allReviews } = await supabase
      .from("reviews")
      .select("rating")
      .eq("reviewee_id", revieweeId);

    if (allReviews && allReviews.length > 0) {
      const avg = allReviews.reduce((sum: number, r: any) => sum + r.rating, 0) / allReviews.length;
      await supabase
        .from("profiles")
        .update({
          rating: Math.round(avg * 10) / 10,
          completed_count: allReviews.length,
        })
        .eq("id", revieweeId);
    }

    // 상대방에게 리뷰 알림
    await supabase.from("notifications").insert({
      user_id: revieweeId,
      type: "new_review",
      title: "새 리뷰가 도착했어요!",
      body: `⭐ ${rating}점 리뷰가 작성되었습니다`,
      task_id: taskId,
      related_user_id: currentUserId,
    });

    router.push("/my-tasks/done");
  };

  const addChip = (chip: string) => {
    setContent((prev) => (prev ? prev + " " + chip : chip));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-4 border-mint border-t-transparent animate-spin" />
      </div>
    );
  }

  if (alreadyReviewed) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center text-brand-light px-6">
        <p className="text-4xl mb-3">✅</p>
        <p className="font-semibold mb-2">이미 리뷰를 작성했어요</p>
        <button onClick={() => router.push("/my-tasks/done")} className="text-mint-dark text-sm font-bold">
          돌아가기
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg pb-28">
      <header className="sticky top-0 z-40 bg-white border-b border-mint/10 px-4 py-4 flex items-center gap-3">
        <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-bg flex items-center justify-center text-lg">
          ←
        </button>
        <h1 className="text-base font-black flex-1">리뷰 작성</h1>
      </header>

      <div className="max-w-xl mx-auto px-4 py-6 flex flex-col gap-5">
        {/* Task + Helper info */}
        {reviewTarget && (
          <div className="bg-white rounded-2xl p-5 border border-mint/10 text-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-mint to-sky flex items-center justify-center text-white text-2xl font-bold mx-auto mb-3">
              {reviewTarget.name?.[0] ?? "?"}
            </div>
            <p className="font-bold text-lg">{reviewTarget.name ?? "상대방"}</p>
            <p className="text-xs text-brand-light mt-1">📋 {task?.title}</p>
          </div>
        )}

        {/* Star rating */}
        <div className="bg-white rounded-2xl p-5 border border-mint/10 text-center">
          <p className="text-sm font-bold mb-3">별점을 선택해 주세요</p>
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                className={`text-3xl transition-transform ${
                  star <= rating ? "scale-110" : "opacity-30"
                }`}
              >
                ⭐
              </button>
            ))}
          </div>
          <p className="text-xs text-brand-light mt-2">{rating}점</p>
        </div>

        {/* Quick chips */}
        <div className="flex flex-wrap gap-2">
          {QUICK_CHIPS.map((chip) => (
            <button
              key={chip}
              onClick={() => addChip(chip)}
              className="px-3.5 py-2 rounded-full text-xs font-semibold border border-mint/15 bg-white text-brand-sub hover:border-mint hover:text-mint-dark transition-all active:scale-95"
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Content */}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="어떤 점이 좋았나요? (선택)"
          rows={4}
          className="w-full px-4 py-3 rounded-xl border border-mint/15 bg-white text-sm focus:outline-none focus:border-mint transition-colors resize-none"
        />
      </div>

      {/* Submit */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-mint/10">
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full bg-gradient-to-r from-coral to-coral-dark text-white font-bold py-3.5 rounded-xl shadow-coral active:scale-[0.98] transition-all disabled:opacity-60"
        >
          {submitting ? "등록 중..." : "리뷰 등록"}
        </button>
      </div>
    </div>
  );
}

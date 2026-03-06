"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CATEGORIES } from "@/lib/data";

export default function CreateTaskPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [location, setLocation] = useState("");
  const [isUrgent, setIsUrgent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

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
        if (profile?.location) setLocation(profile.location);
      }
    };
    init();
  }, []);

  const handleSubmit = async () => {
    if (!title.trim()) { setError("제목을 입력해 주세요"); return; }
    if (!category) { setError("카테고리를 선택해 주세요"); return; }
    if (!price || Number(price) <= 0) { setError("금액을 입력해 주세요"); return; }
    if (!location.trim()) { setError("위치를 입력해 주세요"); return; }

    setSubmitting(true);
    setError("");

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const { data, error: insertError } = await supabase
      .from("tasks")
      .insert({
        title: title.trim(),
        category,
        description: description.trim(),
        price: Number(price),
        location: location.trim(),
        is_urgent: isUrgent,
        requester_id: user.id,
      })
      .select()
      .single();

    if (insertError) {
      setError("부탁 올리기에 실패했어요. 다시 시도해 주세요.");
      setSubmitting(false);
      return;
    }

    router.push(`/tasks/${data.id}`);
  };

  const categories = CATEGORIES.filter((c) => c.label !== "전체");

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-40 bg-white border-b border-mint/10 px-4 py-4 flex items-center gap-3">
        <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-bg flex items-center justify-center text-lg">
          ←
        </button>
        <h1 className="text-base font-black flex-1">부탁 올리기</h1>
      </header>

      <div className="max-w-xl mx-auto px-4 py-6 pb-28">
        {/* Title */}
        <div className="mb-5">
          <label className="text-sm font-bold mb-2 block">어떤 부탁인가요?</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 편의점에서 우유 사다주세요"
            className="w-full px-4 py-3 rounded-xl border border-mint/15 bg-white text-sm focus:outline-none focus:border-mint transition-colors"
          />
        </div>

        {/* Category */}
        <div className="mb-5">
          <label className="text-sm font-bold mb-2 block">카테고리</label>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat.label}
                onClick={() => setCategory(cat.label)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold border transition-all ${
                  category === cat.label
                    ? "border-mint bg-mint/10 text-mint-dark"
                    : "border-mint/15 bg-white text-brand-sub"
                }`}
              >
                {cat.emoji} {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Description */}
        <div className="mb-5">
          <label className="text-sm font-bold mb-2 block">자세한 설명</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="자세히 설명해 주세요..."
            rows={4}
            className="w-full px-4 py-3 rounded-xl border border-mint/15 bg-white text-sm focus:outline-none focus:border-mint transition-colors resize-none"
          />
        </div>

        {/* Price */}
        <div className="mb-5">
          <label className="text-sm font-bold mb-2 block">금액 (원)</label>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="금액을 입력하세요"
            className="w-full px-4 py-3 rounded-xl border border-mint/15 bg-white text-sm focus:outline-none focus:border-mint transition-colors"
          />
          {price && Number(price) > 0 && (
            <p className="text-xs text-mint-dark font-bold mt-1">
              {Number(price).toLocaleString("ko-KR")}원
            </p>
          )}
        </div>

        {/* Location */}
        <div className="mb-5">
          <label className="text-sm font-bold mb-2 block">위치</label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="어디서 해야 하나요?"
            className="w-full px-4 py-3 rounded-xl border border-mint/15 bg-white text-sm focus:outline-none focus:border-mint transition-colors"
          />
        </div>

        {/* Urgent toggle */}
        <div className="mb-6 flex items-center justify-between bg-white rounded-xl border border-mint/15 px-4 py-3">
          <span className="text-sm font-bold">⚡ 급해요</span>
          <button
            onClick={() => setIsUrgent(!isUrgent)}
            className={`w-12 h-7 rounded-full transition-colors relative ${
              isUrgent ? "bg-coral" : "bg-gray-200"
            }`}
          >
            <div
              className={`w-5 h-5 bg-white rounded-full absolute top-1 transition-transform ${
                isUrgent ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {error && (
          <p className="text-coral text-sm font-semibold mb-4">{error}</p>
        )}
      </div>

      {/* Submit */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-mint/10">
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full bg-gradient-to-r from-coral to-coral-dark text-white font-bold py-3.5 rounded-xl shadow-coral active:scale-[0.98] transition-all disabled:opacity-60"
        >
          {submitting ? "올리는 중..." : "부탁 올리기"}
        </button>
      </div>
    </div>
  );
}

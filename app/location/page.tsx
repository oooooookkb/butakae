"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const NEIGHBORHOODS = [
  "영통구", "매탄동", "원천동", "광교동", "인계동",
  "수원역", "팔달구", "권선구", "장안구", "세류동",
  "호매실동", "정자동", "망포동", "동탄",
];

export default function LocationPage() {
  const router = useRouter();
  const [currentLocation, setCurrentLocation] = useState("");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("location")
        .eq("id", user.id)
        .single();
      if (profile?.location) setCurrentLocation(profile.location);
    };
    init();
  }, []);

  const selectLocation = async (location: string) => {
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from("profiles")
      .update({ location })
      .eq("id", user.id);

    router.push("/");
  };

  const filtered = search
    ? NEIGHBORHOODS.filter((n) => n.includes(search))
    : NEIGHBORHOODS;

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-40 bg-white border-b border-mint/10 px-4 py-4 flex items-center gap-3">
        <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-bg flex items-center justify-center text-lg">
          ←
        </button>
        <h1 className="text-base font-black flex-1">내 동네 설정</h1>
      </header>

      <div className="max-w-xl mx-auto px-4 py-6">
        {currentLocation && (
          <div className="bg-mint/10 rounded-xl p-4 mb-6 flex items-center gap-2">
            <span className="text-lg">📍</span>
            <div>
              <p className="text-xs text-brand-light">현재 설정된 동네</p>
              <p className="font-bold text-mint-dark">{currentLocation}</p>
            </div>
          </div>
        )}

        <div className="mb-5">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="동네 이름 검색..."
            className="w-full px-4 py-3 rounded-xl border border-mint/15 bg-white text-sm focus:outline-none focus:border-mint transition-colors"
          />
        </div>

        <p className="text-sm font-bold mb-3">수원시 동네 목록</p>
        <div className="flex flex-wrap gap-2">
          {filtered.map((loc) => (
            <button
              key={loc}
              onClick={() => selectLocation(loc)}
              disabled={saving}
              className={`px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all active:scale-95 ${
                currentLocation === loc
                  ? "border-mint bg-mint/10 text-mint-dark"
                  : "border-mint/15 bg-white text-brand-sub hover:border-mint"
              } disabled:opacity-60`}
            >
              📍 {loc}
            </button>
          ))}
        </div>

        {filtered.length === 0 && (
          <p className="text-center py-8 text-brand-light text-sm">검색 결과가 없어요</p>
        )}
      </div>
    </div>
  );
}

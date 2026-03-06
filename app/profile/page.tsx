"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import MobileTabBar from "@/components/MobileTabBar";
import { createClient } from "@/lib/supabase/client";
import { formatPrice, timeAgo, CATEGORY_EMOJI } from "@/lib/data";

interface Badge {
  id: string;
  name: string;
  emoji: string;
  description: string;
  earned_at: string;
}

interface ReviewItem {
  id: string;
  rating: number;
  content: string | null;
  created_at: string;
  reviewer_name: string;
  reviewer_avatar: string | null;
}

interface RecentTask {
  id: string;
  title: string;
  category: string;
  price: number;
  status: string;
  created_at: string;
}

interface ProfileDetail {
  id: string;
  name: string;
  avatar_url: string | null;
  location: string;
  bio: string;
  rating: number;
  completed_count: number;
  response_rate: number;
  total_requests: number;
  total_helped: number;
  created_at: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileDetail | null>(null);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [recentTasks, setRecentTasks] = useState<RecentTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [editBio, setEditBio] = useState(false);
  const [bioText, setBioText] = useState("");
  const [activeTab, setActiveTab] = useState<"reviews" | "tasks">("reviews");

  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      // 먼저 통계 갱신 (실패해도 무시)
      await supabase.rpc("refresh_profile_stats", { p_user_id: user.id });

      // 프로필 상세 조회
      const { data, error } = await supabase.rpc("get_profile_detail", { p_user_id: user.id });

      if (!error && data) {
        setProfile(data.profile);
        setBadges(data.badges ?? []);
        setReviews(data.reviews ?? []);
        setRecentTasks(data.recent_tasks ?? []);
        setBioText(data.profile?.bio ?? "");
      } else {
        // fallback: 기본 프로필만
        const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).single();
        if (p) {
          setProfile({
            id: p.id,
            name: p.name,
            avatar_url: p.avatar_url,
            location: p.location ?? "동네 미설정",
            bio: p.bio ?? "",
            rating: p.rating ?? 5.0,
            completed_count: p.completed_count ?? 0,
            response_rate: p.response_rate ?? 0,
            total_requests: p.total_requests ?? 0,
            total_helped: p.total_helped ?? 0,
            created_at: p.created_at,
          });
          setBioText(p.bio ?? "");
        }
      }
      setLoading(false);
    };
    init();
  }, [router]);

  const saveBio = async () => {
    if (!profile) return;
    const supabase = createClient();
    await supabase.from("profiles").update({ bio: bioText }).eq("id", profile.id);
    setProfile((p) => p ? { ...p, bio: bioText } : p);
    setEditBio(false);
  };

  const handleSignOut = async () => {
    await createClient().auth.signOut();
    router.push("/login");
  };

  // 별점 렌더링
  const Stars = ({ rating }: { rating: number }) => (
    <span className="text-yellow-400">
      {"★".repeat(Math.round(rating))}
      {"☆".repeat(5 - Math.round(rating))}
    </span>
  );

  // 응답률 색상
  const responseColor = (rate: number) => {
    if (rate >= 90) return "text-green-600";
    if (rate >= 70) return "text-yellow-600";
    return "text-brand-light";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-4 border-mint border-t-transparent animate-spin" />
      </div>
    );
  }

  const name = profile?.name ?? "익명";
  const joinDate = profile?.created_at ? new Date(profile.created_at).toLocaleDateString("ko-KR", { year: "numeric", month: "long" }) : "";

  const ProfileContent = () => (
    <div className="max-w-2xl mx-auto">
      {/* 프로필 카드 */}
      <div className="bg-white rounded-3xl border border-mint/10 overflow-hidden mb-4">
        {/* 배경 그라디언트 */}
        <div className="h-24 bg-gradient-to-r from-mint via-sky to-[#667eea] relative">
          <div className="absolute -bottom-10 left-6">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-mint to-sky flex items-center justify-center text-4xl text-white font-black border-4 border-white shadow-mint">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-full h-full rounded-2xl object-cover" />
              ) : (
                name[0]
              )}
            </div>
          </div>
        </div>

        <div className="pt-14 px-6 pb-6">
          <div className="flex items-start justify-between mb-1">
            <div>
              <h2 className="text-xl font-black">{name}</h2>
              <p className="text-sm text-brand-light">📍 {profile?.location ?? "동네 미설정"}</p>
            </div>
            <button
              onClick={handleSignOut}
              className="text-xs text-coral font-bold border border-coral/20 px-3 py-1.5 rounded-full hover:bg-coral/5 transition-colors"
            >
              로그아웃
            </button>
          </div>

          {/* 소개글 */}
          <div className="mt-3 mb-4">
            {editBio ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={bioText}
                  onChange={(e) => setBioText(e.target.value)}
                  placeholder="자기소개를 입력해보세요"
                  className="flex-1 px-3 py-2 rounded-xl border border-mint/20 text-sm focus:outline-none focus:ring-2 focus:ring-mint/30"
                  maxLength={100}
                  autoFocus
                />
                <button onClick={saveBio} className="bg-mint text-white px-3 py-2 rounded-xl text-xs font-bold">저장</button>
                <button onClick={() => { setEditBio(false); setBioText(profile?.bio ?? ""); }} className="text-brand-light px-2 text-xs">취소</button>
              </div>
            ) : (
              <button
                onClick={() => setEditBio(true)}
                className="text-sm text-brand-sub hover:text-brand-text transition-colors text-left w-full"
              >
                {profile?.bio || "✏️ 자기소개를 작성해보세요"}
              </button>
            )}
          </div>

          {/* 통계 */}
          <div className="grid grid-cols-4 gap-3 bg-bg rounded-2xl p-4">
            <div className="text-center">
              <p className="text-xl font-black text-mint">{Number(profile?.rating ?? 5).toFixed(1)}</p>
              <p className="text-[10px] text-brand-light font-medium mt-0.5">평점</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-black text-coral">{profile?.completed_count ?? 0}</p>
              <p className="text-[10px] text-brand-light font-medium mt-0.5">완료</p>
            </div>
            <div className="text-center">
              <p className={`text-xl font-black ${responseColor(profile?.response_rate ?? 0)}`}>
                {Math.round(profile?.response_rate ?? 0)}%
              </p>
              <p className="text-[10px] text-brand-light font-medium mt-0.5">응답률</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-black text-[#667eea]">{profile?.total_helped ?? 0}</p>
              <p className="text-[10px] text-brand-light font-medium mt-0.5">도움</p>
            </div>
          </div>

          {joinDate && (
            <p className="text-[11px] text-brand-light mt-3 text-center">📅 {joinDate}부터 함께하고 있어요</p>
          )}
        </div>
      </div>

      {/* 뱃지 섹션 */}
      <div className="bg-white rounded-3xl border border-mint/10 p-6 mb-4">
        <h3 className="text-base font-black mb-4 flex items-center gap-2">
          🏅 획득한 뱃지
          {badges.length > 0 && (
            <span className="text-xs font-bold text-mint bg-mint/10 px-2 py-0.5 rounded-full">{badges.length}개</span>
          )}
        </h3>
        {badges.length > 0 ? (
          <div className="flex flex-wrap gap-2.5">
            {badges.map((badge) => (
              <div
                key={badge.id}
                className="flex items-center gap-2 bg-gradient-to-r from-bg to-bg-2 border border-mint/10 rounded-2xl px-4 py-2.5 group hover:border-mint/30 transition-colors"
                title={badge.description}
              >
                <span className="text-2xl">{badge.emoji}</span>
                <div>
                  <p className="text-xs font-bold">{badge.name}</p>
                  <p className="text-[10px] text-brand-light">{badge.description}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-3xl mb-2">🎯</p>
            <p className="text-sm text-brand-light">아직 뱃지가 없어요</p>
            <p className="text-xs text-brand-light mt-1">부탁을 완료하면 뱃지를 획득할 수 있어요!</p>
          </div>
        )}
      </div>

      {/* 탭: 리뷰 / 최근 완료 */}
      <div className="bg-white rounded-3xl border border-mint/10 overflow-hidden mb-4">
        <div className="flex border-b border-mint/10">
          <button
            onClick={() => setActiveTab("reviews")}
            className={`flex-1 py-3.5 text-sm font-bold transition-colors ${
              activeTab === "reviews"
                ? "text-mint-dark border-b-2 border-mint bg-mint/5"
                : "text-brand-light"
            }`}
          >
            ⭐ 받은 리뷰 ({reviews.length})
          </button>
          <button
            onClick={() => setActiveTab("tasks")}
            className={`flex-1 py-3.5 text-sm font-bold transition-colors ${
              activeTab === "tasks"
                ? "text-mint-dark border-b-2 border-mint bg-mint/5"
                : "text-brand-light"
            }`}
          >
            ✅ 최근 완료 ({recentTasks.length})
          </button>
        </div>

        <div className="p-5">
          {activeTab === "reviews" ? (
            reviews.length > 0 ? (
              <div className="flex flex-col gap-4">
                {reviews.map((review) => (
                  <div key={review.id} className="flex gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-mint/20 to-sky/20 flex items-center justify-center text-sm font-bold text-mint-dark flex-shrink-0">
                      {review.reviewer_name?.[0] ?? "?"}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-bold">{review.reviewer_name}</span>
                        <Stars rating={review.rating} />
                      </div>
                      <p className="text-sm text-brand-sub leading-relaxed">
                        {review.content || "리뷰 내용 없음"}
                      </p>
                      <p className="text-[10px] text-brand-light mt-1">{timeAgo(review.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-3xl mb-2">📝</p>
                <p className="text-sm text-brand-light">아직 받은 리뷰가 없어요</p>
              </div>
            )
          ) : recentTasks.length > 0 ? (
            <div className="flex flex-col gap-3">
              {recentTasks.map((task) => (
                <Link
                  key={task.id}
                  href={`/tasks/${task.id}`}
                  className="flex items-center gap-3 p-3 rounded-2xl bg-bg hover:bg-bg-2 transition-colors"
                >
                  <span className="text-2xl">{CATEGORY_EMOJI[task.category] ?? "✨"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{task.title}</p>
                    <p className="text-[11px] text-brand-light">{timeAgo(task.created_at)}</p>
                  </div>
                  <span className="text-sm font-black text-coral whitespace-nowrap">{formatPrice(task.price)}</span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-3xl mb-2">📋</p>
              <p className="text-sm text-brand-light">아직 완료한 부탁이 없어요</p>
            </div>
          )}
        </div>
      </div>

      {/* 빠른 메뉴 */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {[
          { icon: "📋", label: "내가 올린 부탁", href: "/my-tasks" },
          { icon: "💰", label: "돈벌기", href: "/earn" },
          { icon: "💬", label: "채팅", href: "/chat" },
          { icon: "📍", label: "동네 설정", href: "/location" },
          { icon: "🔔", label: "알림", href: "/notifications" },
          { icon: "❤️", label: "즐겨찾기", href: "/favorites" },
        ].map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="bg-white rounded-2xl p-4 border border-mint/10 flex items-center gap-3 hover:border-mint/25 transition-colors"
          >
            <span className="text-2xl">{item.icon}</span>
            <span className="text-sm font-semibold">{item.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );

  return (
    <>
      {/* PC LAYOUT */}
      <div className="hidden md:flex min-h-screen">
        <Sidebar />
        <main className="ml-[260px] flex-1">
          <header className="sticky top-0 z-40 flex items-center justify-between px-8 py-4 bg-bg/90 backdrop-blur-xl border-b border-mint/10">
            <h1 className="text-xl font-black">👤 프로필</h1>
          </header>
          <div className="p-8">
            <ProfileContent />
          </div>
        </main>
      </div>

      {/* MOBILE LAYOUT */}
      <div className="md:hidden min-h-screen bg-bg">
        <header className="sticky top-0 z-50 bg-white border-b border-mint/10 flex items-center gap-3 px-4 py-3">
          <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-bg flex items-center justify-center text-lg">←</button>
          <h1 className="text-base font-black flex-1">프로필</h1>
        </header>
        <div className="pb-24 px-3 pt-3">
          <ProfileContent />
        </div>
        <MobileTabBar />
      </div>
    </>
  );
}

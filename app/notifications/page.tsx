"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { timeAgo } from "@/lib/data";
import MobileTabBar from "@/components/MobileTabBar";
import Sidebar from "@/components/Sidebar";

const TYPE_CONFIG: Record<string, { icon: string; color: string }> = {
  task_accepted: { icon: "🤝", color: "bg-mint/10 text-mint-dark" },
  task_completed: { icon: "✅", color: "bg-green-100 text-green-700" },
  task_cancelled: { icon: "❌", color: "bg-red-100 text-red-600" },
  new_message: { icon: "💬", color: "bg-blue-100 text-blue-700" },
  new_review: { icon: "⭐", color: "bg-yellow-100 text-yellow-700" },
  payment_confirmed: { icon: "💰", color: "bg-purple-100 text-purple-700" },
};

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      // 알림 가져오기
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (data) setNotifications(data);
      setLoading(false);

      // 읽지 않은 알림 읽음 처리
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("is_read", false);
    };
    init();
  }, [router]);

  const handleClick = (n: any) => {
    if (n.task_id) {
      if (n.type === "new_message") {
        // 채팅방으로 이동 (task_id로 chat_room 찾기)
        router.push(`/tasks/${n.task_id}`);
      } else {
        router.push(`/tasks/${n.task_id}`);
      }
    }
  };

  const Content = () => {
    if (loading) {
      return (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white rounded-2xl p-4 border border-mint/10 animate-pulse"
            >
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-full bg-bg-2" />
                <div className="flex-1">
                  <div className="h-4 bg-bg-2 rounded w-40 mb-2" />
                  <div className="h-3 bg-bg-2 rounded w-60" />
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (notifications.length === 0) {
      return (
        <div className="text-center py-16 text-brand-light">
          <p className="text-4xl mb-3">🔔</p>
          <p className="font-semibold">아직 알림이 없어요</p>
          <p className="text-xs mt-1">
            부탁이 수락되거나 새 메시지가 오면 알려드릴게요
          </p>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-2">
        {notifications.map((n) => {
          const config = TYPE_CONFIG[n.type] ?? {
            icon: "📢",
            color: "bg-gray-100 text-gray-600",
          };
          return (
            <button
              key={n.id}
              onClick={() => handleClick(n)}
              className={`w-full text-left bg-white rounded-2xl p-4 border transition-all hover:-translate-y-0.5 hover:shadow-mint ${
                n.is_read ? "border-mint/5 opacity-70" : "border-mint/15"
              }`}
            >
              <div className="flex gap-3 items-start">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0 ${config.color}`}
                >
                  {config.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="font-bold text-sm">{n.title}</p>
                    {!n.is_read && (
                      <span className="w-2 h-2 bg-coral rounded-full shrink-0" />
                    )}
                  </div>
                  {n.body && (
                    <p className="text-xs text-brand-sub truncate">{n.body}</p>
                  )}
                  <p className="text-[11px] text-brand-light mt-1">
                    {timeAgo(n.created_at)}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <>
      {/* PC */}
      <div className="hidden md:flex min-h-screen">
        <Sidebar />
        <main className="ml-[260px] flex-1">
          <div className="max-w-3xl mx-auto px-8 py-8">
            <h1 className="text-xl font-black mb-6">🔔 알림</h1>
            <Content />
          </div>
        </main>
      </div>

      {/* Mobile */}
      <div className="md:hidden min-h-screen bg-bg pb-20">
        <header className="sticky top-0 z-40 bg-white border-b border-mint/10 px-4 py-4">
          <h1 className="text-base font-black">🔔 알림</h1>
        </header>
        <div className="px-3 py-3">
          <Content />
        </div>
        <MobileTabBar />
      </div>
    </>
  );
}

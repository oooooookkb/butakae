"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { timeAgo } from "@/lib/data";
import MobileTabBar from "@/components/MobileTabBar";
import Sidebar from "@/components/Sidebar";

export default function ChatListPage() {
  const router = useRouter();
  const [rooms, setRooms] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setCurrentUserId(user.id);

      const { data } = await supabase
        .from("chat_rooms")
        .select("*, task:tasks(id, title, status, price), requester:profiles!requester_id(*), helper:profiles!helper_id(*)")
        .or(`requester_id.eq.${user.id},helper_id.eq.${user.id}`)
        .order("last_message_at", { ascending: false });

      if (data) setRooms(data);
      setLoading(false);
    };
    init();
  }, [router]);

  const getOther = (room: any) =>
    room.requester_id === currentUserId ? room.helper : room.requester;

  const Content = () => {
    if (loading) {
      return (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl p-4 border border-mint/10 animate-pulse">
              <div className="flex gap-3">
                <div className="w-12 h-12 rounded-full bg-bg-2" />
                <div className="flex-1">
                  <div className="h-4 bg-bg-2 rounded w-20 mb-2" />
                  <div className="h-3 bg-bg-2 rounded w-3/4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (rooms.length === 0) {
      return (
        <div className="text-center py-16 text-brand-light">
          <p className="text-4xl mb-3">💬</p>
          <p className="font-semibold">아직 채팅이 없어요</p>
          <p className="text-xs mt-1">부탁을 수락하면 채팅이 시작됩니다</p>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-2">
        {rooms.map((room) => {
          const other = getOther(room);
          return (
            <Link key={room.id} href={`/chat/${room.id}`} className="block">
              <div className="bg-white rounded-2xl p-4 border border-mint/10 hover:-translate-y-0.5 hover:shadow-mint transition-all">
                <div className="flex gap-3 items-center">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-mint to-sky flex items-center justify-center text-white font-bold text-lg shrink-0">
                    {other?.name?.[0] ?? "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-bold text-sm">{other?.name ?? "익명"}</p>
                      <span className="text-[11px] text-brand-light shrink-0">
                        {room.last_message_at ? timeAgo(room.last_message_at) : ""}
                      </span>
                    </div>
                    <p className="text-xs text-brand-sub truncate">{room.last_message ?? "채팅을 시작하세요"}</p>
                    <p className="text-[11px] text-brand-light mt-1 truncate">📋 {room.task?.title}</p>
                  </div>
                </div>
              </div>
            </Link>
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
            <h1 className="text-xl font-black mb-6">💬 채팅</h1>
            <Content />
          </div>
        </main>
      </div>

      {/* Mobile */}
      <div className="md:hidden min-h-screen bg-bg pb-20">
        <header className="sticky top-0 z-40 bg-white border-b border-mint/10 px-4 py-4">
          <h1 className="text-base font-black">💬 채팅</h1>
        </header>
        <div className="px-3 py-3">
          <Content />
        </div>
        <MobileTabBar />
      </div>
    </>
  );
}

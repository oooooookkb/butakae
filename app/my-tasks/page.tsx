"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatPrice, timeAgo } from "@/lib/data";
import MobileTabBar from "@/components/MobileTabBar";
import Sidebar from "@/components/Sidebar";

export default function MyTasksPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const { data } = await supabase
        .from("tasks")
        .select("*, helper:profiles!helper_id(*)")
        .eq("requester_id", user.id)
        .in("status", ["open", "in_progress"])
        .order("created_at", { ascending: false });

      if (data) setTasks(data);
      setLoading(false);
    };
    init();
  }, [router]);

  return (
    <>
      {/* PC */}
      <div className="hidden md:flex min-h-screen">
        <Sidebar />
        <main className="ml-[260px] flex-1">
          <div className="max-w-3xl mx-auto px-8 py-8">
            <h1 className="text-xl font-black mb-6">내가 올린 부탁</h1>
            <div className="flex gap-2 mb-6">
              <Link href="/my-tasks" className="px-4 py-2 rounded-full text-sm font-bold bg-mint/10 text-mint-dark border border-mint">진행중</Link>
              <Link href="/my-tasks/done" className="px-4 py-2 rounded-full text-sm font-semibold text-brand-sub border border-mint/15 hover:border-mint">완료</Link>
            </div>
            <TaskList tasks={tasks} loading={loading} />
          </div>
        </main>
      </div>

      {/* Mobile */}
      <div className="md:hidden min-h-screen bg-bg pb-20">
        <header className="sticky top-0 z-40 bg-white border-b border-mint/10 px-4 py-4 flex items-center gap-3">
          <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-bg flex items-center justify-center text-lg">←</button>
          <h1 className="text-base font-black flex-1">내가 올린 부탁</h1>
        </header>
        <div className="flex gap-2 px-4 py-3">
          <Link href="/my-tasks" className="px-4 py-2 rounded-full text-sm font-bold bg-mint/10 text-mint-dark border border-mint">진행중</Link>
          <Link href="/my-tasks/done" className="px-4 py-2 rounded-full text-sm font-semibold text-brand-sub border border-mint/15">완료</Link>
        </div>
        <div className="px-4">
          <TaskList tasks={tasks} loading={loading} />
        </div>
        <MobileTabBar />
      </div>
    </>
  );
}

function TaskList({ tasks, loading }: { tasks: any[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-2xl p-4 border border-mint/10 animate-pulse">
            <div className="h-4 bg-bg-2 rounded w-3/4 mb-2" />
            <div className="h-3 bg-bg-2 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="text-center py-16 text-brand-light">
        <p className="text-4xl mb-3">📭</p>
        <p className="font-semibold">아직 올린 부탁이 없어요</p>
        <Link href="/create" className="text-mint-dark text-sm font-bold mt-2 inline-block">
          부탁 올리기 →
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {tasks.map((task) => (
        <Link key={task.id} href={`/tasks/${task.id}`} className="block">
          <div className="bg-white rounded-2xl p-4 border border-mint/10 hover:-translate-y-0.5 hover:shadow-mint transition-all">
            <div className="flex items-start justify-between mb-2">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                task.status === "open" ? "bg-mint/10 text-mint-dark" : "bg-yellow-100 text-yellow-700"
              }`}>
                {task.status === "open" ? "모집중" : "진행중"}
              </span>
              <span className="text-lg font-black text-coral">{formatPrice(task.price)}</span>
            </div>
            <h3 className="font-bold mb-1">{task.title}</h3>
            <div className="flex items-center gap-3 text-xs text-brand-light">
              <span>📍 {task.location}</span>
              <span>⏰ {timeAgo(task.created_at)}</span>
              {task.helper && <span>👤 {task.helper.name}</span>}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

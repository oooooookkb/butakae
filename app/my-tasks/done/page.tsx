"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatPrice, timeAgo } from "@/lib/data";
import MobileTabBar from "@/components/MobileTabBar";
import Sidebar from "@/components/Sidebar";

export default function DoneTasksPage() {
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
        .select("*, requester:profiles!requester_id(*), helper:profiles!helper_id(*)")
        .or(`requester_id.eq.${user.id},helper_id.eq.${user.id}`)
        .eq("status", "done")
        .order("updated_at", { ascending: false });

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
            <h1 className="text-xl font-black mb-6">완료한 일</h1>
            <div className="flex gap-2 mb-6">
              <Link href="/my-tasks" className="px-4 py-2 rounded-full text-sm font-semibold text-brand-sub border border-mint/15 hover:border-mint">진행중</Link>
              <Link href="/my-tasks/done" className="px-4 py-2 rounded-full text-sm font-bold bg-mint/10 text-mint-dark border border-mint">완료</Link>
            </div>
            <TaskList tasks={tasks} loading={loading} />
          </div>
        </main>
      </div>

      {/* Mobile */}
      <div className="md:hidden min-h-screen bg-bg pb-20">
        <header className="sticky top-0 z-40 bg-white border-b border-mint/10 px-4 py-4 flex items-center gap-3">
          <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-bg flex items-center justify-center text-lg">←</button>
          <h1 className="text-base font-black flex-1">완료한 일</h1>
        </header>
        <div className="flex gap-2 px-4 py-3">
          <Link href="/my-tasks" className="px-4 py-2 rounded-full text-sm font-semibold text-brand-sub border border-mint/15">진행중</Link>
          <Link href="/my-tasks/done" className="px-4 py-2 rounded-full text-sm font-bold bg-mint/10 text-mint-dark border border-mint">완료</Link>
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
        {[1, 2].map((i) => (
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
        <p className="text-4xl mb-3">✅</p>
        <p className="font-semibold">아직 완료한 일이 없어요</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {tasks.map((task) => (
        <Link key={task.id} href={`/tasks/${task.id}`} className="block">
          <div className="bg-white rounded-2xl p-4 border border-mint/10 hover:-translate-y-0.5 hover:shadow-mint transition-all">
            <div className="flex items-start justify-between mb-2">
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">완료</span>
              <span className="text-lg font-black text-coral">{formatPrice(task.price)}</span>
            </div>
            <h3 className="font-bold mb-1">{task.title}</h3>
            <div className="flex items-center gap-3 text-xs text-brand-light">
              <span>📍 {task.location}</span>
              <span>⏰ {timeAgo(task.updated_at ?? task.created_at)}</span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

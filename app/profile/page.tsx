"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data: p } = await supabase.from("profiles").select("*").eq("id",user.id).single();
      setProfile(p ?? { name: user.user_metadata?.name ?? "익명", rating: 5.0, completed_count: 0 });
      setLoading(false);
    };
    init();
  }, [router]);
  if (loading) return <div className="min-h-screen bg-bg flex items-center justify-center"><div className="w-10 h-10 rounded-full border-4 border-mint border-t-transparent animate-spin" /></div>;
  const name = profile?.name ?? "익명";
  return (
    <div className="min-h-screen bg-bg pb-8">
      <header className="sticky top-0 z-40 bg-white border-b border-mint/10 px-4 py-4 flex items-center gap-3">
        <button onClick={()=>router.back()} className="w-9 h-9 rounded-full bg-bg flex items-center justify-center text-lg">←</button>
        <h1 className="text-base font-black flex-1">프로필</h1>
        <button onClick={async()=>{ await createClient().auth.signOut(); router.push("/login"); }} className="text-xs text-coral font-bold">로그아웃</button>
      </header>
      <div className="max-w-xl mx-auto px-4 py-6 flex flex-col gap-4">
        <div className="bg-white rounded-2xl p-6 border border-mint/10 flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-mint to-sky flex items-center justify-center text-4xl text-white font-black mb-3">{name[0]}</div>
          <h2 className="text-xl font-black mb-1">{name}</h2>
          <p className="text-brand-light text-sm">{profile?.location ?? "동네 미설정"}</p>
          <div className="flex gap-6 mt-4 pt-4 border-t border-mint/8 w-full justify-center">
            <div className="text-center"><p className="text-2xl font-black text-mint">{Number(profile?.rating??5).toFixed(1)}</p><p className="text-xs text-brand-light">평점</p></div>
            <div className="text-center"><p className="text-2xl font-black text-coral">{profile?.completed_count??0}</p><p className="text-xs text-brand-light">완료</p></div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[{icon:"📋",label:"내가 올린 부탁",href:"/my-tasks"},{icon:"✅",label:"내가 한 일",href:"/my-tasks/done"},{icon:"💬",label:"채팅",href:"/chat"},{icon:"📍",label:"동네 설정",href:"/location"}].map(item=>(
            <button key={item.label} onClick={()=>router.push(item.href)} className="bg-white rounded-2xl p-4 border border-mint/10 flex items-center gap-3 text-left"><span className="text-2xl">{item.icon}</span><span className="text-sm font-semibold">{item.label}</span></button>
          ))}
        </div>
      </div>
    </div>
  );
}

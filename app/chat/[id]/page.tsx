"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatPrice } from "@/lib/data";

export default function ChatRoomPage() {
  const router = useRouter();
  const params = useParams();
  const roomId = params.id as string;

  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [chatRoom, setChatRoom] = useState<any>(null);
  const [currentUserId, setCurrentUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setCurrentUserId(user.id);

      // Fetch chat room
      const { data: room } = await supabase
        .from("chat_rooms")
        .select("*, task:tasks(id, title, status, price), requester:profiles!requester_id(*), helper:profiles!helper_id(*)")
        .eq("id", roomId)
        .single();

      if (!room) { router.push("/chat"); return; }
      setChatRoom(room);

      // Fetch messages
      const { data: msgs } = await supabase
        .from("messages")
        .select("*, sender:profiles!sender_id(*)")
        .eq("chat_room_id", roomId)
        .order("created_at", { ascending: true });

      if (msgs) setMessages(msgs);
      setLoading(false);

      // Subscribe to new messages
      const channel = supabase
        .channel(`room-${roomId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `chat_room_id=eq.${roomId}`,
          },
          async (payload) => {
            const { data: sender } = await supabase
              .from("profiles")
              .select("*")
              .eq("id", payload.new.sender_id)
              .single();
            setMessages((prev) => [...prev, { ...payload.new, sender }]);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };
    init();
  }, [roomId, router]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!newMessage.trim() || sending) return;
    setSending(true);

    const supabase = createClient();
    const content = newMessage.trim();
    setNewMessage("");

    await supabase.from("messages").insert({
      chat_room_id: roomId,
      sender_id: currentUserId,
      content,
    });

    await supabase
      .from("chat_rooms")
      .update({
        last_message: content,
        last_message_at: new Date().toISOString(),
      })
      .eq("id", roomId);

    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const otherUser = chatRoom
    ? chatRoom.requester_id === currentUserId
      ? chatRoom.helper
      : chatRoom.requester
    : null;

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-4 border-mint border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-mint/10 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.push("/chat")} className="w-9 h-9 rounded-full bg-bg flex items-center justify-center text-lg">
          ←
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm">{otherUser?.name ?? "채팅"}</p>
          <p className="text-[11px] text-brand-light truncate">📋 {chatRoom?.task?.title}</p>
        </div>
        {chatRoom?.task && (
          <span className="text-xs font-bold text-coral shrink-0">
            {formatPrice(chatRoom.task.price)}
          </span>
        )}
      </header>

      {/* Task info banner */}
      {chatRoom?.task && (
        <div className="mx-3 mt-3 bg-white rounded-xl p-3 border border-mint/10 flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold truncate">{chatRoom.task.title}</p>
            <p className="text-[11px] text-brand-light">
              {chatRoom.task.status === "in_progress" ? "진행중" : chatRoom.task.status === "done" ? "완료" : "모집중"}
            </p>
          </div>
          <button
            onClick={() => router.push(`/tasks/${chatRoom.task.id}`)}
            className="text-xs font-bold text-mint-dark shrink-0 ml-2"
          >
            상세보기 →
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-2">
        {messages.length === 0 && (
          <div className="text-center py-8 text-brand-light text-sm">
            채팅을 시작하세요!
          </div>
        )}
        {messages.map((msg) => {
          const isMe = msg.sender_id === currentUserId;
          return (
            <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                {!isMe && (
                  <span className="text-[11px] text-brand-light mb-0.5 ml-1">
                    {msg.sender?.name ?? "익명"}
                  </span>
                )}
                <div
                  className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    isMe
                      ? "bg-gradient-to-r from-mint to-sky text-white rounded-tr-md"
                      : "bg-white border border-mint/10 text-brand-text rounded-tl-md"
                  }`}
                >
                  {msg.content}
                </div>
                <span className="text-[10px] text-brand-light mt-0.5 mx-1">
                  {formatTime(msg.created_at)}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="sticky bottom-0 bg-white border-t border-mint/10 p-3 flex gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="메시지를 입력하세요..."
          className="flex-1 px-4 py-2.5 rounded-full border border-mint/15 bg-bg text-sm focus:outline-none focus:border-mint transition-colors"
        />
        <button
          onClick={sendMessage}
          disabled={!newMessage.trim() || sending}
          className="w-10 h-10 bg-gradient-to-r from-mint to-sky text-white rounded-full flex items-center justify-center text-lg shrink-0 disabled:opacity-40 active:scale-90 transition-transform"
        >
          ↑
        </button>
      </div>
    </div>
  );
}

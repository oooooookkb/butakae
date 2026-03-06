import Link from "next/link";
import { Task } from "@/types";
import { CATEGORY_COLORS, formatPrice, timeAgo } from "@/lib/data";

interface TaskCardProps {
  task: Task;
  variant?: "pc" | "mobile";
}

export default function TaskCard({ task, variant = "pc" }: TaskCardProps) {
  if (variant === "mobile") {
    return (
      <Link href={`/tasks/${task.id}`} className="block">
        <div className="bg-white rounded-2xl p-3.5 border border-mint/8 cursor-pointer active:scale-[0.98] transition-transform relative overflow-hidden">
          {task.is_urgent && (
            <span className="absolute top-0 left-0 bg-coral text-white text-[9px] font-bold px-2.5 py-1 rounded-br-xl rounded-tl-2xl">
              ⚡ 급해요
            </span>
          )}
          <div className={task.is_urgent ? "mt-3.5" : ""}>
            <div className="flex justify-between items-start mb-2">
              <p className="text-sm font-bold leading-snug flex-1 pr-2">{task.title}</p>
              <p className="text-base font-black text-coral whitespace-nowrap">{formatPrice(task.price)}</p>
            </div>
            <p className="text-xs text-brand-sub mb-2.5 leading-relaxed">{task.description}</p>
            <div className="flex justify-between items-center">
              <div className="flex gap-2">
                <span className="text-[11px] text-brand-light">📍 {task.distance_km > 0 && task.distance_km < 9999 ? `${task.distance_km < 1 ? (task.distance_km * 1000).toFixed(0) + "m" : task.distance_km.toFixed(1) + "km"}` : task.location}</span>
                <span className="text-[11px] text-brand-light">⏰ {timeAgo(task.created_at)}</span>
              </div>
              <span className="bg-gradient-to-r from-mint to-sky text-white text-xs font-bold px-3.5 py-1.5 rounded-xl">
                상세보기
              </span>
            </div>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link href={`/tasks/${task.id}`} className="block">
      <div className="bg-white rounded-[18px] p-5 border border-mint/10 cursor-pointer hover:-translate-y-1 hover:shadow-mint-lg hover:border-mint/30 transition-all duration-200 relative overflow-hidden">
        {task.is_urgent && (
          <span className="absolute top-0 left-0 bg-coral text-white text-[10px] font-bold px-3 py-1 rounded-br-xl rounded-tl-[18px]">
            ⚡ 급해요
          </span>
        )}
        <div className={task.is_urgent ? "mt-4" : ""}>
          <div className="flex items-start justify-between mb-3">
            <span
              className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                CATEGORY_COLORS[task.category] ?? CATEGORY_COLORS["기타"]
              }`}
            >
              {task.category}
            </span>
            <span className="text-lg font-black text-coral">{formatPrice(task.price)}</span>
          </div>
          <h3 className="text-[15px] font-bold mb-1.5 leading-snug">{task.title}</h3>
          <p className="text-sm text-brand-sub mb-3.5 leading-relaxed">{task.description}</p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs text-brand-light flex items-center gap-1">
                📍 {task.distance_km > 0 && task.distance_km < 9999 ? `${task.distance_km < 1 ? (task.distance_km * 1000).toFixed(0) + "m" : task.distance_km.toFixed(1) + "km"}` : task.location}
              </span>
              <span className="text-xs text-brand-light flex items-center gap-1">
                ⏰ {timeAgo(task.created_at)}
              </span>
            </div>
            <span className="bg-gradient-to-r from-mint to-sky text-white text-xs font-bold px-4 py-1.5 rounded-full">
              상세보기
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

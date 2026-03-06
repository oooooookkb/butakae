import { Task } from "@/types";

export const MOCK_TASKS: Task[] = [
  {
    id: "1",
    title: "편의점에서 우유·삼각김밥 사다주세요",
    description: "GS25 영통점에서 흰우유 1L, 참치마요 삼각김밥 2개 구매 후 배달 부탁드려요",
    price: 8000,
    category: "심부름",
    location: "영통구",
    distance_km: 0.3,
    is_urgent: true,
    created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    status: "open",
    requester_id: "u1",
    requester_name: "김민지",
    requester_rating: 4.8,
  },
  {
    id: "2",
    title: "강아지 산책 30분 부탁해요 🐾",
    description: "말티즈 3살, 순해요. 아파트 단지 한 바퀴만 부탁드립니다",
    price: 15000,
    category: "반려동물",
    location: "매탄동",
    distance_km: 0.8,
    is_urgent: false,
    created_at: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    status: "open",
    requester_id: "u2",
    requester_name: "이수진",
    requester_rating: 4.9,
  },
  {
    id: "3",
    title: "이케아 서랍장 조립 도와주세요",
    description: "MALM 6단 서랍장 1개. 공구 있으신 분 우대. 1시간 내 완료 예상",
    price: 25000,
    category: "조립/수리",
    location: "원천동",
    distance_km: 1.2,
    is_urgent: false,
    created_at: new Date(Date.now() - 28 * 60 * 1000).toISOString(),
    status: "open",
    requester_id: "u3",
    requester_name: "박지훈",
    requester_rating: 4.7,
  },
  {
    id: "4",
    title: "스타벅스 굿즈 줄서기 대행",
    description: "수원역점 오픈런 대신 서주세요. 오전 8시부터 오픈 전까지",
    price: 20000,
    category: "줄서기",
    location: "수원역",
    distance_km: 2.1,
    is_urgent: true,
    created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    status: "open",
    requester_id: "u4",
    requester_name: "정예린",
    requester_rating: 5.0,
  },
  {
    id: "5",
    title: "병원 동행 부탁드립니다",
    description: "정형외과 진료 동행. 2시간 예상, 혼자 가기 불안해서요",
    price: 30000,
    category: "병원동행",
    location: "인계동",
    distance_km: 1.5,
    is_urgent: false,
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    status: "open",
    requester_id: "u5",
    requester_name: "최미래",
    requester_rating: 4.6,
  },
  {
    id: "6",
    title: "원룸 이사 후 청소 도움 요청",
    description: "20평 원룸. 청소 도구는 있어요. 2명이 같이 해주시면 더 좋아요",
    price: 40000,
    category: "청소",
    location: "광교동",
    distance_km: 0.6,
    is_urgent: false,
    created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    status: "open",
    requester_id: "u6",
    requester_name: "강동현",
    requester_rating: 4.9,
  },
];

export const CATEGORIES = [
  { label: "전체", emoji: "🌟" },
  { label: "심부름", emoji: "🛒" },
  { label: "반려동물", emoji: "🐕" },
  { label: "병원동행", emoji: "🏥" },
  { label: "조립/수리", emoji: "🔧" },
  { label: "줄서기", emoji: "🎫" },
  { label: "청소", emoji: "🧹" },
  { label: "이사", emoji: "📦" },
  { label: "IT도움", emoji: "💻" },
] as const;

export const CATEGORY_COLORS: Record<string, string> = {
  심부름: "bg-mint/10 text-mint-dark",
  반려동물: "bg-green-100 text-green-700",
  "조립/수리": "bg-yellow-100 text-yellow-700",
  청소: "bg-blue-100 text-blue-700",
  병원동행: "bg-coral/10 text-coral-dark",
  줄서기: "bg-purple-100 text-purple-700",
  이사: "bg-orange-100 text-orange-700",
  IT도움: "bg-indigo-100 text-indigo-700",
  기타: "bg-gray-100 text-gray-600",
};

export function timeAgo(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

export function formatPrice(price: number): string {
  return price.toLocaleString("ko-KR") + "원";
}

export const CATEGORY_EMOJI: Record<string, string> = {
  심부름: "🛒",
  반려동물: "🐕",
  병원동행: "🏥",
  "조립/수리": "🔧",
  줄서기: "🎫",
  청소: "🧹",
  이사: "📦",
  IT도움: "💻",
  기타: "✨",
};

export function generateOrderId(): string {
  return `butakae_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

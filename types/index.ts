export type TaskCategory =
  | "심부름"
  | "반려동물"
  | "조립/수리"
  | "청소"
  | "병원동행"
  | "줄서기"
  | "이사"
  | "IT도움"
  | "기타";

export interface Task {
  id: string;
  title: string;
  description: string;
  price: number;
  category: TaskCategory;
  location: string;
  distance_km: number;
  is_urgent: boolean;
  created_at: string;
  status: "open" | "in_progress" | "done" | "cancelled";
  requester_id: string;
  requester_name: string;
  requester_rating: number;
}

export interface Profile {
  id: string;
  name: string;
  avatar_url: string | null;
  location: string | null;
  lat: number | null;
  lng: number | null;
  rating: number;
  completed_count: number;
  created_at: string;
}

export interface User {
  id: string;
  name: string;
  location: string;
  rating: number;
  completed_count: number;
  avatar_url?: string;
}

export interface ChatRoom {
  id: string;
  task_id: string;
  requester_id: string;
  helper_id: string;
  last_message: string;
  last_message_at: string;
  unread_count: number;
}

export interface Message {
  id: string;
  chat_room_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender?: Profile;
}

export interface Review {
  id: string;
  task_id: string;
  reviewer_id: string;
  reviewee_id: string;
  rating: number;
  content: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  task_id: string;
  payer_id: string;
  amount: number;
  payment_key: string | null;
  order_id: string;
  method: string;
  status: "pending" | "confirmed" | "failed" | "cancelled";
  confirmed_at: string | null;
  created_at: string;
}

export interface TaskApplication {
  id: string;
  task_id: string;
  user_id: string;
  offer_price: number;
  message: string | null;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
  applicant?: Profile;
}

export type NotificationType =
  | "task_accepted"
  | "task_completed"
  | "task_cancelled"
  | "new_message"
  | "new_review"
  | "payment_confirmed";

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  task_id: string | null;
  related_user_id: string | null;
  is_read: boolean;
  created_at: string;
}

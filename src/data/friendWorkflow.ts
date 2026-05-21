import { isSupabaseConfigured, supabase } from "../lib/supabase";
import type { AuthUser } from "../lib/auth";
import type { Friendship, FriendshipStatus, User } from "../types";
import type { Database } from "../types/database";

type FriendshipRow = Database["public"]["Tables"]["friendships"]["Row"];

export type FriendRelation =
  | "none"
  | "self"
  | "pending_sent"
  | "pending_received"
  | "friends"
  | "rejected"
  | "blocked";

export const demoFriendships: Friendship[] = [
  {
    id: "friend-demo-bob",
    requesterId: "demo-user",
    receiverId: "bob",
    status: "accepted",
    dateLabel: "05-20"
  },
  {
    id: "friend-carol-demo",
    requesterId: "carol",
    receiverId: "demo-user",
    status: "pending",
    dateLabel: "今天"
  }
];

export async function sendFriendRequest(user: AuthUser, receiver: User): Promise<Friendship> {
  if (!isSupabaseConfigured || user.isDemo) {
    return {
      id: `local-friend-${Date.now()}`,
      requesterId: user.id,
      receiverId: receiver.id,
      status: "pending",
      dateLabel: "今天"
    };
  }

  const { data, error } = await (supabase.from("friendships") as any)
    .insert({
      requester_id: user.id,
      receiver_id: receiver.id,
      status: "pending"
    })
    .select("*")
    .single();

  if (error) throw error;
  return mapFriendshipRow(data);
}

export async function transitionFriendship(
  friendship: Friendship,
  nextStatus: FriendshipStatus
): Promise<Friendship> {
  if (!isSupabaseConfigured || friendship.id.startsWith("local-") || friendship.id.startsWith("friend-")) {
    return {
      ...friendship,
      status: nextStatus
    };
  }

  const { data, error } = await (supabase.from("friendships") as any)
    .update({ status: nextStatus })
    .eq("id", friendship.id)
    .select("*")
    .single();

  if (error) throw error;
  return mapFriendshipRow(data);
}

export function relationshipFor(user: AuthUser | null, target: User, friendships: Friendship[]): FriendRelation {
  if (!user) return "none";
  if (user.id === target.id) return "self";

  const friendship = findFriendship(user.id, target.id, friendships);
  if (!friendship) return "none";
  if (friendship.status === "accepted") return "friends";
  if (friendship.status === "blocked") return "blocked";
  if (friendship.status === "rejected") return "rejected";
  return friendship.requesterId === user.id ? "pending_sent" : "pending_received";
}

export function findFriendship(currentUserId: string, targetUserId: string, friendships: Friendship[]) {
  return friendships.find((friendship) => (
    (friendship.requesterId === currentUserId && friendship.receiverId === targetUserId)
    || (friendship.requesterId === targetUserId && friendship.receiverId === currentUserId)
  ));
}

export function relationLabel(relation: FriendRelation): string {
  switch (relation) {
    case "self":
      return "自己";
    case "pending_sent":
      return "等待通过";
    case "pending_received":
      return "待处理";
    case "friends":
      return "好友";
    case "rejected":
      return "已拒绝";
    case "blocked":
      return "已屏蔽";
    case "none":
      return "+ 好友";
  }
}

export function mapFriendshipRow(row: FriendshipRow): Friendship {
  return {
    id: row.id,
    requesterId: row.requester_id,
    receiverId: row.receiver_id,
    status: row.status,
    dateLabel: new Date(row.created_at).toLocaleDateString("zh-CN", {
      month: "2-digit",
      day: "2-digit"
    })
  };
}

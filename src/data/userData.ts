import { mapBorrowRowToRequest, statusLabel } from "./borrowWorkflow";
import { demoFriendships, mapFriendshipRow } from "./friendWorkflow";
import { borrowRequests as mockBorrowRequests } from "./mockData";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import type { AuthUser } from "../lib/auth";
import type { BorrowRequest, Friendship, MessageNotification } from "../types";
import type { Database } from "../types/database";

type BorrowRequestRow = Database["public"]["Tables"]["borrow_requests"]["Row"];
type FriendshipRow = Database["public"]["Tables"]["friendships"]["Row"];
type BookRow = Database["public"]["Tables"]["books"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export type UserData = {
  favorites: string[];
  borrowRequests: BorrowRequest[];
  friendships: Friendship[];
  notifications: MessageNotification[];
  source: "supabase" | "mock";
};

export async function fetchUserData(user: AuthUser): Promise<UserData> {
  if (!isSupabaseConfigured || user.isDemo) {
    return {
      favorites: ["hundred-years"],
      borrowRequests: mockBorrowRequests,
      friendships: demoFriendships,
      notifications: [],
      source: "mock"
    };
  }

  const [favoriteResult, borrowResult, friendshipResult] = await Promise.all([
    (supabase.from("favorites") as any)
      .select("book_id")
      .eq("user_id", user.id),
    (supabase.from("borrow_requests") as any)
      .select("*")
      .or(`borrower_id.eq.${user.id},lender_id.eq.${user.id}`)
      .order("updated_at", { ascending: false }),
    (supabase.from("friendships") as any)
      .select("*")
      .or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order("updated_at", { ascending: false })
  ]);

  if (favoriteResult.error) throw favoriteResult.error;
  if (borrowResult.error) throw borrowResult.error;
  if (friendshipResult.error) throw friendshipResult.error;

  const borrowRows = (borrowResult.data ?? []) as BorrowRequestRow[];
  const friendshipRows = (friendshipResult.data ?? []) as FriendshipRow[];

  return {
    favorites: ((favoriteResult.data ?? []) as Array<{ book_id: string }>).map((favorite) => favorite.book_id),
    borrowRequests: borrowRows.map(mapBorrowRowToRequest),
    friendships: friendshipRows.map(mapFriendshipRow),
    notifications: await buildNotifications(user.id, borrowRows, friendshipRows),
    source: "supabase"
  };
}

export async function setFavoriteBook(
  user: AuthUser,
  bookId: string,
  favorite: boolean
): Promise<void> {
  if (!isSupabaseConfigured || user.isDemo) return;

  if (favorite) {
    const { error } = await (supabase.from("favorites") as any)
      .upsert({ user_id: user.id, book_id: bookId }, { onConflict: "user_id,book_id" });
    if (error) throw error;
    return;
  }

  const { error } = await (supabase.from("favorites") as any)
    .delete()
    .eq("user_id", user.id)
    .eq("book_id", bookId);
  if (error) throw error;
}

async function buildNotifications(
  currentUserId: string,
  borrowRows: BorrowRequestRow[],
  friendshipRows: FriendshipRow[]
): Promise<MessageNotification[]> {
  const bookIds = Array.from(new Set(borrowRows.map((request) => request.book_id)));
  const userIds = Array.from(new Set([
    ...borrowRows.flatMap((request) => [request.borrower_id, request.lender_id]),
    ...friendshipRows.flatMap((friendship) => [friendship.requester_id, friendship.receiver_id])
  ].filter((id) => id !== currentUserId)));

  const [bookResult, profileResult] = await Promise.all([
    bookIds.length
      ? (supabase.from("books") as any).select("id,title").in("id", bookIds)
      : Promise.resolve({ data: [], error: null }),
    userIds.length
      ? (supabase.from("profiles") as any).select("id,display_name").in("id", userIds)
      : Promise.resolve({ data: [], error: null })
  ]);

  if (bookResult.error) throw bookResult.error;
  if (profileResult.error) throw profileResult.error;

  const bookTitles = new Map(((bookResult.data ?? []) as Pick<BookRow, "id" | "title">[])
    .map((book) => [book.id, book.title]));
  const displayNames = new Map(((profileResult.data ?? []) as Pick<ProfileRow, "id" | "display_name">[])
    .map((profile) => [profile.id, profile.display_name]));

  const borrowNotifications = borrowRows.map((request) => {
    const title = bookTitles.get(request.book_id) ?? "这本书";
    const actorId = request.borrower_id === currentUserId ? request.lender_id : request.borrower_id;
    const actorName = displayNames.get(actorId) ?? "附近书友";
    return {
      id: `server-borrow-${request.id}-${request.status}`,
      kind: "borrow" as const,
      title: statusLabel(request.status),
      body: `${actorName} · 《${title}》`,
      time: formatDateLabel(request.updated_at),
      unread: false,
      userId: actorId,
      bookId: request.book_id,
      requestId: request.id,
      status: request.status
    };
  });

  const friendNotifications = friendshipRows.map((friendship) => {
    const otherUserId = friendship.requester_id === currentUserId
      ? friendship.receiver_id
      : friendship.requester_id;
    const displayName = displayNames.get(otherUserId) ?? "附近书友";
    return {
      id: `server-friend-${friendship.id}-${friendship.status}`,
      kind: "friend" as const,
      title: friendship.status === "pending" ? "好友申请待处理" : "好友状态更新",
      body: `${displayName} · ${friendship.status === "accepted" ? "已成为好友" : "等待处理"}`,
      time: formatDateLabel(friendship.updated_at),
      unread: false,
      userId: otherUserId,
      friendshipId: friendship.id
    };
  });

  return [...borrowNotifications, ...friendNotifications];
}

function formatDateLabel(value: string): string {
  return new Date(value).toLocaleDateString("zh-CN", {
    month: "2-digit",
    day: "2-digit"
  });
}

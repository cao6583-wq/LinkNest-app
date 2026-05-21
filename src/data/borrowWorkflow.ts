import { isSupabaseConfigured, supabase } from "../lib/supabase";
import type { AuthUser } from "../lib/auth";
import type { Book, BorrowRequest, BorrowStatus } from "../types";
import type { Database } from "../types/database";

type BorrowRequestRow = Database["public"]["Tables"]["borrow_requests"]["Row"];

export type BorrowDraft = {
  book: Book;
  borrower: AuthUser;
  message: string;
};

export type BorrowTransition = {
  request: BorrowRequest;
  nextStatus: BorrowStatus;
};

export async function createBorrowRequest({ book, borrower, message }: BorrowDraft): Promise<BorrowRequest> {
  if (!isSupabaseConfigured || borrower.isDemo) {
    return {
      id: `local-borrow-${Date.now()}`,
      bookId: book.id,
      borrowerId: borrower.id,
      lenderId: book.ownerId,
      status: "pending",
      message: message.trim() || "想借这本书。",
      dateLabel: "今天"
    };
  }

  const { data, error } = await (supabase.from("borrow_requests") as any)
    .insert({
      book_id: book.id,
      borrower_id: borrower.id,
      lender_id: book.ownerId,
      message: message.trim() || null,
      status: "pending"
    })
    .select("*")
    .single();

  if (error) throw error;
  return mapBorrowRowToRequest(data);
}

export async function transitionBorrowRequest({
  request,
  nextStatus
}: BorrowTransition): Promise<BorrowRequest> {
  if (!isSupabaseConfigured || request.id.startsWith("local-") || request.id.startsWith("borrow-")) {
    return {
      ...request,
      status: nextStatus,
      message: statusMessage(nextStatus),
      dateLabel: request.dateLabel || "今天"
    };
  }

  const timestampPatch = timestampForStatus(nextStatus);
  const { data, error } = await (supabase.from("borrow_requests") as any)
    .update({
      status: nextStatus,
      ...timestampPatch
    })
    .eq("id", request.id)
    .select("*")
    .single();

  if (error) throw error;
  return mapBorrowRowToRequest(data);
}

export function bookStatusForBorrow(status: BorrowStatus): Book["status"] {
  if (status === "pending" || status === "accepted") return "pending";
  if (status === "borrowed" || status === "return_requested") return "borrowed";
  return "available";
}

export function statusMessage(status: BorrowStatus): string {
  switch (status) {
    case "pending":
      return "等待出借者确认";
    case "accepted":
      return "已同意，等待线下交接";
    case "borrowed":
      return "借阅中";
    case "return_requested":
      return "已申请归还";
    case "returned":
      return "已归还";
    case "rejected":
      return "出借者已拒绝";
    case "canceled":
      return "已取消";
  }
}

export function statusLabel(status: BorrowStatus): string {
  switch (status) {
    case "pending":
      return "申请中";
    case "accepted":
      return "待交接";
    case "borrowed":
      return "借阅中";
    case "return_requested":
      return "待确认归还";
    case "returned":
      return "已归还";
    case "rejected":
      return "已拒绝";
    case "canceled":
      return "已取消";
  }
}

export function mapBorrowRowToRequest(row: BorrowRequestRow): BorrowRequest {
  return {
    id: row.id,
    bookId: row.book_id,
    borrowerId: row.borrower_id,
    lenderId: row.lender_id,
    status: row.status,
    message: row.message ?? statusMessage(row.status),
    dateLabel: new Date(row.requested_at).toLocaleDateString("zh-CN", {
      month: "2-digit",
      day: "2-digit"
    })
  };
}

function timestampForStatus(status: BorrowStatus) {
  const now = new Date().toISOString();
  if (status === "accepted") return { accepted_at: now };
  if (status === "borrowed") return { borrowed_at: now };
  if (status === "returned") return { returned_at: now };
  return {};
}

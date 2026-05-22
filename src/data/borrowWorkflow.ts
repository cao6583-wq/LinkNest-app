import { isSupabaseConfigured, supabase } from "../lib/supabase";
import type { AuthUser } from "../lib/auth";
import type { Book, BorrowChatMessage, BorrowRequest, BorrowStatus } from "../types";
import type { Database } from "../types/database";

type BorrowRequestRow = Database["public"]["Tables"]["borrow_requests"]["Row"];
type ConversationRow = Database["public"]["Tables"]["conversations"]["Row"];
type MessageRow = Database["public"]["Tables"]["messages"]["Row"];

export type BorrowDraft = {
  book: Book;
  borrower: AuthUser;
  message: string;
};

export type BorrowTransition = {
  request: BorrowRequest;
  nextStatus: BorrowStatus;
};

export type BorrowChatDraft = {
  request: BorrowRequest;
  sender: AuthUser;
  body: string;
};

const chatPayloadPrefix = "LINKNEST_CHAT_V1:";

export async function createBorrowRequest({ book, borrower, message }: BorrowDraft): Promise<BorrowRequest> {
  if (!isSupabaseConfigured || borrower.isDemo) {
    const body = message.trim() || "想借这本书。";
    return {
      id: `local-borrow-${Date.now()}`,
      bookId: book.id,
      borrowerId: borrower.id,
      lenderId: book.ownerId,
      status: "pending",
      message: body,
      dateLabel: "今天",
      chatMessages: [createChatMessage(borrower.id, body)]
    };
  }

  const body = message.trim() || "想借这本书。";
  const { data, error } = await (supabase.from("borrow_requests") as any)
    .insert({
      book_id: book.id,
      borrower_id: borrower.id,
      lender_id: book.ownerId,
      message: body,
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
      dateLabel: request.dateLabel || "今天",
      chatMessages: request.chatMessages
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

export async function sendBorrowChatMessage({
  request,
  sender,
  body
}: BorrowChatDraft): Promise<BorrowRequest> {
  const cleanBody = body.trim();
  if (!cleanBody) return request;

  const nextMessages = [
    ...chatMessagesForRequest(request),
    createChatMessage(sender.id, cleanBody)
  ];

  if (!isSupabaseConfigured || sender.isDemo || request.id.startsWith("local-") || request.id.startsWith("borrow-")) {
    return {
      ...request,
      message: firstUserMessage(nextMessages) || cleanBody,
      chatMessages: nextMessages
    };
  }

  const conversationId = request.conversationId ?? await fetchBorrowConversationId(request.id);
  if (!conversationId) {
    return updateLegacyBorrowChat(request, nextMessages);
  }

  const { data, error } = await (supabase.from("messages") as any)
    .insert({
      conversation_id: conversationId,
      sender_id: sender.id,
      type: "text",
      body: cleanBody,
      metadata: { borrow_request_id: request.id }
    })
    .select("*")
    .single();

  if (error) throw error;
  const persistedMessage = mapMessageRowToChatMessage(data);
  return {
    ...request,
    conversationId,
    message: firstUserMessage([...chatMessagesForRequest(request), persistedMessage]) || cleanBody,
    chatMessages: [...chatMessagesForRequest(request), persistedMessage]
  };
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

export function mapBorrowRowToRequest(
  row: BorrowRequestRow,
  conversationMessages?: BorrowChatMessage[],
  conversationId?: string
): BorrowRequest {
  const legacyMessages = parseBorrowChat(row.message, row.borrower_id, row.requested_at);
  const chatMessages = conversationMessages?.length
    ? mergeLegacyAndConversationMessages(row.message, legacyMessages, conversationMessages)
    : legacyMessages;
  return {
    id: row.id,
    bookId: row.book_id,
    borrowerId: row.borrower_id,
    lenderId: row.lender_id,
    status: row.status,
    message: firstUserMessage(chatMessages) || row.message || statusMessage(row.status),
    dateLabel: new Date(row.requested_at).toLocaleDateString("zh-CN", {
      month: "2-digit",
      day: "2-digit"
    }),
    conversationId,
    chatMessages
  };
}

export function chatMessagesForRequest(request: BorrowRequest): BorrowChatMessage[] {
  if (request.chatMessages?.length) return request.chatMessages;
  return request.message
    ? [createChatMessage(request.borrowerId, request.message)]
    : [];
}

export function systemMessageForStatus(status: BorrowStatus): string {
  switch (status) {
    case "accepted":
      return "出借者已同意借阅，可以沟通交接时间和地点。";
    case "borrowed":
      return "借阅者已确认拿到书。";
    case "return_requested":
      return "借阅者已申请归还，请确认书已归还。";
    case "returned":
      return "出借者已确认归还，这次借阅完成。";
    case "rejected":
      return "出借者已拒绝这次借阅申请。";
    case "canceled":
      return "借阅者已取消这次借阅申请。";
    case "pending":
      return "借阅申请已发送，等待出借者处理。";
  }
}

export function mapMessageRowsToChatMessages(rows: MessageRow[]): BorrowChatMessage[] {
  return rows
    .map(mapMessageRowToChatMessage)
    .filter((message) => message.body.trim().length > 0);
}

function timestampForStatus(status: BorrowStatus) {
  const now = new Date().toISOString();
  if (status === "accepted") return { accepted_at: now };
  if (status === "borrowed") return { borrowed_at: now };
  if (status === "returned") return { returned_at: now };
  return {};
}

function createChatMessage(senderId: string, body: string, kind: BorrowChatMessage["kind"] = "text"): BorrowChatMessage {
  return {
    id: `${kind}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    senderId,
    body,
    createdAt: new Date().toISOString(),
    kind
  };
}

function mapMessageRowToChatMessage(row: MessageRow): BorrowChatMessage {
  return {
    id: row.id,
    senderId: row.sender_id,
    body: row.body ?? "",
    createdAt: row.created_at,
    kind: row.type === "system" ? "system" : "text"
  };
}

async function fetchBorrowConversationId(requestId: string): Promise<string | undefined> {
  const { data, error } = await (supabase.from("conversations") as any)
    .select("id")
    .eq("borrow_request_id", requestId)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return ((data as Pick<ConversationRow, "id"> | null) ?? null)?.id;
}

async function updateLegacyBorrowChat(
  request: BorrowRequest,
  nextMessages: BorrowChatMessage[]
): Promise<BorrowRequest> {
  const { data, error } = await (supabase.from("borrow_requests") as any)
    .update({ message: encodeBorrowChat(nextMessages) })
    .eq("id", request.id)
    .select("*")
    .single();

  if (error) throw error;
  return mapBorrowRowToRequest(data);
}

function parseBorrowChat(
  rawMessage: string | null,
  borrowerId: string,
  requestedAt: string
): BorrowChatMessage[] {
  if (!rawMessage) return [];
  if (!rawMessage.startsWith(chatPayloadPrefix)) {
    return [{
      id: `initial-${requestedAt}`,
      senderId: borrowerId,
      body: rawMessage,
      createdAt: requestedAt,
      kind: "text"
    }];
  }

  try {
    const payload = JSON.parse(rawMessage.slice(chatPayloadPrefix.length)) as { messages?: BorrowChatMessage[] };
    return Array.isArray(payload.messages)
      ? payload.messages.filter(isBorrowChatMessage)
      : [];
  } catch {
    return [];
  }
}

function mergeLegacyAndConversationMessages(
  rawMessage: string | null,
  legacyMessages: BorrowChatMessage[],
  conversationMessages: BorrowChatMessage[]
): BorrowChatMessage[] {
  if (!rawMessage?.startsWith(chatPayloadPrefix)) return conversationMessages;
  const conversationIds = new Set(conversationMessages.map((message) => message.id));
  return [
    ...legacyMessages.filter((message) => !conversationIds.has(message.id)),
    ...conversationMessages
  ].sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
}

function encodeBorrowChat(messages: BorrowChatMessage[]): string {
  return `${chatPayloadPrefix}${JSON.stringify({ messages })}`;
}

function firstUserMessage(messages: BorrowChatMessage[]): string {
  return messages.find((message) => message.kind !== "system")?.body ?? "";
}

function isBorrowChatMessage(value: unknown): value is BorrowChatMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Partial<BorrowChatMessage>;
  return typeof message.id === "string"
    && typeof message.senderId === "string"
    && typeof message.body === "string"
    && typeof message.createdAt === "string";
}

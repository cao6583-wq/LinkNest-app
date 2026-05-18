import { statusLabel } from "./borrowWorkflow";
import type { Book, BorrowRequest, BorrowStatus, Friendship, FriendshipStatus, MessageNotification, MessageThread, User } from "../types";

type BorrowNotificationInput = {
  request: BorrowRequest;
  book: Book;
  actorName?: string;
  event: "created" | "transition";
};

export function initialNotificationsFromBorrowRequests(
  requests: BorrowRequest[],
  books: Book[],
  users: User[],
  threads: MessageThread[]
): MessageNotification[] {
  const borrowNotifications = requests
    .map((request) => {
      const book = books.find((item) => item.id === request.bookId);
      if (!book) return null;
      return borrowNotification({
        request,
        book,
        actorName: users.find((user) => user.id === request.borrowerId)?.displayName,
        event: "transition"
      });
    })
    .filter((item): item is MessageNotification => Boolean(item));

  return [
    ...borrowNotifications,
    ...threads.map(threadToNotification)
  ];
}

export function borrowNotification({
  request,
  book,
  actorName,
  event
}: BorrowNotificationInput): MessageNotification {
  const title = event === "created"
    ? "借阅申请已发送"
    : borrowTitleForStatus(request.status);
  const body = event === "created"
    ? `你已申请借阅《${book.title}》，等待出借者确认。`
    : borrowBodyForStatus(request.status, book.title, actorName);

  return {
    id: `notice-${request.id}-${request.status}-${Date.now()}`,
    kind: "borrow",
    title,
    body,
    time: "刚刚",
    unread: true,
    userId: request.lenderId,
    bookId: book.id,
    requestId: request.id,
    status: request.status
  };
}

export function friendNotification(
  friendship: Friendship,
  user: User,
  event: "sent" | "received" | "transition"
): MessageNotification {
  const title = event === "sent"
    ? "好友申请已发送"
    : event === "received"
      ? "新的好友申请"
      : friendTitleForStatus(friendship.status);
  const body = event === "sent"
    ? `你已向 ${user.displayName} 发送好友申请。`
    : event === "received"
      ? `${user.displayName} 想加你为好友。`
      : friendBodyForStatus(friendship.status, user.displayName);

  return {
    id: `notice-${friendship.id}-${friendship.status}-${Date.now()}`,
    kind: "friend",
    title,
    body,
    time: "刚刚",
    unread: true,
    userId: user.id,
    friendshipId: friendship.id
  };
}

export function markNotificationsRead(notifications: MessageNotification[]): MessageNotification[] {
  return notifications.map((notification) => ({ ...notification, unread: false }));
}

function threadToNotification(thread: MessageThread): MessageNotification {
  return {
    id: thread.id,
    kind: thread.kind === "chat" ? "system" : thread.kind,
    title: thread.kind === "system" ? "系统通知" : "邻里消息",
    body: thread.preview,
    time: thread.time,
    unread: Boolean(thread.unread),
    userId: thread.userId
  };
}

function borrowTitleForStatus(status: BorrowStatus): string {
  switch (status) {
    case "pending":
      return "新的借阅申请";
    case "accepted":
      return "借阅申请已同意";
    case "borrowed":
      return "借阅已开始";
    case "return_requested":
      return "归还申请待确认";
    case "returned":
      return "借阅已完成";
    case "rejected":
      return "借阅申请被拒绝";
    case "canceled":
      return "借阅申请已取消";
  }
}

function borrowBodyForStatus(status: BorrowStatus, bookTitle: string, actorName?: string): string {
  const actor = actorName ? `${actorName} ` : "";
  switch (status) {
    case "pending":
      return `${actor}申请借阅《${bookTitle}》，请尽快处理。`;
    case "accepted":
      return `《${bookTitle}》的申请已同意，等待线下交接。`;
    case "borrowed":
      return `《${bookTitle}》已进入借阅中。`;
    case "return_requested":
      return `${actor}申请归还《${bookTitle}》。`;
    case "returned":
      return `《${bookTitle}》已完成归还，可以再次共享。`;
    case "rejected":
      return `《${bookTitle}》的借阅申请已拒绝。`;
    case "canceled":
      return `《${bookTitle}》的借阅申请已取消。`;
  }
}

function friendTitleForStatus(status: FriendshipStatus): string {
  switch (status) {
    case "pending":
      return "好友申请待处理";
    case "accepted":
      return "已成为好友";
    case "rejected":
      return "好友申请已拒绝";
    case "blocked":
      return "好友已屏蔽";
  }
}

function friendBodyForStatus(status: FriendshipStatus, displayName: string): string {
  switch (status) {
    case "pending":
      return `与 ${displayName} 的好友申请正在等待处理。`;
    case "accepted":
      return `你和 ${displayName} 已成为好友。`;
    case "rejected":
      return `你已拒绝 ${displayName} 的好友申请。`;
    case "blocked":
      return `你已屏蔽 ${displayName}。`;
  }
}

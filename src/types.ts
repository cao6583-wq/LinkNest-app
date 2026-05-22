export type BookStatus = "available" | "pending" | "borrowed" | "hidden";

export type BorrowStatus =
  | "pending"
  | "accepted"
  | "borrowed"
  | "return_requested"
  | "returned"
  | "rejected"
  | "canceled";

export type FriendshipStatus = "pending" | "accepted" | "rejected" | "blocked";

export type User = {
  id: string;
  displayName: string;
  avatar: string;
  distanceKm: number;
  sharedCount: number;
  rating: number;
  bio: string;
  neighborhood: string;
  isFriend?: boolean;
};

export type Book = {
  id: string;
  ownerId: string;
  title: string;
  author: string;
  category: string;
  language: string;
  condition: string;
  status: BookStatus;
  distanceKm: number;
  description: string;
  coverColor: string;
  accentColor: string;
  year: string;
};

export type BorrowRequest = {
  id: string;
  bookId: string;
  borrowerId: string;
  lenderId: string;
  status: BorrowStatus;
  message: string;
  dateLabel: string;
  conversationId?: string;
  chatMessages?: BorrowChatMessage[];
};

export type BorrowChatMessage = {
  id: string;
  senderId: string;
  body: string;
  createdAt: string;
  kind?: "text" | "system";
};

export type Friendship = {
  id: string;
  requesterId: string;
  receiverId: string;
  status: FriendshipStatus;
  dateLabel: string;
};

export type MessageThread = {
  id: string;
  userId: string;
  preview: string;
  time: string;
  unread?: boolean;
  kind: "borrow" | "friend" | "system" | "chat";
};

export type MessageNotification = {
  id: string;
  kind: "borrow" | "friend" | "system";
  title: string;
  body: string;
  time: string;
  unread: boolean;
  userId?: string;
  bookId?: string;
  requestId?: string;
  friendshipId?: string;
  status?: BorrowStatus;
};

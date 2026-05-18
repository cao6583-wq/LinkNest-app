import { Book, BorrowRequest, MessageThread, User } from "../types";

export const users: User[] = [
  {
    id: "alice",
    displayName: "Alice",
    avatar: "A",
    distanceKm: 0.6,
    sharedCount: 36,
    rating: 4.9,
    bio: "喜欢文学、童书和城市散步。周末通常方便交接。",
    neighborhood: "圣城欢乐房屋",
    isFriend: false
  },
  {
    id: "bob",
    displayName: "Bob",
    avatar: "B",
    distanceKm: 1.3,
    sharedCount: 18,
    rating: 4.8,
    bio: "科幻和商业类读者，愿意交换书单。",
    neighborhood: "Riverside",
    isFriend: true
  },
  {
    id: "carol",
    displayName: "Carol",
    avatar: "C",
    distanceKm: 2.1,
    sharedCount: 12,
    rating: 4.9,
    bio: "家里有很多儿童读物，也欢迎邻居推荐。",
    neighborhood: "Maple Lane",
    isFriend: false
  }
];

export const books: Book[] = [
  {
    id: "little-prince",
    ownerId: "alice",
    title: "小王子",
    author: "安托万·德·圣埃克苏佩里",
    category: "文学",
    language: "中文",
    condition: "良好",
    status: "available",
    distanceKm: 0.6,
    description: "一本适合反复阅读的温柔寓言。封面有轻微使用痕迹，内页干净。",
    coverColor: "#17476A",
    accentColor: "#F4C95D",
    year: "2015"
  },
  {
    id: "kite-runner",
    ownerId: "bob",
    title: "追风筝的人",
    author: "卡勒德·胡赛尼",
    category: "小说",
    language: "中文",
    condition: "九成新",
    status: "available",
    distanceKm: 1.1,
    description: "故事很有冲击力，适合想读长篇小说的邻居。",
    coverColor: "#B85745",
    accentColor: "#F6E4B1",
    year: "2018"
  },
  {
    id: "living",
    ownerId: "carol",
    title: "活着",
    author: "余华",
    category: "文学",
    language: "中文",
    condition: "良好",
    status: "available",
    distanceKm: 1.1,
    description: "经典作品，页角有几处折痕。",
    coverColor: "#3E6075",
    accentColor: "#E4E9D8",
    year: "2012"
  },
  {
    id: "store",
    ownerId: "alice",
    title: "解忧杂货店",
    author: "东野圭吾",
    category: "小说",
    language: "中文",
    condition: "较新",
    status: "borrowed",
    distanceKm: 1.3,
    description: "借阅中，预计 5 天后可再次借出。",
    coverColor: "#2F4F3E",
    accentColor: "#F0D8A8",
    year: "2017"
  },
  {
    id: "hundred-years",
    ownerId: "bob",
    title: "百年孤独",
    author: "加西亚·马尔克斯",
    category: "文学",
    language: "中文",
    condition: "良好",
    status: "available",
    distanceKm: 1.2,
    description: "魔幻现实主义经典，适合慢慢读。",
    coverColor: "#223C3A",
    accentColor: "#D9B86C",
    year: "2011"
  }
];

export const borrowRequests: BorrowRequest[] = [
  {
    id: "borrow-1",
    bookId: "store",
    borrowerId: "bob",
    lenderId: "alice",
    status: "borrowed",
    message: "已借出，剩余 5 天",
    dateLabel: "05-10 至 05-25"
  },
  {
    id: "borrow-2",
    bookId: "little-prince",
    borrowerId: "bob",
    lenderId: "alice",
    status: "pending",
    message: "等待 Alice 确认",
    dateLabel: "今天"
  }
];

export const threads: MessageThread[] = [
  {
    id: "thread-alice",
    userId: "alice",
    preview: "我看到了你的借阅申请，今天晚上可以确认。",
    time: "10:30",
    unread: true,
    kind: "borrow"
  },
  {
    id: "thread-bob",
    userId: "bob",
    preview: "借出申请已通过",
    time: "05-20",
    kind: "system"
  },
  {
    id: "thread-carol",
    userId: "carol",
    preview: "Carol 发送了好友申请",
    time: "05-16",
    kind: "friend"
  }
];

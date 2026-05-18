import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  SafeAreaView,
  ScrollView,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions
} from "react-native";
import {
  Bell,
  BookMarked,
  BookOpen,
  Camera,
  Check,
  ChevronLeft,
  Clock3,
  Grid2X2,
  Heart,
  List,
  Map,
  MapPin,
  MessageCircle,
  Plus,
  ScanLine,
  Search,
  Send,
  Settings,
  Shield,
  SlidersHorizontal,
  Star,
  UserPlus,
  UserRound,
  Users
} from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";

import { defaultNearbyQuery, fetchBookCatalog, type NearbyQuery } from "./src/data/bookCatalog";
import {
  draftFromBook,
  publishBook,
  updatePublishedBook,
  type BookDraft
} from "./src/data/bookPublishing";
import {
  bookStatusForBorrow,
  createBorrowRequest,
  statusLabel,
  statusMessage,
  transitionBorrowRequest
} from "./src/data/borrowWorkflow";
import {
  demoFriendships,
  findFriendship,
  relationshipFor,
  relationLabel,
  sendFriendRequest as createFriendRequest,
  transitionFriendship
} from "./src/data/friendWorkflow";
import {
  borrowNotification,
  friendNotification,
  initialNotificationsFromBorrowRequests,
  markNotificationsRead
} from "./src/data/notifications";
import { submitReport, type ReportDraft } from "./src/data/reports";
import { books as mockBooks, borrowRequests as mockBorrowRequests, threads, users as mockUsers } from "./src/data/mockData";
import {
  getCurrentAuthUser,
  signInWithEmail,
  signOut,
  signUpWithEmail,
  type AuthMode,
  type AuthUser
} from "./src/lib/auth";
import { isSupabaseConfigured, supabase } from "./src/lib/supabase";
import { Book, BorrowRequest, BorrowStatus, Friendship, FriendshipStatus, MessageNotification, User } from "./src/types";

type TabKey = "discover" | "shelf" | "messages" | "neighbors" | "me";
type DiscoverMode = "map" | "list";
type Screen =
  | { name: "tabs" }
  | { name: "book"; bookId: string }
  | { name: "borrow"; bookId: string }
  | { name: "borrowSent"; bookId: string }
  | { name: "lender"; userId: string }
  | { name: "friendSent"; userId: string }
  | { name: "bookForm"; bookId?: string }
  | { name: "auth"; mode?: AuthMode; message?: string };

const palette = {
  background: "#F3FAF6",
  panel: "#FFFFFF",
  ink: "#1A322D",
  muted: "#91AAA3",
  faint: "#E4EFEB",
  green: "#479987",
  greenDark: "#17352F",
  greenSoft: "#E6F5F0",
  gold: "#CDA15B",
  red: "#D95E63",
  blue: "#7EAFC0"
};

const tabs = [
  { key: "discover", label: "附近", icon: MapPin },
  { key: "shelf", label: "书架", icon: BookOpen },
  { key: "neighbors", label: "社区", icon: Users },
  { key: "messages", label: "消息", icon: MessageCircle },
  { key: "me", label: "我的", icon: UserRound }
] satisfies Array<{ key: TabKey; label: string; icon: LucideIcon }>;

export default function App() {
  const { width } = useWindowDimensions();
  const [activeTab, setActiveTab] = useState<TabKey>("discover");
  const [screen, setScreen] = useState<Screen>({ name: "tabs" });
  const [discoverMode, setDiscoverMode] = useState<DiscoverMode>("list");
  const [query, setQuery] = useState("");
  const [favorites, setFavorites] = useState<string[]>(["hundred-years"]);
  const [friendships, setFriendships] = useState<Friendship[]>(demoFriendships);
  const [applicationNote, setApplicationNote] = useState("Hi，我想借这本书，时间方便的话这周末可以交接。");
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [catalogBooks, setCatalogBooks] = useState<Book[]>(mockBooks);
  const [catalogUsers, setCatalogUsers] = useState<User[]>(mockUsers);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogSource, setCatalogSource] = useState<"supabase" | "mock">("mock");
  const [catalogError, setCatalogError] = useState<string | undefined>();
  const [catalogRefreshKey, setCatalogRefreshKey] = useState(0);
  const [nearbyQuery, setNearbyQuery] = useState<NearbyQuery>(defaultNearbyQuery);
  const [locationMessage, setLocationMessage] = useState("默认位置：Toronto Downtown");
  const [borrowRequests, setBorrowRequests] = useState<BorrowRequest[]>(mockBorrowRequests);
  const [notifications, setNotifications] = useState<MessageNotification[]>(() => (
    initialNotificationsFromBorrowRequests(mockBorrowRequests, mockBooks, mockUsers, threads)
  ));

  const isWide = width >= 760;

  useEffect(() => {
    let mounted = true;

    getCurrentAuthUser()
      .then((user) => {
        if (mounted) setAuthUser(user);
      })
      .catch(() => {
        if (mounted) setAuthUser(null);
      })
      .finally(() => {
        if (mounted) setAuthLoading(false);
      });

    if (!isSupabaseConfigured) {
      return () => {
        mounted = false;
      };
    }

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;
      setAuthUser(user?.email
        ? {
          id: user.id,
          email: user.email,
          displayName: typeof user.user_metadata?.display_name === "string"
            ? user.user_metadata.display_name
            : user.email.split("@")[0]
        }
        : null);
      setAuthLoading(false);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    setCatalogLoading(true);
    fetchBookCatalog(nearbyQuery)
      .then((catalog) => {
        if (!mounted) return;
        setCatalogBooks(catalog.books);
        setCatalogUsers(catalog.users);
        setCatalogSource(catalog.source);
        setCatalogError(catalog.error);
      })
      .finally(() => {
        if (mounted) setCatalogLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [nearbyQuery, catalogRefreshKey]);

  const reloadCatalog = () => {
    setCatalogRefreshKey((current) => current + 1);
  };

  useEffect(() => {
    if (activeTab === "messages") {
      setNotifications((current) => markNotificationsRead(current));
    }
  }, [activeTab]);

  const visibleBooks = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery) return catalogBooks;
    return catalogBooks.filter((book) => {
      const haystack = `${book.title} ${book.author} ${book.category}`.toLowerCase();
      return haystack.includes(cleanQuery);
    });
  }, [catalogBooks, query]);

  const selectedBook = screen.name === "book" || screen.name === "borrow" || screen.name === "borrowSent"
    ? catalogBooks.find((book) => book.id === screen.bookId)
    : undefined;
  const selectedUser = screen.name === "lender" || screen.name === "friendSent"
    ? catalogUsers.find((user) => user.id === screen.userId)
    : undefined;
  const editingBook = screen.name === "bookForm" && screen.bookId
    ? catalogBooks.find((book) => book.id === screen.bookId)
    : undefined;
  const unreadNotificationCount = notifications.filter((notification) => notification.unread).length;

  const goTabs = (tab?: TabKey) => {
    if (tab) setActiveTab(tab);
    setScreen({ name: "tabs" });
  };

  const openBook = (bookId: string) => setScreen({ name: "book", bookId });
  const openLender = (userId: string) => setScreen({ name: "lender", userId });

  const updateNearbyQuery = (patch: Partial<NearbyQuery>) => {
    setNearbyQuery((current) => ({ ...current, ...patch }));
  };

  const useCurrentLocation = () => {
    const geolocation = typeof navigator !== "undefined" ? navigator.geolocation : undefined;
    if (!geolocation) {
      setLocationMessage("当前环境不支持定位，继续使用默认位置。");
      return;
    }

    setLocationMessage("正在获取当前位置...");
    geolocation.getCurrentPosition(
      (position) => {
        updateNearbyQuery({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        setLocationMessage("已使用当前位置查询附近图书");
      },
      () => {
        setLocationMessage("无法获取定位，继续使用默认位置。");
      },
      {
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 60000
      }
    );
  };

  const requireAuth = (action: () => void, message = "登录后可以继续完成这个操作。") => {
    if (authUser) {
      action();
      return;
    }
    setPendingAction(() => action);
    setScreen({ name: "auth", mode: "signIn", message });
  };

  const toggleFavorite = (bookId: string) => {
    requireAuth(
      () => {
        setFavorites((current) => current.includes(bookId)
          ? current.filter((id) => id !== bookId)
          : [...current, bookId]);
      },
      "登录后可以收藏图书，方便以后回到书架里查看。"
    );
  };

  const handleSendFriendRequest = (user: User) => {
    requireAuth(
      async () => {
        if (!authUser) return;
        const existing = findFriendship(authUser.id, user.id, friendships);
        if (existing) return;
        const friendship = await createFriendRequest(authUser, user);
        setFriendships((current) => [friendship, ...current]);
        setNotifications((current) => [
          friendNotification(friendship, user, "sent"),
          ...current
        ]);
        setScreen({ name: "friendSent", userId: user.id });
      },
      "登录后可以添加附近书友。"
    );
  };

  const handleFriendshipTransition = async (friendship: Friendship, nextStatus: FriendshipStatus) => {
    const updated = await transitionFriendship(friendship, nextStatus);
    setFriendships((current) => current.map((item) => item.id === updated.id ? updated : item));
    const otherUserId = updated.requesterId === authUser?.id ? updated.receiverId : updated.requesterId;
    const otherUser = getUser(otherUserId, catalogUsers);
    setNotifications((current) => [
      friendNotification(updated, otherUser, "transition"),
      ...current
    ]);
  };

  const handleAuthSuccess = (user: AuthUser) => {
    setAuthUser(user);
    setCatalogUsers((current) => ensureUserInDirectory(current, user));
    const action = pendingAction;
    setPendingAction(null);
    if (action) {
      action();
      return;
    }
    goTabs("me");
  };

  const handleSignOut = async () => {
    await signOut();
    setAuthUser(null);
    setPendingAction(null);
    goTabs("discover");
  };

  const openBookForm = (bookId?: string) => {
    requireAuth(
      () => setScreen({ name: "bookForm", bookId }),
      bookId ? "登录后可以编辑你的共享图书。" : "登录后可以发布附近可借的图书。"
    );
  };

  const handleSaveBook = async (draft: BookDraft, book?: Book) => {
    if (!authUser) {
      setScreen({ name: "auth", mode: "signIn", message: "登录后可以发布图书。" });
      return;
    }

    const savedBook = book
      ? await updatePublishedBook(book, draft, authUser)
      : await publishBook(draft, authUser);

    setCatalogUsers((current) => ensureUserInDirectory(current, authUser));
    setCatalogBooks((current) => (
      book
        ? current.map((item) => item.id === savedBook.id ? savedBook : item)
        : [savedBook, ...current]
    ));
    setCatalogSource(isSupabaseConfigured && !authUser.isDemo ? "supabase" : "mock");
    setCatalogError(undefined);
    setActiveTab("shelf");
    setScreen({ name: "tabs" });
  };

  const handleCreateBorrowRequest = async (book: Book, message: string) => {
    if (!authUser) {
      setScreen({ name: "auth", mode: "signIn", message: "登录后可以申请借阅。" });
      return;
    }
    if (book.ownerId === authUser.id) {
      throw new Error("不能申请借阅自己发布的图书。");
    }

    const request = await createBorrowRequest({
      book,
      borrower: authUser,
      message
    });

    setBorrowRequests((current) => [request, ...current]);
    setCatalogBooks((current) => updateBookStatus(current, request.bookId, bookStatusForBorrow(request.status)));
    setNotifications((current) => [
      borrowNotification({
        request,
        book,
        actorName: authUser.displayName,
        event: "created"
      }),
      ...current
    ]);
    setScreen({ name: "borrowSent", bookId: book.id });
  };

  const handleBorrowTransition = async (request: BorrowRequest, nextStatus: BorrowStatus) => {
    const updated = await transitionBorrowRequest({ request, nextStatus });
    const book = catalogBooks.find((item) => item.id === updated.bookId);
    setBorrowRequests((current) => current.map((item) => item.id === updated.id ? updated : item));
    setCatalogBooks((current) => updateBookStatus(current, updated.bookId, bookStatusForBorrow(updated.status)));
    if (book) {
      setNotifications((current) => [
        borrowNotification({
          request: updated,
          book,
          actorName: authUser?.displayName,
          event: "transition"
        }),
        ...current
      ]);
    }
  };

  const handleSubmitReport = async (draft: ReportDraft) => {
    if (!authUser) {
      throw new Error("请先登录后提交举报。");
    }
    await submitReport(authUser, draft);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.appFrame, isWide && styles.appFrameWide]}>
        {screen.name === "tabs" && (
          <>
            <View style={styles.content}>
              {activeTab === "discover" && (
                <DiscoverScreen
                  mode={discoverMode}
                  setMode={setDiscoverMode}
                  query={query}
                  setQuery={setQuery}
                  books={visibleBooks}
                  users={catalogUsers}
                  favorites={favorites}
                  loading={catalogLoading}
                  source={catalogSource}
                  error={catalogError}
                  nearbyQuery={nearbyQuery}
                  locationMessage={locationMessage}
                  onNearbyQueryChange={updateNearbyQuery}
                  onUseCurrentLocation={useCurrentLocation}
                  onRetry={reloadCatalog}
                  onOpenBook={openBook}
                  onToggleFavorite={toggleFavorite}
                />
              )}
              {activeTab === "shelf" && (
                authUser ? (
                  <ShelfScreen
                    books={catalogBooks}
                    users={catalogUsers}
                    currentUser={authUser}
                    borrowRequests={borrowRequests}
                    favorites={favorites}
                    onOpenBook={openBook}
                    onEditBook={openBookForm}
                    onBorrowTransition={handleBorrowTransition}
                    onRequireAuth={(action) => requireAuth(action, "登录后可以管理你的共享书架。")}
                  />
                ) : (
                  <AuthRequiredPanel
                    title="登录后查看书架"
                    subtitle="你的共享、借入、出借和收藏都会集中在这里。"
                    loading={authLoading}
                    onSignIn={() => setScreen({ name: "auth", mode: "signIn", message: "登录后可以查看和管理你的书架。" })}
                    onSignUp={() => setScreen({ name: "auth", mode: "signUp", message: "创建账号后就可以发布第一本共享书。" })}
                  />
                )
              )}
              {activeTab === "messages" && (
                authUser ? (
                  <MessagesScreen
                    books={catalogBooks}
                    users={catalogUsers}
                    notifications={notifications}
                    borrowRequests={borrowRequests}
                    onOpenBook={openBook}
                  />
                ) : (
                  <AuthRequiredPanel
                    title="登录后查看消息"
                    subtitle="借阅申请、好友通知和聊天记录会显示在这里。"
                    loading={authLoading}
                    onSignIn={() => setScreen({ name: "auth", mode: "signIn", message: "登录后可以查看消息和借阅通知。" })}
                    onSignUp={() => setScreen({ name: "auth", mode: "signUp", message: "创建账号后就可以接收借阅通知。" })}
                  />
                )
              )}
              {activeTab === "neighbors" && (
                <NeighborsScreen
                  currentUser={authUser}
                  friendships={friendships}
                  users={catalogUsers}
                  onOpenLender={openLender}
                  onAddFriend={handleSendFriendRequest}
                  onFriendshipTransition={handleFriendshipTransition}
                />
              )}
              {activeTab === "me" && (
                <MeScreen
                  user={authUser}
                  loading={authLoading}
                  catalogSource={catalogSource}
                  onSignIn={() => setScreen({ name: "auth", mode: "signIn", message: "登录后可以管理个人资料和隐私设置。" })}
                  onSignUp={() => setScreen({ name: "auth", mode: "signUp", message: "创建账号后就可以开始共享附近的书。" })}
                  onSignOut={handleSignOut}
                />
              )}
            </View>
            <BottomTabs activeTab={activeTab} unreadMessages={unreadNotificationCount} onChange={(tab) => goTabs(tab)} />
          </>
        )}

        {screen.name === "book" && selectedBook && (
          <BookDetailScreen
            book={selectedBook}
            users={catalogUsers}
            isFavorite={favorites.includes(selectedBook.id)}
            onBack={() => goTabs("discover")}
            onBorrow={() => requireAuth(
              () => setScreen({ name: "borrow", bookId: selectedBook.id }),
              "登录后可以向出借者发送借阅申请。"
            )}
            onToggleFavorite={() => toggleFavorite(selectedBook.id)}
            onOpenLender={() => openLender(selectedBook.ownerId)}
            currentUser={authUser}
            onRequireAuth={() => setScreen({ name: "auth", mode: "signIn", message: "登录后可以提交举报，帮助保护社区安全。" })}
            onSubmitReport={() => handleSubmitReport({
              bookId: selectedBook.id,
              reportedUserId: selectedBook.ownerId,
              detail: `举报图书：${selectedBook.title}`
            })}
          />
        )}

        {screen.name === "book" && !selectedBook && !catalogLoading && (
          <NotFoundScreen
            title="图书不存在"
            subtitle="这本书可能已下架，或附近数据已经刷新。"
            actionLabel="回到发现"
            onAction={() => goTabs("discover")}
          />
        )}

        {screen.name === "borrow" && selectedBook && (
          <BorrowScreen
            book={selectedBook}
            books={catalogBooks}
            users={catalogUsers}
            note={applicationNote}
            setNote={setApplicationNote}
            onBack={() => setScreen({ name: "book", bookId: selectedBook.id })}
            onSend={(message) => handleCreateBorrowRequest(selectedBook, message)}
          />
        )}

        {screen.name === "borrowSent" && selectedBook && (
          <SuccessScreen
            title="申请已发送"
            subtitle="等待对方回复，你可以在消息里查看进度。"
            actionLabel="查看申请状态"
            onAction={() => goTabs("shelf")}
          />
        )}

        {screen.name === "lender" && selectedUser && (
          <LenderScreen
            user={selectedUser}
            books={catalogBooks}
            relation={relationshipFor(authUser, selectedUser, friendships)}
            onBack={() => goTabs("neighbors")}
            onOpenBook={openBook}
            onAddFriend={() => handleSendFriendRequest(selectedUser)}
            onFriendshipTransition={(nextStatus) => {
              if (!authUser) return;
              const friendship = findFriendship(authUser.id, selectedUser.id, friendships);
              if (friendship) void handleFriendshipTransition(friendship, nextStatus);
            }}
            currentUser={authUser}
            onRequireAuth={() => setScreen({ name: "auth", mode: "signIn", message: "登录后可以提交举报，帮助保护社区安全。" })}
            onSubmitReport={() => handleSubmitReport({
              reportedUserId: selectedUser.id,
              detail: `举报用户：${selectedUser.displayName}`
            })}
          />
        )}

        {screen.name === "lender" && !selectedUser && !catalogLoading && (
          <NotFoundScreen
            title="邻居资料不可用"
            subtitle="对方可能调整了隐私设置，或附近数据已经刷新。"
            actionLabel="回到邻居"
            onAction={() => goTabs("neighbors")}
          />
        )}

        {screen.name === "friendSent" && selectedUser && (
          <SuccessScreen
            title="好友申请已发送"
            subtitle={`等待 ${selectedUser.displayName} 同意后，你们就可以更方便地交换书单。`}
            actionLabel="查看好友"
            onAction={() => goTabs("neighbors")}
          />
        )}

        {screen.name === "auth" && (
          <AuthScreen
            initialMode={screen.mode ?? "signIn"}
            message={screen.message}
            onBack={() => {
              setPendingAction(null);
              goTabs(activeTab);
            }}
            onSuccess={handleAuthSuccess}
          />
        )}

        {screen.name === "bookForm" && authUser && (
          <BookFormScreen
            book={editingBook}
            user={authUser}
            onBack={() => goTabs("shelf")}
            onSave={handleSaveBook}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

function DiscoverScreen({
  mode,
  setMode,
  query,
  setQuery,
  books: displayBooks,
  users,
  favorites,
  loading,
  source,
  error,
  nearbyQuery,
  locationMessage,
  onNearbyQueryChange,
  onUseCurrentLocation,
  onRetry,
  onOpenBook,
  onToggleFavorite
}: {
  mode: DiscoverMode;
  setMode: (mode: DiscoverMode) => void;
  query: string;
  setQuery: (query: string) => void;
  books: Book[];
  users: User[];
  favorites: string[];
  loading: boolean;
  source: "supabase" | "mock";
  error?: string;
  nearbyQuery: NearbyQuery;
  locationMessage: string;
  onNearbyQueryChange: (patch: Partial<NearbyQuery>) => void;
  onUseCurrentLocation: () => void;
  onRetry: () => void;
  onOpenBook: (bookId: string) => void;
  onToggleFavorite: (bookId: string) => void;
}) {
  const categories = ["全部", "小说", "文学", "社科", "商业", "心理"];
  const radiusOptions = [1, 3, 5, 10];

  return (
    <View style={styles.screen}>
      <View style={styles.discoverHeader}>
        <View style={styles.discoverTitleBlock}>
          <Text style={styles.discoverHeaderTitle}>
            <Text style={styles.discoverTitleAccent}>附近有 </Text>
            {displayBooks.length} 本书
          </Text>
          <TouchableOpacity activeOpacity={0.86} style={styles.locationPill} onPress={onUseCurrentLocation}>
            <View style={styles.locationPulse} />
            <Text style={styles.locationPillText}>徐汇区</Text>
            <View style={styles.locationPillDivider} />
            <Text style={styles.locationPillText}>{nearbyQuery.radiusKm} km</Text>
            <Text style={styles.locationPillChevron}>⌄</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.discoverHeaderRight}>
          <SegmentedIconControl
            value={mode}
            options={[
              { value: "list", icon: List, label: "列表" },
              { value: "map", icon: Map, label: "地图" }
            ]}
            onChange={(next) => setMode(next as DiscoverMode)}
          />
        </View>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Search size={18} color={palette.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="搜索书名、作者或邻里"
            placeholderTextColor="#9EA69D"
            style={styles.searchInput}
          />
        </View>
      </View>

      <View style={styles.filterRow}>
        {categories.map((category) => (
          <Chip
            key={category}
            label={category}
            active={nearbyQuery.category === category}
            onPress={() => onNearbyQueryChange({ category })}
          />
        ))}
      </View>

      <View style={styles.radiusRowHidden}>
        {radiusOptions.map((radiusKm) => (
          <Chip
            key={radiusKm}
            label={`${radiusKm}km`}
            active={nearbyQuery.radiusKm === radiusKm}
            onPress={() => onNearbyQueryChange({ radiusKm })}
          />
        ))}
      </View>

      {(loading || error || source === "supabase") && (
        <StatusBanner
          tone={error ? "warning" : "success"}
          text={loading ? "正在读取附近图书..." : error ? "已使用本地示例数据，稍后可重试连接 Supabase。" : `已连接 ${source === "supabase" ? "Supabase" : "本地"} 数据`}
          actionLabel={error ? "重试" : undefined}
          onAction={error ? onRetry : undefined}
        />
      )}

      <View style={styles.locationHintCompact}>
        <MapPin size={14} color={palette.muted} />
        <Text style={styles.locationHintText}>{locationMessage}</Text>
      </View>

      {mode === "map" ? (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {loading && !displayBooks.length ? (
            <LoadingState title="正在查找附近图书" subtitle="会优先读取 Supabase，失败时自动使用本地示例数据。" />
          ) : displayBooks.length ? (
            <>
              <MapPreview books={displayBooks} users={users} onOpenBook={onOpenBook} />
              <SectionTitle title="附近好书" action="查看全部" />
              <HorizontalBooks books={displayBooks} onOpenBook={onOpenBook} />
            </>
          ) : (
            <EmptyState title="附近暂时没有匹配图书" subtitle="试试扩大范围，或切换到全部分类。" />
          )}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {loading && !displayBooks.length ? (
            <LoadingState title="正在加载列表" subtitle="稍等片刻，附近图书马上出现。" />
          ) : displayBooks.length ? (
            displayBooks.map((book) => (
              <BookListItem
                key={book.id}
                book={book}
                isFavorite={favorites.includes(book.id)}
                onPress={() => onOpenBook(book.id)}
                onToggleFavorite={() => onToggleFavorite(book.id)}
                users={users}
              />
            ))
          ) : (
            <EmptyState title="没有找到图书" subtitle="换个关键词、分类或距离范围再试。" />
          )}
        </ScrollView>
      )}
    </View>
  );
}

function MapPreview({
  books: mapBooks,
  users,
  onOpenBook
}: {
  books: Book[];
  users: User[];
  onOpenBook: (bookId: string) => void;
}) {
  const pins = [
    { top: 44, left: 72 },
    { top: 66, left: 285 },
    { top: 166, left: 50 },
    { top: 208, left: 275 },
    { top: 108, left: 188 }
  ];

  return (
    <View style={styles.mapPanel}>
      <View style={styles.mapGrid} />
      <View style={[styles.mapStreet, styles.mapStreetOne]} />
      <View style={[styles.mapStreet, styles.mapStreetTwo]} />
      <View style={[styles.mapStreet, styles.mapStreetThree]} />
      <View style={styles.currentLocation} />
      {mapBooks.slice(0, 5).map((book, index) => (
        <TouchableOpacity
          key={book.id}
          activeOpacity={0.85}
          style={[styles.mapPin, pins[index]]}
          onPress={() => onOpenBook(book.id)}
        >
          <Text style={styles.mapPinText}>{index === 0 ? "12" : index + 3}</Text>
        </TouchableOpacity>
      ))}
      {mapBooks[0] && (
        <TouchableOpacity
          activeOpacity={0.9}
          style={styles.floatingBook}
          onPress={() => onOpenBook(mapBooks[0].id)}
        >
          <BookCover book={mapBooks[0]} size="small" />
          <View style={styles.flex}>
            <Text style={styles.cardTitle}>{mapBooks[0].title}</Text>
            <Text style={styles.mutedText}>{mapBooks[0].author}</Text>
            <Text style={styles.greenText}>{formatApproxDistance(mapBooks[0].distanceKm)} · 可借</Text>
          </View>
          <Avatar user={getUser(mapBooks[0].ownerId, users)} size={32} />
        </TouchableOpacity>
      )}
    </View>
  );
}

function HorizontalBooks({ books: rowBooks, onOpenBook }: { books: Book[]; onOpenBook: (bookId: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalBooks}>
      {rowBooks.map((book) => (
        <TouchableOpacity key={book.id} activeOpacity={0.9} style={styles.bookTile} onPress={() => onOpenBook(book.id)}>
          <BookCover book={book} size="medium" />
          <Text numberOfLines={1} style={styles.tileTitle}>{book.title}</Text>
          <Text numberOfLines={1} style={styles.mutedText}>{formatApproxDistance(book.distanceKm)}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

function BookDetailScreen({
  book,
  users,
  isFavorite,
  onBack,
  onBorrow,
  onToggleFavorite,
  onOpenLender,
  currentUser,
  onRequireAuth,
  onSubmitReport
}: {
  book: Book;
  users: User[];
  isFavorite: boolean;
  onBack: () => void;
  onBorrow: () => void;
  onToggleFavorite: () => void;
  onOpenLender: () => void;
  currentUser: AuthUser | null;
  onRequireAuth: () => void;
  onSubmitReport: () => Promise<void>;
}) {
  const owner = getUser(book.ownerId, users);
  const unavailable = book.status !== "available";

  return (
    <View style={styles.screen}>
      <TopBar title="书籍详情" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.detailContent} showsVerticalScrollIndicator={false}>
        <View style={styles.centered}>
          <BookCover book={book} size="large" />
        </View>
        <Text style={styles.detailTitle}>{book.title}</Text>
        <Text style={styles.detailSubtitle}>{book.author}</Text>
        <View style={styles.metaRow}>
          <MetaPill icon={MapPin} label={formatApproxDistance(book.distanceKm)} />
          <MetaPill icon={BookMarked} label={book.status === "available" ? "可借" : "借阅中"} />
          <MetaPill icon={Star} label={owner.rating.toFixed(1)} />
        </View>

        <View style={styles.privacyNotice}>
          <Shield size={16} color={palette.green} />
          <Text style={styles.privacyNoticeText}>为保护邻居隐私，位置只显示大致距离。具体交接地点会在双方确认借阅后沟通。</Text>
        </View>

        <View style={styles.infoBand}>
          <Text style={styles.sectionHeading}>书籍简介</Text>
          <Text style={styles.bodyText}>{book.description}</Text>
        </View>

        <View style={styles.infoBand}>
          <Text style={styles.sectionHeading}>书籍信息</Text>
          <InfoLine label="新旧状态" value={book.condition} />
          <InfoLine label="类别" value={book.category} />
          <InfoLine label="语言" value={book.language} />
          <InfoLine label="出版年份" value={book.year} />
        </View>

        <TouchableOpacity activeOpacity={0.88} style={styles.lenderRow} onPress={onOpenLender}>
          <Avatar user={owner} size={48} />
          <View style={styles.flex}>
            <Text style={styles.cardTitle}>{owner.displayName}</Text>
            <Text style={styles.mutedText}>共享 {owner.sharedCount} 本书 · {formatApproxDistance(owner.distanceKm)}</Text>
          </View>
          <View style={styles.ratingBadge}>
            <Star size={14} color={palette.gold} fill={palette.gold} />
            <Text style={styles.ratingText}>{owner.rating}</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.infoBand}>
          <SectionTitle title="用户评论" action="查看全部" />
          <View style={styles.reviewRow}>
            <Avatar user={getUser("bob", users)} size={36} />
            <View style={styles.flex}>
              <Text style={styles.cardTitle}>Bob</Text>
              <Text style={styles.bodyText}>很温暖的一本书，借阅过程也很顺利。</Text>
            </View>
          </View>
        </View>

        <ReportButton
          label="举报这本书或出借者"
          currentUser={currentUser}
          onRequireAuth={onRequireAuth}
          onSubmit={onSubmitReport}
        />
      </ScrollView>
      <View style={styles.actionBar}>
        <TouchableOpacity activeOpacity={0.85} style={styles.secondaryAction} onPress={onToggleFavorite}>
          <Heart size={20} color={isFavorite ? palette.red : palette.green} fill={isFavorite ? palette.red : "transparent"} />
          <Text style={styles.secondaryActionText}>{isFavorite ? "已收藏" : "收藏"}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.9}
          disabled={unavailable}
          style={[styles.primaryAction, unavailable && styles.disabledAction]}
          onPress={onBorrow}
        >
          <Text style={styles.primaryActionText}>{unavailable ? "暂不可借" : "申请借阅"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function BorrowScreen({
  book,
  books,
  users,
  note,
  setNote,
  onBack,
  onSend
}: {
  book: Book;
  books: Book[];
  users: User[];
  note: string;
  setNote: (note: string) => void;
  onBack: () => void;
  onSend: (message: string) => Promise<void>;
}) {
  const owner = getUser(book.ownerId, users);
  const recommended = books.filter((candidate) => candidate.ownerId === book.ownerId).slice(0, 3);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    setSending(true);
    try {
      await onSend(note);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "发送申请失败，请稍后再试。");
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.screen}>
      <TopBar title="发送借阅申请" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.detailContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionHeading}>将向 {owner.displayName} 发送借阅申请</Text>
        <BookListItem book={book} compact users={users} onPress={() => undefined} />

        <View style={styles.infoBand}>
          <Text style={styles.sectionHeading}>同一位邻居的其他书</Text>
          {recommended.map((item) => (
            <View key={item.id} style={styles.checkBookRow}>
              <BookCover book={item} size="tiny" />
              <View style={styles.flex}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.mutedText}>{item.status === "available" ? "可借" : "借阅中"}</Text>
              </View>
              <View style={styles.checkCircle}>
                <Check size={16} color="#FFFFFF" />
              </View>
            </View>
          ))}
          <Text style={styles.helperText}>已选 1/3 本，不推荐一次申请过多。</Text>
        </View>

        <View style={styles.infoBand}>
          <Text style={styles.sectionHeading}>留言</Text>
          <TextInput
            multiline
            value={note}
            onChangeText={setNote}
            style={styles.noteInput}
            placeholder="告诉对方你想什么时候借、什么时候归还"
            placeholderTextColor="#9EA69D"
          />
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </ScrollView>
      <View style={styles.actionBar}>
        <TouchableOpacity
          activeOpacity={0.9}
          disabled={sending}
          style={[styles.primaryAction, sending && styles.disabledAction]}
          onPress={submit}
        >
          <Send size={18} color="#FFFFFF" />
          <Text style={styles.primaryActionText}>{sending ? "发送中..." : "发送申请"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function LenderScreen({
  user,
  books,
  relation,
  onBack,
  onOpenBook,
  onAddFriend,
  onFriendshipTransition,
  currentUser,
  onRequireAuth,
  onSubmitReport
}: {
  user: User;
  books: Book[];
  relation: ReturnType<typeof relationshipFor>;
  onBack: () => void;
  onOpenBook: (bookId: string) => void;
  onAddFriend: () => void;
  onFriendshipTransition: (nextStatus: FriendshipStatus) => void;
  currentUser: AuthUser | null;
  onRequireAuth: () => void;
  onSubmitReport: () => Promise<void>;
}) {
  const userBooks = books.filter((book) => book.ownerId === user.id);
  const canAdd = relation === "none" || relation === "rejected";
  const canRespond = relation === "pending_received";

  return (
    <View style={styles.screen}>
      <TopBar title="出借者详情" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.detailContent} showsVerticalScrollIndicator={false}>
        <View style={styles.profileHeader}>
          <Avatar user={user} size={72} />
          <View style={styles.flex}>
            <Text style={styles.detailTitle}>{user.displayName}</Text>
            <Text style={styles.mutedText}>{user.neighborhood} · {formatApproxDistance(user.distanceKm)}</Text>
            <View style={styles.ratingInline}>
              <Star size={16} color={palette.gold} fill={palette.gold} />
              <Text style={styles.ratingText}>{user.rating} · {user.sharedCount} 本共享</Text>
            </View>
          </View>
        </View>

        <Text style={styles.bodyText}>{user.bio}</Text>

        <View style={styles.privacyNotice}>
          <Shield size={16} color={palette.green} />
          <Text style={styles.privacyNoticeText}>资料页不会展示精确地址或联系方式。建议只在确认借阅后约定公开地点交接。</Text>
        </View>

        <View style={styles.profileActions}>
          <TouchableOpacity
            activeOpacity={0.88}
            style={styles.outlineButton}
            disabled={!canAdd && !canRespond}
            onPress={() => {
              if (canRespond) {
                onFriendshipTransition("accepted");
                return;
              }
              if (canAdd) onAddFriend();
            }}
          >
            <UserPlus size={18} color={palette.green} />
            <Text style={styles.outlineButtonText}>
              {canRespond ? "同意好友" : relationLabel(relation)}
            </Text>
          </TouchableOpacity>
          {canRespond && (
            <TouchableOpacity activeOpacity={0.88} style={styles.outlineDangerButton} onPress={() => onFriendshipTransition("rejected")}>
              <Text style={styles.outlineDangerButtonText}>拒绝</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity activeOpacity={0.88} style={styles.primarySmallButton}>
            <Text style={styles.primarySmallButtonText}>查看书架</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tabLine}>
          <Text style={styles.activeTabLabel}>书架</Text>
          <Text style={styles.tabLabel}>评价</Text>
          <Text style={styles.tabLabel}>关于</Text>
        </View>

        <View style={styles.bookGrid}>
          {userBooks.map((book) => (
            <TouchableOpacity key={book.id} style={styles.gridBook} activeOpacity={0.9} onPress={() => onOpenBook(book.id)}>
              <BookCover book={book} size="medium" />
              <Text numberOfLines={1} style={styles.tileTitle}>{book.title}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <ReportButton
          label={`举报 ${user.displayName}`}
          currentUser={currentUser}
          onRequireAuth={onRequireAuth}
          onSubmit={onSubmitReport}
        />
      </ScrollView>
    </View>
  );
}

function ShelfScreen({
  books,
  users,
  currentUser,
  borrowRequests,
  favorites,
  onOpenBook,
  onEditBook,
  onBorrowTransition,
  onRequireAuth
}: {
  books: Book[];
  users: User[];
  currentUser: AuthUser | null;
  borrowRequests: BorrowRequest[];
  favorites: string[];
  onOpenBook: (bookId: string) => void;
  onEditBook: (bookId?: string) => void;
  onBorrowTransition: (request: BorrowRequest, nextStatus: BorrowStatus) => Promise<void>;
  onRequireAuth: (action: () => void) => void;
}) {
  const [activeShelfSection, setActiveShelfSection] = useState<"shared" | "borrowed" | "lending" | "favorites">("shared");
  const isDemoShelf = currentUser?.isDemo || !currentUser;
  const borrowed = borrowRequests.filter((request) => (
    request.borrowerId === currentUser?.id || (isDemoShelf && request.borrowerId === "bob")
  )).map((request) => ({
    request,
    book: books.find((book) => book.id === request.bookId)
  })).filter((item): item is { request: typeof borrowRequests[number]; book: Book } => Boolean(item.book));
  const lending = borrowRequests.filter((request) => (
    request.lenderId === currentUser?.id || (isDemoShelf && request.lenderId === "alice")
  )).map((request) => ({
    request,
    book: books.find((book) => book.id === request.bookId)
  })).filter((item): item is { request: typeof borrowRequests[number]; book: Book } => Boolean(item.book));
  const myBooks = books.filter((book) => (
    book.ownerId === currentUser?.id || book.ownerId === "alice"
  ));
  const favoriteBooks = books.filter((book) => favorites.includes(book.id));
  const activeBorrowed = borrowed.filter(({ request }) => (
    request.status === "accepted"
    || request.status === "borrowed"
    || request.status === "return_requested"
  ));
  const activeLending = lending.filter(({ request }) => !terminalBorrowStatuses.includes(request.status));
  const pendingCount = [...borrowed, ...lending].filter(({ request }) => request.status === "pending").length;
  const returnCount = [...borrowed, ...lending].filter(({ request }) => request.status === "return_requested").length;
  const shelfSections = [
    { key: "shared", label: "我的共享", count: myBooks.length },
    { key: "borrowed", label: "我借入的", count: borrowed.length },
    { key: "lending", label: "我出借的", count: lending.length },
    { key: "favorites", label: "我的收藏", count: favoriteBooks.length }
  ] as const;

  return (
    <View style={styles.screen}>
      <Header title="我的书架" subtitle="管理共享、借阅和收藏" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.statusGrid}>
          <StatusTile label="借阅中" value={String(activeBorrowed.length)} />
          <StatusTile label="待处理" value={String(pendingCount)} />
          <StatusTile label="待归还" value={String(returnCount)} />
        </View>

        <View style={styles.shelfSectionTabs}>
          {shelfSections.map((section) => (
            <TouchableOpacity
              key={section.key}
              activeOpacity={0.84}
              style={[styles.shelfSectionTab, activeShelfSection === section.key && styles.shelfSectionTabActive]}
              onPress={() => setActiveShelfSection(section.key)}
            >
              <Text style={[styles.shelfSectionTabText, activeShelfSection === section.key && styles.shelfSectionTabTextActive]}>
                {section.label}
              </Text>
              <Text style={[styles.shelfSectionCount, activeShelfSection === section.key && styles.shelfSectionCountActive]}>
                {section.count}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeShelfSection === "shared" && (
          <>
            <SectionTitle title="我的共享" action="添加新书" />
            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.addBookButton}
              onPress={() => onRequireAuth(() => onEditBook())}
            >
              <Plus size={18} color={palette.green} />
              <Text style={styles.outlineButtonText}>添加新书</Text>
            </TouchableOpacity>
            {myBooks.length ? (
              myBooks.map((book) => (
                <ShelfSharedBook
                  key={book.id}
                  book={book}
                  users={users}
                  onOpenBook={onOpenBook}
                  onEditBook={onEditBook}
                />
              ))
            ) : (
              <EmptyState title="还没有共享图书" subtitle="添加一本你愿意借给邻居的书，它会出现在附近发现页。" />
            )}
          </>
        )}

        {activeShelfSection === "borrowed" && (
          <>
            <SectionTitle title="我借入的" action="查看全部" />
            {borrowed.length ? (
              borrowed.map(({ book, request }) => (
                <BorrowRequestCard
                  key={request.id}
                  book={book}
                  request={request}
                  role="borrower"
                  onOpenBook={onOpenBook}
                  onTransition={onBorrowTransition}
                />
              ))
            ) : (
              <EmptyState title="还没有借入图书" subtitle="在发现页找到喜欢的书，发送借阅申请后会显示在这里。" />
            )}
          </>
        )}

        {activeShelfSection === "lending" && (
          <>
            <SectionTitle title="我出借的" action="查看全部" />
            {lending.length ? (
              lending.map(({ book, request }) => (
                <BorrowRequestCard
                  key={request.id}
                  book={book}
                  request={request}
                  role="lender"
                  onOpenBook={onOpenBook}
                  onTransition={onBorrowTransition}
                />
              ))
            ) : (
              <EmptyState title="还没有出借记录" subtitle="当邻居申请借你的书时，申请会出现在这里。" />
            )}
          </>
        )}

        {activeShelfSection === "favorites" && (
          <>
            <SectionTitle title="我的收藏" action="查看全部" />
            {favoriteBooks.length === 0 ? (
              <EmptyState title="还没有收藏" subtitle="在书籍详情页点亮收藏后会出现在这里。" />
            ) : (
              favoriteBooks.map((book) => (
                <BookListItem key={book.id} book={book} users={users} onPress={() => onOpenBook(book.id)} />
              ))
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function ShelfSharedBook({
  book,
  users,
  onOpenBook,
  onEditBook
}: {
  book: Book;
  users: User[];
  onOpenBook: (bookId: string) => void;
  onEditBook: (bookId?: string) => void;
}) {
  return (
    <View style={styles.shelfBookWrap}>
      <BookListItem book={book} users={users} onPress={() => onOpenBook(book.id)} />
      <View style={styles.shelfBookActions}>
        <TouchableOpacity activeOpacity={0.85} style={styles.shelfMiniButton} onPress={() => onEditBook(book.id)}>
          <Text style={styles.shelfMiniButtonText}>编辑</Text>
        </TouchableOpacity>
        <View style={[styles.statusBadge, book.status === "available" ? styles.statusBadgeGreen : styles.statusBadgeMuted]}>
          <Text style={book.status === "available" ? styles.statusBadgeGreenText : styles.statusBadgeMutedText}>
            {book.status === "available" ? "已上架" : book.status === "hidden" ? "已下架" : book.status === "borrowed" ? "借阅中" : "处理中"}
          </Text>
        </View>
      </View>
    </View>
  );
}

function MessagesScreen({
  books,
  users,
  notifications,
  borrowRequests,
  onOpenBook
}: {
  books: Book[];
  users: User[];
  notifications: MessageNotification[];
  borrowRequests: BorrowRequest[];
  onOpenBook: (bookId: string) => void;
}) {
  const unreadCount = notifications.filter((notification) => notification.unread).length;

  return (
    <View style={styles.screen}>
      <Header title="消息" subtitle={`${unreadCount} 条未读 · 借阅、好友和系统通知`} />
      <View style={styles.filterRow}>
        <Chip label="全部" active />
        <Chip label="借阅" />
        <Chip label="好友" />
        <Chip label="通知" />
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {notifications.length ? (
          notifications.map((notification) => {
            const user = notification.userId ? getUser(notification.userId, users) : mockUsers[0];
            const book = notification.bookId ? books.find((item) => item.id === notification.bookId) : undefined;
            const request = notification.requestId
              ? borrowRequests.find((item) => item.id === notification.requestId)
              : undefined;

            return (
              <TouchableOpacity
                key={notification.id}
                activeOpacity={0.88}
                style={styles.threadRow}
                onPress={() => notification.bookId && onOpenBook(notification.bookId)}
              >
                {book ? <BookCover book={book} size="tiny" /> : <Avatar user={user} size={48} />}
                <View style={styles.flex}>
                  <View style={styles.threadTitleRow}>
                    <Text style={styles.cardTitle}>{notification.title}</Text>
                    <Text style={styles.mutedText}>{notification.time}</Text>
                  </View>
                  <Text numberOfLines={2} style={styles.bodyText}>{notification.body}</Text>
                  {request && (
                    <View style={styles.messageStatusLine}>
                      <Text style={styles.messageStatusText}>{statusLabel(request.status)}</Text>
                    </View>
                  )}
                </View>
                {notification.unread && <View style={styles.unreadDot} />}
              </TouchableOpacity>
            );
          })
        ) : (
          <EmptyState title="还没有消息" subtitle="借阅申请、好友通知和系统消息会显示在这里。" />
        )}

        <View style={styles.chatPreview}>
          <Text style={styles.sectionHeading}>Alice 的聊天</Text>
          <View style={styles.messageBubbleInbound}>
            <Text style={styles.bodyText}>你想借这三本书吗？</Text>
          </View>
          <View style={styles.bookBundle}>
            {books.slice(0, 3).map((book) => (
              <TouchableOpacity key={book.id} onPress={() => onOpenBook(book.id)} activeOpacity={0.9}>
                <BookCover book={book} size="tiny" />
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.messageBubbleOutbound}>
            <Text style={styles.outboundText}>好的，可以的！我们约个时间吧。</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function BorrowRequestCard({
  book,
  request,
  role,
  onOpenBook,
  onTransition
}: {
  book: Book;
  request: BorrowRequest;
  role: "borrower" | "lender";
  onOpenBook: (bookId: string) => void;
  onTransition: (request: BorrowRequest, nextStatus: BorrowStatus) => Promise<void>;
}) {
  const [busyStatus, setBusyStatus] = useState<BorrowStatus | null>(null);

  const transition = async (nextStatus: BorrowStatus) => {
    setBusyStatus(nextStatus);
    try {
      await onTransition(request, nextStatus);
    } finally {
      setBusyStatus(null);
    }
  };

  const actions = borrowActionsFor(role, request.status);

  return (
    <View style={styles.borrowCard}>
      <TouchableOpacity activeOpacity={0.88} onPress={() => onOpenBook(book.id)}>
        <BookCover book={book} size="small" />
      </TouchableOpacity>
      <View style={styles.flex}>
        <View style={styles.threadTitleRow}>
          <Text style={styles.cardTitle}>{book.title}</Text>
          <View style={[styles.statusBadge, terminalBorrowStatuses.includes(request.status) ? styles.statusBadgeMuted : styles.statusBadgeGreen]}>
            <Text style={terminalBorrowStatuses.includes(request.status) ? styles.statusBadgeMutedText : styles.statusBadgeGreenText}>
              {statusLabel(request.status)}
            </Text>
          </View>
        </View>
        <Text style={styles.mutedText}>{request.dateLabel}</Text>
        <Text style={request.status === "pending" || request.status === "return_requested" ? styles.goldText : styles.greenText}>
          {request.message || statusMessage(request.status)}
        </Text>
        {actions.length > 0 && (
          <View style={styles.borrowActionRow}>
            {actions.map((action) => (
              <TouchableOpacity
                key={action.status}
                activeOpacity={0.85}
                disabled={busyStatus !== null}
                style={[styles.borrowActionButton, action.kind === "danger" && styles.borrowDangerButton]}
                onPress={() => transition(action.status)}
              >
                <Text style={[styles.borrowActionText, action.kind === "danger" && styles.borrowDangerText]}>
                  {busyStatus === action.status ? "处理中" : action.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

function NeighborsScreen({
  currentUser,
  friendships,
  users,
  onOpenLender,
  onAddFriend,
  onFriendshipTransition
}: {
  currentUser: AuthUser | null;
  friendships: Friendship[];
  users: User[];
  onOpenLender: (userId: string) => void;
  onAddFriend: (user: User) => void;
  onFriendshipTransition: (friendship: Friendship, nextStatus: FriendshipStatus) => Promise<void>;
}) {
  const pendingReceived = currentUser
    ? friendships.filter((friendship) => friendship.receiverId === currentUser.id && friendship.status === "pending")
    : [];
  const visibleUsers = users.filter((user) => user.id !== currentUser?.id);

  return (
    <View style={styles.screen}>
      <Header title="邻居" subtitle="附近书友和好友" />
      <View style={styles.filterRow}>
        <Chip label="好友" active />
        <Chip label="附近" />
        <Chip label="可借多" />
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {pendingReceived.length > 0 && (
          <>
            <SectionTitle title="好友申请" />
            {pendingReceived.map((friendship) => {
              const requester = getUser(friendship.requesterId, users);
              return (
                <View key={friendship.id} style={styles.friendRequestCard}>
                  <Avatar user={requester} size={46} />
                  <View style={styles.flex}>
                    <Text style={styles.cardTitle}>{requester.displayName}</Text>
                    <Text style={styles.mutedText}>想加你为好友 · {friendship.dateLabel}</Text>
                  </View>
                  <TouchableOpacity activeOpacity={0.85} style={styles.friendButton} onPress={() => onFriendshipTransition(friendship, "accepted")}>
                    <Text style={styles.friendButtonText}>同意</Text>
                  </TouchableOpacity>
                  <TouchableOpacity activeOpacity={0.85} style={styles.friendRejectButton} onPress={() => onFriendshipTransition(friendship, "rejected")}>
                    <Text style={styles.friendRejectButtonText}>拒绝</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </>
        )}

        {visibleUsers.map((user) => {
          const relation = relationshipFor(currentUser, user, friendships);
          const friendship = currentUser ? findFriendship(currentUser.id, user.id, friendships) : undefined;
          const actionable = relation === "none" || relation === "rejected" || relation === "pending_received";

          return (
            <TouchableOpacity key={user.id} activeOpacity={0.88} style={styles.neighborRow} onPress={() => onOpenLender(user.id)}>
              <Avatar user={user} size={52} />
              <View style={styles.flex}>
                <Text style={styles.cardTitle}>{user.displayName}</Text>
                <Text style={styles.mutedText}>{formatApproxDistance(user.distanceKm)} · 共享 {user.sharedCount} 本书</Text>
                <View style={styles.ratingInline}>
                  <Star size={14} color={palette.gold} fill={palette.gold} />
                  <Text style={styles.ratingText}>{user.rating}</Text>
                </View>
              </View>
              <TouchableOpacity
                activeOpacity={0.85}
                disabled={!actionable}
                style={[styles.friendButton, !actionable && styles.friendButtonDone]}
                onPress={() => {
                  if (relation === "pending_received" && friendship) {
                    void onFriendshipTransition(friendship, "accepted");
                    return;
                  }
                  onAddFriend(user);
                }}
              >
                <Text style={[styles.friendButtonText, !actionable && styles.friendButtonTextDone]}>
                  {relation === "pending_received" ? "同意" : relationLabel(relation)}
                </Text>
              </TouchableOpacity>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

function MeScreen({
  user,
  loading,
  catalogSource,
  onSignIn,
  onSignUp,
  onSignOut
}: {
  user: AuthUser | null;
  loading: boolean;
  catalogSource: "supabase" | "mock";
  onSignIn: () => void;
  onSignUp: () => void;
  onSignOut: () => void;
}) {
  const [privacyLevel, setPrivacyLevel] = useState<"public" | "friends" | "private">("public");
  const [visibleRadius, setVisibleRadius] = useState(3);

  if (!user) {
    return (
      <AuthRequiredPanel
        title={loading ? "正在检查登录状态" : "登录 LinkNest"}
        subtitle="登录后可以管理资料、隐私、借阅历史和你的共享书架。"
        loading={loading}
        onSignIn={onSignIn}
        onSignUp={onSignUp}
      />
    );
  }

  const me = {
    id: user.id,
    displayName: user.displayName,
    avatar: user.displayName.slice(0, 1).toUpperCase(),
    distanceKm: 0,
    sharedCount: 16,
    rating: 4.8,
    bio: "",
    neighborhood: "我的地址"
  };

  return (
    <View style={styles.screen}>
      <Header title="我的" subtitle="账户、隐私和设置" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.meHeader}>
          <Avatar user={me} size={68} />
          <View style={styles.flex}>
            <Text style={styles.detailTitle}>{user.displayName}</Text>
            <Text style={styles.mutedText}>{user.email}{user.isDemo ? " · 演示登录" : ""}</Text>
          </View>
        </View>

        <View style={styles.statusGrid}>
          <StatusTile label="共享" value="16" />
          <StatusTile label="借出" value="8" />
          <StatusTile label="评价" value="24" />
        </View>

        <SettingsRow icon={MapPin} label="我的地址" value={`${visibleRadius}km 范围`} />
        <SettingsRow icon={Shield} label="隐私设置" value={privacyLevelLabel(privacyLevel)} />
        <SettingsRow icon={Clock3} label="借阅历史" value="24 条" />
        <SettingsRow icon={Bell} label="通知设置" value="已开启" />
        <SettingsRow icon={Settings} label="关于 LinkNest" value="v1.0.0" />

        <BackendStatusPanel user={user} catalogSource={catalogSource} />

        <View style={styles.privacyPanel}>
          <Text style={styles.sectionHeading}>隐私与安全</Text>
          <Text style={styles.bodyText}>你的精确地址不会公开。附近发现页只使用模糊距离，交接信息只建议在借阅确认后沟通。</Text>

          <Text style={styles.inputLabel}>资料可见性</Text>
          <View style={styles.optionRow}>
            {(["public", "friends", "private"] as const).map((level) => (
              <TouchableOpacity
                key={level}
                activeOpacity={0.84}
                style={[styles.optionChip, privacyLevel === level && styles.optionChipActive]}
                onPress={() => setPrivacyLevel(level)}
              >
                <Text style={[styles.optionChipText, privacyLevel === level && styles.optionChipTextActive]}>
                  {privacyLevelLabel(level)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.inputLabel}>可见范围</Text>
          <View style={styles.optionRow}>
            {[1, 3, 5, 10].map((radius) => (
              <TouchableOpacity
                key={radius}
                activeOpacity={0.84}
                style={[styles.optionChip, visibleRadius === radius && styles.optionChipActive]}
                onPress={() => setVisibleRadius(radius)}
              >
                <Text style={[styles.optionChipText, visibleRadius === radius && styles.optionChipTextActive]}>
                  {radius}km
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity activeOpacity={0.88} style={styles.logoutButton} onPress={onSignOut}>
          <Text style={styles.logoutText}>退出登录</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function AuthScreen({
  initialMode,
  message,
  onBack,
  onSuccess
}: {
  initialMode: AuthMode;
  message?: string;
  onBack: () => void;
  onSuccess: (user: AuthUser) => void;
}) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("demo@linknest.local");
  const [password, setPassword] = useState("linknest-demo");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isSignUp = mode === "signUp";

  const submit = async () => {
    setError("");
    if (!email.trim()) {
      setError("请输入邮箱。");
      return;
    }
    if (password.length < 6) {
      setError("密码至少需要 6 位。");
      return;
    }
    if (isSignUp && !displayName.trim()) {
      setError("请输入昵称。");
      return;
    }

    setSubmitting(true);
    try {
      const user = isSignUp
        ? await signUpWithEmail({ email, password, displayName })
        : await signInWithEmail({ email, password });
      onSuccess(user);
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "认证失败，请稍后再试。");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.screen}>
      <TopBar title={isSignUp ? "创建账号" : "登录"} onBack={onBack} />
      <ScrollView contentContainerStyle={styles.authContent} showsVerticalScrollIndicator={false}>
        <View style={styles.authHero}>
          <View style={styles.authIcon}>
            <BookOpen size={34} color={palette.green} />
          </View>
          <Text style={styles.authTitle}>{isSignUp ? "加入 LinkNest" : "欢迎回来"}</Text>
          <Text style={styles.authSubtitle}>
            {message ?? "登录后可以借书、收藏、发布书籍并和附近书友沟通。"}
          </Text>
        </View>

        {!isSupabaseConfigured && (
          <View style={styles.demoNotice}>
            <Shield size={18} color={palette.blue} />
            <Text style={styles.demoNoticeText}>当前未配置 Supabase，提交后会进入本地演示登录。</Text>
          </View>
        )}

        <View style={styles.authForm}>
          {isSignUp && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>昵称</Text>
              <TextInput
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="例如 Emma"
                placeholderTextColor="#9EA69D"
                style={styles.formInput}
              />
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>邮箱</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="you@example.com"
              placeholderTextColor="#9EA69D"
              style={styles.formInput}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>密码</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="至少 6 位"
              placeholderTextColor="#9EA69D"
              style={styles.formInput}
            />
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            activeOpacity={0.9}
            disabled={submitting}
            style={[styles.primaryActionFull, submitting && styles.disabledAction]}
            onPress={submit}
          >
            <Text style={styles.primaryActionText}>
              {submitting ? "处理中..." : isSignUp ? "注册并继续" : "登录并继续"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.authSwitchButton}
            onPress={() => {
              setError("");
              setMode(isSignUp ? "signIn" : "signUp");
            }}
          >
            <Text style={styles.authSwitchText}>
              {isSignUp ? "已有账号？去登录" : "还没有账号？创建一个"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

function AuthRequiredPanel({
  title,
  subtitle,
  loading,
  onSignIn,
  onSignUp
}: {
  title: string;
  subtitle: string;
  loading?: boolean;
  onSignIn: () => void;
  onSignUp: () => void;
}) {
  return (
    <View style={styles.screen}>
      <Header title={title} subtitle={subtitle} />
      <View style={styles.authRequiredBody}>
        {loading ? (
          <LoadingState title="检查会话中" subtitle="正在确认你的登录状态。" compact />
        ) : (
          <>
            <View style={styles.successIllustration}>
              <View style={styles.authIconLarge}>
                <UserRound size={48} color={palette.green} />
              </View>
            </View>
            <Text style={styles.authRequiredTitle}>需要登录</Text>
          </>
        )}
        <Text style={styles.successSubtitle}>游客可以继续浏览附近图书，登录后才能进行借阅、收藏、聊天和发布。</Text>
        <TouchableOpacity activeOpacity={0.9} style={styles.primaryActionFull} onPress={onSignIn}>
          <Text style={styles.primaryActionText}>登录</Text>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.85} style={styles.authSwitchButton} onPress={onSignUp}>
          <Text style={styles.authSwitchText}>创建账号</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function BookFormScreen({
  book,
  user,
  onBack,
  onSave
}: {
  book?: Book;
  user: AuthUser;
  onBack: () => void;
  onSave: (draft: BookDraft, book?: Book) => Promise<void>;
}) {
  const [draft, setDraft] = useState<BookDraft>(() => draftFromBook(book));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const editing = Boolean(book);

  const updateDraft = (patch: Partial<BookDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
  };

  const submit = async () => {
    setError("");
    if (!draft.title.trim()) {
      setError("请输入书名。");
      return;
    }
    if (!draft.author.trim()) {
      setError("请输入作者。");
      return;
    }
    if (draft.publishYear && !/^\d{4}$/.test(draft.publishYear.trim())) {
      setError("出版年份请填写 4 位数字。");
      return;
    }

    setSaving(true);
    try {
      await onSave(draft, book);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "保存失败，请稍后再试。");
    } finally {
      setSaving(false);
    }
  };

  const previewBook: Book = book ?? {
    id: "preview",
    ownerId: user.id,
    title: draft.title || "新书",
    author: draft.author || "作者",
    category: draft.category || "文学",
    language: draft.language || "中文",
    condition: "良好",
    status: draft.status,
    distanceKm: 0,
    description: draft.description,
    coverColor: "#315C49",
    accentColor: "#F1D28A",
    year: draft.publishYear || "未知"
  };

  const conditionOptions: Array<{ value: BookDraft["condition"]; label: string }> = [
    { value: "new", label: "全新" },
    { value: "like_new", label: "较新" },
    { value: "good", label: "良好" },
    { value: "fair", label: "有痕迹" }
  ];

  return (
    <View style={styles.screen}>
      <TopBar title={editing ? "编辑图书" : "添加新书"} onBack={onBack} />
      <ScrollView contentContainerStyle={styles.detailContent} showsVerticalScrollIndicator={false}>
        <View style={styles.formPreviewRow}>
          <BookCover book={{ ...previewBook, title: draft.title || "新书" }} size="large" />
          <View style={styles.formQuickActions}>
            <TouchableOpacity activeOpacity={0.86} style={styles.formToolButton}>
              <ScanLine size={19} color={palette.green} />
              <Text style={styles.formToolText}>扫描 ISBN</Text>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.86} style={styles.formToolButton}>
              <Camera size={19} color={palette.green} />
              <Text style={styles.formToolText}>拍摄封面</Text>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.86} style={styles.formToolButton}>
              <BookOpen size={19} color={palette.green} />
              <Text style={styles.formToolText}>手动输入</Text>
            </TouchableOpacity>
          </View>
        </View>

        {!isSupabaseConfigured || user.isDemo ? (
          <View style={styles.demoNotice}>
            <Shield size={18} color={palette.blue} />
            <Text style={styles.demoNoticeText}>当前会保存为本地演示图书；配置 Supabase 后会写入 books 表。</Text>
          </View>
        ) : null}

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>书名</Text>
          <TextInput
            value={draft.title}
            onChangeText={(title) => updateDraft({ title })}
            placeholder="例如 小王子"
            placeholderTextColor="#9EA69D"
            style={styles.formInput}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>作者</Text>
          <TextInput
            value={draft.author}
            onChangeText={(author) => updateDraft({ author })}
            placeholder="例如 安托万·德·圣埃克苏佩里"
            placeholderTextColor="#9EA69D"
            style={styles.formInput}
          />
        </View>

        <View style={styles.formTwoColumn}>
          <View style={styles.formColumn}>
            <Text style={styles.inputLabel}>分类</Text>
            <TextInput
              value={draft.category}
              onChangeText={(category) => updateDraft({ category })}
              placeholder="文学"
              placeholderTextColor="#9EA69D"
              style={styles.formInput}
            />
          </View>
          <View style={styles.formColumn}>
            <Text style={styles.inputLabel}>语言</Text>
            <TextInput
              value={draft.language}
              onChangeText={(language) => updateDraft({ language })}
              placeholder="中文"
              placeholderTextColor="#9EA69D"
              style={styles.formInput}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>新旧状态</Text>
          <View style={styles.optionRow}>
            {conditionOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                activeOpacity={0.84}
                style={[styles.optionChip, draft.condition === option.value && styles.optionChipActive]}
                onPress={() => updateDraft({ condition: option.value })}
              >
                <Text style={[styles.optionChipText, draft.condition === option.value && styles.optionChipTextActive]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.formTwoColumn}>
          <View style={styles.formColumn}>
            <Text style={styles.inputLabel}>出版年份</Text>
            <TextInput
              value={draft.publishYear}
              onChangeText={(publishYear) => updateDraft({ publishYear })}
              keyboardType="number-pad"
              placeholder="2015"
              placeholderTextColor="#9EA69D"
              style={styles.formInput}
            />
          </View>
          <View style={styles.formColumn}>
            <Text style={styles.inputLabel}>发布状态</Text>
            <TouchableOpacity
              activeOpacity={0.86}
              style={styles.formInputButton}
              onPress={() => updateDraft({ status: draft.status === "available" ? "hidden" : "available" })}
            >
              <Text style={styles.formInputButtonText}>{draft.status === "available" ? "上架共享" : "暂不公开"}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>简介 / 借阅说明</Text>
          <TextInput
            multiline
            value={draft.description}
            onChangeText={(description) => updateDraft({ description })}
            style={styles.noteInput}
            placeholder="描述书况、方便交接的时间、是否介意折页等"
            placeholderTextColor="#9EA69D"
          />
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </ScrollView>
      <View style={styles.actionBar}>
        <TouchableOpacity
          activeOpacity={0.9}
          disabled={saving}
          style={[styles.primaryAction, saving && styles.disabledAction]}
          onPress={submit}
        >
          <Text style={styles.primaryActionText}>{saving ? "保存中..." : editing ? "保存修改" : "发布到书架"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function BottomTabs({
  activeTab,
  unreadMessages,
  onChange
}: {
  activeTab: TabKey;
  unreadMessages: number;
  onChange: (tab: TabKey) => void;
}) {
  return (
    <View style={styles.bottomTabs}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = activeTab === tab.key;
        return (
          <TouchableOpacity key={tab.key} activeOpacity={0.85} style={styles.tabButton} onPress={() => onChange(tab.key)}>
            <View>
              <Icon size={22} color={active ? palette.green : "#8A9388"} strokeWidth={active ? 2.6 : 2} />
              {tab.key === "messages" && unreadMessages > 0 && <View style={styles.tabUnreadDot} />}
            </View>
            <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function Header({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.headerTitle}>{title}</Text>
        {subtitle && <Text style={styles.headerSubtitle}>{subtitle}</Text>}
      </View>
      {right}
    </View>
  );
}

function TopBar({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.topBar}>
      <TouchableOpacity activeOpacity={0.82} style={styles.backButton} onPress={onBack}>
        <ChevronLeft size={24} color={palette.ink} />
      </TouchableOpacity>
      <Text style={styles.topBarTitle}>{title}</Text>
      <View style={styles.backButton} />
    </View>
  );
}

function SegmentedIconControl({
  value,
  options,
  onChange
}: {
  value: string;
  options: Array<{ value: string; icon: LucideIcon; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((option) => {
        const Icon = option.icon;
        const active = option.value === value;
        return (
          <TouchableOpacity
            key={option.value}
            accessibilityLabel={option.label}
            activeOpacity={0.82}
            style={[styles.segmentButton, active && styles.segmentButtonActive]}
            onPress={() => onChange(option.value)}
          >
            <Icon size={18} color={active ? palette.green : palette.muted} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function IconButton({ icon: Icon, label, onPress }: { icon: LucideIcon; label: string; onPress?: () => void }) {
  return (
    <TouchableOpacity accessibilityLabel={label} activeOpacity={0.82} style={styles.iconButton} onPress={onPress}>
      <Icon size={20} color={palette.green} />
    </TouchableOpacity>
  );
}

function Chip({ label, active = false, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  return (
    <TouchableOpacity activeOpacity={0.82} style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function SectionTitle({ title, action }: { title: string; action?: string }) {
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={styles.sectionHeading}>{title}</Text>
      {action && <Text style={styles.sectionAction}>{action}</Text>}
    </View>
  );
}

function BookListItem({
  book,
  users,
  isFavorite,
  compact,
  onPress,
  onToggleFavorite
}: {
  book: Book;
  users?: User[];
  isFavorite?: boolean;
  compact?: boolean;
  onPress: () => void;
  onToggleFavorite?: () => void;
}) {
  const owner = getUser(book.ownerId, users);
  const statusLabelText = book.status === "available"
    ? owner.isFriend ? "仅好友" : "公开"
    : "借阅中";
  const statusTone = book.status === "available"
    ? owner.isFriend ? "friend" : "public"
    : "club";

  return (
    <TouchableOpacity activeOpacity={0.9} style={[styles.bookListItem, compact && styles.bookListItemCompact]} onPress={onPress}>
      <BookCover book={book} size={compact ? "small" : "medium"} />
      <View style={styles.bookCardContent}>
        <View style={styles.bookCardHeader}>
          <View style={styles.flex}>
            <Text numberOfLines={1} style={styles.bookItemTitle}>{book.title}</Text>
            <Text numberOfLines={1} style={styles.bookAuthorText}>{book.author}</Text>
          </View>
          {!compact && (
            <View style={[
              styles.visibilityBadge,
              statusTone === "friend" && styles.visibilityBadgeFriend,
              statusTone === "club" && styles.visibilityBadgeClub
            ]}>
              <Text style={[
                styles.visibilityBadgeText,
                statusTone === "friend" && styles.visibilityBadgeTextFriend,
                statusTone === "club" && styles.visibilityBadgeTextClub
              ]}>{statusLabelText}</Text>
            </View>
          )}
        </View>

        <View style={styles.bookMetaRow}>
          <Text style={styles.bookMetaChip}>{book.category}</Text>
          <Text style={styles.bookMetaDot}>·</Text>
          <Text style={styles.bookMetaText}>{book.condition}</Text>
        </View>

        <View style={styles.bookCardFooter}>
          <View style={styles.distanceInline}>
            <Text style={styles.pinEmoji}>📍</Text>
            <Text style={styles.distanceText}>{formatCardDistance(book.distanceKm)}</Text>
          </View>
          <View style={styles.cardDivider} />
          <View style={styles.ownerInline}>
            <Avatar user={owner} size={28} />
            <Text numberOfLines={1} style={styles.ownerNameText}>{owner.displayName}</Text>
            <View style={styles.ownerRatingInline}>
              <Star size={14} color={palette.gold} />
              <Text style={styles.ownerRatingText}>{owner.rating.toFixed(1)}</Text>
            </View>
          </View>
        </View>
      </View>
      {compact && onToggleFavorite ? (
        <TouchableOpacity accessibilityLabel="收藏" activeOpacity={0.82} style={styles.listIconButton} onPress={onToggleFavorite}>
          <Heart size={18} color={isFavorite ? palette.red : palette.muted} fill={isFavorite ? palette.red : "transparent"} />
        </TouchableOpacity>
      ) : null}
    </TouchableOpacity>
  );
}

function BookCover({ book, size }: { book: Book; size: "tiny" | "small" | "medium" | "large" }) {
  const dimensions = {
    tiny: styles.coverTiny,
    small: styles.coverSmall,
    medium: styles.coverMedium,
    large: styles.coverLarge
  }[size];

  return (
    <View style={[styles.cover, dimensions, { backgroundColor: book.coverColor }]}>
      <View style={[styles.coverMark, { backgroundColor: book.accentColor }]} />
      <Text numberOfLines={2} adjustsFontSizeToFit style={[styles.coverTitle, size === "large" && styles.coverTitleLarge]}>
        {book.title}
      </Text>
      <BookOpen size={size === "tiny" ? 14 : size === "large" ? 38 : 22} color={book.accentColor} />
    </View>
  );
}

function Avatar({ user, size }: { user: User; size: number }) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarText, { fontSize: Math.max(14, size * 0.38) }]}>{user.avatar}</Text>
    </View>
  );
}

function MetaPill({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <View style={styles.metaPill}>
      <Icon size={15} color={palette.green} />
      <Text style={styles.metaPillText}>{label}</Text>
    </View>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoLine}>
      <Text style={styles.mutedText}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function StatusTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statusTile}>
      <Text style={styles.statusValue}>{value}</Text>
      <Text style={styles.mutedText}>{label}</Text>
    </View>
  );
}

function SettingsRow({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <TouchableOpacity activeOpacity={0.86} style={styles.settingsRow}>
      <View style={styles.settingsIcon}>
        <Icon size={18} color={palette.green} />
      </View>
      <Text style={styles.settingsLabel}>{label}</Text>
      <Text style={styles.mutedText}>{value}</Text>
    </TouchableOpacity>
  );
}

function SuccessScreen({
  title,
  subtitle,
  actionLabel,
  onAction
}: {
  title: string;
  subtitle: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <View style={[styles.screen, styles.successScreen]}>
      <View style={styles.successIllustration}>
        <View style={styles.successCircle}>
          <Check size={54} color="#FFFFFF" />
        </View>
      </View>
      <Text style={styles.detailTitle}>{title}</Text>
      <Text style={styles.successSubtitle}>{subtitle}</Text>
      <TouchableOpacity activeOpacity={0.9} style={styles.primaryActionFull} onPress={onAction}>
        <Text style={styles.primaryActionText}>{actionLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.emptyState}>
      <Grid2X2 size={26} color={palette.green} />
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.mutedText}>{subtitle}</Text>
    </View>
  );
}

function LoadingState({ title, subtitle, compact = false }: { title: string; subtitle: string; compact?: boolean }) {
  return (
    <View style={[styles.loadingState, compact && styles.loadingStateCompact]}>
      <View style={styles.loadingIcon}>
        <BookOpen size={24} color={palette.green} />
      </View>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.mutedText}>{subtitle}</Text>
    </View>
  );
}

function StatusBanner({
  text,
  tone,
  actionLabel,
  onAction
}: {
  text: string;
  tone: "success" | "warning";
  actionLabel?: string;
  onAction?: () => void;
}) {
  const warning = tone === "warning";
  return (
    <View style={[styles.statusBanner, warning && styles.statusBannerWarning]}>
      <Text style={[styles.statusBannerText, warning && styles.statusBannerWarningText]}>{text}</Text>
      {actionLabel && onAction && (
        <TouchableOpacity activeOpacity={0.84} style={styles.statusBannerAction} onPress={onAction}>
          <Text style={styles.statusBannerActionText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function NotFoundScreen({
  title,
  subtitle,
  actionLabel,
  onAction
}: {
  title: string;
  subtitle: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <View style={[styles.screen, styles.successScreen]}>
      <EmptyState title={title} subtitle={subtitle} />
      <TouchableOpacity activeOpacity={0.9} style={[styles.primaryActionFull, styles.notFoundAction]} onPress={onAction}>
        <Text style={styles.primaryActionText}>{actionLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

function BackendStatusPanel({
  user,
  catalogSource
}: {
  user: AuthUser;
  catalogSource: "supabase" | "mock";
}) {
  const connected = isSupabaseConfigured && !user.isDemo && catalogSource === "supabase";
  const rows = [
    {
      label: "Supabase 配置",
      value: isSupabaseConfigured ? "已读取环境变量" : "未配置，使用本地演示"
    },
    {
      label: "当前会话",
      value: user.isDemo ? "演示用户" : "真实登录"
    },
    {
      label: "图书数据源",
      value: catalogSource === "supabase" ? "Supabase" : "本地示例"
    },
    {
      label: "举报写入",
      value: connected ? "写入 reports 表" : "写入本地演示记录"
    }
  ];

  return (
    <View style={styles.backendPanel}>
      <View style={styles.backendPanelHeader}>
        <Shield size={18} color={connected ? palette.green : palette.blue} />
        <Text style={styles.sectionHeading}>后端联调状态</Text>
      </View>
      {rows.map((row) => (
        <View key={row.label} style={styles.backendStatusRow}>
          <Text style={styles.mutedText}>{row.label}</Text>
          <Text style={styles.backendStatusValue}>{row.value}</Text>
        </View>
      ))}
    </View>
  );
}

function ReportButton({
  label,
  currentUser,
  onRequireAuth,
  onSubmit
}: {
  label: string;
  currentUser: AuthUser | null;
  onRequireAuth: () => void;
  onSubmit: () => Promise<void>;
}) {
  const [reported, setReported] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handlePress = async () => {
    setError("");
    if (!currentUser) {
      onRequireAuth();
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit();
      setReported(true);
    } catch (reportError) {
      setError(reportError instanceof Error ? reportError.message : "举报提交失败，请稍后再试。");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View>
      <TouchableOpacity
        activeOpacity={0.86}
        disabled={submitting || reported}
        style={[styles.reportButton, reported && styles.reportButtonDone]}
        onPress={handlePress}
      >
        <Shield size={17} color={reported ? palette.green : palette.red} />
        <Text style={[styles.reportButtonText, reported && styles.reportButtonDoneText]}>
          {reported ? "已收到举报，我们会尽快审核" : submitting ? "正在提交举报..." : label}
        </Text>
      </TouchableOpacity>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const terminalBorrowStatuses: BorrowStatus[] = ["returned", "rejected", "canceled"];

function borrowActionsFor(role: "borrower" | "lender", status: BorrowStatus) {
  if (role === "borrower") {
    if (status === "pending") return [{ label: "取消申请", status: "canceled" as BorrowStatus, kind: "danger" as const }];
    if (status === "accepted") return [{ label: "确认已拿到", status: "borrowed" as BorrowStatus, kind: "primary" as const }];
    if (status === "borrowed") return [{ label: "申请归还", status: "return_requested" as BorrowStatus, kind: "primary" as const }];
    return [];
  }

  if (status === "pending") {
    return [
      { label: "同意", status: "accepted" as BorrowStatus, kind: "primary" as const },
      { label: "拒绝", status: "rejected" as BorrowStatus, kind: "danger" as const }
    ];
  }
  if (status === "return_requested") {
    return [{ label: "确认已归还", status: "returned" as BorrowStatus, kind: "primary" as const }];
  }
  return [];
}

function getUser(userId: string, directory: User[] = mockUsers): User {
  return directory.find((user) => user.id === userId) ?? mockUsers[0];
}

function ensureUserInDirectory(directory: User[], user: AuthUser): User[] {
  if (directory.some((item) => item.id === user.id)) return directory;
  return [
    {
      id: user.id,
      displayName: user.displayName,
      avatar: user.displayName.slice(0, 1).toUpperCase(),
      distanceKm: 0,
      sharedCount: 0,
      rating: 4.8,
      bio: user.isDemo ? "本地演示账号" : "LinkNest 书友",
      neighborhood: "我的地址"
    },
    ...directory
  ];
}

function updateBookStatus(books: Book[], bookId: string, status: Book["status"]): Book[] {
  return books.map((book) => book.id === bookId ? { ...book, status } : book);
}

function formatApproxDistance(distanceKm: number): string {
  if (distanceKm <= 0.2) return "约 200m 内";
  if (distanceKm < 1) return `约 ${Math.max(300, Math.round(distanceKm * 10) * 100)}m`;
  return `约 ${Math.round(distanceKm * 2) / 2}km`;
}

function formatCardDistance(distanceKm: number): string {
  return `${Math.max(0.1, Math.round(distanceKm * 10) / 10).toFixed(1)} km`;
}

function privacyLevelLabel(level: "public" | "friends" | "private"): string {
  if (level === "friends") return "仅好友";
  if (level === "private") return "仅自己";
  return "公开";
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.background
  },
  appFrame: {
    flex: 1,
    alignSelf: "center",
    width: "100%",
    height: "100%",
    minHeight: 0,
    maxWidth: 430,
    backgroundColor: palette.background,
    position: "relative"
  },
  appFrameWide: {
    marginVertical: 28,
    borderRadius: 44,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(210,228,222,0.82)",
    shadowColor: "#8AA89E",
    shadowOpacity: 0.24,
    shadowRadius: 34,
    shadowOffset: { width: 0, height: 18 },
    elevation: 8
  },
  content: {
    flex: 1,
    minHeight: 0,
    paddingBottom: 82
  },
  screen: {
    flex: 1,
    minHeight: 0,
    backgroundColor: palette.background
  },
  header: {
    minHeight: 86,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  headerTitle: {
    fontSize: 27,
    lineHeight: 33,
    fontWeight: "800",
    color: palette.ink,
    letterSpacing: 0
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: palette.muted
  },
  topBar: {
    height: 62,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: palette.faint,
    backgroundColor: palette.panel
  },
  topBarTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: palette.ink
  },
  backButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center"
  },
  bottomTabs: {
    position: Platform.OS === "web" ? "fixed" as never : "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 82,
    paddingHorizontal: 18,
    paddingTop: 10,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.96)",
    borderTopWidth: 1,
    borderTopColor: palette.faint
  },
  tabButton: {
    width: 58,
    height: 62,
    alignItems: "center",
    justifyContent: "center",
    gap: 6
  },
  tabText: {
    fontSize: 13,
    color: "#A6B9B3",
    fontWeight: "800"
  },
  tabTextActive: {
    color: palette.green
  },
  tabUnreadDot: {
    position: "absolute",
    top: -3,
    right: -5,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: palette.red,
    borderWidth: 1,
    borderColor: "#FFFFFF"
  },
  segmented: {
    flexDirection: "row",
    padding: 5,
    borderRadius: 28,
    backgroundColor: "#EDF4F1",
    gap: 4
  },
  segmentButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center"
  },
  segmentButtonActive: {
    backgroundColor: palette.panel,
    shadowColor: "#A0B8B1",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  discoverHeader: {
    minHeight: 150,
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 14
  },
  discoverTitleBlock: {
    flex: 1
  },
  discoverHeaderTitle: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: "900",
    color: palette.greenDark,
    letterSpacing: 0
  },
  discoverTitleAccent: {
    color: palette.green,
    fontWeight: "800"
  },
  discoverHeaderRight: {
    paddingBottom: 2
  },
  locationPill: {
    alignSelf: "flex-start",
    minHeight: 38,
    marginTop: 8,
    paddingLeft: 14,
    paddingRight: 12,
    borderRadius: 19,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    backgroundColor: palette.greenSoft
  },
  locationPulse: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: palette.red,
    borderWidth: 3,
    borderColor: "#69B39D"
  },
  locationPillText: {
    fontSize: 14,
    fontWeight: "900",
    color: palette.green
  },
  locationPillDivider: {
    width: 1,
    height: 18,
    backgroundColor: "#B8D8CF"
  },
  locationPillChevron: {
    marginTop: -2,
    fontSize: 16,
    fontWeight: "900",
    color: palette.green
  },
  searchRow: {
    paddingHorizontal: 22,
    flexDirection: "row",
    gap: 10,
    alignItems: "center"
  },
  searchBox: {
    flex: 1,
    height: 64,
    paddingHorizontal: 22,
    borderRadius: 32,
    backgroundColor: palette.panel,
    borderWidth: 1,
    borderColor: palette.faint,
    flexDirection: "row",
    alignItems: "center",
    gap: 9
  },
  searchInput: {
    flex: 1,
    fontSize: 17,
    fontWeight: "800",
    color: palette.ink,
  },
  iconButton: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.panel,
    borderWidth: 1,
    borderColor: palette.faint
  },
  filterRow: {
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 18,
    flexDirection: "row",
    gap: 11,
    flexWrap: "wrap"
  },
  radiusRowHidden: {
    display: "none"
  },
  filterRowTight: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap"
  },
  dataStatusBar: {
    marginHorizontal: 20,
    marginBottom: 12,
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 14,
    justifyContent: "center",
    backgroundColor: palette.greenSoft,
    borderWidth: 1,
    borderColor: "#D8E8D5"
  },
  dataStatusText: {
    fontSize: 13,
    fontWeight: "800",
    color: palette.green
  },
  statusBanner: {
    marginHorizontal: 20,
    marginBottom: 12,
    minHeight: 38,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: palette.greenSoft,
    borderWidth: 1,
    borderColor: "#D8E8D5"
  },
  statusBannerWarning: {
    backgroundColor: "#FFF7E8",
    borderColor: "#F0D8A8"
  },
  statusBannerText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
    color: palette.green
  },
  statusBannerWarningText: {
    color: "#8A6518"
  },
  statusBannerAction: {
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.panel
  },
  statusBannerActionText: {
    fontSize: 12,
    fontWeight: "900",
    color: palette.green
  },
  privacyNotice: {
    marginTop: 16,
    padding: 12,
    borderRadius: 16,
    flexDirection: "row",
    gap: 9,
    backgroundColor: palette.greenSoft,
    borderWidth: 1,
    borderColor: "#D8E8D5"
  },
  privacyNoticeText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: palette.greenDark,
    fontWeight: "700"
  },
  locationHint: {
    marginHorizontal: 20,
    marginBottom: 12,
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  locationHintCompact: {
    display: "none"
  },
  locationHintText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: palette.muted,
    fontWeight: "700"
  },
  chip: {
    height: 44,
    paddingHorizontal: 21,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.panel,
    borderWidth: 1,
    borderColor: palette.faint
  },
  chipActive: {
    backgroundColor: palette.greenDark,
    borderColor: palette.greenDark
  },
  chipText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#6E837D"
  },
  chipTextActive: {
    color: "#FFFFFF"
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingBottom: 26
  },
  mapPanel: {
    height: 360,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: "#E8EFE4",
    borderWidth: 1,
    borderColor: "#DDE6DA"
  },
  mapGrid: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "#E8EFE4"
  },
  mapStreet: {
    position: "absolute",
    height: 24,
    width: "120%",
    backgroundColor: "#F7FAF4",
    opacity: 0.8,
    transform: [{ rotate: "-18deg" }]
  },
  mapStreetOne: {
    top: 70,
    left: -30
  },
  mapStreetTwo: {
    top: 170,
    left: -40
  },
  mapStreetThree: {
    top: 270,
    left: -30
  },
  currentLocation: {
    position: "absolute",
    top: "42%",
    left: "48%",
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#2F9CE5",
    borderWidth: 4,
    borderColor: "#FFFFFF"
  },
  mapPin: {
    position: "absolute",
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.green,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.8)"
  },
  mapPinText: {
    color: "#FFFFFF",
    fontWeight: "900"
  },
  floatingBook: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 18,
    minHeight: 92,
    padding: 12,
    borderRadius: 20,
    backgroundColor: palette.panel,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#1A2A18",
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4
  },
  horizontalBooks: {
    gap: 13,
    paddingRight: 20
  },
  bookTile: {
    width: 92
  },
  tileTitle: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: "800",
    color: palette.ink
  },
  bookListItem: {
    minHeight: 150,
    marginBottom: 16,
    padding: 13,
    borderRadius: 22,
    backgroundColor: palette.panel,
    borderWidth: 1,
    borderColor: palette.faint,
    flexDirection: "row",
    alignItems: "stretch",
    gap: 13
  },
  bookListItemCompact: {
    minHeight: 96,
    marginBottom: 0,
    alignItems: "center",
    gap: 12
  },
  listIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F4F7F2"
  },
  cover: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 9,
    paddingHorizontal: 7,
    borderRadius: 8,
    overflow: "hidden"
  },
  coverTiny: {
    width: 44,
    height: 60
  },
  coverSmall: {
    width: 58,
    height: 78
  },
  coverMedium: {
    width: 92,
    height: 130,
    borderRadius: 7
  },
  coverLarge: {
    width: 164,
    height: 220,
    paddingVertical: 18,
    borderRadius: 12
  },
  coverMark: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 18,
    height: 28,
    opacity: 0.9,
    borderBottomLeftRadius: 8
  },
  coverTitle: {
    fontSize: 12,
    lineHeight: 16,
    color: "#FFFFFF",
    fontWeight: "900",
    textAlign: "center"
  },
  coverTitleLarge: {
    fontSize: 24,
    lineHeight: 31
  },
  avatar: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#94B7C2",
    borderWidth: 2,
    borderColor: "#FFFFFF"
  },
  avatarText: {
    color: "#FFFFFF",
    fontWeight: "900"
  },
  flex: {
    flex: 1
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: palette.ink
  },
  bookCardContent: {
    flex: 1,
    justifyContent: "space-between",
    minWidth: 0
  },
  bookCardHeader: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10
  },
  bookItemTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "900",
    color: palette.ink
  },
  bookAuthorText: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
    color: palette.muted
  },
  bookMetaRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 7
  },
  bookMetaChip: {
    paddingHorizontal: 11,
    height: 27,
    lineHeight: 27,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#EFF5F2",
    fontSize: 13,
    fontWeight: "900",
    color: "#7D948E"
  },
  bookMetaDot: {
    fontSize: 18,
    color: "#B7C8C3",
    fontWeight: "900"
  },
  bookMetaText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#6F8981"
  },
  bookCardFooter: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 9
  },
  distanceInline: {
    minWidth: 70,
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  pinEmoji: {
    fontSize: 19,
    lineHeight: 22
  },
  distanceText: {
    fontSize: 14,
    fontWeight: "900",
    color: palette.green
  },
  cardDivider: {
    width: 1,
    height: 24,
    backgroundColor: palette.faint
  },
  ownerInline: {
    flex: 1,
    minWidth: 104,
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  ownerNameText: {
    flex: 1,
    minWidth: 38,
    fontSize: 13,
    fontWeight: "900",
    color: palette.ink
  },
  ownerRatingInline: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: 3
  },
  ownerRatingText: {
    fontSize: 13,
    fontWeight: "900",
    color: palette.gold
  },
  visibilityBadge: {
    minHeight: 26,
    paddingHorizontal: 10,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E5F5EF"
  },
  visibilityBadgeFriend: {
    backgroundColor: "#EAF6FB"
  },
  visibilityBadgeClub: {
    backgroundColor: "#FEF0EB"
  },
  visibilityBadgeText: {
    fontSize: 12,
    fontWeight: "900",
    color: palette.green
  },
  visibilityBadgeTextFriend: {
    color: palette.blue
  },
  visibilityBadgeTextClub: {
    color: "#D78B76"
  },
  mutedText: {
    fontSize: 13,
    lineHeight: 19,
    color: palette.muted
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 22,
    color: "#3C453D"
  },
  greenText: {
    marginTop: 3,
    fontSize: 13,
    color: palette.green,
    fontWeight: "800"
  },
  goldText: {
    marginTop: 3,
    fontSize: 13,
    color: palette.gold,
    fontWeight: "800"
  },
  sectionTitleRow: {
    minHeight: 42,
    marginTop: 18,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  sectionHeading: {
    fontSize: 17,
    fontWeight: "900",
    color: palette.ink
  },
  sectionAction: {
    fontSize: 13,
    fontWeight: "800",
    color: palette.green
  },
  detailContent: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    paddingBottom: 104
  },
  centered: {
    alignItems: "center"
  },
  detailTitle: {
    marginTop: 14,
    fontSize: 25,
    lineHeight: 31,
    fontWeight: "900",
    color: palette.ink,
    letterSpacing: 0
  },
  detailSubtitle: {
    marginTop: 4,
    fontSize: 15,
    color: palette.muted
  },
  metaRow: {
    marginTop: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  metaPill: {
    minHeight: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: palette.greenSoft
  },
  metaPillText: {
    fontSize: 13,
    fontWeight: "800",
    color: palette.green
  },
  infoBand: {
    marginTop: 20,
    paddingVertical: 2,
    borderTopWidth: 1,
    borderTopColor: palette.faint
  },
  infoLine: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "800",
    color: palette.ink
  },
  lenderRow: {
    marginTop: 20,
    minHeight: 74,
    padding: 12,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: palette.panel,
    borderWidth: 1,
    borderColor: palette.faint
  },
  ratingBadge: {
    height: 30,
    paddingHorizontal: 9,
    borderRadius: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFF6E5"
  },
  ratingInline: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 5
  },
  ratingText: {
    fontSize: 13,
    fontWeight: "800",
    color: palette.ink
  },
  reviewRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10
  },
  actionBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 82,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    flexDirection: "row",
    gap: 12,
    backgroundColor: palette.panel,
    borderTopWidth: 1,
    borderTopColor: palette.faint
  },
  secondaryAction: {
    width: 112,
    height: 50,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: palette.greenSoft
  },
  secondaryActionText: {
    fontSize: 15,
    fontWeight: "900",
    color: palette.green
  },
  primaryAction: {
    flex: 1,
    height: 50,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: palette.green
  },
  disabledAction: {
    backgroundColor: "#AEB8AC"
  },
  primaryActionText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#FFFFFF"
  },
  checkBookRow: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.faint
  },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.green
  },
  helperText: {
    marginTop: 12,
    fontSize: 13,
    color: palette.muted,
    textAlign: "center"
  },
  noteInput: {
    minHeight: 128,
    marginTop: 10,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.faint,
    backgroundColor: palette.panel,
    fontSize: 15,
    lineHeight: 22,
    color: palette.ink,
    textAlignVertical: "top",
  },
  profileHeader: {
    flexDirection: "row",
    gap: 14,
    alignItems: "center"
  },
  profileActions: {
    marginTop: 18,
    flexDirection: "row",
    gap: 10
  },
  outlineButton: {
    flex: 1,
    height: 46,
    borderRadius: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: palette.panel,
    borderWidth: 1,
    borderColor: palette.faint
  },
  outlineButtonText: {
    fontSize: 15,
    fontWeight: "900",
    color: palette.green
  },
  outlineDangerButton: {
    minWidth: 76,
    height: 46,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF4F1",
    borderWidth: 1,
    borderColor: "#F2D3CC"
  },
  outlineDangerButtonText: {
    fontSize: 15,
    fontWeight: "900",
    color: palette.red
  },
  primarySmallButton: {
    flex: 1,
    height: 46,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.green
  },
  primarySmallButtonText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#FFFFFF"
  },
  tabLine: {
    marginTop: 22,
    height: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: 28,
    borderBottomWidth: 1,
    borderBottomColor: palette.faint
  },
  activeTabLabel: {
    height: 42,
    color: palette.green,
    fontWeight: "900",
    borderBottomWidth: 2,
    borderBottomColor: palette.green
  },
  tabLabel: {
    height: 42,
    color: palette.muted,
    fontWeight: "800"
  },
  bookGrid: {
    marginTop: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16
  },
  gridBook: {
    width: 92
  },
  statusGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12
  },
  statusTile: {
    flex: 1,
    minHeight: 78,
    borderRadius: 18,
    backgroundColor: palette.panel,
    borderWidth: 1,
    borderColor: palette.faint,
    alignItems: "center",
    justifyContent: "center"
  },
  statusValue: {
    fontSize: 21,
    fontWeight: "900",
    color: palette.green
  },
  addBookButton: {
    height: 48,
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.faint,
    backgroundColor: palette.panel,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  shelfSectionTabs: {
    marginTop: 4,
    marginBottom: 6,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  shelfSectionTab: {
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: palette.panel,
    borderWidth: 1,
    borderColor: palette.faint
  },
  shelfSectionTabActive: {
    backgroundColor: palette.green,
    borderColor: palette.green
  },
  shelfSectionTabText: {
    fontSize: 13,
    fontWeight: "900",
    color: palette.muted
  },
  shelfSectionTabTextActive: {
    color: "#FFFFFF"
  },
  shelfSectionCount: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    textAlign: "center",
    lineHeight: 22,
    overflow: "hidden",
    fontSize: 12,
    fontWeight: "900",
    color: palette.green,
    backgroundColor: palette.greenSoft
  },
  shelfSectionCountActive: {
    color: palette.green,
    backgroundColor: "#FFFFFF"
  },
  shelfBookWrap: {
    marginBottom: 12
  },
  shelfBookActions: {
    marginTop: -4,
    marginBottom: 8,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  shelfMiniButton: {
    height: 32,
    paddingHorizontal: 13,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.greenSoft
  },
  shelfMiniButtonText: {
    fontSize: 13,
    fontWeight: "900",
    color: palette.green
  },
  statusBadge: {
    height: 28,
    paddingHorizontal: 11,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center"
  },
  statusBadgeGreen: {
    backgroundColor: palette.greenSoft
  },
  statusBadgeMuted: {
    backgroundColor: "#F0F2EE"
  },
  statusBadgeGreenText: {
    fontSize: 12,
    fontWeight: "900",
    color: palette.green
  },
  statusBadgeMutedText: {
    fontSize: 12,
    fontWeight: "900",
    color: palette.muted
  },
  borrowCard: {
    minHeight: 92,
    marginBottom: 12,
    padding: 12,
    borderRadius: 20,
    backgroundColor: palette.panel,
    borderWidth: 1,
    borderColor: palette.faint,
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  borrowActionRow: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  borrowActionButton: {
    height: 32,
    paddingHorizontal: 13,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.greenSoft
  },
  borrowDangerButton: {
    backgroundColor: "#FFF4F1"
  },
  borrowActionText: {
    fontSize: 13,
    fontWeight: "900",
    color: palette.green
  },
  borrowDangerText: {
    color: palette.red
  },
  threadRow: {
    minHeight: 78,
    marginBottom: 10,
    padding: 12,
    borderRadius: 20,
    backgroundColor: palette.panel,
    borderWidth: 1,
    borderColor: palette.faint,
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  threadTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  messageStatusLine: {
    alignSelf: "flex-start",
    marginTop: 8,
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.greenSoft
  },
  messageStatusText: {
    fontSize: 12,
    fontWeight: "900",
    color: palette.green
  },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: palette.green
  },
  chatPreview: {
    marginTop: 10,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: palette.faint
  },
  messageBubbleInbound: {
    alignSelf: "flex-start",
    maxWidth: "82%",
    marginTop: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: palette.panel
  },
  messageBubbleOutbound: {
    alignSelf: "flex-end",
    maxWidth: "82%",
    marginTop: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: palette.green
  },
  outboundText: {
    color: "#FFFFFF",
    fontWeight: "700"
  },
  bookBundle: {
    marginTop: 10,
    flexDirection: "row",
    gap: 8
  },
  neighborRow: {
    minHeight: 82,
    marginBottom: 12,
    padding: 12,
    borderRadius: 20,
    backgroundColor: palette.panel,
    borderWidth: 1,
    borderColor: palette.faint,
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  friendRequestCard: {
    minHeight: 78,
    marginBottom: 10,
    padding: 12,
    borderRadius: 20,
    backgroundColor: palette.panel,
    borderWidth: 1,
    borderColor: palette.faint,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  friendButton: {
    minWidth: 64,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.greenSoft
  },
  friendButtonDone: {
    backgroundColor: "#F2F4F0"
  },
  friendButtonText: {
    fontSize: 13,
    fontWeight: "900",
    color: palette.green
  },
  friendButtonTextDone: {
    color: palette.muted
  },
  friendRejectButton: {
    minWidth: 58,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF4F1"
  },
  friendRejectButtonText: {
    fontSize: 13,
    fontWeight: "900",
    color: palette.red
  },
  meHeader: {
    minHeight: 90,
    flexDirection: "row",
    alignItems: "center",
    gap: 14
  },
  privacyPanel: {
    marginTop: 12,
    paddingVertical: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: palette.faint
  },
  backendPanel: {
    marginTop: 12,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.faint,
    backgroundColor: palette.panel,
    gap: 10
  },
  backendPanelHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  backendStatusRow: {
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  backendStatusValue: {
    flexShrink: 1,
    textAlign: "right",
    fontSize: 13,
    fontWeight: "900",
    color: palette.ink
  },
  settingsRow: {
    minHeight: 58,
    marginBottom: 8,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: palette.panel,
    borderWidth: 1,
    borderColor: palette.faint,
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  settingsIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: palette.greenSoft,
    alignItems: "center",
    justifyContent: "center"
  },
  settingsLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
    color: palette.ink
  },
  logoutButton: {
    height: 48,
    marginTop: 16,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF4F1",
    borderWidth: 1,
    borderColor: "#F2D3CC"
  },
  logoutText: {
    color: palette.red,
    fontWeight: "900"
  },
  emptyState: {
    minHeight: 124,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.faint,
    backgroundColor: palette.panel,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    gap: 7
  },
  loadingState: {
    minHeight: 160,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.faint,
    backgroundColor: palette.panel,
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    gap: 8
  },
  loadingStateCompact: {
    minHeight: 128,
    width: "100%"
  },
  loadingIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.greenSoft
  },
  reportButton: {
    minHeight: 46,
    marginTop: 18,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F2D3CC",
    backgroundColor: "#FFF4F1",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  reportButtonDone: {
    backgroundColor: palette.greenSoft,
    borderColor: "#D8E8D5"
  },
  reportButtonText: {
    fontSize: 14,
    fontWeight: "900",
    color: palette.red
  },
  reportButtonDoneText: {
    color: palette.green
  },
  successScreen: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30
  },
  authContent: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 42
  },
  authHero: {
    alignItems: "center",
    paddingBottom: 22
  },
  authIcon: {
    width: 66,
    height: 66,
    borderRadius: 33,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.greenSoft
  },
  authIconLarge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.panel
  },
  authTitle: {
    marginTop: 16,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900",
    color: palette.ink,
    letterSpacing: 0
  },
  authSubtitle: {
    marginTop: 8,
    maxWidth: 320,
    textAlign: "center",
    fontSize: 15,
    lineHeight: 23,
    color: palette.muted
  },
  demoNotice: {
    minHeight: 48,
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    backgroundColor: "#EAF4F7",
    borderWidth: 1,
    borderColor: "#D3E6EC"
  },
  demoNoticeText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: palette.blue,
    fontWeight: "700"
  },
  authForm: {
    gap: 14
  },
  inputGroup: {
    gap: 7
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "900",
    color: palette.ink
  },
  formInput: {
    height: 50,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.faint,
    backgroundColor: palette.panel,
    fontSize: 15,
    color: palette.ink
  },
  errorText: {
    fontSize: 13,
    lineHeight: 19,
    color: palette.red,
    fontWeight: "800"
  },
  authSwitchButton: {
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center"
  },
  authSwitchText: {
    fontSize: 15,
    fontWeight: "900",
    color: palette.green
  },
  authRequiredBody: {
    flex: 1,
    paddingHorizontal: 30,
    paddingBottom: 82,
    alignItems: "center",
    justifyContent: "center"
  },
  authRequiredTitle: {
    marginTop: 18,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "900",
    color: palette.ink
  },
  formPreviewRow: {
    flexDirection: "row",
    gap: 16,
    alignItems: "center",
    marginBottom: 18
  },
  formQuickActions: {
    flex: 1,
    gap: 10
  },
  formToolButton: {
    minHeight: 46,
    paddingHorizontal: 12,
    borderRadius: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    backgroundColor: palette.panel,
    borderWidth: 1,
    borderColor: palette.faint
  },
  formToolText: {
    fontSize: 14,
    fontWeight: "900",
    color: palette.green
  },
  formTwoColumn: {
    flexDirection: "row",
    gap: 12,
    marginTop: 14
  },
  formColumn: {
    flex: 1,
    gap: 7
  },
  optionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  optionChip: {
    height: 36,
    paddingHorizontal: 13,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.panel,
    borderWidth: 1,
    borderColor: palette.faint
  },
  optionChipActive: {
    backgroundColor: palette.green,
    borderColor: palette.green
  },
  optionChipText: {
    fontSize: 13,
    fontWeight: "900",
    color: palette.muted
  },
  optionChipTextActive: {
    color: "#FFFFFF"
  },
  formInputButton: {
    height: 50,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.faint,
    backgroundColor: palette.panel,
    alignItems: "center",
    justifyContent: "center"
  },
  formInputButtonText: {
    fontSize: 15,
    fontWeight: "900",
    color: palette.green
  },
  successIllustration: {
    width: 150,
    height: 150,
    borderRadius: 75,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.greenSoft
  },
  successCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.green
  },
  successSubtitle: {
    marginTop: 10,
    marginBottom: 22,
    maxWidth: 300,
    textAlign: "center",
    fontSize: 15,
    lineHeight: 23,
    color: palette.muted
  },
  primaryActionFull: {
    width: "100%",
    height: 52,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.green
  },
  notFoundAction: {
    marginTop: 18
  }
});

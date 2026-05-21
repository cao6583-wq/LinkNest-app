import { books as mockBooks, users as mockUsers } from "./mockData";
import { mapBookRowToBook, mapProfileRowToUser } from "./supabaseMappers";
import type { AuthUser } from "../lib/auth";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import type { Book, User } from "../types";
import type { Database } from "../types/database";

export type BookCatalog = {
  books: Book[];
  users: User[];
  source: "supabase" | "mock";
  error?: string;
};

export type NearbyQuery = {
  lat: number;
  lng: number;
  radiusKm: number;
  category: string;
};

export const defaultNearbyQuery: NearbyQuery = {
  lat: 43.6532,
  lng: -79.3832,
  radiusKm: 3,
  category: "全部"
};

type NearbyBookRow = Database["public"]["Functions"]["nearby_books"]["Returns"][number];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type BookRow = Database["public"]["Tables"]["books"]["Row"];

export async function fetchBookCatalog(
  query: NearbyQuery = defaultNearbyQuery,
  user?: AuthUser | null
): Promise<BookCatalog> {
  if (!isSupabaseConfigured || user?.isDemo) {
    return {
      books: filterBooks(mockBooks, query),
      users: mockUsers,
      source: "mock"
    };
  }

  try {
    const { data: nearbyRows, error: nearbyError } = await supabase.rpc("nearby_books" as never, {
      user_lat: query.lat,
      user_lng: query.lng,
      radius_km: query.radiusKm
    } as never);

    if (nearbyError) throw nearbyError;

    const nearbyFilteredRows = filterRows((nearbyRows ?? []) as NearbyBookRow[], query);
    const scopedRows = user ? await fetchUserScopedBooks(user.id) : [];
    const rows = mergeBookRows(nearbyFilteredRows, scopedRows);
    const ownerIds = Array.from(new Set(rows.map((book) => book.owner_id)));

    const { data: profileRows, error: profileError } = ownerIds.length
      ? await supabase
        .from("profiles")
        .select("*")
        .in("id", ownerIds)
      : { data: [], error: null };

    if (profileError) throw profileError;
    const profiles = (profileRows ?? []) as ProfileRow[];

    const sharedCounts = rows.reduce<Record<string, number>>((counts, book) => {
      counts[book.owner_id] = (counts[book.owner_id] ?? 0) + 1;
      return counts;
    }, {});

    const mappedUsers = profiles.map((profile) => mapProfileRowToUser(
      profile,
      4.8,
      sharedCounts[profile.id] ?? 0,
      distanceFromQuery(profile, query)
    ));

    return {
      books: rows.map(mapBookRowToBook),
      users: mappedUsers.length ? mappedUsers : mockUsers,
      source: "supabase"
    };
  } catch (error) {
    return {
      books: filterBooks(mockBooks, query),
      users: mockUsers,
      source: "mock",
      error: error instanceof Error ? error.message : "Supabase 图书查询失败，已使用本地示例数据。"
    };
  }
}

function filterBooks(books: Book[], query: NearbyQuery): Book[] {
  return books.filter((book) => (
    book.distanceKm <= query.radiusKm
    && (query.category === "全部" || book.category === query.category)
  ));
}

function filterRows(rows: NearbyBookRow[], query: NearbyQuery): NearbyBookRow[] {
  return rows.filter((book) => query.category === "全部" || book.category === query.category);
}

async function fetchUserScopedBooks(userId: string): Promise<BookRow[]> {
  const { data: requests, error: requestError } = await (supabase.from("borrow_requests") as any)
    .select("book_id")
    .or(`borrower_id.eq.${userId},lender_id.eq.${userId}`);

  if (requestError) throw requestError;

  const requestedBookIds = ((requests ?? []) as Array<{ book_id: string }>).map((request) => request.book_id);
  const scopedIds = Array.from(new Set(requestedBookIds));

  const ownedQuery = (supabase.from("books") as any)
    .select("*")
    .eq("owner_id", userId);
  const requestedQuery = scopedIds.length
    ? (supabase.from("books") as any).select("*").in("id", scopedIds)
    : Promise.resolve({ data: [], error: null });

  const [{ data: ownedRows, error: ownedError }, { data: requestedRows, error: requestedError }] = await Promise.all([
    ownedQuery,
    requestedQuery
  ]);

  if (ownedError) throw ownedError;
  if (requestedError) throw requestedError;

  return mergeBookRows((ownedRows ?? []) as BookRow[], (requestedRows ?? []) as BookRow[]);
}

function mergeBookRows<T extends BookRow | NearbyBookRow>(primary: T[], secondary: T[]): T[];
function mergeBookRows(primary: Array<BookRow | NearbyBookRow>, secondary: Array<BookRow | NearbyBookRow>) {
  const merged = new Map<string, BookRow | NearbyBookRow>();
  [...primary, ...secondary].forEach((row) => {
    const previous = merged.get(row.id);
    merged.set(row.id, previous && "distance_km" in previous ? previous : row);
  });
  return Array.from(merged.values());
}

function distanceFromQuery(profile: ProfileRow, query: NearbyQuery): number {
  if (typeof profile.home_lat !== "number" || typeof profile.home_lng !== "number") return 0;
  return haversineDistanceKm(query.lat, query.lng, profile.home_lat, profile.home_lng);
}

function haversineDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  return Number((earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1));
}

function toRadians(value: number): number {
  return value * (Math.PI / 180);
}

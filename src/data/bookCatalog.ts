import { books as mockBooks, users as mockUsers } from "./mockData";
import { mapBookRowToBook, mapProfileRowToUser } from "./supabaseMappers";
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

export async function fetchBookCatalog(query: NearbyQuery = defaultNearbyQuery): Promise<BookCatalog> {
  if (!isSupabaseConfigured) {
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

    const rows = filterRows((nearbyRows ?? []) as NearbyBookRow[], query);
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

    const mappedUsers = profiles.map((profile) => (
      mapProfileRowToUser(profile, 4.8, sharedCounts[profile.id] ?? 0)
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

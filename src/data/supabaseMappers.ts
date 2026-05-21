import type { Book, BookStatus, User } from "../types";
import type { Database } from "../types/database";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type BookRow = Database["public"]["Tables"]["books"]["Row"];
type NearbyBookRow = Database["public"]["Functions"]["nearby_books"]["Returns"][number];

const conditionLabels: Record<BookRow["condition"], string> = {
  new: "全新",
  like_new: "较新",
  good: "良好",
  fair: "有使用痕迹"
};

const coverPalette = [
  ["#17476A", "#F4C95D"],
  ["#B85745", "#F6E4B1"],
  ["#3E6075", "#E4E9D8"],
  ["#2F4F3E", "#F0D8A8"],
  ["#223C3A", "#D9B86C"]
];

export function mapProfileRowToUser(
  profile: ProfileRow,
  rating = 4.8,
  sharedCount = 0,
  distanceKm = 0
): User {
  return {
    id: profile.id,
    displayName: profile.display_name,
    avatar: profile.display_name.slice(0, 1).toUpperCase(),
    distanceKm,
    sharedCount,
    rating,
    bio: profile.bio ?? "",
    neighborhood: "附近邻居"
  };
}

export function mapBookRowToBook(row: BookRow | NearbyBookRow, index = 0): Book {
  const [coverColor, accentColor] = coverPalette[index % coverPalette.length];
  const distanceKm = "distance_km" in row && typeof row.distance_km === "number"
    ? Number(row.distance_km.toFixed(1))
    : 0;

  return {
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    author: row.author,
    category: row.category,
    language: row.language,
    condition: conditionLabels[row.condition],
    status: row.status as BookStatus,
    distanceKm,
    description: row.description ?? "",
    coverColor,
    accentColor,
    year: row.publish_year ? String(row.publish_year) : "未知"
  };
}

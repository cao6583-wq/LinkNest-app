import { mapBookRowToBook } from "./supabaseMappers";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import type { AuthUser } from "../lib/auth";
import type { Book, BookStatus } from "../types";
import type { Database } from "../types/database";

export type BookCondition = Database["public"]["Tables"]["books"]["Row"]["condition"];

export type BookDraft = {
  title: string;
  author: string;
  category: string;
  language: string;
  condition: BookCondition;
  publishYear?: string;
  description: string;
  status: BookStatus;
};

const conditionLabels: Record<BookCondition, string> = {
  new: "全新",
  like_new: "较新",
  good: "良好",
  fair: "有使用痕迹"
};

export async function publishBook(draft: BookDraft, user: AuthUser): Promise<Book> {
  const cleanDraft = normalizeDraft(draft);

  if (!isSupabaseConfigured || user.isDemo) {
    return createLocalBook(cleanDraft, user);
  }

  const { data, error } = await (supabase.from("books") as any)
    .insert({
      owner_id: user.id,
      title: cleanDraft.title,
      author: cleanDraft.author,
      category: cleanDraft.category,
      language: cleanDraft.language,
      condition: cleanDraft.condition,
      publish_year: cleanDraft.publishYear ? Number(cleanDraft.publishYear) : null,
      description: cleanDraft.description,
      status: cleanDraft.status,
      location_lat: 43.6532,
      location_lng: -79.3832
    })
    .select("*")
    .single();

  if (error) throw error;
  return mapBookRowToBook(data, 0);
}

export async function updatePublishedBook(book: Book, draft: BookDraft, user: AuthUser): Promise<Book> {
  const cleanDraft = normalizeDraft(draft);

  if (!isSupabaseConfigured || user.isDemo || book.ownerId === "alice") {
    return {
      ...book,
      title: cleanDraft.title,
      author: cleanDraft.author,
      category: cleanDraft.category,
      language: cleanDraft.language,
      condition: conditionLabels[cleanDraft.condition],
      status: cleanDraft.status,
      description: cleanDraft.description,
      year: cleanDraft.publishYear || "未知"
    };
  }

  const { data, error } = await (supabase.from("books") as any)
    .update({
      title: cleanDraft.title,
      author: cleanDraft.author,
      category: cleanDraft.category,
      language: cleanDraft.language,
      condition: cleanDraft.condition,
      publish_year: cleanDraft.publishYear ? Number(cleanDraft.publishYear) : null,
      description: cleanDraft.description,
      status: cleanDraft.status
    })
    .eq("id", book.id)
    .eq("owner_id", user.id)
    .select("*")
    .single();

  if (error) throw error;
  return mapBookRowToBook(data, 0);
}

export function draftFromBook(book?: Book): BookDraft {
  return {
    title: book?.title ?? "",
    author: book?.author ?? "",
    category: book?.category ?? "文学",
    language: book?.language ?? "中文",
    condition: getConditionValue(book?.condition),
    publishYear: book?.year === "未知" ? "" : book?.year ?? "",
    description: book?.description ?? "",
    status: book?.status ?? "available"
  };
}

function normalizeDraft(draft: BookDraft): BookDraft {
  return {
    title: draft.title.trim(),
    author: draft.author.trim(),
    category: draft.category.trim() || "未分类",
    language: draft.language.trim() || "中文",
    condition: draft.condition,
    publishYear: draft.publishYear?.trim(),
    description: draft.description.trim(),
    status: draft.status
  };
}

function createLocalBook(draft: BookDraft, user: AuthUser): Book {
  return {
    id: `local-${Date.now()}`,
    ownerId: user.id,
    title: draft.title,
    author: draft.author,
    category: draft.category,
    language: draft.language,
    condition: conditionLabels[draft.condition],
    status: draft.status,
    distanceKm: 0,
    description: draft.description,
    coverColor: "#315C49",
    accentColor: "#F1D28A",
    year: draft.publishYear || "未知"
  };
}

function getConditionValue(condition?: string): BookCondition {
  const found = Object.entries(conditionLabels).find(([, label]) => label === condition);
  return (found?.[0] as BookCondition | undefined) ?? "good";
}

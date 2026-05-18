import { isSupabaseConfigured, supabase } from "../lib/supabase";
import type { AuthUser } from "../lib/auth";

export type ReportReason = "spam" | "unsafe" | "inappropriate" | "copyright" | "other";

export type ReportDraft = {
  bookId?: string;
  reportedUserId?: string;
  reason?: ReportReason;
  detail?: string;
};

export type SubmittedReport = {
  id: string;
  source: "supabase" | "local";
};

const localReports: Array<ReportDraft & { id: string; reporterId: string; createdAt: string }> = [];

export async function submitReport(reporter: AuthUser, draft: ReportDraft): Promise<SubmittedReport> {
  const reason = draft.reason ?? "other";
  const detail = draft.detail ?? "用户从 LinkNest App 发起举报，请后台审核。";

  if (!isSupabaseConfigured || reporter.isDemo) {
    const report = {
      ...draft,
      id: `local-report-${Date.now()}`,
      reporterId: reporter.id,
      reason,
      detail,
      createdAt: new Date().toISOString()
    };
    localReports.unshift(report);
    return { id: report.id, source: "local" };
  }

  const { data, error } = await (supabase.from("reports") as any)
    .insert({
      reporter_id: reporter.id,
      reported_user_id: draft.reportedUserId ?? null,
      book_id: draft.bookId ?? null,
      reason,
      detail,
      status: "open"
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return {
    id: data.id,
    source: "supabase"
  };
}

import { isSupabaseConfigured, supabase } from "./supabase";

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  isDemo?: boolean;
};

export type AuthMode = "signIn" | "signUp";

type AuthPayload = {
  email: string;
  password: string;
  displayName?: string;
};

export async function getCurrentAuthUser(): Promise<AuthUser | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;

  const user = data.session?.user;
  if (!user?.email) return null;

  return {
    id: user.id,
    email: user.email,
    displayName: getDisplayName(user.email, user.user_metadata?.display_name)
  };
}

export async function signInWithEmail({ email, password }: AuthPayload): Promise<AuthUser> {
  if (!isSupabaseConfigured) {
    return createDemoUser(email);
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password
  });

  if (error) throw error;
  if (!data.user?.email) throw new Error("登录成功，但没有获取到账户邮箱。");

  return {
    id: data.user.id,
    email: data.user.email,
    displayName: getDisplayName(data.user.email, data.user.user_metadata?.display_name)
  };
}

export async function signUpWithEmail({ email, password, displayName }: AuthPayload): Promise<AuthUser> {
  if (!isSupabaseConfigured) {
    return createDemoUser(email, displayName);
  }

  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: {
        display_name: displayName?.trim() || undefined
      }
    }
  });

  if (error) throw error;
  if (!data.user?.email) throw new Error("注册成功，请检查邮箱完成验证后再登录。");

  return {
    id: data.user.id,
    email: data.user.email,
    displayName: getDisplayName(data.user.email, displayName || data.user.user_metadata?.display_name)
  };
}

export async function signOut(): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

function createDemoUser(email: string, displayName?: string): AuthUser {
  const cleanEmail = email.trim() || "demo@linknest.local";
  return {
    id: "demo-user",
    email: cleanEmail,
    displayName: getDisplayName(cleanEmail, displayName),
    isDemo: true
  };
}

function getDisplayName(email: string, displayName?: unknown): string {
  if (typeof displayName === "string" && displayName.trim()) {
    return displayName.trim();
  }
  return email.split("@")[0] || "LinkNest 用户";
}

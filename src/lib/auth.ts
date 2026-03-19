import { createClient } from "@/lib/auth/supabase-server";

export interface LegacyAuthSession {
  userId: string;
  user: {
    id: string;
    email: string | null;
  };
}

/**
 * Backward-compatible auth helper used by older modules.
 * Prefer `requireAuth` from `@/lib/rbac/access` for new code.
 */
export async function auth(): Promise<LegacyAuthSession | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return {
    userId: user.id,
    user: {
      id: user.id,
      email: user.email ?? null,
    },
  };
}

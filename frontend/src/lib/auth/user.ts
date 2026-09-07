import type { User } from "@supabase/supabase-js";
export function isVerifiedUser(user: User | null): user is User {
  return Boolean(user && user.is_anonymous !== true && (user.email_confirmed_at || user.phone_confirmed_at));
}

import { User as PrismaUser, Role } from "@prisma/client";
import { User as SupabaseUser } from "@supabase/supabase-js";

export interface AuthUser extends PrismaUser {
  role: Role;
}

export interface AuthSession {
  user: AuthUser;
  supabaseUser: SupabaseUser;
  accessToken: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupCredentials {
  email: string;
  password: string;
  confirmPassword?: string;
}

export interface AuthContextType {
  user: AuthUser | null;
  session: AuthSession | null;
  loading: boolean;
  signIn: (credentials: LoginCredentials) => Promise<void>;
  signUp: (credentials: SignupCredentials) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
}

export type AuthError = {
  message: string;
  code?: string;
};

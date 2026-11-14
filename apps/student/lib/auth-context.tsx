import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, setToken } from "./api";
import { registerForPushNotificationsAsync } from "./notifications";

export type Profile = {
  id: string;
  role: string;
  full_name: string | null;
  phone: string | null;
  hostel: string | null;
  room: string | null;
  referral_code: string;
  email?: string;
};

type AuthContextValue = {
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (payload: Record<string, string>) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshProfile() {
    try {
      const data = await api<{ user: Profile }>("/auth/me");
      setProfile(data.user);
      registerForPushNotificationsAsync().catch(() => undefined);
    } catch {
      setProfile(null);
    }
  }

  useEffect(() => {
    refreshProfile().finally(() => setLoading(false));
  }, []);

  const value = useMemo(
    () => ({
      profile,
      loading,
      refreshProfile,
      signIn: async (email: string, password: string) => {
        const data = await api<{ user: Profile; token: string }>("/auth/login", {
          method: "POST",
          json: { email, password },
          auth: false,
        });
        await setToken(data.token);
        setProfile(data.user);
        registerForPushNotificationsAsync().catch(() => undefined);
      },
      signUp: async (payload: Record<string, string>) => {
        const data = await api<{ user: Profile; token: string }>("/auth/signup", {
          method: "POST",
          json: payload,
          auth: false,
        });
        await setToken(data.token);
        setProfile(data.user);
      },
      signOut: async () => {
        await setToken(null);
        setProfile(null);
      },
    }),
    [profile, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

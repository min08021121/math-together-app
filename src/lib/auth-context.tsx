"use client";

import {
  onAuthStateChanged,
  signOut,
  type User,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { auth, db } from "@/lib/firebase";
import type { UserProfile } from "@/types";

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  logout: () => Promise<void>;
  refreshProfile: (userId?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async (userId?: string) => {
    const profileId = userId ?? auth.currentUser?.uid;

    if (!profileId) {
      setProfile(null);
      return;
    }

    const snapshot = await getDoc(doc(db, "users", profileId));
    setProfile(
      snapshot.exists()
        ? ({ id: snapshot.id, ...snapshot.data() } as UserProfile)
        : null,
    );
  }, []);

  useEffect(() => {
    return onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);

      if (!nextUser) {
        setProfile(null);
        setLoading(false);
        return;
      }

      try {
        await refreshProfile(nextUser.uid);
      } catch {
        setProfile(null);
      } finally {
        setLoading(false);
      }
    });
  }, [refreshProfile]);

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      logout: () => signOut(auth),
      refreshProfile,
    }),
    [loading, profile, refreshProfile, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}

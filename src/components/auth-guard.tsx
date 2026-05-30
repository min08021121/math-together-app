"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { useAuth } from "@/lib/auth-context";
import type { UserRole } from "@/types";

export function AuthGuard({
  children,
  role,
}: {
  children: ReactNode;
  role: UserRole;
}) {
  const router = useRouter();
  const { loading, profile, user } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (!user || !profile) {
      router.replace("/");
      return;
    }

    if (profile.role !== role) {
      router.replace("/");
    }
  }, [loading, profile, role, router, user]);

  if (loading || !user || !profile || profile.role !== role) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-lilac-50 text-sm font-semibold text-lilac-700">
        화면을 준비하고 있어요.
      </div>
    );
  }

  return children;
}

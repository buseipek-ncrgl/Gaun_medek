"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { AuthGuard } from "./AuthGuard";
import { authApi } from "@/lib/api/authApi";

export function LayoutSwitcher({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [hasToken, setHasToken] = useState<boolean | null>(null);

  useEffect(() => {
    if (pathname === "/login") {
      setHasToken(true);
      return;
    }
    setHasToken(!!authApi.getStoredToken());
  }, [pathname]);

  useEffect(() => {
    if (pathname !== "/login" && hasToken === false) {
      router.replace("/login");
    }
  }, [pathname, hasToken, router]);

  if (pathname === "/login") {
    return <>{children}</>;
  }

  if (hasToken === null || hasToken === false) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-brand-navy" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden min-w-0">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 lg:ml-64">
        <Topbar />
        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-background p-3 sm:p-4 md:p-6 min-h-0 min-w-0">
          <AuthGuard>{children}</AuthGuard>
        </main>
      </div>
    </div>
  );
}

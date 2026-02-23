"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { authApi } from "@/lib/api/authApi";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (pathname === "/login") {
      setChecked(true);
      return;
    }
    const token = authApi.getStoredToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    setChecked(true);
  }, [pathname, router]);

  if (pathname === "/login") {
    return <>{children}</>;
  }
  if (!checked) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-brand-navy" />
      </div>
    );
  }
  return <>{children}</>;
}

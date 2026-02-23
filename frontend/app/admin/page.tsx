"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api/authApi";

// Tek ana sayfa Genel Bakış (/) — yönetici de aynı dashboard'u kullanır. /admin doğrudan oraya yönlendirilir.
export default function AdminPage() {
  const router = useRouter();

  useEffect(() => {
    const user = authApi.getStoredUser();
    if (user?.role !== "super_admin") {
      router.replace("/");
      return;
    }
    router.replace("/");
  }, [router]);

  return null;
}

"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { User, Bell, Settings, Menu } from "lucide-react";
import { Button } from "./button";
import { NotificationDropdown } from "./NotificationDropdown";
import { useSidebar } from "@/components/providers/SidebarProvider";

interface TopbarProps {
  title?: string;
}

// Navigation items - sidebar ile aynı yapı
const navigation = [
  { name: "Kontrol Paneli", href: "/", icon: null },
  { name: "Derslerim", href: "/dashboard/courses", icon: null },
  { name: "Öğrenme Çıktıları", href: "/outcomes", icon: null },
  { name: "Program Çıktıları", href: "/dashboard/program-outcomes", icon: null },
  { name: "Sınavlar", href: "/exams", icon: null },
  { name: "Öğrenciler", href: "/students", icon: null },
  { name: "Raporlar", href: "/reports", icon: null },
];

// Alt sayfalar için özel başlıklar
const pageTitles: Record<string, string> = {
  "/outcomes/new": "Yeni Öğrenme Çıktısı",
  "/students/new": "Yeni Öğrenci",
  "/exams/new": "Yeni Sınav",
  "/dashboard/courses/create": "Yeni Ders Oluştur",
  "/ai": "AI Sınav İşleme",
  "/scores": "Puanlar",
  "/settings": "Ayarlar",
  "/dashboard/settings": "Ayarlar",
};

function getPageTitle(pathname: string): string {
  // Önce özel sayfa başlıklarını kontrol et
  if (pageTitles[pathname]) {
    return pageTitles[pathname];
  }

  // Alt sayfalar için (örn: /outcomes/[id], /students/[id])
  if (pathname.startsWith("/outcomes/") && pathname !== "/outcomes/new") {
    return "Öğrenme Çıktısını Düzenle";
  }
  if (pathname.startsWith("/students/") && pathname !== "/students/new") {
    return "Öğrenci Detayları";
  }
  if (pathname.startsWith("/exams/") && pathname !== "/exams/new") {
    if (pathname.includes("/view")) {
      return "Sınav Detayları";
    }
    return "Sınav Düzenle";
  }
  if (pathname.startsWith("/courses/") && pathname !== "/courses/new") {
    return "Ders Detayları";
  }
  if (pathname.startsWith("/reports/")) {
    return "MEDEK Raporu";
  }
  if (pathname.startsWith("/dashboard/courses/") && !pathname.includes("/create")) {
    return "Ders Detayları";
  }
  if (pathname.startsWith("/dashboard/exams/")) {
    return "Sınav İşlemleri";
  }
  if (pathname.startsWith("/dashboard/settings")) {
    return "Ayarlar";
  }

  // Navigation items'ı kontrol et
  for (const item of navigation) {
    if (pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href + "/"))) {
      return item.name;
    }
  }

  // Varsayılan
  return "Kontrol Paneli";
}

export function Topbar({ title }: TopbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const pageTitle = title || getPageTitle(pathname);
  const { isOpen, toggle } = useSidebar();

  return (
    <header className="sticky top-0 z-30 h-14 sm:h-16 border-b border-slate-200/50 dark:border-slate-700/50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md supports-[backdrop-filter]:bg-white/70 dark:supports-[backdrop-filter]:bg-slate-900/70 shadow-sm">
      <div className="flex h-full items-center justify-between px-3 sm:px-4 lg:px-6">
        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
          {/* Mobile hamburger menu button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            className="lg:hidden h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0 -ml-1 sm:ml-0 hover:bg-slate-100 dark:hover:bg-slate-800"
            title={isOpen ? "Menüyü Kapat" : "Menüyü Aç"}
          >
            <Menu className="h-5 w-5 text-slate-700 dark:text-slate-200" />
          </Button>
          <h1 className="text-base sm:text-xl lg:text-2xl font-semibold truncate text-slate-900 dark:text-slate-100 ml-0 sm:ml-0">{pageTitle}</h1>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          <NotificationDropdown />
          <Button 
            variant="ghost" 
            size="icon"
            className="h-9 w-9 sm:h-10 sm:w-10 hover:bg-slate-100 dark:hover:bg-slate-800"
            onClick={() => router.push("/dashboard/settings")}
            title="Ayarlar"
          >
            <Settings className="h-4 w-4 sm:h-5 sm:w-5 text-slate-700 dark:text-slate-200" />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-10 sm:w-10 hover:bg-slate-100 dark:hover:bg-slate-800">
            <User className="h-4 w-4 sm:h-5 sm:w-5 text-slate-700 dark:text-slate-200" />
          </Button>
        </div>
      </div>
    </header>
  );
}


"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  Target,
  FileText,
  Users,
  BarChart3,
  GraduationCap,
  Settings,
  Building2,
  BookMarked,
  LogOut,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/providers/SidebarProvider";
import { authApi, type AuthUser } from "@/lib/api/authApi";

// Tüm panellerde aynı dashboard görünümü; sadece menü öğeleri role göre değişir.

// Sadece Yönetici (super_admin): kullanıcı yönetimi, bölüm/program
const adminOnlyNav = [
  { name: "Kullanıcı Yönetimi", href: "/admin/users", icon: Users },
  { name: "Bölümler", href: "/admin/departments", icon: Building2 },
  { name: "Programlar", href: "/admin/programs", icon: BookMarked },
];

// Bölüm başkanı: kendi bölümündeki öğretmenlere ders atama
const departmentHeadNav = [
  { name: "Öğretmen / Ders Atama", href: "/admin/users", icon: Users },
];

// ÖÇ/PÇ eşleşmesi: sadece Yönetici ve Bölüm Başkanı (öğretmende yok)
const outcomesNav = [
  { name: "Öğrenme Çıktıları", href: "/outcomes", icon: Target },
  { name: "Program Çıktıları", href: "/dashboard/program-outcomes", icon: GraduationCap },
];

// Hepsi: ortak menü (dashboard aynı)
const commonNav = [
  { name: "Genel Bakış", href: "/", icon: LayoutDashboard },
  { name: "Dersler", href: "/dashboard/courses", icon: BookOpen },
  { name: "Sınavlar", href: "/exams", icon: FileText },
  { name: "Öğrenciler", href: "/students", icon: Users },
  { name: "Raporlar", href: "/reports", icon: BarChart3 },
];
const settingsNav = [
  { name: "Ayarlar", href: "/dashboard/settings", icon: Settings },
];

function NavLinks({
  items,
  pathname,
  onLinkClick,
}: {
  items: { name: string; href: string; icon: React.ComponentType<{ className?: string }> }[];
  pathname: string;
  onLinkClick: () => void;
}) {
  return (
    <>
      {items.map((item) => {
        const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
        return (
          <Link
            key={item.name}
            href={item.href}
            onClick={onLinkClick}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
              "min-h-[44px]",
              isActive
                ? "bg-white/20 text-white shadow-lg backdrop-blur-sm"
                : "text-white/80 hover:bg-white/10 hover:text-white active:bg-white/5"
            )}
          >
            <item.icon className={cn("h-5 w-5 flex-shrink-0", isActive ? "text-white" : "text-white/80")} />
            <span className="truncate">{item.name}</span>
          </Link>
        );
      })}
    </>
  );
}

export function Sidebar() {
  const { isOpen, setIsOpen } = useSidebar();
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
    setUser(authApi.getStoredUser());
  }, [pathname]);

  const handleLogout = () => {
    authApi.logout();
    setIsOpen(false);
    router.push("/login");
  };

  const effectiveUser = mounted ? user : null;

  return (
    <>
      {/* Overlay for mobile - tıklanınca sidebar kapanır */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 z-[45] backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar - mobilde z-50 ile overlay üstünde */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-50 lg:z-40 h-screen transition-transform duration-300 ease-in-out",
          "w-[280px] sm:w-64 lg:w-64 lg:translate-x-0",
          "bg-gradient-to-b from-[#0a294e] via-[#0f3a6b] to-[#051d35]",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo/Brand + Panel adı + Mobil kapatma butonu */}
          <div className="flex flex-col px-4 lg:px-6 py-4 lg:py-5 border-b border-white/10 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="relative w-12 h-12 flex-shrink-0">
                <img 
                  src="/assets/ntmyo-logo.png" 
                  alt="NTMYO Logo" 
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-lg lg:text-xl font-bold text-white leading-tight">NTMYO</h1>
                <p className="text-xs text-white/80 leading-tight">Ölçme Değerlendirme</p>
              </div>
              {/* Mobilde sidebar kapatma butonu */}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="lg:hidden flex-shrink-0 p-2 rounded-lg text-white/90 hover:bg-white/20 hover:text-white transition-colors"
                title="Menüyü kapat"
                aria-label="Menüyü kapat"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {effectiveUser && (
              <p className="mt-3 px-2 py-1.5 rounded-md bg-white/10 text-white/90 text-xs font-semibold uppercase tracking-wider">
                {effectiveUser.role === "super_admin" && "Yönetici Paneli"}
                {effectiveUser.role === "department_head" && "Bölüm Paneli"}
                {effectiveUser.role === "teacher" && "Öğretmen Paneli"}
              </p>
            )}
          </div>

          {/* Navigation - Genel (dashboard) en üstte; yönetici ekstra menü; ÖÇ/PÇ yönetici + bölüm */}
          <nav className="flex-1 px-3 sm:px-4 py-4 lg:py-6 space-y-6 overflow-y-auto scrollbar-hide">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-white/50 uppercase tracking-wider px-3 mb-2">
                GENEL
              </p>
              <NavLinks items={commonNav} pathname={pathname || ""} onLinkClick={() => setIsOpen(false)} />
            </div>

            {effectiveUser?.role === "super_admin" && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-white/50 uppercase tracking-wider px-3 mb-2">
                  YÖNETİCİ
                </p>
                <NavLinks items={adminOnlyNav} pathname={pathname || ""} onLinkClick={() => setIsOpen(false)} />
              </div>
            )}
            {effectiveUser?.role === "department_head" && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-white/50 uppercase tracking-wider px-3 mb-2">
                  BÖLÜM
                </p>
                <NavLinks items={departmentHeadNav} pathname={pathname || ""} onLinkClick={() => setIsOpen(false)} />
              </div>
            )}

            {(effectiveUser?.role === "super_admin" || effectiveUser?.role === "department_head" || effectiveUser?.role === "teacher") && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-white/50 uppercase tracking-wider px-3 mb-2">
                  ÖÇ / PÇ EŞLEŞMESİ
                </p>
                <NavLinks items={outcomesNav} pathname={pathname || ""} onLinkClick={() => setIsOpen(false)} />
              </div>
            )}

            <div className="space-y-1 pt-4 border-t border-white/10">
              <NavLinks items={settingsNav} pathname={pathname || ""} onLinkClick={() => setIsOpen(false)} />
            </div>
          </nav>

          {/* Çıkış - sidebar en altında, her zaman görünür */}
          <div className="flex-shrink-0 border-t border-white/10 px-3 sm:px-4 py-3">
            <button
              type="button"
              onClick={handleLogout}
              className={cn(
                "flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 min-h-[44px]",
                "text-white/80 hover:bg-red-500/20 hover:text-white active:bg-red-500/30"
              )}
            >
              <LogOut className="h-5 w-5 flex-shrink-0 text-white/80" />
              <span className="truncate">Çıkış</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}


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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/providers/SidebarProvider";

// Navigation grouped by categories
const academicNav = [
  { name: "Genel Bakış", href: "/", icon: LayoutDashboard },
  { name: "Derslerim", href: "/dashboard/courses", icon: BookOpen },
  { name: "Öğrenme Çıktıları", href: "/outcomes", icon: Target },
  { name: "Program Çıktıları", href: "/dashboard/program-outcomes", icon: GraduationCap },
];

const managementNav = [
  { name: "Sınavlar", href: "/exams", icon: FileText },
  { name: "Öğrenciler", href: "/students", icon: Users },
  { name: "Raporlar", href: "/reports", icon: BarChart3 },
];

const settingsNav = [
  { name: "Sistem Ayarları", href: "/dashboard/settings", icon: Settings },
];

export function Sidebar() {
  const { isOpen, setIsOpen } = useSidebar();
  const pathname = usePathname();

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-40 h-screen transition-transform duration-300 ease-in-out",
          "w-[280px] sm:w-64 lg:w-64 lg:translate-x-0",
          "bg-gradient-to-b from-[#0a294e] via-[#0f3a6b] to-[#051d35]",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo/Brand */}
          <div className="flex flex-col px-4 lg:px-6 py-4 lg:py-5 border-b border-white/10 flex-shrink-0">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-6 w-6 text-white" />
              <h1 className="text-xl lg:text-2xl font-bold text-white">MEDEK</h1>
            </div>
            <p className="text-xs text-white/70 mt-1 ml-8">YÖNETİM SİSTEMİ</p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 sm:px-4 py-4 lg:py-6 space-y-6 overflow-y-auto">
            {/* Academic Section */}
            <div className="space-y-1">
              <p className="text-xs font-semibold text-white/50 uppercase tracking-wider px-3 mb-2">
                AKADEMİK
              </p>
              {academicNav.map((item) => {
                const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                      "min-h-[44px]",
                      isActive
                        ? "bg-white/20 text-white shadow-lg backdrop-blur-sm"
                        : "text-white/80 hover:bg-white/10 hover:text-white active:bg-white/5"
                    )}
                  >
                    <item.icon className={cn(
                      "h-5 w-5 flex-shrink-0",
                      isActive ? "text-white" : "text-white/80"
                    )} />
                    <span className="truncate">{item.name}</span>
                  </Link>
                );
              })}
            </div>

            {/* Management Section */}
            <div className="space-y-1">
              <p className="text-xs font-semibold text-white/50 uppercase tracking-wider px-3 mb-2">
                YÖNETİM
              </p>
              {managementNav.map((item) => {
                const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                      "min-h-[44px]",
                      isActive
                        ? "bg-white/20 text-white shadow-lg backdrop-blur-sm"
                        : "text-white/80 hover:bg-white/10 hover:text-white active:bg-white/5"
                    )}
                  >
                    <item.icon className={cn(
                      "h-5 w-5 flex-shrink-0",
                      isActive ? "text-white" : "text-white/80"
                    )} />
                    <span className="truncate">{item.name}</span>
                  </Link>
                );
              })}
            </div>

            {/* Settings Section */}
            <div className="space-y-1 pt-4 border-t border-white/10">
              {settingsNav.map((item) => {
                const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                      "min-h-[44px]",
                      isActive
                        ? "bg-white/20 text-white shadow-lg backdrop-blur-sm"
                        : "text-white/80 hover:bg-white/10 hover:text-white active:bg-white/5"
                    )}
                  >
                    <item.icon className={cn(
                      "h-5 w-5 flex-shrink-0",
                      isActive ? "text-white" : "text-white/80"
                    )} />
                    <span className="truncate">{item.name}</span>
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>
      </aside>
    </>
  );
}


import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { SidebarProvider } from "@/components/providers/SidebarProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "NTMYO Ölçme Değerlendirme Yönetim Sistemi",
  description: "Naci Topçuoğlu Meslek Yüksekokulu Ölçme Değerlendirme ve Çıktı Analiz Sistemi",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider>
          <SidebarProvider>
            <div className="flex h-screen overflow-hidden">
              <Sidebar />
              <div className="flex-1 flex flex-col overflow-hidden lg:ml-64">
                <Topbar />
                <main className="flex-1 overflow-y-auto bg-background p-4 sm:p-6">
                  {children}
                </main>
              </div>
            </div>
          </SidebarProvider>
          <Toaster 
            position="top-right" 
            theme="system"
            toastOptions={{
              classNames: {
                toast: "dark:bg-slate-800 dark:text-foreground dark:border-slate-700",
                title: "dark:text-foreground",
                description: "dark:text-muted-foreground",
                success: "dark:bg-green-900/20 dark:text-green-300 dark:border-green-800",
                error: "dark:bg-red-900/20 dark:text-red-300 dark:border-red-800",
                info: "dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800",
                warning: "dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-800",
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}


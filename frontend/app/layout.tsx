import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { LayoutSwitcher } from "@/components/auth/LayoutSwitcher";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { SidebarProvider } from "@/components/providers/SidebarProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Naci Topçuoğlu MYO Ölçme Değerlendirme Yönetim Sistemi",
  description: "Naci Topçuoğlu Meslek Yüksekokulu Ölçme Değerlendirme Yönetim Sistemi - Sınav değerlendirme ve çıktı analiz sistemi",
  icons: {
    icon: "/assets/ntmyo-logo.png",
    shortcut: "/assets/ntmyo-logo.png",
    apple: "/assets/ntmyo-logo.png",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
      </head>
      <body className={inter.className}>
        <ThemeProvider>
          <SidebarProvider>
            <LayoutSwitcher>{children}</LayoutSwitcher>
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


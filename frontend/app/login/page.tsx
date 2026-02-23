"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Lock, Mail, Eye, EyeOff } from "lucide-react";
import { authApi } from "@/lib/api/authApi";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error("E-posta ve şifre gereklidir");
      return;
    }
    setIsLoading(true);
    try {
      const { user } = await authApi.login(email.trim(), password);
      toast.success("Giriş başarılı");
      // Tüm rollerde ilk açılış ekranı dashboard (Genel Bakış)
      router.push("/");
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.message || "Giriş yapılamadı";
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen min-h-[100dvh] bg-[#0a294e] flex items-center justify-center px-3 sm:px-4 py-6 sm:py-10 safe-area-padding overflow-x-hidden">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 items-center min-w-0">
        {/* Web: logo yanında yazı. Mobil: en üstte logo + yazı ortalanmış */}
        <div className="text-white flex flex-col items-center text-center lg:flex-row lg:items-center lg:text-left lg:justify-center order-1 lg:order-1">
          <div className="flex flex-col items-center gap-3 lg:flex-row lg:items-center lg:gap-5 lg:flex-nowrap">
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 lg:w-28 lg:h-28 flex-shrink-0 rounded-xl overflow-hidden bg-white/10 border border-white/20 flex items-center justify-center">
              <img
                src="/assets/ntmyo-logo.png"
                alt="Naci Topçuoğlu MYO Logo"
                className="w-full h-full object-contain"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = "none";
                }}
              />
            </div>
            <div className="min-w-0 max-w-full lg:max-w-xl">
              <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold leading-tight tracking-tight break-words">
                Naci Topçuoğlu Meslek Yüksekokulu
              </h1>
              <p className="mt-1 sm:mt-2 text-base sm:text-lg lg:text-xl font-semibold text-white/95 break-words">
                Ölçme Değerlendirme Yönetim Sistemi
              </p>
            </div>
          </div>
        </div>

        {/* Form: mobilde logo/yazının hemen altında */}
        <Card className="shadow-2xl border border-gray-200 w-full max-w-full order-2 lg:order-2 overflow-hidden">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-[#0a294e]">Giriş Yap</CardTitle>
            <p className="text-sm text-gray-600">
              Kurumsal e-posta ve şifrenizle oturum açın.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                  <Mail className="h-4 w-4 text-[#0a294e]" /> E-posta
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="ornek@universite.edu.tr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 text-base"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                  <Lock className="h-4 w-4 text-[#0a294e]" /> Şifre
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 text-base pr-11"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9 text-gray-500 hover:text-[#0a294e]"
                    onClick={() => setShowPassword((p) => !p)}
                    aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm text-gray-600">
                <span className="whitespace-nowrap">Şifrenizi mi unuttunuz?</span>
                <Button
                  type="button"
                  variant="ghost"
                  className="text-[#0a294e] hover:bg-[#0a294e]/10 h-10 px-3 w-fit shrink-0"
                  onClick={() => toast.message("Lütfen sistem yöneticinizle iletişime geçin.")}
                >
                  Destek alın
                </Button>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 text-base font-semibold bg-brand-red hover:bg-brand-red-dark text-white"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Giriş yapılıyor...
                  </>
                ) : (
                  "Giriş Yap"
                )}
              </Button>

              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 p-3 text-xs text-amber-800 dark:text-amber-200 break-words min-w-0">
                <p className="font-semibold mb-1">Panelleri denemek için örnek hesaplar</p>
                <p className="mb-1">Şifre (hepsi): <strong>Test123!</strong></p>
                <ul className="space-y-0.5 list-disc list-inside break-words">
                  <li><strong>admin@test.com</strong> → Yönetici paneli</li>
                  <li><strong>bolum@test.com</strong> → Bölüm paneli</li>
                  <li><strong>ogretmen@test.com</strong> → Öğretmen paneli</li>
                </ul>
                <p className="mt-1.5 text-amber-700 dark:text-amber-300 break-words">Bu hesaplar yoksa önce: <code className="bg-amber-100 dark:bg-amber-900/50 px-1 rounded break-all inline">POST /api/auth/seed-demo</code></p>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


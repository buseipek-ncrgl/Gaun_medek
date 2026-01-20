"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Lock, Mail, ShieldCheck } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [logoError, setLogoError] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error("E-posta ve şifre gereklidir");
      return;
    }
    setIsLoading(true);
    try {
      // Buraya gerçek giriş isteği eklenebilir
      await new Promise((res) => setTimeout(res, 800));
      toast.success("Giriş başarılı");
      router.push("/dashboard/courses");
    } catch (error: any) {
      toast.error(error?.message || "Giriş yapılamadı");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a294e] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        {/* Sol panel */}
        <div className="text-white space-y-6">
          {/* Logo */}
          <div className="flex items-center gap-4">
            <div className="relative h-16 w-16 flex-shrink-0">
              {logoError ? (
                <div className="h-16 w-16 rounded-full bg-white/20 flex items-center justify-center border-2 border-white/30">
                  <span className="text-white font-bold text-xl">NT</span>
                </div>
              ) : (
                <Image 
                  src="/logo.png" 
                  alt="NTMYO Logo" 
                  width={64}
                  height={64}
                  className="object-contain"
                  onError={() => setLogoError(true)}
                />
              )}
            </div>
            <div>
              <h2 className="text-2xl font-bold">Naci Topçuoğlu</h2>
              <p className="text-lg text-white/90">Meslek Yüksekokulu</p>
            </div>
          </div>
          
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/20 bg-white/10 backdrop-blur">
            <ShieldCheck className="h-4 w-4" />
            <span className="text-sm font-semibold">Ölçme Değerlendirme Yönetim Sistemi</span>
          </div>
          <h1 className="text-4xl lg:text-5xl font-bold leading-tight">
            Eğitmenler için basit, güvenli ve hızlı sınav yönetimi.
          </h1>
          <p className="text-lg text-white/80 max-w-xl">
            ÖÇ → PÇ eşlemesi, AI destekli puanlama ve akreditasyon raporlarını tek adımda yönetin.
          </p>
          <div className="hidden lg:flex gap-4 text-white/80">
            <div className="flex-1 p-4 rounded-xl bg-white/10 border border-white/15">
              <p className="font-semibold">AI Puanlama</p>
              <p className="text-sm text-white/70">PDF yükle, otomatik kırp ve skorla.</p>
            </div>
            <div className="flex-1 p-4 rounded-xl bg-white/10 border border-white/15">
              <p className="font-semibold">MEDEK Raporları</p>
              <p className="text-sm text-white/70">ÖÇ ve PÇ başarılarını otomatik hesapla.</p>
            </div>
          </div>
        </div>

        {/* Sağ panel - form */}
        <Card className="shadow-2xl border border-gray-200">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-[#0a294e]">Giriş Yap</CardTitle>
            <p className="text-sm text-gray-600">
              NTMYO Ölçme Değerlendirme Yönetim Sistemi
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
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 text-base"
                />
              </div>

              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>Şifrenizi mi unuttunuz?</span>
                <Button
                  type="button"
                  variant="ghost"
                  className="text-[#0a294e] hover:bg-[#0a294e]/10 h-10 px-3"
                  onClick={() => toast.message("Lütfen sistem yöneticinizle iletişime geçin.")}
                >
                  Destek alın
                </Button>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 text-base font-semibold bg-[#bf1e1d] hover:bg-[#bf1e1d]/90"
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
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


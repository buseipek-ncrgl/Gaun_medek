"use client";

import { useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { OutcomeForm } from "@/components/outcomes/OutcomeForm";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api/authApi";

export default function NewOutcomePage() {
  const router = useRouter();
  useEffect(() => {
    if (authApi.getStoredUser()?.role === "teacher") router.replace("/outcomes");
  }, [router]);
  if (authApi.getStoredUser()?.role === "teacher") return null;
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="px-2">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Geri
        </Button>
        <p className="text-muted-foreground">
          Yeni bir öğrenme çıktısı (ÖÇ) ekleyin ve program çıktıları (PÇ) ile eşleştirin.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Öğrenme Çıktısı Bilgileri</CardTitle>
          <CardDescription>
            Aşağıya öğrenme çıktısı ayrıntılarını girin. <span className="text-destructive">*</span> işaretli alanlar zorunludur.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OutcomeForm mode="create" />
        </CardContent>
      </Card>
    </div>
  );
}







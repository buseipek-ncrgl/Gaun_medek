"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { OutcomeForm } from "@/components/outcomes/OutcomeForm";
import { learningOutcomeApi, type LearningOutcome } from "@/lib/api/learningOutcomeApi";
import { authApi } from "@/lib/api/authApi";
import { ArrowLeft } from "lucide-react";

export default function EditOutcomePage() {
  const params = useParams();
  const router = useRouter();
  const outcomeId = params.id as string;
  const [outcome, setOutcome] = useState<LearningOutcome | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (outcomeId) fetchOutcome();
  }, [outcomeId]);

  const fetchOutcome = async () => {
    try {
      setIsLoading(true);
      const data = await learningOutcomeApi.getById(outcomeId);
      setOutcome(data);
    } catch (error: any) {
      toast.error("Öğrenme çıktısı yüklenirken hata oluştu");
      router.push("/outcomes");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-muted-foreground">Öğrenme çıktısı ayrıntıları yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (!outcome) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="px-2">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Geri
        </Button>
        <p className="text-muted-foreground">
          Öğrenme çıktısı bilgilerini ve program çıktısı eşlemelerini güncelleyin
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Öğrenme Çıktısı Bilgileri</CardTitle>
          <CardDescription>
            Aşağıdaki öğrenme çıktısı ayrıntılarını güncelleyin. <span className="text-destructive">*</span> işaretli alanlar zorunludur.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OutcomeForm mode="edit" outcomeId={outcomeId} initialData={outcome} />
        </CardContent>
      </Card>
    </div>
  );
}







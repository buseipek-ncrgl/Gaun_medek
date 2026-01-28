"use client";

import { AIScoreUploadForm } from "@/components/scores/AIScoreUploadForm";

export default function ScoreUploadPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Toplu Puan Yükleme</h2>
        <p className="text-muted-foreground">
          JSON veya CSV formatında puan dosyası yükleyin
        </p>
      </div>

      <AIScoreUploadForm />
    </div>
  );
}


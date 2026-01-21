import apiClient from "./apiClient";

export interface ProcessingStep {
  id: string;
  label: string;
  status: "pending" | "processing" | "completed" | "error";
}

export interface AIProcessResponse {
  sessionId: string;
  studentNumber: string;
  examId: string;
  totalScore: number; // Tek genel puan (soru bazlı değil)
}

// Deprecated: Artık kullanılmıyor, totalScore kullanılıyor
export interface AIAnswer {
  questionId?: string;
  number: number;
  scoreValue: number;
  maxScore?: number;
  learningOutcomeCode?: string;
}

export const aiApi = {
  process: async (file: File): Promise<AIProcessResponse> => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await apiClient.post("/ai/process", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data.data;
  },
};


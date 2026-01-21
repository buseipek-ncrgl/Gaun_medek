import apiClient from "./apiClient";

export interface Exam {
  _id: string;
  courseId: string | { _id: string; name: string; code: string; learningOutcomes?: Array<{ code: string; description: string }> };
  examType: "midterm" | "final";
  examCode: string;
  maxScore: number; // Maksimum toplam puan (soru bazlı değil)
  learningOutcomes?: string[]; // Sınav bazlı ÖÇ eşleme (ÖÇ kodları array'i)
  createdAt?: string;
  updatedAt?: string;
}

export interface QuestionAnalysis {
  questionNumber: number;
  maxScore: number;
  averageScore: number;
  successRate: number;
  learningOutcomeCode: string | null;
  attempts: number;
}

export interface OutcomeAnalysis {
  code: string;
  description: string;
  relatedProgramOutcomes: string[];
  questionCount: number;
  success: number;
}

export interface ProgramOutcomeAnalysis {
  code: string;
  success: number;
  contributionCount: number;
}

export interface ExamAnalysisResponse {
  questionAnalysis: QuestionAnalysis[];
  learningOutcomeAnalysis: OutcomeAnalysis[];
  programOutcomeAnalysis: ProgramOutcomeAnalysis[];
  summary: { recommendations: string };
}

export interface SubmitScoreResponse {
  pngPath?: string;
  markers?: any;
  crops?: Array<{ questionNumber: number; imagePath: string }>;
  scores: Array<{ questionNumber: number; score: number; learningOutcomeCode: string | null }>;
  resultId?: string;
  totalScore?: number;
  maxTotalScore?: number;
  percentage?: number;
}

export interface BatchStartResponse {
  batchId: string;
  totalFiles: number;
  startedAt: string;
}

export interface BatchStatusItem {
  studentNumber: string | null;
  status: "success" | "failed";
  message?: string;
}

export interface BatchStatusResponse {
  batchId: string;
  totalFiles: number;
  processedCount: number;
  successCount: number;
  failedCount: number;
  startedAt: string;
  statuses: BatchStatusItem[];
}

export interface CreateExamDto {
  courseId: string;
  examType: "midterm" | "final";
  examCode: string;
  maxScore: number; // Maksimum toplam puan
  learningOutcomes?: string[]; // Sınav bazlı ÖÇ eşleme (ÖÇ kodları array'i)
}

export interface UpdateExamDto {
  examType?: "midterm" | "final";
  examCode?: string;
  maxScore?: number; // Maksimum toplam puan
  learningOutcomes?: string[]; // Sınav bazlı ÖÇ eşleme (ÖÇ kodları array'i)
}

export const examApi = {
  getAll: async (): Promise<Exam[]> => {
    // Fetch all courses and then get exams for each
    const { courseApi } = await import("./courseApi");
    const courses = await courseApi.getAll();
    const allExams: Exam[] = [];

    for (const course of courses) {
      try {
        const response = await apiClient.get(`/exams/course/${course._id}`);
        const courseExams = response.data.data;
        allExams.push(...courseExams);
      } catch (error) {
        console.error(`Failed to fetch exams for course ${course._id}`);
      }
    }

    return allExams;
  },

  getByCourse: async (courseId: string): Promise<Exam[]> => {
    if (!courseId || courseId === '[object Object]' || courseId === 'undefined' || courseId === 'null') {
      console.error('Invalid courseId provided to getByCourse:', courseId);
      return [];
    }
    try {
      const response = await apiClient.get(`/exams/course/${courseId}`);
      return response.data.data || [];
    } catch (error) {
      console.error('Error fetching exams by course:', error);
      return [];
    }
  },

  getById: async (id: string): Promise<Exam> => {
    if (!id || id === 'undefined' || id === 'null' || id === '[object Object]') {
      console.error('Invalid exam ID provided to getById:', id);
      throw new Error(`Geçersiz sınav ID: ${id}`);
    }
    try {
      const response = await apiClient.get(`/exams/${id}`);
      return response.data.data;
    } catch (error: any) {
      console.error('Error fetching exam by ID:', error);
      throw error;
    }
  },

  create: async (data: CreateExamDto): Promise<Exam> => {
    const response = await apiClient.post("/exams/create", data);
    return response.data.data;
  },

  update: async (id: string, data: UpdateExamDto): Promise<Exam> => {
    const response = await apiClient.put(`/exams/${id}`, data);
    return response.data.data;
  },

  remove: async (id: string): Promise<void> => {
    await apiClient.delete(`/exams/${id}`);
  },

  getByExamCode: async (examCode: string): Promise<Exam | null> => {
    try {
      // Fetch all exams and find by examCode
      const allExams = await examApi.getAll();
      return allExams.find((exam) => exam.examCode === examCode) || null;
    } catch (error) {
      console.error("Failed to find exam by code", error);
      return null;
    }
  },

  getAnalysis: async (examId: string): Promise<ExamAnalysisResponse> => {
    const response = await apiClient.get(`/exams/${examId}/analysis`);
    return response.data.data;
  },

  submitScore: async (
    examId: string,
    studentNumber: string,
    file: File
  ): Promise<SubmitScoreResponse> => {
    const formData = new FormData();
    formData.append("studentNumber", studentNumber);
    formData.append("file", file);
    const response = await apiClient.post(`/exams/${examId}/score`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data.data;
  },

  getResults: async (examId: string) => {
    const response = await apiClient.get(`/exams/${examId}/results`);
    return response.data.data || [];
  },

  getExamResultsByStudent: async (studentNumber: string): Promise<any[]> => {
    const response = await apiClient.get(`/exams/student/${studentNumber}/results`);
    return response.data.data || [];
  },

  startBatchScore: async (examId: string, files: File[]): Promise<BatchStartResponse> => {
    const formData = new FormData();
    files.forEach((f) => formData.append("files", f));
    const response = await apiClient.post(`/exams/${examId}/batch-score`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data.data;
  },

  getBatchStatus: async (examId: string, batchId: string): Promise<BatchStatusResponse> => {
    const response = await apiClient.get(`/exams/${examId}/batch-status`, {
      params: { batchId },
    });
    return response.data.data;
  },
};


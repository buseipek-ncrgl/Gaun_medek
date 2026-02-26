import { apiClient } from "./apiClient";

export interface StudentExamResult {
  _id: string;
  studentNumber: string;
  studentName?: string;
  examId: string;
  courseId: string;
  totalScore: number;
  maxScore: number;
  percentage: number;
  outcomePerformance: Record<string, number>;
  programOutcomePerformance: Record<string, number>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrUpdateStudentExamResultDto {
  studentNumber: string;
  examId: string;
  courseId: string;
  totalScore?: number;
  maxScore?: number;
  percentage?: number;
  outcomePerformance?: Record<string, number>;
  programOutcomePerformance?: Record<string, number>;
  /** Soru bazlı puan; gönderilirse toplam ve yüzde backend'de hesaplanır */
  questionScores?: Array<{ questionNumber: number; score: number }>;
}

export interface QuestionScoreItem {
  questionNumber: number;
  questionId?: string;
  maxScore: number;
  scoreValue: number;
}

export interface QuestionScoresResponse {
  questionScores: QuestionScoreItem[];
  totalScore: number;
  maxScore: number;
}

export const studentExamResultApi = {
  getByExam: async (examId: string): Promise<StudentExamResult[]> => {
    const response = await apiClient.get(`/exams/${examId}/results`);
    return response.data.data || [];
  },

  getByStudent: async (studentNumber: string): Promise<StudentExamResult[]> => {
    const response = await apiClient.get(`/exams/student/${studentNumber}/results`);
    return response.data.data || [];
  },

  getQuestionScores: async (examId: string, studentNumber: string): Promise<QuestionScoresResponse> => {
    const response = await apiClient.get(`/exams/${examId}/results/${encodeURIComponent(studentNumber)}/question-scores`);
    return response.data.data || { questionScores: [], totalScore: 0, maxScore: 100 };
  },

  createOrUpdate: async (data: CreateOrUpdateStudentExamResultDto): Promise<StudentExamResult> => {
    const response = await apiClient.post(`/exams/${data.examId}/manual-score`, data);
    return response.data.data;
  },
};


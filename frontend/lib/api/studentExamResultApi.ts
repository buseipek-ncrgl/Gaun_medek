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
  totalScore: number;
  maxScore: number;
  percentage: number;
  outcomePerformance: Record<string, number>;
  programOutcomePerformance: Record<string, number>;
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

  createOrUpdate: async (data: CreateOrUpdateStudentExamResultDto): Promise<StudentExamResult> => {
    const response = await apiClient.post(`/exams/${data.examId}/manual-score`, data);
    return response.data.data;
  },
};


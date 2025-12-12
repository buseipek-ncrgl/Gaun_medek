import apiClient from "./apiClient";

export interface QuestionLOPerformance {
  questionNumber: number;
  maxScore: number;
  learningOutcomeCodes: string[];
  studentCount: number;
  averageScore: number;
  successRate: number;
}

export interface LOAchievement {
  code: string;
  description: string;
  relatedProgramOutcomes: string[];
  studentCount: number;
  averageScore: number;
  totalMaxScore: number;
  achievedPercentage: number;
}

// For student-level achievements (used in StudentComparisonChart and HeatmapChart)
export interface StudentLOAchievement {
  learningOutcome: {
    _id: string;
    code: string;
    description: string;
  };
  achievedPercentage: number;
  totalScoreEarned: number;
  totalMaxScore: number;
}

export interface POAchievement {
  code: string;
  achievedPercentage: number;
  contributingLOs: Array<{
    code: string;
    achievedPercentage: number;
  }>;
  contributingLOCount: number;
}

/**
 * Get Question → ÖÇ performance for an exam
 */
export const getQuestionLOPerformance = async (
  examId: string
): Promise<QuestionLOPerformance[]> => {
  const response = await apiClient.get(
    `/assessments/exam/${examId}/question-lo-performance`
  );
  return response.data.data || [];
};

/**
 * Get ÖÇ achievement for a course (all students)
 */
export const getLOAchievement = async (
  courseId: string
): Promise<LOAchievement[]> => {
  const response = await apiClient.get(
    `/assessments/course/${courseId}/lo-achievement`
  );
  return response.data.data || [];
};

/**
 * Get PÇ achievement derived from ÖÇ performance
 */
export const getPOAchievement = async (
  courseId: string
): Promise<POAchievement[]> => {
  const response = await apiClient.get(
    `/assessments/course/${courseId}/po-achievement`
  );
  return response.data.data || [];
};

/**
 * Get student achievements per student for a course
 */
export const getStudentAchievements = async (
  courseId: string
): Promise<Record<string, StudentLOAchievement[]>> => {
  const response = await apiClient.get(
    `/assessments/course/${courseId}/student-achievements`
  );
  return response.data.data || {};
};


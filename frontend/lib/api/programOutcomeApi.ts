import apiClient from "./apiClient";

export interface ProgramOutcome {
  _id?: string;
  code: string;
  description: string;
}

export interface DepartmentProgramOutcomes {
  departmentId: string;
  programOutcomes: ProgramOutcome[];
}

export const programOutcomeApi = {
  // Get all program outcomes for a department
  getByDepartment: async (departmentId: string): Promise<ProgramOutcome[]> => {
    const response = await apiClient.get(`/program-outcomes/${departmentId}`);
    return response.data.data || [];
  },

  // Add a program outcome to a department
  add: async (departmentId: string, po: ProgramOutcome): Promise<ProgramOutcome[]> => {
    const response = await apiClient.post(`/program-outcomes/${departmentId}/add`, po);
    return response.data.data || [];
  },

  // Update all program outcomes for a department
  update: async (departmentId: string, programOutcomes: ProgramOutcome[]): Promise<ProgramOutcome[]> => {
    const response = await apiClient.put(`/program-outcomes/${departmentId}/update`, {
      programOutcomes,
    });
    return response.data.data || [];
  },

  // Delete a specific program outcome from a department
  delete: async (departmentId: string, code: string): Promise<ProgramOutcome[]> => {
    const response = await apiClient.delete(`/program-outcomes/${departmentId}/delete`, {
      data: { code },
    });
    return response.data.data || [];
  },

  // Legacy: Get all program outcomes (deprecated)
  getAll: async (): Promise<any[]> => {
    try {
      const response = await apiClient.get("/program-outcomes");
      return response.data.data || [];
    } catch (error) {
      console.warn("Legacy program outcomes endpoint failed, returning empty array");
      return [];
    }
  },
};

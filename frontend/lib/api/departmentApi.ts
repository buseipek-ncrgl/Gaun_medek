import apiClient from "./apiClient";

import { Program } from "./programApi";

export interface Department {
  _id: string;
  code?: string;
  name: string;
  nameEn?: string;
  programs?: Program[] | string[];
  programOutcomes?: Array<{
    code: string;
    description: string;
  }>;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateDepartmentDto {
  code?: string;
  name: string;
  nameEn?: string;
}

export interface UpdateDepartmentDto {
  code?: string;
  name?: string;
  nameEn?: string;
}

export const departmentApi = {
  getAll: async (): Promise<Department[]> => {
    const response = await apiClient.get("/departments");
    return response.data.data || [];
  },

  getById: async (id: string): Promise<Department> => {
    const list = await departmentApi.getAll();
    const found = list.find((d) => d._id === id);
    if (!found) throw new Error("Bölüm bulunamadı");
    return found;
  },

  create: async (data: CreateDepartmentDto): Promise<Department> => {
    const response = await apiClient.post("/departments", data);
    return response.data.data;
  },

  update: async (id: string, data: UpdateDepartmentDto): Promise<Department> => {
    const response = await apiClient.put(`/departments/${id}`, data);
    return response.data.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/departments/${id}`);
  },

  seed: async (): Promise<void> => {
    await apiClient.post("/departments/seed");
  },
};


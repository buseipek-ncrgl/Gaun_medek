import apiClient from "./apiClient";

const AUTH_TOKEN_KEY = "medek_token";
const AUTH_USER_KEY = "medek_user";

export interface AuthUser {
  _id: string;
  email: string;
  name?: string;
  role: "super_admin" | "department_head" | "teacher";
  departmentId?: string;
  assignedCourseIds?: string[];
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

export const authApi = {
  login: async (email: string, password: string): Promise<LoginResponse> => {
    const response = await apiClient.post("/auth/login", { email, password });
    const data = response.data?.data;
    if (data?.token && data?.user) {
      if (typeof window !== "undefined") {
        localStorage.setItem(AUTH_TOKEN_KEY, data.token);
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
      }
      return data;
    }
    throw new Error("Geçersiz yanıt");
  },

  me: async (): Promise<AuthUser | null> => {
    try {
      const response = await apiClient.get("/auth/me");
      const user = response.data?.data;
      if (user && typeof window !== "undefined") {
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
      }
      return user || null;
    } catch {
      return null;
    }
  },

  logout: (): void => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(AUTH_USER_KEY);
    }
  },

  getStoredUser: (): AuthUser | null => {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(AUTH_USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  },

  getStoredToken: (): string | null => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(AUTH_TOKEN_KEY);
  },

  isAuthenticated: (): boolean => {
    return !!authApi.getStoredToken();
  },

  /** Profil bilgisini sunucudan al (bölüm, atanmış dersler populate) */
  getMe: async (): Promise<AuthUser & { departmentId?: { _id: string; name?: string; code?: string } | string; assignedCourseIds?: { _id: string; name?: string; code?: string }[] | string[] } | null> => {
    try {
      const response = await apiClient.get("/auth/me");
      const user = response.data?.data;
      if (user && typeof window !== "undefined") {
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
      }
      return user || null;
    } catch {
      return null;
    }
  },

  /** Kendi profilini güncelle (ad soyad, e-posta, şifre) */
  updateProfile: async (data: { name?: string; email?: string; password?: string }): Promise<AuthUser> => {
    const response = await apiClient.patch("/auth/me", data);
    const user = response.data?.data;
    if (user && typeof window !== "undefined") {
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    }
    return user;
  },

  /**
   * Öğretmen için filtre seçenekleri: atandığı bölümler ve programlar.
   * getMe() ile alınan assignedProgramIds (department populate) kullanır.
   */
  getTeacherFilterOptions: async (): Promise<{
    departments: { _id: string; name?: string; code?: string }[];
    programs: { _id: string; name?: string; code?: string; department?: { _id: string; name?: string; code?: string } }[];
  } | null> => {
    const user = await authApi.getMe();
    if (!user || (user as AuthUser).role !== "teacher") return null;
    const u = user as AuthUser & { assignedProgramIds?: { _id: string; name?: string; code?: string; department?: { _id: string; name?: string; code?: string } }[] };
    const list = u.assignedProgramIds && Array.isArray(u.assignedProgramIds) ? u.assignedProgramIds : [];
    const programs = list.map((p) => (typeof p === "object" && p !== null ? p : { _id: String(p), name: "", code: "" }));
    const depMap = new Map<string, { _id: string; name?: string; code?: string }>();
    for (const p of programs) {
      const d = (p as { department?: { _id: string; name?: string; code?: string } }).department;
      if (d && typeof d === "object" && d._id) depMap.set(d._id, d);
    }
    const departments = Array.from(depMap.values());
    return { departments, programs };
  },

  /** Süper admin: tüm kullanıcıları listele (departmentId populated olabilir) */
  getUsers: async (): Promise<(AuthUser & { departmentId?: string | { _id: string; name?: string; code?: string } })[]> => {
    const response = await apiClient.get("/auth/users");
    return response.data.data || [];
  },

  /** Süper admin: yeni kullanıcı oluştur */
  createUser: async (data: {
    email: string;
    password: string;
    name?: string;
    role?: string;
    departmentId?: string | null;
    assignedProgramIds?: string[];
    assignedCourseIds?: string[];
  }): Promise<any> => {
    const response = await apiClient.post("/auth/users", data);
    return response.data.data;
  },

  /** Süper admin: kullanıcı sil */
  deleteUser: async (userId: string): Promise<void> => {
    await apiClient.delete(`/auth/users/${userId}`);
  },

  /** Süper admin: kullanıcı güncelle (rol, bölüm, program, atanmış dersler) */
  updateUser: async (
    userId: string,
    data: {
      name?: string;
      email?: string;
      role?: string;
      departmentId?: string | null;
      assignedProgramIds?: string[];
      assignedCourseIds?: string[];
    }
  ): Promise<any> => {
    const response = await apiClient.patch(`/auth/users/${userId}`, data);
    return response.data.data;
  },
};

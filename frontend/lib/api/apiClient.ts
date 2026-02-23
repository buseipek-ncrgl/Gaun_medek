import axios from "axios";

// Get raw API URL from environment or use default
const raw = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

// Ensure baseURL always ends with /api
const baseAPIURL = raw.endsWith("/api") ? raw : `${raw.replace(/\/$/, "")}/api`;

console.log("🔧 API Client Configuration:");
console.log("   Raw URL:", raw);
console.log("   Base URL:", baseAPIURL);

export const apiClient = axios.create({
  baseURL: baseAPIURL,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Accept": "application/json; charset=utf-8",
  },
  responseType: "json",
});

// Request interceptor: token varsa Authorization header ekle
apiClient.interceptors.request.use(
  (config) => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("medek_token");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Handle network errors (backend not running)
    if (error.code === "ERR_NETWORK" || error.message === "Network Error") {
      const errorMessage = "Backend sunucusuna bağlanılamıyor. Lütfen backend'in çalıştığından emin olun.";
      console.error("Network Error:", errorMessage);
      // Create a custom error with user-friendly message
      const networkError = new Error(errorMessage);
      (networkError as any).isNetworkError = true;
      (networkError as any).originalError = error;
      return Promise.reject(networkError);
    }

    // Handle common HTTP errors
    if (error.response?.status === 401) {
      // Handle unauthorized
      console.error("Unauthorized access");
    } else if (error.response?.status === 500) {
      // Handle server errors
      console.error("Server error:", error.response.data);
    }
    return Promise.reject(error);
  }
);

export default apiClient;


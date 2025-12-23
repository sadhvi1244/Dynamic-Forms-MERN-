import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_URL || "https://dynamic-forms-backend-wine.vercel.app";

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 10000,
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    console.error("Request Error:", error);
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    console.error("API Error:", {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      message: error.message,
      data: error.response?.data,
    });

    if (error.response) {
      return Promise.reject({
        status: error.response.status,
        message:
          error.response.data?.error ||
          error.response.data?.message ||
          "Server error occurred",
        data: error.response.data,
      });
    } else if (error.request) {
      return Promise.reject({
        status: 0,
        message: "Network error. Please check your connection.",
      });
    } else {
      return Promise.reject(error);
    }
  }
);

// API functions
export const apiService = {
  // Schema operations
  getSchema: () => api.get("/api/schema"),

  updateSchema: (schema) => api.post("/api/schema/update", schema),

  // Health check
  checkHealth: () => api.get("/health"),

  // Entity operations - simplified
  getEntities: (entity, params = {}) => api.get(`/api/${entity}`, { params }),

  getEntity: (entity, id) => api.get(`/api/${entity}/${id}`),

  createEntity: (entity, data) => api.post(`/api/${entity}`, data),

  updateEntity: (entity, id, data) => api.put(`/api/${entity}/${id}`, data),

  deleteEntity: (entity, id) => api.delete(`/api/${entity}/${id}`),
};

export default api;

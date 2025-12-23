import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_URL || "https://dynamic-forms-backend-wine.vercel.app";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 15000,
});

// Request interceptor
api.interceptors.request.use(
  (config) => config,
  (error) => Promise.reject(error)
);

// Response interceptor
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response) {
      return Promise.reject({
        status: error.response.status,
        message:
          error.response.data?.error ||
          error.response.data?.message ||
          "Server error",
        data: error.response.data,
      });
    }

    return Promise.reject({
      status: 0,
      message: "Network error / Backend unreachable",
    });
  }
);

// ================= API METHODS =================
export const apiService = {
  // Health
  checkHealth: () => api.get("/health"),

  // Users (ENTITY)
  getEntities: (entity, params = {}) => api.get(`/api/${entity}`, { params }),

  getEntity: (entity, id) => api.get(`/api/${entity}/${id}`),

  createEntity: (entity, data) => api.post(`/api/${entity}`, data),

  updateEntity: (entity, id, data) => api.put(`/api/${entity}/${id}`, data),

  deleteEntity: (entity, id) => api.delete(`/api/${entity}/${id}`),
};

export default api;

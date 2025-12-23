import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  "https://dynamic-forms-backend-wine.vercel.app";

console.log("🌐 API Base URL:", API_BASE_URL);

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30000, // Increased timeout for Vercel cold starts
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    console.log(
      `📤 API Request: ${config.method?.toUpperCase()} ${config.url}`
    );
    return config;
  },
  (error) => {
    console.error("❌ Request Error:", error);
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    console.log(`📥 API Response: ${response.config.url}`, response.data);
    return response.data;
  },
  (error) => {
    console.error("❌ API Error:", {
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
        message: "Network error. Backend may be unavailable.",
      });
    } else {
      return Promise.reject({
        status: -1,
        message: error.message || "Unknown error occurred",
      });
    }
  }
);

// API Service Functions
export const apiService = {
  // Schema operations
  getSchema: async () => {
    try {
      return await api.get("/api/schema");
    } catch (error) {
      console.error("Failed to get schema:", error);
      throw error;
    }
  },

  updateSchema: async (schema) => {
    try {
      return await api.post("/api/schema/update", schema);
    } catch (error) {
      console.error("Failed to update schema:", error);
      throw error;
    }
  },

  // Health check
  checkHealth: async () => {
    try {
      return await api.get("/health");
    } catch (error) {
      console.error("Health check failed:", error);
      throw error;
    }
  },

  // Entity operations
  getEntities: async (entity, params = {}) => {
    try {
      console.log(`🔍 Fetching ${entity} with params:`, params);
      return await api.get(`/api/${entity}`, { params });
    } catch (error) {
      console.error(`Failed to get ${entity}:`, error);
      throw error;
    }
  },

  // Search entities (alias for getEntities)
  searchEntities: async (entity, params = {}) => {
    try {
      console.log(`🔎 Searching ${entity} with params:`, params);
      return await api.get(`/api/${entity}`, { params });
    } catch (error) {
      console.error(`Failed to search ${entity}:`, error);
      throw error;
    }
  },

  getEntity: async (entity, id) => {
    try {
      return await api.get(`/api/${entity}/${id}`);
    } catch (error) {
      console.error(`Failed to get ${entity}/${id}:`, error);
      throw error;
    }
  },

  createEntity: async (entity, data) => {
    try {
      console.log(`➕ Creating ${entity}:`, data);
      return await api.post(`/api/${entity}`, data);
    } catch (error) {
      console.error(`Failed to create ${entity}:`, error);
      throw error;
    }
  },

  updateEntity: async (entity, id, data) => {
    try {
      console.log(`✏️ Updating ${entity}/${id}:`, data);
      return await api.put(`/api/${entity}/${id}`, data);
    } catch (error) {
      console.error(`Failed to update ${entity}/${id}:`, error);
      throw error;
    }
  },

  deleteEntity: async (entity, id) => {
    try {
      console.log(`🗑️ Deleting ${entity}/${id}`);
      return await api.delete(`/api/${entity}/${id}`);
    } catch (error) {
      console.error(`Failed to delete ${entity}/${id}:`, error);
      throw error;
    }
  },

  // Bulk operations
  bulkCreate: async (entity, data) => {
    try {
      return await api.post(`/api/${entity}/bulk`, {
        operation: "insertMany",
        data,
      });
    } catch (error) {
      console.error(`Failed bulk create for ${entity}:`, error);
      throw error;
    }
  },

  bulkDelete: async (entity, filter) => {
    try {
      return await api.post(`/api/${entity}/bulk`, {
        operation: "deleteMany",
        data: filter,
      });
    } catch (error) {
      console.error(`Failed bulk delete for ${entity}:`, error);
      throw error;
    }
  },
};

export default api;

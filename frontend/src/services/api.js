import React, { useState, useEffect } from "react";
import {
  Search,
  ChevronDown,
  RefreshCw,
  Download,
  Settings,
  Plus,
  Database,
  CheckCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { apiService } from "../services/api";
import { DEFAULT_SCHEMA } from "../constants/schema";
import SchemaManager from "./SchemaManager";
import DataTable from "./DataTable";
import EntityForm from "./EntityForm";

const DynamicFormSystem = () => {
  const [schema, setSchema] = useState(() => {
    const stored = localStorage.getItem("dynamicSchema");
    return stored ? JSON.parse(stored) : DEFAULT_SCHEMA;
  });
  const [selectedEntity, setSelectedEntity] = useState("");
  const [data, setData] = useState([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSchemaEditorOpen, setIsSchemaEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [backendStatus, setBackendStatus] = useState({
    connected: false,
    message: "",
  });
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
  });

  const itemsPerPage = 10;

  useEffect(() => {
    checkBackendConnection();
    if (schema?.record) {
      const entities = Object.keys(schema.record);
      if (entities.length > 0 && !selectedEntity) {
        setSelectedEntity(entities[0]);
      }
    }
  }, []);

  useEffect(() => {
    if (selectedEntity) {
      fetchData();
    }
  }, [selectedEntity, currentPage, searchTerm]);

  const checkBackendConnection = async () => {
    try {
      const health = await apiService.checkHealth();
      setBackendStatus({
        connected: true,
        message: "Backend connected",
        entities: health.entities || [],
      });
      toast.success("✅ Backend connected successfully");
    } catch (error) {
      setBackendStatus({
        connected: false,
        message: "Backend disconnected",
        error: error.message,
      });
      toast.warning("⚠️ Backend not available. Using local storage.");
    }
  };

  const fetchData = async () => {
    if (!selectedEntity) return;

    setIsLoading(true);
    try {
      const params = {
        page: currentPage,
        limit: itemsPerPage,
        search: searchTerm,
      };

      // FIXED: Using getEntities instead of searchEntities
      const response = await apiService.getEntities(selectedEntity, params);

      if (response.success) {
        setData(response.data || []);
        setPagination(
          response.pagination || {
            total: response.data?.length || 0,
            page: currentPage,
            limit: itemsPerPage,
            totalPages: 1,
          }
        );
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      // Fallback to localStorage
      const stored = localStorage.getItem(`data_${selectedEntity}`);
      if (stored) {
        const localData = JSON.parse(stored);
        const filtered = localData.filter((item) => {
          const searchLower = searchTerm.toLowerCase();
          return Object.values(item).some((val) =>
            String(val).toLowerCase().includes(searchLower)
          );
        });
        setData(filtered);
        setPagination({
          total: filtered.length,
          page: currentPage,
          limit: itemsPerPage,
          totalPages: Math.ceil(filtered.length / itemsPerPage),
        });
        toast.warning("Using local data (backend unavailable)");
      } else {
        setData([]);
        toast.error("No data available");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!selectedEntity) return;

    try {
      const dataToSend = { ...formData };
      const config = getCurrentConfig();

      // Add required fields if missing
      if (config?.backend?.schema) {
        Object.entries(config.backend.schema).forEach(
          ([fieldName, fieldConfig]) => {
            if (fieldConfig.required && !dataToSend[fieldName]) {
              if (fieldConfig.default !== undefined) {
                dataToSend[fieldName] = fieldConfig.default;
              } else if (fieldConfig.type === "String") {
                dataToSend[fieldName] = "";
              } else if (fieldConfig.type === "Number") {
                dataToSend[fieldName] = 0;
              } else if (fieldConfig.type === "Boolean") {
                dataToSend[fieldName] = false;
              }
            }
          }
        );
      }

      if (editingItem) {
        const response = await apiService.updateEntity(
          selectedEntity,
          editingItem._id || editingItem.id,
          dataToSend
        );
        if (response.success) {
          toast.success(`${selectedEntity.slice(0, -1)} updated successfully!`);
          resetForm();
          fetchData();
        }
      } else {
        const response = await apiService.createEntity(
          selectedEntity,
          dataToSend
        );
        if (response.success) {
          toast.success(`${selectedEntity.slice(0, -1)} created successfully!`);
          resetForm();
          fetchData();
        }
      }
    } catch (error) {
      console.error("Error saving data:", error);
      if (error.data?.details) {
        toast.error(`Validation error: ${error.data.details.join(", ")}`);
      } else {
        toast.error(error.message || "Failed to save data");
      }
    }
  };

  const resetForm = () => {
    setFormData({});
    setEditingItem(null);
    setIsFormOpen(false);
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData(item);
    setIsFormOpen(true);
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this item?")) return;

    try {
      const response = await apiService.deleteEntity(selectedEntity, id);
      if (response.success) {
        toast.success("Record deleted successfully!");
        fetchData();
      }
    } catch (error) {
      console.error("Error deleting data:", error);
      toast.error("Failed to delete record");
    }
  };

  const openSchemaEditor = () => {
    setIsSchemaEditorOpen(true);
  };

  const downloadSchema = () => {
    const blob = new Blob([JSON.stringify(schema, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `schema-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Schema exported successfully!");
  };

  const syncFromBackend = async () => {
    try {
      setIsLoading(true);
      const response = await apiService.getSchema();
      if (response.success) {
        setSchema(response.data);
        localStorage.setItem("dynamicSchema", JSON.stringify(response.data));
        const entities = Object.keys(response.data.record);
        if (entities.length > 0) {
          setSelectedEntity(entities[0]);
        }
        toast.success("✅ Synced with backend successfully!");
        checkBackendConnection();
      }
    } catch (error) {
      console.error("Error syncing schema:", error);
      toast.error("❌ Failed to sync with backend");
    } finally {
      setIsLoading(false);
    }
  };

  const resetToDefault = () => {
    if (confirm("Reset to default schema? This will clear all data.")) {
      setSchema(DEFAULT_SCHEMA);
      localStorage.setItem("dynamicSchema", JSON.stringify(DEFAULT_SCHEMA));
      setSelectedEntity("users");
      setData([]);
      toast.success("Reset to default schema!");
    }
  };

  const getCurrentConfig = () => {
    return schema?.record?.[selectedEntity] || null;
  };

  const config = getCurrentConfig();
  const entities = schema?.record ? Object.keys(schema.record) : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Toaster for notifications */}
      <div className="fixed top-4 right-4 z-50">
        {backendStatus.connected ? (
          <div className="bg-green-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg">
            <CheckCircle size={18} />
            <span>Backend Connected</span>
          </div>
        ) : (
          <div className="bg-red-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg">
            <AlertCircle size={18} />
            <span>Backend Disconnected</span>
          </div>
        )}
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Header Section */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
                Dynamic Form System
              </h1>
              <p className="text-gray-600">
                Upload JSON to update both Frontend & Backend automatically!
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={syncFromBackend}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 bg-cyan-100 text-cyan-700 rounded-lg hover:bg-cyan-200 transition-all disabled:opacity-50"
              >
                <RefreshCw
                  size={18}
                  className={isLoading ? "animate-spin" : ""}
                />
                Sync Backend
              </button>
              <button
                onClick={downloadSchema}
                className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-all"
              >
                <Download size={18} />
                Export Schema
              </button>
              <button
                onClick={openSchemaEditor}
                className="flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-all"
              >
                <Settings size={18} />
                Edit Schema
              </button>
            </div>
          </div>
        </div>

        {/* Entity Selector */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            Select Entity
          </label>
          <div className="relative">
            <select
              value={selectedEntity}
              onChange={(e) => {
                setSelectedEntity(e.target.value);
                setCurrentPage(1);
                setSearchTerm("");
              }}
              className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all appearance-none bg-white font-medium"
            >
              {entities.map((entity) => (
                <option key={entity} value={entity}>
                  {entity.charAt(0).toUpperCase() + entity.slice(1)}
                </option>
              ))}
            </select>
            <ChevronDown
              className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400"
              size={20}
            />
          </div>
        </div>

        {config && (
          <>
            {/* Data Table Section */}
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden mb-8">
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <h2 className="text-2xl font-bold text-white">
                    {selectedEntity.charAt(0).toUpperCase() +
                      selectedEntity.slice(1)}{" "}
                    Management
                  </h2>
                  <button
                    onClick={() => setIsFormOpen(true)}
                    className="flex items-center gap-2 px-6 py-3 bg-white text-blue-600 rounded-xl font-semibold hover:bg-blue-50 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                  >
                    <Plus size={20} />
                    Add New
                  </button>
                </div>
              </div>

              {/* Search Bar */}
              <div className="p-6 border-b border-gray-200">
                <div className="relative">
                  <Search
                    className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400"
                    size={20}
                  />
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {/* Loading State */}
              {isLoading ? (
                <div className="p-12 flex items-center justify-center">
                  <Loader2 className="animate-spin text-blue-500" size={32} />
                </div>
              ) : (
                <>
                  {/* Data Table */}
                  <DataTable
                    config={config}
                    data={data}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />

                  {/* Pagination */}
                  {pagination.totalPages > 1 && (
                    <div className="px-6 py-4 bg-gray-50 flex items-center justify-between">
                      <p className="text-sm text-gray-600">
                        Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                        {Math.min(currentPage * itemsPerPage, pagination.total)}{" "}
                        of {pagination.total} entries
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            setCurrentPage((p) => Math.max(1, p - 1))
                          }
                          disabled={currentPage === 1}
                          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Previous
                        </button>
                        <button
                          onClick={() =>
                            setCurrentPage((p) =>
                              Math.min(pagination.totalPages, p + 1)
                            )
                          }
                          disabled={currentPage === pagination.totalPages}
                          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}

        {/* Form Modal */}
        {isFormOpen && config && (
          <EntityForm
            config={config}
            formData={formData}
            editingItem={editingItem}
            selectedEntity={selectedEntity}
            onFormSubmit={handleFormSubmit}
            onInputChange={setFormData}
            onClose={resetForm}
          />
        )}

        {/* Schema Editor Modal */}
        {isSchemaEditorOpen && (
          <SchemaManager
            schema={schema}
            onClose={() => setIsSchemaEditorOpen(false)}
            onUpdate={setSchema}
            onReset={resetToDefault}
            setSelectedEntity={setSelectedEntity}
            showNotification={(message, type) => {
              if (type === "success") toast.success(message);
              else if (type === "error") toast.error(message);
              else if (type === "warning") toast.warning(message);
              else toast(message);
            }}
            checkBackendConnection={checkBackendConnection}
          />
        )}
      </div>
    </div>
  );
};

export default DynamicFormSystem;

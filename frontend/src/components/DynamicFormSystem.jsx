import React, { useState, useEffect } from "react";
import SchemaManager from "./SchemaManager";
import DataTable from "./DataTable";
import EntityForm from "./EntityForm";
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
  Upload,
  Wifi,
  WifiOff,
  Filter,
  BarChart3,
  Users,
} from "lucide-react";
import { apiService } from "../services/api";
import { notificationService } from "../services/notification";
import { DEFAULT_SCHEMA } from "../constants/schema";

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
      notificationService.success("✅ Backend connected successfully");
    } catch (error) {
      setBackendStatus({
        connected: false,
        message: "Backend disconnected",
        error: error.message,
      });
      notificationService.warning(
        "⚠️ Backend not available. Using local storage."
      );
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
        sortBy: "createdAt",
        sortOrder: "desc",
      };

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
        notificationService.warning("Using local data");
      } else {
        setData([]);
        notificationService.error("No data available");
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
      const requiredFields = Object.entries(config.backend.schema || {})
        .filter(([_, fieldConfig]) => fieldConfig.required)
        .map(([fieldName]) => fieldName);

      requiredFields.forEach((field) => {
        if (!dataToSend[field] && field.includes("Id")) {
          dataToSend[field] = `${selectedEntity}_${Date.now()}`;
        }
      });

      if (editingItem) {
        const response = await apiService.updateEntity(
          selectedEntity,
          editingItem.id || editingItem._id,
          dataToSend
        );
        if (response.success) {
          notificationService.success(
            `${selectedEntity.slice(0, -1)} updated!`
          );
          resetForm();
          fetchData();
        }
      } else {
        const response = await apiService.createEntity(
          selectedEntity,
          dataToSend
        );
        if (response.success) {
          notificationService.success(
            `${selectedEntity.slice(0, -1)} created!`
          );
          resetForm();
          fetchData();
        }
      }
    } catch (error) {
      console.error("Error saving data:", error);
      if (error.data?.details) {
        notificationService.error(
          `Validation error: ${error.data.details.join(", ")}`
        );
      } else {
        notificationService.error(error.message || "Failed to save data");
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
        notificationService.success("Record deleted!");
        fetchData();
      }
    } catch (error) {
      console.error("Error deleting data:", error);
      const stored = localStorage.getItem(`data_${selectedEntity}`);
      if (stored) {
        const existingData = JSON.parse(stored);
        const updatedData = existingData.filter((item) => item.id !== id);
        localStorage.setItem(
          `data_${selectedEntity}`,
          JSON.stringify(updatedData)
        );
        notificationService.warning("Deleted locally");
        fetchData();
      }
    }
  };

  const openSchemaEditor = () => setIsSchemaEditorOpen(true);

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
    notificationService.success("Schema exported!");
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
        notificationService.success("✅ Synced with backend!");
        checkBackendConnection();
      }
    } catch (error) {
      console.error("Error syncing schema:", error);
      notificationService.error("❌ Failed to sync");
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
      notificationService.info("Reset to default schema!");
    }
  };

  const getCurrentConfig = () => {
    return schema?.record?.[selectedEntity] || null;
  };

  const config = getCurrentConfig();
  const entities = schema?.record ? Object.keys(schema.record) : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 text-white shadow-xl">
        <div className="container mx-auto px-6 py-8">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Database className="text-blue-200" size={28} />
                <h1 className="text-3xl font-bold tracking-tight">
                  Dynamic Form System
                </h1>
              </div>
              <p className="text-blue-100 max-w-2xl">
                Upload JSON schema to automatically update both Frontend &
                Backend interfaces. Manage your data dynamically with a
                responsive, user-friendly interface.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={syncFromBackend}
                disabled={isLoading}
                className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-xl border border-white/20 transition-all disabled:opacity-50"
              >
                <RefreshCw
                  size={18}
                  className={isLoading ? "animate-spin" : ""}
                />
                {isLoading ? "Syncing..." : "Sync Backend"}
              </button>
              <button
                onClick={downloadSchema}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 rounded-xl transition-colors"
              >
                <Download size={18} />
                Export Schema
              </button>
              <button
                onClick={openSchemaEditor}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 rounded-xl transition-colors"
              >
                <Settings size={18} />
                Schema Editor
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-8 -mt-6">
        {/* Status & Entity Selection Card */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Connection Status */}
            <div
              className={`p-5 rounded-xl border ${
                backendStatus.connected
                  ? "border-green-200 bg-green-50"
                  : "border-red-200 bg-red-50"
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  className={`p-2 rounded-full ${
                    backendStatus.connected ? "bg-green-100" : "bg-red-100"
                  }`}
                >
                  {backendStatus.connected ? (
                    <Wifi className="text-green-600" size={20} />
                  ) : (
                    <WifiOff className="text-red-600" size={20} />
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800">
                    Backend Status
                  </h3>
                  <p
                    className={`text-sm font-medium ${
                      backendStatus.connected
                        ? "text-green-700"
                        : "text-red-700"
                    }`}
                  >
                    {backendStatus.connected ? "Connected" : "Disconnected"}
                  </p>
                </div>
              </div>
              <div className="text-sm text-gray-600">
                {backendStatus.connected
                  ? `${backendStatus.entities?.length || 0} entities available`
                  : "Using local storage only"}
              </div>
            </div>

            {/* Entity Selection */}
            <div className="lg:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                <div className="flex items-center gap-2">
                  <Users size={16} />
                  Select Entity
                </div>
              </label>
              <div className="relative">
                <select
                  value={selectedEntity}
                  onChange={(e) => {
                    setSelectedEntity(e.target.value);
                    setCurrentPage(1);
                    setSearchTerm("");
                  }}
                  className="w-full px-5 py-3 pr-12 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all appearance-none font-medium text-gray-800"
                >
                  {entities.map((entity) => (
                    <option key={entity} value={entity}>
                      {entity.charAt(0).toUpperCase() + entity.slice(1)}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500"
                  size={20}
                />
              </div>
              {selectedEntity && (
                <div className="mt-3 text-sm text-gray-600">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      <BarChart3 size={14} />
                      {data.length} records
                    </span>
                    {config?.backend?.schema && (
                      <span className="flex items-center gap-1">
                        <Filter size={14} />
                        {Object.keys(config.backend.schema).length} fields
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {config && (
          <div className="space-y-8">
            {/* Data Management Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">
                  {selectedEntity.charAt(0).toUpperCase() +
                    selectedEntity.slice(1)}{" "}
                  Management
                </h2>
                <p className="text-gray-600 mt-1">
                  View, edit, and manage your {selectedEntity} data
                </p>
              </div>
              <div className="flex items-center gap-4">
                {/* Search */}
                <div className="relative">
                  <Search
                    className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400"
                    size={20}
                  />
                  <input
                    type="text"
                    placeholder="Search records..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-12 pr-4 py-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all w-64"
                  />
                </div>
                <button
                  onClick={() => setIsFormOpen(true)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all hover:scale-[1.02]"
                >
                  <Plus size={18} />
                  Add New
                </button>
              </div>
            </div>

            {/* Data Table Card */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-200">
              {/* Loading State */}
              {isLoading ? (
                <div className="p-16 flex flex-col items-center justify-center">
                  <Loader2
                    className="animate-spin text-blue-500 mb-4"
                    size={40}
                  />
                  <p className="text-gray-600">Loading data...</p>
                </div>
              ) : (
                <>
                  {/* Data Table */}
                  <div className="overflow-x-auto">
                    <DataTable
                      config={config}
                      data={data}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  </div>

                  {/* Table Footer */}
                  <div className="border-t border-gray-200 bg-gray-50 px-6 py-4">
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                      <p className="text-sm text-gray-600">
                        Showing{" "}
                        <span className="font-semibold">
                          {(currentPage - 1) * itemsPerPage + 1}
                        </span>{" "}
                        to{" "}
                        <span className="font-semibold">
                          {Math.min(
                            currentPage * itemsPerPage,
                            pagination.total
                          )}
                        </span>{" "}
                        of{" "}
                        <span className="font-semibold">
                          {pagination.total}
                        </span>{" "}
                        entries
                      </p>

                      {pagination.totalPages > 1 && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              setCurrentPage((p) => Math.max(1, p - 1))
                            }
                            disabled={currentPage === 1}
                            className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            Previous
                          </button>
                          <span className="px-4 py-2 text-sm font-medium text-gray-700">
                            Page {currentPage} of {pagination.totalPages}
                          </span>
                          <button
                            onClick={() =>
                              setCurrentPage((p) =>
                                Math.min(pagination.totalPages, p + 1)
                              )
                            }
                            disabled={currentPage === pagination.totalPages}
                            className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            Next
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!config && selectedEntity && (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Database className="text-gray-400" size={28} />
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">
                No Schema Configured
              </h3>
              <p className="text-gray-600 mb-6">
                The selected entity doesn't have a schema configuration. Please
                edit the schema or select a different entity.
              </p>
              <button
                onClick={openSchemaEditor}
                className="px-5 py-2.5 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors"
              >
                Edit Schema
              </button>
            </div>
          </div>
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
            showNotification={notificationService}
            checkBackendConnection={checkBackendConnection}
          />
        )}
      </div>
    </div>
  );
};

export default DynamicFormSystem;

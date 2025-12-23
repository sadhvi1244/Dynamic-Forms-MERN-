import React, { useState, useEffect, useCallback } from "react";
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
  ExternalLink,
  Server,
  Database as DbIcon,
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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [backendStatus, setBackendStatus] = useState({
    connected: false,
    message: "",
    entities: [],
  });
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
  });

  const itemsPerPage = 10;

  // Check backend connection
  const checkBackendConnection = useCallback(async () => {
    try {
      const health = await apiService.checkHealth();
      setBackendStatus({
        connected: true,
        message: "Backend connected",
        entities: health.entities || [],
      });
    } catch (error) {
      setBackendStatus({
        connected: false,
        message: "Backend disconnected",
        error: error.message,
        entities: [],
      });
    }
  }, []);

  useEffect(() => {
    checkBackendConnection();
  }, [checkBackendConnection]);

  // Auto-select first entity when schema changes
  useEffect(() => {
    if (schema?.record) {
      const entities = Object.keys(schema.record);
      if (entities.length > 0 && !selectedEntity) {
        setSelectedEntity(entities[0]);
      }
    }
  }, [schema, selectedEntity]);

  // Fetch data when entity, page, or search changes
  const fetchData = useCallback(async () => {
    if (!selectedEntity) {
      setData([]);
      return;
    }

    setIsLoading(true);
    try {
      const params = {
        page: currentPage,
        limit: itemsPerPage,
        search: searchTerm,
      };

      const response = await apiService.getEntities(selectedEntity, params);

      if (response.success) {
        setData(response.data || []);
        setPagination(
          response.pagination || {
            total: response.data?.length || 0,
            page: currentPage,
            limit: itemsPerPage,
            totalPages: Math.ceil((response.data?.length || 0) / itemsPerPage),
          }
        );
      } else {
        toast.error(response.error || "Failed to fetch data");
        setData([]);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error(error.message || "Failed to fetch data");
      setData([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedEntity, currentPage, searchTerm, itemsPerPage]);

  // Auto-refresh data when dependencies change
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Get current entity config
  const getCurrentConfig = () => {
    return schema?.record?.[selectedEntity] || null;
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!selectedEntity) return;

    setIsRefreshing(true);
    try {
      // Prepare data
      const dataToSend = { ...formData };
      const config = getCurrentConfig();

      // Validate required fields
      if (config?.backend?.schema) {
        const requiredFields = Object.entries(config.backend.schema)
          .filter(([_, fieldConfig]) => fieldConfig.required)
          .map(([fieldName]) => fieldName);

        const missingFields = requiredFields.filter(
          (field) => dataToSend[field] === undefined || dataToSend[field] === ""
        );

        if (missingFields.length > 0) {
          toast.error(`Missing required fields: ${missingFields.join(", ")}`);
          setIsRefreshing(false);
          return;
        }
      }

      let response;
      if (editingItem) {
        // Update existing item
        response = await apiService.updateEntity(
          selectedEntity,
          editingItem._id || editingItem.id,
          dataToSend
        );
        if (response.success) {
          toast.success("✅ Record updated successfully!");
        }
      } else {
        // Create new item
        response = await apiService.createEntity(selectedEntity, dataToSend);
        if (response.success) {
          toast.success("✅ Record created successfully!");
        }
      }

      // Reset form and refresh data
      resetForm();
      fetchData(); // IMPORTANT: Refresh data after create/update
    } catch (error) {
      console.error("Error saving data:", error);
      if (error.data?.details) {
        toast.error(`Validation error: ${error.data.details.join(", ")}`);
      } else if (error.data?.error) {
        toast.error(error.data.error);
      } else {
        toast.error(error.message || "Failed to save data");
      }
    } finally {
      setIsRefreshing(false);
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
    if (
      !confirm(
        `Are you sure you want to delete this ${selectedEntity.slice(0, -1)}?`
      )
    )
      return;

    try {
      const response = await apiService.deleteEntity(selectedEntity, id);
      if (response.success) {
        toast.success("✅ Record deleted successfully!");
        fetchData(); // Refresh data after delete
      }
    } catch (error) {
      console.error("Error deleting data:", error);
      toast.error(error.message || "Failed to delete record");
    }
  };

  const openSchemaEditor = () => {
    setIsSchemaEditorOpen(true);
  };

  const downloadSchema = () => {
    try {
      const blob = new Blob([JSON.stringify(schema, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `schema-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("✅ Schema exported successfully!");
    } catch (error) {
      toast.error("Failed to export schema");
    }
  };

  const syncFromBackend = async () => {
    setIsRefreshing(true);
    try {
      const response = await apiService.getSchema();
      if (response.success) {
        setSchema(response.data);
        localStorage.setItem("dynamicSchema", JSON.stringify(response.data));

        // Auto-select first entity
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
      setIsRefreshing(false);
    }
  };

  const resetToDefault = () => {
    if (
      confirm("Reset to default schema? This will clear your current schema.")
    ) {
      setSchema(DEFAULT_SCHEMA);
      localStorage.setItem("dynamicSchema", JSON.stringify(DEFAULT_SCHEMA));
      setSelectedEntity("users");
      setData([]);
      toast.success("✅ Reset to default schema!");
    }
  };

  const config = getCurrentConfig();
  const entities = schema?.record ? Object.keys(schema.record) : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50">
      {/* Connection Status Badge */}
      <div className="fixed top-4 right-4 z-50">
        <div
          className={`flex items-center gap-2 px-4 py-2 rounded-lg shadow-lg ${
            backendStatus.connected
              ? "bg-gradient-to-r from-green-500 to-emerald-600"
              : "bg-gradient-to-r from-red-500 to-rose-600"
          } text-white`}
        >
          {backendStatus.connected ? (
            <CheckCircle size={18} />
          ) : (
            <AlertCircle size={18} />
          )}
          <span className="font-medium">
            {backendStatus.connected ? "Connected" : "Disconnected"}
          </span>
          {backendStatus.connected && backendStatus.entities.length > 0 && (
            <span className="text-sm opacity-90 ml-2">
              {backendStatus.entities.length} entities
            </span>
          )}
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-8">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <DbIcon className="text-blue-500" size={32} />
                <div>
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    Dynamic Form System
                  </h1>
                  <p className="text-gray-600 mt-1">
                    Upload any JSON schema and watch it generate forms & APIs
                    automatically!
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={syncFromBackend}
                disabled={isRefreshing}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50"
              >
                <RefreshCw
                  size={18}
                  className={isRefreshing ? "animate-spin" : ""}
                />
                {isRefreshing ? "Syncing..." : "Sync Schema"}
              </button>

              <button
                onClick={downloadSchema}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl font-medium hover:shadow-lg transition-all"
              >
                <Download size={18} />
                Export
              </button>

              <button
                onClick={openSchemaEditor}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-xl font-medium hover:shadow-lg transition-all"
              >
                <Settings size={18} />
                Edit Schema
              </button>
            </div>
          </div>
        </div>

        {/* Entity Selector */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <label className="block text-lg font-semibold text-gray-800">
              <div className="flex items-center gap-2">
                <Database size={20} className="text-blue-500" />
                Select Entity
              </div>
              <p className="text-sm text-gray-500 mt-1 font-normal">
                Choose an entity to manage its data
              </p>
            </label>

            {selectedEntity && config && (
              <div className="text-sm text-gray-600">
                <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-3 py-1 rounded-full">
                  <Server size={14} />
                  {config.route}
                </span>
              </div>
            )}
          </div>

          <div className="relative">
            <select
              value={selectedEntity}
              onChange={(e) => {
                setSelectedEntity(e.target.value);
                setCurrentPage(1);
                setSearchTerm("");
              }}
              className="w-full px-5 py-3 pr-12 bg-gradient-to-r from-gray-50 to-white border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all appearance-none font-medium text-gray-800 text-lg"
            >
              {entities.length === 0 ? (
                <option value="">No entities available</option>
              ) : (
                entities.map((entity) => (
                  <option key={entity} value={entity}>
                    {entity.charAt(0).toUpperCase() + entity.slice(1)}
                  </option>
                ))
              )}
            </select>
            <ChevronDown
              className="absolute right-5 top-1/2 transform -translate-y-1/2 text-gray-500"
              size={24}
            />
          </div>

          {selectedEntity && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-sm text-blue-700 font-medium">Records</div>
                <div className="text-2xl font-bold text-blue-900">
                  {data.length}
                </div>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <div className="text-sm text-purple-700 font-medium">
                  Fields
                </div>
                <div className="text-2xl font-bold text-purple-900">
                  {config?.frontend?.fields?.length || 0}
                </div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="text-sm text-green-700 font-medium">
                  Columns
                </div>
                <div className="text-2xl font-bold text-green-900">
                  {config?.frontend?.columns?.length || 0}
                </div>
              </div>
            </div>
          )}
        </div>

        {config && (
          <div className="space-y-6">
            {/* Action Bar */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">
                    {selectedEntity.charAt(0).toUpperCase() +
                      selectedEntity.slice(1)}
                    <span className="text-gray-500 text-lg ml-2">
                      Management
                    </span>
                  </h2>
                  <p className="text-gray-600 mt-1">
                    Manage your {selectedEntity} data with full CRUD operations
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
                      placeholder={`Search ${selectedEntity}...`}
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="pl-12 pr-4 py-2.5 w-64 bg-white border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    />
                  </div>

                  <button
                    onClick={() => setIsFormOpen(true)}
                    disabled={isLoading}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-xl font-semibold hover:shadow-lg hover:scale-[1.02] transition-all disabled:opacity-50"
                  >
                    <Plus size={18} />
                    Add New
                  </button>
                </div>
              </div>
            </div>

            {/* Data Table */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              {isLoading ? (
                <div className="p-16 flex flex-col items-center justify-center">
                  <Loader2
                    className="animate-spin text-blue-500 mb-4"
                    size={48}
                  />
                  <p className="text-gray-600 text-lg">Loading data...</p>
                  <p className="text-gray-400 text-sm mt-2">
                    Fetching from {config.route}
                  </p>
                </div>
              ) : (
                <>
                  <DataTable
                    config={config}
                    data={data}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />

                  {/* Pagination */}
                  {pagination.totalPages > 1 && (
                    <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div className="text-sm text-gray-600">
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
                          records
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              setCurrentPage((p) => Math.max(1, p - 1))
                            }
                            disabled={currentPage === 1 || isLoading}
                            className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            Previous
                          </button>

                          <div className="flex items-center gap-1">
                            {Array.from(
                              { length: Math.min(5, pagination.totalPages) },
                              (_, i) => {
                                const pageNum = i + 1;
                                return (
                                  <button
                                    key={pageNum}
                                    onClick={() => setCurrentPage(pageNum)}
                                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                      currentPage === pageNum
                                        ? "bg-blue-600 text-white"
                                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                    } transition-colors`}
                                  >
                                    {pageNum}
                                  </button>
                                );
                              }
                            )}
                          </div>

                          <button
                            onClick={() =>
                              setCurrentPage((p) =>
                                Math.min(pagination.totalPages, p + 1)
                              )
                            }
                            disabled={
                              currentPage === pagination.totalPages || isLoading
                            }
                            className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!config && selectedEntity && (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <div className="max-w-md mx-auto">
              <div className="w-20 h-20 bg-gradient-to-r from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="text-gray-400" size={32} />
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-3">
                Schema Not Configured
              </h3>
              <p className="text-gray-600 mb-8">
                The selected entity doesn't have a valid schema configuration.
                Please edit the schema to add proper configuration for "
                {selectedEntity}".
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={openSchemaEditor}
                  className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-medium hover:shadow-lg transition-all"
                >
                  Edit Schema
                </button>
                <button
                  onClick={() => setSelectedEntity("")}
                  className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                >
                  Select Another
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

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
          isLoading={isRefreshing}
        />
      )}

      {/* Schema Editor Modal */}
      {isSchemaEditorOpen && (
        <SchemaManager
          schema={schema}
          onClose={() => setIsSchemaEditorOpen(false)}
          onUpdate={(newSchema) => {
            setSchema(newSchema);
            localStorage.setItem("dynamicSchema", JSON.stringify(newSchema));

            // Auto-select first entity after schema update
            const entities = Object.keys(newSchema.record || {});
            if (entities.length > 0) {
              setSelectedEntity(entities[0]);
            }

            toast.success("✅ Schema updated successfully!");
            checkBackendConnection();
          }}
          onReset={() => {
            resetToDefault();
            setIsSchemaEditorOpen(false);
          }}
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
  );
};

export default DynamicFormSystem;

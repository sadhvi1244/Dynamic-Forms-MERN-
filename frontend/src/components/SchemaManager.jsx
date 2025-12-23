import React, { useState } from "react";
import {
  Save,
  X,
  Upload,
  Code,
  RefreshCw,
  Database,
  AlertCircle,
} from "lucide-react";
import { apiService } from "../services/api";

const SchemaManager = ({
  schema,
  onClose,
  onUpdate,
  onReset,
  setSelectedEntity,
  showNotification,
  checkBackendConnection,
}) => {
  const [jsonInput, setJsonInput] = useState(JSON.stringify(schema, null, 2));
  const [jsonError, setJsonError] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [backendAvailable, setBackendAvailable] = useState(true);

  const handleSchemaUpdate = async () => {
    setIsUpdating(true);
    setJsonError("");

    try {
      const parsed = JSON.parse(jsonInput);

      if (!parsed.record || typeof parsed.record !== "object") {
        throw new Error(
          'Invalid schema format. Must contain a "record" object.'
        );
      }

      // Validate each entity
      for (const [entityName, config] of Object.entries(parsed.record)) {
        if (!config.route) {
          throw new Error(`Missing route for entity: ${entityName}`);
        }
        if (!config.backend || !config.backend.schema) {
          throw new Error(`Missing backend schema for entity: ${entityName}`);
        }
        if (!config.frontend || !config.frontend.fields) {
          throw new Error(`Missing frontend fields for entity: ${entityName}`);
        }
      }

      // Update backend schema
      try {
        const response = await apiService.updateSchema(parsed);

        if (response.success) {
          showNotification.success("✅ Backend schema updated successfully!");
          setBackendAvailable(true);
        }
      } catch (backendError) {
        setBackendAvailable(false);
        showNotification.warning(
          "⚠️ Backend unavailable, updating frontend only"
        );
      }

      // Update frontend schema
      onUpdate(parsed);
      localStorage.setItem("dynamicSchema", JSON.stringify(parsed));

      const entities = Object.keys(parsed.record);
      if (entities.length > 0) {
        setSelectedEntity(entities[0]);
      }

      onClose();
      showNotification.success(
        "🎉 Schema updated! Frontend regenerated successfully!"
      );

      // Refresh backend connection status
      checkBackendConnection();
    } catch (error) {
      setJsonError(`❌ Error: ${error.message}`);
      showNotification.error(`Failed to update schema: ${error.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target.result);
          setJsonInput(JSON.stringify(parsed, null, 2));
          setJsonError("");
          showNotification.info(
            "File loaded successfully! Review and click Apply."
          );
        } catch (error) {
          setJsonError(`❌ Error reading file: ${error.message}`);
          showNotification.error("Failed to read JSON file");
        }
      };
      reader.readAsText(file);
    }
  };

  const testBackendConnection = async () => {
    try {
      setIsUpdating(true);
      const response = await apiService.checkHealth();
      setBackendAvailable(true);
      showNotification.success("✅ Backend is connected and healthy!");
    } catch (error) {
      setBackendAvailable(false);
      showNotification.error("❌ Backend connection failed");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Code size={28} className="text-white" />
            <h3 className="text-2xl font-bold text-white">
              JSON Schema Editor
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Backend Status */}
          <div
            className={`flex items-center gap-2 px-4 py-3 rounded-lg ${
              backendAvailable
                ? "bg-green-50 text-green-800 border border-green-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            <Database size={18} />
            <span className="font-medium">
              {backendAvailable ? "Backend Connected" : "Backend Disconnected"}
            </span>
            <button
              onClick={testBackendConnection}
              disabled={isUpdating}
              className="ml-auto text-sm px-3 py-1 rounded bg-white hover:bg-opacity-90 transition-colors"
            >
              {isUpdating ? "Testing..." : "Test Connection"}
            </button>
          </div>

          {/* File Upload & Reset */}
          <div className="flex gap-3 mb-4">
            <label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors cursor-pointer">
              <Upload size={18} />
              Upload JSON File
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
            <button
              onClick={onReset}
              className="flex items-center gap-2 px-4 py-3 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors"
            >
              Reset to Default
            </button>
          </div>

          {/* JSON Editor */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-semibold text-gray-700">
                Paste or Edit Your JSON Schema
              </label>
              <span className="text-xs text-gray-500">
                {jsonInput.length} characters
              </span>
            </div>
            <textarea
              value={jsonInput}
              onChange={(e) => {
                setJsonInput(e.target.value);
                setJsonError("");
              }}
              className="w-full h-96 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all font-mono text-sm"
              placeholder="Paste your JSON schema here..."
              spellCheck="false"
            />
          </div>

          {/* Error Display */}
          {jsonError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2 text-red-700 mb-2">
                <AlertCircle size={18} />
                <span className="font-medium">Validation Error</span>
              </div>
              <p className="text-red-600 text-sm">{jsonError}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={handleSchemaUpdate}
              disabled={isUpdating}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all transform hover:-translate-y-0.5 disabled:opacity-50"
            >
              {isUpdating ? (
                <RefreshCw size={20} className="animate-spin" />
              ) : (
                <Save size={20} />
              )}
              {isUpdating ? "Updating..." : "Apply Schema Changes"}
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>

          {/* Help Section */}
          <div className="mt-6 space-y-4">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-semibold text-blue-900 mb-2">
                🚀 How It Works:
              </h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>✅ Upload JSON file or paste schema directly</li>
                <li>✅ Frontend forms & tables regenerate automatically</li>
                <li>✅ Backend routes & models update in real-time</li>
                <li>✅ All entity relationships maintained automatically</li>
              </ul>
            </div>

            <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <h4 className="font-semibold text-purple-900 mb-2">
                📋 Schema Structure:
              </h4>
              <pre className="text-xs text-purple-800 overflow-x-auto">
                {`{
  "record": {
    "entityName": {
      "route": "/api/entity",
      "backend": {
        "schema": {
          "field": { "type": "String", "required": true }
        }
      },
      "frontend": {
        "fields": [
          { "name": "field", "label": "Field", "type": "text" }
        ],
        "columns": [
          { "header": "Field", "accessor": "field" }
        ]
      }
    }
  }
}`}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SchemaManager;

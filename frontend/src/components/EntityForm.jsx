import React from "react";
import { Save, X } from "lucide-react";
import FormField from "./FormField";

const EntityForm = ({
  config,
  formData,
  editingItem,
  selectedEntity,
  onFormSubmit,
  onInputChange,
  onClose,
}) => {
  const handleInputChange = (fieldName, value) => {
    onInputChange((prev) => ({
      ...prev,
      [fieldName]: value,
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-8 py-6">
          <div>
            <h3 className="text-2xl font-bold text-gray-900">
              {editingItem ? "Edit" : "Add New"} {selectedEntity.slice(0, -1)}
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Fill in the details below
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition"
          >
            <X size={22} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={onFormSubmit} className="px-8 py-6 space-y-5">
          {config.frontend.fields.map((field) => (
            <div key={field.name}>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                {field.label}
                {field.required && <span className="ml-1 text-red-500">*</span>}
              </label>

              <FormField
                field={field}
                value={formData[field.name] || ""}
                onChange={handleInputChange}
              />
            </div>
          ))}

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row gap-4 pt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
            >
              Cancel
            </button>

            <button
              type="submit"
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-3 text-sm font-semibold text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
            >
              <Save size={18} />
              {editingItem ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EntityForm;

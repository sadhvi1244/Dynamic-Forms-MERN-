import React from "react";
import {
  Edit2,
  Trash2,
  Eye,
  Copy,
  MoreVertical,
  CheckCircle,
  XCircle,
  User,
  Calendar,
  Hash,
} from "lucide-react";

const DataTable = ({ config, data, onEdit, onDelete }) => {
  // Format cell content based on type
  const formatCellValue = (value, col) => {
    if (value === null || value === undefined || value === "") return "-";

    // Handle boolean values
    if (typeof value === "boolean") {
      return (
        <span
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
            value ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
          }`}
        >
          {value ? <CheckCircle size={12} /> : <XCircle size={12} />}
          {value ? "Yes" : "No"}
        </span>
      );
    }

    // Handle dates
    if (col.type === "date" && value) {
      return new Date(value).toLocaleDateString();
    }

    // Handle long text (truncate)
    if (typeof value === "string" && value.length > 50) {
      return (
        <span title={value} className="truncate max-w-xs">
          {value.substring(0, 50)}...
        </span>
      );
    }

    // Handle numbers with commas
    if (typeof value === "number" && col.type !== "id") {
      return value.toLocaleString();
    }

    // Handle IDs
    if (col.type === "id") {
      return (
        <span className="inline-flex items-center gap-1 text-gray-500 font-mono text-xs">
          <Hash size={12} />
          {value.toString().substring(0, 8)}...
        </span>
      );
    }

    return value;
  };

  // Get column icon based on field name
  const getColumnIcon = (fieldName) => {
    const field = fieldName.toLowerCase();
    if (field.includes("name") || field.includes("user"))
      return <User size={14} />;
    if (field.includes("date") || field.includes("time"))
      return <Calendar size={14} />;
    if (field.includes("id")) return <Hash size={14} />;
    if (field.includes("email")) return "@";
    if (field.includes("status"))
      return <div className="w-2 h-2 rounded-full bg-blue-500" />;
    return null;
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
            <tr>
              {config.frontend.columns.map((col, idx) => (
                <th
                  key={idx}
                  className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap"
                >
                  <div className="flex items-center gap-2">
                    {getColumnIcon(col.accessor)}
                    {col.header}
                  </div>
                </th>
              ))}
              <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={config.frontend.columns.length + 1}
                  className="px-6 py-16 text-center"
                >
                  <div className="flex flex-col items-center justify-center gap-3">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                      <User className="text-gray-400" size={24} />
                    </div>
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-1">
                        No records found
                      </h3>
                      <p className="text-gray-500 max-w-md">
                        {config.frontend.emptyStateMessage ||
                          "No data available. Click 'Add New' to create your first entry."}
                      </p>
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((item, index) => (
                <tr
                  key={item.id || index}
                  className={`group hover:bg-blue-50/50 transition-all duration-200 ${
                    index % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                  }`}
                >
                  {config.frontend.columns.map((col, colIndex) => (
                    <td
                      key={colIndex}
                      className="px-6 py-4 text-sm font-medium text-gray-900 first:font-semibold"
                    >
                      <div className="flex items-center gap-2">
                        {colIndex === 0 && (
                          <div className="w-2 h-2 rounded-full bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}
                        {formatCellValue(item[col.accessor], col)}
                      </div>
                    </td>
                  ))}
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => onEdit(item)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-all duration-200"
                        title="Edit"
                      >
                        <Edit2 size={14} />
                        <span className="hidden sm:inline">Edit</span>
                      </button>
                      <button
                        onClick={() => {
                          if (
                            window.confirm(
                              `Are you sure you want to delete this ${
                                config.frontend.entityName || "record"
                              }?`
                            )
                          ) {
                            onDelete(item.id);
                          }
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-all duration-200"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                        <span className="hidden sm:inline">Delete</span>
                      </button>
                      <div className="relative group/more">
                        <button className="inline-flex items-center justify-center w-8 h-8 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                          <MoreVertical size={16} />
                        </button>
                        <div className="absolute right-0 top-full mt-1 w-32 bg-white rounded-lg shadow-lg border border-gray-200 py-1 opacity-0 invisible group-hover/more:opacity-100 group-hover/more:visible transition-all duration-200 z-10">
                          <button className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                            <Eye size={14} />
                            View Details
                          </button>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(
                                JSON.stringify(item, null, 2)
                              );
                              // You can add a toast notification here
                            }}
                            className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                          >
                            <Copy size={14} />
                            Copy Data
                          </button>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Table Footer */}
      {data.length > 0 && (
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div className="flex items-center gap-4">
              <span className="font-medium">
                Showing <span className="text-gray-900">{data.length}</span>{" "}
                records
              </span>
              {config.frontend.tableSize === "large" && (
                <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded">
                  Large Dataset
                </span>
              )}
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span className="text-xs">Active</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-gray-300"></div>
                <span className="text-xs">Inactive</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataTable;

import React, { useState } from "react";
import {
  Calendar,
  ChevronDown,
  Eye,
  EyeOff,
  Info,
  AlertCircle,
  Check,
  User,
  Mail,
  Lock,
  Phone,
  Globe,
  Hash,
  FileText,
  DollarSign,
  Percent,
} from "lucide-react";

const FormField = ({
  field,
  value,
  onChange,
  onBlur,
  hasError,
  className = "",
  ...props
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const handleChange = (e) => {
    const newValue =
      field.type === "checkbox" ? e.target.checked : e.target.value;
    onChange(field.name, newValue);
  };

  const getFieldIcon = () => {
    const iconProps = { className: "w-5 h-5 text-gray-400" };
    switch (field.type) {
      case "email":
        return <Mail {...iconProps} />;
      case "password":
        return <Lock {...iconProps} />;
      case "tel":
        return <Phone {...iconProps} />;
      case "url":
        return <Globe {...iconProps} />;
      case "number":
        if (
          field.name?.toLowerCase().includes("price") ||
          field.name?.toLowerCase().includes("amount")
        )
          return <DollarSign {...iconProps} />;
        if (
          field.name?.toLowerCase().includes("percent") ||
          field.name?.toLowerCase().includes("rate")
        )
          return <Percent {...iconProps} />;
        return <Hash {...iconProps} />;
      case "date":
        return <Calendar {...iconProps} />;
      case "textarea":
        return <FileText {...iconProps} />;
      default:
        return <User {...iconProps} />;
    }
  };

  const getInputType = () => {
    if (field.type === "password" && showPassword) return "text";
    return field.type || "text";
  };

  const baseInputClasses = `
    w-full px-4 py-3 pr-12 
    border rounded-xl 
    bg-white
    text-gray-900
    placeholder-gray-400
    transition-all duration-200
    focus:outline-none focus:ring-2 focus:ring-offset-1
    disabled:opacity-50 disabled:cursor-not-allowed
    ${
      hasError
        ? "border-red-300 focus:border-red-500 focus:ring-red-500/30"
        : "border-gray-300 focus:border-blue-500 focus:ring-blue-500/30"
    }
    ${isFocused && !hasError ? "shadow-sm shadow-blue-100" : ""}
    ${className}
  `;

  const renderField = () => {
    switch (field.type) {
      case "textarea":
        return (
          <div className="relative">
            <textarea
              value={value || ""}
              onChange={handleChange}
              onFocus={() => setIsFocused(true)}
              onBlur={(e) => {
                setIsFocused(false);
                onBlur?.(e);
              }}
              required={field.required}
              rows={field.rows || 4}
              className={`${baseInputClasses} resize-y min-h-[100px]`}
              placeholder={
                field.placeholder || `Enter ${field.label.toLowerCase()}...`
              }
              maxLength={field.maxLength}
            />
            {field.maxLength && (
              <div className="absolute bottom-2 right-2 text-xs text-gray-400 bg-white/80 px-2 py-1 rounded">
                {value?.length || 0}/{field.maxLength}
              </div>
            )}
          </div>
        );

      case "dropdown":
        return (
          <div className="relative">
            <select
              value={value || ""}
              onChange={handleChange}
              onFocus={() => setIsFocused(true)}
              onBlur={(e) => {
                setIsFocused(false);
                onBlur?.(e);
              }}
              required={field.required}
              className={`${baseInputClasses} appearance-none cursor-pointer`}
            >
              <option value="" disabled hidden>
                {field.placeholder || `Select ${field.label.toLowerCase()}...`}
              </option>
              {field.options?.map((opt) => (
                <option key={opt.value || opt} value={opt.value || opt}>
                  {opt.label || opt}
                </option>
              ))}
            </select>
            <ChevronDown
              className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none"
              size={20}
            />
          </div>
        );

      case "checkbox":
        return (
          <div className="flex items-center gap-3">
            <div
              className={`relative w-10 h-6 rounded-full transition-colors duration-200 ${
                value ? "bg-blue-500" : "bg-gray-300"
              }`}
            >
              <button
                type="button"
                onClick={() => onChange(field.name, !value)}
                className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-md transform transition-transform duration-200 ${
                  value ? "translate-x-5" : "translate-x-1"
                }`}
              />
            </div>
            <span className="text-sm text-gray-700 font-medium">
              {field.label}
            </span>
            {field.description && <Info className="w-4 h-4 text-gray-400" />}
          </div>
        );

      case "radio":
        return (
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700 mb-2">
              {field.label}
            </p>
            <div className="flex flex-wrap gap-4">
              {field.options?.map((option) => (
                <label
                  key={option.value}
                  className="flex items-center gap-2 cursor-pointer group"
                >
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                      value === option.value
                        ? "border-blue-500"
                        : "border-gray-300 group-hover:border-blue-300"
                    }`}
                  >
                    {value === option.value && (
                      <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    )}
                  </div>
                  <span className="text-gray-700 group-hover:text-gray-900">
                    {option.label}
                  </span>
                </label>
              ))}
            </div>
          </div>
        );

      case "date":
        return (
          <div className="relative">
            <input
              type="date"
              value={value || ""}
              onChange={handleChange}
              onFocus={() => setIsFocused(true)}
              onBlur={(e) => {
                setIsFocused(false);
                onBlur?.(e);
              }}
              required={field.required}
              className={`${baseInputClasses} cursor-text`}
            />
            <Calendar
              className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none"
              size={20}
            />
          </div>
        );

      case "number":
        return (
          <div className="relative">
            <input
              type="number"
              value={value || ""}
              onChange={handleChange}
              onFocus={() => setIsFocused(true)}
              onBlur={(e) => {
                setIsFocused(false);
                onBlur?.(e);
              }}
              required={field.required}
              min={field.min}
              max={field.max}
              step={field.step}
              className={`${baseInputClasses} [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
              placeholder={
                field.placeholder || `Enter ${field.label.toLowerCase()}...`
              }
            />
            <div className="absolute right-4 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
              {getFieldIcon()}
              {field.unit && (
                <span className="text-sm text-gray-500">{field.unit}</span>
              )}
            </div>
          </div>
        );

      case "password":
        return (
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={value || ""}
              onChange={handleChange}
              onFocus={() => setIsFocused(true)}
              onBlur={(e) => {
                setIsFocused(false);
                onBlur?.(e);
              }}
              required={field.required}
              className={`${baseInputClasses} tracking-wider`}
              placeholder={
                field.placeholder || `Enter ${field.label.toLowerCase()}...`
              }
              minLength={field.minLength}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
            {field.minLength && value && (
              <div
                className={`absolute -bottom-6 right-0 text-xs ${
                  value.length >= field.minLength
                    ? "text-green-600"
                    : "text-amber-600"
                }`}
              >
                {value.length}/{field.minLength}
              </div>
            )}
          </div>
        );

      case "range":
        return (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">{field.label}</span>
              <span className="text-sm font-semibold text-blue-600">
                {value || field.min || 0}
              </span>
            </div>
            <input
              type="range"
              value={value || field.min || 0}
              onChange={handleChange}
              min={field.min}
              max={field.max}
              step={field.step || 1}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500"
            />
            <div className="flex justify-between text-xs text-gray-400">
              <span>{field.min || 0}</span>
              <span>{field.max || 100}</span>
            </div>
          </div>
        );

      default:
        return (
          <div className="relative">
            <input
              type={getInputType()}
              value={value || ""}
              onChange={handleChange}
              onFocus={() => setIsFocused(true)}
              onBlur={(e) => {
                setIsFocused(false);
                onBlur?.(e);
              }}
              required={field.required}
              className={baseInputClasses}
              placeholder={
                field.placeholder || `Enter ${field.label.toLowerCase()}...`
              }
              maxLength={field.maxLength}
              pattern={field.pattern}
            />
            <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
              {getFieldIcon()}
            </div>
          </div>
        );
    }
  };

  return (
    <div className="space-y-1.5">
      {renderField()}

      {/* Field hint/description */}
      {field.description && (
        <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
          <Info className="w-3 h-3" />
          {field.description}
        </p>
      )}

      {/* Validation message */}
      {hasError && field.errorMessage && (
        <p className="text-xs text-red-600 flex items-center gap-1 mt-1 animate-pulse">
          <AlertCircle className="w-3 h-3" />
          {field.errorMessage}
        </p>
      )}

      {/* Success state indicator */}
      {!hasError &&
        value &&
        field.type !== "checkbox" &&
        field.type !== "radio" && (
          <div className="absolute right-3 top-3.5">
            <Check className="w-4 h-4 text-green-500" />
          </div>
        )}
    </div>
  );
};

export default FormField;

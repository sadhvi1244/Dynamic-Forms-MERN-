import mongoose from "mongoose";

/**
 * Creates a dynamic Mongoose model based on schema definition
 * @param {string} entityName - Name of the entity
 * @param {object} schemaDefinition - Backend schema definition
 * @returns {mongoose.Model} - Mongoose model
 */
export const createDynamicModel = (entityName, schemaDefinition) => {
  const modelName = entityName.charAt(0).toUpperCase() + entityName.slice(1);

  // Remove existing model if it exists (for hot reloading)
  if (mongoose.models[modelName]) {
    delete mongoose.models[modelName];
  }

  // Create Mongoose Schema fields
  const mongooseSchema = {};

  for (const [fieldName, fieldConfig] of Object.entries(
    schemaDefinition.schema
  )) {
    const fieldDef = {};

    // Type mapping from string to Mongoose types
    switch (fieldConfig.type) {
      case "String":
        fieldDef.type = String;
        break;
      case "Number":
        fieldDef.type = Number;
        break;
      case "Boolean":
        fieldDef.type = Boolean;
        break;
      case "Date":
        fieldDef.type = Date;
        break;
      case "Array":
        fieldDef.type = Array;
        break;
      case "Object":
        fieldDef.type = Object;
        break;
      case "Mixed":
        fieldDef.type = mongoose.Schema.Types.Mixed;
        break;
      case "ObjectId":
        fieldDef.type = mongoose.Schema.Types.ObjectId;
        break;
      default:
        fieldDef.type = String;
    }

    // Apply additional field properties
    if (fieldConfig.required !== undefined)
      fieldDef.required = fieldConfig.required;
    if (fieldConfig.unique !== undefined) fieldDef.unique = fieldConfig.unique;
    if (fieldConfig.index !== undefined) fieldDef.index = fieldConfig.index;
    if (fieldConfig.sparse !== undefined) fieldDef.sparse = fieldConfig.sparse;
    if (fieldConfig.trim !== undefined) fieldDef.trim = fieldConfig.trim;
    if (fieldConfig.lowercase !== undefined)
      fieldDef.lowercase = fieldConfig.lowercase;
    if (fieldConfig.uppercase !== undefined)
      fieldDef.uppercase = fieldConfig.uppercase;
    if (fieldConfig.min !== undefined) fieldDef.min = fieldConfig.min;
    if (fieldConfig.max !== undefined) fieldDef.max = fieldConfig.max;
    if (fieldConfig.enum !== undefined) fieldDef.enum = fieldConfig.enum;
    if (fieldConfig.default !== undefined)
      fieldDef.default = fieldConfig.default;

    // Handle special default values
    if (fieldDef.default === "Date.now") {
      fieldDef.default = Date.now;
    }
    if (fieldDef.default === "true") fieldDef.default = true;
    if (fieldDef.default === "false") fieldDef.default = false;

    mongooseSchema[fieldName] = fieldDef;
  }

  // Create schema with options
  const schemaOptions = schemaDefinition.options || {};
  const schema = new mongoose.Schema(mongooseSchema, {
    timestamps:
      schemaOptions.timestamps !== undefined ? schemaOptions.timestamps : true,
    strict: schemaOptions.strict !== undefined ? schemaOptions.strict : false,
    collection: modelName.toLowerCase() + "s",
  });

  // Add indexes
  schema.index({ createdAt: -1 });
  schema.index({ updatedAt: -1 });

  // Add virtual id field
  schema.virtual("id").get(function () {
    return this._id ? this._id.toString() : null;
  });

  // Ensure virtuals are included in JSON
  schema.set("toJSON", {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  });

  schema.set("toObject", {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  });

  // Create and return the model
  const model = mongoose.model(modelName, schema);

  console.log(`📦 Model created: ${modelName}`);

  return model;
};

export default { createDynamicModel };

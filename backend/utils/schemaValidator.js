/**
 * Utility functions for schema generation and validation
 */

export const validateSchema = (schema) => {
  const errors = [];
  const warnings = [];

  if (!schema || typeof schema !== "object") {
    errors.push("Schema must be an object");
    return { valid: false, errors, warnings };
  }

  if (!schema.record || typeof schema.record !== "object") {
    errors.push('Schema must contain a "record" object');
    return { valid: false, errors, warnings };
  }

  if (Object.keys(schema.record).length === 0) {
    warnings.push("Schema has no entities defined");
  }

  for (const [entityName, config] of Object.entries(schema.record)) {
    if (!config.route) {
      errors.push(`Missing "route" for entity: ${entityName}`);
    } else if (!config.route.startsWith("/")) {
      errors.push(`Route must start with "/" for entity: ${entityName}`);
    }

    if (!config.backend || typeof config.backend !== "object") {
      errors.push(`Missing "backend" configuration for entity: ${entityName}`);
    } else {
      if (!config.backend.schema || typeof config.backend.schema !== "object") {
        errors.push(`Missing "backend.schema" for entity: ${entityName}`);
      }
    }

    if (!config.frontend || typeof config.frontend !== "object") {
      warnings.push(
        `Missing "frontend" configuration for entity: ${entityName}`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
};

export default { validateSchema };

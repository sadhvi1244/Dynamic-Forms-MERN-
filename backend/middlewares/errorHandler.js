/**
 * Global error handling middleware
 */
export const errorHandler = (err, req, res, next) => {
  console.error("❌ Error:", {
    path: req.path,
    method: req.method,
    error: err.message,
    timestamp: new Date().toISOString(),
  });

  // Handle specific error types
  if (err.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      error: "Validation Error",
      details: Object.values(err.errors).map((e) => e.message),
    });
  }

  if (err.name === "CastError") {
    return res.status(400).json({
      success: false,
      error: "Invalid ID format",
    });
  }

  if (err.code === 11000) {
    return res.status(409).json({
      success: false,
      error: "Duplicate key error",
      field: Object.keys(err.keyPattern)[0],
    });
  }

  // Default error
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal server error";

  res.status(statusCode).json({
    success: false,
    error: message,
  });
};

export default { errorHandler };

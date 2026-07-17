/**
 * server/middleware/errorHandler.js
 * Centralized error handling middleware.
 * Formats all errors into a consistent JSON response.
 */

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error details in development
  if (process.env.NODE_ENV === "development") {
    console.error("🔴 Error:", err);
  }

  // --- Mongoose Validation Error ---
  if (err.name === "ValidationError") {
    const message = Object.values(err.errors)
      .map((val) => val.message)
      .join(", ");
    return res.status(400).json({ success: false, message });
  }

  // --- Mongoose Duplicate Key Error (e.g., duplicate email) ---
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const message = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`;
    return res.status(400).json({ success: false, message });
  }

  // --- Mongoose Cast Error (invalid ObjectId) ---
  if (err.name === "CastError") {
    return res.status(404).json({ success: false, message: "Resource not found" });
  }

  // --- JWT Errors ---
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({ success: false, message: "Invalid token. Please log in again." });
  }

  if (err.name === "TokenExpiredError") {
    return res.status(401).json({ success: false, message: "Token expired. Please log in again." });
  }

  // --- Default Error Response ---
  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || "Internal Server Error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

module.exports = errorHandler;

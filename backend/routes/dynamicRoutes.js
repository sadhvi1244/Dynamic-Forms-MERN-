import express from "express";
import mongoose from "mongoose";

/**
 * Generates REST API routes for an entity
 * @param {string} entityName - Name of the entity
 * @param {object} config - Entity configuration
 * @param {mongoose.Model} Model - Mongoose model
 * @returns {express.Router} - Express router
 */
export const generateRoutes = (entityName, config, Model) => {
  const router = express.Router();

  // Helper function to find record by ID (supports both custom id and _id)
  const findRecordById = async (id) => {
    // Try MongoDB _id first
    if (mongoose.Types.ObjectId.isValid(id)) {
      const record = await Model.findById(id).lean();
      if (record) return record;
    }

    // Try custom id field
    const numericId = !isNaN(id) ? parseInt(id) : id;
    return await Model.findOne({ id: numericId }).lean();
  };

  // ============================================
  // GET - Fetch all records (with pagination & search)
  // ============================================
  router.get("/", async (req, res) => {
    try {
      const { page = 1, limit = 100, search = "" } = req.query;

      let query = {};

      // Search functionality
      if (search && search.trim()) {
        const stringFields = Object.entries(config.backend.schema)
          .filter(([_, v]) => v.type === "String")
          .map(([k, _]) => k);

        if (stringFields.length > 0) {
          const searchQueries = stringFields.map((field) => ({
            [field]: { $regex: search.trim(), $options: "i" },
          }));

          query.$or = searchQueries;
        }
      }

      // Execute query with pagination
      const records = await Model.find(query)
        .limit(parseInt(limit))
        .skip((parseInt(page) - 1) * parseInt(limit))
        .sort({ createdAt: -1 })
        .lean();

      const total = await Model.countDocuments(query);

      res.json({
        success: true,
        data: records,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit)),
        },
      });
    } catch (error) {
      console.error(`Error fetching ${entityName}:`, error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  // ============================================
  // GET - Fetch single record by ID
  // ============================================
  router.get("/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const record = await findRecordById(id);

      if (!record) {
        return res.status(404).json({
          success: false,
          error: `${entityName} not found`,
        });
      }

      res.json({
        success: true,
        data: record,
      });
    } catch (error) {
      console.error(`Error fetching ${entityName} by ID:`, error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  // ============================================
  // POST - Create new record
  // ============================================
  router.post("/", async (req, res) => {
    try {
      const newRecord = new Model(req.body);
      const saved = await newRecord.save();

      res.status(201).json({
        success: true,
        data: saved,
        message: `${entityName} created successfully`,
      });
    } catch (error) {
      console.error(`Error creating ${entityName}:`, error);

      // Handle validation errors
      if (error.name === "ValidationError") {
        return res.status(400).json({
          success: false,
          error: "Validation error",
          details: Object.values(error.errors).map((e) => e.message),
        });
      }

      // Handle duplicate key errors
      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          error: "Duplicate entry",
          field: Object.keys(error.keyPattern)[0],
        });
      }

      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  });

  // ============================================
  // PUT - Update record by ID
  // ============================================
  router.put("/:id", async (req, res) => {
    try {
      const { id } = req.params;
      let updated;

      // Try MongoDB _id first
      if (mongoose.Types.ObjectId.isValid(id)) {
        updated = await Model.findByIdAndUpdate(id, req.body, {
          new: true,
          runValidators: true,
          lean: true,
        });
      }

      // If not found, try custom id field
      if (!updated) {
        const numericId = !isNaN(id) ? parseInt(id) : id;
        updated = await Model.findOneAndUpdate({ id: numericId }, req.body, {
          new: true,
          runValidators: true,
          lean: true,
        });
      }

      if (!updated) {
        return res.status(404).json({
          success: false,
          error: `${entityName} not found`,
        });
      }

      res.json({
        success: true,
        data: updated,
        message: `${entityName} updated successfully`,
      });
    } catch (error) {
      console.error(`Error updating ${entityName}:`, error);

      if (error.name === "ValidationError") {
        return res.status(400).json({
          success: false,
          error: "Validation error",
          details: Object.values(error.errors).map((e) => e.message),
        });
      }

      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  });

  // ============================================
  // PATCH - Partial update
  // ============================================
  router.patch("/:id", async (req, res) => {
    try {
      const { id } = req.params;
      let updated;

      // Try MongoDB _id first
      if (mongoose.Types.ObjectId.isValid(id)) {
        updated = await Model.findByIdAndUpdate(
          id,
          { $set: req.body },
          {
            new: true,
            runValidators: true,
            lean: true,
          }
        );
      }

      // If not found, try custom id field
      if (!updated) {
        const numericId = !isNaN(id) ? parseInt(id) : id;
        updated = await Model.findOneAndUpdate(
          { id: numericId },
          { $set: req.body },
          {
            new: true,
            runValidators: true,
            lean: true,
          }
        );
      }

      if (!updated) {
        return res.status(404).json({
          success: false,
          error: `${entityName} not found`,
        });
      }

      res.json({
        success: true,
        data: updated,
        message: `${entityName} updated successfully`,
      });
    } catch (error) {
      console.error(`Error patching ${entityName}:`, error);
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  });

  // ============================================
  // DELETE - Delete record by ID
  // ============================================
  router.delete("/:id", async (req, res) => {
    try {
      const { id } = req.params;
      let deleted;

      // Try MongoDB _id first
      if (mongoose.Types.ObjectId.isValid(id)) {
        deleted = await Model.findByIdAndDelete(id).lean();
      }

      // If not found, try custom id field
      if (!deleted) {
        const numericId = !isNaN(id) ? parseInt(id) : id;
        deleted = await Model.findOneAndDelete({ id: numericId }).lean();
      }

      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: `${entityName} not found`,
        });
      }

      res.json({
        success: true,
        data: deleted,
        message: `${entityName} deleted successfully`,
      });
    } catch (error) {
      console.error(`Error deleting ${entityName}:`, error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  return router;
};

export default { generateRoutes };

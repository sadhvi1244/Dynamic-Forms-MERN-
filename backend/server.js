import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import bodyParser from "body-parser";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ============================================
// MIDDLEWARE SETUP
// ============================================
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    credentials: true,
  })
);
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "50mb" }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ============================================
// MONGODB CONNECTION
// ============================================
const MONGODB_URI = process.env.MONGODB_URI;
let isMongoConnected = false;

if (MONGODB_URI) {
  mongoose
    .connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    })
    .then(() => {
      console.log("✅ MongoDB Connected");
      isMongoConnected = true;
    })
    .catch((err) => {
      console.warn("⚠️ MongoDB connection failed:", err.message);
      console.log("⚠️ Running without database");
    });
} else {
  console.warn("⚠️ MONGODB_URI not set, running without database");
}

// ============================================
// LOAD SCHEMA CONFIGURATION
// ============================================
let currentSchema;

try {
  const schemaPath = path.join(__dirname, "schemaConfig.json");

  if (fs.existsSync(schemaPath)) {
    const schemaData = fs.readFileSync(schemaPath, "utf8");
    currentSchema = JSON.parse(schemaData);
    console.log(
      "✅ Schema loaded from file:",
      Object.keys(currentSchema.record)
    );
  } else {
    // Default schema
    currentSchema = {
      record: {
        users: {
          route: "/api/users",
          backend: {
            schema: {
              name: { type: "String", required: true },
              email: { type: "String", required: true },
              phone: { type: "String" },
            },
            options: { timestamps: true },
          },
          frontend: {
            apiPath: "/users",
            fields: [
              { name: "name", label: "Name", required: true, type: "text" },
              { name: "email", label: "Email", required: true, type: "email" },
              { name: "phone", label: "Phone", type: "text" },
            ],
            columns: [
              { header: "Name", accessor: "name" },
              { header: "Email", accessor: "email" },
              { header: "Phone", accessor: "phone" },
            ],
          },
        },
      },
    };
    console.log("✅ Using default schema");
  }
} catch (error) {
  console.error("❌ Error loading schema:", error);
  currentSchema = { record: {} };
}

// ============================================
// IN-MEMORY STORAGE (FALLBACK)
// ============================================
const memoryStore = {};

// ============================================
// DYNAMIC MODEL CREATOR
// ============================================
const modelCache = {};

const createDynamicModel = (entityName, config) => {
  const modelName = entityName.charAt(0).toUpperCase() + entityName.slice(1);

  // Return cached model
  if (modelCache[modelName]) {
    return modelCache[modelName];
  }

  // Delete existing model
  if (mongoose.models[modelName]) {
    delete mongoose.models[modelName];
  }

  const schemaFields = {};

  for (const [fieldName, fieldConfig] of Object.entries(config.schema)) {
    const field = {};

    // Type mapping
    switch (fieldConfig.type) {
      case "String":
        field.type = String;
        break;
      case "Number":
        field.type = Number;
        break;
      case "Boolean":
        field.type = Boolean;
        break;
      case "Date":
        field.type = Date;
        break;
      case "Array":
        field.type = Array;
        break;
      default:
        field.type = String;
    }

    if (fieldConfig.required) field.required = true;
    if (fieldConfig.unique) field.unique = true;
    if (fieldConfig.default === "Date.now") field.default = Date.now;
    else if (fieldConfig.default) field.default = fieldConfig.default;
    if (fieldConfig.enum) field.enum = fieldConfig.enum;

    schemaFields[fieldName] = field;
  }

  const schema = new mongoose.Schema(schemaFields, {
    timestamps: true,
    strict: false,
  });

  const model = mongoose.model(modelName, schema);
  modelCache[modelName] = model;

  console.log(`📦 Model created: ${modelName}`);
  return model;
};

// ============================================
// DYNAMIC ROUTES CREATOR
// ============================================
const createRoutes = (entityName, config, Model) => {
  const router = express.Router();

  // GET all items
  router.get("/", async (req, res) => {
    try {
      const { page = 1, limit = 10, search = "" } = req.query;

      if (isMongoConnected && Model) {
        // Use MongoDB
        let query = {};

        if (search) {
          const stringFields = Object.entries(config.schema)
            .filter(([_, v]) => v.type === "String")
            .map(([k]) => k);

          if (stringFields.length > 0) {
            query.$or = stringFields.map((field) => ({
              [field]: { $regex: search, $options: "i" },
            }));
          }
        }

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
      } else {
        // Use in-memory storage
        const items = memoryStore[entityName] || [];
        let filteredItems = items;

        if (search) {
          const searchLower = search.toLowerCase();
          filteredItems = items.filter((item) =>
            Object.values(item).some((val) =>
              String(val).toLowerCase().includes(searchLower)
            )
          );
        }

        const startIndex = (parseInt(page) - 1) * parseInt(limit);
        const endIndex = parseInt(page) * parseInt(limit);
        const paginatedItems = filteredItems.slice(startIndex, endIndex);

        res.json({
          success: true,
          data: paginatedItems,
          pagination: {
            total: filteredItems.length,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(filteredItems.length / parseInt(limit)),
          },
        });
      }
    } catch (error) {
      console.error(`Error fetching ${entityName}:`, error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET by ID
  router.get("/:id", async (req, res) => {
    try {
      if (isMongoConnected && Model) {
        const record = await Model.findById(req.params.id).lean();
        if (!record) {
          return res.status(404).json({ success: false, error: "Not found" });
        }
        res.json({ success: true, data: record });
      } else {
        const items = memoryStore[entityName] || [];
        const item = items.find((i) => i._id === req.params.id);
        if (!item) {
          return res.status(404).json({ success: false, error: "Not found" });
        }
        res.json({ success: true, data: item });
      }
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // POST create
  router.post("/", async (req, res) => {
    try {
      if (isMongoConnected && Model) {
        const newRecord = new Model(req.body);
        const saved = await newRecord.save();
        res.status(201).json({ success: true, data: saved });
      } else {
        const items = memoryStore[entityName] || [];
        const newItem = {
          _id: Date.now().toString(),
          ...req.body,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        items.push(newItem);
        memoryStore[entityName] = items;
        res.status(201).json({ success: true, data: newItem });
      }
    } catch (error) {
      console.error(`Error creating ${entityName}:`, error);
      res.status(400).json({ success: false, error: error.message });
    }
  });

  // PUT update
  router.put("/:id", async (req, res) => {
    try {
      if (isMongoConnected && Model) {
        const updated = await Model.findByIdAndUpdate(req.params.id, req.body, {
          new: true,
          runValidators: true,
        }).lean();
        if (!updated) {
          return res.status(404).json({ success: false, error: "Not found" });
        }
        res.json({ success: true, data: updated });
      } else {
        let items = memoryStore[entityName] || [];
        const index = items.findIndex((i) => i._id === req.params.id);
        if (index === -1) {
          return res.status(404).json({ success: false, error: "Not found" });
        }
        items[index] = {
          ...items[index],
          ...req.body,
          updatedAt: new Date().toISOString(),
        };
        memoryStore[entityName] = items;
        res.json({ success: true, data: items[index] });
      }
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  // DELETE
  router.delete("/:id", async (req, res) => {
    try {
      if (isMongoConnected && Model) {
        const deleted = await Model.findByIdAndDelete(req.params.id).lean();
        if (!deleted) {
          return res.status(404).json({ success: false, error: "Not found" });
        }
        res.json({ success: true, message: "Deleted successfully" });
      } else {
        let items = memoryStore[entityName] || [];
        const filtered = items.filter((i) => i._id !== req.params.id);
        if (filtered.length === items.length) {
          return res.status(404).json({ success: false, error: "Not found" });
        }
        memoryStore[entityName] = filtered;
        res.json({ success: true, message: "Deleted successfully" });
      }
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
};

// ============================================
// REGISTER ALL ROUTES
// ============================================
const registeredRoutes = {};

const registerAllRoutes = () => {
  console.log("\n🔄 Registering routes...");

  // Clear previous routes
  Object.keys(registeredRoutes).forEach((key) => delete registeredRoutes[key]);

  // Register new routes
  Object.entries(currentSchema.record).forEach(([entityName, config]) => {
    try {
      if (!config.route || !config.backend) {
        console.warn(`⚠️ Skipping ${entityName}: Invalid configuration`);
        return;
      }

      let Model = null;
      if (isMongoConnected) {
        Model = createDynamicModel(entityName, config.backend);
      }

      const router = createRoutes(entityName, config.backend, Model);
      app.use(config.route, router);
      registeredRoutes[entityName] = config.route;
      console.log(`✅ ${config.route} -> ${entityName}`);
    } catch (error) {
      console.error(`❌ Error registering ${entityName}:`, error.message);
    }
  });

  console.log(`📋 Total routes: ${Object.keys(registeredRoutes).length}\n`);
};

// Initial registration
registerAllRoutes();

// ============================================
// SYSTEM ROUTES
// ============================================
app.get("/", (req, res) => {
  res.json({
    message: "🎯 Dynamic Form System API",
    version: "1.0.0",
    status: "running",
    database: isMongoConnected ? "MongoDB" : "In-memory",
    entities: Object.keys(currentSchema.record),
    routes: Object.values(registeredRoutes),
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    database: isMongoConnected ? "connected" : "in-memory",
    entities: Object.keys(currentSchema.record),
    routes: Object.values(registeredRoutes),
  });
});

app.get("/api/schema", (req, res) => {
  res.json({
    success: true,
    data: currentSchema,
    timestamp: new Date().toISOString(),
  });
});

app.post("/api/schema/update", (req, res) => {
  try {
    const newSchema = req.body;

    if (!newSchema.record || typeof newSchema.record !== "object") {
      throw new Error('Schema must contain a "record" object');
    }

    currentSchema = newSchema;

    // Save to file
    try {
      const schemaPath = path.join(__dirname, "schemaConfig.json");
      fs.writeFileSync(schemaPath, JSON.stringify(newSchema, null, 2), "utf8");
      console.log("✅ Schema saved to file");
    } catch (fileError) {
      console.warn("⚠️ Could not save schema:", fileError.message);
    }

    // Clear model cache
    Object.keys(modelCache).forEach((key) => delete modelCache[key]);

    // Re-register routes
    registerAllRoutes();

    res.json({
      success: true,
      message: "Schema updated successfully",
      entities: Object.keys(newSchema.record),
      routes: Object.values(registeredRoutes),
    });
  } catch (error) {
    console.error("❌ Schema update error:", error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.path}`,
    availableRoutes: Object.values(registeredRoutes),
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({
    success: false,
    error: "Internal server error",
    message: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// ============================================
// START SERVER
// ============================================
const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log("\n══════════════════════════════════════════");
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`💾 Database: ${isMongoConnected ? "MongoDB" : "In-memory"}`);
    console.log(`📋 Entities: ${Object.keys(currentSchema.record).join(", ")}`);
    console.log("══════════════════════════════════════════\n");
  });
}

export default app;

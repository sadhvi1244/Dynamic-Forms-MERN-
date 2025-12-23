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

// Middleware
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "50mb" }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// MongoDB Connection
let isMongoConnected = false;
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/dynamicforms";

if (MONGODB_URI && MONGODB_URI !== "none") {
  mongoose
    .connect(MONGODB_URI)
    .then(() => {
      console.log("✅ MongoDB Connected");
      isMongoConnected = true;
    })
    .catch((err) => {
      console.warn("⚠️ MongoDB not available:", err.message);
      console.log("⚠️ Running without database - using in-memory storage");
    });
}

// In-memory data store (fallback)
const memoryStore = {};

// Load or create initial schema
let currentSchema;
const schemaFilePath = path.join(__dirname, "schemaConfig.json");

try {
  if (fs.existsSync(schemaFilePath)) {
    const schemaData = fs.readFileSync(schemaFilePath, "utf8");
    currentSchema = JSON.parse(schemaData);
    console.log("✅ Schema loaded from file");
  } else {
    // Create default schema
    currentSchema = {
      record: {
        users: {
          route: "/api/users",
          backend: {
            schema: {
              name: { type: "String", required: true },
              email: { type: "String", required: true },
              phone: { type: "String" },
              age: { type: "Number", min: 0, max: 120 },
              isActive: { type: "Boolean", default: true },
            },
            options: { timestamps: true },
          },
          frontend: {
            apiPath: "/users",
            fields: [
              {
                name: "name",
                label: "Full Name",
                required: true,
                type: "text",
              },
              { name: "email", label: "Email", required: true, type: "email" },
              { name: "phone", label: "Phone", type: "text" },
              { name: "age", label: "Age", type: "number", min: 0, max: 120 },
              { name: "isActive", label: "Active", type: "checkbox" },
            ],
            columns: [
              { header: "ID", accessor: "_id" },
              { header: "Name", accessor: "name" },
              { header: "Email", accessor: "email" },
              { header: "Phone", accessor: "phone" },
              { header: "Age", accessor: "age" },
              { header: "Active", accessor: "isActive" },
            ],
          },
        },
      },
    };
    fs.writeFileSync(schemaFilePath, JSON.stringify(currentSchema, null, 2));
    console.log("✅ Default schema created");
  }
} catch (error) {
  console.error("❌ Error loading schema:", error);
  currentSchema = { record: {} };
}

// Store for routes
const activeRoutes = {};

// Universal route handler
const createDynamicRoutes = (entityName, config) => {
  const router = express.Router();

  // Helper to get collection
  const getCollection = () => {
    if (!memoryStore[entityName]) {
      memoryStore[entityName] = [];
    }
    return memoryStore[entityName];
  };

  // Generate unique ID
  const generateId = () =>
    `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // GET all items with pagination and search
  router.get("/", (req, res) => {
    try {
      const items = getCollection();
      const {
        page = 1,
        limit = 10,
        search = "",
        sortBy = "createdAt",
        sortOrder = "desc",
      } = req.query;

      // Filter by search
      let filteredItems = [...items];
      if (search && search.trim()) {
        const searchLower = search.toLowerCase();
        filteredItems = items.filter((item) => {
          return Object.values(item).some(
            (val) => val && String(val).toLowerCase().includes(searchLower)
          );
        });
      }

      // Sort items
      filteredItems.sort((a, b) => {
        const aVal = a[sortBy] || "";
        const bVal = b[sortBy] || "";
        const order = sortOrder === "desc" ? -1 : 1;

        if (aVal < bVal) return -1 * order;
        if (aVal > bVal) return 1 * order;
        return 0;
      });

      // Paginate
      const startIndex = (page - 1) * limit;
      const endIndex = page * limit;
      const paginatedItems = filteredItems.slice(startIndex, endIndex);

      res.json({
        success: true,
        data: paginatedItems,
        pagination: {
          total: filteredItems.length,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(filteredItems.length / limit),
          hasNext: endIndex < filteredItems.length,
          hasPrev: startIndex > 0,
        },
      });
    } catch (error) {
      console.error(`Error fetching ${entityName}:`, error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch data",
      });
    }
  });

  // GET single item
  router.get("/:id", (req, res) => {
    try {
      const items = getCollection();
      const item = items.find((item) => item._id === req.params.id);

      if (!item) {
        return res.status(404).json({
          success: false,
          error: "Item not found",
        });
      }

      res.json({
        success: true,
        data: item,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: "Failed to fetch item",
      });
    }
  });

  // POST create item
  router.post("/", (req, res) => {
    try {
      const items = getCollection();
      const newItem = {
        _id: generateId(),
        ...req.body,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Validate required fields if schema exists
      if (config.backend && config.backend.schema) {
        const requiredFields = Object.entries(config.backend.schema)
          .filter(([_, fieldConfig]) => fieldConfig.required)
          .map(([fieldName]) => fieldName);

        const missingFields = requiredFields.filter((field) => !newItem[field]);
        if (missingFields.length > 0) {
          return res.status(400).json({
            success: false,
            error: `Missing required fields: ${missingFields.join(", ")}`,
          });
        }
      }

      items.push(newItem);
      memoryStore[entityName] = items;

      console.log(`✅ Created ${entityName}:`, newItem._id);

      res.status(201).json({
        success: true,
        data: newItem,
        message: `${entityName} created successfully`,
      });
    } catch (error) {
      console.error(`Error creating ${entityName}:`, error);
      res.status(400).json({
        success: false,
        error: error.message || "Failed to create item",
      });
    }
  });

  // PUT update item
  router.put("/:id", (req, res) => {
    try {
      let items = getCollection();
      const index = items.findIndex((item) => item._id === req.params.id);

      if (index === -1) {
        return res.status(404).json({
          success: false,
          error: "Item not found",
        });
      }

      items[index] = {
        ...items[index],
        ...req.body,
        updatedAt: new Date().toISOString(),
      };

      memoryStore[entityName] = items;

      res.json({
        success: true,
        data: items[index],
        message: `${entityName} updated successfully`,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: "Failed to update item",
      });
    }
  });

  // DELETE item
  router.delete("/:id", (req, res) => {
    try {
      let items = getCollection();
      const filteredItems = items.filter((item) => item._id !== req.params.id);

      if (filteredItems.length === items.length) {
        return res.status(404).json({
          success: false,
          error: "Item not found",
        });
      }

      memoryStore[entityName] = filteredItems;

      res.json({
        success: true,
        message: `${entityName} deleted successfully`,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: "Failed to delete item",
      });
    }
  });

  return router;
};

// Function to register all routes
const registerAllRoutes = () => {
  console.log("\n🔄 Registering dynamic routes...");

  // Clear existing routes
  if (app._router && app._router.stack) {
    app._router.stack = app._router.stack.filter((layer) => {
      // Keep only system routes
      if (layer.route) {
        const path = layer.route.path;
        return (
          path === "/" ||
          path === "/health" ||
          path === "/api/schema" ||
          path === "/api/schema/update" ||
          path === "/api/debug"
        );
      }
      return true;
    });
  }

  // Clear active routes
  Object.keys(activeRoutes).forEach((key) => {
    delete activeRoutes[key];
  });

  // Register routes for each entity
  if (currentSchema.record) {
    Object.entries(currentSchema.record).forEach(([entityName, config]) => {
      try {
        if (!config.route) {
          console.warn(`⚠️ Skipping ${entityName}: No route defined`);
          return;
        }

        const router = createDynamicRoutes(entityName, config);
        app.use(config.route, router);
        activeRoutes[entityName] = config.route;

        console.log(`✅ Registered: ${config.route} -> ${entityName}`);

        // Pre-create some sample data for new entities
        if (!memoryStore[entityName] || memoryStore[entityName].length === 0) {
          memoryStore[entityName] = [];

          // Create 3 sample items for demonstration
          for (let i = 1; i <= 3; i++) {
            const sampleItem = {
              _id: `sample_${entityName}_${i}`,
              name: `Sample ${entityName} ${i}`,
              description: `This is a sample ${entityName} item`,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };

            // Add fields from schema
            if (config.backend && config.backend.schema) {
              Object.entries(config.backend.schema).forEach(
                ([fieldName, fieldConfig]) => {
                  if (!sampleItem[fieldName]) {
                    if (fieldConfig.type === "String") {
                      sampleItem[fieldName] = `Sample ${fieldName}`;
                    } else if (fieldConfig.type === "Number") {
                      sampleItem[fieldName] = i * 10;
                    } else if (fieldConfig.type === "Boolean") {
                      sampleItem[fieldName] = true;
                    } else if (fieldConfig.type === "Date") {
                      sampleItem[fieldName] = new Date().toISOString();
                    }
                  }
                }
              );
            }

            memoryStore[entityName].push(sampleItem);
          }
        }
      } catch (error) {
        console.error(`❌ Error registering ${entityName}:`, error.message);
      }
    });
  }

  console.log(
    `📋 Total routes registered: ${Object.keys(activeRoutes).length}\n`
  );
};

// Initial route registration
registerAllRoutes();

// ============================================
// SYSTEM ROUTES
// ============================================

app.get("/", (req, res) => {
  res.json({
    message: "🎯 Dynamic Form System API",
    version: "1.0.0",
    status: "running",
    features: {
      dynamicRoutes: "Auto-generated CRUD APIs",
      schemaHotReload: "Update schema without restart",
      dataPersistence: "In-memory storage with file backup",
      searchPagination: "Built-in search and pagination",
    },
    stats: {
      entities: Object.keys(currentSchema.record || {}).length,
      database: isMongoConnected ? "MongoDB" : "In-memory",
      routes: Object.keys(activeRoutes),
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
    },
    endpoints: {
      root: "/",
      health: "/health",
      schema: "/api/schema",
      updateSchema: "/api/schema/update (POST)",
      debug: "/api/debug",
      entities: Object.values(currentSchema.record || {}).map((c) => c.route),
    },
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: isMongoConnected ? "connected" : "in-memory",
    entities: Object.keys(currentSchema.record || {}),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + "MB",
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + "MB",
    },
  });
});

app.get("/api/schema", (req, res) => {
  res.json({
    success: true,
    data: currentSchema,
    timestamp: new Date().toISOString(),
    entities: Object.keys(currentSchema.record || {}),
  });
});

app.post("/api/schema/update", (req, res) => {
  try {
    console.log("\n🔄 Schema update request received...");

    const newSchema = req.body;

    // Validate schema
    if (!newSchema || typeof newSchema !== "object") {
      throw new Error("Invalid schema format");
    }

    if (!newSchema.record || typeof newSchema.record !== "object") {
      throw new Error('Schema must contain a "record" object');
    }

    // Validate each entity
    Object.entries(newSchema.record).forEach(([entityName, config]) => {
      if (!config.route) {
        throw new Error(`Entity "${entityName}" is missing route`);
      }
      if (!config.route.startsWith("/")) {
        throw new Error(`Route for "${entityName}" must start with "/"`);
      }
      if (!config.backend || !config.backend.schema) {
        throw new Error(`Entity "${entityName}" is missing backend schema`);
      }
      if (!config.frontend || !config.frontend.fields) {
        throw new Error(`Entity "${entityName}" is missing frontend fields`);
      }
    });

    // Update schema
    currentSchema = newSchema;

    // Save to file
    fs.writeFileSync(
      schemaFilePath,
      JSON.stringify(newSchema, null, 2),
      "utf8"
    );
    console.log("✅ Schema saved to file");

    // Re-register routes
    registerAllRoutes();

    const entities = Object.keys(newSchema.record);
    console.log(`✅ Schema updated with ${entities.length} entities`);

    res.json({
      success: true,
      message: "Schema updated successfully",
      data: {
        entities: entities,
        routes: Object.values(newSchema.record).map((c) => c.route),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("❌ Error updating schema:", error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

// Debug endpoint
app.get("/api/debug", (req, res) => {
  res.json({
    schema: currentSchema,
    activeRoutes: activeRoutes,
    memoryStore: Object.keys(memoryStore).reduce((acc, key) => {
      acc[key] = memoryStore[key].length;
      return acc;
    }, {}),
    serverInfo: {
      nodeVersion: process.version,
      platform: process.platform,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.originalUrl}`,
    availableRoutes: [
      "/",
      "/health",
      "/api/schema",
      "/api/schema/update",
      "/api/debug",
      ...Object.values(activeRoutes),
    ],
    hint: "Make sure you've uploaded a valid schema with proper route definitions",
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("❌ Server error:", err);
  res.status(500).json({
    success: false,
    error: "Internal server error",
    message: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log("\n══════════════════════════════════════════════════════════");
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`💾 Storage: ${isMongoConnected ? "MongoDB" : "In-memory"}`);
  console.log(
    `📋 Entities: ${
      Object.keys(currentSchema.record || {}).join(", ") || "None"
    }`
  );
  console.log(`⏰ Started: ${new Date().toISOString()}`);
  console.log("══════════════════════════════════════════════════════════\n");
});

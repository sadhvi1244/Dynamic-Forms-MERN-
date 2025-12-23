import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import bodyParser from "body-parser";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";

// ES6 module equivalents for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "50mb" }));

// MongoDB Connection
let isMongoConnected = false;
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/dynamicforms";

if (MONGODB_URI) {
  mongoose
    .connect(MONGODB_URI)
    .then(() => {
      console.log("✅ MongoDB Connected");
      isMongoConnected = true;
    })
    .catch((err) => {
      console.warn("⚠️  MongoDB not available:", err.message);
      console.log("⚠️  Running without database - using in-memory storage");
    });
}

// In-memory data store (fallback)
const memoryStore = {};

// Load initial schema configuration
let currentSchema;
try {
  // Try to load from file
  const schemaPath = path.join(__dirname, "schemaConfig.json");
  if (fs.existsSync(schemaPath)) {
    const schemaData = fs.readFileSync(schemaPath, "utf8");
    currentSchema = JSON.parse(schemaData);
    console.log("✅ Schema configuration loaded from file");
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
  console.error("❌ Error loading schema configuration:", error);
  currentSchema = { record: {} };
}

// Store for registered routes
const registeredRoutes = {};

// Dynamic route generator
const createRoutes = (entity, config) => {
  const router = express.Router();

  // GET all items with pagination
  router.get("/", (req, res) => {
    try {
      const items = memoryStore[entity] || [];
      const { page = 1, limit = 10, search = "" } = req.query;

      // Filter by search term
      let filteredItems = items;
      if (search) {
        const searchLower = search.toLowerCase();
        filteredItems = items.filter((item) => {
          return Object.values(item).some((val) =>
            String(val).toLowerCase().includes(searchLower)
          );
        });
      }

      // Pagination
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
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  // GET single item
  router.get("/:id", (req, res) => {
    const items = memoryStore[entity] || [];
    const item = items.find((i) => i._id === req.params.id);

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
  });

  // POST create item
  router.post("/", (req, res) => {
    try {
      const items = memoryStore[entity] || [];
      const newItem = {
        _id: Date.now().toString(),
        ...req.body,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      items.push(newItem);
      memoryStore[entity] = items;

      res.status(201).json({
        success: true,
        data: newItem,
        message: `${entity} created successfully`,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  });

  // PUT update item
  router.put("/:id", (req, res) => {
    try {
      let items = memoryStore[entity] || [];
      const index = items.findIndex((i) => i._id === req.params.id);

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

      memoryStore[entity] = items;

      res.json({
        success: true,
        data: items[index],
        message: `${entity} updated successfully`,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  });

  // DELETE item
  router.delete("/:id", (req, res) => {
    try {
      let items = memoryStore[entity] || [];
      const filtered = items.filter((i) => i._id !== req.params.id);

      if (filtered.length === items.length) {
        return res.status(404).json({
          success: false,
          error: "Item not found",
        });
      }

      memoryStore[entity] = filtered;

      res.json({
        success: true,
        message: `${entity} deleted successfully`,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  return router;
};

// Function to register all routes
const registerAllRoutes = () => {
  console.log("\n🔄 Registering routes...");

  // Clear previously registered routes
  Object.values(registeredRoutes).forEach((route) => {
    // Remove the route from Express
    // This is a simplified approach - in production, you'd need proper route management
  });

  // Clear the registered routes object
  Object.keys(registeredRoutes).forEach((key) => {
    delete registeredRoutes[key];
  });

  // Register new routes
  Object.entries(currentSchema.record).forEach(([entityName, config]) => {
    try {
      if (!config.route || !config.backend) {
        console.warn(`⚠️  Skipping ${entityName}: Invalid configuration`);
        return;
      }

      const router = createRoutes(entityName, config);
      app.use(config.route, router);
      registeredRoutes[entityName] = config.route;
      console.log(`✅ Registered: ${config.route} -> ${entityName}`);
    } catch (error) {
      console.error(`❌ Error registering ${entityName}:`, error.message);
    }
  });

  console.log(
    `📋 Total routes registered: ${Object.keys(registeredRoutes).length}\n`
  );
};

// Initial route registration
registerAllRoutes();

// ============================================
// SYSTEM ROUTES
// ============================================

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    message: "Dynamic Form System API",
    status: "running",
    version: "1.0.0",
    database: isMongoConnected ? "connected" : "in-memory",
    entities: Object.keys(currentSchema.record),
    availableRoutes: Object.values(currentSchema.record).map((c) => c.route),
  });
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    database: isMongoConnected ? "connected" : "in-memory",
    entities: Object.keys(currentSchema.record).length,
    routes: Object.values(currentSchema.record).map((c) => c.route),
  });
});

// GET current schema
app.get("/api/schema", (req, res) => {
  res.json({
    success: true,
    data: currentSchema,
    timestamp: new Date().toISOString(),
  });
});

// POST update schema dynamically
app.post("/api/schema/update", (req, res) => {
  try {
    const newSchema = req.body;

    console.log("\n🔄 Schema update request received...");

    // Basic validation
    if (!newSchema.record || typeof newSchema.record !== "object") {
      throw new Error('Schema must contain a "record" object');
    }

    // Update schema
    currentSchema = newSchema;

    // Save to file for persistence
    try {
      const schemaPath = path.join(__dirname, "schemaConfig.json");
      fs.writeFileSync(schemaPath, JSON.stringify(newSchema, null, 2), "utf8");
      console.log("✅ Schema saved to schemaConfig.json");
    } catch (fileError) {
      console.warn("⚠️  Could not save schema to file:", fileError.message);
    }

    // Re-register all routes with new schema
    registerAllRoutes();

    const entities = Object.keys(newSchema.record);
    console.log(
      `✅ Schema updated successfully with ${entities.length} entities`
    );

    res.json({
      success: true,
      message: "Schema updated successfully",
      data: {
        entities: entities,
        count: entities.length,
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

// Debug endpoint to see all routes
app.get("/api/debug/routes", (req, res) => {
  const routes = [];

  function getRoutes(layer, prefix = "") {
    if (layer.route) {
      const path = prefix + layer.route.path;
      const methods = Object.keys(layer.route.methods);
      routes.push({ path, methods });
    } else if (layer.name === "router" && layer.handle.stack) {
      layer.handle.stack.forEach((stackItem) => {
        getRoutes(
          stackItem,
          prefix + (layer.regexp.toString() !== "/(?:)/" ? layer.path : "")
        );
      });
    }
  }

  app._router.stack.forEach((layer) => {
    getRoutes(layer);
  });

  res.json({
    registeredRoutes: Object.values(registeredRoutes),
    allRoutes: routes,
    schemaEntities: Object.keys(currentSchema.record || {}),
    memoryStoreEntities: Object.keys(memoryStore),
  });
});

// 404 handler for undefined routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.originalUrl}`,
    availableRoutes: Object.values(currentSchema.record).map((c) => c.route),
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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log("\n══════════════════════════════════════════════════════════");
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`💾 Database: ${isMongoConnected ? "MongoDB" : "In-memory"}`);
  console.log(
    `📋 Entities: ${Object.keys(currentSchema.record).join(", ") || "None"}`
  );
  console.log("══════════════════════════════════════════════════════════\n");
});

export default app;

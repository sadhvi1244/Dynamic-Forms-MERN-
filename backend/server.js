import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import bodyParser from "body-parser";
import "dotenv/config";

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// MongoDB Connection (optional - will work even without MongoDB)
let isMongoConnected = false;

if (process.env.MONGODB_URI) {
  mongoose
    .connect(process.env.MONGODB_URI)
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

// Dynamic route generator
const createRoutes = (entity, schema) => {
  const router = express.Router();

  // GET all items
  router.get("/", (req, res) => {
    const items = memoryStore[entity] || [];
    res.json({
      success: true,
      data: items,
      count: items.length,
    });
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
    });
  });

  // PUT update item
  router.put("/:id", (req, res) => {
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
    });
  });

  // DELETE item
  router.delete("/:id", (req, res) => {
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
      message: "Item deleted",
    });
  });

  return router;
};

// Current schema (in-memory)
let currentSchema = {
  record: {
    users: {
      route: "/api/users",
      backend: {
        schema: {
          name: { type: "String", required: true },
          email: { type: "String", required: true },
          phone: { type: "String" },
        },
      },
      frontend: {
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

// Register initial routes
const registeredRoutes = {};
Object.entries(currentSchema.record).forEach(([entity, config]) => {
  const router = createRoutes(entity, config.backend.schema);
  app.use(config.route, router);
  registeredRoutes[entity] = router;
  console.log(`✅ Registered route: ${config.route}`);
});

// ============================================
// SYSTEM ROUTES
// ============================================

app.get("/", (req, res) => {
  res.json({
    message: "Dynamic Form System Backend",
    status: "running",
    version: "1.0.0",
    database: isMongoConnected ? "connected" : "in-memory",
    entities: Object.keys(currentSchema.record),
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    database: isMongoConnected ? "connected" : "in-memory",
    entities: Object.keys(currentSchema.record).length,
  });
});

app.get("/api/schema", (req, res) => {
  res.json({
    success: true,
    data: currentSchema,
  });
});

app.post("/api/schema/update", (req, res) => {
  try {
    const newSchema = req.body;

    // Basic validation
    if (!newSchema.record || typeof newSchema.record !== "object") {
      throw new Error('Schema must contain a "record" object');
    }

    // Update schema
    currentSchema = newSchema;

    // Re-register routes
    Object.values(registeredRoutes).forEach((route) => {
      // Remove old routes (simplified)
      // In a real app, you'd need to properly manage route removal
    });

    Object.entries(newSchema.record).forEach(([entity, config]) => {
      if (!registeredRoutes[entity]) {
        const router = createRoutes(entity, config.backend.schema);
        app.use(config.route, router);
        registeredRoutes[entity] = router;
        console.log(`✅ Registered new route: ${config.route}`);
      }
    });

    res.json({
      success: true,
      message: "Schema updated successfully",
      entities: Object.keys(newSchema.record),
    });
  } catch (error) {
    console.error("Error updating schema:", error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

// ============================================
// ERROR HANDLING
// ============================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Route not found",
    availableRoutes: Object.values(currentSchema.record).map((c) => c.route),
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({
    success: false,
    error: "Internal server error",
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log("\n════════════════════════════════════════");
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`💾 Database: ${isMongoConnected ? "MongoDB" : "In-memory"}`);
  console.log(`📋 Entities: ${Object.keys(currentSchema.record).join(", ")}`);
  console.log("════════════════════════════════════════\n");
});

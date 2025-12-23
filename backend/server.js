import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import bodyParser from "body-parser";
import "dotenv/config";

const app = express();

// Middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "*",
    credentials: true,
  })
);
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "50mb" }));

// Logging middleware (skip in production for performance)
if (process.env.NODE_ENV !== "production") {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

// MongoDB Connection with retry logic
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("❌ MONGODB_URI environment variable is not set");
  process.exit(1);
}

let isConnected = false;

const connectDB = async () => {
  if (isConnected) {
    return;
  }

  try {
    const db = await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    isConnected = db.connections[0].readyState === 1;
    console.log("✅ MongoDB Connected");
  } catch (error) {
    console.error("❌ MongoDB Connection Error:", error);
    throw error;
  }
};

// Initialize connection
connectDB().catch((err) => console.error("Initial DB connection failed:", err));

// Default Schema (embedded, no file system dependency)
let schemaConfig = {
  record: {
    customers: {
      route: "/api/customers",
      backend: {
        schema: {
          name: { type: "String", required: true, trim: true },
          email: { type: "String", required: true, unique: true },
          phone: { type: "String" },
          address: { type: "String" },
        },
        options: { timestamps: true, strict: false },
      },
      frontend: {
        apiPath: "/customers",
        fields: [
          {
            name: "name",
            label: "Customer Name",
            required: true,
            type: "text",
          },
          { name: "email", label: "Email", required: true, type: "email" },
          { name: "phone", label: "Phone", required: false, type: "text" },
          {
            name: "address",
            label: "Address",
            required: false,
            type: "textarea",
          },
        ],
        columns: [
          { header: "ID", accessor: "id" },
          { header: "Name", accessor: "name" },
          { header: "Email", accessor: "email" },
          { header: "Phone", accessor: "phone" },
          { header: "Address", accessor: "address" },
        ],
      },
    },
    inventory: {
      route: "/api/inventory",
      backend: {
        schema: {
          productName: { type: "String", required: true },
          sku: { type: "String", unique: true },
          quantity: { type: "Number", required: true },
          warehouseLocation: { type: "String" },
        },
        options: { timestamps: true },
      },
      frontend: {
        apiPath: "/inventory",
        fields: [
          {
            name: "productName",
            label: "Product Name",
            required: true,
            type: "text",
          },
          { name: "sku", label: "SKU", required: true, type: "text" },
          {
            name: "quantity",
            label: "Quantity",
            required: true,
            type: "number",
          },
          {
            name: "warehouseLocation",
            label: "Warehouse Location",
            required: false,
            type: "text",
          },
        ],
        columns: [
          { header: "ID", accessor: "id" },
          { header: "Product Name", accessor: "productName" },
          { header: "SKU", accessor: "sku" },
          { header: "Quantity", accessor: "quantity" },
          { header: "Warehouse Location", accessor: "warehouseLocation" },
        ],
      },
    },
    transactions: {
      route: "/api/transactions",
      backend: {
        schema: {
          transactionId: { type: "String", unique: true },
          customerId: { type: "Number", required: true },
          productIds: { type: "Array" },
          totalAmount: { type: "Number", required: true },
          paymentMethod: { type: "String", required: true },
          transactionDate: { type: "Date", default: "Date.now" },
        },
        options: { timestamps: true },
      },
      frontend: {
        apiPath: "/transactions",
        fields: [
          {
            name: "customerId",
            label: "Customer ID",
            required: true,
            type: "number",
          },
          {
            name: "productIds",
            label: "Product IDs",
            required: true,
            type: "text",
          },
          {
            name: "totalAmount",
            label: "Total Amount",
            required: true,
            type: "number",
          },
          {
            name: "paymentMethod",
            label: "Payment Method",
            required: true,
            type: "dropdown",
            options: ["Credit Card", "UPI", "Cash"],
          },
          {
            name: "transactionDate",
            label: "Transaction Date",
            required: false,
            type: "date",
          },
        ],
        columns: [
          { header: "Transaction ID", accessor: "transactionId" },
          { header: "Customer ID", accessor: "customerId" },
          { header: "Product IDs", accessor: "productIds" },
          { header: "Total Amount", accessor: "totalAmount" },
          { header: "Payment Method", accessor: "paymentMethod" },
          { header: "Transaction Date", accessor: "transactionDate" },
        ],
      },
    },
  },
};

console.log("✅ Schema loaded:", Object.keys(schemaConfig.record));

// Model cache
const modelCache = {};

// Dynamic Model Creator
const createModel = (entityName, config) => {
  const modelName = entityName.charAt(0).toUpperCase() + entityName.slice(1);

  // Return cached model if exists
  if (modelCache[modelName]) {
    return modelCache[modelName];
  }

  // Delete if exists in mongoose
  if (mongoose.models[modelName]) {
    delete mongoose.models[modelName];
  }

  const schemaFields = {};

  for (const [fieldName, fieldConfig] of Object.entries(config.schema)) {
    const field = { type: String };

    if (fieldConfig.type === "String") field.type = String;
    else if (fieldConfig.type === "Number") field.type = Number;
    else if (fieldConfig.type === "Boolean") field.type = Boolean;
    else if (fieldConfig.type === "Date") field.type = Date;
    else if (fieldConfig.type === "Array") field.type = Array;

    if (fieldConfig.required) field.required = true;
    if (fieldConfig.unique) field.unique = true;
    if (fieldConfig.default === "Date.now") field.default = Date.now;
    else if (fieldConfig.default) field.default = fieldConfig.default;

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

// Dynamic Routes Creator
const createRoutes = (entityName, config, Model) => {
  const router = express.Router();

  // GET all
  router.get("/", async (req, res) => {
    try {
      await connectDB(); // Ensure connection

      const { page = 1, limit = 10, search = "" } = req.query;

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
    } catch (error) {
      console.error(`Error fetching ${entityName}:`, error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET by ID
  router.get("/:id", async (req, res) => {
    try {
      await connectDB();

      const record = await Model.findById(req.params.id).lean();
      if (!record) {
        return res.status(404).json({ success: false, error: "Not found" });
      }
      res.json({ success: true, data: record });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // POST create
  router.post("/", async (req, res) => {
    try {
      await connectDB();

      const newRecord = new Model(req.body);
      const saved = await newRecord.save();
      res.status(201).json({ success: true, data: saved });
    } catch (error) {
      console.error(`Error creating ${entityName}:`, error);
      res.status(400).json({ success: false, error: error.message });
    }
  });

  // PUT update
  router.put("/:id", async (req, res) => {
    try {
      await connectDB();

      const updated = await Model.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
      }).lean();

      if (!updated) {
        return res.status(404).json({ success: false, error: "Not found" });
      }
      res.json({ success: true, data: updated });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  // DELETE
  router.delete("/:id", async (req, res) => {
    try {
      await connectDB();

      const deleted = await Model.findByIdAndDelete(req.params.id).lean();
      if (!deleted) {
        return res.status(404).json({ success: false, error: "Not found" });
      }
      res.json({ success: true, data: deleted });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
};

// Register All Routes
const registerRoutes = () => {
  console.log("\n🔄 Registering routes...");

  Object.entries(schemaConfig.record).forEach(([entityName, config]) => {
    try {
      const Model = createModel(entityName, config.backend);
      const router = createRoutes(entityName, config.backend, Model);
      app.use(config.route, router);
      console.log(`✅ ${config.route} -> ${entityName}`);
    } catch (error) {
      console.error(`❌ Error with ${entityName}:`, error.message);
    }
  });

  console.log("✅ All routes registered\n");
};

// Register routes
registerRoutes();

// System routes
app.get("/", (req, res) => {
  res.json({
    message: "Dynamic Form API - Vercel Deployment",
    version: "1.0.0",
    status: "running",
    entities: Object.keys(schemaConfig.record),
    routes: Object.values(schemaConfig.record).map((c) => c.route),
    timestamp: new Date().toISOString(),
  });
});

app.get("/health", async (req, res) => {
  try {
    await connectDB();
    res.json({
      status: "OK",
      database:
        mongoose.connection.readyState === 1 ? "connected" : "disconnected",
      entities: Object.keys(schemaConfig.record),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: "ERROR",
      database: "disconnected",
      error: error.message,
    });
  }
});

app.get("/api/schema", (req, res) => {
  res.json({
    success: true,
    data: schemaConfig,
    timestamp: new Date().toISOString(),
  });
});

app.post("/api/schema/update", async (req, res) => {
  try {
    const newSchema = req.body;

    if (!newSchema.record || typeof newSchema.record !== "object") {
      return res.status(400).json({
        success: false,
        error: "Invalid schema format. Must contain a 'record' object.",
      });
    }

    // Update in-memory schema
    schemaConfig = newSchema;

    // Clear model cache
    Object.keys(modelCache).forEach((key) => delete modelCache[key]);
    Object.keys(mongoose.models).forEach(
      (model) => delete mongoose.models[model]
    );

    // Re-register routes
    registerRoutes();

    res.json({
      success: true,
      message: "Schema updated successfully (in-memory only on Vercel)",
      entities: Object.keys(schemaConfig.record),
      note: "Schema persists only for this serverless function instance",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Schema update error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.path}`,
    availableRoutes: Object.values(schemaConfig.record).map((c) => c.route),
    systemRoutes: ["/", "/health", "/api/schema", "/api/schema/update"],
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    success: false,
    error: "Internal server error",
    message: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// For Vercel serverless functions
export default app;

// For local development
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`\n🚀 Server running on port ${PORT}`);
    console.log(`📋 Entities: ${Object.keys(schemaConfig.record).join(", ")}`);
    console.log(`🌐 Test: http://localhost:${PORT}/health\n`);
  });
}

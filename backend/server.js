import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import bodyParser from "body-parser";

const app = express();

/* -------------------- Middleware -------------------- */
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "*",
    credentials: true,
  })
);

app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "50mb" }));

/* -------------------- Logging -------------------- */
if (process.env.NODE_ENV !== "production") {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

/* -------------------- MongoDB -------------------- */
const MONGODB_URI = process.env.MONGODB_URI;
let isConnected = false;

const connectDB = async () => {
  if (isConnected) return;

  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is not defined");
  }

  const db = await mongoose.connect(MONGODB_URI, {
    bufferCommands: false,
    serverSelectionTimeoutMS: 5000,
  });

  isConnected = db.connections[0].readyState === 1;
  console.log("✅ MongoDB connected");
};

/* -------------------- Schema Config -------------------- */
let schemaConfig = {
  /* 🔹 YOUR EXISTING SCHEMA (UNCHANGED) 🔹 */
};

/* -------------------- Model Cache -------------------- */
const modelCache = {};

/* -------------------- Model Creator -------------------- */
const createModel = (entityName, config) => {
  const modelName = entityName.charAt(0).toUpperCase() + entityName.slice(1);

  if (modelCache[modelName]) return modelCache[modelName];

  if (mongoose.models[modelName]) delete mongoose.models[modelName];

  const schemaFields = {};

  for (const [field, cfg] of Object.entries(config.schema)) {
    const fieldDef = { type: String };

    if (cfg.type === "Number") fieldDef.type = Number;
    if (cfg.type === "Boolean") fieldDef.type = Boolean;
    if (cfg.type === "Date") fieldDef.type = Date;
    if (cfg.type === "Array") fieldDef.type = Array;

    if (cfg.required) fieldDef.required = true;
    if (cfg.unique) fieldDef.unique = true;
    if (cfg.default === "Date.now") fieldDef.default = Date.now;

    schemaFields[field] = fieldDef;
  }

  const schema = new mongoose.Schema(schemaFields, {
    timestamps: true,
    strict: false,
  });

  const model = mongoose.model(modelName, schema);
  modelCache[modelName] = model;
  return model;
};

/* -------------------- Routes Creator -------------------- */
const createRoutes = (entity, config, Model) => {
  const router = express.Router();

  router.get("/", async (req, res) => {
    try {
      await connectDB();
      const data = await Model.find().lean();
      res.json({ success: true, data });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  router.post("/", async (req, res) => {
    try {
      await connectDB();
      const doc = await Model.create(req.body);
      res.status(201).json({ success: true, data: doc });
    } catch (e) {
      res.status(400).json({ success: false, error: e.message });
    }
  });

  return router;
};

/* -------------------- Register Routes -------------------- */
Object.entries(schemaConfig.record).forEach(([name, cfg]) => {
  const Model = createModel(name, cfg.backend);
  app.use(cfg.route, createRoutes(name, cfg.backend, Model));
});

/* -------------------- System Routes -------------------- */
app.get("/", (req, res) => {
  res.json({ status: "running" });
});

app.get("/health", async (req, res) => {
  try {
    await connectDB();
    res.json({ status: "OK", db: "connected" });
  } catch (e) {
    res.status(503).json({ status: "ERROR", error: e.message });
  }
});

/* -------------------- Export for Vercel -------------------- */
export default app;

/* -------------------- Local Dev Only -------------------- */
if (process.env.NODE_ENV !== "production") {
  app.listen(5000, () => console.log("🚀 Local server running on port 5000"));
}

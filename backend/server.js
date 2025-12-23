import express from "express";
import mongoose from "mongoose";
import cors from "cors";

const app = express();

/* ---------- Middleware ---------- */
app.use(express.json({ limit: "50mb" }));
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
  })
);

/* ---------- MongoDB (Vercel Safe) ---------- */
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error("❌ MONGODB_URI missing");
}

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000,
    });
  }

  cached.conn = await cached.promise;
  console.log("✅ MongoDB connected");
  return cached.conn;
}

/* ---------- USER SCHEMA ---------- */
const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    role: { type: String, required: true },
  },
  { timestamps: true }
);

const User = mongoose.models.User || mongoose.model("User", userSchema);

/* ---------- ROUTES ---------- */
app.get("/api/users", async (req, res) => {
  try {
    await connectDB();
    const users = await User.find().lean();
    res.json({ success: true, data: users });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/users", async (req, res) => {
  try {
    await connectDB();
    const user = await User.create(req.body);
    res.status(201).json({ success: true, data: user });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.put("/api/users/:id", async (req, res) => {
  try {
    await connectDB();
    const user = await User.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ success: true, data: user });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.delete("/api/users/:id", async (req, res) => {
  try {
    await connectDB();
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/* ---------- Health ---------- */
app.get("/health", async (req, res) => {
  try {
    await connectDB();
    res.json({
      status: "OK",
      db: "connected",
      time: new Date().toISOString(),
    });
  } catch (e) {
    res.status(503).json({ status: "ERROR", error: e.message });
  }
});

/* ---------- 404 ---------- */
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

export default app;

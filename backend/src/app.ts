
import organizationRoutes from "./routes/organization.routes";
import express from "express";
import cors from "cors";
import helmet from "helmet";

import pool from "./config/database";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({
    success: true,
    message: "Recruitment Workflow API is running",
  });
});

app.get("/api/health/db", async (_req, res) => {
  try {
    const [rows] = await pool.query("SELECT 1 AS result");

    res.json({
      success: true,
      message: "Database connection successful",
      data: rows,
    });

  } catch (error) {
    console.error("Database connection failed:", error);

    res.status(500).json({
      success: false,
      message: "Database connection failed",
    });
    
  }
});


app.use("/api/organizations", organizationRoutes);

const PORT = process.env.PORT || 5000;



app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
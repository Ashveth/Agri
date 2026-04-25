import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

async function startServer() {
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/market-data", (req, res) => {
    // Simulated market data that would come from a database
    const trends = [
      { id: 1, title: "Tomato prices set to rise!", description: "High demand expected in Nashik market next week.", type: "warning" },
      { id: 2, title: "Onion supply increasing", description: "Lasalgaon mandi reports high arrivals, prices might stabilize.", type: "info" },
      { id: 3, title: "Export demand for Mangoes", description: "Global demand hitting record highs this season.", type: "success" }
    ];
    res.json(trends);
  });

  app.post("/api/save-prediction", (req, res) => {
    // In a real app, we would save to Firestore/DB here
    console.log("Saving prediction:", req.body);
    res.status(201).json({ status: "success", message: "Prediction saved to history" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        host: '0.0.0.0',
        port: PORT
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Note: In Express v4, use app.get('*', ...). In Express v5, use app.get('*all', ...)
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Only listen if not handled by a platform (like Vercel functions which handle listening)
  if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  }
}

startServer();

export default app;

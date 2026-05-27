import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Mock database for alerts (in-memory for demo)
  const alerts: any[] = [];
  
  // Staff credentials
  let staffCreds = {
    id: "Hotel 123",
    pass: "hotel@123"
  };

  // Cooldown tracking (IP-based)
  const cooldowns: Record<string, { count: number, lastFalseReport: number }> = {};
  
  // Fake request counts per IP (Blocked if count > 2)
  const fakeCounts: Record<string, number> = {};

  const isBlockedIp = (ip: string) => {
    return (fakeCounts[ip] || 0) > 2;
  };

  // API routes
  app.post("/api/auth/login", (req, res) => {
    const { id, pass } = req.body;
    if (id === staffCreds.id && pass === staffCreds.pass) {
      res.json({ success: true, token: "mock-session-token-" + Date.now() });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  });

  app.post("/api/auth/change-password", (req, res) => {
    const { oldPass, newPass, newId } = req.body;
    if (oldPass === staffCreds.pass) {
      staffCreds.pass = newPass;
      if (newId) staffCreds.id = newId;
      res.json({ success: true });
    } else {
      res.status(401).json({ error: "Incorrect current password" });
    }
  });

  app.get("/api/cooldown", (req, res) => {
    const ip = req.ip || "unknown";
    const status = cooldowns[ip] || { count: 0, lastFalseReport: 0 };
    
    let cooldownRemaining = 0;
    if (status.count >= 3) {
      const cooldownTime = Math.pow(2, status.count - 3) * 60 * 1000; // Progressing cooldown: 1m, 2m, 4m...
      const elapsed = Date.now() - status.lastFalseReport;
      cooldownRemaining = Math.max(0, cooldownTime - elapsed);
    }
    
    res.json({ 
      count: status.count, 
      cooldownRemaining,
      blocked: isBlockedIp(ip),
      fakeCount: fakeCounts[ip] || 0
    });
  });

  app.get("/api/alerts", (req, res) => {
    res.json(alerts);
  });

  app.post("/api/alerts", (req, res) => {
    const ip = req.ip || "unknown";
    
    if (isBlockedIp(ip)) {
      return res.status(403).json({ error: "Your IP address is blocked due to excessive false/fake reports limit (max 2)." });
    }

    const { isEmergency, isHousekeeping } = req.body;

    // Handle cooldown for false reports
    if (!isEmergency) {
      if (!cooldowns[ip]) cooldowns[ip] = { count: 0, lastFalseReport: 0 };
      cooldowns[ip].count++;
      cooldowns[ip].lastFalseReport = Date.now();
      
      if (!fakeCounts[ip]) fakeCounts[ip] = 0;
      fakeCounts[ip]++;
      
      const blocked = isBlockedIp(ip);
      return res.status(200).json({ 
        success: true, 
        message: "False report logged for cooldown tracking.",
        blocked,
        reasons: "Not an emergency."
      });
    }

    const newAlert = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      status: "pending",
      ip: ip,
      ...req.body
    };
    alerts.unshift(newAlert);
    
    // Log the "notification" that would be sent
    console.log(`[NOTIFICATION SENT] to Staff/Manager/Authorities for alert ${newAlert.id}`);
    console.log(`Type: ${newAlert.category}`);
    console.log(`Message: ${newAlert.message}`);
    
    res.status(201).json(newAlert);
  });

  app.patch("/api/alerts/:id", (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const alertIndex = alerts.findIndex(a => a.id === id);
    if (alertIndex !== -1) {
      const oldStatus = alerts[alertIndex].status;
      alerts[alertIndex].status = status;
      
      // If staff marks request as fake, increment fake count for sender IP!
      if (status === 'fake' && oldStatus !== 'fake') {
        const senderIp = alerts[alertIndex].ip || "unknown";
        if (senderIp !== "unknown") {
          if (!fakeCounts[senderIp]) fakeCounts[senderIp] = 0;
          fakeCounts[senderIp]++;
        }
      }
      
      res.json(alerts[alertIndex]);
    } else {
      res.status(404).json({ error: "Alert not found" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

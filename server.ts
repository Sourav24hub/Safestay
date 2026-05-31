import 'dotenv/config';


/*
SUPABASE SCHEMA - Run this in Supabase SQL editor:

create table providers (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  type text not null,
  email text unique not null,
  login_id text unique not null,
  password_hash text not null,
  created_at timestamp default now()
);

create table alerts (
  id uuid default gen_random_uuid() primary key,
  provider_id uuid references providers(id),
  message text,
  room_number text,
  category text,
  severity text,
  summary text,
  suggested_action text,
  authorities_to_notify jsonb,
  is_emergency boolean,
  is_housekeeping boolean,
  status text default 'pending',
  ip text,
  timestamp timestamp default now()
);

create table blocked_ips (
  id uuid default gen_random_uuid() primary key,
  ip text not null,
  provider_id uuid references providers(id),
  fake_count int default 0,
  cooldown_count int default 0,
  last_false_report timestamp,
  blocked_at timestamp default now(),
  unique(ip, provider_id)
);
*/

import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
// 🔥 GEMINI SERVICE INTEGRATION: Backend par AI triage ko import kiya
import { analyzeEmergency } from "./src/services/geminiService";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { supabase } from "./src/lib/supabaseClient";
import { Resend } from 'resend';

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

  // In-memory OTP store: email -> { otp, expiry }
  const otpStore = new Map<string, { otp: string; expiry: number }>();

  // Resend email client
  const resend = new Resend(process.env.RESEND_API_KEY || '');

  const isBlockedIp = (key: string) => {
    return (fakeCounts[key] || 0) > 2;
  };

  // ─── PROVIDER ROUTES ────────────────────────────────────────────────────────

  // POST /api/providers/signup
  app.post("/api/providers/signup", async (req, res) => {
    const { name, type, email, loginId, password, staffId, staffPassword } = req.body;

    try {
      const passwordHash = await bcrypt.hash(password, 10);

      const { data, error } = await supabase
        .from("providers")
        .insert([{ name, type, email, login_id: loginId, password_hash: passwordHash, staff_id: staffId, staff_password: staffPassword }])
        .select("id, name, type, login_id")
        .single();

      if (error) {
        if (error.message.includes("login_id")) {
          return res.status(409).json({ error: "Login ID already exists" });
        }
        if (error.message.includes("email")) {
          return res.status(409).json({ error: "Email already registered" });
        }
        throw error;
      }

      return res.json({
        success: true,
        provider: { id: data.id, name: data.name, type: data.type, loginId: data.login_id }
      });
    } catch (err) {
      console.error("Signup error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // POST /api/providers/login
  app.post("/api/providers/login", async (req, res) => {
    const { loginId, password } = req.body;

    try {
      const { data: provider, error } = await supabase
        .from("providers")
        .select("*")
        .eq("login_id", loginId)
        .single();

      if (error || !provider) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const passwordMatch = await bcrypt.compare(password, provider.password_hash);
      if (!passwordMatch) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const token = jwt.sign(
        { providerId: provider.id, loginId: provider.login_id, name: provider.name },
        process.env.JWT_SECRET || "",
        { expiresIn: "7d" }
      );

      return res.json({
        success: true,
        token,
        provider: {
          id: provider.id,
          name: provider.name,
          type: provider.type,
          email: provider.email,
          loginId: provider.login_id
        }
      });
    } catch (err) {
      console.error("Login error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // POST /api/providers/forgot-password
  app.post("/api/providers/forgot-password", async (req, res) => {
    const { email } = req.body;

    try {
      const { data: provider, error } = await supabase
        .from("providers")
        .select("id, name")
        .eq("email", email)
        .single();

      if (error || !provider) {
        return res.status(404).json({ error: "Email not found. Please check the email you registered with." });
      }

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      otpStore.set(email, { otp, expiry: Date.now() + 600000 });

      console.log("OTP for", email, ":", otp);

      try {
        await resend.emails.send({
          from: 'SafeStay Hub <onboarding@resend.dev>',
          to: email,
          subject: "SafeStay Hub - Password Reset OTP",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #f9fafb; border-radius: 16px;">
              <div style="text-align: center; margin-bottom: 24px;">
                <div style="background: #dc2626; width: 56px; height: 56px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px;">
                  <span style="color: white; font-size: 24px;">🛡️</span>
                </div>
                <h1 style="color: #1a1a1a; font-size: 22px; margin: 0;">SafeStay Hub</h1>
                <p style="color: #6b7280; margin: 4px 0 0;">Password Reset Request</p>
              </div>
              <div style="background: white; border-radius: 12px; padding: 24px; border: 1px solid #e5e7eb;">
                <p style="color: #374151; margin: 0 0 16px;">Hello <strong>${provider.name}</strong>,</p>
                <p style="color: #374151; margin: 0 0 24px;">Your OTP for resetting your SafeStay Hub password is:</p>
                <div style="background: #fef2f2; border: 2px dashed #dc2626; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
                  <span style="font-size: 36px; font-weight: 900; color: #dc2626; letter-spacing: 8px;">${otp}</span>
                </div>
                <p style="color: #6b7280; font-size: 13px; margin: 0;">This OTP expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
              </div>
              <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 16px;">
                If you did not request this, please ignore this email.
              </p>
            </div>
          `
        });
        console.log("OTP email sent successfully to", email);
      } catch (emailError) {
        console.error("Failed to send OTP email:", emailError);
        // Still return success — OTP is logged to console as fallback
      }

      return res.json({ success: true, message: "OTP sent to your registered email address." });
    } catch (err) {
      console.error("Forgot password error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // POST /api/providers/staff-login
  app.post("/api/providers/staff-login", async (req, res) => {
    const { providerId, staffId, staffPassword } = req.body;
    try {
      const { data: provider, error } = await supabase
        .from("providers")
        .select("staff_id, staff_password")
        .eq("id", providerId)
        .single();
      if (error || !provider) {
        return res.status(404).json({ error: "Provider not found" });
      }
      if (provider.staff_id === staffId && provider.staff_password === staffPassword) {
        return res.json({ success: true });
      }
      return res.status(401).json({ error: "Invalid staff credentials" });
    } catch (err) {
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // POST /api/providers/staff-change-password
  app.post("/api/providers/staff-change-password", async (req, res) => {
    const { providerId, oldStaffPassword, newStaffId, newStaffPassword } = req.body;
    try {
      const { data: provider, error } = await supabase
        .from("providers")
        .select("staff_password")
        .eq("id", providerId)
        .single();
      if (error || !provider) {
        return res.status(404).json({ error: "Provider not found" });
      }
      if (provider.staff_password !== oldStaffPassword) {
        return res.status(401).json({ error: "Incorrect current staff password" });
      }
      const updates: any = { staff_password: newStaffPassword };
      if (newStaffId) updates.staff_id = newStaffId;
      await supabase.from("providers").update(updates).eq("id", providerId);
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // POST /api/providers/verify-otp
  app.post("/api/providers/verify-otp", async (req, res) => {
    const { email, otp, newPassword } = req.body;

    const stored = otpStore.get(email);
    if (!stored || stored.otp !== otp || Date.now() > stored.expiry) {
      return res.status(400).json({ error: "Invalid or expired OTP" });
    }

    try {
      const passwordHash = await bcrypt.hash(newPassword, 10);

      const { error } = await supabase
        .from("providers")
        .update({ password_hash: passwordHash })
        .eq("email", email);

      if (error) throw error;

      otpStore.delete(email);

      return res.json({ success: true });
    } catch (err) {
      console.error("Verify OTP error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET /api/providers
  app.get("/api/providers", async (req, res) => {
    try {
      const { data, error } = await supabase
        .from("providers")
        .select("id, name, type, login_id");

      if (error) throw error;

      const providers = (data || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        loginId: p.login_id
      }));

      return res.json(providers);
    } catch (err) {
      console.error("Get providers error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // ─── EXISTING ROUTES ─────────────────────────────────────────────────────────

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
    const providerId = req.query.providerId as string;

    if (!providerId) {
      return res.json({ count: 0, cooldownRemaining: 0, blocked: false, fakeCount: 0 });
    }

    const key = `${ip}_${providerId}`;
    const status = cooldowns[key] || { count: 0, lastFalseReport: 0 };
    
    let cooldownRemaining = 0;
    if (status.count >= 3) {
      const cooldownTime = Math.pow(2, status.count - 3) * 60 * 1000; // Progressing cooldown: 1m, 2m, 4m...
      const elapsed = Date.now() - status.lastFalseReport;
      cooldownRemaining = Math.max(0, cooldownTime - elapsed);
    }
    
    res.json({ 
      count: status.count, 
      cooldownRemaining,
      blocked: isBlockedIp(key),
      fakeCount: fakeCounts[key] || 0
    });
  });

  app.get("/api/alerts", (req, res) => {
    const providerId = req.query.providerId as string;
    if (!providerId) return res.json([]);
    const filtered = alerts.filter(a => a.providerId === providerId);
    res.json(filtered);
  });

  // GET /api/blocked-ips
  app.get("/api/blocked-ips", (req, res) => {
    const providerId = req.query.providerId as string;
    if (!providerId) return res.json([]);
    const suffix = `_${providerId}`;
    const result: any[] = [];
    const seen = new Set<string>();
    for (const key of Object.keys(fakeCounts)) {
      if (key.endsWith(suffix)) {
        const ip = key.slice(0, key.length - suffix.length);
        if (!seen.has(ip)) {
          seen.add(ip);
          const cd = cooldowns[key] || { count: 0, lastFalseReport: 0 };
          result.push({
            ip,
            fakeCount: fakeCounts[key] || 0,
            cooldownCount: cd.count,
            lastFalseReport: cd.lastFalseReport
          });
        }
      }
    }
    for (const key of Object.keys(cooldowns)) {
      if (key.endsWith(suffix)) {
        const ip = key.slice(0, key.length - suffix.length);
        if (!seen.has(ip)) {
          seen.add(ip);
          const cd = cooldowns[key];
          result.push({
            ip,
            fakeCount: fakeCounts[key] || 0,
            cooldownCount: cd.count,
            lastFalseReport: cd.lastFalseReport
          });
        }
      }
    }
    res.json(result);
  });

  // DELETE /api/blocked-ips/:ip
  app.delete("/api/blocked-ips/:ip", (req, res) => {
    const ip = req.params.ip;
    const providerId = req.query.providerId as string;
    if (!providerId) return res.status(400).json({ error: 'providerId required' });
    const key = `${ip}_${providerId}`;
    delete fakeCounts[key];
    delete cooldowns[key];
    res.json({ success: true });
  });

  // 🔥 UPDATED ENDPOINT: Ab ye route async hai aur Gemini AI ko backend se call karta hai
  app.post("/api/alerts", async (req, res) => {
    const ip = req.ip || "unknown";
    const { message, roomNumber, providerId } = req.body;
    const key = providerId ? `${ip}_${providerId}` : ip;

    if (isBlockedIp(key)) {
      return res.status(403).json({ error: "Your IP address is blocked due to excessive false/fake reports limit (max 2)." });
    }

    try {
      const analysis = await analyzeEmergency(message);

      if (!analysis.isEmergency) {
        if (!cooldowns[key]) cooldowns[key] = { count: 0, lastFalseReport: 0 };
        cooldowns[key].count++;
        cooldowns[key].lastFalseReport = Date.now();
        
        if (!fakeCounts[key]) fakeCounts[key] = 0;
        fakeCounts[key]++;
        
        const blocked = isBlockedIp(key);
        return res.status(200).json({ 
          success: true, 
          message: "False report logged for cooldown tracking.",
          blocked,
          reasons: "Not an emergency according to Gemini AI."
        });
      }

      const newAlert = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        status: "pending",
        ip: ip,
        providerId: providerId || null,
        message,
        roomNumber: roomNumber || 'Unknown',
        ...analysis 
      };
      alerts.unshift(newAlert);
      
      console.log(`[NOTIFICATION SENT] to Staff/Manager/Authorities for alert ${newAlert.id}`);
      console.log(`Type: ${newAlert.category}`);
      console.log(`Severity: ${newAlert.severity}`);
      console.log(`Message: ${newAlert.message}`);
      
      return res.status(201).json(newAlert);

    } catch (error) {
      console.error("Backend AI Triage Error:", error);
      return res.status(500).json({ error: "Internal AI Triage Process Failed" });
    }
  });

  app.patch("/api/alerts/:id", (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const alertIndex = alerts.findIndex(a => a.id === id);
    if (alertIndex !== -1) {
      const oldStatus = alerts[alertIndex].status;
      alerts[alertIndex].status = status;
      
      if (status === 'fake' && oldStatus !== 'fake') {
        const senderIp = alerts[alertIndex].ip || "unknown";
        const senderProviderId = alerts[alertIndex].providerId;
        if (senderIp !== "unknown") {
          const key = senderProviderId ? `${senderIp}_${senderProviderId}` : senderIp;
          if (!fakeCounts[key]) fakeCounts[key] = 0;
          fakeCounts[key]++;
        }
      }
      
      res.json(alerts[alertIndex]);
    } else {
      res.status(404).json({ error: "Alert not found" });
    }
  });

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
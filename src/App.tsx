import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  Shield, 
  Flame, 
  Stethoscope, 
  MessageSquare, 
  Send, 
  CheckCircle2, 
  Clock, 
  Phone, 
  Bell,
  LayoutDashboard,
  History,
  Settings as SettingsIcon,
  ChevronRight,
  AlertCircle,
  Lock,
  User,
  Key,
  LogOut,
  RefreshCw,
  Ban,
  Trash2,
  Mic,
  MicOff,
  Globe,
  Building2,
  ArrowLeft,
  Hotel,
  UtensilsCrossed,
  MapPin
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { analyzeEmergency, EmergencyAnalysis, localHeuristicAnalysis } from './services/geminiService';

// Types
interface Alert extends EmergencyAnalysis {
  id: string;
  timestamp: string;
  message: string;
  status: 'pending' | 'dispatched' | 'resolved' | 'fake';
  roomNumber?: string;
}

const CATEGORY_COLORS = {
  Medical: '#ef4444',
  Fire: '#f97316',
  Security: '#8b5cf6',
  Hazard: '#3b82f6',
  Other: '#6b7280'
};

const SEVERITY_COLORS = {
  Low: '#10b981',
  Medium: '#f59e0b',
  High: '#ef4444',
  Critical: '#7f1d1d'
};

export default function App() {
  // ── New multi-screen state ──────────────────────────────────────────────────
  const [appView, setAppView] = useState<'landing' | 'providerAuth' | 'guestSelectProvider' | 'guest' | 'staff'>('landing');
  const [authTab, setAuthTab] = useState<'login' | 'signup'>('login');
  const [providerSession, setProviderSession] = useState<{ token: string, provider: { id: string, name: string, type: string, loginId: string } } | null>(null);
  const [providers, setProviders] = useState<{ id: string, name: string, type: string, loginId: string }[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<{ id: string, name: string, type: string } | null>(null);
  const [forgotStep, setForgotStep] = useState<'none' | 'email' | 'otp'>('none');

  // Signup form fields
  const [signupName, setSignupName] = useState('');
  const [signupType, setSignupType] = useState('Hotel');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupLoginId, setSignupLoginId] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirm, setSignupConfirm] = useState('');
  const [signupError, setSignupError] = useState('');

  // Forgot password fields
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotNewPass, setForgotNewPass] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');

  // ── Existing state ──────────────────────────────────────────────────────────
  const [view, setView] = useState<'guest' | 'staff'>('guest');
  const [message, setMessage] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'history' | 'stats' | 'blocked'>('active');
  const [showFlash, setShowFlash] = useState(false);
  const [flashMessage, setFlashMessage] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isIpBlocked, setIsIpBlocked] = useState(false);
  const [fakeCount, setFakeCount] = useState(0);
  const [isStaffLoggedIn, setIsStaffLoggedIn] = useState(false);
  const [loginId, setLoginId] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [newPass, setNewPass] = useState('');
  const [newId, setNewId] = useState('');
  const [oldPass, setOldPass] = useState('');
  const [settingsStatus, setSettingsStatus] = useState('');
  
  // Voice & Translation States
  const [isRecording, setIsRecording] = useState(false);
  const [recordingLanguage, setRecordingLanguage] = useState('en-US');
  const [voiceError, setVoiceError] = useState('');
  const [recognitionInstance, setRecognitionInstance] = useState<any>(null);
  
  // LocalStorage Fallback state
  const [useLocalStorageFallback, setUseLocalStorageFallback] = useState(false);

  // ── Staff PIN state ─────────────────────────────────────────────────────────
  const [staffPinVerified, setStaffPinVerified] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [showChangePinForm, setShowChangePinForm] = useState(false);
  const [oldPinInput, setOldPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [pinChangeStatus, setPinChangeStatus] = useState('');

  // ── Blocked IPs state ───────────────────────────────────────────────────────
  const [blockedIps, setBlockedIps] = useState<{ ip: string, fakeCount: number, cooldownCount: number, lastFalseReport: string }[]>([]);
  const [blockedIpsLoading, setBlockedIpsLoading] = useState(false);

  // LocalStorage helper utilities for robust hosting fallbacks
  const getLocalAlerts = (pid?: string): Alert[] => {
    const key = pid ? `safestay_alerts_fb_${pid}` : 'safestay_alerts_fb';
    const data = localStorage.getItem(key);
    if (data) return JSON.parse(data);
    const defaults: Alert[] = [
      {
        id: "demo-1",
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        status: "pending",
        isEmergency: true,
        isHousekeeping: false,
        message: "Smoke detected in lobby power outlet panel. Possible Hazard.",
        roomNumber: "Lobby Reception Area",
        category: "Fire",
        severity: "High",
        summary: "Smoke in power outlet panel",
        suggestedAction: "Retrieve ABC Fire Extinguisher. Isolate main branch breaker.",
        authoritiesToNotify: ["Local Emergency Dispatcher"]
      }
    ];
    localStorage.setItem(key, JSON.stringify(defaults));
    return defaults;
  };

  const saveLocalAlerts = (updatedAlerts: Alert[], pid?: string) => {
    const key = pid ? `safestay_alerts_fb_${pid}` : 'safestay_alerts_fb';
    localStorage.setItem(key, JSON.stringify(updatedAlerts));
  };

  const getLocalCreds = () => {
    const data = localStorage.getItem('safestay_creds_fb');
    if (data) return JSON.parse(data);
    const defaults = { id: "Hotel 123", pass: "hotel@123" };
    localStorage.setItem('safestay_creds_fb', JSON.stringify(defaults));
    return defaults;
  };

  const saveLocalCreds = (creds: { id: string, pass: string }) => {
    localStorage.setItem('safestay_creds_fb', JSON.stringify(creds));
  };

  const getLocalFalseReportCount = (pid?: string): number => {
    const key = pid ? `safestay_false_count_fb_${pid}` : 'safestay_false_count_fb';
    return parseInt(localStorage.getItem(key) || '0', 10);
  };

  const setLocalFalseReportCount = (count: number, pid?: string) => {
    const key = pid ? `safestay_false_count_fb_${pid}` : 'safestay_false_count_fb';
    localStorage.setItem(key, count.toString());
  };

  const getLocalLastFalseReport = (pid?: string): number => {
    const key = pid ? `safestay_last_false_fb_${pid}` : 'safestay_last_false_fb';
    return parseInt(localStorage.getItem(key) || '0', 10);
  };

  const setLocalLastFalseReport = (time: number, pid?: string) => {
    const key = pid ? `safestay_last_false_fb_${pid}` : 'safestay_last_false_fb';
    localStorage.setItem(key, time.toString());
  };

  const getLocalFakeCount = (pid?: string): number => {
    const key = pid ? `safestay_fake_count_fb_${pid}` : 'safestay_fake_count_fb';
    return parseInt(localStorage.getItem(key) || '0', 10);
  };

  const setLocalFakeCount = (count: number, pid?: string) => {
    const key = pid ? `safestay_fake_count_fb_${pid}` : 'safestay_fake_count_fb';
    localStorage.setItem(key, count.toString());
  };

  // Session management (24h) + provider session restore
  useEffect(() => {
    const session = localStorage.getItem('staffSession');
    if (session) {
      const { token, expiry } = JSON.parse(session);
      if (Date.now() < expiry) {
        setIsStaffLoggedIn(true);
      } else {
        localStorage.removeItem('staffSession');
      }
    }

    const providerSess = localStorage.getItem('safestay_provider_session');
    if (providerSess) {
      const parsed = JSON.parse(providerSess);
      if (Date.now() < parsed.expiry) {
        setProviderSession(parsed);
      } else {
        localStorage.removeItem('safestay_provider_session');
      }
    }
  }, []);

  // Cooldown & Blocklist parameters checking — only when guest view with a selected provider
  useEffect(() => {
    if (appView !== 'guest' || !selectedProvider) return;
    const pid = selectedProvider.id;

    const checkCooldown = async () => {
      if (useLocalStorageFallback) {
        const count = getLocalFalseReportCount(pid);
        const lastFalseReport = getLocalLastFalseReport(pid);
        const fakeTotal = getLocalFakeCount(pid);
        
        let localCooldown = 0;
        if (count >= 3) {
          const cooldownTime = Math.pow(2, count - 3) * 60 * 1000;
          const elapsed = Date.now() - lastFalseReport;
          localCooldown = Math.max(0, cooldownTime - elapsed);
        }
        
        setCooldownRemaining(localCooldown);
        setIsIpBlocked(fakeTotal > 2);
        setFakeCount(fakeTotal);
        return;
      }

      try {
        const res = await fetch(`/api/cooldown?providerId=${pid}`);
        const contentType = res.headers.get("content-type") || "";
        if (res.ok && !contentType.includes("text/html")) {
          const data = await res.json();
          setCooldownRemaining(data.cooldownRemaining);
          setIsIpBlocked(!!data.blocked);
          setFakeCount(data.fakeCount || 0);
        } else {
          setUseLocalStorageFallback(true);
        }
      } catch (err) {
        setUseLocalStorageFallback(true);
      }
    };
    checkCooldown();
    const interval = setInterval(checkCooldown, 5000);
    return () => clearInterval(interval);
  }, [useLocalStorageFallback, appView, selectedProvider]);

  // Fetch alerts on mount and periodically — scoped to the active provider
  useEffect(() => {
    const pid = appView === 'guest'
      ? selectedProvider?.id
      : appView === 'staff' && isStaffLoggedIn
        ? providerSession?.provider.id
        : undefined;

    if (!pid) return;

    fetchAlerts(pid);
    const interval = setInterval(() => fetchAlerts(pid), 5000);
    return () => clearInterval(interval);
  }, [useLocalStorageFallback, appView, selectedProvider, isStaffLoggedIn, providerSession]);

  const fetchAlerts = async (providerId?: string) => {
    if (!providerId) return;
    try {
      const res = await fetch(`/api/alerts?providerId=${providerId}`);
      const contentType = res.headers.get("content-type") || "";
      if (res.ok && !contentType.includes("text/html")) {
        const data = await res.json();
        setAlerts(data);
        setUseLocalStorageFallback(false);
      } else {
        setUseLocalStorageFallback(true);
        setAlerts(getLocalAlerts(providerId));
      }
    } catch (err) {
      setUseLocalStorageFallback(true);
      setAlerts(getLocalAlerts(providerId));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    if (cooldownRemaining > 0) return;
    if (isIpBlocked) return;

    setIsSubmitting(true);
    try {
      // 1. Analyze with Gemini or Local heuristic sandbox
      const analysis = await analyzeEmergency(message);
      
      // 2. Filter out housekeeping or non-emergencies
      if (!analysis.isEmergency) {
        if (useLocalStorageFallback) {
          const pid = selectedProvider?.id;
          const newFalseCount = getLocalFalseReportCount(pid) + 1;
          setLocalFalseReportCount(newFalseCount, pid);
          setLocalLastFalseReport(Date.now(), pid);
          
          const newFakeTotal = getLocalFakeCount(pid) + 1;
          setLocalFakeCount(newFakeTotal, pid);
          
          if (newFakeTotal > 2) {
            setIsIpBlocked(true);
          }
          setFakeCount(newFakeTotal);
        } else {
          // Notify backend of false report to track cooldown
          const falseRes = await fetch('/api/alerts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              isEmergency: false,
              isHousekeeping: analysis.isHousekeeping,
              message,
              roomNumber: roomNumber || 'Unknown',
              providerId: selectedProvider?.id
            })
          });

          if (falseRes.status === 403) {
            setIsIpBlocked(true);
            setIsSubmitting(false);
            return;
          }
        }

        if (analysis.isHousekeeping) {
          setFlashMessage("⚠️ This portal is for CRITICAL EMERGENCIES ONLY. For housekeeping, room service, or routine maintenance, please call the front desk.");
        } else {
          setFlashMessage("This message does not appear to be an emergency. Please contact the front desk for non-urgent requests.");
        }
        setShowFlash(true);
        setIsSubmitting(false);
        return;
      }
      
      // 3. Submit alert logs
      if (useLocalStorageFallback) {
        const pid = selectedProvider?.id;
        const localAlerts = getLocalAlerts(pid);
        const newAlert: Alert = {
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
          status: 'pending',
          isEmergency: analysis.isEmergency,
          isHousekeeping: analysis.isHousekeeping,
          message,
          roomNumber: roomNumber || 'Unknown',
          category: analysis.category,
          severity: analysis.severity,
          summary: analysis.summary,
          suggestedAction: analysis.suggestedAction,
          authoritiesToNotify: analysis.authoritiesToNotify
        };
        localAlerts.unshift(newAlert);
        saveLocalAlerts(localAlerts, pid);
        setAlerts(localAlerts);
        
        setMessage('');
        setRoomNumber('');
        setShowSuccessModal(true);
      } else {
        const res = await fetch('/api/alerts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...analysis,
            message,
            roomNumber: roomNumber || 'Unknown',
            providerId: selectedProvider?.id
          })
        });

        if (res.status === 403) {
          setIsIpBlocked(true);
          setIsSubmitting(false);
          return;
        }

        if (res.ok) {
          setMessage('');
          setRoomNumber('');
          setShowSuccessModal(true);
          fetchAlerts(selectedProvider?.id);
        }
      }
    } catch (err) {
      console.error("Failed to submit alert, falling back to offline mode", err);
      setUseLocalStorageFallback(true);
      
      // Classify locally
      const analysis = localHeuristicAnalysis(message);
      const pid = selectedProvider?.id;
      
      const localAlerts = getLocalAlerts(pid);
      const newAlert: Alert = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        status: 'pending',
        isEmergency: analysis.isEmergency,
        isHousekeeping: analysis.isHousekeeping,
        message,
        roomNumber: roomNumber || 'Unknown',
        category: analysis.category,
        severity: analysis.severity,
        summary: analysis.summary,
        suggestedAction: analysis.suggestedAction,
        authoritiesToNotify: analysis.authoritiesToNotify
      };
      
      if (!analysis.isEmergency) {
        const newFalseCount = getLocalFalseReportCount(pid) + 1;
        setLocalFalseReportCount(newFalseCount, pid);
        setLocalLastFalseReport(Date.now(), pid);
        
        const newFakeTotal = getLocalFakeCount(pid) + 1;
        setLocalFakeCount(newFakeTotal, pid);
        
        if (newFakeTotal > 2) {
          setIsIpBlocked(true);
        }
        setFakeCount(newFakeTotal);
        
        if (analysis.isHousekeeping) {
          setFlashMessage("⚠️ This portal is for CRITICAL EMERGENCIES ONLY. For housekeeping, room service, or routine maintenance, please call the front desk.");
        } else {
          setFlashMessage("This message does not appear to be an emergency. Please contact the front desk for non-urgent requests.");
        }
        setShowFlash(true);
      } else {
        localAlerts.unshift(newAlert);
        saveLocalAlerts(localAlerts, pid);
        setAlerts(localAlerts);
        setMessage('');
        setRoomNumber('');
        setShowSuccessModal(true);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateStatus = async (id: string, status: Alert['status']) => {
    const pid = providerSession?.provider.id;
    if (useLocalStorageFallback) {
      const localAlerts = getLocalAlerts(pid);
      const idx = localAlerts.findIndex(a => a.id === id);
      if (idx !== -1) {
        const oldStatus = localAlerts[idx].status;
        localAlerts[idx].status = status;
        
        if (status === 'fake' && oldStatus !== 'fake') {
          const newFake = getLocalFakeCount(pid) + 1;
          setLocalFakeCount(newFake, pid);
          if (newFake > 2) {
            setIsIpBlocked(true);
          }
          setFakeCount(newFake);
        }
        saveLocalAlerts(localAlerts, pid);
        setAlerts(localAlerts);
      }
      return;
    }

    try {
      await fetch(`/api/alerts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, providerId: pid })
      });
      fetchAlerts(pid);
    } catch (err) {
      console.error("Failed to update status", err);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    
    const tryLocalLoginFallback = () => {
      setUseLocalStorageFallback(true);
      const creds = getLocalCreds();
      if (loginId === creds.id && loginPass === creds.pass) {
        setIsStaffLoggedIn(true);
        localStorage.setItem('staffSession', JSON.stringify({
          token: "mock-session-fallback-token",
          expiry: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
        }));
      } else {
        setLoginError("Invalid credentials");
      }
    };

    if (useLocalStorageFallback) {
      tryLocalLoginFallback();
      return;
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: loginId, pass: loginPass })
      });
      
      const contentType = res.headers.get("content-type") || "";
      if (res.ok && contentType.includes("application/json")) {
        const data = await res.json();
        setIsStaffLoggedIn(true);
        localStorage.setItem('staffSession', JSON.stringify({
          token: data.token,
          expiry: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
        }));
      } else {
        // Fall back gracefully if 404/HTML (e.g. static hosting on Netlify)
        if (res.status === 404 || contentType.includes("text/html")) {
          tryLocalLoginFallback();
        } else {
          try {
            const data = await res.json();
            setLoginError(data.error || "Login failed");
          } catch (jsonErr) {
            tryLocalLoginFallback();
          }
        }
      }
    } catch (err) {
      console.warn("Login endpoint not reachable. Falling back to local credentials.", err);
      tryLocalLoginFallback();
    }
  };

  const handleLogout = () => {
    setIsStaffLoggedIn(false);
    localStorage.removeItem('staffSession');
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsStatus('');
    
    if (useLocalStorageFallback) {
      const creds = getLocalCreds();
      if (oldPass === creds.pass) {
        const updated = {
          id: newId ? newId : creds.id,
          pass: newPass
        };
        saveLocalCreds(updated);
        setSettingsStatus("Credentials updated successfully.");
        setOldPass('');
        setNewPass('');
        setNewId('');
      } else {
        setSettingsStatus("Incorrect current password");
      }
      return;
    }

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPass, newPass, newId })
      });
      if (res.ok) {
        setSettingsStatus("Credentials updated successfully.");
        setOldPass('');
        setNewPass('');
        setNewId('');
      } else {
        const data = await res.json();
        setSettingsStatus(data.error);
      }
    } catch (err) {
      setSettingsStatus("Failed to update credentials.");
    }
  };

  const toggleVoiceRecording = () => {
    if (isRecording) {
      if (recognitionInstance) {
        recognitionInstance.stop();
      }
      setIsRecording(false);
      return;
    }

    setVoiceError('');
    const SpeechRecognitionInterface = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionInterface) {
      setVoiceError("Your browser does not support Speech Recognition. Please try using modern Google Chrome or Safari.");
      return;
    }

    try {
      const recognition = new SpeechRecognitionInterface();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = recordingLanguage;

      recognition.onstart = () => {
        setIsRecording(true);
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event);
        if (event.error === 'not-allowed') {
          setVoiceError("Microphone access blocked. Please check your browser's security/microphone permissions.");
        } else {
          setVoiceError(`Error during speech transcription: ${event.error}`);
        }
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognition.onresult = (event: any) => {
        let finalTranscripts = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscripts += event.results[i][0].transcript + ' ';
          }
        }
        
        if (finalTranscripts) {
          setMessage((prev) => {
            const trimmed = prev.trim();
            return trimmed ? `${trimmed} ${finalTranscripts.trim()}` : finalTranscripts.trim();
          });
        }
      };

      recognition.start();
      setRecognitionInstance(recognition);
    } catch (err: any) {
      console.error(err);
      setVoiceError("Failed to initialize recording system.");
      setIsRecording(false);
    }
  };

  useEffect(() => {
    return () => {
      if (recognitionInstance) {
        recognitionInstance.stop();
      }
    };
  }, [recognitionInstance]);

  const statsData = [
    { name: 'Medical', value: alerts.filter(a => a.category === 'Medical').length },
    { name: 'Fire', value: alerts.filter(a => a.category === 'Fire').length },
    { name: 'Security', value: alerts.filter(a => a.category === 'Security').length },
    { name: 'Hazard', value: alerts.filter(a => a.category === 'Hazard' || a.category === 'Maintenance').length },
  ];

  // ── New handler functions ───────────────────────────────────────────────────

  const handleProviderSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupError('');
    if (signupPassword !== signupConfirm) {
      setSignupError('Passwords do not match');
      return;
    }
    try {
      const res = await fetch('/api/providers/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: signupName,
          type: signupType,
          email: signupEmail,
          loginId: signupLoginId,
          password: signupPassword
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setSignupError(data.error || 'Signup failed');
        return;
      }
      // Auto login after signup
      const loginRes = await fetch('/api/providers/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginId: signupLoginId, password: signupPassword })
      });
      const loginData = await loginRes.json();
      if (loginRes.ok) {
        const session = { token: loginData.token, provider: loginData.provider, expiry: Date.now() + 7 * 24 * 60 * 60 * 1000 };
        setProviderSession(session);
        localStorage.setItem('safestay_provider_session', JSON.stringify(session));
        setAppView('staff');
      }
    } catch (err) {
      setSignupError('Network error. Please try again.');
    }
  };

  const handleProviderLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch('/api/providers/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginId: loginId, password: loginPass })
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || 'Login failed');
        return;
      }
      const session = { token: data.token, provider: data.provider, expiry: Date.now() + 7 * 24 * 60 * 60 * 1000 };
      setProviderSession(session);
      localStorage.setItem('safestay_provider_session', JSON.stringify(session));
      setAppView('staff');
    } catch (err) {
      setLoginError('Network error. Please try again.');
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    try {
      const res = await fetch('/api/providers/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail })
      });
      const data = await res.json();
      if (!res.ok) {
        setForgotError(data.error || 'Email not found');
        return;
      }
      setForgotStep('otp');
    } catch (err) {
      setForgotError('Network error.');
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    try {
      const res = await fetch('/api/providers/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail, otp: forgotOtp, newPassword: forgotNewPass })
      });
      const data = await res.json();
      if (!res.ok) {
        setForgotError(data.error || 'Invalid OTP');
        return;
      }
      setForgotSuccess('Password updated successfully. Please login.');
      setForgotStep('none');
      setAuthTab('login');
    } catch (err) {
      setForgotError('Network error.');
    }
  };

  const handleProviderLogout = () => {
    setProviderSession(null);
    localStorage.removeItem('safestay_provider_session');
    setIsStaffLoggedIn(false);
    localStorage.removeItem('staffSession');
    setStaffPinVerified(false);
    setAppView('landing');
  };

  // ── Staff PIN helpers ───────────────────────────────────────────────────────
  const getStaffPin = () => {
    const providerId = providerSession?.provider.id;
    return localStorage.getItem(`safestay_staff_pin_${providerId}`) || 'staff@123';
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');
    if (enteredPin === getStaffPin()) {
      setStaffPinVerified(true);
      setEnteredPin('');
    } else {
      setPinError('Incorrect PIN. Please try again.');
    }
  };

  const handleChangePin = (e: React.FormEvent) => {
    e.preventDefault();
    setPinChangeStatus('');
    if (oldPinInput !== getStaffPin()) {
      setPinChangeStatus('Incorrect current PIN.');
      return;
    }
    if (newPinInput.length < 4) {
      setPinChangeStatus('New PIN must be at least 4 characters.');
      return;
    }
    localStorage.setItem(`safestay_staff_pin_${providerSession?.provider.id}`, newPinInput);
    setPinChangeStatus('Staff PIN updated successfully.');
    setOldPinInput('');
    setNewPinInput('');
    setTimeout(() => setShowChangePinForm(false), 1500);
  };

  // ── Blocked IPs helpers ─────────────────────────────────────────────────────
  const fetchBlockedIps = async () => {
    const providerId = providerSession?.provider.id;
    if (!providerId) return;
    setBlockedIpsLoading(true);
    try {
      const res = await fetch(`/api/blocked-ips?providerId=${providerId}`);
      if (res.ok) {
        const data = await res.json();
        setBlockedIps(data);
      }
    } catch (err) {
      console.error('Failed to fetch blocked IPs');
    } finally {
      setBlockedIpsLoading(false);
    }
  };

  const handleUnblockIp = async (ip: string) => {
    const providerId = providerSession?.provider.id;
    if (!providerId) return;
    try {
      const res = await fetch(`/api/blocked-ips/${encodeURIComponent(ip)}?providerId=${providerId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchBlockedIps();
      }
    } catch (err) {
      console.error('Failed to unblock IP');
    }
  };

  const fetchProviders = async () => {
    try {
      const res = await fetch('/api/providers');
      if (res.ok) {
        const data = await res.json();
        setProviders(data);
      }
    } catch (err) {
      console.error('Failed to fetch providers');
    }
  };

  // Auto-refresh blocked IPs every 10s when that tab is active
  useEffect(() => {
    if (appView === 'staff' && staffPinVerified && isStaffLoggedIn && activeTab === 'blocked') {
      fetchBlockedIps();
      const interval = setInterval(fetchBlockedIps, 10000);
      return () => clearInterval(interval);
    }
  }, [appView, staffPinVerified, isStaffLoggedIn, activeTab]);

  // ── Screen: Landing ─────────────────────────────────────────────────────────
  if (appView === 'landing') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0f0f0f] via-[#1a1a2e] to-[#16213e] flex flex-col">
        {/* Header */}
        <nav className="px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-red-600 p-2.5 rounded-xl shadow-lg shadow-red-600/30">
              <Shield className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-white text-xl font-bold tracking-tight">SafeStay Hub</h1>
              <p className="text-red-400 text-[10px] font-semibold uppercase tracking-widest">AI-Powered Emergency Response</p>
            </div>
          </div>
        </nav>

        {/* Hero */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-14 max-w-2xl"
          >
            <div className="inline-flex items-center gap-2 bg-red-600/10 border border-red-500/20 text-red-400 text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full mb-6">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
              Live Emergency System
            </div>
            <h2 className="text-5xl md:text-6xl font-black text-white tracking-tight leading-none mb-4">
              Emergency<br />
              <span className="text-red-500">Response</span> Hub
            </h2>
            <p className="text-gray-400 text-lg leading-relaxed">
              AI-powered crisis management for hotels &amp; restaurants.<br />
              Instant triage. Real-time alerts. Lives protected.
            </p>
          </motion.div>

          {/* Two cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">
            {/* Guest card */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="group relative bg-gradient-to-br from-red-600 to-red-800 rounded-3xl p-8 shadow-2xl shadow-red-900/40 hover:shadow-red-600/40 hover:scale-[1.02] transition-all duration-300 cursor-pointer border border-red-500/20"
              onClick={() => { fetchProviders(); setAppView('guestSelectProvider'); }}
            >
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,100,100,0.2),_transparent_70%)] rounded-3xl" />
              <div className="relative">
                <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center mb-6 group-hover:bg-white/30 transition-colors">
                  <AlertTriangle className="text-white w-7 h-7" />
                </div>
                <h3 className="text-2xl font-black text-white mb-2">Report an Emergency</h3>
                <p className="text-red-200 text-sm mb-8 leading-relaxed">For hotel &amp; restaurant guests experiencing a crisis situation</p>
                <button className="w-full bg-white text-red-700 font-bold py-3.5 rounded-2xl hover:bg-red-50 transition-all text-sm uppercase tracking-wider shadow-lg">
                  Enter as Guest
                </button>
              </div>
            </motion.div>

            {/* Staff card */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.28 }}
              className="group relative bg-gradient-to-br from-gray-800 to-gray-950 rounded-3xl p-8 shadow-2xl shadow-black/60 hover:shadow-gray-700/40 hover:scale-[1.02] transition-all duration-300 cursor-pointer border border-white/8"
              onClick={() => setAppView('providerAuth')}
            >
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(100,100,255,0.08),_transparent_70%)] rounded-3xl" />
              <div className="relative">
                <div className="w-14 h-14 bg-white/10 backdrop-blur rounded-2xl flex items-center justify-center mb-6 group-hover:bg-white/15 transition-colors">
                  <Lock className="text-gray-300 w-7 h-7" />
                </div>
                <h3 className="text-2xl font-black text-white mb-2">Staff &amp; Management</h3>
                <p className="text-gray-400 text-sm mb-8 leading-relaxed">For service providers managing the crisis command dashboard</p>
                <button className="w-full bg-white/10 hover:bg-white/20 text-white font-bold py-3.5 rounded-2xl transition-all text-sm uppercase tracking-wider border border-white/10">
                  Login / Sign Up
                </button>
              </div>
            </motion.div>
          </div>

          {/* Footer note */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-10 text-gray-600 text-xs text-center"
          >
            🚨 Call <strong className="text-gray-400">911 / 112</strong> for immediate life-threatening emergencies
          </motion.p>
        </div>
      </div>
    );
  }

  // ── Screen: Provider Auth ───────────────────────────────────────────────────
  if (appView === 'providerAuth') {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col">
        {/* Back button */}
        <div className="px-6 py-5">
          <button
            onClick={() => { setAppView('landing'); setForgotStep('none'); setForgotError(''); setForgotSuccess(''); setSignupError(''); setLoginError(''); }}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-800 transition-colors text-sm font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </button>
        </div>

        <div className="flex-1 flex items-center justify-center px-6 py-8">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="w-full max-w-md"
          >
            {/* Card header */}
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-100">
                <Shield className="text-red-600 w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Provider Portal</h2>
              <p className="text-gray-500 text-sm mt-1">SafeStay Hub — Staff &amp; Management</p>
            </div>

            <div className="bg-white rounded-3xl shadow-xl border border-black/5 overflow-hidden">
              {/* Tabs */}
              <div className="flex border-b border-gray-100">
                <button
                  onClick={() => { setAuthTab('login'); setForgotStep('none'); setForgotError(''); setForgotSuccess(''); }}
                  className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider transition-all ${authTab === 'login' ? 'text-red-600 border-b-2 border-red-600 bg-red-50/40' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  Login
                </button>
                <button
                  onClick={() => { setAuthTab('signup'); setForgotStep('none'); setForgotError(''); setForgotSuccess(''); }}
                  className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider transition-all ${authTab === 'signup' ? 'text-red-600 border-b-2 border-red-600 bg-red-50/40' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  Sign Up
                </button>
              </div>

              <div className="p-8">
                <AnimatePresence mode="wait">
                  {authTab === 'login' ? (
                    <motion.div key="login" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.2 }}>
                      {forgotStep === 'none' && (
                        <form onSubmit={handleProviderLogin} className="space-y-4">
                          <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1 tracking-wider">Login ID</label>
                            <div className="relative">
                              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                              <input
                                type="text"
                                value={loginId}
                                onChange={(e) => setLoginId(e.target.value)}
                                required
                                placeholder="Your provider login ID"
                                className="w-full bg-gray-50 border-none rounded-xl pl-12 pr-4 py-3 focus:ring-2 focus:ring-red-500 outline-none text-sm"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1 tracking-wider">Password</label>
                            <div className="relative">
                              <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                              <input
                                type="password"
                                value={loginPass}
                                onChange={(e) => setLoginPass(e.target.value)}
                                required
                                placeholder="••••••••"
                                className="w-full bg-gray-50 border-none rounded-xl pl-12 pr-4 py-3 focus:ring-2 focus:ring-red-500 outline-none text-sm"
                              />
                            </div>
                          </div>
                          {loginError && <p className="text-xs text-red-600 font-bold text-center bg-red-50 py-2 rounded-lg">{loginError}</p>}
                          {forgotSuccess && <p className="text-xs text-green-600 font-bold text-center bg-green-50 py-2 rounded-lg">{forgotSuccess}</p>}
                          <button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-xl transition-all uppercase tracking-wider shadow-lg shadow-red-600/20 text-sm">
                            Login
                          </button>
                          <div className="text-center">
                            <button type="button" onClick={() => { setForgotStep('email'); setForgotError(''); setForgotEmail(''); }} className="text-xs text-gray-400 hover:text-red-600 transition-colors font-semibold">
                              Forgot Password?
                            </button>
                          </div>
                        </form>
                      )}

                      {forgotStep === 'email' && (
                        <motion.div key="forgot-email" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                          <div className="text-center mb-2">
                            <p className="text-sm font-bold text-gray-700">Reset Password</p>
                            <p className="text-xs text-gray-400 mt-1">Enter your registered email to receive an OTP</p>
                          </div>
                          <form onSubmit={handleForgotPassword} className="space-y-4">
                            <div>
                              <label className="block text-xs font-bold text-gray-400 uppercase mb-1 tracking-wider">Email Address</label>
                              <input
                                type="email"
                                value={forgotEmail}
                                onChange={(e) => setForgotEmail(e.target.value)}
                                required
                                placeholder="your@email.com"
                                className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-red-500 outline-none text-sm"
                              />
                            </div>
                            {forgotError && <p className="text-xs text-red-600 font-bold text-center bg-red-50 py-2 rounded-lg">{forgotError}</p>}
                            <button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 rounded-xl transition-all text-sm uppercase tracking-wider">
                              Send OTP
                            </button>
                            <div className="text-center">
                              <button type="button" onClick={() => setForgotStep('none')} className="text-xs text-gray-400 hover:text-gray-600 font-semibold">
                                ← Back to login
                              </button>
                            </div>
                          </form>
                        </motion.div>
                      )}

                      {forgotStep === 'otp' && (
                        <motion.div key="forgot-otp" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                          <div className="text-center mb-2">
                            <p className="text-sm font-bold text-gray-700">Enter OTP</p>
                            <p className="text-xs text-gray-400 mt-1">Check the server console for your OTP (sent to {forgotEmail})</p>
                          </div>
                          <form onSubmit={handleVerifyOtp} className="space-y-4">
                            <div>
                              <label className="block text-xs font-bold text-gray-400 uppercase mb-1 tracking-wider">6-Digit OTP</label>
                              <input
                                type="text"
                                value={forgotOtp}
                                onChange={(e) => setForgotOtp(e.target.value)}
                                required
                                maxLength={6}
                                placeholder="000000"
                                className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-red-500 outline-none text-sm text-center tracking-widest font-mono"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-gray-400 uppercase mb-1 tracking-wider">New Password</label>
                              <input
                                type="password"
                                value={forgotNewPass}
                                onChange={(e) => setForgotNewPass(e.target.value)}
                                required
                                placeholder="••••••••"
                                className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-red-500 outline-none text-sm"
                              />
                            </div>
                            {forgotError && <p className="text-xs text-red-600 font-bold text-center bg-red-50 py-2 rounded-lg">{forgotError}</p>}
                            <button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 rounded-xl transition-all text-sm uppercase tracking-wider">
                              Reset Password
                            </button>
                            <div className="text-center">
                              <button type="button" onClick={() => setForgotStep('none')} className="text-xs text-gray-400 hover:text-gray-600 font-semibold">
                                ← Back to login
                              </button>
                            </div>
                          </form>
                        </motion.div>
                      )}
                    </motion.div>
                  ) : (
                    <motion.div key="signup" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }}>
                      <form onSubmit={handleProviderSignup} className="space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-gray-400 uppercase mb-1 tracking-wider">Provider Name</label>
                          <input
                            type="text"
                            value={signupName}
                            onChange={(e) => setSignupName(e.target.value)}
                            required
                            placeholder="e.g. Grand Plaza Hotel"
                            className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-red-500 outline-none text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-400 uppercase mb-1 tracking-wider">Type</label>
                          <select
                            value={signupType}
                            onChange={(e) => setSignupType(e.target.value)}
                            className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-red-500 outline-none text-sm"
                          >
                            <option value="Hotel">Hotel</option>
                            <option value="Restaurant">Restaurant</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-400 uppercase mb-1 tracking-wider">Email</label>
                          <input
                            type="email"
                            value={signupEmail}
                            onChange={(e) => setSignupEmail(e.target.value)}
                            required
                            placeholder="admin@yourproperty.com"
                            className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-red-500 outline-none text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-400 uppercase mb-1 tracking-wider">Login ID</label>
                          <input
                            type="text"
                            value={signupLoginId}
                            onChange={(e) => setSignupLoginId(e.target.value)}
                            required
                            placeholder="Choose a unique login ID"
                            className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-red-500 outline-none text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-400 uppercase mb-1 tracking-wider">Password</label>
                          <input
                            type="password"
                            value={signupPassword}
                            onChange={(e) => setSignupPassword(e.target.value)}
                            required
                            placeholder="••••••••"
                            className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-red-500 outline-none text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-400 uppercase mb-1 tracking-wider">Confirm Password</label>
                          <input
                            type="password"
                            value={signupConfirm}
                            onChange={(e) => setSignupConfirm(e.target.value)}
                            required
                            placeholder="••••••••"
                            className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-red-500 outline-none text-sm"
                          />
                        </div>
                        {signupError && <p className="text-xs text-red-600 font-bold text-center bg-red-50 py-2 rounded-lg">{signupError}</p>}
                        <button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-xl transition-all uppercase tracking-wider shadow-lg shadow-red-600/20 text-sm">
                          Create Account
                        </button>
                      </form>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // ── Screen: Guest Select Provider ───────────────────────────────────────────
  if (appView === 'guestSelectProvider') {
    const getProviderIcon = (type: string) => {
      if (type === 'Hotel') return <Building2 className="w-6 h-6 text-red-500" />;
      if (type === 'Restaurant') return <UtensilsCrossed className="w-6 h-6 text-blue-500" />;
      return <MapPin className="w-6 h-6 text-gray-500" />;
    };
    const getTypeBadge = (type: string) => {
      if (type === 'Hotel') return 'bg-red-100 text-red-700';
      if (type === 'Restaurant') return 'bg-blue-100 text-blue-700';
      return 'bg-gray-100 text-gray-600';
    };

    return (
      <div className="min-h-screen bg-[#F8F9FA]">
        {/* Top bar */}
        <nav className="bg-white border-b border-black/5 px-6 py-4 flex items-center gap-4 sticky top-0 z-50">
          <button
            onClick={() => setAppView('landing')}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-800 transition-colors text-sm font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <div className="flex items-center gap-2 ml-2">
            <div className="bg-red-600 p-1.5 rounded-lg">
              <Shield className="text-white w-4 h-4" />
            </div>
            <h1 className="text-lg font-bold tracking-tight">SafeStay Hub</h1>
          </div>
        </nav>

        <main className="max-w-4xl mx-auto px-6 py-12">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Select Your Property</h2>
              <p className="text-gray-500">Choose the hotel or restaurant you are currently at</p>
            </div>

            {providers.length === 0 ? (
              <div className="text-center py-20 space-y-4">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
                  <Building2 className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-400 font-medium">No properties registered yet.</p>
                <p className="text-gray-300 text-sm">Ask the property staff to register on SafeStay Hub.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {providers.map((provider, i) => (
                  <motion.button
                    key={provider.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08 }}
                    onClick={() => { setSelectedProvider(provider); setAppView('guest'); }}
                    className="group bg-white rounded-2xl p-6 border border-black/5 shadow-sm hover:shadow-lg hover:border-red-200 hover:scale-[1.02] transition-all text-left flex items-center gap-5"
                  >
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all ${provider.type === 'Hotel' ? 'bg-red-50 group-hover:bg-red-100' : provider.type === 'Restaurant' ? 'bg-blue-50 group-hover:bg-blue-100' : 'bg-gray-100 group-hover:bg-gray-200'}`}>
                      {getProviderIcon(provider.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 text-base truncate">{provider.name}</p>
                      <span className={`inline-block mt-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${getTypeBadge(provider.type)}`}>
                        {provider.type}
                      </span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-red-500 transition-colors flex-shrink-0" />
                  </motion.button>
                ))}
              </div>
            )}
          </motion.div>
        </main>
      </div>
    );
  }

  // ── Screens: Guest & Staff (wrapped in new appView system) ──────────────────
  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans">
      {/* Navigation */}
      <nav className="bg-white border-b border-black/5 px-6 py-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-2">
          {/* Back to landing button */}
          {appView === 'guest' && (
            <button
              onClick={() => setAppView('guestSelectProvider')}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors mr-1"
              title="Back to property selection"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="bg-red-600 p-2 rounded-lg">
            <Shield className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">SafeStay Hub</h1>
            {/* Provider badge in nav */}
            {appView === 'staff' && providerSession && (
              <p className="text-[10px] text-gray-400 font-semibold">
                {providerSession.provider.name} · {providerSession.provider.type}
              </p>
            )}
          </div>
        </div>
        <div className="flex bg-gray-100 p-1 rounded-full">
          <button 
            onClick={() => setAppView('guest')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${appView === 'guest' ? 'bg-white shadow-sm text-red-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Guest Portal
          </button>
          <button 
            onClick={() => {
              setAppView('staff');
              setShowSettings(false);
            }}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${appView === 'staff' ? 'bg-white shadow-sm text-red-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Staff Dashboard
          </button>
        </div>
        {appView === 'staff' && isStaffLoggedIn && (
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <SettingsIcon className="w-5 h-5" />
            </button>
            <button 
              onClick={handleProviderLogout}
              className="p-2 text-red-400 hover:text-red-600 transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        )}
      </nav>

      <main className="max-w-7xl mx-auto p-6">
        {appView === 'guest' ? (
          <div className="max-w-2xl mx-auto py-12">
            {/* Reporting-to badge */}
            {selectedProvider && (
              <div className="flex items-center gap-2 mb-6 bg-white border border-black/5 rounded-2xl px-4 py-3 shadow-sm w-fit mx-auto">
                <Building2 className="w-4 h-4 text-red-500" />
                <span className="text-sm text-gray-600 font-medium">Reporting to: <strong className="text-gray-900">{selectedProvider.name}</strong></span>
                <span className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${selectedProvider.type === 'Hotel' ? 'bg-red-100 text-red-700' : selectedProvider.type === 'Restaurant' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                  {selectedProvider.type}
                </span>
              </div>
            )}

            {isIpBlocked ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-zinc-950 text-white rounded-3xl p-8 shadow-2xl border border-red-500/30 text-center space-y-6"
              >
                <div className="w-20 h-20 bg-red-600/20 rounded-full flex items-center justify-center mx-auto border border-red-600/30 animate-pulse">
                  <Ban className="w-10 h-10 text-red-500" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-3xl font-black uppercase tracking-tighter text-red-500">ACCESS BLOCKED</h2>
                  <p className="text-zinc-500 font-mono text-xs">IP STATUS: BLACKLISTED (MAX 2 FAKE REPORTS EXCEEDED)</p>
                </div>
                <p className="text-zinc-300 leading-relaxed max-w-md mx-auto text-sm">
                  This device/connection has been permanently blocked from using the SafeStay Emergency Hub due to repeated false, non-urgent, or fake emergency reports.
                </p>
                <div className="bg-red-950/40 border border-red-900/40 p-4 rounded-xl text-xs text-red-400 max-w-md mx-auto space-y-1 font-medium">
                  <p className="font-bold uppercase tracking-wider text-red-300">CRITICAL DIRECTIONS</p>
                  <p>If you are facing a real, life-threatening crisis, please dial <strong>911</strong> or <strong>112</strong> immediately.</p>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-3xl p-8 shadow-xl shadow-black/5 border border-black/5"
              >
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold mb-2">Emergency Assistance</h2>
                <p className="text-gray-500">Describe your situation. Our AI will analyze and notify the right teams immediately.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold mb-2 uppercase tracking-wider text-gray-400">Location / Unit</label>
                  <input 
                    type="text" 
                    value={roomNumber}
                    onChange={(e) => setRoomNumber(e.target.value)}
                    placeholder="e.g. Room 302, Table 12, or Lobby"
                    className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-red-500 transition-all outline-none"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-semibold uppercase tracking-wider text-gray-400">What is the emergency?</label>
                    <div className="flex items-center gap-1.5 bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full text-xs font-semibold">
                      <Globe className="w-3.5 h-3.5 text-gray-400" />
                      <select 
                        value={recordingLanguage}
                        onChange={(e) => setRecordingLanguage(e.target.value)}
                        className="bg-transparent border-none outline-none pr-1 focus:ring-0 cursor-pointer text-gray-700"
                        title="Selector for voice language transcription"
                      >
                        <option value="en-US">🇺🇸 English</option>
                        <option value="es-ES">🇪🇸 Español</option>
                        <option value="fr-FR">🇫🇷 Français</option>
                        <option value="de-DE">🇩🇪 Deutsch</option>
                        <option value="hi-IN">🇮🇳 हिन्दी</option>
                        <option value="ja-JP">🇯🇵 日本語</option>
                        <option value="zh-CN">🇨🇳 中文 (简体)</option>
                        <option value="ar-SA">🇸🇦 العربية</option>
                        <option value="pt-BR">🇧🇷 Português</option>
                      </select>
                    </div>
                  </div>

                  <div className="relative">
                    <textarea 
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      required
                      rows={4}
                      placeholder="Describe the situation briefly, or speak to translate your voice..."
                      className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-red-500 transition-all outline-none resize-none pr-16"
                    />
                    <button
                      type="button"
                      onClick={toggleVoiceRecording}
                      className={`absolute right-4 bottom-4 w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                        isRecording 
                          ? 'bg-red-500 text-white animate-pulse shadow-md shadow-red-500/20' 
                          : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                      }`}
                      title={isRecording ? "Stop recording" : "Record voice message"}
                    >
                      {isRecording ? <MicOff className="w-5 h-5 animate-spin [animation-duration:3s]" /> : <Mic className="w-5 h-5" />}
                    </button>
                  </div>

                  {/* Animated Waveform & Listening Indicator */}
                  <AnimatePresence>
                    {isRecording && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden mt-3"
                      >
                        <div className="bg-red-50 border border-red-200/50 rounded-2xl p-4 flex items-center gap-4">
                          <div className="relative flex items-center justify-center w-8 h-8 flex-shrink-0">
                            <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping" />
                            <span className="relative inline-flex rounded-full h-4 w-4 bg-red-600" />
                          </div>
                          <div className="flex-1">
                            <p className="text-xs font-bold text-red-900 uppercase tracking-wider">Listening in progress...</p>
                            <p className="text-[10px] text-red-600 font-medium">Speak in your chosen language now. We transcribe and translate in real-time.</p>
                          </div>
                          <div className="flex gap-1 flex-shrink-0 items-end h-6">
                            <span className="w-1 h-3 bg-red-500 rounded animate-bounce [animation-delay:0.1s] [animation-duration:0.6s]" />
                            <span className="w-1 h-5 bg-red-500 rounded animate-bounce [animation-delay:0.2s] [animation-duration:0.6s]" />
                            <span className="w-1 h-4 bg-red-500 rounded animate-bounce [animation-delay:0.15s] [animation-duration:0.6s]" />
                            <span className="w-1 h-6 bg-red-500 rounded animate-bounce [animation-delay:0.3s] [animation-duration:0.6s]" />
                            <span className="w-1 h-3 bg-red-500 rounded animate-bounce [animation-delay:0.25s] [animation-duration:0.6s]" />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {voiceError && (
                    <p className="text-xs text-red-600 font-bold bg-red-50 px-4 py-2 rounded-xl mt-3">
                      ⚠️ {voiceError}
                    </p>
                  )}
                </div>

                <button 
                  type="submit"
                  disabled={isSubmitting || cooldownRemaining > 0}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-5 rounded-2xl shadow-lg shadow-red-600/20 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : cooldownRemaining > 0 ? (
                    <>
                      <Clock className="w-5 h-5" />
                      COOLDOWN: {Math.ceil(cooldownRemaining / 1000)}s
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      SEND EMERGENCY ALERT
                    </>
                  )}
                </button>
                {cooldownRemaining > 0 && (
                  <p className="text-xs text-center text-orange-600 font-bold mt-4">
                    System temporarily locked due to multiple false reports.
                  </p>
                )}
                <p className="text-[10px] text-center text-gray-400 mt-4 uppercase tracking-widest font-bold">
                  Abuse of this system may result in penalties. 
                  <br />
                  Call 911/112 for local emergency services.
                </p>
              </form>

              <div className="mt-12 grid grid-cols-3 gap-4">
                <div className="p-4 bg-red-50 rounded-2xl flex flex-col items-center gap-2 text-center border border-red-100">
                  <Flame className="text-red-600 w-8 h-8" />
                  <span className="text-xs font-bold text-red-900 uppercase tracking-tighter">Fire</span>
                </div>
                <div className="p-4 bg-blue-50 rounded-2xl flex flex-col items-center gap-2 text-center border border-blue-100">
                  <Stethoscope className="text-blue-600 w-8 h-8" />
                  <span className="text-xs font-bold text-blue-900 uppercase tracking-tighter">Medical</span>
                </div>
                <div className="p-4 bg-purple-50 rounded-2xl flex flex-col items-center gap-2 text-center border border-purple-100">
                  <Shield className="text-purple-600 w-8 h-8" />
                  <span className="text-xs font-bold text-purple-900 uppercase tracking-tighter">Security</span>
                </div>
              </div>
            </motion.div>
            )}
          </div>
        ) : providerSession && !staffPinVerified ? (
          /* ── Staff PIN Screen ──────────────────────────────────────────── */
          <div className="max-w-md mx-auto py-20">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-3xl p-8 shadow-xl border border-black/5"
            >
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Key className="text-white w-8 h-8" />
                </div>
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-widest mb-1">Accessing: {providerSession.provider.name}</p>
                <h2 className="text-2xl font-bold">Staff Access</h2>
                <p className="text-gray-500 text-sm mt-1">Enter your device PIN to continue. This PIN is stored only on this device.</p>
              </div>
              <form onSubmit={handlePinSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1 tracking-wider">Device PIN</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="password"
                      value={enteredPin}
                      onChange={(e) => setEnteredPin(e.target.value)}
                      required
                      autoFocus
                      placeholder="••••••••"
                      className="w-full bg-gray-50 border-none rounded-xl pl-12 pr-4 py-3 focus:ring-2 focus:ring-gray-900 outline-none text-sm tracking-widest"
                    />
                  </div>
                </div>
                {pinError && <p className="text-xs text-red-600 font-bold text-center bg-red-50 py-2 rounded-lg">{pinError}</p>}
                <button
                  type="submit"
                  className="w-full bg-gray-900 hover:bg-black text-white font-bold py-4 rounded-xl transition-all uppercase tracking-wider text-sm"
                >
                  Unlock Dashboard
                </button>
              </form>
              <p className="text-[10px] text-center text-gray-400 mt-5 font-medium">
                Default PIN is <span className="font-mono font-bold">staff@123</span> — change it in Settings after login
              </p>
              <div className="text-center mt-3">
                <button
                  type="button"
                  onClick={handleProviderLogout}
                  className="text-xs text-gray-400 hover:text-gray-700 font-semibold transition-colors"
                >
                  ← Back
                </button>
              </div>
            </motion.div>
          </div>
        ) : !isStaffLoggedIn ? (
          <div className="max-w-md mx-auto py-20">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-3xl p-8 shadow-xl border border-black/5"
            >
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Lock className="text-red-600 w-8 h-8" />
                </div>
                <h2 className="text-2xl font-bold">Staff Login</h2>
                <p className="text-gray-500 text-sm">Access the crisis command center</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Staff ID</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input 
                      type="text" 
                      value={loginId}
                      onChange={(e) => setLoginId(e.target.value)}
                      required
                      className="w-full bg-gray-50 border-none rounded-xl pl-12 pr-4 py-3 focus:ring-2 focus:ring-red-500 outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Password</label>
                  <div className="relative">
                    <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input 
                      type="password" 
                      value={loginPass}
                      onChange={(e) => setLoginPass(e.target.value)}
                      required
                      className="w-full bg-gray-50 border-none rounded-xl pl-12 pr-4 py-3 focus:ring-2 focus:ring-red-500 outline-none"
                    />
                  </div>
                </div>
                {loginError && (
                  <p className="text-xs text-red-600 font-bold text-center">{loginError}</p>
                )}
                <button 
                  type="submit"
                  className="w-full bg-gray-900 text-white font-bold py-4 rounded-xl hover:bg-black transition-all"
                >
                  AUTHENTICATE
                </button>
              </form>
            </motion.div>
          </div>
        ) : showSettings ? (
          <div className="max-w-md mx-auto py-20">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-3xl p-8 shadow-xl border border-black/5"
            >
              <div className="flex items-center gap-4 mb-8">
                <button onClick={() => { setShowSettings(false); setShowChangePinForm(false); setPinChangeStatus(''); }} className="p-2 hover:bg-gray-100 rounded-lg transition-all">
                  <ChevronRight className="w-5 h-5 rotate-180" />
                </button>
                <h2 className="text-2xl font-bold">Account Settings</h2>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Current Password</label>
                  <input 
                    type="password" 
                    value={oldPass}
                    onChange={(e) => setOldPass(e.target.value)}
                    required
                    className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-red-500 outline-none"
                  />
                </div>
                <div className="pt-4 border-t border-gray-100">
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">New Staff ID (Optional)</label>
                  <input 
                    type="text" 
                    value={newId}
                    onChange={(e) => setNewId(e.target.value)}
                    placeholder="Leave blank to keep current"
                    className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-red-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">New Password</label>
                  <input 
                    type="password" 
                    value={newPass}
                    onChange={(e) => setNewPass(e.target.value)}
                    required
                    className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-red-500 outline-none"
                  />
                </div>
                {settingsStatus && (
                  <p className={`text-xs font-bold text-center ${settingsStatus.includes('success') ? 'text-green-600' : 'text-red-600'}`}>
                    {settingsStatus}
                  </p>
                )}
                <button 
                  type="submit"
                  className="w-full bg-red-600 text-white font-bold py-4 rounded-xl hover:bg-red-700 transition-all"
                >
                  UPDATE CREDENTIALS
                </button>
              </form>

              {/* Change Staff PIN */}
              <div className="mt-8 pt-6 border-t border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-gray-800">Change Staff PIN</h3>
                    <p className="text-xs text-gray-400 mt-0.5">Device-local PIN for dashboard access</p>
                  </div>
                  {!showChangePinForm && (
                    <button
                      type="button"
                      onClick={() => { setShowChangePinForm(true); setPinChangeStatus(''); }}
                      className="px-4 py-2 bg-gray-900 text-white text-xs font-bold rounded-xl hover:bg-black transition-all uppercase tracking-wider"
                    >
                      Change PIN
                    </button>
                  )}
                </div>
                {showChangePinForm && (
                  <form onSubmit={handleChangePin} className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase mb-1 tracking-wider">Current PIN</label>
                      <input
                        type="password"
                        value={oldPinInput}
                        onChange={(e) => setOldPinInput(e.target.value)}
                        required
                        placeholder="••••••••"
                        className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-gray-900 outline-none text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase mb-1 tracking-wider">New PIN</label>
                      <input
                        type="password"
                        value={newPinInput}
                        onChange={(e) => setNewPinInput(e.target.value)}
                        required
                        minLength={4}
                        placeholder="Min 4 characters"
                        className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-gray-900 outline-none text-sm"
                      />
                    </div>
                    {pinChangeStatus && (
                      <p className={`text-xs font-bold text-center py-2 rounded-lg ${pinChangeStatus.includes('successfully') ? 'text-green-700 bg-green-50' : 'text-red-600 bg-red-50'}`}>
                        {pinChangeStatus}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        className="flex-1 bg-gray-900 hover:bg-black text-white font-bold py-3 rounded-xl transition-all text-sm uppercase tracking-wider"
                      >
                        Update PIN
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowChangePinForm(false); setPinChangeStatus(''); setOldPinInput(''); setNewPinInput(''); }}
                        className="px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold rounded-xl transition-all text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </motion.div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Dashboard Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-3xl font-bold tracking-tight">Crisis Command</h2>
                <p className="text-gray-500">Real-time monitoring of life-safety and property-threatening incidents.</p>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setActiveTab('active')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${activeTab === 'active' ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                >
                  <AlertTriangle className="w-4 h-4" />
                  Active Alerts
                </button>
                <button 
                  onClick={() => setActiveTab('history')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${activeTab === 'history' ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                >
                  <History className="w-4 h-4" />
                  History
                </button>
                <button 
                  onClick={() => setActiveTab('stats')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${activeTab === 'stats' ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  Analytics
                </button>
                <button
                  onClick={() => { setActiveTab('blocked'); fetchBlockedIps(); }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${activeTab === 'blocked' ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                >
                  <Ban className="w-4 h-4" />
                  Blocked IPs
                </button>
              </div>
            </div>

            {/* Stats Overview */}
            {activeTab === 'blocked' ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold">Blocked Devices</h3>
                    <p className="text-gray-500 text-sm">IPs blocked due to repeated fake or false emergency reports.</p>
                  </div>
                  <button
                    onClick={fetchBlockedIps}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-black/5 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-all shadow-sm"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Refresh
                  </button>
                </div>

                {blockedIpsLoading ? (
                  <div className="py-20 flex justify-center">
                    <div className="w-8 h-8 border-2 border-gray-200 border-t-red-600 rounded-full animate-spin" />
                  </div>
                ) : blockedIps.length === 0 ? (
                  <div className="py-20 text-center space-y-4">
                    <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-8 h-8 text-green-500" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-400">No Blocked Devices</h3>
                      <p className="text-gray-400 text-sm">All users are currently in good standing.</p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {blockedIps.map((entry) => (
                      <div
                        key={entry.ip}
                        className="bg-white rounded-2xl p-5 border border-black/5 shadow-sm flex flex-col sm:flex-row sm:items-center gap-4"
                      >
                        <div className="flex-1 space-y-1.5">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="font-mono text-sm font-bold bg-gray-100 text-gray-800 px-3 py-1 rounded-lg">{entry.ip}</span>
                            <span className="bg-red-100 text-red-700 text-xs font-bold px-2.5 py-1 rounded-full">
                              Fake Reports: {entry.fakeCount}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 font-medium">
                            Last Report: {entry.lastFalseReport ? new Date(entry.lastFalseReport).toLocaleString() : 'N/A'}
                          </p>
                        </div>
                        <button
                          onClick={() => handleUnblockIp(entry.ip)}
                          className="flex items-center gap-2 px-4 py-2.5 bg-green-50 hover:bg-green-100 text-green-700 font-bold text-sm rounded-xl transition-all border border-green-200 flex-shrink-0"
                        >
                          <RefreshCw className="w-4 h-4" />
                          Unblock
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : activeTab === 'stats' ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-8 rounded-3xl border border-black/5 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold">Incident Distribution</h3>
                    <div className="px-3 py-1 bg-gray-100 rounded-full text-[10px] font-bold uppercase tracking-widest text-gray-500">Live Data</div>
                  </div>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={statsData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} />
                        <YAxis axisLine={false} tickLine={false} />
                        <Tooltip 
                          contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        />
                        <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                          {statsData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[entry.name as keyof typeof CATEGORY_COLORS] || '#6366f1'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="bg-white p-8 rounded-3xl border border-black/5 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold">Severity Analysis</h3>
                    <div className="px-3 py-1 bg-red-50 rounded-full text-[10px] font-bold uppercase tracking-widest text-red-600">Critical Priority</div>
                  </div>
                  <div className="h-80 flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Low', value: alerts.filter(a => a.severity === 'Low').length },
                            { name: 'Medium', value: alerts.filter(a => a.severity === 'Medium').length },
                            { name: 'High', value: alerts.filter(a => a.severity === 'High').length },
                            { name: 'Critical', value: alerts.filter(a => a.severity === 'Critical').length },
                          ]}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          <Cell fill={SEVERITY_COLORS.Low} />
                          <Cell fill={SEVERITY_COLORS.Medium} />
                          <Cell fill={SEVERITY_COLORS.High} />
                          <Cell fill={SEVERITY_COLORS.Critical} />
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                <AnimatePresence mode="popLayout">
                  {alerts
                    .filter(a => activeTab === 'active' ? (a.status !== 'resolved' && a.status !== 'fake') : (a.status === 'resolved' || a.status === 'fake'))
                    .map((alert) => (
                      <motion.div
                        key={alert.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className={`bg-white rounded-3xl p-6 border shadow-sm hover:shadow-md transition-all group ${alert.status === 'fake' ? 'border-red-200/50 bg-red-50/5' : 'border-black/5'}`}
                      >
                        <div className="flex flex-col lg:flex-row gap-6">
                          {/* Status & Category */}
                          <div className="flex flex-row lg:flex-col items-center lg:items-start justify-between lg:justify-start gap-4 lg:w-48 bg-gray-50/50 p-4 rounded-2xl border border-black/5">
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full animate-pulse" 
                                style={{ backgroundColor: CATEGORY_COLORS[alert.category as keyof typeof CATEGORY_COLORS] || CATEGORY_COLORS.Other }}
                              />
                              <span className="font-bold text-sm uppercase tracking-wider">{alert.category}</span>
                            </div>
                            {alert.status === 'fake' ? (
                              <div className="px-3 py-1 bg-red-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest animate-pulse">
                                FAKE / CANCELLED
                              </div>
                            ) : alert.status === 'resolved' ? (
                              <div className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-black uppercase tracking-widest">
                                RESOLVED
                              </div>
                            ) : (
                              <div 
                                className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest"
                                style={{ backgroundColor: `${SEVERITY_COLORS[alert.severity as keyof typeof SEVERITY_COLORS]}20`, color: SEVERITY_COLORS[alert.severity as keyof typeof SEVERITY_COLORS] }}
                              >
                                {alert.severity} Severity
                              </div>
                            )}
                            <div className="text-xs text-gray-400 font-mono">
                              {new Date(alert.timestamp).toLocaleTimeString()}
                            </div>
                          </div>
 
                          {/* Content */}
                          <div className="flex-1 space-y-4">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <h3 className="text-lg font-bold flex items-center gap-2">
                                  {alert.roomNumber !== 'Unknown' && (
                                    <span className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">{alert.roomNumber}</span>
                                  )}
                                  {alert.summary}
                                </h3>
                                <p className="text-gray-600 mt-1 italic">"{alert.message}"</p>
                              </div>
                              <div className="flex gap-2">
                                {alert.status === 'pending' && (
                                  <button 
                                    onClick={() => updateStatus(alert.id, 'dispatched')}
                                    className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-all"
                                    title="Dispatch Team"
                                  >
                                    <Bell className="w-5 h-5" />
                                  </button>
                                )}
                                {alert.status !== 'resolved' && alert.status !== 'fake' && (
                                  <>
                                    <button 
                                      onClick={() => updateStatus(alert.id, 'resolved')}
                                      className="p-2 bg-green-50 text-green-600 rounded-xl hover:bg-green-100 transition-all"
                                      title="Mark Resolved"
                                    >
                                      <CheckCircle2 className="w-5 h-5" />
                                    </button>
                                    <button 
                                      onClick={() => updateStatus(alert.id, 'fake')}
                                      className="p-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl transition-all flex items-center justify-center gap-1 border border-red-300"
                                      title="Mark as Fake & Cancel"
                                    >
                                      <Trash2 className="w-5 h-5 text-red-700" />
                                      <span className="text-xs font-bold uppercase pr-1 hidden sm:inline">Fake request</span>
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
 
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Protocol / Action</span>
                                </div>
                                <p className="text-sm text-gray-700 bg-gray-50/50 p-4 rounded-2xl border border-black/5 font-medium">
                                  {alert.suggestedAction}
                                </p>
                              </div>
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">External Dispatch</span>
                                </div>
                                <div className="flex flex-wrap gap-2 p-1">
                                  {alert.authoritiesToNotify.map((auth, idx) => (
                                    <span key={idx} className="px-3 py-1 bg-red-50 text-red-700 text-xs font-semibold rounded-full flex items-center gap-1">
                                      <Phone className="w-3 h-3" />
                                      {auth}
                                    </span>
                                  ))}
                                  {alert.authoritiesToNotify.length === 0 && (
                                    <span className="text-xs text-gray-400 italic">Internal response only</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                </AnimatePresence>

                {alerts.filter(a => activeTab === 'active' ? (a.status !== 'resolved' && a.status !== 'fake') : (a.status === 'resolved' || a.status === 'fake')).length === 0 && (
                  <div className="py-20 text-center space-y-4">
                    <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                      <CheckCircle2 className="text-gray-400 w-8 h-8" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-400">System Nominal</h3>
                      <p className="text-gray-400">No {activeTab} incidents detected on the network.</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Non-Emergency Flash Message */}
      <AnimatePresence>
        {showFlash && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-xl"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-zinc-900 border border-white/10 rounded-3xl p-8 max-w-md w-full shadow-2xl text-center space-y-6"
            >
              <div className="w-20 h-20 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto">
                <AlertTriangle className="w-10 h-10 text-amber-500" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-white uppercase tracking-tighter italic">Non-Emergency Detected</h3>
                <p className="text-zinc-400 leading-relaxed">
                  {flashMessage}
                </p>
              </div>
              <button 
                onClick={() => setShowFlash(false)}
                className="w-full bg-white text-black font-black py-4 rounded-2xl hover:bg-zinc-200 transition-all uppercase tracking-widest text-sm"
              >
                Acknowledge
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Guest Success Notification Popup */}
      <AnimatePresence>
        {showSuccessModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-zinc-950 border border-emerald-500/30 rounded-3xl p-8 max-w-md w-full shadow-2xl text-center space-y-6"
            >
              <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-10 h-10 text-emerald-500" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-white uppercase tracking-tighter italic">Emergency Sent</h3>
                <p className="text-emerald-400 font-bold uppercase tracking-wider text-xs">Request submitted successfully</p>
              </div>
              <p className="text-zinc-400 leading-relaxed text-sm">
                SafeStay Crisis Team has been notified of your request and location. First responders/staff are coordinate dispatched immediately. 
                <br /><strong className="text-white">Please stay calm and remain in a safe location.</strong>
              </p>
              <button 
                onClick={() => setShowSuccessModal(false)}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-4 rounded-2xl transition-all uppercase tracking-widest text-sm"
              >
                Acknowledge
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Emergency Floating Action (Staff View) */}
      {appView === 'staff' && (
        <div className="fixed bottom-8 right-8 flex flex-col items-end gap-4">
          <div className="bg-black text-white p-4 rounded-2xl shadow-2xl border border-white/10 flex items-center gap-4 animate-pulse">
            <div className="bg-red-600 p-2 rounded-lg">
              <AlertCircle className="text-white w-5 h-5" />
            </div>
            <div className="text-sm">
              <p className="font-bold uppercase tracking-tighter">Direct Dispatch</p>
              <p className="text-red-400 font-mono font-bold">911 / 112</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

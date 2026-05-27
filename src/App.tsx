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
  Globe
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
  const [view, setView] = useState<'guest' | 'staff'>('guest');
  const [message, setMessage] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'history' | 'stats'>('active');
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

  // LocalStorage helper utilities for robust hosting fallbacks
  const getLocalAlerts = (): Alert[] => {
    const data = localStorage.getItem('safestay_alerts_fb');
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
    localStorage.setItem('safestay_alerts_fb', JSON.stringify(defaults));
    return defaults;
  };

  const saveLocalAlerts = (updatedAlerts: Alert[]) => {
    localStorage.setItem('safestay_alerts_fb', JSON.stringify(updatedAlerts));
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

  const getLocalFalseReportCount = (): number => {
    return parseInt(localStorage.getItem('safestay_false_count_fb') || '0', 10);
  };

  const setLocalFalseReportCount = (count: number) => {
    localStorage.setItem('safestay_false_count_fb', count.toString());
  };

  const getLocalLastFalseReport = (): number => {
    return parseInt(localStorage.getItem('safestay_last_false_fb') || '0', 10);
  };

  const setLocalLastFalseReport = (time: number) => {
    localStorage.setItem('safestay_last_false_fb', time.toString());
  };

  const getLocalFakeCount = (): number => {
    return parseInt(localStorage.getItem('safestay_fake_count_fb') || '0', 10);
  };

  const setLocalFakeCount = (count: number) => {
    localStorage.setItem('safestay_fake_count_fb', count.toString());
  };

  // Session management (24h)
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
  }, []);

  // Cooldown & Blocklist parameters checking (with localStorage fallback detection)
  useEffect(() => {
    const checkCooldown = async () => {
      if (useLocalStorageFallback) {
        const count = getLocalFalseReportCount();
        const lastFalseReport = getLocalLastFalseReport();
        const fakeTotal = getLocalFakeCount();
        
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
        const res = await fetch('/api/cooldown');
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
  }, [useLocalStorageFallback]);

  // Fetch alerts on mount and periodically
  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 5000);
    return () => clearInterval(interval);
  }, [useLocalStorageFallback]);

  const fetchAlerts = async () => {
    try {
      const res = await fetch('/api/alerts');
      const contentType = res.headers.get("content-type") || "";
      if (res.ok && !contentType.includes("text/html")) {
        const data = await res.json();
        setAlerts(data);
        setUseLocalStorageFallback(false);
      } else {
        setUseLocalStorageFallback(true);
        setAlerts(getLocalAlerts());
      }
    } catch (err) {
      setUseLocalStorageFallback(true);
      setAlerts(getLocalAlerts());
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
          const newFalseCount = getLocalFalseReportCount() + 1;
          setLocalFalseReportCount(newFalseCount);
          setLocalLastFalseReport(Date.now());
          
          const newFakeTotal = getLocalFakeCount() + 1;
          setLocalFakeCount(newFakeTotal);
          
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
              roomNumber: roomNumber || 'Unknown'
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
        const localAlerts = getLocalAlerts();
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
        saveLocalAlerts(localAlerts);
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
            roomNumber: roomNumber || 'Unknown'
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
          fetchAlerts();
        }
      }
    } catch (err) {
      console.error("Failed to submit alert, falling back to offline mode", err);
      setUseLocalStorageFallback(true);
      
      // Classify locally
      const analysis = localHeuristicAnalysis(message);
      
      const localAlerts = getLocalAlerts();
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
        const newFalseCount = getLocalFalseReportCount() + 1;
        setLocalFalseReportCount(newFalseCount);
        setLocalLastFalseReport(Date.now());
        
        const newFakeTotal = getLocalFakeCount() + 1;
        setLocalFakeCount(newFakeTotal);
        
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
        saveLocalAlerts(localAlerts);
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
    if (useLocalStorageFallback) {
      const localAlerts = getLocalAlerts();
      const idx = localAlerts.findIndex(a => a.id === id);
      if (idx !== -1) {
        const oldStatus = localAlerts[idx].status;
        localAlerts[idx].status = status;
        
        if (status === 'fake' && oldStatus !== 'fake') {
          const newFake = getLocalFakeCount() + 1;
          setLocalFakeCount(newFake);
          if (newFake > 2) {
            setIsIpBlocked(true);
          }
          setFakeCount(newFake);
        }
        saveLocalAlerts(localAlerts);
        setAlerts(localAlerts);
      }
      return;
    }

    try {
      await fetch(`/api/alerts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      fetchAlerts();
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

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans">
      {/* Navigation */}
      <nav className="bg-white border-b border-black/5 px-6 py-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="bg-red-600 p-2 rounded-lg">
            <Shield className="text-white w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">SafeStay Hub</h1>
        </div>
        <div className="flex bg-gray-100 p-1 rounded-full">
          <button 
            onClick={() => setView('guest')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${view === 'guest' ? 'bg-white shadow-sm text-red-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Guest Portal
          </button>
          <button 
            onClick={() => {
              setView('staff');
              setShowSettings(false);
            }}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${view === 'staff' ? 'bg-white shadow-sm text-red-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Staff Dashboard
          </button>
        </div>
        {view === 'staff' && isStaffLoggedIn && (
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <SettingsIcon className="w-5 h-5" />
            </button>
            <button 
              onClick={handleLogout}
              className="p-2 text-red-400 hover:text-red-600 transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        )}
      </nav>

      <main className="max-w-7xl mx-auto p-6">
        {view === 'guest' ? (
          <div className="max-w-2xl mx-auto py-12">
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
                <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-all">
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
              </div>
            </div>

            {/* Stats Overview */}
            {activeTab === 'stats' ? (
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
      {view === 'staff' && (
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

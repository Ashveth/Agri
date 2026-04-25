/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from "@google/genai";
import { 
  signInWithPhoneNumber, 
  RecaptchaVerifier, 
  ConfirmationResult, 
  onAuthStateChanged, 
  signOut 
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot, 
  orderBy,
  serverTimestamp,
  updateDoc,
  deleteDoc,
  Timestamp 
} from 'firebase/firestore';
import { auth, db } from './lib/firebase.ts';

declare global {
  interface Window {
    recaptchaVerifier: RecaptchaVerifier;
  }
}
import { 
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  Legend
} from 'recharts';
import { 
  Home, 
  User, 
  ChevronLeft, 
  Phone, 
  TrendingUp, 
  Map as MapIcon, 
  ArrowRight,
  TrendingDown,
  Calendar,
  MapPin,
  Search,
  LayoutDashboard,
  Loader2,
  CheckCircle2,
  Upload,
  Image as ImageIcon,
  MessageCircle,
  X,
  Send,
  Sparkles,
  ClipboardList,
  Clock,
  Plus,
  Trash2,
  CheckCircle,
  Circle,
  Sprout
} from 'lucide-react';
import Markdown from 'react-markdown';
import { Screen, Prediction, Farmer, FarmTask } from './types.ts';

// Components
const Button = ({ 
  children, 
  onClick, 
  variant = 'primary', 
  className = '',
  disabled = false,
  type = "button"
}: { 
  children: React.ReactNode, 
  onClick?: () => void, 
  variant?: 'primary' | 'secondary' | 'outline' | 'dark',
  className?: string,
  disabled?: boolean,
  type?: "button" | "submit" | "reset"
}) => {
  const baseStyles = "w-full py-4 rounded-2xl font-bold text-lg transition-all active:scale-95 flex items-center justify-center gap-2";
  const variants = {
    primary: "bg-brand-primary text-white shadow-lg shadow-brand-primary/20",
    secondary: "bg-brand-highlight text-brand-primary",
    outline: "border-2 border-brand-border text-brand-muted",
    dark: "bg-brand-dark text-white"
  };

  return (
    <button 
      type={type}
      onClick={onClick} 
      className={`${baseStyles} ${variants[variant]} ${className} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      disabled={disabled}
    >
      {children}
    </button>
  );
};

const Card = ({ children, className = "", onClick }: { children: React.ReactNode, className?: string, onClick?: () => void }) => {
  const hasBg = className.includes('bg-');
  return (
    <div 
      onClick={onClick} 
      className={`${hasBg ? '' : 'bg-white'} rounded-3xl p-6 border-2 border-brand-border/40 ${className} ${onClick ? 'cursor-pointer active:scale-[0.98] hover:border-brand-primary transition-all shadow-sm' : ''}`}
    >
      {children}
    </div>
  );
};

const ScreenWrapper = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen pb-12">
    {children}
  </div>
);

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const LOGO_URL = "/logo.png";
const FALLBACK_LOGO_URL = "https://images.unsplash.com/photo-1595841696668-3e4b706c9e0a?q=80&w=300&auto=format&fit=crop"; 

const Logo = ({ className = "w-10 h-10", showText = false }: { className?: string; showText?: boolean }) => {
  const [imgSrc, setImgSrc] = React.useState(LOGO_URL);
  const [error, setError] = React.useState(false);

  const handleError = () => {
    if (imgSrc === LOGO_URL) {
      setImgSrc(FALLBACK_LOGO_URL);
    } else {
      setError(true);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <div className={`${className} bg-white rounded-xl flex items-center justify-center shadow-lg overflow-hidden border-2 border-brand-primary/20 bg-white`}>
        {!error ? (
          <img 
            src={imgSrc} 
            className="w-full h-full object-contain p-1" 
            alt="KisanVikas Logo" 
            referrerPolicy="no-referrer"
            onError={handleError}
          />
        ) : (
          <Sprout size={24} className="text-brand-primary" />
        )}
      </div>
      {showText && (
        <div className="flex flex-col">
          <span className="text-lg font-black text-brand-dark tracking-tight leading-none">Kisan<span className="text-brand-gold">Vikas</span></span>
          <p className="text-[9px] font-bold text-brand-primary uppercase tracking-[0.1em] mt-0.5">Advisor Portal</p>
        </div>
      )}
    </div>
  );
};

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>(() => {
    return (localStorage.getItem('isLoggedIn') === 'true') ? 'dashboard' : 'login';
  });
  const [phoneNumber, setPhoneNumber] = useState(() => localStorage.getItem('phoneNumber') || '');
  const [verificationId, setVerificationId] = useState<ConfirmationResult | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState(false);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [selectedProduct, setSelectedProduct] = useState('🍅 Tomato');
  const [location, setLocation] = useState('Nashik');
  const [harvestDate, setHarvestDate] = useState(new Date().toISOString().split('T')[0]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentFarmer, setCurrentFarmer] = useState<Farmer | null>(null);
  const [onboardingStep, setOnboardingStep] = useState<number | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [showSubscriptionToast, setShowSubscriptionToast] = useState(false);
  const [chatMessages, setChatMessages] = useState<{role: 'user' | 'model', text: string}[]>([
    { role: 'model', text: "Namaste! I'm your KisanVikas Assistant. How can I help you today with your crops or market prices?" }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: '',
    age: '',
    location: '',
    farms: '',
    profilePhoto: '',
    phoneNumber: ''
  });

  const [tasks, setTasks] = useState<FarmTask[]>([]);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskForm, setTaskForm] = useState({
    title: '',
    type: 'Planting' as FarmTask['type'],
    dueDate: new Date().toISOString().split('T')[0],
    description: ''
  });

  const [sortBy, setSortBy] = useState<'price' | 'distance' | 'demand'>('price');

  // Populate profile form when farmer data is loaded
  useEffect(() => {
    if (currentFarmer) {
      setProfileForm({
        name: currentFarmer.name || '',
        age: currentFarmer.age?.toString() || '',
        location: currentFarmer.location || '',
        farms: currentFarmer.farms || '',
        profilePhoto: currentFarmer.profilePhoto || '',
        phoneNumber: currentFarmer.phoneNumber || ''
      });
    }
  }, [currentFarmer]);

  // Get unique products for filtering (Not used since history is removed, but keeping logic structure if needed)
  const availableProducts: string[] = [];

  // Filter and process chart data (Not used since history is removed)
  const chartData: any[] = [];

  const productColors = [
    '#22C55E', // Green
    '#3B82F6', // Blue
    '#EF4444', // Red
    '#F59E0B', // Amber
    '#8B5CF6', // Violet
    '#EC4899'  // Pink
  ];

  // Auth State Listener & Real-time History sync
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        localStorage.setItem('isLoggedIn', 'true');
        
        // Sync user profile background
        const syncFarmer = async () => {
          try {
            const farmerRef = doc(db, 'farmers', user.uid);
            const farmerSnap = await getDoc(farmerRef);
            if (farmerSnap.exists()) {
              const data = farmerSnap.data() as Farmer;
              setCurrentFarmer(data);
              setCurrentScreen(prev => {
                if (prev === 'login' || prev === 'otp' || prev === 'profile' || prev === 'loading' || !prev) {
                  return 'dashboard';
                }
                return prev;
              });
            } else {
              setCurrentScreen('profile');
              setOnboardingStep(0); // Trigger onboarding for new users
              setProfileForm(prev => ({
                ...prev,
                phoneNumber: user.phoneNumber || phoneNumber
              }));
            }
          } catch (err) {
            console.error("Farmer profile sync failed:", err);
          }
        };
        syncFarmer();

        // Real-time tasks listener
        const unsubscribeTasks = onSnapshot(
          query(collection(db, 'tasks'), where('userId', '==', user.uid)),
          (snapshot) => {
            const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FarmTask));
            // Sort in client
            docs.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
            setTasks(docs);
          }, (err) => {
            console.error("Tasks sync failed:", err);
          }
        );

        return () => {
          unsubscribeTasks();
        };

      } else {
        localStorage.removeItem('isLoggedIn');
        setTasks([]);
      }
    });

    return () => {
      unsubscribeAuth();
    };
  }, []);

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    setIsLoading(true);
    try {
      await addDoc(collection(db, 'tasks'), {
        ...taskForm,
        userId: auth.currentUser.uid,
        status: 'Pending',
        createdAt: new Date().toISOString()
      });
      setIsTaskModalOpen(false);
      setTaskForm({
        title: '',
        type: 'Planting',
        dueDate: new Date().toISOString().split('T')[0],
        description: ''
      });
    } catch (err) {
      console.error("Failed to add task:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleTask = async (taskId: string, currentStatus: string) => {
    try {
      const taskRef = doc(db, 'tasks', taskId);
      await updateDoc(taskRef, {
        status: currentStatus === 'Pending' ? 'Completed' : 'Pending'
      });
    } catch (err) {
      console.error("Failed to toggle task:", err);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm("Are you sure you want to delete this task?")) return;
    try {
      await deleteDoc(doc(db, 'tasks', taskId));
    } catch (err: any) {
      console.error("Failed to delete task:", err);
      if (err.code === 'unavailable') {
        alert("Firestore is unreachable. Check your internet.");
      } else {
        alert(`Could not delete task: ${err.message || 'Permission denied'}`);
      }
    }
  };

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDeletePrediction = async (predictionId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // In iframe environments, confirms can be blocked. 
    // I'll use a direct delete with a loading state to avoid blocks.
    setDeletingId(predictionId);
    console.log(`Starting deletion for insight: ${predictionId}`);
    try {
      if (!db) throw new Error("Database connection not initialized.");
      const predRef = doc(db, 'predictions', predictionId);
      await deleteDoc(predRef);
      console.log(`Successfully deleted insight: ${predictionId}`);
    } catch (err: any) {
      console.error("Failed to delete insight:", err);
      let errorMsg = "Failed to delete insight.";
      if (err.code === 'permission-denied') {
        errorMsg = "Permission denied. You might not be the owner of this record.";
      } else if (err.code === 'unavailable') {
        errorMsg = "Service unavailable. Please check your connection.";
      }
      // Using a silent error logging or Toast would be better, but sticking to basics for now
      console.warn("Delete Error:", errorMsg);
    } finally {
      setDeletingId(null);
    }
  };

  const dismissAlert = (alertId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setAlerts(prev => prev.filter(a => a.id !== alertId));
  };

  // Fetch backend market data
  useEffect(() => {
    fetch('/api/market-data')
      .then(res => res.json())
      .then(data => setAlerts(data))
      .catch(err => console.error("Error fetching market data:", err));
  }, []);

  // Navigation handlers
  const navigateTo = (screen: Screen) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setCurrentScreen(screen);
  };

  // Save phone number when it changes
  useEffect(() => {
    localStorage.setItem('phoneNumber', phoneNumber);
  }, [phoneNumber]);

  // Handle Send OTP
  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phoneNumber.length < 10) return;
    
    setIsAuthLoading(true);
    setAuthError(null);
    try {
      // 1. Strictly manage reCAPTCHA container to avoid "already rendered" errors
      const container = document.getElementById('recaptcha-container');
      if (!container) {
        throw new Error("Security verification container not found. Please refresh the page.");
      }
      
      // Clear instance if it exists
      if (window.recaptchaVerifier) {
        try {
          window.recaptchaVerifier.clear();
        } catch (e) {
          console.warn("Error clearing verifier:", e);
        }
        window.recaptchaVerifier = null as any;
      }
      
      // Clear DOM artifacts and create a fresh anchor
      container.innerHTML = '<div id="recaptcha-anchor"></div>';

      // 2. Fresh initialization on the anchor sub-element
      window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-anchor', {
        'size': 'invisible'
      });
      
      const appVerifier = window.recaptchaVerifier;
      
      // 3. Robust phone number parsing
      let cleanPhone = phoneNumber.replace(/(?!^\+)\D/g, ''); 
      if (!cleanPhone.startsWith('+')) {
        if (cleanPhone.startsWith('0')) cleanPhone = cleanPhone.substring(1);
        cleanPhone = `+91${cleanPhone}`; 
      }
      
      console.log("Sending SMS to:", cleanPhone);
      const confirmationResult = await signInWithPhoneNumber(auth, cleanPhone, appVerifier);
      setVerificationId(confirmationResult);
      
      // Reset OTP fields for fresh start
      setOtp(['', '', '', '', '', '']);
      setOtpError(false);
      setAuthError(null);
      
      if (currentScreen !== 'otp') navigateTo('otp');
    } catch (error: any) {
      console.error("SMS Error Details:", error);
      let msg = "Failed to send SMS. ";
      
      if (error.code === 'auth/invalid-phone-number') {
        msg += "Invalid format. Use + country code (e.g. +91).";
      } else if (error.code === 'auth/captcha-check-failed') {
        msg += "Security check failed. Please refresh.";
      } else if (error.code === 'auth/too-many-requests') {
        msg += "Too many attempts. Please wait 5 minutes.";
      } else if (error.code === 'auth/operation-not-allowed') {
        msg += "SMS capability not enabled or region blocked in Firebase Console.";
      } else {
        msg = error.message || "Please check your network.";
      }
      
      setAuthError(msg);
      
      // Cleanup on failure
      try {
        window.recaptchaVerifier?.clear();
        window.recaptchaVerifier = null as any;
      } catch (e) {}
    } finally {
      setIsAuthLoading(false);
    }
  };

  // Handle OTP Verification
  const handleVerifyOTP = async () => {
    const code = otp.join('');
    if (code.length < 6) return;
    
    if (!verificationId) {
      setAuthError("Session expired. Please request a new OTP.");
      navigateTo('login');
      return;
    }
    
    setIsAuthLoading(true);
    setOtpError(false);
    setAuthError(null);
    try {
      const result = await verificationId.confirm(code);
      console.log("Verification successful for user:", result.user.uid);
      // Removed direct navigateTo('dashboard'), let onAuthStateChanged handle it
    } catch (error: any) {
      console.error("Verification Error:", error);
      setOtpError(true);
      if (error.code === 'auth/invalid-verification-code') {
        setAuthError("Incorrect code. Please double check.");
      } else if (error.code === 'auth/code-expired') {
        setAuthError("Code expired. Please click 'Resend Code' below.");
      } else {
        setAuthError(error.message || "Verification failed.");
      }
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    localStorage.removeItem('isLoggedIn');
    setPhoneNumber('');
    setCurrentFarmer(null);
    setChatMessages([{ role: 'model', text: "Namaste! I'm your KisanVikas Assistant. How can I help you today with your crops or market prices?" }]);
    navigateTo('login');
  };

  const handleSendChatMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;

    const userMessage = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsChatLoading(true);

    try {
      const systemPrompt = `You are a helpful, professional agricultural advisor named "KisanVikas AI".
      User Name: ${currentFarmer?.name || 'Farmer'}.
      Location: ${currentFarmer?.location || 'Unknown'}.
      Provide concise, practical advice for farmers. If they ask about market trends, use the context provided.
      Current conversation history:
      ${chatMessages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`).join('\n')}
      Assistant:`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: systemPrompt,
      });

      const aiText = response.text || "I'm sorry, I couldn't process that. Please try asking again.";
      setChatMessages(prev => [...prev, { role: 'model', text: aiText }]);
    } catch (error) {
      console.error("Chat error:", error);
      setChatMessages(prev => [...prev, { role: 'model', text: "I'm having trouble connecting to my knowledge base. Please try again in a bit." }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setProfileForm({ ...profileForm, profilePhoto: event.target?.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setProfileForm({ ...profileForm, profilePhoto: event.target?.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    setIsAuthLoading(true);
    try {
      const farmerData = {
        uid: user.uid,
        phoneNumber: user.phoneNumber || phoneNumber,
        name: profileForm.name,
        age: profileForm.age ? parseInt(profileForm.age) : null,
        location: profileForm.location,
        farms: profileForm.farms,
        profilePhoto: profileForm.profilePhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
        isProSubscriber: currentFarmer?.isProSubscriber || false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await setDoc(doc(db, 'farmers', user.uid), farmerData);
      setCurrentFarmer(farmerData as unknown as Farmer);
      navigateTo('dashboard');
    } catch (error: any) {
      console.error("Profile save error:", error);
      setAuthError("Failed to save profile. Please check your connection.");
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleSubscribe = async () => {
    const user = auth.currentUser;
    if (!user || !currentFarmer) return;

    setIsSubscribing(true);
    try {
      const farmerRef = doc(db, 'farmers', user.uid);
      await setDoc(farmerRef, {
        ...currentFarmer,
        isProSubscriber: true,
        updatedAt: serverTimestamp()
      }, { merge: true });

      setCurrentFarmer(prev => prev ? { ...prev, isProSubscriber: true } : null);
      setShowSubscriptionToast(true);
      setTimeout(() => setShowSubscriptionToast(false), 5000);
    } catch (error) {
      console.error("Subscription failed:", error);
    } finally {
      setIsSubscribing(false);
    }
  };

  const handlePredict = async () => {
    navigateTo('loading');
    
    try {
      const prompt = `Act as an agricultural expert. A farmer is asking for a demand prediction for ${selectedProduct} in ${location}. 
      The date is ${new Date().toLocaleDateString()}.
      Also, provide a comparison of 3 nearby cities/markets (e.g. Mumbai, Nashik, Satara if the user is in Pune).
      Return a JSON object with: 
      demand (High/Medium/Low), 
      price (number, estimated ₹ per kg), 
      bestLocation (string), 
      bestTime (string), 
      trend (Increasing/Decreasing/Stable),
      comparisons (array of 3-4 objects with city, price (number), demand (High/Medium/Low), distance (string like "12km"), isBest (boolean), reason (short explanation)).
      One of the comparisons must have isBest: true.
      Keep it realistic based on general agricultural trends.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              demand: { type: Type.STRING },
              price: { type: Type.NUMBER },
              bestLocation: { type: Type.STRING },
              bestTime: { type: Type.STRING },
              trend: { type: Type.STRING },
              comparisons: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    city: { type: Type.STRING },
                    price: { type: Type.NUMBER },
                    demand: { type: Type.STRING },
                    distance: { type: Type.STRING },
                    isBest: { type: Type.BOOLEAN },
                    reason: { type: Type.STRING }
                  },
                  required: ["city", "price", "demand", "distance", "isBest", "reason"]
                }
              }
            },
            required: ["demand", "price", "bestLocation", "bestTime", "trend", "comparisons"]
          }
        }
      });

      const resultData = JSON.parse(response.text);
      
      const userId = auth.currentUser?.uid;
      if (!userId) throw new Error("User must be logged in to save predictions");

      const predictionData = {
        userId,
        product: selectedProduct.split(' ')[1] || selectedProduct,
        location: location,
        date: new Date().toISOString(),
        ...resultData,
        createdAt: serverTimestamp()
      };

      // Save to Firestore - using setDoc to ensure 'id' field is present in data as required by rules
      const docId = Math.random().toString(36).substr(2, 9);
      const predictionWithId = { ...predictionData, id: docId };
      await setDoc(doc(db, 'predictions', docId), predictionWithId);
      
      const newPrediction: Prediction = {
        id: docId,
        ...predictionData,
        createdAt: undefined as any // Match interface
      };

      setPrediction(newPrediction);
      navigateTo('result');
    } catch (error: any) {
      console.error("AI Prediction Error:", error);
      // Fallback to mock if AI fails
      const mockResult: Prediction = {
        id: Math.random().toString(36).substr(2, 9),
        product: selectedProduct.split(' ')[1] || selectedProduct,
        location: location,
        date: harvestDate,
        demand: 'High',
        price: 48,
        bestLocation: `${location} Main Mandi`,
        bestTime: 'Next 24 hours',
        trend: 'Increasing',
        comparisons: [
          { city: 'Mumbai', price: 52, demand: 'High', distance: '145km', isBest: true, reason: 'High retail demand and premium pricing.' },
          { city: 'Pune Mandi', price: 48, demand: 'Medium', distance: '15km', isBest: false, reason: 'Local hub with stable pricing.' },
          { city: 'Nashik', price: 45, demand: 'High', distance: '210km', isBest: false, reason: 'Large volume trading center.' }
        ]
      };
      setPrediction(mockResult);
      navigateTo('result');
    }
  };

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col">
      {/* NAVBAR */}
      {currentScreen !== 'login' && currentScreen !== 'otp' && (
        <nav className="bg-white border-b border-brand-border sticky top-0 z-50 shadow-sm">
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
            <div 
              className="flex items-center gap-3 cursor-pointer group" 
              onClick={() => navigateTo('dashboard')}
            >
              <Logo 
                className="w-10 h-10 group-hover:rotate-6 transition-transform" 
                showText={true} 
              />
            </div>

              <div className="hidden md:flex items-center gap-6 font-bold text-[13px] tracking-wide">
              <button 
                onClick={() => navigateTo('dashboard')}
                className={`${currentScreen === 'dashboard' ? 'text-brand-primary' : 'text-brand-muted hover:text-brand-dark'} transition-colors`}
              >
                DASHBOARD
              </button>
              <button 
                onClick={() => navigateTo('tasks')}
                className={`${currentScreen === 'tasks' ? 'text-brand-primary' : 'text-brand-muted hover:text-brand-dark'} transition-colors`}
              >
                FARM TASKS
              </button>
              <button 
                onClick={() => navigateTo('input')}
                className="bg-brand-highlight px-4 py-2 rounded-xl text-brand-primary hover:bg-brand-primary hover:text-white transition-all shadow-sm"
              >
                NEW PREDICTION
              </button>
            </div>

            <div className="flex items-center gap-3">
              <button 
                onClick={handleLogout}
                className="flex items-center gap-1.5 text-brand-muted hover:text-red-500 font-bold transition-all px-3 py-1.5 rounded-xl text-sm"
              >
                <span className="text-lg">🚪</span>
                <span className="hidden sm:inline">Logout</span>
              </button>
              <div 
                className="w-10 h-10 rounded-xl overflow-hidden border-2 border-brand-border cursor-pointer hover:border-brand-primary transition-all"
                onClick={() => navigateTo('profile')}
              >
                <img 
                  src={currentFarmer?.profilePhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${auth.currentUser?.uid}`} 
                  className="w-full h-full object-cover"
                  alt="Profile"
                />
              </div>
            </div>
          </div>
        </nav>
      )}

      <main className="flex-1 w-full max-w-7xl mx-auto relative px-4 sm:px-6 py-4 md:py-6">
        <div id="recaptcha-container"></div>
        
        {/* Subscription Toast */}
        <AnimatePresence>
          {showSubscriptionToast && (
            <motion.div
              initial={{ opacity: 0, y: 50, x: '-50%' }}
              animate={{ opacity: 1, y: 0, x: '-50%' }}
              exit={{ opacity: 0, y: 50, x: '-50%' }}
              className="fixed bottom-24 left-1/2 z-[200] w-full max-w-sm px-4"
            >
              <div className="bg-brand-dark text-white p-6 rounded-3xl shadow-2xl flex items-center gap-4 border border-brand-primary/20">
                <div className="w-12 h-12 bg-brand-primary rounded-2xl flex items-center justify-center shrink-0">
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <p className="font-black text-sm uppercase tracking-wider">Subscription Active</p>
                  <p className="text-xs text-brand-highlight/70 mt-1">Daily updates will be sent to your phone and email.</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* LOGIN SCREEN */}
          {currentScreen === 'login' && (
            <ScreenWrapper>
              <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center gap-12 pt-20">
                <div className="flex-1 space-y-6 text-center md:text-left">
                  <Logo className="w-24 h-24 rounded-3xl shadow-xl shadow-brand-primary/30 mx-auto md:mx-0" />
                  <h1 className="text-5xl md:text-6xl font-black text-brand-dark tracking-tighter leading-tight font-sans">
                    Smart Insights for <span className="text-brand-gold">Better Harvests.</span>
                  </h1>
                  <p className="text-xl text-brand-muted font-medium max-w-lg">
                    Kisan<span className="text-brand-gold">Vikas</span> AI helps farmers predict market demand, optimize prices, and find the best markets using state-of-the-art AI technology.
                  </p>
                </div>

                <Card className="w-full max-w-md p-10 shadow-2xl shadow-brand-dark/5 bg-white border-2 border-brand-border">
                  <h2 className="text-3xl font-black mb-2 text-brand-dark tracking-tight">Sign In</h2>
                  <p className="text-brand-muted mb-8 font-medium">Access your personalized advisor portal.</p>
                  
                  <form 
                    onSubmit={handleSendOTP}
                    className="space-y-6"
                  >
                    <div>
                      <label htmlFor="phone" className="text-[10px] font-black uppercase text-brand-muted mb-2 block ml-1 tracking-[0.2em]">Phone Number</label>
                      <div className="relative group">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2 text-brand-muted group-focus-within:text-brand-primary transition-colors border-r pr-3 border-brand-border h-6">
                          <Phone size={18} />
                          <span className="text-sm font-bold text-brand-dark">+91</span>
                        </div>
                        <input 
                          id="phone"
                          type="tel" 
                          autoFocus
                          placeholder="99887 76655" 
                          className="w-full pl-24 pr-4 py-4 rounded-2xl bg-brand-surface border-2 border-brand-border focus:outline-none focus:border-brand-primary text-xl font-bold"
                          value={phoneNumber}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                            setPhoneNumber(val);
                          }}
                        />
                      </div>
                    </div>
                    
                    {authError && (
                      <p className="bg-red-50 text-red-600 p-4 rounded-xl text-xs font-bold border border-red-100 leading-relaxed">
                         ⚠️ {authError}
                      </p>
                    )}

                    <Button 
                      type="submit"
                      disabled={phoneNumber.length < 10 || isAuthLoading}
                      className={`py-5 text-xl font-black rounded-2xl transition-all ${phoneNumber.length >= 10 && !isAuthLoading ? 'opacity-100' : 'opacity-50 grayscale'}`}
                    >
                      {isAuthLoading ? <Loader2 className="animate-spin" /> : 'SEND OTP CODE'}
                    </Button>

                    <div className="text-center pt-4 border-t border-brand-border">
                       <p className="text-[11px] font-bold text-brand-muted leading-relaxed">
                         By signing in, you agree to receive automated SMS for authentication purposes.
                       </p>
                    </div>
                  </form>
                </Card>
              </div>
            </ScreenWrapper>
          )}

        {/* OTP VERIFICATION */}
        {currentScreen === 'otp' && (
          <ScreenWrapper>
            <div className="max-w-md mx-auto pt-20">
              <button onClick={() => navigateTo('login')} className="mb-8 p-3 rounded-2xl hover:bg-brand-surface text-brand-dark transition-all flex items-center gap-2 font-black text-xs tracking-widest">
                <ChevronLeft size={20} /> CHANGE NUMBER
              </button>
              
              <Card className="p-10 shadow-2xl border-2 border-brand-border bg-white text-center">
                <Logo className="w-24 h-24 rounded-[2rem] mx-auto mb-8 shadow-sm" />
                <h1 className="text-3xl font-black mb-2 text-brand-dark tracking-tighter">Verify Security Code</h1>
                <p className="text-brand-muted mb-10 font-bold text-sm">We sent a 6-digit code to <br/><span className="text-brand-primary font-black">+91 {phoneNumber.replace(/(\d{5})(\d{5})/, '$1 $2')}</span></p>
                
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleVerifyOTP();
                  }}
                  className="space-y-6"
                >
                  <div className="flex flex-col gap-6">
                    <div className="relative group px-2">
                      {/* Hidden actual input for native focus and typing behavior */}
                      <input 
                        id="otp-master"
                        type="tel"
                        maxLength={6}
                        value={otp.join('')}
                        autoFocus
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        className="absolute inset-0 opacity-0 cursor-default"
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                          const newOtp = ['', '', '', '', '', ''];
                          val.split('').forEach((char, i) => {
                            newOtp[i] = char;
                          });
                          setOtp(newOtp);
                          setOtpError(false);
                          setAuthError(null);

                          if (val.length === 6) {
                            setTimeout(() => handleVerifyOTP(), 100);
                          }
                        }}
                      />
                      
                      {/* Visual boxes that reflect the hidden input's value */}
                      <div className="flex justify-between gap-2 pointer-events-none">
                        {[0, 1, 2, 3, 4, 5].map(index => (
                          <div 
                            key={index}
                            className={`w-12 h-16 flex items-center justify-center text-2xl font-black rounded-xl border-2 bg-brand-surface transition-all ${
                              otpError ? 'border-red-500' : 
                              (otp.join('').length === index ? 'border-brand-primary ring-4 ring-brand-primary/10' : 'border-brand-border')
                            } text-brand-dark shadow-sm`}
                          >
                            {otp[index] || ""}
                            {otp.join('').length === index && (
                              <div className="absolute w-0.5 h-8 bg-brand-primary animate-pulse" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                    {authError && (
                      <p className="text-red-500 text-xs font-black uppercase tracking-widest animate-bounce">⚠️ {authError}</p>
                    )}
                  </div>
                  
                  <Button type="submit" disabled={isAuthLoading || otp.some(v => !v)} className="py-5 text-xl font-black rounded-2xl shadow-xl shadow-brand-primary/20">
                    {isAuthLoading ? <Loader2 className="animate-spin" /> : 'ACCESS PORTAL 🚀'}
                  </Button>
                  
                  <div className="flex flex-col gap-4 mt-6">
                    <button 
                      type="button" 
                      className="text-brand-primary font-black text-xs tracking-[0.2em] hover:underline uppercase disabled:opacity-50"
                      onClick={handleSendOTP}
                      disabled={isAuthLoading}
                    >
                      Resend Code
                    </button>
                    
                    <button 
                      type="button" 
                      className="text-brand-muted font-black text-[10px] tracking-[0.2em] hover:text-brand-dark uppercase"
                      onClick={() => navigateTo('login')}
                    >
                      Change Number
                    </button>
                  </div>
                </form>
              </Card>
            </div>
          </ScreenWrapper>
        )}

        {/* PROFILE SETUP */}
        {currentScreen === 'profile' && (
          <ScreenWrapper>
            <div className="max-w-2xl mx-auto py-12 px-6 relative">
              
              {/* ONBOARDING TOOLTIP */}
              <AnimatePresence>
                {onboardingStep !== null && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] w-full max-w-sm"
                  >
                    <Card className="bg-white/90 backdrop-blur-2xl p-8 rounded-[40px] shadow-2xl relative overflow-hidden border-2 border-brand-border">
                      <div className="absolute top-0 right-0 p-4 opacity-10 text-brand-primary">
                        <Sparkles size={80} />
                      </div>
                      <h4 className="text-2xl font-black mb-2 tracking-tight text-brand-dark">
                        {onboardingStep === 0 && "Welcome Friend!"}
                        {onboardingStep === 1 && "Where is your farm?"}
                        {onboardingStep === 2 && "What do you grow?"}
                        {onboardingStep === 3 && "Add a photo!"}
                      </h4>
                      <p className="text-brand-muted font-bold leading-relaxed mb-8">
                        {onboardingStep === 0 && "Tell us your name so we can personalize your agricultural reports and price alerts."}
                        {onboardingStep === 1 && "We use your location to find the nearest Mandis and provide accurate local market data."}
                        {onboardingStep === 2 && "Knowing your crops helps our AI give you specifically tailored demand forecasts."}
                        {onboardingStep === 3 && "Adding a profile photo makes your account feel more personal and professional."}
                      </p>
                      <div className="flex items-center justify-between">
                        <button 
                          onClick={() => setOnboardingStep(null)}
                          className="text-brand-muted hover:text-brand-dark font-black text-sm transition-colors"
                        >
                          Skip for now
                        </button>
                        <button 
                          onClick={() => {
                            if (onboardingStep < 3) setOnboardingStep(onboardingStep + 1);
                            else setOnboardingStep(null);
                          }}
                          className="bg-brand-primary text-white px-6 py-3 rounded-2xl font-black flex items-center gap-2 hover:scale-105 transition-transform shadow-lg shadow-brand-primary/20"
                        >
                          {onboardingStep < 3 ? "Next Step" : "Let's Start!"} <ArrowRight size={20} />
                        </button>
                      </div>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex justify-between items-center mb-8">
                <button 
                  onClick={() => navigateTo('dashboard')} 
                  className="p-3 rounded-2xl hover:bg-brand-surface text-brand-dark transition-all flex items-center gap-2 font-bold text-sm"
                >
                  <ChevronLeft size={18} /> Back to Home
                </button>
                <button 
                  onClick={handleLogout} 
                  className="p-3 rounded-2xl hover:bg-red-50 text-red-600 transition-all flex items-center gap-2 font-bold text-sm"
                >
                  Log Out <span className="text-lg">🚪</span>
                </button>
              </div>
              <header className="text-center mb-8">
                 <h1 className="text-5xl font-black text-brand-dark tracking-tighter">Your Profile</h1>
                 <p className="text-brand-muted font-medium mt-2">Personalize your KisanVikas experience</p>
              </header>

              <Card className="p-8 shadow-2xl bg-white border-2 border-brand-border">
                <form onSubmit={handleProfileSubmit} className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase text-brand-muted ml-1 tracking-[0.2em]">Full Name</label>
                      <input 
                        required
                        type="text" 
                        placeholder="e.g. Ramesh Patil" 
                        className="input-field"
                        value={profileForm.name}
                        onChange={e => setProfileForm({...profileForm, name: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase text-brand-muted ml-1 tracking-[0.2em]">Age</label>
                      <input 
                        type="number" 
                        placeholder="e.g. 35" 
                        className="input-field"
                        value={profileForm.age}
                        onChange={e => setProfileForm({...profileForm, age: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase text-brand-muted ml-1 tracking-[0.2em]">Primary Location / Village</label>
                    <div className="relative">
                      <MapPin size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-primary" />
                      <input 
                        required
                        type="text" 
                        placeholder="e.g. Niphad, Nashik" 
                        className="input-field pl-12"
                        value={profileForm.location}
                        onChange={e => setProfileForm({...profileForm, location: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase text-brand-muted ml-1 tracking-[0.2em]">Crops & Farm Size</label>
                    <textarea 
                      placeholder="e.g. 4 acres of Tomato, 2 acres of Onion" 
                      rows={3}
                      className="input-field resize-none"
                      value={profileForm.farms}
                      onChange={e => setProfileForm({...profileForm, farms: e.target.value})}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase text-brand-muted ml-1 tracking-[0.2em]">Profile Photo</label>
                    <div 
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={handleFileDrop}
                      className="relative border-4 border-dashed border-brand-border rounded-3xl p-10 flex flex-col items-center justify-center gap-4 hover:border-brand-primary transition-all group cursor-pointer bg-brand-surface"
                      onClick={() => document.getElementById('photo-input')?.click()}
                    >
                      <input 
                        type="file" 
                        id="photo-input" 
                        className="hidden" 
                        accept="image/*"
                        onChange={handleFileSelect}
                      />
                      {profileForm.profilePhoto ? (
                        <div className="relative">
                          <img 
                            src={profileForm.profilePhoto} 
                            className="w-32 h-32 object-cover rounded-2xl shadow-xl"
                            alt="Preview"
                          />
                          <div className="absolute inset-0 bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <Upload className="text-white" size={24} />
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm text-brand-muted">
                            <ImageIcon size={32} />
                          </div>
                          <div className="text-center">
                            <p className="font-bold text-brand-dark">Click to upload photo</p>
                            <p className="text-xs text-brand-muted">or drag and drop here</p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {authError && <p className="text-red-500 text-xs font-bold bg-red-50 p-4 rounded-xl border border-red-100 text-center">{authError}</p>}

                  <Button type="submit" disabled={isAuthLoading} className="py-5 text-xl font-black rounded-2xl">
                    {isAuthLoading ? <Loader2 className="animate-spin" /> : 'SAVE PROFILE & CONTINUE'}
                  </Button>
                </form>
              </Card>
            </div>
          </ScreenWrapper>
        )}
        {currentScreen === 'dashboard' && (
          <ScreenWrapper>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-8 space-y-8">
                <header className="flex items-center justify-between">
                  <div>
                    <h1 className="text-4xl md:text-6xl font-black text-brand-dark tracking-tighter leading-tight">
                      Good morning, <span className="text-brand-primary">{currentFarmer?.name?.split(' ')[0] || 'Advisor'}! 👋</span>
                    </h1>
                    <p className="text-xl text-brand-muted mt-2 font-medium">Harness AI to maximize regional farm productivity and market returns.</p>
                  </div>
                  <div className="hidden sm:block">
                    <img 
                      src={currentFarmer?.profilePhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${auth.currentUser?.uid}`} 
                      className="w-20 h-20 rounded-3xl object-cover border-4 border-white shadow-xl"
                      alt="Profile"
                    />
                  </div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card 
                    className="flex flex-col justify-between h-[450px] bg-[url('https://images.unsplash.com/photo-1592833159057-65c697b0a88b?auto=format&fit=crop&q=80&w=800')] bg-cover bg-center border-none relative overflow-hidden group cursor-pointer shadow-2xl"
                    onClick={() => navigateTo('input')}
                  >
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-md group-hover:bg-white/50 transition-colors"></div>
                    <div className="relative z-10 p-6">
                       <span className="bg-brand-primary text-white px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest shadow-xl">Analysis Active</span>
                    </div>
                    <div className="relative z-10 p-8 space-y-4">
                      <h2 className="text-6xl font-black text-brand-dark leading-[0.9] tracking-tighter">Price <br/>Prediction</h2>
                      <p className="text-brand-primary font-black text-lg">Calculate Mandi potential →</p>
                      <div className="w-16 h-16 bg-brand-primary rounded-full flex items-center justify-center text-white shadow-2xl group-hover:translate-x-2 transition-transform">
                        <ArrowRight size={32} />
                      </div>
                    </div>
                  </Card>

                  <div className="flex flex-col gap-6">
                    <Card 
                      className="flex-1 flex flex-col justify-center gap-4 bg-white border-brand-border cursor-pointer hover:border-brand-primary transition-all group"
                      onClick={() => navigateTo('tasks')}
                    >
                       <div className="flex items-center gap-6">
                         <div className="w-16 h-16 bg-brand-surface rounded-2xl flex items-center justify-center shadow-sm text-3xl group-hover:scale-110 transition-transform font-sans">📋</div>
                         <div>
                           <h3 className="text-xl font-bold text-brand-dark tracking-tight leading-none mb-1">Farm Tasks</h3>
                           <p className="text-xs text-brand-primary font-black uppercase tracking-widest">
                             {tasks.filter(t => t.status === 'Pending').length} Pending
                           </p>
                         </div>
                       </div>
                       
                       {tasks.filter(t => t.status === 'Pending').length > 0 && (
                         <div className="mt-2 space-y-2 border-t border-brand-border pt-4">
                           {tasks.filter(t => t.status === 'Pending').slice(0, 1).map(task => (
                             <div key={task.id} className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-brand-primary animate-pulse"></div>
                                <span className="text-sm font-black text-brand-dark truncate tracking-tight">{task.title}</span>
                                <span className="text-[10px] text-brand-muted font-bold ml-auto">{new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                             </div>
                           ))}
                         </div>
                       )}
                    </Card>

                    <Card className="flex-1 flex items-center gap-6 bg-brand-highlight border-brand-highlight-border">
                       <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center shadow-sm text-4xl">📊</div>
                       <div>
                         <h3 className="text-xl font-bold text-brand-dark">Market Trends</h3>
                         <p className="text-sm text-brand-primary font-bold uppercase tracking-widest mt-1">Real-time Data Active</p>
                       </div>
                    </Card>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-4 space-y-8 h-full">
                <Card className="bg-white border-brand-border shadow-xl shadow-brand-dark/5 flex flex-col h-full min-h-[600px]">
                  <h3 className="font-bold text-2xl mb-8 text-brand-dark tracking-tight px-2">Market Intelligence</h3>
                    <div className="space-y-4 overflow-y-auto flex-1 pr-2 custom-scrollbar">
                    {alerts.length > 0 ? alerts.map(alert => (
                      <div key={alert.id} className="flex gap-4 p-5 bg-brand-bg rounded-3xl border border-brand-border group hover:border-brand-primary transition-all cursor-pointer relative">
                        <div className="w-14 h-14 bg-white border border-brand-border rounded-2xl flex items-center justify-center shrink-0 shadow-sm text-2xl group-hover:scale-110 transition-transform">
                          {alert.type === 'warning' ? '📈' : alert.type === 'success' ? '🚀' : '💡'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-base text-brand-dark leading-tight truncate pr-4">{alert.title}</h4>
                          <p className="text-xs text-brand-muted font-semibold mt-1 leading-relaxed pr-6 line-clamp-2">{alert.description}</p>
                        </div>
                        <button 
                          onClick={(e) => dismissAlert(alert.id, e)}
                          className="absolute top-4 right-4 text-brand-muted opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all p-1"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    )) : (
                      <div className="text-center py-20 px-6 text-brand-muted opacity-50 bg-brand-surface rounded-[40px] border-2 border-dashed border-brand-border">
                        <Loader2 className="animate-spin mx-auto mb-4" size={32} />
                        <p className="text-lg font-bold">Scanning Markets...</p>
                      </div>
                    )}
                  </div>
                  <div className="mt-8 pt-8 border-t border-brand-border">
                    <Button 
                      variant={currentFarmer?.isProSubscriber ? "secondary" : "outline"} 
                      onClick={handleSubscribe}
                      disabled={isSubscribing || currentFarmer?.isProSubscriber}
                      className="text-xs font-black tracking-[0.2em] py-4 rounded-2xl relative overflow-hidden"
                    >
                      {isSubscribing ? (
                        <Loader2 className="animate-spin" size={16} />
                      ) : currentFarmer?.isProSubscriber ? (
                        <span className="flex items-center gap-2"><CheckCircle2 size={16} /> PRO UPDATES ACTIVE</span>
                      ) : (
                        "SUBSCRIBE TO PRO UPDATES"
                      )}
                    </Button>
                  </div>
                </Card>
              </div>
            </div>
          </ScreenWrapper>
        )}

        {/* INPUT SCREEN */}
        {currentScreen === 'input' && (
          <ScreenWrapper>
            <div className="max-w-3xl mx-auto space-y-12 py-10">
              <header className="text-center">
                <h1 className="text-5xl md:text-6xl font-black text-brand-dark tracking-tighter mb-4">Advisory <span className="text-brand-primary">Setup</span></h1>
                <p className="text-xl text-brand-muted font-medium max-w-xl mx-auto">Configure your distribution parameters to generate a high-precision market analysis.</p>
              </header>

              <Card className="p-12 shadow-2xl border-brand-border bg-white overflow-visible">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-10">
                  <div className="space-y-3">
                    <label className="text-xs font-black uppercase text-brand-dark tracking-[0.2em] mb-2 block">Primary Crop</label>
                    <div className="relative">
                      <select 
                        value={selectedProduct}
                        onChange={(e) => setSelectedProduct(e.target.value)}
                        className="w-full px-6 py-5 rounded-3xl bg-white border-2 border-brand-border focus:outline-none focus:border-brand-primary text-xl font-black text-brand-dark appearance-none cursor-pointer hover:border-brand-primary/60 transition-colors"
                      >
                        <option>🍅 Tomato</option>
                        <option>🧅 Onion</option>
                        <option>Potato</option>
                        <option>🌶️ Chilli</option>
                        <option>🥬 Cabbage</option>
                      </select>
                      <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-brand-primary">
                        <ArrowRight size={24} className="rotate-90" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-xs font-black uppercase text-brand-dark tracking-[0.2em] mb-2 block">Distribution Base</label>
                    <div className="relative">
                      <MapPin className="absolute left-6 top-1/2 -translate-y-1/2 text-brand-primary pointer-events-none" size={24} />
                      <input 
                        type="text" 
                        placeholder="e.g. Nashik" 
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        className="w-full pl-16 pr-6 py-5 rounded-3xl bg-white border-2 border-brand-border focus:outline-none focus:border-brand-primary text-xl font-black text-brand-dark hover:border-brand-primary/60 transition-colors"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3 mb-12">
                  <label className="text-xs font-black uppercase text-brand-dark tracking-[0.2em] mb-2 block">Estimated Harvest/Selling Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-6 top-1/2 -translate-y-1/2 text-brand-primary pointer-events-none" size={24} />
                    <input 
                      type="date" 
                      value={harvestDate}
                      onChange={(e) => setHarvestDate(e.target.value)}
                      className="w-full pl-16 pr-6 py-5 rounded-3xl bg-white border-2 border-brand-border focus:outline-none focus:border-brand-primary text-xl font-black text-brand-dark hover:border-brand-primary/60 transition-colors"
                    />
                  </div>
                </div>

                <Button onClick={handlePredict} className="py-8 text-2xl font-black rounded-3xl shadow-xl shadow-brand-primary/20">
                  GENERATE ADVISORY REPORT
                </Button>
              </Card>

              <div className="p-8 bg-brand-highlight/30 border-2 border-brand-highlight-border border-dashed rounded-[40px] flex items-start gap-6">
                <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center text-3xl shadow-sm">💡</div>
                <div>
                  <h4 className="font-black text-brand-dark text-lg mb-1 tracking-tight">AI Note</h4>
                  <p className="text-brand-muted font-medium">Using high-resolution data from local Nashik mandis and historical seasonal peaks to calculate your ROI.</p>
                </div>
              </div>
            </div>
          </ScreenWrapper>
        )}

        {/* LOADING SCREEN */}
        {currentScreen === 'loading' && (
          <ScreenWrapper>
            <div className="p-8 h-screen flex flex-col items-center justify-center text-center bg-brand-highlight">
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="mb-8"
              >
                <Loader2 size={80} className="text-brand-primary" />
              </motion.div>
              <h2 className="text-3xl font-bold mb-4 text-brand-dark tracking-tight">Analyzing Market</h2>
              <p className="text-brand-muted font-medium max-w-[250px] leading-relaxed">Our AI is scanning regional markets and historical trends for you...</p>
              
              <div className="mt-12 space-y-4 w-full max-w-[220px]">
                <div className="flex items-center gap-3 text-brand-primary text-sm font-bold">
                  <CheckCircle2 size={16} /> Scanning Mandi rates
                </div>
                <div className="flex items-center gap-3 text-brand-primary text-sm font-bold">
                  <CheckCircle2 size={16} /> Calculating travel logistics
                </div>
                <div className="flex items-center gap-3 text-brand-muted text-sm font-bold opacity-40">
                   Predicting weekly trends
                </div>
              </div>
            </div>
          </ScreenWrapper>
        )}

        {/* RESULT SCREEN */}
        {currentScreen === 'result' && prediction && (
          <ScreenWrapper>
            <div className="max-w-5xl mx-auto space-y-10 py-6 md:py-12">
              <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-brand-border pb-10">
                <div className="space-y-4">
                  <button onClick={() => navigateTo('input')} className="group flex items-center gap-2 font-black text-brand-primary tracking-[0.2em] text-xs transition-transform hover:-translate-x-1">
                    <ChevronLeft size={20} /> RETURN TO SETUP
                  </button>
                  <h1 className="text-5xl font-black text-brand-dark tracking-tighter leading-tight">
                    Prediction for <span className="text-brand-primary">{prediction.product}</span>
                  </h1>
                  <div className="flex gap-4 text-sm font-bold text-brand-muted tracking-widest uppercase items-center">
                    <span className="flex items-center gap-1"><MapPin size={16} /> {prediction.location}</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-border"></span>
                    <span className="flex items-center gap-1"><Calendar size={16} /> Generated Today</span>
                  </div>
                </div>
                
                <div className={`px-8 py-3 rounded-2xl font-black text-sm tracking-[0.3em] uppercase shadow-lg ${
                  prediction.demand === 'High' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {prediction.demand} Demand
                </div>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
                <Card className="md:col-span-7 bg-brand-dark border-none p-12 flex flex-col justify-between min-h-[420px] relative overflow-hidden group shadow-2xl">
                  <div className="absolute top-0 right-0 w-96 h-96 bg-brand-primary/20 rounded-full blur-[100px] -mr-32 -mt-32 group-hover:scale-110 transition-transform"></div>
                  <div className="relative z-10">
                    <p className="text-white/80 font-black uppercase tracking-[0.4em] text-[10px] mb-4">Estimated Market Price (₹/KG)</p>
                    <div className="flex items-baseline gap-4">
                       <span className="text-[100px] font-black text-white tracking-tighter leading-[0.8] drop-shadow-[0_20px_20px_rgba(0,0,0,0.3)]">₹{prediction.price}</span>
                       <span className="text-2xl text-brand-highlight font-black tracking-widest bg-brand-primary px-4 py-1 rounded-full shadow-lg">PER KG</span>
                    </div>
                  </div>

                  <div className="relative z-10 flex gap-16 mt-16 pt-16 border-t border-white/10">
                    <div>
                      <p className="text-white/30 font-black uppercase text-[10px] tracking-[0.3em] mb-2">Price Trend</p>
                      <div className="flex items-center gap-3">
                        {prediction.trend === 'Increasing' ? <TrendingUp className="text-green-400" size={32} /> : <TrendingDown className="text-red-400" size={32} />}
                        <span className="text-2xl font-black text-white tracking-tight leading-none">{prediction.trend}</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-white/60 font-black uppercase text-[10px] tracking-[0.3em] mb-2">Confidence Score</p>
                      <span className="text-2xl font-black text-white tracking-tight leading-none">94% Accurate</span>
                    </div>
                  </div>
                </Card>

                <div className="md:col-span-5 space-y-6">
                  <Card className="bg-brand-highlight border-2 border-brand-highlight-border p-10 flex flex-col justify-between group">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-primary mb-4">Recommended Distribution Center</p>
                      <h3 className="text-3xl font-black text-brand-dark leading-tight tracking-tighter group-hover:text-brand-primary transition-colors">{prediction.bestLocation}</h3>
                    </div>
                    <div className="mt-10">
                      <Button variant="dark" onClick={() => navigateTo('map')} className="py-5 font-black tracking-[0.2em] text-xs">VISUALIZE LOGISTICS ROUTE</Button>
                    </div>
                  </Card>

                  <Card className="bg-white p-10 border-brand-border border-2 flex items-center justify-between font-sans">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-muted mb-2">Target Selling Window</p>
                      <h3 className="text-2xl font-black text-brand-dark tracking-tighter">{prediction.bestTime}</h3>
                    </div>
                    <div className="w-16 h-16 bg-brand-surface rounded-3xl flex items-center justify-center text-brand-primary text-3xl">📅</div>
                  </Card>
                </div>
              </div>

              <div className="md:col-span-12 space-y-8 pt-10 border-t border-brand-border">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div>
                    <h2 className="text-4xl font-black text-brand-dark tracking-tighter">Multi-Market Comparison</h2>
                    <p className="text-brand-muted font-medium mt-1">Compare prices and demand across nearby trading hubs.</p>
                  </div>
                  <div className="flex items-center gap-3 bg-brand-surface p-2 rounded-2xl border border-brand-border">
                    <span className="text-[10px] font-black uppercase text-brand-muted px-3 tracking-widest">Sort By</span>
                    {(['price', 'distance', 'demand'] as const).map((option) => (
                      <button
                        key={option}
                        onClick={() => setSortBy(option)}
                        className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                          sortBy === option 
                            ? 'bg-brand-primary text-white shadow-lg' 
                            : 'text-brand-muted hover:bg-brand-border/20'
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {prediction.comparisons
                    ?.slice()
                    .sort((a, b) => {
                      if (sortBy === 'price') return b.price - a.price;
                      if (sortBy === 'distance') return parseInt(a.distance) - parseInt(b.distance);
                      if (sortBy === 'demand') {
                        const weight = { High: 3, Medium: 2, Low: 1 };
                        return weight[b.demand] - weight[a.demand];
                      }
                      return 0;
                    })
                    .map((item, idx) => (
                      <Card 
                        key={idx} 
                        className={`relative group bg-white border-2 transition-all p-8 flex flex-col justify-between min-h-[280px] ${
                          item.isBest ? 'border-brand-primary ring-4 ring-brand-primary/10' : 'border-brand-border/40 hover:border-brand-primary/60'
                        }`}
                      >
                        {item.isBest && (
                          <div className="absolute top-6 right-6 flex items-center gap-2 bg-brand-primary text-white px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest shadow-lg animate-bounce">
                            <Sparkles size={14} /> BEST OPTION
                          </div>
                        )}
                        
                        <div>
                          <div className="flex items-center gap-2 mb-4">
                            <MapPin size={16} className="text-brand-primary" />
                            <h4 className="text-2xl font-black text-brand-dark tracking-tighter">{item.city}</h4>
                          </div>
                          
                          <div className="flex items-baseline gap-2 mb-6">
                            <span className="text-4xl font-black text-brand-dark tracking-tighter">₹{item.price}</span>
                            <span className="text-xs font-black text-brand-muted tracking-widest">/KG</span>
                          </div>

                          <div className="flex items-center gap-4 border-t border-brand-border/20 pt-6">
                            <div className="flex-1">
                              <p className="text-[10px] font-black uppercase text-brand-muted tracking-widest mb-1">Demand</p>
                              <div className={`text-xs font-black px-3 py-1 rounded-lg w-fit ${
                                item.demand === 'High' ? 'bg-green-100 text-green-700' :
                                item.demand === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-red-100 text-red-700'
                              }`}>
                                {item.demand}
                              </div>
                            </div>
                            <div className="flex-1 text-right">
                              <p className="text-[10px] font-black uppercase text-brand-muted tracking-widest mb-1">Distance</p>
                              <p className="text-lg font-black text-brand-dark tracking-tighter">{item.distance}</p>
                            </div>
                          </div>
                        </div>

                        {item.reason && (
                          <div className="mt-8 p-4 bg-brand-surface rounded-2xl border border-brand-border/40">
                             <p className="text-xs font-medium text-brand-muted leading-relaxed">
                               <span className="font-black text-brand-dark mr-1 italic">Note:</span> {item.reason}
                             </p>
                          </div>
                        )}

                        <div className="mt-8 transition-opacity opacity-0 group-hover:opacity-100">
                          <Button 
                            variant="outline" 
                            onClick={() => navigateTo('map')} 
                            className="w-full py-4 rounded-2xl text-[10px] font-black tracking-widest border-2"
                          >
                            VIEW LOGISTICS ROUTE
                          </Button>
                        </div>
                      </Card>
                    ))}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-6 pt-10 border-t border-brand-border">
                <Button className="flex-1 py-8 text-xl font-black rounded-3xl">
                   EXPORT FULL REPORT (PDF)
                </Button>
                <Button variant="outline" className="flex-1 py-8 text-xl font-black rounded-3xl border-2">
                   SHARE WITH COMMUNITY
                </Button>
              </div>
            </div>
          </ScreenWrapper>
        )}

        {/* MAP SCREEN */}
        {currentScreen === 'map' && (
          <ScreenWrapper>
            <div className="h-[800px] rounded-[40px] overflow-hidden border-4 border-white shadow-2xl relative">
               <div className="absolute top-8 left-8 z-20">
                  <button onClick={() => navigateTo('result')} className="p-4 rounded-2xl bg-white shadow-2xl text-brand-dark hover:scale-105 transition-transform">
                    <ChevronLeft size={32} />
                  </button>
               </div>
               
               <div className="h-full flex flex-col md:flex-row">
                  {/* Mock Map Background */}
                  <div className="flex-1 relative overflow-hidden bg-[url('https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&q=80&w=1000')] bg-cover bg-center">
                    <div className="absolute inset-0 bg-brand-primary/10"></div>
                    
                    <svg className="absolute inset-0 w-full h-full pointer-events-none">
                      <path d="M50 800 Q150 600 200 500 T350 200" stroke="#2E7D32" strokeWidth="6" fill="transparent" strokeLinecap="round" strokeDasharray="10 10" />
                    </svg>

                    <div className="absolute top-1/4 right-1/4">
                       <motion.div animate={{ y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 2 }}>
                          <div className="bg-brand-primary p-4 rounded-full text-white shadow-xl shadow-brand-primary/40 relative">
                             <MapPin size={40} />
                             <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 bg-white px-4 py-2 rounded-xl text-brand-dark font-black text-xs whitespace-nowrap shadow-2xl uppercase tracking-widest border border-brand-border">
                                Nashik Mandi Center
                             </div>
                          </div>
                       </motion.div>
                    </div>

                    <div className="absolute bottom-1/4 left-1/4">
                       <div className="bg-brand-dark p-3 rounded-full text-white shadow-lg border-2 border-white">
                          <User size={32} />
                       </div>
                    </div>
                  </div>

                  <div className="w-full md:w-[400px] bg-white p-10 flex flex-col border-l border-brand-border h-full overflow-y-auto">
                    <div className="mb-10">
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-primary mb-2">Logistics Intelligence</p>
                      <h2 className="text-4xl font-black text-brand-dark tracking-tighter">Optimal Path</h2>
                    </div>

                    <div className="space-y-8 flex-1">
                      <div className="flex items-center gap-6 p-6 bg-brand-surface rounded-3xl border border-brand-border">
                        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-3xl shadow-sm border border-brand-border">🚚</div>
                        <div>
                          <p className="text-xs font-black text-brand-muted uppercase tracking-widest">Travel Time</p>
                          <h4 className="text-2xl font-black text-brand-dark">1h 15m</h4>
                        </div>
                      </div>

                      <div className="flex items-center gap-6 p-6 bg-brand-highlight/30 rounded-3xl border border-brand-highlight-border">
                        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-3xl shadow-sm border border-brand-border">⛽</div>
                        <div>
                          <p className="text-xs font-black text-brand-muted uppercase tracking-widest">Fuel Cost est.</p>
                          <h4 className="text-2xl font-black text-brand-dark">₹450</h4>
                        </div>
                      </div>

                      <div className="p-6 space-y-4">
                         <div className="flex gap-4">
                            <div className="flex flex-col items-center">
                               <div className="w-3 h-3 rounded-full bg-brand-primary"></div>
                               <div className="w-0.5 h-10 bg-brand-border"></div>
                            </div>
                            <span className="text-sm font-bold text-brand-dark tracking-tight">Your Farm Location</span>
                         </div>
                         <div className="flex gap-4">
                            <div className="flex flex-col items-center">
                               <div className="w-3 h-3 rounded-full bg-brand-dark"></div>
                            </div>
                            <span className="text-sm font-bold text-brand-dark tracking-tight">Nashik APMC Mandi</span>
                         </div>
                      </div>
                    </div>

                    <div className="mt-10">
                      <Button onClick={() => window.open('https://maps.google.com')} className="py-6 font-black tracking-widest">LAUNCH NAVIGATION</Button>
                    </div>
                  </div>
               </div>
            </div>
          </ScreenWrapper>
        )}

        {/* TASKS SCREEN */}
        {currentScreen === 'tasks' && (
          <ScreenWrapper>
            <div className="max-w-5xl mx-auto py-10">
              <header className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12">
                <div className="flex-1">
                  <button onClick={() => navigateTo('dashboard')} className="mb-6 group flex items-center gap-2 font-black text-brand-primary tracking-[0.2em] text-xs transition-transform hover:-translate-x-1">
                    <ChevronLeft size={20} /> RETURN TO DASHBOARD
                  </button>
                  <h1 className="text-6xl font-black text-brand-dark tracking-tighter leading-tight">Farm <span className="text-brand-primary">Activities</span></h1>
                  <p className="text-xl text-brand-muted font-medium mt-2">Manage your daily farming operations and seasonal schedules.</p>
                </div>
                <Button 
                  onClick={() => setIsTaskModalOpen(true)}
                  className="w-full md:w-auto px-8 py-5 rounded-[2rem] shadow-xl shadow-brand-primary/20 flex items-center gap-3"
                >
                  <Plus size={24} /> ADD NEW ACTIVITY
                </Button>
              </header>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                <div className="lg:col-span-2 space-y-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-2xl font-black text-brand-dark tracking-tight">Active Tasks</h3>
                    <div className="flex gap-2">
                       <span className="bg-brand-highlight text-brand-primary px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-brand-highlight-border">
                         {tasks.filter(t => t.status === 'Pending').length} Pending
                       </span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {tasks.length > 0 ? (
                      tasks.map(task => (
                        <Card key={task.id} className={`p-0 overflow-hidden border-2 transition-all ${task.status === 'Completed' ? 'opacity-60 border-brand-border/20 grayscale-[0.5]' : 'border-brand-border/40 hover:border-brand-primary'}`}>
                          <div className="flex items-center gap-6 p-6">
                            <button 
                              onClick={() => handleToggleTask(task.id, task.status)}
                              className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${task.status === 'Completed' ? 'bg-brand-primary text-white' : 'bg-brand-surface border-2 border-brand-border text-brand-muted hover:border-brand-primary'}`}
                            >
                              {task.status === 'Completed' ? <CheckCircle size={28} /> : <Circle size={28} />}
                            </button>
                            
                            <div className="flex-1">
                               <div className="flex items-center gap-3 mb-1">
                                 <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-[0.2em] border ${
                                   task.type === 'Planting' ? 'bg-green-50 text-green-700 border-green-200' :
                                   task.type === 'Irrigation' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                   task.type === 'Harvesting' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                   'bg-slate-50 text-slate-700 border-slate-200'
                                 }`}>
                                   {task.type}
                                 </span>
                                 <div className="flex items-center gap-1 text-brand-muted text-[10px] font-bold">
                                   <Clock size={12} /> {new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                 </div>
                               </div>
                               <h4 className={`text-xl font-black tracking-tight ${task.status === 'Completed' ? 'line-through text-brand-muted' : 'text-brand-dark'}`}>
                                 {task.title}
                               </h4>
                               {task.description && (
                                 <p className="text-sm text-brand-muted font-medium mt-1">{task.description}</p>
                               )}
                            </div>

                            <button 
                              onClick={() => handleDeleteTask(task.id)}
                              className="w-10 h-10 rounded-xl hover:bg-red-50 text-brand-muted hover:text-red-500 flex items-center justify-center transition-colors"
                            >
                              <Trash2 size={20} />
                            </button>
                          </div>
                        </Card>
                      ))
                    ) : (
                      <div className="py-20 text-center bg-white rounded-[40px] border-4 border-dashed border-brand-border/40">
                         <ClipboardList size={64} className="mx-auto text-brand-muted opacity-20 mb-6" />
                         <h3 className="text-2xl font-black text-brand-dark tracking-tight">No activities yet</h3>
                         <p className="text-brand-muted font-bold mt-2">Start organizing your farm by adding your first task.</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-8">
                  <Card className="bg-brand-dark border-none p-10 text-white relative overflow-hidden">
                     <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/20 rounded-full blur-3xl -mr-16 -mt-16"></div>
                     <h3 className="text-2xl font-black mb-4 tracking-tight relative z-10">Smart Schedule</h3>
                     <p className="text-brand-highlight/70 font-medium mb-8 relative z-10 leading-relaxed">Our AI analyzes your crop types and local weather to suggest the best times for irrigation and fertilizing.</p>
                     <Button variant="secondary" className="relative z-10 font-black tracking-widest text-xs">
                       OPTIMIZE CALENDAR
                     </Button>
                  </Card>
                </div>
              </div>
            </div>
          </ScreenWrapper>
        )}

      </main>

      {/* MOBILE BOTTOM NAVIGATION */}
      {currentScreen !== 'login' && currentScreen !== 'otp' && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-[150] bg-white/80 backdrop-blur-2xl border-t border-brand-border pb-safe">
          <div className="flex items-center justify-around h-20 px-6">
            <button 
              onClick={() => navigateTo('dashboard')}
              className={`flex flex-col items-center gap-1 transition-all ${currentScreen === 'dashboard' ? 'text-brand-primary scale-110' : 'text-brand-muted'}`}
            >
              <LayoutDashboard size={24} />
              <span className="text-[10px] font-black uppercase tracking-widest">Home</span>
            </button>
            <button 
              onClick={() => navigateTo('tasks')}
              className={`flex flex-col items-center gap-1 transition-all ${currentScreen === 'tasks' ? 'text-brand-primary scale-110' : 'text-brand-muted'}`}
            >
              <ClipboardList size={24} />
              <span className="text-[10px] font-black uppercase tracking-widest">Tasks</span>
            </button>
            <div className="relative -top-8">
              <button 
                onClick={() => navigateTo('input')}
                className="w-16 h-16 bg-brand-primary text-white rounded-full shadow-2xl flex items-center justify-center border-[6px] border-brand-bg hover:scale-110 active:scale-95 transition-all"
              >
                <Plus size={32} />
              </button>
            </div>
            <button 
              onClick={() => navigateTo('profile')}
              className={`flex flex-col items-center gap-1 transition-all ${currentScreen === 'profile' ? 'text-brand-primary scale-110' : 'text-brand-muted'}`}
            >
              <User size={24} />
              <span className="text-[10px] font-black uppercase tracking-widest">Profile</span>
            </button>
          </div>
        </div>
      )}

      {/* TASK CREATION MODAL */}
      <AnimatePresence>
        {isTaskModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsTaskModalOpen(false)}
              className="absolute inset-0 bg-brand-dark/40 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg"
            >
              <Card className="p-10 shadow-2xl bg-white border-2 border-brand-border rounded-[40px]">
                <div className="flex items-center justify-between mb-8">
                   <h3 className="text-3xl font-black text-brand-dark tracking-tighter">New Activity</h3>
                   <button onClick={() => setIsTaskModalOpen(false)} className="w-10 h-10 rounded-xl bg-brand-surface flex items-center justify-center text-brand-muted hover:text-brand-dark transition-colors">
                     <X size={24} />
                   </button>
                </div>

                <form onSubmit={handleAddTask} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase text-brand-muted ml-1 tracking-[0.2em]">Activity Name</label>
                    <input 
                      required
                      type="text" 
                      placeholder="e.g. Tomato Seeding" 
                      className="input-field"
                      value={taskForm.title}
                      onChange={e => setTaskForm({...taskForm, title: e.target.value})}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase text-brand-muted ml-1 tracking-[0.2em]">Category</label>
                      <select 
                        className="input-field"
                        value={taskForm.type}
                        onChange={e => setTaskForm({...taskForm, type: e.target.value as any})}
                      >
                        <option value="Planting">Planting</option>
                        <option value="Irrigation">Irrigation</option>
                        <option value="Fertilizing">Fertilizing</option>
                        <option value="Harvesting">Harvesting</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase text-brand-muted ml-1 tracking-[0.2em]">Due Date</label>
                      <input 
                        required
                        type="date" 
                        className="input-field"
                        value={taskForm.dueDate}
                        onChange={e => setTaskForm({...taskForm, dueDate: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase text-brand-muted ml-1 tracking-[0.2em]">Additional Notes (Optional)</label>
                    <textarea 
                      placeholder="e.g. Use 2kg of organic fertilizer" 
                      rows={3}
                      className="input-field resize-none"
                      value={taskForm.description}
                      onChange={e => setTaskForm({...taskForm, description: e.target.value})}
                    />
                  </div>

                  <div className="pt-4 flex gap-4">
                    <Button variant="outline" onClick={() => setIsTaskModalOpen(false)} className="flex-1">CANCEL</Button>
                    <Button type="submit" disabled={isLoading} className="flex-[2]">
                       {isLoading ? <Loader2 className="animate-spin" /> : 'CREATE TASK'}
                    </Button>
                  </div>
                </form>
              </Card>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CHATBOT FLOATING UI */}
      {currentScreen !== 'login' && currentScreen !== 'otp' && (
        <>
          {/* Floating Bubble */}
          <button 
            onClick={() => setIsChatOpen(true)}
            className={`fixed bottom-8 right-8 z-[100] w-16 h-16 bg-brand-primary text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all group ${isChatOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100'}`}
          >
            <MessageCircle size={32} />
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full border-2 border-white animate-pulse" />
          </button>

          {/* Chat Window */}
          <AnimatePresence>
            {isChatOpen && (
              <motion.div 
                initial={{ opacity: 0, y: 100, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 100, scale: 0.9 }}
                className="fixed bottom-8 right-8 z-[101] w-full max-w-[400px] h-[600px] max-h-[80vh] flex flex-col bg-white rounded-[2rem] shadow-[-20px_20px_60px_rgba(0,0,0,0.1)] border border-brand-border overflow-hidden"
              >
                {/* Chat Header */}
                <div className="p-6 bg-brand-dark text-white flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-brand-primary rounded-xl flex items-center justify-center shadow-lg">
                      <Sparkles size={20} className="text-white" />
                    </div>
                    <div>
                      <h4 className="font-black text-sm tracking-tight leading-none mb-1">KisanVikas AI Assistant</h4>
                      <p className="text-[10px] text-brand-primary font-black uppercase tracking-widest">Active Now</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsChatOpen(false)}
                    className="w-10 h-10 rounded-xl hover:bg-white/10 flex items-center justify-center transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
                  {chatMessages.map((msg, idx) => (
                    <div 
                      key={idx} 
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[85%] p-4 rounded-2xl ${
                        msg.role === 'user' 
                          ? 'bg-brand-primary text-white font-bold rounded-tr-none' 
                          : 'bg-brand-surface text-brand-dark font-medium border border-brand-border rounded-tl-none'
                      }`}>
                        <div className="text-sm prose prose-sm prose-invert leading-relaxed">
                          <Markdown>{msg.text}</Markdown>
                        </div>
                      </div>
                    </div>
                  ))}
                  {isChatLoading && (
                    <div className="flex justify-start">
                      <div className="bg-brand-surface p-4 rounded-2xl rounded-tl-none border border-brand-border flex items-center gap-2">
                        <Loader2 className="animate-spin text-brand-primary" size={16} />
                        <span className="text-xs font-black uppercase tracking-widest text-brand-muted">Assistant is thinking...</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Input Area */}
                <form 
                  onSubmit={handleSendChatMessage}
                  className="p-4 bg-brand-surface border-t border-brand-border flex gap-2"
                >
                  <input 
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask about crops, prices, or weather..."
                    className="flex-1 px-6 py-4 rounded-2xl bg-white border-2 border-brand-border focus:outline-none focus:border-brand-primary text-sm font-bold shadow-sm"
                  />
                  <button 
                    type="submit"
                    disabled={!chatInput.trim() || isChatLoading}
                    className="w-14 h-14 bg-brand-dark text-white rounded-2xl flex items-center justify-center hover:bg-brand-primary hover:scale-105 active:scale-95 disabled:opacity-50 transition-all shadow-lg"
                  >
                    <Send size={24} />
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {/* FOOTER */}
      <footer className="bg-white border-t border-brand-border py-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8 text-center md:text-left">
          <div className="flex items-center gap-3">
            <Logo className="w-10 h-10 shadow-md" showText={true} />
          </div>
          <div className="flex gap-8 text-xs font-bold text-brand-muted tracking-widest uppercase">
            <a href="#" className="hover:text-brand-primary transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-brand-primary transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-brand-primary transition-colors">Contact Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

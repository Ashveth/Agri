/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
  Sprout,
  AlertTriangle,
  Truck,
  Store,
  History,
  Leaf,
  Settings,
  Zap,
  Fuel,
  Navigation,
  AlertCircle,
  Info,
  PackageCheck,
  Calculator,
  Star,
  Users,
  Handshake
} from 'lucide-react';
import Markdown from 'react-markdown';
import { Screen, Prediction, Farmer, FarmTask, InventoryItem, SupplyChainTrack, Truck as TruckType, LoadItem, OptimizationResult, TransportProvider } from './types.ts';
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

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

// removed client-side Gemini initialization
// const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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
  const [analyzedInsights, setAnalyzedInsights] = useState<{
    highDemandCities: string[];
    lowSupplyProducts: string[];
    activeDeliverySummary: string;
    alerts: string[];
    recommendations: string;
  } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [deliveryInputs, setDeliveryInputs] = useState({
    source: 'Nashik',
    destination: 'Pune',
    distance: '210',
    traffic: 'Moderate'
  });
  const [deliveryPrediction, setDeliveryPrediction] = useState<{
    estimatedTime: string;
    eta: string;
    delayRisk: 'Low' | 'Medium' | 'High';
    alternativeRoute: string;
    reason: string;
  } | null>(null);
  const [isPredictingTime, setIsPredictingTime] = useState(false);
  const [isMonitoringTraffic, setIsMonitoringTraffic] = useState(false);
  const [showTrafficAlert, setShowTrafficAlert] = useState(false);
  const [spoilageInputs, setSpoilageInputs] = useState({
    product: 'Tomatoes',
    quantity: '500',
    harvestDate: new Date(Date.now() - 72 * 3600000).toISOString().split('T')[0],
    temperature: '32',
    humidity: '65',
    storageCondition: 'Open Air'
  });
  const [spoilagePrediction, setSpoilagePrediction] = useState<{
    risk: 'Low' | 'Medium' | 'High';
    timeLeft: string;
    action: string;
    factors: string[];
    alerts: string[];
  } | null>(null);
  const [isPredictingSpoilage, setIsPredictingSpoilage] = useState(false);
  const [routeInputs, setRouteInputs] = useState({
    source: 'Nashik',
    destination: 'Pune',
    distance: '210',
    traffic: 'Moderate'
  });
  const [routeOptimization, setRouteOptimization] = useState<{
    fastestRoute: { time: string; distance: string; traffic: string; fuel: string };
    cheapestRoute: { time: string; distance: string; traffic: string; fuel: string };
    recommended: 'Fastest' | 'Cheapest';
    reason: string;
    alternativeSuggestion: string;
    delayRisk: 'Low' | 'Medium' | 'High';
  } | null>(null);
  const [isOptimizingRoute, setIsOptimizingRoute] = useState(false);
  const [supplyDemandInputs, setSupplyDemandInputs] = useState({
    farmerProduct: 'Tomato',
    farmerQuantity: '1000',
    farmerLocation: 'Nashik',
    buyerProduct: 'Tomato',
    buyerQuantity: '800',
    buyerLocation: 'Mumbai',
    buyerPrice: '25'
  });
  const [supplyDemandMatches, setSupplyDemandMatches] = useState<{
    bestMatch: string;
    matchScore: string;
    suggestedBuyers: string[];
    distance: string;
    price: string;
    reason: string;
  } | null>(null);
  const [isMatching, setIsMatching] = useState(false);
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

  const [inventory, setInventory] = useState<InventoryItem[]>(() => {
    const saved = localStorage.getItem('inventory');
    if (saved) return JSON.parse(saved);
    return [
      { id: '1', name: 'Tomato', availableStock: 500, soldStock: 350, remainingStock: 150, threshold: 100, unit: 'kg', updatedAt: new Date().toISOString() },
      { id: '2', name: 'Onion', availableStock: 1000, soldStock: 900, remainingStock: 100, threshold: 200, unit: 'kg', updatedAt: new Date().toISOString() },
      { id: '3', name: 'Potato', availableStock: 2000, soldStock: 400, remainingStock: 1600, threshold: 400, unit: 'kg', updatedAt: new Date().toISOString() },
    ];
  });

  const [isInventoryModalOpen, setIsInventoryModalOpen] = useState(false);
  const [editingInventoryId, setEditingInventoryId] = useState<string | null>(null);
  const [inventoryForm, setInventoryForm] = useState({
    name: '',
    availableStock: '',
    soldStock: '0',
    threshold: '',
    unit: 'kg'
  });

  useEffect(() => {
    localStorage.setItem('inventory', JSON.stringify(inventory));
  }, [inventory]);

  const [tracking, setTracking] = useState<SupplyChainTrack[]>(() => {
    const saved = localStorage.getItem('tracking');
    if (saved) return JSON.parse(saved);
    return [
      {
        id: 'tr-1',
        productId: '1',
        productName: 'Fresh Tomatos',
        batchId: 'BAT-2024-001',
        estimatedDelivery: '2024-04-26T14:00:00Z',
        currentLocation: 'Nashik Warehouse',
        stages: [
          { id: 's1', name: 'Farm', status: 'Completed', location: 'Green Valley Farm', timestamp: '2024-04-24T08:00:00Z', description: 'Dispatched from farm' },
          { id: 's2', name: 'Transport', status: 'In Progress', location: 'Nashik-Mumbai Highway', timestamp: '2024-04-25T10:30:00Z', description: 'Reached Nashik Warehouse' },
          { id: 's3', name: 'Market', status: 'Pending', location: 'Navi Mumbai Market', timestamp: '', description: 'Out for delivery' }
        ]
      },
      {
        id: 'tr-2',
        productId: '2',
        productName: 'Organic Onions',
        batchId: 'BAT-2024-002',
        estimatedDelivery: '2024-04-27T09:00:00Z',
        currentLocation: 'Green Valley Farm',
        stages: [
          { id: 's1', name: 'Farm', status: 'Completed', location: 'Green Valley Farm', timestamp: '2024-04-25T07:00:00Z', description: 'Harvested and Packed' },
          { id: 's2', name: 'Transport', status: 'Pending', location: 'Pending Pickups', timestamp: '', description: 'Waiting for transport' },
          { id: 's3', name: 'Market', status: 'Pending', location: 'Mumbai Central Market', timestamp: '', description: 'Planned' }
        ]
      }
    ];
  });

  const [activeTrackingId, setActiveTrackingId] = useState<string | null>(null);

  const [trucks] = useState<TruckType[]>([
    { id: 't1', type: 'Small Pickup', capacity: 500, icon: '🛻' },
    { id: 't2', type: 'Medium Truck', capacity: 2000, icon: '🚚' },
    { id: 't3', type: 'Large Trailer', capacity: 5000, icon: '🚛' },
  ]);

  const [selectedTruckId, setSelectedTruckId] = useState<string>('t1');
  const [loadItems, setLoadItems] = useState<LoadItem[]>([
    { id: 'l1', name: 'Tomatos', quantity: 300 },
    { id: 'l2', name: 'Onions', quantity: 150 },
  ]);
  const [optimizationResult, setOptimizationResult] = useState<OptimizationResult | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);

  const [providers] = useState<TransportProvider[]>([
    { id: 'p1', name: 'Raj Transport', vehicleType: 'Medium Truck', capacity: '2000kg', distance: '2.4 km', estimatedCost: 1500, availability: 'Available', rating: 4.8, phone: '+91 98765 43210', icon: '🚚' },
    { id: 'p2', name: 'Metro Logistics', vehicleType: 'Large Trailer', capacity: '5000kg', distance: '5.1 km', estimatedCost: 3200, availability: 'Available', rating: 4.5, phone: '+91 98765 43211', icon: '🚛' },
    { id: 'p3', name: 'Quick Pickup', vehicleType: 'Small Pickup', capacity: '500kg', distance: '1.2 km', estimatedCost: 600, availability: 'Busy', rating: 4.2, phone: '+91 98765 43212', icon: '🛻' },
    { id: 'p4', name: 'Farmer Connect', vehicleType: 'Medium Truck', capacity: '2500kg', distance: '3.8 km', estimatedCost: 1800, availability: 'Available', rating: 4.9, phone: '+91 98765 43213', icon: '🚚' },
  ]);

  useEffect(() => {
    localStorage.setItem('tracking', JSON.stringify(tracking));
  }, [tracking]);

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
    if (screen !== 'delivery_prediction') {
      setIsMonitoringTraffic(false);
      setShowTrafficAlert(false);
    }
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

  const handleInventoryAction = (e: React.FormEvent) => {
    e.preventDefault();
    const available = Math.max(0, Number(inventoryForm.availableStock));
    const sold = Math.max(0, Number(inventoryForm.soldStock));
    const remaining = Math.max(0, available - sold);
    
    const newItem: InventoryItem = {
      id: editingInventoryId || Math.random().toString(36).substr(2, 9),
      name: inventoryForm.name,
      availableStock: available,
      soldStock: sold,
      remainingStock: remaining,
      threshold: Number(inventoryForm.threshold),
      unit: inventoryForm.unit,
      updatedAt: new Date().toISOString()
    };

    if (editingInventoryId) {
      setInventory(prev => prev.map(item => item.id === editingInventoryId ? newItem : item));
    } else {
      setInventory(prev => [...prev, newItem]);
    }

    setIsInventoryModalOpen(false);
    setEditingInventoryId(null);
    setInventoryForm({ name: '', availableStock: '', soldStock: '0', threshold: '', unit: 'kg' });
  };

  const handleDeleteInventory = (id: string) => {
    if (confirm("Remove this product from inventory?")) {
      setInventory(prev => prev.filter(item => item.id !== id));
    }
  };

  const handleOptimizeLoad = async () => {
    setIsOptimizing(true);
    setOptimizationResult(null);
    try {
      const truck = trucks.find(t => t.id === selectedTruckId);
      if (!truck) return;

      const systemPrompt = `You are a logistics and supply chain optimization expert for agriculture.
      Truck Type: ${truck.type}
      Truck Capacity: ${truck.capacity}kg
      Items to load: ${loadItems.map(i => `${i.name}: ${i.quantity}kg`).join(', ')}

      Analyze the input and provide an optimal load plan to maximize space usage, minimize empty capacity, and reduce transportation costs.
      
      Return the response in the following JSON format:
      {
        "loadPlan": "Detailed arrangement description (e.g. Heavier items at bottom...)",
        "usedCapacityPercent": number (percentage of weight capacity used),
        "remainingSpace": "Concrete description of left-over capacity (kg or items)",
        "additionalSuggestion": "Specific products or quantities to add to reach 100% capacity and maximize ROI",
        "numberOfTrips": number (Total trips needed to transport all items),
        "costEfficiency": "Specific cost efficiency analysis (e.g. Saving 15% by combining loads)"
      }`;

      const aiResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: systemPrompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              loadPlan: { type: Type.STRING },
              usedCapacityPercent: { type: Type.NUMBER },
              remainingSpace: { type: Type.STRING },
              additionalSuggestion: { type: Type.STRING },
              numberOfTrips: { type: Type.NUMBER },
              costEfficiency: { type: Type.STRING }
            }
          }
        }
      });

      const result = JSON.parse(aiResponse.text || '{}');
      setOptimizationResult(result);
    } catch (error) {
      console.error("Optimization failed:", error);
    } finally {
      setIsOptimizing(false);
    }
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
      Current Inventory: ${inventory.map(i => `${i.name}: ${i.remainingStock}${i.unit} remaining (from ${i.availableStock}${i.unit} total), ${i.soldStock}${i.unit} sold`).join(', ')}.
      Supply Chain Tracking: ${tracking.map(t => `${t.productName} (Batch ${t.batchId}): Currently at ${t.currentLocation}, Estimated delivery ${t.estimatedDelivery}`).join(', ')}.
      Provide concise, practical advice for farmers. If they ask about market trends, inventory, or supply chain, use the context provided.
      Current conversation history:
      ${chatMessages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`).join('\n')}
      Assistant:`;

      const aiResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: systemPrompt,
      });

      const aiText = aiResponse.text || "I'm sorry, I couldn't process that. Please try asking again.";
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

  const handleAnalyzeSupplyChain = async () => {
    setIsAnalyzing(true);
    try {
      const systemPrompt = `You are a supply chain optimization specialist for agriculture.
      Based on the following data, provide a concise real-time analysis:
      
      Inventory Status: ${inventory.map(i => `${i.name}: ${i.remainingStock}${i.unit} remaining (Threshold: ${i.threshold})`).join(', ')}
      Active Deliveries: ${tracking.map(t => `${t.productName} (Batch ${t.batchId}) at ${t.currentLocation}`).join(', ')}
      
      Return a JSON with:
      {
        "highDemandCities": ["City A", "City B"],
        "lowSupplyProducts": ["Product X"],
        "activeDeliveryStatus": "Summary message",
        "alerts": ["Alert 1", "Alert 2"],
        "recommendedAction": "Primary strategic advice"
      }`;

      const aiResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: systemPrompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              highDemandCities: { type: Type.ARRAY, items: { type: Type.STRING } },
              lowSupplyProducts: { type: Type.ARRAY, items: { type: Type.STRING } },
              activeDeliveryStatus: { type: Type.STRING },
              alerts: { type: Type.ARRAY, items: { type: Type.STRING } },
              recommendedAction: { type: Type.STRING }
            }
          }
        }
      });

      const result = JSON.parse(aiResponse.text || '{}');
      setAnalyzedInsights({
        highDemandCities: result.highDemandCities,
        lowSupplyProducts: result.lowSupplyProducts,
        activeDeliverySummary: result.activeDeliveryStatus,
        alerts: result.alerts,
        recommendations: result.recommendedAction
      });
    } catch (error) {
      console.error("Analysis failed:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCheckDeliveryTime = async () => {
    setIsPredictingTime(true);
    setShowTrafficAlert(false);
    try {
      const systemPrompt = `You are a logistics and delivery time prediction AI for the agri-supply chain.
      Predict delivery time for the following route:
      Source: ${deliveryInputs.source}
      Destination: ${deliveryInputs.destination}
      Distance: ${deliveryInputs.distance}km
      Traffic Condition: ${deliveryInputs.traffic}
      
      Current Time: ${new Date().toLocaleTimeString()}
      
      Return a JSON with:
      {
        "estimatedTime": "X hours Y minutes",
        "eta": "HH:MM AM/PM",
        "delayRisk": "Low" | "Medium" | "High",
        "alternativeRouteSuggestion": "Route name and time saved",
        "reason": "Explain the delay if any"
      }`;

      const aiResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: systemPrompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              estimatedTime: { type: Type.STRING },
              eta: { type: Type.STRING },
              delayRisk: { type: Type.STRING, enum: ["Low", "Medium", "High"] },
              alternativeRouteSuggestion: { type: Type.STRING },
              reason: { type: Type.STRING }
            }
          }
        }
      });

      const result = JSON.parse(aiResponse.text || '{}');
      setDeliveryPrediction({
        estimatedTime: result.estimatedTime,
        eta: result.eta,
        delayRisk: result.delayRisk as 'Low' | 'Medium' | 'High',
        alternativeRoute: result.alternativeRouteSuggestion,
        reason: result.reason
      });
      setIsMonitoringTraffic(true);
    } catch (error) {
      console.error("Prediction failed:", error);
    } finally {
      setIsPredictingTime(false);
    }
  };

  const handleUpdateETA = async () => {
    if (!deliveryPrediction) return;
    
    setIsPredictingTime(true);
    setShowTrafficAlert(false);
    try {
      const systemPrompt = `You are a logistics and delivery time prediction AI. 
      TRAFFIC ALERT: Conditions on the route from ${deliveryInputs.source} to ${deliveryInputs.destination} have WORSENED (Accident/Heavy Congestion reported).
      Previous ETA: ${deliveryPrediction.eta}
      Previous Risk: ${deliveryPrediction.delayRisk}
      
      Recalculate the NEW ETA and NEW Delay Risk.
      Return a JSON with:
      {
        "estimatedTime": "Updated duration",
        "eta": "Updated HH:MM AM/PM",
        "delayRisk": "Likely High",
        "alternativeRouteSuggestion": "NEW emergency bypass route",
        "reason": "Explain the specific worsening conditions"
      }`;

      const aiResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: systemPrompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              estimatedTime: { type: Type.STRING },
              eta: { type: Type.STRING },
              delayRisk: { type: Type.STRING, enum: ["Low", "Medium", "High"] },
              alternativeRouteSuggestion: { type: Type.STRING },
              reason: { type: Type.STRING }
            }
          }
        }
      });

      const result = JSON.parse(aiResponse.text || '{}');
      setDeliveryPrediction({
        estimatedTime: result.estimatedTime,
        eta: result.eta,
        delayRisk: result.delayRisk as 'Low' | 'Medium' | 'High',
        alternativeRoute: result.alternativeRouteSuggestion,
        reason: result.reason
      });
      setIsMonitoringTraffic(false); // Stop monitoring after update for this demo
    } catch (error) {
      console.error("Traffic update failed:", error);
    } finally {
      setIsPredictingTime(false);
    }
  };

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (isMonitoringTraffic && deliveryPrediction) {
      // Simulate traffic worsening detection after 10 seconds
      timeout = setTimeout(() => {
        setShowTrafficAlert(true);
      }, 10000);
    }
    return () => clearTimeout(timeout);
  }, [isMonitoringTraffic, deliveryPrediction]);

  const handleAnalyzeSpoilage = async () => {
    setIsPredictingSpoilage(true);
    try {
      const systemPrompt = `You are an expert in agriculture post-harvest management and spoilage prediction.
      Analyze spoilage risk for the following product:
      Product: ${spoilageInputs.product}
      Quantity: ${spoilageInputs.quantity}kg
      Harvest Date: ${spoilageInputs.harvestDate}
      Ambient Temperature: ${spoilageInputs.temperature}°C
      Humidity: ${spoilageInputs.humidity}%
      Storage Condition: ${spoilageInputs.storageCondition}
      
      Return a JSON with:
      {
        "risk": "Low" | "Medium" | "High",
        "timeLeft": "X days/hours left",
        "action": "Primary suggested action (e.g. Sell immediately)",
        "factors": ["Factor 1", "Factor 2"],
        "alerts": ["Warning message if any"]
      }`;

      const aiResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: systemPrompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              risk: { type: Type.STRING, enum: ["Low", "Medium", "High"] },
              timeLeft: { type: Type.STRING },
              action: { type: Type.STRING },
              factors: { type: Type.ARRAY, items: { type: Type.STRING } },
              alerts: { type: Type.ARRAY, items: { type: Type.STRING } }
            }
          }
        }
      });

      const result = JSON.parse(aiResponse.text || '{}');
      setSpoilagePrediction({
        risk: result.risk as 'Low' | 'Medium' | 'High',
        timeLeft: result.timeLeft,
        action: result.action,
        factors: result.factors,
        alerts: result.alerts
      });
    } catch (error) {
      console.error("Spoilage analysis failed:", error);
    } finally {
      setIsPredictingSpoilage(false);
    }
  };

  const handleOptimizeRoute = async () => {
    setIsOptimizingRoute(true);
    try {
      const systemPrompt = `You are a smart logistics and route optimization AI for the agri-supply chain.
      Optimize the route for:
      Source: ${routeInputs.source}
      Destination: ${routeInputs.destination}
      Total Distance: ${routeInputs.distance}km
      Traffic Condition: ${routeInputs.traffic}
      
      Compare two routes considering fuel costs, toll fees, and potential delay risks:
      1. Fastest Route (prioritize minimal time, even if fuel cost is higher)
      2. Lowest Cost Route (prioritize minimal fuel/distance/tolls, even if it takes longer)
      
      Return a JSON with:
      {
        "fastestRoute": { "time": "Xh Ym", "distance": "Xkm", "traffic": "status", "fuel": "₹Amount" },
        "cheapestRoute": { "time": "Xh Ym", "distance": "Xkm", "traffic": "status", "fuel": "₹Amount" },
        "recommended": "Fastest" | "Cheapest",
        "reason": "Why this route is recommended (mention fuel vs time trade-offs)",
        "alternativeSuggestion": "One line advice on an alternative (e.g. specialized cold storage route)",
        "delayRisk": "Low" | "Medium" | "High"
      }`;

      const aiResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: systemPrompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              fastestRoute: { 
                type: Type.OBJECT,
                properties: {
                  time: { type: Type.STRING },
                  distance: { type: Type.STRING },
                  traffic: { type: Type.STRING },
                  fuel: { type: Type.STRING }
                }
              },
              cheapestRoute: { 
                type: Type.OBJECT,
                properties: {
                  time: { type: Type.STRING },
                  distance: { type: Type.STRING },
                  traffic: { type: Type.STRING },
                  fuel: { type: Type.STRING }
                }
              },
              recommended: { type: Type.STRING, enum: ["Fastest", "Cheapest"] },
              reason: { type: Type.STRING },
              alternativeSuggestion: { type: Type.STRING },
              delayRisk: { type: Type.STRING, enum: ["Low", "Medium", "High"] }
            }
          }
        }
      });

      const result = JSON.parse(aiResponse.text || '{}');
      setRouteOptimization({
        fastestRoute: result.fastestRoute,
        cheapestRoute: result.cheapestRoute,
        recommended: result.recommended as 'Fastest' | 'Cheapest',
        reason: result.reason,
        alternativeSuggestion: result.alternativeSuggestion,
        delayRisk: result.delayRisk as 'Low' | 'Medium' | 'High'
      });
    } catch (error) {
      console.error("Route optimization failed:", error);
    } finally {
      setIsOptimizingRoute(false);
    }
  };

  const handleMatchSupplyDemand = async () => {
    setIsMatching(true);
    try {
      const systemPrompt = `You are an AI-powered agriculture supply-demand matching assistant.
      Connect farmers directly with buyers.
      
      Farmer Supply:
      Product: ${supplyDemandInputs.farmerProduct}
      Quantity: ${supplyDemandInputs.farmerQuantity}kg
      Location: ${supplyDemandInputs.farmerLocation}
      
      Buyer Demand (Market):
      Product: ${supplyDemandInputs.buyerProduct}
      Quantity: ${supplyDemandInputs.buyerQuantity}kg
      Location: ${supplyDemandInputs.buyerLocation}
      Proposed Price: ₹${supplyDemandInputs.buyerPrice}/kg
      
      Match them and return a JSON with:
      {
        "bestMatch": "Market/Buyer Name and summary",
        "matchScore": "XX%",
        "suggestedBuyers": ["Buyer 1", "Buyer 2"],
        "distance": "X km",
        "price": "₹XX/kg",
        "reason": "Explain why this is a good match based on price, distance and volume"
      }`;

      const aiResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: systemPrompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              bestMatch: { type: Type.STRING },
              matchScore: { type: Type.STRING },
              suggestedBuyers: { type: Type.ARRAY, items: { type: Type.STRING } },
              distance: { type: Type.STRING },
              price: { type: Type.STRING },
              reason: { type: Type.STRING }
            }
          }
        }
      });

      const result = JSON.parse(aiResponse.text || '{}');
      setSupplyDemandMatches(result);
    } catch (error) {
      console.error("Matching failed:", error);
    } finally {
      setIsMatching(false);
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
              <button 
                onClick={() => navigateTo('inventory')}
                className="bg-green-50 px-4 py-2 rounded-xl text-green-700 border border-green-100 hover:bg-green-600 hover:text-white transition-all shadow-sm font-bold flex items-center gap-2"
              >
                <span className="text-lg">📦</span>
                INVENTORY
              </button>
              <button 
                onClick={() => navigateTo('tracking')}
                className="bg-blue-50 px-4 py-2 rounded-xl text-blue-700 border border-blue-100 hover:bg-blue-600 hover:text-white transition-all shadow-sm font-bold flex items-center gap-2"
              >
                <span className="text-lg">🚚</span>
                TRACK BATCH
              </button>
              <button 
                onClick={() => navigateTo('load_optimization')}
                className="bg-amber-50 px-4 py-2 rounded-xl text-amber-700 border border-amber-100 hover:bg-amber-600 hover:text-white transition-all shadow-sm font-bold flex items-center gap-2"
              >
                <span className="text-lg">🧩</span>
                OPTIMIZE LOAD
              </button>
              <button 
                onClick={() => navigateTo('logistics')}
                className="bg-indigo-50 px-4 py-2 rounded-xl text-indigo-700 border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all shadow-sm font-bold flex items-center gap-2"
              >
                <span className="text-lg">🤝</span>
                FIND TRANSPORT
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
                    <Button 
                      variant="primary" 
                      onClick={() => navigateTo('realtime_dashboard')}
                      className="w-auto px-6 py-3 text-sm font-black tracking-widest bg-brand-dark hover:bg-brand-primary"
                    >
                      <LayoutDashboard size={18} /> REAL-TIME DASHBOARD
                    </Button>
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

                    <Card className="flex-1 flex items-center gap-6 bg-brand-highlight border-brand-highlight-border cursor-pointer hover:bg-brand-highlight/80 transition-all group" onClick={() => navigateTo('inventory')}>
                       <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center shadow-sm text-4xl group-hover:scale-110 transition-transform">📦</div>
                       <div>
                         <h3 className="text-xl font-bold text-brand-dark">Inventory System</h3>
                         <p className="text-sm text-brand-primary font-bold uppercase tracking-widest mt-1">
                           {inventory.filter(i => i.remainingStock <= i.threshold).length > 0 
                             ? `${inventory.filter(i => i.remainingStock <= i.threshold).length} LOW STOCK ALERTS`
                             : 'STOCK LEVELS HEALTHY'}
                         </p>
                       </div>
                    </Card>

                    <Card className="flex-1 flex items-center gap-6 bg-blue-50 border-blue-100 cursor-pointer hover:bg-blue-100 transition-all group" onClick={() => navigateTo('tracking')}>
                       <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center shadow-sm text-4xl group-hover:scale-110 transition-transform">🚚</div>
                       <div>
                         <h3 className="text-xl font-bold text-blue-900 tracking-tight">Traceability</h3>
                         <p className="text-sm text-blue-600 font-bold uppercase tracking-widest mt-1">
                           Live Batch Tracking
                         </p>
                       </div>
                    </Card>

                    <Card className="flex-1 flex items-center gap-6 bg-amber-50 border-amber-100 cursor-pointer hover:bg-amber-100 transition-all group" onClick={() => navigateTo('load_optimization')}>
                       <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center shadow-sm text-4xl group-hover:scale-110 transition-transform">🧩</div>
                       <div>
                         <h3 className="text-xl font-bold text-amber-900 tracking-tight">Load Optimizer</h3>
                         <p className="text-sm text-amber-600 font-bold uppercase tracking-widest mt-1">
                           Reduce Trip Costs
                         </p>
                       </div>
                    </Card>

                    <Card className="flex-1 flex items-center gap-6 bg-indigo-50 border-indigo-100 cursor-pointer hover:bg-indigo-100 transition-all group" onClick={() => navigateTo('logistics')}>
                       <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center shadow-sm text-4xl group-hover:scale-110 transition-transform">🤝</div>
                       <div>
                         <h3 className="text-xl font-bold text-indigo-900 tracking-tight">Partner Match</h3>
                         <p className="text-sm text-indigo-600 font-bold uppercase tracking-widest mt-1">
                           Find Transport
                         </p>
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

        {/* TRACKING SCREEN */}
        {currentScreen === 'tracking' && (
          <ScreenWrapper>
            <div className="max-w-6xl mx-auto py-10 space-y-12">
              <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                  <button onClick={() => navigateTo('dashboard')} className="mb-6 group flex items-center gap-2 font-black text-brand-primary tracking-[0.2em] text-xs transition-transform hover:-translate-x-1">
                    <ChevronLeft size={20} /> RETURN TO DASHBOARD
                  </button>
                  <h1 className="text-6xl font-black text-brand-dark tracking-tighter leading-[0.9]">Supply Chain <br/><span className="text-blue-600">Traceability</span></h1>
                  <p className="text-xl text-brand-muted font-medium mt-4">Follow your produce from farm harvest to consumer delivery.</p>
                </div>
              </header>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Active Batches List */}
                <div className="lg:col-span-1 space-y-6">
                  <h3 className="text-xs font-black uppercase text-brand-muted tracking-[0.2em] mb-4">Active Batches</h3>
                  {tracking.map(track => (
                    <Card 
                      key={track.id} 
                      onClick={() => setActiveTrackingId(track.id)}
                      className={`p-6 cursor-pointer border-2 transition-all ${activeTrackingId === track.id || (!activeTrackingId && track.id === 'tr-1') ? 'border-blue-500 bg-blue-50/30 shadow-lg' : 'border-brand-border hover:border-blue-200'}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-2xl shadow-sm">
                          {track.productName.includes('Tomato') ? '🍅' : '🧅'}
                        </div>
                        <div className="flex-1">
                          <h4 className="text-lg font-black text-brand-dark tracking-tight">{track.productName}</h4>
                          <p className="text-[10px] text-brand-muted font-bold uppercase tracking-widest">{track.batchId}</p>
                        </div>
                        <ArrowRight size={20} className="text-blue-500" />
                      </div>
                    </Card>
                  ))}
                </div>

                {/* Timeline Detail */}
                <div className="lg:col-span-2">
                  {tracking.filter(t => t.id === (activeTrackingId || 'tr-1')).map(track => (
                    <motion.div 
                      key={track.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="space-y-8"
                    >
                      <Card className="p-8 border-none bg-brand-dark text-white relative overflow-hidden shadow-2xl">
                        <div className="absolute top-0 right-0 p-8 opacity-10">
                          <Truck size={120} />
                        </div>
                        <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-6">
                          <div className="space-y-1">
                            <p className="text-[10px] font-black uppercase tracking-widest text-brand-highlight/60">Product</p>
                            <p className="text-xl font-black">{track.productName}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] font-black uppercase tracking-widest text-brand-highlight/60">Batch ID</p>
                            <p className="text-xl font-black">{track.batchId}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] font-black uppercase tracking-widest text-brand-highlight/60">Current Status</p>
                            <p className="text-xl font-black text-blue-400">{track.currentLocation}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] font-black uppercase tracking-widest text-brand-highlight/60">EST. Delivery</p>
                            <p className="text-xl font-black">{new Date(track.estimatedDelivery).toLocaleDateString()}</p>
                          </div>
                        </div>
                      </Card>

                      {/* Timeline UI */}
                      <div className="relative pl-8 space-y-12 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-1 before:bg-brand-border/40 before:rounded-full">
                        {track.stages.map((stage, idx) => {
                          const isCompleted = stage.status === 'Completed';
                          const isInProgress = stage.status === 'In Progress';
                          const isPending = stage.status === 'Pending';

                          return (
                            <div key={stage.id} className="relative">
                              {/* Connector Point */}
                              <div className={`absolute -left-[31px] w-5 h-5 rounded-full border-4 border-white shadow-[0_0_0_4px_rgba(255,255,255,0.5)] z-10 transition-colors ${
                                isCompleted ? 'bg-green-500' : isInProgress ? 'bg-blue-500 animate-pulse' : 'bg-slate-300'
                              }`} />
                              
                              <Card className={`p-8 border-2 transition-all ${isInProgress ? 'border-blue-500 bg-blue-50/20' : 'border-brand-border'}`}>
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                  <div className="flex items-center gap-6">
                                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-xl ${
                                      isCompleted ? 'bg-green-500' : isInProgress ? 'bg-blue-500' : 'bg-slate-300'
                                    }`}>
                                      {stage.name === 'Farm' ? <Sprout size={28} /> : stage.name === 'Transport' ? <Truck size={28} /> : <Store size={28} />}
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-3">
                                        <h4 className="text-2xl font-black text-brand-dark tracking-tighter">{stage.name}</h4>
                                        <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-[0.2em] border ${
                                          isCompleted ? 'bg-green-50 text-green-700 border-green-200' :
                                          isInProgress ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                          'bg-slate-50 text-slate-700 border-slate-200'
                                        }`}>
                                          {stage.status}
                                        </span>
                                      </div>
                                      <p className="text-brand-muted font-bold text-sm mt-1">{stage.description}</p>
                                    </div>
                                  </div>

                                  <div className="md:text-right border-t md:border-t-0 md:border-l border-brand-border/40 pt-4 md:pt-0 md:pl-8">
                                    <div className="flex items-center md:justify-end gap-2 text-brand-dark font-black text-xs uppercase tracking-widest mb-1">
                                      <MapPin size={14} className="text-brand-primary" /> {stage.location}
                                    </div>
                                    {stage.timestamp && (
                                       <div className="flex items-center md:justify-end gap-2 text-brand-muted font-bold text-[10px]">
                                         <Clock size={12} /> {new Date(stage.timestamp).toLocaleString()}
                                       </div>
                                    )}
                                  </div>
                                </div>
                              </Card>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </ScreenWrapper>
        )}

        {/* LOAD OPTIMIZATION SCREEN */}
        {currentScreen === 'load_optimization' && (
          <ScreenWrapper>
            <div className="max-w-6xl mx-auto py-10 space-y-10">
              <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                  <button onClick={() => navigateTo('dashboard')} className="mb-6 group flex items-center gap-2 font-black text-brand-primary tracking-[0.2em] text-xs transition-transform hover:-translate-x-1">
                    <ChevronLeft size={20} /> RETURN TO DASHBOARD
                  </button>
                  <h1 className="text-6xl font-black text-brand-dark tracking-tighter leading-[0.9]">Load <br/><span className="text-amber-500">Optimization</span></h1>
                  <p className="text-xl text-brand-muted font-medium mt-4">AI-driven logistics to minimize waste and maximize transport efficiency.</p>
                </div>
              </header>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                {/* Configuration Panel */}
                <div className="lg:col-span-1 space-y-8">
                  <div className="space-y-4">
                    <h3 className="text-xs font-black uppercase text-brand-muted tracking-[0.2em]">Select Vehicle</h3>
                    <div className="grid grid-cols-1 gap-3">
                      {trucks.map(truck => (
                        <button 
                          key={truck.id}
                          onClick={() => setSelectedTruckId(truck.id)}
                          className={`p-5 rounded-2xl border-2 flex items-center justify-between transition-all ${selectedTruckId === truck.id ? 'border-amber-500 bg-amber-50 shadow-md transform -translate-y-1' : 'border-brand-border bg-white hover:border-amber-200'}`}
                        >
                          <div className="flex items-center gap-4">
                            <span className="text-3xl">{truck.icon}</span>
                            <div className="text-left">
                              <p className="text-lg font-black text-brand-dark tracking-tight">{truck.type}</p>
                              <p className="text-[10px] text-brand-muted font-black uppercase tracking-widest">Max capacity: {truck.capacity}kg</p>
                            </div>
                          </div>
                          {selectedTruckId === truck.id && <CheckCircle2 className="text-amber-500" size={24} />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-xs font-black uppercase text-brand-muted tracking-[0.2em]">Add Products to Load</h3>
                    <div className="flex flex-wrap gap-2">
                      {inventory.filter(inv => !loadItems.find(li => li.name === inv.name)).map(item => (
                        <button 
                          key={item.id}
                          onClick={() => setLoadItems(prev => [...prev, { id: Math.random().toString(36).substr(2, 9), name: item.name, quantity: 100 }])}
                          className="px-3 py-2 bg-white border border-brand-border rounded-xl text-xs font-bold hover:border-brand-primary hover:text-brand-primary transition-all flex items-center gap-2"
                        >
                          <Plus size={14} /> {item.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-xs font-black uppercase text-brand-muted tracking-[0.2em]">Loaded items</h3>
                    <div className="bg-white border-2 border-brand-border rounded-[32px] p-6 space-y-4">
                      {loadItems.length === 0 && (
                        <p className="text-center py-4 text-brand-muted text-xs font-bold italic">No items added yet.</p>
                      )}
                      {loadItems.map((item, idx) => (
                        <div key={item.id} className="flex items-center justify-between p-4 bg-brand-surface rounded-2xl">
                          <div className="flex-1">
                            <p className="font-black text-brand-dark tracking-tight">{item.name}</p>
                            <p className="text-[10px] text-brand-muted font-black uppercase tracking-widest leading-none mt-1">{item.quantity}kg</p>
                          </div>
                          <div className="flex items-center gap-3">
                             <div className="flex items-center gap-1">
                               <button 
                                 onClick={() => setLoadItems(prev => prev.map(i => i.id === item.id ? {...i, quantity: Math.max(0, i.quantity - 50)} : i))}
                                 className="w-10 h-10 rounded-xl bg-white border border-brand-border shadow-sm flex items-center justify-center text-brand-dark font-black hover:bg-brand-highlight"
                               >
                                 <TrendingDown size={14} />
                               </button>
                               <button 
                                 onClick={() => setLoadItems(prev => prev.map(i => i.id === item.id ? {...i, quantity: i.quantity + 50} : i))}
                                 className="w-10 h-10 rounded-xl bg-white border border-brand-border shadow-sm flex items-center justify-center text-brand-dark font-black hover:bg-brand-highlight"
                               >
                                 <TrendingUp size={14} />
                               </button>
                             </div>
                             <button 
                               onClick={() => setLoadItems(prev => prev.filter(i => i.id !== item.id))}
                               className="w-10 h-10 rounded-xl bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shadow-sm"
                             >
                               <Trash2 size={16} />
                             </button>
                          </div>
                        </div>
                      ))}
                      <Button onClick={handleOptimizeLoad} disabled={isOptimizing || loadItems.length === 0} className="w-full py-4 text-sm font-black tracking-widest bg-brand-dark hover:bg-amber-500 flex items-center justify-center gap-2">
                        {isOptimizing ? <Loader2 size={18} className="animate-spin" /> : <Calculator size={18} />}
                        {isOptimizing ? 'CALCULATING...' : 'OPTIMIZE LOAD'}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Analysis Display */}
                <div className="lg:col-span-2 space-y-8">
                  {!optimizationResult && !isOptimizing && (
                    <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-brand-surface border-2 border-dashed border-brand-border rounded-[48px] text-center p-12">
                      <div className="w-24 h-24 bg-white rounded-3xl flex items-center justify-center shadow-xl mb-6 text-5xl">📐</div>
                      <h3 className="text-3xl font-black text-brand-dark tracking-tighter">Ready for Optimization</h3>
                      <p className="text-lg text-brand-muted font-medium mt-2 max-w-sm">Configure your vehicle and inventory on the left to generate an optimal loading plan.</p>
                    </div>
                  )}

                  {isOptimizing && (
                    <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-white border-2 border-brand-border rounded-[48px] text-center p-12 overflow-hidden relative">
                      <div className="absolute inset-0 bg-brand-highlight/20 animate-pulse" />
                      <div className="relative z-10 flex flex-col items-center">
                        <Loader2 size={64} className="text-amber-500 animate-spin mb-6" />
                        <h3 className="text-3xl font-black text-brand-dark tracking-tighter">Analyzing Capacity...</h3>
                        <p className="text-lg text-brand-muted font-medium mt-2">Computing most efficient space distribution.</p>
                      </div>
                    </div>
                  )}

                  {optimizationResult && (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-8"
                    >
                      {/* Visual Progress Header */}
                      <Card className="p-10 border-none bg-brand-dark text-white shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-10 opacity-5">
                          <PackageCheck size={180} />
                        </div>
                        <div className="relative z-10 space-y-6">
                           <div className="flex justify-between items-end">
                             <div>
                               <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-500/80 mb-2">Efficiency Score: Optimized</p>
                               <h2 className="text-5xl font-black tracking-tighter">Capacity Used: {optimizationResult.usedCapacityPercent}%</h2>
                             </div>
                             <div className="text-right">
                               <p className="text-xs font-black uppercase tracking-[0.2em] text-white/50 mb-2">Remaining Space</p>
                               <p className="text-3xl font-black">{100 - optimizationResult.usedCapacityPercent}%</p>
                             </div>
                           </div>
                           <div className="h-4 bg-white/10 rounded-full overflow-hidden border border-white/5 shadow-inner">
                             <motion.div 
                               initial={{ width: 0 }}
                               animate={{ width: `${optimizationResult.usedCapacityPercent}%` }}
                               className={`h-full shadow-[0_0_20px_rgba(245,158,11,0.5)] ${optimizationResult.usedCapacityPercent > 100 ? 'bg-red-500' : 'bg-amber-500'}`}
                             />
                           </div>
                           <div className="flex items-center gap-6 pt-4 border-t border-white/10">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center">
                                  <Truck size={20} className="text-amber-500" />
                                </div>
                                <div>
                                  <p className="text-[10px] font-black uppercase text-white/40 tracking-widest">Trips Needed</p>
                                  <p className="text-lg font-black">{optimizationResult.numberOfTrips}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center">
                                  <TrendingDown size={20} className="text-green-400" />
                                </div>
                                <div>
                                  <p className="text-[10px] font-black uppercase text-white/40 tracking-widest">Cost Efficiency</p>
                                  <p className="text-lg font-black text-green-400">{optimizationResult.costEfficiency}</p>
                                </div>
                              </div>
                           </div>
                        </div>
                      </Card>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                         <Card className="p-8 space-y-6">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-amber-500 text-white rounded-2xl flex items-center justify-center shadow-lg">
                                <PackageCheck size={24} />
                              </div>
                              <h3 className="text-2xl font-black text-brand-dark tracking-tight">Optimal Load Plan</h3>
                            </div>
                            <div className="p-6 bg-brand-surface rounded-3xl border border-brand-border text-brand-dark font-bold leading-relaxed">
                               {optimizationResult.loadPlan}
                            </div>
                         </Card>

                         <Card className="p-8 space-y-6 border-brand-primary/20">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-brand-primary text-white rounded-2xl flex items-center justify-center shadow-lg">
                                <Sparkles size={24} />
                              </div>
                              <h3 className="text-2xl font-black text-brand-dark tracking-tight">AI Suggestion</h3>
                            </div>
                            <div className="p-6 bg-brand-highlight border border-brand-highlight-border rounded-3xl text-brand-primary font-bold leading-relaxed">
                               {optimizationResult.additionalSuggestion}
                               <p className="text-[10px] font-black uppercase tracking-widest mt-4 opacity-70">
                                 Remaining Space: {optimizationResult.remainingSpace}
                               </p>
                            </div>
                         </Card>
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>
            </div>
          </ScreenWrapper>
        )}

        {/* LOGISTICS MATCHING SCREEN */}
        {currentScreen === 'logistics' && (
          <ScreenWrapper>
            <div className="max-w-6xl mx-auto py-10 space-y-10">
              <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                  <button onClick={() => navigateTo('dashboard')} className="mb-6 group flex items-center gap-2 font-black text-brand-primary tracking-[0.2em] text-xs transition-transform hover:-translate-x-1">
                    <ChevronLeft size={20} /> RETURN TO DASHBOARD
                  </button>
                  <h1 className="text-6xl font-black text-brand-dark tracking-tighter leading-[0.9]">Partner <br/><span className="text-indigo-600">Matching</span></h1>
                  <p className="text-xl text-brand-muted font-medium mt-4">Smart discovery of nearby transport providers for your produce.</p>
                </div>
              </header>

              {/* Best Match Suggestion */}
              <Card className="p-8 border-none bg-indigo-600 text-white shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                  <Truck size={140} />
                </div>
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
                  <div className="space-y-4 max-w-xl">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full text-[10px] font-black uppercase tracking-widest">
                      <Sparkles size={14} /> AI Recommendation
                    </div>
                    <h2 className="text-4xl font-black tracking-tight leading-tight">Best option: {providers[0].name}</h2>
                    <p className="text-lg opacity-80 font-medium">Closest to your location with the most competitive rates for Medium Trucks this week.</p>
                  </div>
                  <Button className="bg-white text-indigo-600 hover:bg-brand-highlight px-10 py-4 text-sm font-black tracking-widest whitespace-nowrap">
                    BOOK INSTANTLY
                  </Button>
                </div>
              </Card>

              {/* Provider List */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase text-brand-muted tracking-[0.2em]">Nearby Providers</h3>
                  <div className="flex items-center gap-4 text-xs font-black text-indigo-600">
                    <button className="hover:underline">Sort by Cost</button>
                    <span className="text-brand-border">|</span>
                    <button className="hover:underline opacity-50">Sort by Distance</button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {providers.map(provider => (
                    <Card key={provider.id} className="p-8 border-2 border-brand-border hover:border-indigo-200 hover:shadow-xl transition-all group">
                      <div className="flex flex-col gap-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-16 h-16 bg-brand-surface rounded-2xl flex items-center justify-center text-4xl shadow-inner group-hover:scale-110 transition-transform">
                              {provider.icon}
                            </div>
                            <div>
                              <h4 className="text-2xl font-black text-brand-dark tracking-tighter">{provider.name}</h4>
                              <div className="flex items-center gap-2 mt-1">
                                <div className="flex text-amber-500">
                                  <Star size={14} fill="currentColor" />
                                </div>
                                <span className="text-xs font-black text-brand-dark">{provider.rating}</span>
                                <span className="text-brand-muted font-bold text-[10px]">• 124 Trips</span>
                              </div>
                            </div>
                          </div>
                          <div className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${
                            provider.availability === 'Available' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
                          }`}>
                            {provider.availability}
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 py-6 border-y border-brand-border/40">
                          <div className="space-y-1">
                            <p className="text-[10px] font-black uppercase tracking-widest text-brand-muted">Vehicle</p>
                            <p className="text-sm font-black text-brand-dark">{provider.vehicleType}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] font-black uppercase tracking-widest text-brand-muted">Capacity</p>
                            <p className="text-sm font-black text-brand-dark">{provider.capacity}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] font-black uppercase tracking-widest text-brand-muted">Distance</p>
                            <p className="text-sm font-black text-brand-dark">{provider.distance}</p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-brand-muted">Est. Cost</p>
                            <p className="text-2xl font-black text-indigo-600">₹{provider.estimatedCost}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button className="p-4 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-colors">
                              <Phone size={20} />
                            </button>
                            <button className="px-8 p-4 rounded-xl bg-brand-dark text-white font-black text-sm tracking-widest hover:bg-indigo-600 transition-colors shadow-lg">
                              BOOK NOW
                            </button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          </ScreenWrapper>
        )}

        {/* INVENTORY SCREEN */}
        {currentScreen === 'inventory' && (
          <ScreenWrapper>
            <div className="max-w-6xl mx-auto py-10 space-y-12">
              <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                  <button onClick={() => navigateTo('dashboard')} className="mb-6 group flex items-center gap-2 font-black text-brand-primary tracking-[0.2em] text-xs transition-transform hover:-translate-x-1">
                    <ChevronLeft size={20} /> RETURN TO DASHBOARD
                  </button>
                  <h1 className="text-6xl font-black text-brand-dark tracking-tighter leading-[0.9]">Stock <br/><span className="text-brand-primary">Management</span></h1>
                  <p className="text-xl text-brand-muted font-medium mt-4">Real-time visibility into your regional supply chain inventory.</p>
                </div>
                <Button 
                  onClick={() => {
                    setEditingInventoryId(null);
                    setInventoryForm({ name: '', availableStock: '', soldStock: '0', threshold: '', unit: 'kg' });
                    setIsInventoryModalOpen(true);
                  }}
                  className="w-fit px-8 py-5 text-lg font-black bg-brand-dark hover:bg-brand-primary"
                >
                  <Plus size={24} /> ADD NEW PRODUCT
                </Button>
              </header>

              {/* Inventory Alerts */}
              {inventory.filter(i => i.remainingStock <= i.threshold).length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-red-50 border-2 border-red-100 p-6 rounded-[32px] flex items-center gap-6"
                >
                  <div className="w-16 h-16 bg-red-500 text-white rounded-2xl flex items-center justify-center shadow-lg animate-pulse">
                    <AlertTriangle size={28} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-red-900 tracking-tight">Critical Stock Warnings</h3>
                    <p className="text-red-700 font-bold">
                      {inventory.filter(i => i.remainingStock <= i.threshold).map(i => i.name).join(', ')} require immediate restocking.
                    </p>
                  </div>
                </motion.div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {inventory.map(item => {
                  const usagePercent = Math.min(100, (item.soldStock / item.availableStock) * 100);
                  const isLow = item.remainingStock <= item.threshold;
                  const status = isLow ? 'Low' : item.remainingStock < item.threshold * 2 ? 'Medium' : 'High';
                  const statusColor = isLow ? 'bg-red-500' : status === 'Medium' ? 'bg-amber-500' : 'bg-brand-primary';

                  return (
                    <Card key={item.id} className={`p-8 bg-white border-2 transition-all hover:border-brand-primary group ${isLow ? 'border-red-200 bg-red-50/30' : 'border-brand-border'}`}>
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 ${statusColor} text-white rounded-xl flex items-center justify-center text-xl shadow-lg`}>
                            {item.name.includes('Tomato') ? '🍅' : item.name.includes('Onion') ? '🧅' : item.name.includes('Potato') ? '🥔' : '📦'}
                          </div>
                          <div>
                            <h3 className={`text-2xl font-black tracking-tight ${isLow ? 'text-red-900' : 'text-brand-dark'}`}>{item.name}</h3>
                            <div className="flex items-center gap-2">
                               <p className={`text-[10px] font-black uppercase tracking-widest ${isLow ? 'text-red-600/60' : 'text-brand-muted'}`}>Last updated {new Date(item.updatedAt).toLocaleDateString()}</p>
                               <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter border shadow-sm ${
                                  status === 'Low' ? 'bg-red-500 text-white border-red-600' : 
                                  status === 'Medium' ? 'bg-amber-50 text-amber-600 border-amber-200' : 
                                  'bg-brand-surface text-brand-primary border-brand-primary/20'
                               }`}>
                                 {status} STOCK
                               </span>
                            </div>
                         </div>
                        </div>
                        {isLow && (
                          <div className="w-10 h-10 bg-red-100 text-red-600 rounded-full flex items-center justify-center animate-bounce">
                            <AlertTriangle size={20} />
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 gap-4 mb-8">
                        <div className="bg-brand-surface p-6 rounded-[32px] flex items-center justify-between border-2 border-brand-border/20">
                           <div>
                              <p className="text-[10px] font-black uppercase text-brand-muted tracking-[0.2em] mb-1">Remaining Stock</p>
                              <p className="text-4xl font-black text-brand-dark">{item.remainingStock}<span className="text-sm ml-1 uppercase">{item.unit}</span></p>
                           </div>
                           <div className="h-12 w-0.5 bg-brand-border/40" />
                           <div className="text-right">
                              <p className="text-[10px] font-black uppercase text-brand-muted tracking-[0.2em] mb-1">Total Pool</p>
                              <p className="text-xl font-bold text-brand-muted">{item.availableStock}{item.unit}</p>
                           </div>
                        </div>
                        <div className="bg-brand-surface p-4 rounded-2xl flex justify-between items-center">
                          <p className="text-[10px] font-black uppercase text-brand-muted tracking-[0.2em]">Total Sold</p>
                          <p className="text-lg font-black text-brand-dark">{item.soldStock} {item.unit}</p>
                        </div>
                      </div>

                      <div className="space-y-2 mb-8">
                        <div className="flex justify-between items-end">
                          <p className="text-[10px] font-black uppercase text-brand-muted tracking-[0.2em]">Sales Exhaustion</p>
                          <p className="text-xs font-black text-brand-dark">{Math.round(usagePercent)}%</p>
                        </div>
                        <div className="h-3 bg-brand-surface rounded-full overflow-hidden border border-brand-border/50">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${usagePercent}%` }}
                            className={`h-full ${statusColor} shadow-[0_0_10px_rgba(0,0,0,0.1)]`}
                          />
                        </div>
                        {isLow && (
                          <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mt-2 flex items-center gap-1">
                            ⚠️ Critical: Only {item.remainingStock}{item.unit} left
                          </p>
                        )}
                      </div>

                      <div className="flex gap-3">
                        <button 
                          onClick={() => {
                            setEditingInventoryId(item.id);
                            setInventoryForm({
                              name: item.name,
                              availableStock: item.availableStock.toString(),
                              soldStock: item.soldStock.toString(),
                              threshold: item.threshold.toString(),
                              unit: item.unit
                            });
                            setIsInventoryModalOpen(true);
                          }}
                          className="flex-1 py-3 bg-brand-dark text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-brand-primary transition-colors flex items-center justify-center gap-2"
                        >
                          <Clock size={14} /> UPDATE
                        </button>
                        <button 
                          onClick={() => handleDeleteInventory(item.id)}
                          className="w-12 h-12 border-2 border-brand-border text-brand-muted rounded-xl flex items-center justify-center hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          </ScreenWrapper>
        )}

        {/* REAL-TIME DASHBOARD SCREEN */}
        {currentScreen === 'realtime_dashboard' && (
          <ScreenWrapper>
            <div className="max-w-7xl mx-auto py-10 space-y-10">
              <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                  <button onClick={() => navigateTo('dashboard')} className="mb-6 group flex items-center gap-2 font-black text-brand-primary tracking-[0.2em] text-xs transition-transform hover:-translate-x-1">
                    <ChevronLeft size={20} /> RETURN TO OVERVIEW
                  </button>
                  <h1 className="text-6xl font-black text-brand-dark tracking-tighter leading-[0.9]">Real-Time <br/><span className="text-brand-primary">Dashboard</span></h1>
                  <p className="text-xl text-brand-muted font-medium mt-4">Centralized overview of supply chain activities and demand trends.</p>
                </div>
                <div className="flex gap-4">
                  <Button 
                    onClick={handleAnalyzeSupplyChain} 
                    disabled={isAnalyzing}
                    className="w-auto px-8 py-5 text-sm font-black tracking-widest bg-brand-dark hover:bg-brand-primary flex items-center gap-2"
                  >
                    {isAnalyzing ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                    {isAnalyzing ? 'ANALYZING...' : 'ANALYZE SUPPLY CHAIN'}
                  </Button>
                </div>
              </header>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Demand Heatmap */}
                <Card className="lg:col-span-2 p-8 space-y-8">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-brand-primary text-white rounded-2xl flex items-center justify-center shadow-lg">
                        <MapIcon size={24} />
                      </div>
                      <h3 className="text-2xl font-black text-brand-dark tracking-tight">Demand Heatmap 🌍</h3>
                    </div>
                    <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest">
                       <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500"></span> High</span>
                       <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-500"></span> Medium</span>
                       <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500"></span> Low</span>
                    </div>
                  </div>

                  <div className="h-[400px] bg-brand-surface rounded-[40px] border-2 border-brand-border/40 relative overflow-hidden flex items-center justify-center">
                    {/* Simplified Map Visualization */}
                    <div className="absolute inset-0 opacity-10 bg-[url('https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&q=80&w=1000')] bg-cover"></div>
                    
                    <div className="relative grid grid-cols-3 md:grid-cols-4 gap-4 md:gap-8 p-8 w-full max-w-4xl">
                      {[
                        { name: 'Nashik', demand: 'High', price: 45 },
                        { name: 'Mumbai', demand: 'High', price: 58 },
                        { name: 'Pune', demand: 'Medium', price: 42 },
                        { name: 'Nagpur', demand: 'Low', price: 35 },
                        { name: 'Ahmedabad', demand: 'Medium', price: 48 },
                        { name: 'Surat', demand: 'High', price: 52 },
                        { name: 'Indore', demand: 'Low', price: 30 },
                        { name: 'Jaipur', demand: 'Medium', price: 40 },
                      ].map((city) => (
                        <motion.div 
                          key={city.name}
                          whileHover={{ scale: 1.05 }}
                          className={`p-6 rounded-3xl border-2 shadow-sm cursor-help flex flex-col items-center justify-center gap-2 ${
                            city.demand === 'High' ? 'bg-green-50 border-green-200 text-green-900 shadow-green-100' :
                            city.demand === 'Medium' ? 'bg-yellow-50 border-yellow-200 text-yellow-900 shadow-yellow-100' :
                            'bg-red-50 border-red-200 text-red-900 shadow-red-100'
                          }`}
                        >
                          <MapPin size={24} className="opacity-50" />
                          <h4 className="text-lg font-black tracking-tighter">{city.name}</h4>
                          <div className="text-[10px] font-black uppercase tracking-widest opacity-60">Price Prediction</div>
                          <div className="text-xl font-black">₹{city.price}</div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </Card>

                {/* AI Insights & Alerts */}
                <div className="space-y-8">
                  <Card className="p-8 space-y-6 bg-brand-dark text-white border-none shadow-2xl relative overflow-hidden">
                    <div className="absolute -top-10 -right-10 opacity-5">
                      <Sparkles size={160} />
                    </div>
                    <div className="relative z-10 flex items-center gap-3">
                      <Sparkles size={20} className="text-brand-primary" />
                      <h3 className="text-xs font-black uppercase tracking-[0.3em]">AI Alerts & Insights</h3>
                    </div>
                    <div className="space-y-4 relative z-10">
                      {analyzedInsights ? (
                        <>
                          {analyzedInsights.alerts.map((alert, idx) => (
                            <div key={idx} className="p-4 bg-white/5 rounded-2xl border border-white/10 flex items-start gap-3">
                              <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
                              <p className="text-sm font-bold opacity-90">{alert}</p>
                            </div>
                          ))}
                          <div className="p-6 bg-brand-primary/20 rounded-3xl border border-brand-primary/30 mt-6">
                            <p className="text-[10px] font-black uppercase tracking-widest text-brand-primary mb-2">Recommended Action</p>
                            <p className="text-lg font-black tracking-tight leading-snug">{analyzedInsights.recommendations}</p>
                          </div>
                        </>
                      ) : (
                        <div className="py-12 text-center space-y-4 opacity-50">
                           <History size={48} className="mx-auto" />
                           <p className="text-sm font-bold">Run AI Analysis to see real-time insights.</p>
                        </div>
                      )}
                    </div>
                  </Card>

                  <div className="grid grid-cols-1 gap-4">
                     <Button onClick={() => navigateTo('input')} variant="outline" className="py-5 font-black tracking-widest text-xs border-2 bg-white flex items-center justify-between px-6">
                        PREDICT DEMAND <ArrowRight size={18} />
                     </Button>
                     <Button onClick={() => navigateTo('load_optimization')} variant="outline" className="py-5 font-black tracking-widest text-xs border-2 bg-white flex items-center justify-between px-6">
                        OPTIMIZE ROUTE <ArrowRight size={18} />
                     </Button>
                     <Button onClick={() => navigateTo('tracking')} variant="outline" className="py-5 font-black tracking-widest text-xs border-2 bg-white flex items-center justify-between px-6">
                        TRACK SHIPMENT <ArrowRight size={18} />
                     </Button>
                     <Button onClick={() => navigateTo('delivery_prediction')} variant="outline" className="py-5 font-black tracking-widest text-xs border-2 bg-white flex items-center justify-between px-6">
                        PREDICT DELIVERY TIME <ArrowRight size={18} />
                     </Button>
                     <Button onClick={() => navigateTo('spoilage_prediction')} variant="outline" className="py-5 font-black tracking-widest text-xs border-2 bg-white flex items-center justify-between px-6">
                        SPOILAGE & WASTE PREDICTION <ArrowRight size={18} />
                     </Button>
                     <Button onClick={() => navigateTo('route_optimization')} variant="outline" className="py-5 font-black tracking-widest text-xs border-2 bg-white flex items-center justify-between px-6">
                        SMART ROUTE OPTIMIZATION <ArrowRight size={18} />
                     </Button>
                     <Button onClick={() => navigateTo('supply_demand_matching')} variant="outline" className="py-5 font-black tracking-widest text-xs border-2 bg-white flex items-center justify-between px-6">
                        SUPPLY–DEMAND MATCHING <ArrowRight size={18} />
                     </Button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Supply Levels */}
                <Card className="p-8 space-y-8">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-amber-500 text-white rounded-2xl flex items-center justify-center shadow-lg">
                      <Store size={24} />
                    </div>
                    <h3 className="text-2xl font-black text-brand-dark tracking-tight">Supply Levels 📦</h3>
                  </div>

                  <div className="grid grid-cols-1 gap-6">
                    {inventory.map(item => {
                      const total = item.availableStock;
                      const availabilityPercent = Math.min(100, (item.remainingStock / total) * 100);
                      const isLow = item.remainingStock <= item.threshold;
                      const status = isLow ? 'Low' : item.remainingStock < item.threshold * 2 ? 'Medium' : 'Stable';
                      const statusColor = status === 'Low' ? 'bg-red-500' : status === 'Medium' ? 'bg-amber-500' : 'bg-brand-primary';
                      
                      return (
                        <div key={item.id} className="space-y-3">
                          <div className="flex justify-between items-end">
                            <div>
                              <h4 className="text-lg font-black text-brand-dark">{item.name}</h4>
                              <p className="text-[10px] font-black uppercase text-brand-muted tracking-widest">
                                {item.remainingStock} {item.unit} Available
                              </p>
                            </div>
                            <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                              status === 'Low' ? 'bg-red-50 text-red-700 border-red-200' : 
                              status === 'Medium' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                              'bg-green-50 text-green-700 border-green-200'
                            }`}>
                              {status} {status === 'Stable' ? '' : 'Stock'}
                            </div>
                          </div>
                          <div className="h-4 bg-brand-surface rounded-full overflow-hidden border border-brand-border/40 relative">
                             <motion.div 
                               initial={{ width: 0 }}
                               animate={{ width: `${availabilityPercent}%` }}
                               className={`h-full ${statusColor} shadow-lg`}
                             />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>

                {/* Active Deliveries */}
                <Card className="p-8 space-y-8">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-brand-dark text-white rounded-2xl flex items-center justify-center shadow-lg">
                      <Truck size={24} />
                    </div>
                    <h3 className="text-2xl font-black text-brand-dark tracking-tight">Active Deliveries 🚚</h3>
                  </div>

                  <div className="space-y-4">
                    {tracking.map(track => {
                      const activeStage = track.stages.find(s => s.status === 'In Progress') || track.stages.find(s => s.status === 'Pending');
                      const isDelayed = track.stages.some(s => s.status === 'Pending' && s.name === 'Transport'); // Mock delay logic
                      
                      return (
                        <div key={track.id} className="p-6 bg-brand-surface border border-brand-border rounded-3xl flex items-center justify-between group hover:border-brand-primary transition-all">
                          <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-3xl shadow-sm">
                              {track.productName.includes('Tomato') ? '🍅' : '🧅'}
                            </div>
                            <div>
                               <h4 className="text-xl font-black text-brand-dark tracking-tighter">{track.productName}</h4>
                               <p className="text-xs font-bold text-brand-muted flex items-center gap-1.5 mt-1">
                                 {track.stages[0].location} <ArrowRight size={12} /> {track.stages[track.stages.length-1].location}
                               </p>
                            </div>
                          </div>

                          <div className="text-right flex flex-col items-end gap-2">
                             <div className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${
                               activeStage?.status === 'In Progress' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                               isDelayed ? 'bg-red-50 text-red-700 border-red-200' :
                               'bg-amber-50 text-amber-700 border-amber-200'
                             }`}>
                               {activeStage?.status === 'In Progress' ? 'In Transit' : 'Delayed'}
                             </div>
                             <p className="text-xs font-black text-brand-dark">ETA: {new Date(track.estimatedDelivery).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </div>
            </div>
          </ScreenWrapper>
        )}

        {/* DELIVERY TIME PREDICTION SCREEN */}
        {currentScreen === 'delivery_prediction' && (
          <ScreenWrapper>
            <div className="max-w-4xl mx-auto py-10 space-y-10">
              <header>
                <button onClick={() => navigateTo('realtime_dashboard')} className="mb-6 group flex items-center gap-2 font-black text-brand-primary tracking-[0.2em] text-xs transition-transform hover:-translate-x-1">
                  <ChevronLeft size={20} /> RETURN TO DASHBOARD
                </button>
                <h1 className="text-6xl font-black text-brand-dark tracking-tighter leading-[0.9]">Delivery <br/><span className="text-brand-primary">Prediction</span></h1>
                <p className="text-xl text-brand-muted font-medium mt-4">AI-powered accurate estimation of delivery times and route risks.</p>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Card className="p-8 space-y-6">
                  <h3 className="text-2xl font-black text-brand-dark tracking-tight">Trip Details</h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-muted">Source Location</label>
                       <div className="relative">
                         <MapPin size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-primary" />
                         <input 
                           value={deliveryInputs.source}
                           onChange={e => setDeliveryInputs({...deliveryInputs, source: e.target.value})}
                           className="w-full pl-12 pr-4 py-4 bg-brand-surface rounded-2xl border-2 border-brand-border/40 font-bold focus:border-brand-primary outline-none transition-all"
                         />
                       </div>
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-muted">Destination Location</label>
                       <div className="relative">
                         <MapPin size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-primary" />
                         <input 
                           value={deliveryInputs.destination}
                           onChange={e => setDeliveryInputs({...deliveryInputs, destination: e.target.value})}
                           className="w-full pl-12 pr-4 py-4 bg-brand-surface rounded-2xl border-2 border-brand-border/40 font-bold focus:border-brand-primary outline-none transition-all"
                         />
                       </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                         <label className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-muted">Distance (km)</label>
                         <input 
                           type="number"
                           value={deliveryInputs.distance}
                           onChange={e => setDeliveryInputs({...deliveryInputs, distance: e.target.value})}
                           className="w-full px-4 py-4 bg-brand-surface rounded-2xl border-2 border-brand-border/40 font-bold focus:border-brand-primary outline-none transition-all"
                         />
                      </div>
                      <div className="space-y-2">
                         <label className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-muted">Traffic</label>
                         <select 
                           value={deliveryInputs.traffic}
                           onChange={e => setDeliveryInputs({...deliveryInputs, traffic: e.target.value})}
                           className="w-full px-4 py-4 bg-brand-surface rounded-2xl border-2 border-brand-border/40 font-bold focus:border-brand-primary outline-none transition-all appearance-none"
                         >
                           <option>Light</option>
                           <option>Moderate</option>
                           <option>Heavy</option>
                         </select>
                      </div>
                    </div>
                    <Button 
                      onClick={handleCheckDeliveryTime}
                      disabled={isPredictingTime}
                      className="mt-4 py-5 font-black tracking-widest bg-brand-dark hover:bg-brand-primary"
                    >
                      {isPredictingTime ? <Loader2 size={24} className="animate-spin" /> : 'CHECK DELIVERY TIME'}
                    </Button>
                  </div>
                </Card>

                <div className="space-y-8">
                  {deliveryPrediction ? (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-6"
                    >
                      {isMonitoringTraffic && !showTrafficAlert && (
                        <div className="flex items-center gap-2 mb-2 px-4 py-2 bg-green-50 text-green-700 rounded-xl border border-green-100 italic text-[10px] font-bold">
                          <Loader2 size={12} className="animate-spin" />
                          Monitoring real-time traffic updates...
                        </div>
                      )}

                      {showTrafficAlert && (
                        <motion.div 
                          initial={{ x: 100, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          className="bg-red-500 text-white p-4 rounded-2xl flex items-center justify-between gap-4 shadow-xl mb-4"
                        >
                          <div className="flex items-center gap-3">
                            <div className="bg-white/20 p-2 rounded-xl">
                              <AlertCircle size={20} className="animate-pulse" />
                            </div>
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Traffic Alert detected!</p>
                              <p className="text-xs font-bold leading-tight">Worsening conditions detected. Updated ETA required.</p>
                            </div>
                          </div>
                          <button 
                            onClick={handleUpdateETA}
                            className="bg-white text-red-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black hover:text-white transition-all whitespace-nowrap"
                          >
                            Recalculate
                          </button>
                        </motion.div>
                      )}

                      <Card className="p-8 space-y-6 border-brand-primary/40 shadow-xl overflow-hidden relative">
                        <div className="absolute top-0 right-0 p-6">
                           <div className={`px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-widest border-2 ${
                             deliveryPrediction.delayRisk === 'Low' ? 'bg-green-50 border-green-200 text-green-700' :
                             deliveryPrediction.delayRisk === 'Medium' ? 'bg-yellow-50 border-yellow-200 text-yellow-700' :
                             'bg-red-50 border-red-200 text-red-700'
                           }`}>
                             {deliveryPrediction.delayRisk} Risk
                           </div>
                        </div>
                        
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-16 bg-brand-primary/10 text-brand-primary rounded-3xl flex items-center justify-center">
                            <Clock size={32} />
                          </div>
                          <div>
                             <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-muted">Estimated Time</p>
                             <h2 className="text-4xl font-black text-brand-dark tracking-tighter">{deliveryPrediction.estimatedTime}</h2>
                          </div>
                        </div>

                        <div className="space-y-6 pt-6 border-t border-brand-border/40">
                           <div className="flex justify-between items-center bg-brand-surface p-6 rounded-3xl">
                              <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-muted">Arrival Time (ETA)</p>
                                <p className="text-3xl font-black text-brand-dark">{deliveryPrediction.eta}</p>
                              </div>
                              <Truck size={40} className="opacity-20 text-brand-primary" />
                           </div>

                           <div className="space-y-3">
                              <div className="flex items-center gap-2 px-4 py-3 bg-blue-50 border border-blue-100 rounded-2xl text-blue-800">
                                <Sparkles size={16} />
                                <span className="text-sm font-bold">{deliveryPrediction.alternativeRoute}</span>
                              </div>
                              <div className="flex items-start gap-2 px-4 py-3 bg-brand-surface rounded-2xl text-brand-muted">
                                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                                <span className="text-xs font-bold leading-relaxed">{deliveryPrediction.reason}</span>
                              </div>
                           </div>
                        </div>

                        <div className="pt-6 flex gap-4">
                          <Button onClick={() => navigateTo('route_optimization')} variant="outline" className="text-xs py-4 font-black bg-white flex items-center justify-center gap-2">
                             <Navigation size={14} /> SMART ROUTE OPTIMIZATION
                          </Button>
                        </div>
                      </Card>

                      <Card className="p-8 bg-brand-dark/95 text-white border-none shadow-2xl relative overflow-hidden h-[200px] mb-4">
                        <div className="relative z-10 flex flex-col justify-between h-full">
                           <div className="flex items-center gap-3">
                             <div className="w-2.5 h-2.5 rounded-full bg-brand-primary animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.8)]" />
                             <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-brand-primary/80">Live Route Telematics</h4>
                           </div>
                           <div className="space-y-6">
                             <div className="flex items-center gap-4 text-xs font-black uppercase tracking-widest">
                                <span className="opacity-60">{deliveryInputs.source}</span>
                                <div className="h-0.5 flex-1 bg-white/10 relative">
                                   <motion.div 
                                     animate={{ left: ['0%', '100%'] }}
                                     transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                                     className="absolute top-1/2 -translate-y-1/2 -ml-3"
                                   >
                                      <Truck size={20} className="text-brand-primary drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                                   </motion.div>
                                </div>
                                <span className="text-brand-primary">{deliveryInputs.destination}</span>
                             </div>
                             <div className="flex items-center justify-between text-[10px] font-bold opacity-60 italic">
                                <span>Departure: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                <span>Dist: {deliveryInputs.distance} km</span>
                             </div>
                           </div>
                        </div>
                      </Card>

                      <Card className="p-6 bg-brand-surface border-2 border-brand-border/40">
                         <div className="flex items-center gap-3 mb-3">
                            <div className="w-8 h-8 bg-brand-primary/10 text-brand-primary rounded-xl flex items-center justify-center">
                               <Sparkles size={16} />
                            </div>
                            <h4 className="text-sm font-black text-brand-dark uppercase tracking-wider">AI Route Sentiment</h4>
                         </div>
                         <p className="text-xs font-bold text-brand-muted leading-relaxed">
                           "Proprietary AI routing patterns indicate minor slowdowns near arterial junctions. Recommended to maintain constant speed for fuel optimization."
                         </p>
                      </Card>
                    </motion.div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center p-12 text-center space-y-6 opacity-40">
                       <div className="w-32 h-32 bg-brand-surface rounded-full flex items-center justify-center border-4 border-dashed border-brand-border">
                          <Clock size={64} className="text-brand-muted" />
                       </div>
                       <div className="space-y-2">
                         <h3 className="text-2xl font-black text-brand-dark tracking-tight">No Prediction Yet</h3>
                         <p className="text-sm font-bold">Input your route details and check the delivery time.</p>
                       </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </ScreenWrapper>
        )}

        {/* SPOILAGE AND WASTE PREDICTION SCREEN */}
        {currentScreen === 'spoilage_prediction' && (
          <ScreenWrapper>
            <div className="max-w-5xl mx-auto py-10 space-y-10">
              <header>
                <button onClick={() => navigateTo('realtime_dashboard')} className="mb-6 group flex items-center gap-2 font-black text-brand-primary tracking-[0.2em] text-xs transition-transform hover:-translate-x-1">
                  <ChevronLeft size={20} /> RETURN TO DASHBOARD
                </button>
                <h1 className="text-6xl font-black text-brand-dark tracking-tighter leading-[0.9]">Waste <br/><span className="text-brand-primary">Prediction</span></h1>
                <p className="text-xl text-brand-muted font-medium mt-4">Predict perishability risks and minimize post-harvest losses with AI.</p>
              </header>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 space-y-8">
                  <Card className="p-8 space-y-6">
                    <h3 className="text-2xl font-black text-brand-dark tracking-tight">Product Details</h3>
                    <div className="space-y-4">
                      <div className="space-y-2">
                         <label className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-muted">Product</label>
                         <select 
                           value={spoilageInputs.product}
                           onChange={e => setSpoilageInputs({...spoilageInputs, product: e.target.value})}
                           className="w-full px-4 py-4 bg-brand-surface rounded-2xl border-2 border-brand-border/40 font-bold focus:border-brand-primary outline-none transition-all appearance-none"
                         >
                           <option>Tomatoes</option>
                           <option>Onions</option>
                           <option>Potatoes</option>
                           <option>Spinach</option>
                           <option>Apples</option>
                         </select>
                      </div>
                      <div className="space-y-2">
                         <label className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-muted">Quantity (kg)</label>
                         <input 
                           type="number"
                           value={spoilageInputs.quantity}
                           onChange={e => setSpoilageInputs({...spoilageInputs, quantity: e.target.value})}
                           className="w-full px-4 py-4 bg-brand-surface rounded-2xl border-2 border-brand-border/40 font-bold focus:border-brand-primary outline-none transition-all"
                         />
                      </div>
                      <div className="space-y-2">
                         <label className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-muted">Harvest Date</label>
                         <input 
                           type="date"
                           value={spoilageInputs.harvestDate}
                           onChange={e => setSpoilageInputs({...spoilageInputs, harvestDate: e.target.value})}
                           className="w-full px-4 py-4 bg-brand-surface rounded-2xl border-2 border-brand-border/40 font-bold focus:border-brand-primary outline-none transition-all"
                         />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-muted">Temp (°C)</label>
                            <input 
                              type="number"
                              value={spoilageInputs.temperature}
                              onChange={e => setSpoilageInputs({...spoilageInputs, temperature: e.target.value})}
                              className="w-full px-4 py-4 bg-brand-surface rounded-2xl border-2 border-brand-border/40 font-bold focus:border-brand-primary outline-none transition-all"
                            />
                         </div>
                         <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-muted">Humidity (%)</label>
                            <input 
                              type="number"
                              value={spoilageInputs.humidity}
                              onChange={e => setSpoilageInputs({...spoilageInputs, humidity: e.target.value})}
                              className="w-full px-4 py-4 bg-brand-surface rounded-2xl border-2 border-brand-border/40 font-bold focus:border-brand-primary outline-none transition-all"
                            />
                         </div>
                      </div>
                      <div className="space-y-2">
                         <label className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-muted">Storage condition</label>
                         <select 
                           value={spoilageInputs.storageCondition}
                           onChange={e => setSpoilageInputs({...spoilageInputs, storageCondition: e.target.value})}
                           className="w-full px-4 py-4 bg-brand-surface rounded-2xl border-2 border-brand-border/40 font-bold focus:border-brand-primary outline-none transition-all appearance-none"
                         >
                           <option>Open Air</option>
                           <option>Cold Storage</option>
                           <option>Ventilated Warehouse</option>
                         </select>
                      </div>
                      <Button 
                        onClick={handleAnalyzeSpoilage}
                        disabled={isPredictingSpoilage}
                        className="mt-4 py-5 font-black tracking-widest bg-brand-dark hover:bg-brand-primary"
                      >
                        {isPredictingSpoilage ? <Loader2 size={24} className="animate-spin" /> : 'ANALYZE SPOILAGE RISK'}
                      </Button>
                    </div>
                  </Card>
                </div>

                <div className="lg:col-span-2 space-y-8">
                  {spoilagePrediction ? (
                    <motion.div 
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="grid grid-cols-1 md:grid-cols-2 gap-8"
                    >
                      <Card className="p-8 space-y-8 relative overflow-hidden">
                        <div className={`absolute top-0 right-0 p-6`}>
                           <div className={`px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-widest border-2 ${
                             spoilagePrediction.risk === 'Low' ? 'bg-green-50 border-green-200 text-green-700' :
                             spoilagePrediction.risk === 'Medium' ? 'bg-yellow-50 border-yellow-200 text-yellow-700' :
                             'bg-red-50 border-red-200 text-red-700'
                           }`}>
                             {spoilagePrediction.risk} RISK
                           </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className={`w-16 h-16 rounded-3xl flex items-center justify-center ${
                             spoilagePrediction.risk === 'Low' ? 'bg-green-100 text-green-600' :
                             spoilagePrediction.risk === 'Medium' ? 'bg-yellow-100 text-yellow-600' :
                             'bg-red-100 text-red-600'
                          }`}>
                            <Leaf size={32} />
                          </div>
                          <div>
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-muted">Freshness Estimate</h4>
                            <h2 className="text-4xl font-black text-brand-dark tracking-tighter">{spoilagePrediction.timeLeft}</h2>
                          </div>
                        </div>

                        <div className="space-y-6 pt-6 border-t border-brand-border/40">
                           <div className="bg-brand-dark text-white p-8 rounded-3xl relative overflow-hidden">
                             <div className="absolute top-0 right-0 p-4 opacity-10">
                               <Sparkles size={64} />
                             </div>
                             <p className="text-[10px] font-black uppercase tracking-[0.4em] text-brand-primary mb-4">AI Recommended Action</p>
                             <p className="text-2xl font-black tracking-tight leading-none">{spoilagePrediction.action}</p>
                             <div className="flex gap-4 mt-8">
                                <Button variant="primary" className="py-3 px-6 text-[10px] font-black uppercase tracking-widest bg-brand-primary border-none text-white">
                                   APPLY DISCOUNT
                                </Button>
                                <Button variant="outline" className="py-3 px-6 text-[10px] font-black uppercase tracking-widest border-white/20 hover:bg-white/10 text-white">
                                   SEND TO MARKET
                                </Button>
                             </div>
                           </div>

                           <div className="space-y-4">
                              <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-muted">Contributing Factors</h5>
                              <div className="flex flex-wrap gap-2">
                                 {spoilagePrediction.factors.map((f, i) => (
                                   <span key={i} className="px-4 py-2 bg-brand-surface border border-brand-border rounded-xl text-xs font-bold text-brand-dark">
                                     {f}
                                   </span>
                                 ))}
                              </div>
                           </div>
                        </div>
                      </Card>

                      <div className="space-y-8">
                        <Card className="p-8 space-y-6 bg-red-50 border-red-100">
                           <div className="flex items-center gap-3 text-red-700">
                             <AlertTriangle size={24} />
                             <h4 className="text-lg font-black tracking-tight">Critical Alerts</h4>
                           </div>
                           <div className="space-y-3">
                              {spoilagePrediction.alerts.map((a, i) => (
                                <div key={i} className="p-4 bg-white rounded-2xl border border-red-200 text-red-900 text-xs font-bold">
                                  {a}
                                </div>
                              ))}
                           </div>
                        </Card>
                        <div className="h-40 bg-brand-surface rounded-[40px] border-2 border-dashed border-brand-border flex items-center justify-center p-8 text-center text-brand-muted">
                           <div className="space-y-2">
                             <History size={32} className="mx-auto opacity-20" />
                             <p className="text-[10px] font-black uppercase tracking-widest leading-relaxed">Early harvest sensor data integrated for higher precision.</p>
                           </div>
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <div className="h-full min-h-[500px] flex flex-col items-center justify-center p-12 text-center space-y-6 opacity-40 bg-brand-surface/50 rounded-[60px] border-4 border-dashed border-brand-border/40">
                       <div className="w-40 h-40 bg-white rounded-full flex items-center justify-center shadow-xl">
                          <Leaf size={80} className="text-brand-primary" />
                       </div>
                       <div className="space-y-2">
                         <h3 className="text-3xl font-black text-brand-dark tracking-tight">Perishability Scan</h3>
                         <p className="max-w-xs mx-auto text-sm font-bold leading-relaxed text-brand-muted">Input product harvest and storage details to receive a real-time spoilage risk assessment.</p>
                       </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </ScreenWrapper>
        )}

        {/* SMART ROUTE OPTIMIZATION SCREEN */}
        {currentScreen === 'route_optimization' && (
          <ScreenWrapper>
            <div className="max-w-7xl mx-auto py-10 space-y-10">
              <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                  <button onClick={() => navigateTo('realtime_dashboard')} className="mb-6 group flex items-center gap-2 font-black text-brand-primary tracking-[0.2em] text-xs transition-transform hover:-translate-x-1">
                    <ChevronLeft size={20} /> RETURN TO DASHBOARD
                  </button>
                  <h1 className="text-6xl font-black text-brand-dark tracking-tighter leading-[0.9]">Smart Route <br/><span className="text-brand-primary">Optimization</span></h1>
                  <p className="text-xl text-brand-muted font-medium mt-4">AI identifies the best routes based on distance, traffic, and fuel costs.</p>
                </div>
              </header>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Configuration Panel */}
                <Card className="lg:col-span-1 p-8 space-y-8">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-brand-dark text-white rounded-2xl flex items-center justify-center shadow-lg">
                      <Settings size={24} />
                    </div>
                    <h3 className="text-2xl font-black text-brand-dark tracking-tight">Configuration</h3>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-muted">Source</label>
                       <div className="relative">
                         <div className="absolute left-4 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-brand-primary" />
                         <input 
                           value={routeInputs.source}
                           onChange={e => setRouteInputs({...routeInputs, source: e.target.value})}
                           className="w-full pl-10 pr-4 py-4 bg-brand-surface rounded-2xl border-2 border-brand-border/40 font-bold focus:border-brand-primary outline-none transition-all"
                         />
                       </div>
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-muted">Destination</label>
                       <div className="relative">
                         <MapPin size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-primary" />
                         <input 
                           value={routeInputs.destination}
                           onChange={e => setRouteInputs({...routeInputs, destination: e.target.value})}
                           className="w-full pl-10 pr-4 py-4 bg-brand-surface rounded-2xl border-2 border-brand-border/40 font-bold focus:border-brand-primary outline-none transition-all"
                         />
                       </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                         <label className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-muted">Distance (km)</label>
                         <input 
                           type="number"
                           value={routeInputs.distance}
                           onChange={e => setRouteInputs({...routeInputs, distance: e.target.value})}
                           className="w-full px-4 py-4 bg-brand-surface rounded-2xl border-2 border-brand-border/40 font-bold focus:border-brand-primary outline-none transition-all"
                         />
                      </div>
                      <div className="space-y-2">
                         <label className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-muted">Current Traffic</label>
                         <select 
                           value={routeInputs.traffic}
                           onChange={e => setRouteInputs({...routeInputs, traffic: e.target.value})}
                           className="w-full px-4 py-4 bg-brand-surface rounded-2xl border-2 border-brand-border/40 font-bold focus:border-brand-primary outline-none transition-all appearance-none"
                         >
                           <option>Light</option>
                           <option>Moderate</option>
                           <option>Heavy</option>
                         </select>
                      </div>
                    </div>

                    <Button 
                      onClick={handleOptimizeRoute}
                      disabled={isOptimizingRoute}
                      className="mt-6 py-5 font-black tracking-widest bg-brand-dark hover:bg-brand-primary flex items-center justify-center gap-3"
                    >
                      {isOptimizingRoute ? <Loader2 size={24} className="animate-spin" /> : <Sparkles size={24} />}
                      {isOptimizingRoute ? 'OPTIMIZING...' : 'OPTIMIZE ROUTE'}
                    </Button>
                  </div>
                </Card>

                {/* Map & Results */}
                <div className="lg:col-span-2 space-y-8">
                  {routeOptimization ? (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="space-y-8"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Fastest Route Card */}
                        <Card className={`p-8 space-y-6 relative border-2 ${routeOptimization.recommended === 'Fastest' ? 'border-brand-primary shadow-2xl bg-brand-primary/5' : 'border-brand-border shadow-sm'}`}>
                          <div className="absolute top-4 right-4 flex items-center gap-2">
                             {routeOptimization.recommended === 'Fastest' && (
                                <div className="bg-brand-primary text-white text-[10px] font-black px-3 py-1 rounded-full tracking-widest">
                                  RECOMMENDED
                                </div>
                             )}
                             <div className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest border shadow-sm ${
                                routeOptimization.delayRisk === 'Low' ? 'bg-green-50 text-green-600 border-green-200' : 
                                routeOptimization.delayRisk === 'Medium' ? 'bg-amber-50 text-amber-600 border-amber-200' : 
                                'bg-red-50 text-red-600 border-red-200'
                             }`}>
                               {routeOptimization.delayRisk} RISK
                             </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center">
                              <Zap size={28} />
                            </div>
                            <div>
                              <h4 className="text-xl font-black text-brand-dark tracking-tight">Fastest Route</h4>
                              <p className="text-xs font-bold text-brand-muted">Priority: Time Saving</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4 py-4 border-y border-brand-border/40">
                             <div>
                               <p className="text-[10px] font-black uppercase text-brand-muted tracking-widest">Time</p>
                               <p className="text-xl font-black text-brand-dark">{routeOptimization.fastestRoute.time}</p>
                             </div>
                             <div>
                               <p className="text-[10px] font-black uppercase text-brand-muted tracking-widest">Distance</p>
                               <p className="text-xl font-black text-brand-dark">{routeOptimization.fastestRoute.distance}</p>
                             </div>
                             <div>
                               <p className="text-[10px] font-black uppercase text-brand-muted tracking-widest">Est. Fuel</p>
                               <p className="text-xl font-black text-brand-dark">{routeOptimization.fastestRoute.fuel}</p>
                             </div>
                             <div>
                               <p className="text-[10px] font-black uppercase text-brand-muted tracking-widest">Traffic</p>
                               <p className="text-xl font-black text-brand-dark">{routeOptimization.fastestRoute.traffic}</p>
                             </div>
                          </div>
                          <Button 
                            variant={routeOptimization.recommended === 'Fastest' ? 'primary' : 'outline'}
                            className="w-full py-4 text-xs font-black tracking-widest flex items-center justify-center gap-2"
                          >
                            <Navigation size={16} /> START NAVIGATION
                          </Button>
                        </Card>

                        {/* Cheapest Route Card */}
                        <Card className={`p-8 space-y-6 relative border-2 ${routeOptimization.recommended === 'Cheapest' ? 'border-amber-500 shadow-2xl bg-amber-50' : 'border-brand-border shadow-sm'}`}>
                          <div className="absolute top-4 right-4 flex items-center gap-2">
                             {routeOptimization.recommended === 'Cheapest' && (
                                <div className="bg-amber-500 text-white text-[10px] font-black px-3 py-1 rounded-full tracking-widest">
                                  RECOMMENDED
                                </div>
                             )}
                             <div className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest border shadow-sm ${
                                routeOptimization.delayRisk === 'Low' ? 'bg-green-50 text-green-600 border-green-200' : 
                                routeOptimization.delayRisk === 'Medium' ? 'bg-amber-50 text-amber-600 border-amber-200' : 
                                'bg-red-50 text-red-600 border-red-200'
                             }`}>
                               {routeOptimization.delayRisk} RISK
                             </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-3xl flex items-center justify-center">
                              <Fuel size={28} />
                            </div>
                            <div>
                               <h4 className="text-xl font-black text-brand-dark tracking-tight">Lowest Cost</h4>
                               <p className="text-xs font-bold text-brand-muted">Priority: Fuel Efficiency</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4 py-4 border-y border-brand-border/40">
                             <div>
                               <p className="text-[10px] font-black uppercase text-brand-muted tracking-widest">Time</p>
                               <p className="text-xl font-black text-brand-dark">{routeOptimization.cheapestRoute.time}</p>
                             </div>
                             <div>
                               <p className="text-[10px] font-black uppercase text-brand-muted tracking-widest">Distance</p>
                               <p className="text-xl font-black text-brand-dark">{routeOptimization.cheapestRoute.distance}</p>
                             </div>
                             <div>
                               <p className="text-[10px] font-black uppercase text-brand-muted tracking-widest">Est. Fuel</p>
                               <p className="text-xl font-black text-brand-dark">{routeOptimization.cheapestRoute.fuel}</p>
                             </div>
                             <div>
                               <p className="text-[10px] font-black uppercase text-brand-muted tracking-widest">Traffic</p>
                               <p className="text-xl font-black text-brand-dark">{routeOptimization.cheapestRoute.traffic}</p>
                             </div>
                          </div>
                          <Button 
                            variant={routeOptimization.recommended === 'Cheapest' ? 'primary' : 'outline'}
                            className={`w-full py-4 text-xs font-black tracking-widest flex items-center justify-center gap-2 ${routeOptimization.recommended === 'Cheapest' ? 'bg-amber-600 hover:bg-amber-700 border-none' : ''}`}
                          >
                            <Navigation size={16} /> START NAVIGATION
                          </Button>
                        </Card>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                         <Card className="p-6 bg-brand-dark text-white border-none md:col-span-2">
                            <div className="flex items-start gap-4">
                               <div className="w-10 h-10 bg-brand-primary/20 text-brand-primary rounded-xl flex items-center justify-center shrink-0">
                                  <AlertCircle size={20} />
                               </div>
                               <div>
                                  <p className="text-[10px] font-black uppercase tracking-widest text-brand-primary mb-1">AI Reasoning</p>
                                  <p className="text-sm font-bold opacity-90 leading-relaxed">{routeOptimization.reason}</p>
                               </div>
                            </div>
                         </Card>
                         <Card className="p-6 border-dashed border-2 bg-brand-surface flex flex-col justify-center gap-2">
                             <div className="flex items-center gap-2 text-brand-muted">
                                <Info size={16} />
                                <span className="text-[10px] font-black uppercase tracking-widest">Alternative Suggestion</span>
                             </div>
                             <p className="text-sm font-black text-brand-dark leading-snug">{routeOptimization.alternativeSuggestion}</p>
                         </Card>
                      </div>

                      <Card className="h-[300px] border-4 border-brand-dark rounded-[48px] relative overflow-hidden bg-brand-surface shadow-inner">
                         <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1526778548025-fa2f459cd5ce?auto=format&fit=crop&q=80&w=1000')] bg-cover opacity-20 grayscale" />
                         <div className="absolute inset-0 flex items-center justify-center">
                            <div className="relative w-full max-w-lg h-40">
                               {/* Stylized route path */}
                               <svg className="w-full h-full" viewBox="0 0 500 200">
                                  <path 
                                    d="M 50 100 Q 150 50, 250 100 T 450 100" 
                                    fill="none" 
                                    stroke="#CBD5E1" 
                                    strokeWidth="8" 
                                    strokeLinecap="round" 
                                  />
                                  <motion.path 
                                    d="M 50 100 Q 150 50, 250 100 T 450 100" 
                                    fill="none" 
                                    stroke="#10B981" 
                                    strokeWidth="8" 
                                    strokeLinecap="round" 
                                    strokeDasharray="500"
                                    initial={{ strokeDashoffset: 500 }}
                                    animate={{ strokeDashoffset: 0 }}
                                    transition={{ duration: 2, ease: "easeInOut" }}
                                  />
                               </svg>
                               <div className="absolute left-[50px] top-[100px] -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-brand-dark rounded-full border-4 border-white flex items-center justify-center text-[10px] text-white font-black">S</div>
                               <div className="absolute right-[50px] top-[100px] translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-brand-primary rounded-full border-4 border-white flex items-center justify-center text-white scale-125 shadow-lg"><MapPin size={16} /></div>
                               <motion.div 
                                 animate={{ 
                                   left: ["10%", "90%"],
                                   top: ["50%", "25%", "50%", "75%", "50%"]
                                 }}
                                 transition={{ 
                                   duration: 5, 
                                   repeat: Infinity,
                                   ease: "linear"
                                 }}
                                 className="absolute w-12 h-12 bg-white rounded-2xl shadow-xl border-2 border-brand-border flex items-center justify-center -ml-6 -mt-6"
                               >
                                  <Truck size={24} className="text-brand-dark" />
                               </motion.div>
                            </div>
                         </div>
                         <div className="absolute top-6 left-6 p-4 bg-white/90 backdrop-blur rounded-2xl shadow-lg border border-brand-border">
                            <div className="flex items-center gap-3">
                               <div className={`w-3 h-3 rounded-full ${routeOptimization.delayRisk === 'Low' ? 'bg-green-500' : routeOptimization.delayRisk === 'Medium' ? 'bg-yellow-500' : 'bg-red-500'} animate-pulse`} />
                               <span className="text-xs font-black tracking-widest text-brand-dark">LIVE TRAFFIC: {routeOptimization.delayRisk} RISK</span>
                            </div>
                         </div>
                      </Card>
                    </motion.div>
                  ) : (
                    <div className="h-full min-h-[500px] flex flex-col items-center justify-center p-12 text-center space-y-6 opacity-40 bg-brand-surface/50 rounded-[60px] border-4 border-dashed border-brand-border/40">
                       <div className="w-40 h-40 bg-white rounded-full flex items-center justify-center shadow-xl">
                          <Navigation size={80} className="stroke-1 text-brand-primary" />
                       </div>
                       <div className="space-y-2">
                         <h3 className="text-3xl font-black text-brand-dark tracking-tight">Optimizer Ready</h3>
                         <p className="max-w-xs mx-auto text-sm font-bold leading-relaxed text-brand-muted">Set your delivery path and let AI determine the most cost-effective and fastest route available.</p>
                       </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </ScreenWrapper>
        )}

        {/* SUPPLY-DEMAND MATCHING SCREEN */}
        {currentScreen === 'supply_demand_matching' && (
          <ScreenWrapper>
            <div className="max-w-6xl mx-auto py-10 space-y-10">
              <header>
                <button onClick={() => navigateTo('realtime_dashboard')} className="mb-6 group flex items-center gap-2 font-black text-brand-primary tracking-[0.2em] text-xs transition-transform hover:-translate-x-1">
                  <ChevronLeft size={20} /> RETURN TO DASHBOARD
                </button>
                <h1 className="text-6xl font-black text-brand-dark tracking-tighter leading-[0.9]">Market <br/><span className="text-brand-primary">Matching</span></h1>
                <p className="text-xl text-brand-muted font-medium mt-4">AI-driven direct connection between farmers and high-demand buyers.</p>
              </header>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Inputs Section */}
                <div className="space-y-8">
                  <Card className="p-8 space-y-6">
                    <div className="flex items-center gap-4">
                       <div className="w-12 h-12 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center">
                          <Leaf size={24} />
                       </div>
                       <h3 className="text-2xl font-black text-brand-dark tracking-tight">Farmer Supply</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-muted">Product</label>
                          <input 
                            value={supplyDemandInputs.farmerProduct}
                            onChange={e => setSupplyDemandInputs({...supplyDemandInputs, farmerProduct: e.target.value})}
                            className="w-full px-4 py-4 bg-brand-surface rounded-2xl border-2 border-brand-border/40 font-bold focus:border-brand-primary outline-none transition-all"
                          />
                       </div>
                       <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-muted">Quantity (kg)</label>
                          <input 
                            type="number"
                            value={supplyDemandInputs.farmerQuantity}
                            onChange={e => setSupplyDemandInputs({...supplyDemandInputs, farmerQuantity: e.target.value})}
                            className="w-full px-4 py-4 bg-brand-surface rounded-2xl border-2 border-brand-border/40 font-bold focus:border-brand-primary outline-none transition-all"
                          />
                       </div>
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-muted">Location</label>
                       <input 
                         value={supplyDemandInputs.farmerLocation}
                         onChange={e => setSupplyDemandInputs({...supplyDemandInputs, farmerLocation: e.target.value})}
                         className="w-full px-4 py-4 bg-brand-surface rounded-2xl border-2 border-brand-border/40 font-bold focus:border-brand-primary outline-none transition-all"
                       />
                    </div>
                  </Card>

                  <Card className="p-8 space-y-6">
                    <div className="flex items-center gap-4">
                       <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                          <Store size={24} />
                       </div>
                       <h3 className="text-2xl font-black text-brand-dark tracking-tight">Active Demand</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-muted">Product Needed</label>
                          <input 
                            value={supplyDemandInputs.buyerProduct}
                            onChange={e => setSupplyDemandInputs({...supplyDemandInputs, buyerProduct: e.target.value})}
                            className="w-full px-4 py-4 bg-brand-surface rounded-2xl border-2 border-brand-border/40 font-bold focus:border-brand-primary outline-none transition-all"
                          />
                       </div>
                       <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-muted">Demand Qty (kg)</label>
                          <input 
                            type="number"
                            value={supplyDemandInputs.buyerQuantity}
                            onChange={e => setSupplyDemandInputs({...supplyDemandInputs, buyerQuantity: e.target.value})}
                            className="w-full px-4 py-4 bg-brand-surface rounded-2xl border-2 border-brand-border/40 font-bold focus:border-brand-primary outline-none transition-all"
                          />
                       </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-muted">Buyer Location</label>
                          <input 
                            value={supplyDemandInputs.buyerLocation}
                            onChange={e => setSupplyDemandInputs({...supplyDemandInputs, buyerLocation: e.target.value})}
                            className="w-full px-4 py-4 bg-brand-surface rounded-2xl border-2 border-brand-border/40 font-bold focus:border-brand-primary outline-none transition-all"
                          />
                       </div>
                       <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-muted">Offered Price (₹/kg)</label>
                          <input 
                            type="number"
                            value={supplyDemandInputs.buyerPrice}
                            onChange={e => setSupplyDemandInputs({...supplyDemandInputs, buyerPrice: e.target.value})}
                            className="w-full px-4 py-4 bg-brand-surface rounded-2xl border-2 border-brand-border/40 font-bold focus:border-brand-primary outline-none transition-all"
                          />
                       </div>
                    </div>
                    <Button 
                      onClick={handleMatchSupplyDemand} 
                      disabled={isMatching}
                      className="mt-4 py-5 font-black tracking-widest bg-brand-dark hover:bg-brand-primary"
                    >
                      {isMatching ? <Loader2 size={24} className="animate-spin" /> : 'MATCH SUPPLY & DEMAND'}
                    </Button>
                  </Card>
                </div>

                {/* Results Section */}
                <div className="space-y-8">
                  {supplyDemandMatches ? (
                    <motion.div 
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="space-y-8"
                    >
                      <Card className="p-8 bg-brand-dark text-white border-none shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-10">
                           <Handshake size={120} />
                        </div>
                        <div className="relative z-10 space-y-6">
                           <div className="flex items-center gap-3">
                              <div className="px-4 py-1.5 bg-brand-primary rounded-full text-[10px] font-black uppercase tracking-widest">
                                Best Match
                              </div>
                              <div className="text-brand-primary text-xl font-black">
                                {supplyDemandMatches.matchScore} Match Score
                              </div>
                           </div>
                           <h2 className="text-4xl font-black tracking-tight leading-none">{supplyDemandMatches.bestMatch}</h2>
                           
                           <div className="grid grid-cols-2 gap-8 pt-8 border-t border-white/10">
                              <div>
                                 <p className="text-[10px] font-black uppercase tracking-widest opacity-50 mb-2">Distance</p>
                                 <p className="text-2xl font-black">{supplyDemandMatches.distance}</p>
                              </div>
                              <div>
                                 <p className="text-[10px] font-black uppercase tracking-widest opacity-50 mb-2">Offered Price</p>
                                 <p className="text-2xl font-black text-brand-primary">{supplyDemandMatches.price}</p>
                              </div>
                           </div>

                           <div className="p-6 bg-white/5 rounded-[32px] border border-white/10">
                              <p className="text-sm font-bold leading-relaxed opacity-80">{supplyDemandMatches.reason}</p>
                           </div>

                           <div className="flex gap-4 pt-4">
                              <Button className="flex-1 py-4 font-black tracking-widest bg-brand-primary text-white border-none">
                                CONNECT WITH BUYER
                              </Button>
                              <Button variant="outline" className="flex-1 py-4 font-black tracking-widest border-white/20 text-white hover:bg-white/10">
                                NEGOTIATE
                              </Button>
                           </div>
                        </div>
                      </Card>

                      <div className="space-y-4">
                         <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-brand-muted px-2">Alternative Suggestions</h4>
                         <div className="grid grid-cols-1 gap-4">
                            {supplyDemandMatches.suggestedBuyers.map((buyer, idx) => (
                              <Card key={idx} className="p-6 flex items-center justify-between group hover:border-brand-primary transition-all">
                                 <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-brand-surface rounded-2xl flex items-center justify-center text-brand-muted group-hover:text-brand-primary">
                                       <Users size={24} />
                                    </div>
                                    <div>
                                       <p className="font-black text-brand-dark">{buyer}</p>
                                       <p className="text-[10px] font-bold text-brand-muted uppercase">Potential Secondary Buyer</p>
                                    </div>
                                 </div>
                                 <ArrowRight size={20} className="text-brand-border group-hover:text-brand-primary" />
                              </Card>
                            ))}
                         </div>
                      </div>
                    </motion.div>
                  ) : (
                    <div className="h-full min-h-[600px] flex flex-col items-center justify-center p-12 text-center space-y-8 opacity-40 bg-brand-surface/50 rounded-[60px] border-4 border-dashed border-brand-border/40">
                       <div className="w-48 h-48 bg-white rounded-full flex items-center justify-center shadow-2xl relative">
                          <Handshake size={96} className="text-brand-primary" />
                          <div className="absolute -top-2 -right-2 w-12 h-12 bg-brand-dark rounded-full flex items-center justify-center text-white font-black text-xl border-4 border-white">?</div>
                       </div>
                       <div className="space-y-2">
                         <h3 className="text-3xl font-black text-brand-dark tracking-tight">Market Connector</h3>
                         <p className="max-w-xs mx-auto text-sm font-bold leading-relaxed text-brand-muted">Analyze current supply against active buyer demand to find your most profitable market match.</p>
                       </div>
                    </div>
                  )}
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
              onClick={() => navigateTo('tracking')}
              className={`flex flex-col items-center gap-1 transition-all ${currentScreen === 'tracking' ? 'text-brand-primary scale-110' : 'text-brand-muted'}`}
            >
              <Truck size={24} />
              <span className="text-[10px] font-black uppercase tracking-widest">Track</span>
            </button>
            <button 
              onClick={() => navigateTo('logistics')}
              className={`flex flex-col items-center gap-1 transition-all ${currentScreen === 'logistics' ? 'text-brand-primary scale-110' : 'text-brand-muted'}`}
            >
              <Users size={24} />
              <span className="text-[10px] font-black uppercase tracking-widest">Partners</span>
            </button>
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

      {/* INVENTORY MODAL */}
      <AnimatePresence>
        {isInventoryModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsInventoryModalOpen(false)}
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
                   <h3 className="text-3xl font-black text-brand-dark tracking-tighter">
                     {editingInventoryId ? 'Update Stock' : 'Add Product'}
                   </h3>
                   <button onClick={() => setIsInventoryModalOpen(false)} className="w-10 h-10 rounded-xl bg-brand-surface flex items-center justify-center text-brand-muted hover:text-brand-dark transition-colors">
                     <X size={24} />
                   </button>
                </div>

                <form onSubmit={handleInventoryAction} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase text-brand-muted tracking-[0.2em]">Product Name</label>
                    <input 
                      required
                      type="text" 
                      placeholder="e.g. Tomato (Fresh)" 
                      className="input-field"
                      value={inventoryForm.name}
                      onChange={e => setInventoryForm({...inventoryForm, name: e.target.value})}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase text-brand-muted tracking-[0.2em]">Available Stock</label>
                      <input 
                        required
                        type="number" 
                        placeholder="500" 
                        className="input-field"
                        value={inventoryForm.availableStock}
                        onChange={e => setInventoryForm({...inventoryForm, availableStock: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase text-brand-muted tracking-[0.2em]">Sold Stock</label>
                      <input 
                        required
                        type="number" 
                        placeholder="0" 
                        className="input-field"
                        value={inventoryForm.soldStock}
                        onChange={e => setInventoryForm({...inventoryForm, soldStock: e.target.value})}
                      />
                    </div>
                  </div>

                  {/* Automatic Remaining Stock Display */}
                  <div className="bg-brand-surface/50 border-2 border-brand-border/40 p-5 rounded-3xl flex items-center justify-between transition-all group hover:border-brand-primary/30">
                    <div>
                      <p className="text-[10px] font-black uppercase text-brand-muted tracking-[0.2em] mb-1">Live Calculation: Remaining Stock</p>
                      <div className="flex items-baseline gap-1">
                        <p className={`text-3xl font-black transition-colors ${
                          Number(inventoryForm.availableStock) - Number(inventoryForm.soldStock) < Number(inventoryForm.threshold) 
                          ? 'text-red-600' : 'text-brand-primary'
                        }`}>
                          {Math.max(0, Number(inventoryForm.availableStock || 0) - Number(inventoryForm.soldStock || 0))}
                        </p>
                        <span className="text-xs font-black text-brand-muted uppercase tracking-tighter">{inventoryForm.unit}</span>
                      </div>
                    </div>
                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-brand-primary shadow-sm border border-brand-border/20 group-hover:scale-110 transition-transform">
                      <Calculator size={20} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase text-brand-muted tracking-[0.2em]">Alert Threshold</label>
                      <input 
                        required
                        type="number" 
                        placeholder="100" 
                        className="input-field"
                        value={inventoryForm.threshold}
                        onChange={e => setInventoryForm({...inventoryForm, threshold: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase text-brand-muted tracking-[0.2em]">Unit</label>
                      <select 
                        className="input-field"
                        value={inventoryForm.unit}
                        onChange={e => setInventoryForm({...inventoryForm, unit: e.target.value})}
                      >
                        <option value="kg">kilograms (kg)</option>
                        <option value="ton">tons</option>
                        <option value="crates">crates</option>
                        <option value="bags">bags</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-4 flex gap-4">
                    <Button variant="outline" onClick={() => setIsInventoryModalOpen(false)} className="flex-1">CANCEL</Button>
                    <Button type="submit" className="flex-[2] py-5 font-black tracking-widest">
                       {editingInventoryId ? 'SAVE CHANGES' : 'ADD TO STOCK'}
                    </Button>
                  </div>
                </form>
              </Card>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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

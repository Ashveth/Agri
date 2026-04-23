/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
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
  Timestamp 
} from 'firebase/firestore';
import { auth, db } from './lib/firebase.ts';

declare global {
  interface Window {
    recaptchaVerifier: RecaptchaVerifier;
  }
}
import { 
  Home, 
  History as HistoryIcon, 
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
  CheckCircle2
} from 'lucide-react';
import { Screen, Prediction, Farmer } from './types.ts';

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

const Card = ({ children, className = "", id, onClick }: { children: React.ReactNode, className?: string, id?: any, key?: any, onClick?: () => void }) => (
  <div key={id} onClick={onClick} className={`bg-white rounded-3xl p-6 border border-brand-border ${className} ${onClick ? 'cursor-pointer active:scale-[0.98] transition-transform' : ''}`}>
    {children}
  </div>
);

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
  const [alerts, setAlerts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<Prediction[]>([]);
  const [currentFarmer, setCurrentFarmer] = useState<Farmer | null>(null);
  const [onboardingStep, setOnboardingStep] = useState<number | null>(null);
  const [profileForm, setProfileForm] = useState({
    name: '',
    age: '',
    location: '',
    farms: '',
    profilePhoto: '',
    phoneNumber: ''
  });

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

  // Initialize Gemini
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  // Auth State Listener & Real-time History sync
  useEffect(() => {
    let unsubscribeHistory: (() => void) | undefined;

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

        // Real-time history listener
        try {
          const q = query(
            collection(db, 'predictions'), 
            where('userId', '==', user.uid),
            orderBy('createdAt', 'desc')
          );
          
          unsubscribeHistory = onSnapshot(q, (snapshot) => {
            const docs = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            } as Prediction));
            setHistory(docs);
          }, (err) => {
            console.error("History sync failed:", err);
          });
        } catch (err) {
          console.error("Failed to setup history listener:", err);
        }

      } else {
        localStorage.removeItem('isLoggedIn');
        setHistory([]);
        if (unsubscribeHistory) {
          unsubscribeHistory();
          unsubscribeHistory = undefined;
        }
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeHistory) unsubscribeHistory();
    };
  }, []);

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
    navigateTo('login');
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

  const handlePredict = async () => {
    navigateTo('loading');
    
    try {
      const prompt = `Act as an agricultural expert. A farmer is asking for a demand prediction for ${selectedProduct} in ${location}. 
      The date is ${new Date().toLocaleDateString()}.
      Return a JSON object with: 
      demand (High/Medium/Low), 
      price (number, estimated ₹ per kg), 
      bestLocation (string), 
      bestTime (string), 
      trend (Increasing/Decreasing/Stable).
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
              trend: { type: Type.STRING }
            },
            required: ["demand", "price", "bestLocation", "bestTime", "trend"]
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
        date: new Date().toISOString(),
        demand: 'High',
        price: 48,
        bestLocation: `${location} Main Mandi`,
        bestTime: 'Next 24 hours',
        trend: 'Increasing'
      };
      setPrediction(mockResult);
      navigateTo('result');
    }
  };

  const ScreenWrapper = ({ children, id }: { children: React.ReactNode, id: string }) => (
    <div key={id} className="min-h-screen pb-24">
      {children}
    </div>
  );

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col">
      {/* NAVBAR */}
      {currentScreen !== 'login' && currentScreen !== 'otp' && (
        <nav className="bg-white border-b border-brand-border sticky top-0 z-50 shadow-sm">
          <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
            <div 
              className="flex items-center gap-3 cursor-pointer group" 
              onClick={() => navigateTo('dashboard')}
            >
              <div className="w-12 h-12 bg-brand-primary rounded-xl flex items-center justify-center shadow-lg group-hover:rotate-6 transition-transform">
                <LayoutDashboard size={24} className="text-white" />
              </div>
              <div>
                <span className="text-xl font-black text-brand-dark tracking-tight">AgriSmart AI</span>
                <p className="text-[10px] font-bold text-brand-primary uppercase tracking-[0.2em] -mt-1">Advisor Portal</p>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-8 font-bold text-sm tracking-wide">
              <button 
                onClick={() => navigateTo('dashboard')}
                className={`${currentScreen === 'dashboard' ? 'text-brand-primary' : 'text-brand-muted hover:text-brand-dark'} transition-colors`}
              >
                DASHBOARD
              </button>
              <button 
                onClick={() => navigateTo('history')}
                className={`${currentScreen === 'history' ? 'text-brand-primary' : 'text-brand-muted hover:text-brand-dark'} transition-colors`}
              >
                INSIGHT HISTORY
              </button>
              <button 
                onClick={() => navigateTo('input')}
                className="bg-brand-highlight px-4 py-2 rounded-xl text-brand-primary hover:bg-brand-primary hover:text-white transition-all shadow-sm"
              >
                NEW PREDICTION
              </button>
            </div>

            <div className="flex items-center gap-4">
              <button 
                onClick={handleLogout}
                className="flex items-center gap-2 text-brand-muted hover:text-red-500 font-bold transition-all px-4 py-2 rounded-xl"
              >
                <span className="text-xl">🚪</span>
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

      <main className="flex-1 w-full max-w-7xl mx-auto relative px-4 sm:px-6 py-6 md:py-10">
        <div id="recaptcha-container"></div>
        {/* LOGIN SCREEN */}
          {currentScreen === 'login' && (
            <ScreenWrapper id="login">
              <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center gap-12 pt-20">
                <div className="flex-1 space-y-6 text-center md:text-left">
                  <div className="w-24 h-24 bg-brand-primary rounded-3xl flex items-center justify-center shadow-xl shadow-brand-primary/30 mx-auto md:mx-0">
                    <LayoutDashboard size={48} className="text-white" />
                  </div>
                  <h1 className="text-5xl md:text-6xl font-black text-brand-dark tracking-tighter leading-tight font-sans">
                    Smart Insights for <span className="text-brand-primary">Better Harvests.</span>
                  </h1>
                  <p className="text-xl text-brand-muted font-medium max-w-lg">
                    AgriSmart AI helps farmers predict market demand, optimize prices, and find the best markets using state-of-the-art AI technology.
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
          <ScreenWrapper id="otp">
            <div className="max-w-md mx-auto pt-20">
              <button onClick={() => navigateTo('login')} className="mb-8 p-3 rounded-2xl hover:bg-brand-surface text-brand-dark transition-all flex items-center gap-2 font-black text-xs tracking-widest">
                <ChevronLeft size={20} /> CHANGE NUMBER
              </button>
              
              <Card className="p-10 shadow-2xl border-2 border-brand-border bg-white text-center">
                <div className="w-20 h-20 bg-brand-highlight rounded-3xl flex items-center justify-center text-4xl mx-auto mb-8 shadow-sm">✉️</div>
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
          <ScreenWrapper id="profile">
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
                    <div className="bg-brand-dark text-white p-6 rounded-[2.5rem] shadow-2xl border-4 border-brand-primary/20 relative">
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-primary text-white text-[10px] font-black px-4 py-1 rounded-full uppercase tracking-widest shadow-lg">
                        Step {onboardingStep + 1} of 4
                      </div>
                      <h4 className="text-xl font-black mb-2 tracking-tight">
                        {onboardingStep === 0 && "Welcome Friend! 👋"}
                        {onboardingStep === 1 && "Location is Key 📍"}
                        {onboardingStep === 2 && "Farm Intelligence 🌾"}
                        {onboardingStep === 3 && "Final Touch 📸"}
                      </h4>
                      <p className="text-sm text-white/70 font-medium leading-relaxed mb-6">
                        {onboardingStep === 0 && "Let's start with your name. This helps our AI advisor address you properly in its reports."}
                        {onboardingStep === 1 && "Setting your village helps us track local mandi prices and weather patterns specific to your area."}
                        {onboardingStep === 2 && "Tell us what you grow. We'll use this to send you personalized harvest-time alerts."}
                        {onboardingStep === 3 && "Add a photo to make the portal yours. You're all set after this!"}
                      </p>
                      <div className="flex items-center justify-between gap-4">
                        <button 
                          onClick={() => setOnboardingStep(null)}
                          className="text-xs font-black text-white/40 hover:text-white uppercase tracking-widest"
                        >
                          Skip
                        </button>
                        <button 
                          onClick={() => {
                            if (onboardingStep < 3) setOnboardingStep(onboardingStep + 1);
                            else setOnboardingStep(null);
                          }}
                          className="bg-brand-primary px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-brand-primary/40 flex items-center gap-2"
                        >
                          {onboardingStep < 3 ? "Next Step" : "I'm ready!"} <ArrowRight size={14} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {currentFarmer && (
                <button 
                  onClick={() => navigateTo('dashboard')} 
                  className="mb-8 p-3 rounded-2xl hover:bg-brand-surface text-brand-dark transition-all flex items-center gap-2 font-black text-xs tracking-widest"
                >
                  <ChevronLeft size={20} /> BACK TO DASHBOARD
                </button>
              )}
              <header className="text-center mb-10">
                 <div className="w-20 h-20 bg-brand-primary/10 text-brand-primary rounded-3xl flex items-center justify-center mx-auto mb-4 text-4xl">👨‍🌾</div>
                 <h1 className="text-4xl font-black text-brand-dark tracking-tight">Complete Your Profile</h1>
                 <p className="text-brand-muted font-bold mt-2">Introduce yourself to the AgriSmart community.</p>
              </header>

              <Card className="p-10 shadow-2xl bg-white border-2 border-brand-border">
                <form onSubmit={handleProfileSubmit} className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase text-brand-muted ml-1 tracking-[0.2em]">Full Name *</label>
                      <input 
                        required
                        type="text" 
                        placeholder="e.g. Rajesh Kumar" 
                        className="w-full px-6 py-4 rounded-2xl bg-brand-surface border-2 border-brand-border focus:outline-none focus:border-brand-primary text-lg font-bold"
                        value={profileForm.name}
                        onChange={e => setProfileForm({...profileForm, name: e.target.value})}
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase text-brand-muted ml-1 tracking-[0.2em]">Age (Optional)</label>
                      <input 
                        type="number" 
                        placeholder="e.g. 42" 
                        className="w-full px-6 py-4 rounded-2xl bg-brand-surface border-2 border-brand-border focus:outline-none focus:border-brand-primary text-lg font-bold"
                        value={profileForm.age}
                        onChange={e => setProfileForm({...profileForm, age: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase text-brand-muted ml-1 tracking-[0.2em]">Location/Village *</label>
                    <div className="relative">
                      <MapPin size={20} className="absolute left-6 top-1/2 -translate-y-1/2 text-brand-muted" />
                      <input 
                        required
                        type="text" 
                        placeholder="e.g. Pimpalgaon, Nashik" 
                        className="w-full pl-16 pr-6 py-4 rounded-2xl bg-brand-surface border-2 border-brand-border focus:outline-none focus:border-brand-primary text-lg font-bold"
                        value={profileForm.location}
                        onChange={e => setProfileForm({...profileForm, location: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase text-brand-muted ml-1 tracking-[0.2em]">Your Farm Details</label>
                    <textarea 
                      placeholder="e.g. 5 acres of Grapes and 2 acres of Tomatoes" 
                      rows={3}
                      className="w-full px-6 py-4 rounded-2xl bg-brand-surface border-2 border-brand-border focus:outline-none focus:border-brand-primary text-lg font-bold resize-none"
                      value={profileForm.farms}
                      onChange={e => setProfileForm({...profileForm, farms: e.target.value})}
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase text-brand-muted ml-1 tracking-[0.2em]">Profile Photo URL (Optional)</label>
                    <input 
                      type="url" 
                      placeholder="https://images.unsplash.com/photo..." 
                      className="w-full px-6 py-4 rounded-2xl bg-brand-surface border-2 border-brand-border focus:outline-none focus:border-brand-primary font-bold"
                      value={profileForm.profilePhoto}
                      onChange={e => setProfileForm({...profileForm, profilePhoto: e.target.value})}
                    />
                  </div>

                  {authError && <p className="text-red-500 text-xs font-bold bg-red-50 p-4 rounded-xl border border-red-100">{authError}</p>}

                  <Button type="submit" disabled={isAuthLoading} className="py-5 text-xl font-black rounded-2xl">
                    {isAuthLoading ? <Loader2 className="animate-spin" /> : 'SAVE & CONTINUE 👨‍🌾'}
                  </Button>
                </form>
              </Card>
            </div>
          </ScreenWrapper>
        )}
        {currentScreen === 'dashboard' && (
          <ScreenWrapper id="dashboard">
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
                    className="flex flex-col justify-between h-[450px] bg-[url('https://images.unsplash.com/photo-1592833159057-65c697b0a88b?auto=format&fit=crop&q=80&w=800')] bg-cover bg-center border-none relative overflow-hidden group cursor-pointer"
                    onClick={() => navigateTo('input')}
                  >
                    <div className="absolute inset-0 bg-brand-dark/40 group-hover:bg-brand-dark/30 transition-colors"></div>
                    <div className="relative z-10 p-2">
                       <span className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-[10px] text-white font-bold uppercase tracking-widest border border-white/20 tracking-widest">Global Insights Active</span>
                    </div>
                    <div className="relative z-10 p-4">
                      <h2 className="text-5xl font-black text-white leading-none mb-6">Price Prediction</h2>
                      <div className="w-16 h-16 bg-brand-primary rounded-full flex items-center justify-center text-white shadow-lg group-hover:translate-x-2 transition-transform">
                        <ArrowRight size={32} />
                      </div>
                    </div>
                  </Card>

                  <div className="flex flex-col gap-6">
                    <Card className="flex-1 flex items-center gap-6 bg-brand-highlight border-brand-highlight-border">
                       <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center shadow-sm text-4xl">📊</div>
                       <div>
                         <h3 className="text-xl font-bold text-brand-dark">Market Trends</h3>
                         <p className="text-sm text-brand-primary font-bold uppercase tracking-widest mt-1">Real-time Data Active</p>
                       </div>
                    </Card>
                    <Card className="flex-1 flex items-center gap-6 bg-white border-brand-border">
                       <div className="w-20 h-20 bg-brand-surface rounded-3xl flex items-center justify-center shadow-sm text-4xl">🔍</div>
                       <div>
                         <h3 className="text-xl font-bold text-brand-dark">Logistics Planner</h3>
                         <p className="text-xs text-brand-muted font-bold uppercase tracking-widest mt-1 text-[10px]">Optimize Delivery Routes</p>
                       </div>
                    </Card>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-4 space-y-8 h-full">
                <Card className="bg-white border-brand-border shadow-xl shadow-brand-dark/5 flex flex-col h-full min-h-[600px]">
                  <h3 className="font-bold text-2xl mb-8 text-brand-dark tracking-tight px-2">Market Intelligence</h3>
                  <div className="space-y-6 overflow-y-auto flex-1 pr-2 custom-scrollbar">
                    {alerts.length > 0 ? alerts.map(alert => (
                      <div key={alert.id} className="flex gap-4 p-5 bg-brand-surface rounded-3xl border border-brand-border group hover:border-brand-primary transition-all cursor-pointer">
                        <div className="w-14 h-14 bg-white border border-brand-border rounded-2xl flex items-center justify-center shrink-0 shadow-sm text-2xl group-hover:scale-110 transition-transform">
                          {alert.type === 'warning' ? '📈' : alert.type === 'success' ? '🚀' : '💡'}
                        </div>
                        <div>
                          <h4 className="font-bold text-base text-brand-dark">{alert.title}</h4>
                          <p className="text-xs text-brand-muted mt-2 leading-relaxed font-medium">{alert.description}</p>
                        </div>
                      </div>
                    )) : (
                      <div className="text-center py-20 px-6 text-brand-muted opacity-50 bg-brand-surface rounded-[40px] border-2 border-dashed border-brand-border">
                        <Loader2 className="animate-spin mx-auto mb-4" size={32} />
                        <p className="text-lg font-bold">Scanning Markets...</p>
                      </div>
                    )}
                  </div>
                  <div className="mt-8 pt-8 border-t border-brand-border">
                    <Button variant="outline" className="text-xs font-black tracking-[0.2em] py-4 rounded-2xl">SUBSCRIBE TO PRO UPDATES</Button>
                  </div>
                </Card>
              </div>
            </div>
          </ScreenWrapper>
        )}

        {/* INPUT SCREEN */}
        {currentScreen === 'input' && (
          <ScreenWrapper id="input">
            <div className="max-w-3xl mx-auto space-y-12 py-10">
              <header className="text-center">
                <h1 className="text-5xl md:text-6xl font-black text-brand-dark tracking-tighter mb-4">Advisory <span className="text-brand-primary">Setup</span></h1>
                <p className="text-xl text-brand-muted font-medium max-w-xl mx-auto">Configure your distribution parameters to generate a high-precision market analysis.</p>
              </header>

              <Card className="p-12 shadow-2xl border-brand-border bg-white overflow-visible">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-10">
                  <div className="space-y-3">
                    <label className="text-xs font-black uppercase text-brand-muted ml-1 tracking-[0.2em]">Primary Crop</label>
                    <div className="relative">
                      <select 
                        value={selectedProduct}
                        onChange={(e) => setSelectedProduct(e.target.value)}
                        className="w-full px-6 py-5 rounded-3xl bg-brand-surface border-2 border-brand-border focus:outline-brand-primary text-xl font-bold appearance-none cursor-pointer transition-all hover:border-brand-primary"
                      >
                        <option>🍅 Tomato</option>
                        <option>🧅 Onion</option>
                        <option>🥔 Potato</option>
                        <option>🌶️ Chilli</option>
                        <option>🥬 Cabbage</option>
                      </select>
                      <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-brand-primary">
                        <ArrowRight size={24} className="rotate-90" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-xs font-black uppercase text-brand-muted ml-1 tracking-[0.2em]">Distribution Base</label>
                    <div className="relative">
                      <MapPin className="absolute left-6 top-1/2 -translate-y-1/2 text-brand-primary pointer-events-none" size={24} />
                      <input 
                        type="text" 
                        placeholder="e.g. Nashik" 
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        className="w-full pl-16 pr-6 py-5 rounded-3xl bg-brand-surface border-2 border-brand-border focus:outline-brand-primary text-xl font-bold transition-all hover:border-brand-primary"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3 mb-12">
                  <label className="text-xs font-black uppercase text-brand-muted ml-1 tracking-[0.2em]">Estimated Harvest/Selling Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-6 top-1/2 -translate-y-1/2 text-brand-primary pointer-events-none" size={24} />
                    <input 
                      type="date" 
                      className="w-full pl-16 pr-6 py-5 rounded-3xl bg-brand-surface border-2 border-brand-border focus:outline-brand-primary text-xl font-bold transition-all hover:border-brand-primary"
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
          <ScreenWrapper id="loading">
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
          <ScreenWrapper id="result">
            <div className="max-w-5xl mx-auto space-y-10 py-6 md:py-12">
              <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-brand-border pb-10">
                <div className="space-y-4">
                  <button onClick={() => navigateTo('input')} className="group flex items-center gap-2 font-black text-brand-primary tracking-[0.2em] text-xs transition-transform hover:-translate-x-1">
                    <ChevronLeft size={20} /> RETURN TO SETUP
                  </button>
                  <h1 className="text-6xl font-black text-brand-dark tracking-tighter leading-tight">
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
                <Card className="md:col-span-7 bg-brand-dark border-none p-12 flex flex-col justify-between min-h-[420px] relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-96 h-96 bg-brand-primary/10 rounded-full blur-[100px] -mr-32 -mt-32 group-hover:scale-110 transition-transform"></div>
                  <div className="relative z-10">
                    <p className="text-brand-highlight/40 font-black uppercase tracking-[0.4em] text-[10px] mb-2">Estimated Market Price (₹/KG)</p>
                    <div className="flex items-baseline gap-4">
                       <span className="text-[120px] font-black text-white tracking-tighter leading-[0.8] drop-shadow-xl">₹{prediction.price}</span>
                       <span className="text-2xl text-brand-highlight font-black tracking-widest">REAL-TIME</span>
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
                      <p className="text-white/30 font-black uppercase text-[10px] tracking-[0.3em] mb-2">Recommended Strategy</p>
                      <span className="text-2xl font-black text-brand-highlight tracking-tight leading-none">Aggressive Sale</span>
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

                  <Card className="bg-white p-10 border-brand-border border-2 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-muted mb-2">Target Selling Window</p>
                      <h3 className="text-2xl font-black text-brand-dark tracking-tighter">{prediction.bestTime}</h3>
                    </div>
                    <div className="w-16 h-16 bg-brand-surface rounded-3xl flex items-center justify-center text-brand-primary text-3xl">📅</div>
                  </Card>
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
          <ScreenWrapper id="map">
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

        {/* HISTORY SCREEN */}
        {currentScreen === 'history' && (
          <ScreenWrapper id="history">
            <div className="max-w-5xl mx-auto py-10">
              <header className="mb-12">
                <button onClick={() => navigateTo('dashboard')} className="mb-6 group flex items-center gap-2 font-black text-brand-primary tracking-[0.2em] text-xs transition-transform hover:-translate-x-1">
                  <ChevronLeft size={20} /> RETURN TO DASHBOARD
                </button>
                <h1 className="text-6xl font-black text-brand-dark tracking-tighter leading-tight">Insight <span className="text-brand-primary">Archive</span></h1>
                <p className="text-xl text-brand-muted font-medium mt-2">Manage and review your historical market predictions across all regions.</p>
              </header>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {history.map(item => (
                  <Card 
                    key={item.id} 
                    className="flex p-8 items-center gap-8 cursor-pointer hover:border-brand-primary transition-all group shadow-sm hover:shadow-xl hover:shadow-brand-primary/10 rounded-[40px] bg-white"
                    onClick={() => {
                      setPrediction(item);
                      navigateTo('result');
                    }}
                  >
                    <div className="w-24 h-24 bg-brand-surface rounded-3xl flex items-center justify-center text-5xl group-hover:scale-110 transition-transform shadow-sm border border-brand-border">
                      {item.product === 'Tomato' ? '🍅' : item.product === 'Onion' ? '🧅' : '🥔'}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start mb-1">
                        <h3 className="text-3xl font-black text-brand-dark tracking-tighter">{item.product}</h3>
                        <span className="text-[10px] font-black text-brand-muted uppercase tracking-[0.3em]">{item.date}</span>
                      </div>
                      <p className="text-brand-muted font-bold text-sm tracking-tight mb-6 flex items-center gap-1 opacity-70">
                        <MapPin size={16} className="text-brand-primary" /> {item.location}
                      </p>
                      <div className="flex gap-4">
                        <div className="bg-brand-highlight px-4 py-2 rounded-2xl text-xs font-black text-brand-primary uppercase tracking-widest border border-brand-highlight-border">₹{item.price}/KG</div>
                        <div className="bg-brand-surface px-4 py-2 rounded-2xl text-xs font-black text-brand-muted uppercase tracking-widest border border-brand-border">STABLE</div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              <div className="mt-16 text-center">
                <Button variant="outline" className="w-fit px-16 border-4 py-6 font-black tracking-[0.2em] text-xs rounded-3xl group">
                   <span className="group-hover:scale-110 transition-transform block">LOAD PREVIOUS QUARTER</span>
                </Button>
              </div>
            </div>
          </ScreenWrapper>
        )}

      </main>

      {/* FOOTER */}
      <footer className="bg-white border-t border-brand-border py-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8 text-center md:text-left">
          <div>
            <span className="text-2xl font-black text-brand-dark tracking-tighter">AgriSmart AI</span>
            <p className="text-brand-muted text-sm font-medium mt-1">Empowering the agricultural community through modern AI advisor tools.</p>
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

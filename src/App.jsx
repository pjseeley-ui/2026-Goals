import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, BarChart, Bar
} from 'recharts';
import { 
  Activity, Calendar, AlertCircle, CheckCircle2, 
  Target, Plus, X, BarChart2, ChevronRight, Sparkles,
  Zap, Trophy, TrendingUp, Book, DollarSign, Clock,
  Edit2, Trash2, Award, Flame, CheckSquare, TrendingDown,
  LogOut, Mail, Lock, User, Download, Search, Undo2,
  Info, ChevronDown, Filter
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, collection, doc, onSnapshot, updateDoc, addDoc, 
  writeBatch, query, Timestamp, increment, deleteDoc, setDoc, orderBy, limit
} from 'firebase/firestore';

// Firebase configuration
const firebaseConfig = JSON.parse(import.meta.env.VITE_FIREBASE_CONFIG || '{}');
const appId = import.meta.env.VITE_APP_ID || 'default-app';

// Light theme with teals and deep reds
const THEME = {
  bg: "bg-cyan-50",
  card: "bg-white",
  cardBorder: "border-teal-200",
  textMain: "text-slate-900",
  textMuted: "text-slate-600",
  primary: "bg-rose-600 hover:bg-rose-700",
  secondary: "bg-teal-600 hover:bg-teal-700",
  accent: "from-teal-500 to-cyan-500",
  accentRed: "from-rose-500 to-red-600",
  success: "text-teal-600",
  danger: "text-rose-600",
  chart: {
    teal: "#14b8a6",
    red: "#e11d48",
    grid: "#e2e8f0"
  }
};

// Initial goals
const INITIAL_GOALS = [
  { name: 'Running', type: 'cumulative', target: 1000, current: 0, unit: 'km', trackStreak: true, streak: 0 },
  { name: 'Reading', type: 'cumulative', target: 24, current: 0, unit: 'books', trackStreak: false, streak: 0 },
  { name: 'Savings', type: 'cumulative', target: 20000, current: 0, unit: '£', trackStreak: false, streak: 0 },
  { name: '5K Personal Best', type: 'personal-best', target: 18, current: 25, unit: 'minutes', trackStreak: false, streak: 0, bestValue: null, bestDate: null, higherIsBetter: false },
];

// Goal Templates for Quick Setup
const GOAL_TEMPLATES = [
  { name: 'Run 1000km', type: 'cumulative', target: 1000, unit: 'km', trackStreak: true, icon: '🏃' },
  { name: 'Read 24 Books', type: 'cumulative', target: 24, unit: 'books', trackStreak: false, icon: '📚' },
  { name: 'Save £20,000', type: 'cumulative', target: 20000, unit: '£', trackStreak: false, icon: '💰' },
  { name: 'Learn Spanish', type: 'cumulative', target: 365, unit: 'days', trackStreak: true, icon: '🗣️' },
  { name: '5K Personal Best', type: 'personal-best', target: 20, unit: 'minutes', trackStreak: false, higherIsBetter: false, icon: '⏱️' },
  { name: 'Lose 10kg', type: 'countdown', target: 10, unit: 'kg', trackStreak: false, icon: '⚖️' },
  { name: 'Daily Meditation', type: 'habit', target: 365, unit: 'days', trackStreak: true, icon: '🧘' },
  { name: 'Maintain Weight', type: 'maintain', target: 75, minValue: 73, maxValue: 77, unit: 'kg', trackStreak: false, icon: '📊' },
];

// Goal type options
const GOAL_TYPES = [
  { value: 'cumulative', label: 'Cumulative', description: 'Add up progress over time (e.g., total distance, savings)' },
  { value: 'personal-best', label: 'Personal Best', description: 'Track your best single performance (e.g., fastest time, highest score)' },
  { value: 'countdown', label: 'Countdown', description: 'Count down to zero (e.g., weight loss, debt payoff)' },
  { value: 'habit', label: 'Daily Habit', description: 'Track yes/no completion each day' },
  { value: 'target', label: 'Target Date', description: 'Complete by a specific date' },
  { value: 'average', label: 'Average', description: 'Maintain an average per week/month' },
  { value: 'maintain', label: 'Maintain Range', description: 'Keep within min/max bounds (e.g., weight, budget)' },
];

// Toast Notification Component
const Toast = ({ message, type = 'success', onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const icons = {
    success: <CheckCircle2 size={20} />,
    error: <AlertCircle size={20} />,
    info: <Info size={20} />
  };

  const styles = {
    success: 'bg-teal-50 border-teal-300 text-teal-800',
    error: 'bg-rose-50 border-rose-300 text-rose-800',
    info: 'bg-cyan-50 border-cyan-300 text-cyan-800'
  };

  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center space-x-3 ${styles[type]} border-2 rounded-xl px-4 py-3 shadow-lg animate-in slide-in-from-bottom-4 duration-300 max-w-md`}>
      {icons[type]}
      <p className="text-sm font-medium flex-1">{message}</p>
      <button onClick={onClose} className="hover:opacity-70 transition-opacity">
        <X size={18} />
      </button>
    </div>
  );
};

// Toast Container
const ToastContainer = ({ toasts, removeToast }) => (
  <div className="fixed bottom-6 right-6 z-50 space-y-2">
    {toasts.map(toast => (
      <Toast key={toast.id} {...toast} onClose={() => removeToast(toast.id)} />
    ))}
  </div>
);

// Components
const GlassCard = ({ children, className = "", onClick }) => (
  <div 
    onClick={onClick}
    className={`relative ${THEME.card} border-2 ${THEME.cardBorder} rounded-2xl shadow-lg overflow-hidden transition-all duration-300 hover:shadow-xl hover:border-teal-300 ${className}`}
  >
    {children}
  </div>
);

const Modal = ({ isOpen, onClose, title, children, size = 'default' }) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeClasses = {
    small: 'max-w-md',
    default: 'max-w-2xl',
    large: 'max-w-4xl'
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4 animate-in fade-in duration-300">
      <div className={`${THEME.card} border-t sm:border-2 border-teal-300 rounded-t-2xl sm:rounded-2xl w-full ${sizeClasses[size]} shadow-2xl transform transition-all scale-100 overflow-hidden`}>
        <div className={`flex justify-between items-center p-6 border-b-2 border-teal-100 ${THEME.bg}`}>
          <h3 className={`text-xl font-bold ${THEME.textMain} tracking-tight`}>{title}</h3>
          <button 
            onClick={onClose} 
            className={`p-2 rounded-full hover:bg-teal-100 ${THEME.textMuted} hover:text-teal-700 transition-colors`}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-6 pb-10 sm:pb-6 max-h-[70vh] overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
};

// Login/Signup Screen
const AuthScreen = ({ onAuth, error: initError }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }

    if (!isLogin && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!isLogin && password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(onAuth, email, password);
      } else {
        await createUserWithEmailAndPassword(onAuth, email, password);
      }
    } catch (err) {
      console.error('Auth error:', err);
      setLoading(false);
      switch (err.code) {
        case 'auth/invalid-email':
          setError('Invalid email address');
          break;
        case 'auth/user-not-found':
          setError('No account found with this email');
          break;
        case 'auth/wrong-password':
          setError('Incorrect password');
          break;
        case 'auth/email-already-in-use':
          setError('An account with this email already exists');
          break;
        case 'auth/weak-password':
          setError('Password is too weak');
          break;
        case 'auth/invalid-credential':
          setError('Invalid email or password');
          break;
        case 'auth/too-many-requests':
          setError('Too many failed attempts. Please try again later.');
          break;
        default:
          setError('Authentication failed. Please try again.');
      }
    }
  };

  return (
    <div className={`min-h-screen ${THEME.bg} flex items-center justify-center p-6`}>
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-block bg-gradient-to-br from-teal-500 to-cyan-600 p-4 rounded-2xl shadow-lg mb-4">
            <Sparkles size={40} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">2026 Tracker</h1>
          <p className="text-slate-600">Track your goals, achieve your dreams</p>
        </div>

        {initError && (
          <div className="mb-6 bg-rose-50 border-2 border-rose-200 rounded-xl p-4">
            <div className="flex items-start space-x-2">
              <AlertCircle size={20} className="text-rose-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-rose-700 mb-1">Initialisation Error</p>
                <p className="text-sm text-rose-600">{initError}</p>
              </div>
            </div>
          </div>
        )}

        <GlassCard className="p-8">
          <div className="flex border-2 border-teal-200 rounded-xl p-1 mb-6 bg-slate-50">
            <button
              onClick={() => {
                setIsLogin(true);
                setError('');
              }}
              className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                isLogin ? 'bg-teal-600 text-white' : 'text-slate-700 hover:text-teal-700'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => {
                setIsLogin(false);
                setError('');
              }}
              className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                !isLogin ? 'bg-rose-600 text-white' : 'text-slate-700 hover:text-rose-700'
              }`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2" htmlFor="email">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white text-slate-900 border-2 border-teal-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all placeholder-slate-400"
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                  aria-label="Email address"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white text-slate-900 border-2 border-teal-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all placeholder-slate-400"
                  placeholder="••••••••"
                  required
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  aria-label="Password"
                />
              </div>
            </div>

            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2" htmlFor="confirmPassword">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-white text-slate-900 border-2 border-teal-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all placeholder-slate-400"
                    placeholder="••••••••"
                    required
                    autoComplete="new-password"
                    aria-label="Confirm password"
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="bg-rose-50 border-2 border-rose-200 rounded-xl p-3 flex items-start space-x-2" role="alert">
                <AlertCircle size={20} className="text-rose-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-rose-700">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 rounded-xl font-semibold text-white transition-all ${
                isLogin ? 'bg-teal-600 hover:bg-teal-700' : 'bg-rose-600 hover:bg-rose-700'
              } disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl`}
            >
              {loading ? 'Please wait...' : isLogin ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-sm text-slate-600 mt-6">
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
              }}
              className={`font-semibold ${isLogin ? 'text-rose-600 hover:text-rose-700' : 'text-teal-600 hover:text-teal-700'}`}
            >
              {isLogin ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </GlassCard>
      </div>
    </div>
  );
};

// Quick Stats Dashboard
const QuickStats = ({ goals, logs }) => {
  const stats = useMemo(() => {
    const totalGoals = goals.length;
    const completedGoals = goals.filter(g => {
      if (g.type === 'cumulative' || g.type === 'habit' || g.type === 'target') {
        return g.current >= g.target;
      }
      if (g.type === 'countdown') {
        return g.target - g.current <= 0;
      }
      if (g.type === 'personal-best' && g.bestValue !== null) {
        return g.higherIsBetter ? g.bestValue >= g.target : g.bestValue <= g.target;
      }
      return false;
    }).length;

    const today = new Date().toDateString();
    const logsToday = logs.filter(l => 
      new Date(l.timestamp.seconds * 1000).toDateString() === today
    ).length;

    const thisWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const logsThisWeek = logs.filter(l => 
      new Date(l.timestamp.seconds * 1000) >= thisWeek
    ).length;

    const averageProgress = goals.length > 0 
      ? goals.reduce((sum, g) => {
          if (g.type === 'cumulative' || g.type === 'habit' || g.type === 'target') {
            return sum + Math.min(100, (g.current / g.target) * 100);
          }
          return sum;
        }, 0) / goals.length
      : 0;

    return { totalGoals, completedGoals, logsToday, logsThisWeek, averageProgress };
  }, [goals, logs]);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
      <GlassCard className="p-4">
        <div className="flex items-center space-x-2 mb-2">
          <Target size={16} className="text-teal-600" />
          <span className="text-xs font-medium text-slate-600">Total Goals</span>
        </div>
        <p className="text-2xl font-bold text-slate-900">{stats.totalGoals}</p>
      </GlassCard>

      <GlassCard className="p-4">
        <div className="flex items-center space-x-2 mb-2">
          <CheckCircle2 size={16} className="text-teal-600" />
          <span className="text-xs font-medium text-slate-600">Completed</span>
        </div>
        <p className="text-2xl font-bold text-teal-700">{stats.completedGoals}</p>
      </GlassCard>

      <GlassCard className="p-4">
        <div className="flex items-center space-x-2 mb-2">
          <Activity size={16} className="text-cyan-600" />
          <span className="text-xs font-medium text-slate-600">Logged Today</span>
        </div>
        <p className="text-2xl font-bold text-cyan-700">{stats.logsToday}</p>
      </GlassCard>

      <GlassCard className="p-4">
        <div className="flex items-center space-x-2 mb-2">
          <Calendar size={16} className="text-rose-600" />
          <span className="text-xs font-medium text-slate-600">This Week</span>
        </div>
        <p className="text-2xl font-bold text-rose-700">{stats.logsThisWeek}</p>
      </GlassCard>

      <GlassCard className="p-4">
        <div className="flex items-center space-x-2 mb-2">
          <TrendingUp size={16} className="text-purple-600" />
          <span className="text-xs font-medium text-slate-600">Avg Progress</span>
        </div>
        <p className="text-2xl font-bold text-purple-700">{stats.averageProgress.toFixed(0)}%</p>
      </GlassCard>
    </div>
  );
};

// Recent Activity Feed
const RecentActivity = ({ logs, goals }) => {
  const recentLogs = useMemo(() => {
    return logs
      .sort((a, b) => b.timestamp.seconds - a.timestamp.seconds)
      .slice(0, 5)
      .map(log => {
        const goal = goals.find(g => g.id === log.goalId);
        return { ...log, goalName: goal?.name, goalUnit: goal?.unit };
      });
  }, [logs, goals]);

  if (recentLogs.length === 0) return null;

  return (
    <GlassCard className="p-6 mb-8">
      <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center space-x-2">
        <Activity size={20} className="text-teal-600" />
        <span>Recent Activity</span>
      </h3>
      <div className="space-y-3">
        {recentLogs.map(log => (
          <div key={log.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-900">{log.goalName}</p>
              <p className="text-xs text-slate-500">
                {new Date(log.timestamp.seconds * 1000).toLocaleDateString('en-GB', { 
                  month: 'short', 
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-teal-700">+{log.value} {log.goalUnit}</p>
              {log.notes && (
                <p className="text-xs text-slate-500 italic">{log.notes.substring(0, 30)}{log.notes.length > 30 ? '...' : ''}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
};

// Goal Templates Modal
const GoalTemplatesModal = ({ isOpen, onClose, onSelectTemplate }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Quick Start Templates" size="large">
      <p className="text-slate-600 mb-6">Choose a pre-configured goal template to get started quickly</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {GOAL_TEMPLATES.map((template, index) => (
          <button
            key={index}
            onClick={() => {
              onSelectTemplate(template);
              onClose();
            }}
            className="text-left p-4 border-2 border-teal-200 rounded-xl hover:bg-teal-50 hover:border-teal-400 transition-all group"
          >
            <div className="flex items-start space-x-3">
              <span className="text-3xl">{template.icon}</span>
              <div className="flex-1">
                <h4 className="font-bold text-slate-900 mb-1 group-hover:text-teal-700">{template.name}</h4>
                <p className="text-sm text-slate-600 capitalize">{template.type.replace('-', ' ')}</p>
                <p className="text-xs text-slate-500 mt-1">
                  Target: {template.target} {template.unit}
                  {template.trackStreak && ' • Daily Streak'}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>
      
      <div className="mt-6 p-4 bg-cyan-50 border-2 border-cyan-200 rounded-xl">
        <div className="flex items-start space-x-2">
          <Info size={18} className="text-cyan-700 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-cyan-800">
            Templates give you a head start. You can customise any values after creation.
          </p>
        </div>
      </div>
    </Modal>
  );
};

// Analytics View
const AnalyticsView = ({ goal, logs, onClose }) => {
  const analyticsData = useMemo(() => {
    if (!goal || !logs) return null;
    
    const goalLogs = logs
      .filter(l => l.goalId === goal.id)
      .sort((a, b) => a.timestamp.seconds - b.timestamp.seconds);
    
    const data = [];
    const today = new Date();
    const startOfYear = new Date(today.getFullYear(), 0, 1);
    let cumulative = 0;
    
    const logMap = {};
    goalLogs.forEach(log => {
      const dateKey = new Date(log.timestamp.seconds * 1000).toDateString();
      logMap[dateKey] = (logMap[dateKey] || 0) + Number(log.value);
    });
    
    const dayMs = 1000 * 60 * 60 * 24;
    const totalDays = Math.ceil((today - startOfYear) / dayMs);
    const targetPerDay = goal.target / 365;
    
    for (let i = 0; i <= totalDays; i++) {
      const currentDate = new Date(startOfYear.getTime() + (i * dayMs));
      const dateKey = currentDate.toDateString();
      if (logMap[dateKey]) cumulative += logMap[dateKey];
      
      data.push({
        dateLabel: currentDate.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' }),
        actual: cumulative,
        ideal: targetPerDay * (i + 1),
      });
    }
    
    const daysPassed = Math.max(1, totalDays);
    const actualPace = cumulative / daysPassed;
    const remaining = goal.target - cumulative;
    const requiredPace = Math.max(0, remaining / (365 - daysPassed));
    const isAhead = cumulative >= (targetPerDay * daysPassed);
    
    return { history: data, stats: { actualPace, requiredPace, isAhead, cumulative } };
  }, [goal, logs]);

  if (!analyticsData) return <div className="p-8 text-center text-slate-500">Loading analytics...</div>;
  
  const { history, stats } = analyticsData;

  return (
    <div className="animate-in slide-in-from-bottom-8 duration-500 flex flex-col h-full max-w-4xl mx-auto pb-8">
      <div className="grid grid-cols-2 gap-4 mb-8">
        <GlassCard className="p-6 !bg-teal-50 !border-teal-300">
          <div className="flex items-center space-x-2 mb-2 text-teal-700">
            <Zap size={16} />
            <span className="text-xs font-bold uppercase tracking-wider">Current Velocity</span>
          </div>
          <div className="flex items-baseline space-x-1">
            <span className="text-3xl font-bold text-teal-900 tracking-tight">{stats.actualPace.toFixed(2)}</span>
            <span className="text-sm text-teal-600">{goal.unit}/day</span>
          </div>
        </GlassCard>
        
        <GlassCard className="p-6 !bg-rose-50 !border-rose-300">
          <div className="flex items-center space-x-2 mb-2 text-rose-700">
            <Target size={16} />
            <span className="text-xs font-bold uppercase tracking-wider">Required Pace</span>
          </div>
          <div className="flex items-baseline space-x-1">
            <span className={`text-3xl font-bold tracking-tight ${stats.actualPace >= stats.requiredPace ? 'text-teal-700' : 'text-rose-700'}`}>
              {stats.requiredPace.toFixed(2)}
            </span>
            <span className="text-sm text-slate-600">{goal.unit}/day</span>
          </div>
        </GlassCard>
      </div>
      
      <div className={`flex-grow ${THEME.card} border-2 ${THEME.cardBorder} rounded-2xl p-6 mb-6 relative min-h-[300px]`}>
        <h4 className={`text-sm font-medium ${THEME.textMuted} mb-6`}>Growth Trajectory</h4>
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history}>
              <defs>
                <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={stats.isAhead ? '#14b8a6' : '#e11d48'} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={stats.isAhead ? '#14b8a6' : '#e11d48'} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={THEME.chart.grid} vertical={false} />
              <XAxis 
                dataKey="dateLabel" 
                stroke="#64748b" 
                tick={{fontSize: 11}} 
                tickLine={false} 
                axisLine={false} 
                dy={10} 
                minTickGap={30} 
              />
              <YAxis 
                stroke="#64748b" 
                tick={{fontSize: 11}} 
                tickLine={false} 
                axisLine={false} 
                dx={-10} 
                width={30} 
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: '#ffffff', 
                  borderColor: '#14b8a6', 
                  borderRadius: '12px', 
                  color: '#0f172a',
                  borderWidth: '2px'
                }}
                itemStyle={{color: '#0f172a'}}
                cursor={{stroke: '#14b8a620'}}
              />
              <Line 
                type="monotone" 
                dataKey="ideal" 
                stroke="#94a3b8" 
                strokeDasharray="4 4" 
                dot={false} 
                strokeWidth={2} 
              />
              <Area 
                type="monotone" 
                dataKey="actual" 
                stroke={stats.isAhead ? '#14b8a6' : '#e11d48'} 
                fill="url(#colorActual)" 
                strokeWidth={3} 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      <button 
        onClick={onClose} 
        className={`w-full py-4 border-2 ${THEME.cardBorder} ${THEME.textMain} rounded-2xl transition-colors font-medium hover:bg-teal-50`}
      >
        Close Analysis
      </button>
    </div>
  );
};

// Monthly Summary View
const MonthlySummaryView = ({ goals, logs, onClose }) => {
  const summaryData = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const startOfMonth = new Date(currentYear, currentMonth, 1);
    const endOfMonth = new Date(currentYear, currentMonth + 1, 0);
    
    const monthLogs = logs.filter(log => {
      const logDate = new Date(log.timestamp.seconds * 1000);
      return logDate >= startOfMonth && logDate <= endOfMonth;
    });
    
    const goalStats = goals.map(goal => {
      const goalMonthLogs = monthLogs.filter(l => l.goalId === goal.id);
      const monthTotal = goalMonthLogs.reduce((sum, log) => sum + Number(log.value), 0);
      const logCount = goalMonthLogs.length;
      
      return {
        ...goal,
        monthTotal,
        logCount,
        percentOfTarget: goal.target > 0 ? (goal.current / goal.target * 100) : 0
      };
    });
    
    return {
      month: now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
      totalLogs: monthLogs.length,
      goalStats: goalStats.sort((a, b) => b.monthTotal - a.monthTotal)
    };
  }, [goals, logs]);

  return (
    <div className="animate-in slide-in-from-right duration-500 max-w-4xl mx-auto">
      <div className="mb-8">
        <h2 className={`text-3xl font-bold ${THEME.textMain} mb-2`}>{summaryData.month} Summary</h2>
        <p className={THEME.textMuted}>You logged progress {summaryData.totalLogs} times this month</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {summaryData.goalStats.map(goal => (
          <GlassCard key={goal.id} className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className={`text-lg font-bold ${THEME.textMain}`}>{goal.name}</h3>
                <p className={`text-sm ${THEME.textMuted} capitalize`}>{goal.type.replace('-', ' ')}</p>
              </div>
              <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                goal.percentOfTarget >= 100 ? 'bg-teal-100 text-teal-700' :
                goal.percentOfTarget >= 50 ? 'bg-cyan-100 text-cyan-700' :
                'bg-rose-100 text-rose-700'
              }`}>
                {goal.percentOfTarget.toFixed(0)}%
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className={THEME.textMuted}>This month:</span>
                <span className={`font-semibold ${THEME.textMain}`}>+{goal.monthTotal} {goal.unit}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className={THEME.textMuted}>Total progress:</span>
                <span className={`font-semibold ${THEME.textMain}`}>{goal.current} / {goal.target} {goal.unit}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className={THEME.textMuted}>Logs this month:</span>
                <span className={`font-semibold ${THEME.textMain}`}>{goal.logCount}</span>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>
      
      <button 
        onClick={onClose} 
        className={`w-full py-4 ${THEME.primary} text-white rounded-2xl transition-colors font-medium`}
      >
        Back to Dashboard
      </button>
    </div>
  );
};

// Goal Card
const GoalCard = ({ goal, onLogClick, onAnalyzeClick, onEditClick, onDeleteClick }) => {
  const getProgressData = () => {
    switch (goal.type) {
      case 'cumulative':
      case 'habit':
      case 'average':
      case 'target': {
        const percent = Math.min(100, Math.max(0, (goal.current / goal.target) * 100));
        const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 1000 / 60 / 60 / 24);
        const expectedPercent = (dayOfYear / 365) * 100;
        const isAhead = percent >= expectedPercent;
        return { percent, isAhead, display: `${goal.current.toLocaleString()} / ${goal.target.toLocaleString()} ${goal.unit}` };
      }
      
      case 'personal-best': {
        const higherIsBetter = goal.higherIsBetter !== false;
        const hasBest = goal.bestValue !== null && goal.bestValue !== undefined;
        let percent = 0;
        let isAhead = false;
        
        if (hasBest) {
          if (higherIsBetter) {
            percent = Math.min(100, Math.max(0, (goal.bestValue / goal.target) * 100));
            isAhead = goal.bestValue >= goal.target;
          } else {
            const range = goal.current - goal.target;
            if (range > 0) {
              percent = Math.min(100, Math.max(0, ((goal.current - goal.bestValue) / range) * 100));
            }
            isAhead = goal.bestValue <= goal.target;
          }
        }
        
        const bestDisplay = hasBest 
          ? `Best: ${goal.bestValue} ${goal.unit}` 
          : `No PB yet (Target: ${goal.target} ${goal.unit})`;
        
        return { percent, isAhead, display: bestDisplay };
      }
      
      case 'countdown': {
        const remaining = goal.target - goal.current;
        const percent = Math.min(100, Math.max(0, (goal.current / goal.target) * 100));
        const isAhead = remaining <= 0;
        return { 
          percent, 
          isAhead, 
          display: isAhead 
            ? `Complete! 🎉` 
            : `${remaining.toLocaleString()} ${goal.unit} remaining`
        };
      }
      
      case 'maintain': {
        const minValue = goal.minValue || 0;
        const maxValue = goal.maxValue || goal.target;
        const inRange = goal.current >= minValue && goal.current <= maxValue;
        const percent = inRange ? 100 : 50;
        return { 
          percent, 
          isAhead: inRange, 
          display: `${goal.current} ${goal.unit} (${minValue}-${maxValue})`
        };
      }
      
      default:
        return { percent: 0, isAhead: false, display: `${goal.current} ${goal.unit}` };
    }
  };

  const { percent, isAhead, display } = getProgressData();
  
  const getTypeBadge = () => {
    switch (goal.type) {
      case 'personal-best':
        return <Trophy size={12} />;
      case 'countdown':
        return <TrendingDown size={12} />;
      case 'maintain':
        return <Target size={12} />;
      case 'habit':
        return <CheckSquare size={12} />;
      default:
        return <TrendingUp size={12} />;
    }
  };
  
  return (
    <GlassCard className="p-6 flex flex-col justify-between h-full group">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-1">
            <h3 className={`text-xl font-bold ${THEME.textMain} group-hover:text-teal-700 transition-colors`}>
              {goal.name}
            </h3>
            {isAhead && (
              <div className="bg-teal-100 text-teal-700 p-1 rounded-full">
                {getTypeBadge()}
              </div>
            )}
            {goal.trackStreak && goal.streak > 0 && (
              <div className="flex items-center space-x-1 bg-rose-100 text-rose-700 px-2 py-1 rounded-full">
                <Flame size={12} />
                <span className="text-xs font-bold">{goal.streak}</span>
              </div>
            )}
          </div>
          <p className={`text-sm ${THEME.textMuted} mb-1`}>
            {display}
          </p>
          <div className="flex items-center space-x-2">
            <p className="text-xs text-slate-500 capitalize">{goal.type.replace('-', ' ')}</p>
            {goal.type === 'personal-best' && goal.bestDate && (
              <p className="text-xs text-teal-600">
                • {new Date(goal.bestDate).toLocaleDateString('en-GB')}
              </p>
            )}
          </div>
        </div>
        <div className="flex space-x-1">
          <button 
            onClick={(e) => { e.stopPropagation(); onAnalyzeClick(goal); }} 
            className="p-2 rounded-xl bg-teal-50 hover:bg-teal-100 hover:text-teal-700 text-teal-600 transition-colors"
            aria-label="Analyse goal"
          >
            <BarChart2 size={16} />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onEditClick(goal); }} 
            className="p-2 rounded-xl bg-cyan-50 hover:bg-cyan-100 hover:text-cyan-700 text-cyan-600 transition-colors"
            aria-label="Edit goal"
          >
            <Edit2 size={16} />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onDeleteClick(goal); }} 
            className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 hover:text-rose-700 text-rose-600 transition-colors"
            aria-label="Delete goal"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      
      <div>
        <div className="w-full bg-slate-200 h-3 rounded-full mb-4 overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all duration-700 ease-out ${
              isAhead ? 'bg-gradient-to-r from-teal-400 to-cyan-500' : 'bg-gradient-to-r from-rose-400 to-red-500'
            }`}
            style={{ width: `${percent}%` }}
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
        <button 
          onClick={() => onLogClick(goal)} 
          className={`w-full py-3 rounded-xl font-semibold text-sm shadow-lg transition-all duration-300 ${THEME.primary} text-white hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center space-x-2`}
        >
          <Plus size={16} />
          <span>Log Progress</span>
        </button>
      </div>
    </GlassCard>
  );
};

// Main App Component
export default function App() {
  const [auth, setAuth] = useState(null);
  const [user, setUser] = useState(null);
  const [goals, setGoals] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [initError, setInitError] = useState(null);
  const [activeGoal, setActiveGoal] = useState(null);
  const [analyzingGoal, setAnalyzingGoal] = useState(null);
  const [editingGoal, setEditingGoal] = useState(null);
  const [deletingGoal, setDeletingGoal] = useState(null);
  const [showMonthlySummary, setShowMonthlySummary] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [logValue, setLogValue] = useState('');
  const [logNote, setLogNote] = useState('');
  const [isAddingGoal, setIsAddingGoal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [toasts, setToasts] = useState([]);
  const [lastLogId, setLastLogId] = useState(null);
  const [goalForm, setGoalForm] = useState({
    name: '',
    type: 'cumulative',
    target: '',
    unit: '',
    trackStreak: false,
    dueDate: '',
    higherIsBetter: true,
    minValue: '',
    maxValue: ''
  });
  const [db, setDb] = useState(null);

  // Toast management
  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Export data functionality
  const handleExportData = useCallback(() => {
    const exportData = {
      goals,
      logs: logs.map(log => ({
        ...log,
        timestamp: new Date(log.timestamp.seconds * 1000).toISOString()
      })),
      exportDate: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `2026-tracker-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    addToast('Data exported successfully!', 'success');
  }, [goals, logs, addToast]);

  // Undo last log
  const handleUndoLastLog = useCallback(async () => {
    if (!lastLogId || !user || !db) {
      addToast('No recent log to undo', 'error');
      return;
    }

    try {
      const userId = user.uid;
      const logToUndo = logs.find(l => l.id === lastLogId);
      
      if (!logToUndo) {
        addToast('Could not find log to undo', 'error');
        return;
      }

      const goal = goals.find(g => g.id === logToUndo.goalId);
      if (!goal) {
        addToast('Could not find associated goal', 'error');
        return;
      }

      // Delete the log
      await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/logs`, lastLogId));

      // Revert the goal progress
      let updateData = {};
      
      switch (goal.type) {
        case 'personal-best':
          // Find the previous best
          const remainingLogs = logs.filter(l => l.goalId === goal.id && l.id !== lastLogId);
          if (remainingLogs.length > 0) {
            const higherIsBetter = goal.higherIsBetter !== false;
            const sortedLogs = remainingLogs.sort((a, b) => 
              higherIsBetter ? b.value - a.value : a.value - b.value
            );
            updateData = {
              bestValue: sortedLogs[0].value,
              bestDate: new Date(sortedLogs[0].timestamp.seconds * 1000).toISOString(),
              current: sortedLogs[0].value
            };
          } else {
            updateData = { bestValue: null, bestDate: null, current: 0 };
          }
          break;
          
        case 'maintain':
          updateData = { current: increment(-logToUndo.value) };
          break;
          
        default:
          updateData = { current: increment(-logToUndo.value) };
      }

      await updateDoc(doc(db, `artifacts/${appId}/users/${userId}/goals`, goal.id), updateData);
      
      setLastLogId(null);
      addToast('Last log entry undone!', 'success');
    } catch (err) {
      console.error('Error undoing log:', err);
      addToast('Failed to undo log. Please try again.', 'error');
    }
  }, [lastLogId, user, db, logs, goals, addToast]);

  // Filtered goals based on search
  const filteredGoals = useMemo(() => {
    if (!searchQuery.trim()) return goals;
    const query = searchQuery.toLowerCase();
    return goals.filter(g => 
      g.name.toLowerCase().includes(query) || 
      g.type.toLowerCase().includes(query) ||
      g.unit.toLowerCase().includes(query)
    );
  }, [goals, searchQuery]);

  useEffect(() => {
    const init = async () => {
      if (!firebaseConfig.apiKey) {
        setInitError('Firebase configuration is missing. Please check your Vercel environment variables.');
        setLoading(false);
        return;
      }

      try {
        const app = initializeApp(firebaseConfig);
        const authInstance = getAuth(app);
        const firestore = getFirestore(app);
        
        setAuth(authInstance);
        setDb(firestore);

        const unsubscribe = onAuthStateChanged(authInstance, async (currentUser) => {
          console.log('Auth state changed:', currentUser ? 'User logged in' : 'No user');
          
          if (currentUser) {
            setUser(currentUser);
            const userId = currentUser.uid;
            
            const goalsPath = `artifacts/${appId}/users/${userId}/goals`;
            const logsPath = `artifacts/${appId}/users/${userId}/logs`;
            
            try {
              const unsubscribeGoals = onSnapshot(
                query(collection(firestore, goalsPath)), 
                (snapshot) => {
                  if (snapshot.empty) {
                    const batch = writeBatch(firestore);
                    INITIAL_GOALS.forEach(g => {
                      batch.set(doc(collection(firestore, goalsPath)), g);
                    });
                    batch.commit().catch(err => {
                      console.error('Error creating initial goals:', err);
                    });
                  } else {
                    setGoals(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
                  }
                  setLoading(false);
                },
                (err) => {
                  console.error('Error loading goals:', err);
                  setLoading(false);
                }
              );
              
              const unsubscribeLogs = onSnapshot(
                query(collection(firestore, logsPath), orderBy('timestamp', 'desc')), 
                (snapshot) => {
                  setLogs(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
                },
                (err) => {
                  console.error('Error loading logs:', err);
                }
              );
            } catch (err) {
              console.error('Error setting up listeners:', err);
              setLoading(false);
            }
          } else {
            setUser(null);
            setGoals([]);
            setLogs([]);
            setLoading(false);
          }
        }, (err) => {
          console.error('Auth state change error:', err);
          setInitError('Failed to check authentication status. Please refresh the page.');
          setLoading(false);
        });

        return () => unsubscribe();
      } catch (err) {
        console.error('Initialisation error:', err);
        setInitError('Failed to initialise the app. Please check your internet connection and refresh.');
        setLoading(false);
      }
    };
    
    init();
  }, []);

  const handleSignOut = async () => {
    try {
      await firebaseSignOut(auth);
      setGoals([]);
      setLogs([]);
      addToast('Signed out successfully', 'success');
    } catch (err) {
      console.error('Sign out error:', err);
      addToast('Failed to sign out. Please try again.', 'error');
    }
  };

  const handleLogSubmit = async (e) => {
    e.preventDefault();
    if (!user || !activeGoal || !logValue) return;
    
    const val = parseFloat(logValue);
    if (isNaN(val) || val <= 0) {
      addToast('Please enter a valid positive number', 'error');
      return;
    }
    
    const userId = user.uid;
    
    try {
      // Add log entry
      const logRef = await addDoc(collection(db, `artifacts/${appId}/users/${userId}/logs`), {
        goalId: activeGoal.id,
        value: val,
        notes: logNote,
        timestamp: Timestamp.now()
      });
      
      setLastLogId(logRef.id);
      
      // Handle different goal types
      let updateData = {};
      
      switch (activeGoal.type) {
        case 'personal-best': {
          const higherIsBetter = activeGoal.higherIsBetter !== false;
          const currentBest = activeGoal.bestValue;
          const isNewBest = currentBest === null || currentBest === undefined ||
            (higherIsBetter ? val > currentBest : val < currentBest);
          
          if (isNewBest) {
            updateData = {
              bestValue: val,
              bestDate: new Date().toISOString(),
              current: val
            };
            addToast(`🎉 New personal best! ${val} ${activeGoal.unit}`, 'success');
          } else {
            addToast(`Progress logged: ${val} ${activeGoal.unit}`, 'success');
          }
          break;
        }
        
        case 'countdown': {
          updateData = { current: increment(val) };
          const remaining = activeGoal.target - (activeGoal.current + val);
          if (remaining <= 0) {
            addToast(`🎊 Goal complete! You did it!`, 'success');
          } else {
            addToast(`Progress logged: ${remaining} ${activeGoal.unit} remaining`, 'success');
          }
          break;
        }
        
        case 'maintain': {
          updateData = { current: val };
          const inRange = val >= (activeGoal.minValue || 0) && val <= (activeGoal.maxValue || activeGoal.target);
          if (inRange) {
            addToast(`✅ Within target range: ${val} ${activeGoal.unit}`, 'success');
          } else {
            addToast(`⚠️ Outside target range: ${val} ${activeGoal.unit}`, 'info');
          }
          break;
        }
        
        default: {
          updateData = { current: increment(val) };
          const newTotal = activeGoal.current + val;
          const percentComplete = (newTotal / activeGoal.target * 100).toFixed(0);
          addToast(`Progress logged: ${val} ${activeGoal.unit} (${percentComplete}% complete)`, 'success');
        }
      }
      
      // Handle streak tracking
      if (activeGoal.trackStreak) {
        const today = new Date().toDateString();
        const lastLog = logs
          .filter(l => l.goalId === activeGoal.id)
          .sort((a, b) => b.timestamp.seconds - a.timestamp.seconds)[0];
        
        if (lastLog) {
          const lastLogDate = new Date(lastLog.timestamp.seconds * 1000).toDateString();
          const yesterday = new Date(Date.now() - 86400000).toDateString();
          
          if (lastLogDate === yesterday) {
            const newStreak = (activeGoal.streak || 0) + 1;
            updateData.streak = newStreak;
            if (newStreak % 7 === 0) {
              addToast(`🔥 ${newStreak} day streak! Amazing consistency!`, 'success');
            }
          } else if (lastLogDate !== today) {
            updateData.streak = 1;
          }
        } else {
          updateData.streak = 1;
        }
      }
      
      await updateDoc(doc(db, `artifacts/${appId}/users/${userId}/goals`, activeGoal.id), updateData);
      
      setLogValue('');
      setLogNote('');
      setActiveGoal(null);
    } catch (err) {
      console.error('Error logging progress:', err);
      addToast('Failed to log progress. Please try again.', 'error');
    }
  };

  const handleAddOrEditGoal = async (e) => {
    e.preventDefault();
    if (!user || !goalForm.name || !goalForm.target) return;
    
    const target = parseFloat(goalForm.target);
    if (isNaN(target) || target <= 0) {
      addToast('Please enter a valid positive target number', 'error');
      return;
    }
    
    const userId = user.uid;
    const goalData = {
      name: goalForm.name,
      type: goalForm.type,
      target: target,
      unit: goalForm.unit || 'units',
      trackStreak: goalForm.trackStreak,
      ...(goalForm.type === 'target' && goalForm.dueDate ? { dueDate: goalForm.dueDate } : {}),
      ...(goalForm.type === 'personal-best' ? { 
        higherIsBetter: goalForm.higherIsBetter,
        bestValue: editingGoal ? editingGoal.bestValue : null,
        bestDate: editingGoal ? editingGoal.bestDate : null
      } : {}),
      ...(goalForm.type === 'maintain' ? {
        minValue: parseFloat(goalForm.minValue) || 0,
        maxValue: parseFloat(goalForm.maxValue) || target
      } : {}),
      ...(editingGoal ? {} : { current: 0, streak: 0 })
    };
    
    try {
      if (editingGoal) {
        await updateDoc(doc(db, `artifacts/${appId}/users/${userId}/goals`, editingGoal.id), goalData);
        addToast('Goal updated successfully!', 'success');
      } else {
        await addDoc(collection(db, `artifacts/${appId}/users/${userId}/goals`), goalData);
        addToast('New goal created!', 'success');
      }
      
      setGoalForm({ 
        name: '', 
        type: 'cumulative', 
        target: '', 
        unit: '', 
        trackStreak: false, 
        dueDate: '',
        higherIsBetter: true,
        minValue: '',
        maxValue: ''
      });
      setIsAddingGoal(false);
      setEditingGoal(null);
    } catch (err) {
      console.error('Error saving goal:', err);
      addToast('Failed to save goal. Please try again.', 'error');
    }
  };

  const handleDeleteGoal = async () => {
    if (!deletingGoal || !user) return;
    
    const userId = user.uid;
    
    try {
      // Delete goal and its logs
      await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/goals`, deletingGoal.id));
      
      // Optionally delete associated logs
      const goalLogs = logs.filter(l => l.goalId === deletingGoal.id);
      const batch = writeBatch(db);
      goalLogs.forEach(log => {
        batch.delete(doc(db, `artifacts/${appId}/users/${userId}/logs`, log.id));
      });
      await batch.commit();
      
      setDeletingGoal(null);
      addToast(`Goal "${deletingGoal.name}" deleted`, 'success');
    } catch (err) {
      console.error('Error deleting goal:', err);
      addToast('Failed to delete goal. Please try again.', 'error');
    }
  };

  const openEditModal = (goal) => {
    setGoalForm({
      name: goal.name,
      type: goal.type,
      target: goal.target.toString(),
      unit: goal.unit,
      trackStreak: goal.trackStreak || false,
      dueDate: goal.dueDate || '',
      higherIsBetter: goal.higherIsBetter !== false,
      minValue: goal.minValue?.toString() || '',
      maxValue: goal.maxValue?.toString() || ''
    });
    setEditingGoal(goal);
  };

  const handleSelectTemplate = (template) => {
    setGoalForm({
      name: template.name,
      type: template.type,
      target: template.target.toString(),
      unit: template.unit,
      trackStreak: template.trackStreak || false,
      dueDate: '',
      higherIsBetter: template.higherIsBetter !== false,
      minValue: template.minValue?.toString() || '',
      maxValue: template.maxValue?.toString() || ''
    });
    setIsAddingGoal(true);
  };

  if (!user && !loading) {
    return <AuthScreen onAuth={auth} error={initError} />;
  }

  if (loading) {
    return (
      <div className={`min-h-screen ${THEME.bg} flex items-center justify-center`}>
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className={THEME.textMuted}>Loading your goals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${THEME.bg} ${THEME.textMain} font-sans pb-20`}>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      
      <header className={`sticky top-0 z-30 ${THEME.card} backdrop-blur-xl border-b-2 ${THEME.cardBorder} shadow-sm`}>
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-br from-teal-500 to-cyan-600 p-2 rounded-xl shadow-lg">
              <Sparkles size={20} className="text-white" />
            </div>
            <div>
              <h1 className={`text-lg font-bold ${THEME.textMain} tracking-tight`}>2026 Tracker</h1>
              <p className={`text-xs ${THEME.textMuted}`}>{user?.email || 'Pro Dashboard'}</p>
            </div>
          </div>
          <div className="flex space-x-2">
            {lastLogId && (
              <button 
                onClick={handleUndoLastLog} 
                className="p-3 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-xl transition-colors hover:shadow-lg"
                title="Undo Last Log"
                aria-label="Undo last log entry"
              >
                <Undo2 size={20} />
              </button>
            )}
            <button 
              onClick={handleExportData} 
              className="p-3 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-xl transition-colors hover:shadow-lg"
              title="Export Data"
              aria-label="Export data"
            >
              <Download size={20} />
            </button>
            <button 
              onClick={() => setShowMonthlySummary(true)} 
              className={`p-3 ${THEME.secondary} text-white rounded-xl transition-colors hover:shadow-lg`}
              title="Monthly Summary"
              aria-label="View monthly summary"
            >
              <Calendar size={20} />
            </button>
            <button 
              onClick={() => setShowTemplates(true)} 
              className="p-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl transition-colors hover:shadow-lg"
              title="Goal Templates"
              aria-label="Choose goal template"
            >
              <Sparkles size={20} />
            </button>
            <button 
              onClick={() => setIsAddingGoal(true)} 
              className={`p-3 ${THEME.primary} text-white rounded-xl transition-colors hover:shadow-lg`}
              title="Add Goal"
              aria-label="Add new goal"
            >
              <Plus size={20} />
            </button>
            <button 
              onClick={handleSignOut} 
              className="p-3 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl transition-colors"
              title="Sign Out"
              aria-label="Sign out"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <QuickStats goals={goals} logs={logs} />
        <RecentActivity logs={logs} goals={goals} />
        
        {goals.length > 3 && (
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="text"
                placeholder="Search goals by name, type or unit..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full pl-12 pr-4 py-3 ${THEME.card} border-2 ${THEME.cardBorder} rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all`}
                aria-label="Search goals"
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredGoals.map(goal => (
            <GoalCard 
              key={goal.id} 
              goal={goal} 
              onLogClick={setActiveGoal} 
              onAnalyzeClick={setAnalyzingGoal}
              onEditClick={openEditModal}
              onDeleteClick={setDeletingGoal}
            />
          ))}
          
          <button 
            onClick={() => setShowTemplates(true)} 
            className={`group flex flex-col items-center justify-center min-h-[240px] border-2 border-dashed ${THEME.cardBorder} rounded-2xl hover:bg-teal-50 hover:border-teal-400 transition-all duration-300`}
            aria-label="Create new goal"
          >
            <div className="w-14 h-14 bg-teal-100 rounded-full flex items-center justify-center text-teal-600 group-hover:text-teal-700 group-hover:scale-110 transition-all">
              <Plus size={24} />
            </div>
            <span className={`mt-4 text-sm font-medium ${THEME.textMuted} group-hover:text-teal-700`}>
              Create New Goal
            </span>
          </button>
        </div>

        {searchQuery && filteredGoals.length === 0 && (
          <div className="text-center py-12">
            <Search size={48} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-600">No goals found matching "{searchQuery}"</p>
            <button 
              onClick={() => setSearchQuery('')}
              className="mt-4 text-teal-600 hover:text-teal-700 font-medium"
            >
              Clear search
            </button>
          </div>
        )}
      </main>

      {/* Goal Templates Modal */}
      <GoalTemplatesModal 
        isOpen={showTemplates}
        onClose={() => setShowTemplates(false)}
        onSelectTemplate={handleSelectTemplate}
      />

      {/* Log Progress Modal */}
      <Modal 
        isOpen={!!activeGoal} 
        onClose={() => setActiveGoal(null)} 
        title={`Log ${activeGoal?.name}`}
      >
        <form onSubmit={handleLogSubmit}>
          <div className="mb-6">
            <label className={`block text-xs font-bold ${THEME.textMuted} uppercase mb-2`} htmlFor="logValue">
              Value
            </label>
            <div className="relative">
              <input 
                id="logValue"
                type="number" 
                step="any" 
                autoFocus 
                placeholder="0.0" 
                className={`w-full ${THEME.card} border-2 ${THEME.cardBorder} rounded-xl p-4 text-3xl font-bold ${THEME.textMain} focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all placeholder-slate-400`}
                value={logValue} 
                onChange={(e) => setLogValue(e.target.value)} 
                required
                aria-label="Progress value"
              />
              <span className={`absolute right-4 top-1/2 -translate-y-1/2 ${THEME.textMuted} font-medium`}>
                {activeGoal?.unit}
              </span>
            </div>
            {activeGoal?.type === 'personal-best' && (
              <p className="text-xs text-slate-500 mt-2">
                {activeGoal.higherIsBetter !== false 
                  ? 'Enter a higher value to set a new personal best' 
                  : 'Enter a lower value to set a new personal best'}
              </p>
            )}
          </div>
          
          <div className="mb-6">
            <label className={`block text-xs font-bold ${THEME.textMuted} uppercase mb-2`} htmlFor="logNote">
              Note (optional)
            </label>
            <textarea 
              id="logNote"
              rows="2" 
              placeholder="Quick note..." 
              className={`w-full ${THEME.card} border-2 ${THEME.cardBorder} rounded-xl p-4 text-sm ${THEME.textMain} focus:ring-2 focus:ring-teal-500 outline-none transition-all resize-none`}
              value={logNote} 
              onChange={(e) => setLogNote(e.target.value)}
              aria-label="Optional note"
            />
          </div>
          
          <button 
            type="submit" 
            disabled={!logValue} 
            className={`w-full ${THEME.primary} text-white font-bold py-4 rounded-xl transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-xl`}
          >
            Update Progress
          </button>
        </form>
      </Modal>

      {/* Add/Edit Goal Modal */}
      <Modal 
        isOpen={isAddingGoal || !!editingGoal} 
        onClose={() => { 
          setIsAddingGoal(false); 
          setEditingGoal(null); 
          setGoalForm({ 
            name: '', 
            type: 'cumulative', 
            target: '', 
            unit: '', 
            trackStreak: false, 
            dueDate: '',
            higherIsBetter: true,
            minValue: '',
            maxValue: ''
          }); 
        }} 
        title={editingGoal ? "Edit Goal" : "New Goal"}
        size="default"
      >
        <form onSubmit={handleAddOrEditGoal} className="space-y-5">
          <div>
            <label className={`block text-xs font-bold ${THEME.textMuted} uppercase mb-2`} htmlFor="goalName">
              Goal Name
            </label>
            <input 
              id="goalName"
              className={`w-full ${THEME.card} border-2 ${THEME.cardBorder} rounded-xl p-4 ${THEME.textMain} focus:ring-2 focus:ring-teal-500 outline-none`}
              placeholder="Run 1000km" 
              value={goalForm.name} 
              onChange={e => setGoalForm({...goalForm, name: e.target.value})} 
              required 
              aria-label="Goal name"
            />
          </div>
          
          <div>
            <label className={`block text-xs font-bold ${THEME.textMuted} uppercase mb-2`} htmlFor="goalType">
              Goal Type
            </label>
            <select
              id="goalType"
              className={`w-full ${THEME.card} border-2 ${THEME.cardBorder} rounded-xl p-4 ${THEME.textMain} focus:ring-2 focus:ring-teal-500 outline-none`}
              value={goalForm.type}
              onChange={e => setGoalForm({...goalForm, type: e.target.value})}
              aria-label="Goal type"
            >
              {GOAL_TYPES.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label} - {type.description}
                </option>
              ))}
            </select>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`block text-xs font-bold ${THEME.textMuted} uppercase mb-2`} htmlFor="goalTarget">
                Target
              </label>
              <input 
                id="goalTarget"
                type="number" 
                step="any"
                className={`w-full ${THEME.card} border-2 ${THEME.cardBorder} rounded-xl p-4 ${THEME.textMain} focus:ring-2 focus:ring-teal-500 outline-none`}
                placeholder="1000" 
                value={goalForm.target} 
                onChange={e => setGoalForm({...goalForm, target: e.target.value})} 
                required
                aria-label="Target value"
              />
            </div>
            
            <div>
              <label className={`block text-xs font-bold ${THEME.textMuted} uppercase mb-2`} htmlFor="goalUnit">
                Unit
              </label>
              <input 
                id="goalUnit"
                className={`w-full ${THEME.card} border-2 ${THEME.cardBorder} rounded-xl p-4 ${THEME.textMain} focus:ring-2 focus:ring-teal-500 outline-none`}
                placeholder="km" 
                value={goalForm.unit} 
                onChange={e => setGoalForm({...goalForm, unit: e.target.value})}
                aria-label="Unit of measurement"
              />
            </div>
          </div>
          
          {goalForm.type === 'target' && (
            <div>
              <label className={`block text-xs font-bold ${THEME.textMuted} uppercase mb-2`} htmlFor="dueDate">
                Due Date
              </label>
              <input 
                id="dueDate"
                type="date"
                className={`w-full ${THEME.card} border-2 ${THEME.cardBorder} rounded-xl p-4 ${THEME.textMain} focus:ring-2 focus:ring-teal-500 outline-none`}
                value={goalForm.dueDate} 
                onChange={e => setGoalForm({...goalForm, dueDate: e.target.value})}
                aria-label="Due date"
              />
            </div>
          )}
          
          {goalForm.type === 'personal-best' && (
            <div className="flex items-center space-x-3">
              <input 
                type="checkbox"
                id="higherIsBetter"
                className="w-5 h-5 text-teal-600 border-2 border-teal-300 rounded focus:ring-teal-500"
                checked={goalForm.higherIsBetter}
                onChange={e => setGoalForm({...goalForm, higherIsBetter: e.target.checked})}
              />
              <label htmlFor="higherIsBetter" className={`text-sm font-medium ${THEME.textMain} cursor-pointer`}>
                Higher is better (uncheck for golf/time goals where lower is better)
              </label>
            </div>
          )}
          
          {goalForm.type === 'maintain' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={`block text-xs font-bold ${THEME.textMuted} uppercase mb-2`} htmlFor="minValue">
                  Min Value
                </label>
                <input 
                  id="minValue"
                  type="number" 
                  step="any"
                  className={`w-full ${THEME.card} border-2 ${THEME.cardBorder} rounded-xl p-4 ${THEME.textMain} focus:ring-2 focus:ring-teal-500 outline-none`}
                  placeholder="70" 
                  value={goalForm.minValue} 
                  onChange={e => setGoalForm({...goalForm, minValue: e.target.value})}
                  aria-label="Minimum value"
                />
              </div>
              <div>
                <label className={`block text-xs font-bold ${THEME.textMuted} uppercase mb-2`} htmlFor="maxValue">
                  Max Value
                </label>
                <input 
                  id="maxValue"
                  type="number" 
                  step="any"
                  className={`w-full ${THEME.card} border-2 ${THEME.cardBorder} rounded-xl p-4 ${THEME.textMain} focus:ring-2 focus:ring-teal-500 outline-none`}
                  placeholder="75" 
                  value={goalForm.maxValue} 
                  onChange={e => setGoalForm({...goalForm, maxValue: e.target.value})}
                  aria-label="Maximum value"
                />
              </div>
            </div>
          )}
          
          <div className="flex items-center space-x-3">
            <input 
              type="checkbox"
              id="trackStreak"
              className="w-5 h-5 text-teal-600 border-2 border-teal-300 rounded focus:ring-teal-500"
              checked={goalForm.trackStreak}
              onChange={e => setGoalForm({...goalForm, trackStreak: e.target.checked})}
            />
            <label htmlFor="trackStreak" className={`text-sm font-medium ${THEME.textMain} cursor-pointer`}>
              Track daily streak
            </label>
          </div>
          
          <button 
            type="submit" 
            className={`w-full ${THEME.primary} text-white font-bold py-4 rounded-xl mt-2 transition-colors shadow-lg hover:shadow-xl`}
          >
            {editingGoal ? 'Save Changes' : 'Create Goal'}
          </button>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deletingGoal}
        onClose={() => setDeletingGoal(null)}
        title="Delete Goal?"
        size="small"
      >
        <div className="text-center">
          <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Trash2 size={32} className="text-rose-600" />
          </div>
          <h3 className={`text-lg font-bold ${THEME.textMain} mb-2`}>
            Are you sure you want to delete "{deletingGoal?.name}"?
          </h3>
          <p className={`${THEME.textMuted} mb-6`}>
            This will permanently delete the goal and all its progress logs. This action cannot be undone.
          </p>
          <div className="flex space-x-3">
            <button
              onClick={() => setDeletingGoal(null)}
              className={`flex-1 py-3 border-2 ${THEME.cardBorder} ${THEME.textMain} rounded-xl font-medium hover:bg-teal-50`}
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteGoal}
              className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-medium"
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>

      {/* Analytics View */}
      {analyzingGoal && (
        <div className={`fixed inset-0 ${THEME.bg} z-50 flex flex-col animate-in slide-in-from-right duration-300`}>
          <div className={`flex items-center justify-between px-6 py-4 border-b-2 ${THEME.cardBorder} ${THEME.card} backdrop-blur-md`}>
            <button 
              onClick={() => setAnalyzingGoal(null)} 
              className={`flex items-center ${THEME.textMuted} hover:text-teal-700 transition-colors`}
              aria-label="Back to dashboard"
            >
              <div className="p-2 rounded-full bg-teal-50 mr-3">
                <ChevronRight className="rotate-180" size={20} />
              </div>
              <span className="font-medium">Back to Dashboard</span>
            </button>
            <div className="text-right">
              <h2 className={`text-lg font-bold ${THEME.textMain} tracking-tight`}>
                {analyzingGoal.name}
              </h2>
            </div>
          </div>
          <div className="flex-grow p-6 overflow-y-auto">
            <AnalyticsView 
              goal={analyzingGoal} 
              logs={logs} 
              onClose={() => setAnalyzingGoal(null)} 
            />
          </div>
        </div>
      )}

      {/* Monthly Summary View */}
      {showMonthlySummary && (
        <div className={`fixed inset-0 ${THEME.bg} z-50 flex flex-col animate-in slide-in-from-right duration-300`}>
          <div className={`flex items-center justify-between px-6 py-4 border-b-2 ${THEME.cardBorder} ${THEME.card} backdrop-blur-md`}>
            <button 
              onClick={() => setShowMonthlySummary(false)} 
              className={`flex items-center ${THEME.textMuted} hover:text-teal-700 transition-colors`}
              aria-label="Back to dashboard"
            >
              <div className="p-2 rounded-full bg-teal-50 mr-3">
                <ChevronRight className="rotate-180" size={20} />
              </div>
              <span className="font-medium">Back to Dashboard</span>
            </button>
            <div className="p-2 rounded-full bg-teal-100">
              <Calendar size={20} className="text-teal-700" />
            </div>
          </div>
          <div className="flex-grow p-6 overflow-y-auto">
            <MonthlySummaryView 
              goals={goals} 
              logs={logs} 
              onClose={() => setShowMonthlySummary(false)} 
            />
          </div>
        </div>
      )}
    </div>
  );
}

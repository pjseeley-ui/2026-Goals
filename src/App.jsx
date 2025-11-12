import React, { useState, useEffect, useMemo } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, BarChart, Bar
} from 'recharts';
import { 
  Activity, Calendar, AlertCircle, CheckCircle2, 
  Target, Plus, X, BarChart2, ChevronRight, Sparkles,
  Zap, Trophy, TrendingUp, Book, DollarSign, Clock,
  Edit2, Trash2, Award, Flame, CheckSquare, TrendingDown,
  LogOut, Mail, Lock, User
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
  writeBatch, query, Timestamp, increment, deleteDoc, setDoc
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
];

// Goal type options
const GOAL_TYPES = [
  { value: 'cumulative', label: 'Cumulative', description: 'Add up progress over time (e.g., distance, money)' },
  { value: 'habit', label: 'Daily Habit', description: 'Track yes/no completion each day' },
  { value: 'target', label: 'Target Date', description: 'Complete by a specific date' },
  { value: 'average', label: 'Average', description: 'Maintain an average per week/month' },
];

// Components
const GlassCard = ({ children, className = "", onClick }) => (
  <div 
    onClick={onClick}
    className={`relative ${THEME.card} border-2 ${THEME.cardBorder} rounded-2xl shadow-lg overflow-hidden transition-all duration-300 hover:shadow-xl hover:border-teal-300 ${className}`}
  >
    {children}
  </div>
);

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4 animate-in fade-in duration-300">
      <div className={`${THEME.card} border-t sm:border-2 border-teal-300 rounded-t-2xl sm:rounded-2xl w-full max-w-2xl shadow-2xl transform transition-all scale-100 overflow-hidden`}>
        <div className={`flex justify-between items-center p-6 border-b-2 border-teal-100 ${THEME.bg}`}>
          <h3 className={`text-xl font-bold ${THEME.textMain} tracking-tight`}>{title}</h3>
          <button onClick={onClose} className={`p-2 rounded-full hover:bg-teal-100 ${THEME.textMuted} hover:text-teal-700 transition-colors`}>
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

// Login/Signup Screen - FIXED TEXT COLORS
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
                <p className="text-sm font-semibold text-rose-700 mb-1">Initialization Error</p>
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
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white text-slate-900 border-2 border-teal-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all placeholder-slate-400"
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white text-slate-900 border-2 border-teal-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all placeholder-slate-400"
                  placeholder="••••••••"
                  required
                  autoComplete={isLogin ? "current-password" : "new-password"}
                />
              </div>
            </div>

            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-white text-slate-900 border-2 border-teal-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all placeholder-slate-400"
                    placeholder="••••••••"
                    required
                    autoComplete="new-password"
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="bg-rose-50 border-2 border-rose-200 rounded-xl p-3 flex items-start space-x-2">
                <AlertCircle size={20} className="text-rose-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-rose-700">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 rounded-xl font-semibold text-white transition-all ${
                isLogin ? 'bg-teal-600 hover:bg-teal-700' : 'bg-rose-600 hover:bg-rose-700'
              } disabled:opacity-50 disabled:cursor-not-allowed shadow-lg`}
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
                <p className={`text-sm ${THEME.textMuted}`}>{goal.type}</p>
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
  const percent = Math.min(100, Math.max(0, (goal.current / goal.target) * 100));
  const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 1000 / 60 / 60 / 24);
  const expectedPercent = (dayOfYear / 365) * 100;
  const isAhead = percent >= expectedPercent;
  
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
                <TrendingUp size={12} />
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
            <span className={`${THEME.textMain} font-semibold`}>{goal.current.toLocaleString()}</span>
            <span className="mx-1 text-slate-400">/</span>
            {goal.target.toLocaleString()} {goal.unit}
          </p>
          <p className="text-xs text-slate-500 capitalize">{goal.type}</p>
        </div>
        <div className="flex space-x-1">
          <button 
            onClick={(e) => { e.stopPropagation(); onAnalyzeClick(goal); }} 
            className="p-2 rounded-xl bg-teal-50 hover:bg-teal-100 hover:text-teal-700 text-teal-600 transition-colors"
          >
            <BarChart2 size={16} />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onEditClick(goal); }} 
            className="p-2 rounded-xl bg-cyan-50 hover:bg-cyan-100 hover:text-cyan-700 text-cyan-600 transition-colors"
          >
            <Edit2 size={16} />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onDeleteClick(goal); }} 
            className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 hover:text-rose-700 text-rose-600 transition-colors"
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
  const [logValue, setLogValue] = useState('');
  const [logNote, setLogNote] = useState('');
  const [isAddingGoal, setIsAddingGoal] = useState(false);
  const [goalForm, setGoalForm] = useState({
    name: '',
    type: 'cumulative',
    target: '',
    unit: '',
    trackStreak: false,
    dueDate: ''
  });
  const [db, setDb] = useState(null);

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
                query(collection(firestore, logsPath)), 
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
        console.error('Initialization error:', err);
        setInitError('Failed to initialize the app. Please check your internet connection and refresh.');
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
    } catch (err) {
      console.error('Sign out error:', err);
      alert('Failed to sign out. Please try again.');
    }
  };

  const handleLogSubmit = async (e) => {
    e.preventDefault();
    if (!user || !activeGoal || !logValue) return;
    
    const val = parseFloat(logValue);
    if (isNaN(val) || val <= 0) {
      alert('Please enter a valid positive number');
      return;
    }
    
    const userId = user.uid;
    
    try {
      await addDoc(collection(db, `artifacts/${appId}/users/${userId}/logs`), {
        goalId: activeGoal.id,
        value: val,
        notes: logNote,
        timestamp: Timestamp.now()
      });
      
      let streakUpdate = {};
      if (activeGoal.trackStreak) {
        const today = new Date().toDateString();
        const lastLog = logs
          .filter(l => l.goalId === activeGoal.id)
          .sort((a, b) => b.timestamp.seconds - a.timestamp.seconds)[0];
        
        if (lastLog) {
          const lastLogDate = new Date(lastLog.timestamp.seconds * 1000).toDateString();
          const yesterday = new Date(Date.now() - 86400000).toDateString();
          
          if (lastLogDate === yesterday) {
            streakUpdate = { streak: (activeGoal.streak || 0) + 1 };
          } else if (lastLogDate !== today) {
            streakUpdate = { streak: 1 };
          }
        } else {
          streakUpdate = { streak: 1 };
        }
      }
      
      await updateDoc(doc(db, `artifacts/${appId}/users/${userId}/goals`, activeGoal.id), {
        current: increment(val),
        ...streakUpdate
      });
      
      setLogValue('');
      setLogNote('');
      setActiveGoal(null);
    } catch (err) {
      console.error('Error logging progress:', err);
      alert('Failed to log progress. Please try again.');
    }
  };

  const handleAddOrEditGoal = async (e) => {
    e.preventDefault();
    if (!user || !goalForm.name || !goalForm.target) return;
    
    const target = parseFloat(goalForm.target);
    if (isNaN(target) || target <= 0) {
      alert('Please enter a valid positive target number');
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
      ...(editingGoal ? {} : { current: 0, streak: 0 })
    };
    
    try {
      if (editingGoal) {
        await updateDoc(doc(db, `artifacts/${appId}/users/${userId}/goals`, editingGoal.id), goalData);
      } else {
        await addDoc(collection(db, `artifacts/${appId}/users/${userId}/goals`), goalData);
      }
      
      setGoalForm({ name: '', type: 'cumulative', target: '', unit: '', trackStreak: false, dueDate: '' });
      setIsAddingGoal(false);
      setEditingGoal(null);
    } catch (err) {
      console.error('Error saving goal:', err);
      alert('Failed to save goal. Please try again.');
    }
  };

  const handleDeleteGoal = async () => {
    if (!deletingGoal || !user) return;
    
    const userId = user.uid;
    
    try {
      await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/goals`, deletingGoal.id));
      setDeletingGoal(null);
    } catch (err) {
      console.error('Error deleting goal:', err);
      alert('Failed to delete goal. Please try again.');
    }
  };

  const openEditModal = (goal) => {
    setGoalForm({
      name: goal.name,
      type: goal.type,
      target: goal.target.toString(),
      unit: goal.unit,
      trackStreak: goal.trackStreak || false,
      dueDate: goal.dueDate || ''
    });
    setEditingGoal(goal);
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
            <button 
              onClick={() => setShowMonthlySummary(true)} 
              className={`p-3 ${THEME.secondary} text-white rounded-xl transition-colors hover:shadow-lg`}
              title="Monthly Summary"
            >
              <Calendar size={20} />
            </button>
            <button 
              onClick={() => setIsAddingGoal(true)} 
              className={`p-3 ${THEME.primary} text-white rounded-xl transition-colors hover:shadow-lg`}
              title="Add Goal"
            >
              <Plus size={20} />
            </button>
            <button 
              onClick={handleSignOut} 
              className="p-3 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl transition-colors"
              title="Sign Out"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {goals.map(goal => (
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
            onClick={() => setIsAddingGoal(true)} 
            className={`group flex flex-col items-center justify-center min-h-[240px] border-2 border-dashed ${THEME.cardBorder} rounded-2xl hover:bg-teal-50 hover:border-teal-400 transition-all duration-300`}
          >
            <div className="w-14 h-14 bg-teal-100 rounded-full flex items-center justify-center text-teal-600 group-hover:text-teal-700 group-hover:scale-110 transition-all">
              <Plus size={24} />
            </div>
            <span className={`mt-4 text-sm font-medium ${THEME.textMuted} group-hover:text-teal-700`}>
              Create New Goal
            </span>
          </button>
        </div>
      </main>

      <Modal 
        isOpen={!!activeGoal} 
        onClose={() => setActiveGoal(null)} 
        title={`Log ${activeGoal?.name}`}
      >
        <form onSubmit={handleLogSubmit}>
          <div className="mb-6">
            <label className={`block text-xs font-bold ${THEME.textMuted} uppercase mb-2`}>
              Value
            </label>
            <div className="relative">
              <input 
                type="number" 
                step="any" 
                autoFocus 
                placeholder="0.0" 
                className={`w-full ${THEME.card} border-2 ${THEME.cardBorder} rounded-xl p-4 text-3xl font-bold ${THEME.textMain} focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all placeholder-slate-400`}
                value={logValue} 
                onChange={(e) => setLogValue(e.target.value)} 
                required
              />
              <span className={`absolute right-4 top-1/2 -translate-y-1/2 ${THEME.textMuted} font-medium`}>
                {activeGoal?.unit}
              </span>
            </div>
          </div>
          
          <div className="mb-6">
            <label className={`block text-xs font-bold ${THEME.textMuted} uppercase mb-2`}>
              Note (optional)
            </label>
            <textarea 
              rows="2" 
              placeholder="Quick note..." 
              className={`w-full ${THEME.card} border-2 ${THEME.cardBorder} rounded-xl p-4 text-sm ${THEME.textMain} focus:ring-2 focus:ring-teal-500 outline-none transition-all resize-none`}
              value={logNote} 
              onChange={(e) => setLogNote(e.target.value)} 
            />
          </div>
          
          <button 
            type="submit" 
            disabled={!logValue} 
            className={`w-full ${THEME.primary} text-white font-bold py-4 rounded-xl transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            Update Progress
          </button>
        </form>
      </Modal>

      <Modal 
        isOpen={isAddingGoal || !!editingGoal} 
        onClose={() => { setIsAddingGoal(false); setEditingGoal(null); setGoalForm({ name: '', type: 'cumulative', target: '', unit: '', trackStreak: false, dueDate: '' }); }} 
        title={editingGoal ? "Edit Goal" : "New Goal"}
      >
        <form onSubmit={handleAddOrEditGoal} className="space-y-5">
          <div>
            <label className={`block text-xs font-bold ${THEME.textMuted} uppercase mb-2`}>
              Goal Name
            </label>
            <input 
              className={`w-full ${THEME.card} border-2 ${THEME.cardBorder} rounded-xl p-4 ${THEME.textMain} focus:ring-2 focus:ring-teal-500 outline-none`}
              placeholder="Run 1000km" 
              value={goalForm.name} 
              onChange={e => setGoalForm({...goalForm, name: e.target.value})} 
              required 
            />
          </div>
          
          <div>
            <label className={`block text-xs font-bold ${THEME.textMuted} uppercase mb-2`}>
              Goal Type
            </label>
            <select
              className={`w-full ${THEME.card} border-2 ${THEME.cardBorder} rounded-xl p-4 ${THEME.textMain} focus:ring-2 focus:ring-teal-500 outline-none`}
              value={goalForm.type}
              onChange={e => setGoalForm({...goalForm, type: e.target.value})}
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
              <label className={`block text-xs font-bold ${THEME.textMuted} uppercase mb-2`}>
                Target
              </label>
              <input 
                type="number" 
                step="any"
                className={`w-full ${THEME.card} border-2 ${THEME.cardBorder} rounded-xl p-4 ${THEME.textMain} focus:ring-2 focus:ring-teal-500 outline-none`}
                placeholder="1000" 
                value={goalForm.target} 
                onChange={e => setGoalForm({...goalForm, target: e.target.value})} 
                required 
              />
            </div>
            
            <div>
              <label className={`block text-xs font-bold ${THEME.textMuted} uppercase mb-2`}>
                Unit
              </label>
              <input 
                className={`w-full ${THEME.card} border-2 ${THEME.cardBorder} rounded-xl p-4 ${THEME.textMain} focus:ring-2 focus:ring-teal-500 outline-none`}
                placeholder="km" 
                value={goalForm.unit} 
                onChange={e => setGoalForm({...goalForm, unit: e.target.value})} 
              />
            </div>
          </div>
          
          {goalForm.type === 'target' && (
            <div>
              <label className={`block text-xs font-bold ${THEME.textMuted} uppercase mb-2`}>
                Due Date
              </label>
              <input 
                type="date"
                className={`w-full ${THEME.card} border-2 ${THEME.cardBorder} rounded-xl p-4 ${THEME.textMain} focus:ring-2 focus:ring-teal-500 outline-none`}
                value={goalForm.dueDate} 
                onChange={e => setGoalForm({...goalForm, dueDate: e.target.value})} 
              />
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
            className={`w-full ${THEME.primary} text-white font-bold py-4 rounded-xl mt-2 transition-colors shadow-lg`}
          >
            {editingGoal ? 'Save Changes' : 'Create Goal'}
          </button>
        </form>
      </Modal>

      <Modal
        isOpen={!!deletingGoal}
        onClose={() => setDeletingGoal(null)}
        title="Delete Goal?"
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

      {analyzingGoal && (
        <div className={`fixed inset-0 ${THEME.bg} z-50 flex flex-col animate-in slide-in-from-right duration-300`}>
          <div className={`flex items-center justify-between px-6 py-4 border-b-2 ${THEME.cardBorder} ${THEME.card} backdrop-blur-md`}>
            <button 
              onClick={() => setAnalyzingGoal(null)} 
              className={`flex items-center ${THEME.textMuted} hover:text-teal-700 transition-colors`}
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

      {showMonthlySummary && (
        <div className={`fixed inset-0 ${THEME.bg} z-50 flex flex-col animate-in slide-in-from-right duration-300`}>
          <div className={`flex items-center justify-between px-6 py-4 border-b-2 ${THEME.cardBorder} ${THEME.card} backdrop-blur-md`}>
            <button 
              onClick={() => setShowMonthlySummary(false)} 
              className={`flex items-center ${THEME.textMuted} hover:text-teal-700 transition-colors`}
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

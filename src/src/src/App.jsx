import React, { useState, useEffect, useMemo } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import { 
  Activity, Calendar, AlertCircle, CheckCircle2, 
  Target, Plus, X, BarChart2, ChevronRight, Sparkles,
  Zap, Trophy, TrendingUp, Book, DollarSign, Clock
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, signInAnonymously, onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, collection, doc, onSnapshot, updateDoc, addDoc, 
  writeBatch, query, Timestamp, increment 
} from 'firebase/firestore';

// Firebase configuration will be loaded from Vercel environment variables
const firebaseConfig = JSON.parse(import.meta.env.VITE_FIREBASE_CONFIG || '{}');
const appId = import.meta.env.VITE_APP_ID || 'default-app';

// Theme colors
const THEME = {
  bg: "bg-slate-950",
  card: "bg-slate-900/50",
  cardBorder: "border-white/5",
  textMain: "text-slate-100",
  textMuted: "text-slate-400",
  accent: "from-indigo-500 via-purple-500 to-pink-500",
  success: "text-emerald-400",
  danger: "text-rose-400",
  chart: {
    stroke: "#818cf8",
    fill: "#818cf8",
    grid: "#ffffff10"
  }
};

// Initial goals that will be created for new users
const INITIAL_GOALS = [
  { name: 'Running', type: 'cumulative', target: 1000, current: 0, unit: 'km', icon: 'activity' },
  { name: 'Reading', type: 'cumulative', target: 24, current: 0, unit: 'books', icon: 'book' },
  { name: 'Savings', type: 'cumulative', target: 20000, current: 0, unit: '£', icon: 'dollar' },
];

// Reusable glass-effect card component
const GlassCard = ({ children, className = "", onClick }) => (
  <div 
    onClick={onClick}
    className={`relative backdrop-blur-md ${THEME.card} border ${THEME.cardBorder} rounded-3xl shadow-2xl overflow-hidden transition-all duration-300 hover:bg-slate-800/50 hover:border-white/10 active:scale-[0.99] ${className}`}
  >
    {children}
  </div>
);

// Modal dialogue component
const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-end sm:items-center justify-center sm:p-4 animate-in fade-in duration-300">
      <div className="bg-slate-900 border-t sm:border border-white/10 rounded-t-3xl sm:rounded-3xl w-full max-w-md shadow-2xl transform transition-all scale-100 overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b border-white/5 bg-white/5">
          <h3 className="text-xl font-bold text-white tracking-tight">{title}</h3>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 pb-10 sm:pb-6">
          {children}
        </div>
      </div>
    </div>
  );
};

// Analytics view showing progress charts
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

  if (!analyticsData) return <div className="p-8 text-centre text-slate-500">Loading analytics...</div>;
  
  const { history, stats } = analyticsData;

  return (
    <div className="animate-in slide-in-from-bottom-8 duration-500 flex flex-col h-full max-w-4xl mx-auto pb-8">
      <div className="grid grid-cols-2 gap-4 mb-8">
        <GlassCard className="p-6 !bg-indigo-500/10 !border-indigo-500/20">
          <div className="flex items-centre space-x-2 mb-2 text-indigo-300">
            <Zap size={16} />
            <span className="text-xs font-bold uppercase tracking-wider">Current Velocity</span>
          </div>
          <div className="flex items-baseline space-x-1">
            <span className="text-3xl font-bold text-white tracking-tight">{stats.actualPace.toFixed(2)}</span>
            <span className="text-sm text-indigo-200/70">{goal.unit}/day</span>
          </div>
        </GlassCard>
        
        <GlassCard className="p-6 !bg-slate-800/30">
          <div className="flex items-centre space-x-2 mb-2 text-slate-400">
            <Target size={16} />
            <span className="text-xs font-bold uppercase tracking-wider">Required Pace</span>
          </div>
          <div className="flex items-baseline space-x-1">
            <span className={`text-3xl font-bold tracking-tight ${stats.actualPace >= stats.requiredPace ? 'text-emerald-400' : 'text-rose-400'}`}>
              {stats.requiredPace.toFixed(2)}
            </span>
            <span className="text-sm text-slate-500">{goal.unit}/day</span>
          </div>
        </GlassCard>
      </div>
      
      <div className="flex-grow bg-slate-900/40 border border-white/5 rounded-3xl p-6 mb-6 relative min-h-[300px]">
        <h4 className="text-sm font-medium text-slate-400 mb-6">Growth Trajectory</h4>
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history}>
              <defs>
                <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={stats.isAhead ? '#34d399' : '#fb7185'} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={stats.isAhead ? '#34d399' : '#fb7185'} stopOpacity={0}/>
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
                  backgroundColor: '#0f172a', 
                  borderColor: '#334155', 
                  borderRadius: '12px', 
                  color: '#fff'
                }}
                itemStyle={{color: '#e2e8f0'}}
                cursor={{stroke: '#ffffff20'}}
              />
              <Line 
                type="monotone" 
                dataKey="ideal" 
                stroke="#475569" 
                strokeDasharray="4 4" 
                dot={false} 
                strokeWidth={2} 
              />
              <Area 
                type="monotone" 
                dataKey="actual" 
                stroke={stats.isAhead ? '#34d399' : '#fb7185'} 
                fill="url(#colorActual)" 
                strokeWidth={3} 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      <button 
        onClick={onClose} 
        className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/5 text-white rounded-2xl transition-colours font-medium"
      >
        Close Analysis
      </button>
    </div>
  );
};

// Individual goal card component
const GoalCard = ({ goal, onLogClick, onAnalyzeClick }) => {
  const percent = Math.min(100, Math.max(0, (goal.current / goal.target) * 100));
  const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 1000 / 60 / 60 / 24);
  const expectedPercent = (dayOfYear / 365) * 100;
  const isAhead = percent >= expectedPercent;
  
  return (
    <GlassCard className="p-6 flex flex-col justify-between h-full group">
      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-centre space-x-2 mb-1">
            <h3 className="text-xl font-bold text-white group-hover:text-indigo-300 transition-colours">
              {goal.name}
            </h3>
            {isAhead && (
              <div className="bg-emerald-500/20 text-emerald-300 p-1 rounded-full">
                <TrendingUp size={12} />
              </div>
            )}
          </div>
          <p className="text-sm text-slate-400">
            <span className="text-white font-semibold">{goal.current.toLocaleString()}</span>
            <span className="mx-1 text-slate-600">/</span>
            {goal.target.toLocaleString()} {goal.unit}
          </p>
        </div>
        <button 
          onClick={() => onAnalyzeClick(goal)} 
          className="p-2 rounded-xl bg-white/5 hover:bg-indigo-500/20 hover:text-indigo-300 text-slate-500 transition-colours"
        >
          <BarChart2 size={18} />
        </button>
      </div>
      
      <div>
        <div className="w-full bg-slate-800 h-2 rounded-full mb-6 overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all duration-700 ease-out bg-gradient-to-r ${
              isAhead ? 'from-teal-400 to-emerald-500' : 'from-orange-400 to-rose-500'
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>
        <button 
          onClick={() => onLogClick(goal)} 
          className="w-full py-3 rounded-xl font-semibold text-sm shadow-lg transition-all duration-300 bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:shadow-indigo-500/25 hover:scale-[1.02] active:scale-[0.98] flex items-centre justify-centre space-x-2"
        >
          <Plus size={16} />
          <span>Log Progress</span>
        </button>
      </div>
    </GlassCard>
  );
};

// Main app component
export default function App() {
  const [user, setUser] = useState(null);
  const [goals, setGoals] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeGoal, setActiveGoal] = useState(null);
  const [analyzingGoal, setAnalyzingGoal] = useState(null);
  const [logValue, setLogValue] = useState('');
  const [logNote, setLogNote] = useState('');
  const [isAddingGoal, setIsAddingGoal] = useState(false);
  const [newGoalName, setNewGoalName] = useState('');
  const [newGoalTarget, setNewGoalTarget] = useState('');
  const [newGoalUnit, setNewGoalUnit] = useState('');
  const [db, setDb] = useState(null);

  // Initialise Firebase and set up authentication
  useEffect(() => {
    const init = async () => {
      // Check if Firebase config exists
      if (!firebaseConfig.apiKey) {
        setError('Firebase configuration is missing. Please check your Vercel environment variables.');
        setLoading(false);
        return;
      }

      try {
        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);
        const firestore = getFirestore(app);
        setDb(firestore);

        // Listen for authentication state changes
        onAuthStateChanged(auth, async (currentUser) => {
          if (currentUser) {
            setUser(currentUser);
            const userId = currentUser.uid;
            
            // Set up real-time listeners for goals and logs
            const goalsPath = `artifacts/${appId}/users/${userId}/goals`;
            const logsPath = `artifacts/${appId}/users/${userId}/logs`;
            
            const unsubscribeGoals = onSnapshot(
              query(collection(firestore, goalsPath)), 
              (snapshot) => {
                // If no goals exist, create initial goals
                if (snapshot.empty && goals.length === 0) {
                  const batch = writeBatch(firestore);
                  INITIAL_GOALS.forEach(g => {
                    batch.set(doc(collection(firestore, goalsPath)), g);
                  });
                  batch.commit().catch(err => {
                    console.error('Error creating initial goals:', err);
                    setError('Failed to create initial goals. Please refresh the page.');
                  });
                } else {
                  setGoals(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
                }
                setLoading(false);
              },
              (err) => {
                console.error('Error loading goals:', err);
                setError('Failed to load goals. Please check your internet connection.');
                setLoading(false);
              }
            );
            
            const unsubscribeLogs = onSnapshot(
              query(collection(firestore, logsPath)), 
              (snapshot) => {
                setLogs(snapshot.docs.map(d => d.data()));
              },
              (err) => {
                console.error('Error loading logs:', err);
              }
            );
            
          } else {
            // Sign in anonymously if not already signed in
            try {
              await signInAnonymously(auth);
            } catch (err) {
              console.error('Error signing in:', err);
              setError('Failed to sign in. Please refresh the page.');
              setLoading(false);
            }
          }
        });
      } catch (err) {
        console.error('Initialisation error:', err);
        setError('Failed to initialise app. Please check your configuration.');
        setLoading(false);
      }
    };
    
    init();
  }, []);

  // Handle logging progress for a goal
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
      // Add log entry
      await addDoc(collection(db, `artifacts/${appId}/users/${userId}/logs`), {
        goalId: activeGoal.id,
        value: val,
        notes: logNote,
        timestamp: Timestamp.now()
      });
      
      // Update goal's current value
      await updateDoc(doc(db, `artifacts/${appId}/users/${userId}/goals`, activeGoal.id), {
        current: increment(val)
      });
      
      // Reset form
      setLogValue('');
      setLogNote('');
      setActiveGoal(null);
    } catch (err) {
      console.error('Error logging progress:', err);
      alert('Failed to log progress. Please try again.');
    }
  };

  // Handle creating a new goal
  const handleAddGoal = async (e) => {
    e.preventDefault();
    if (!user || !newGoalName || !newGoalTarget) return;
    
    const target = parseFloat(newGoalTarget);
    if (isNaN(target) || target <= 0) {
      alert('Please enter a valid positive target number');
      return;
    }
    
    const userId = user.uid;
    
    try {
      await addDoc(collection(db, `artifacts/${appId}/users/${userId}/goals`), {
        name: newGoalName,
        target: target,
        unit: newGoalUnit || 'units',
        current: 0,
        type: 'cumulative'
      });
      
      // Reset form
      setIsAddingGoal(false);
      setNewGoalName('');
      setNewGoalTarget('');
      setNewGoalUnit('');
    } catch (err) {
      console.error('Error creating goal:', err);
      alert('Failed to create goal. Please try again.');
    }
  };

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-centre justify-centre">
        <div className="text-centre">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading your goals...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-centre justify-centre p-6">
        <div className="max-w-md w-full bg-slate-900 border border-red-500/20 rounded-3xl p-8 text-centre">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-centre justify-centre mx-auto mb-4">
            <AlertCircle size={32} className="text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
          <p className="text-slate-400 mb-6">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-colours"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  // Main app interface
  return (
    <div className={`min-h-screen ${THEME.bg} text-slate-100 font-sans selection:bg-indigo-500/30 pb-20`}>
      {/* Header */}
      <header className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-5xl mx-auto px-6 h-20 flex items-centre justify-between">
          <div className="flex items-centre space-x-3">
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-xl shadow-lg shadow-indigo-500/20">
              <Sparkles size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">2026 Tracker</h1>
              <p className="text-xs text-slate-400">Pro Dashboard</p>
            </div>
          </div>
          <button 
            onClick={() => setIsAddingGoal(true)} 
            className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colours text-slate-300 hover:text-white"
          >
            <Plus size={20} />
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {goals.map(goal => (
            <GoalCard 
              key={goal.id} 
              goal={goal} 
              onLogClick={setActiveGoal} 
              onAnalyzeClick={setAnalyzingGoal} 
            />
          ))}
          
          {/* Add new goal card */}
          <button 
            onClick={() => setIsAddingGoal(true)} 
            className="group flex flex-col items-centre justify-centre min-h-[220px] border border-dashed border-white/10 rounded-3xl hover:bg-white/5 transition-all duration-300"
          >
            <div className="w-14 h-14 bg-slate-900 rounded-full flex items-centre justify-centre text-slate-500 group-hover:text-indigo-400 group-hover:scale-110 transition-all shadow-inner shadow-black/50">
              <Plus size={24} />
            </div>
            <span className="mt-4 text-sm font-medium text-slate-500 group-hover:text-slate-300">
              Create New Goal
            </span>
          </button>
        </div>
      </main>

      {/* Log progress modal */}
      <Modal 
        isOpen={!!activeGoal} 
        onClose={() => setActiveGoal(null)} 
        title={`Log ${activeGoal?.name}`}
      >
        <form onSubmit={handleLogSubmit}>
          <div className="mb-6">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
              Value
            </label>
            <div className="relative">
              <input 
                type="number" 
                step="any" 
                autoFocus 
                placeholder="0.0" 
                className="w-full bg-slate-950/50 border border-white/10 rounded-2xl p-4 text-3xl font-bold text-white focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 outline-none transition-all placeholder-slate-700"
                value={logValue} 
                onChange={(e) => setLogValue(e.target.value)} 
                required
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-medium">
                {activeGoal?.unit}
              </span>
            </div>
          </div>
          
          <div className="mb-6">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
              Note (optional)
            </label>
            <textarea 
              rows="2" 
              placeholder="Quick note..." 
              className="w-full bg-slate-950/50 border border-white/10 rounded-2xl p-4 text-sm text-slate-300 focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all resize-none"
              value={logNote} 
              onChange={(e) => setLogNote(e.target.value)} 
            />
          </div>
          
          <button 
            type="submit" 
            disabled={!logValue} 
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-2xl transition-colours shadow-lg shadow-indigo-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Update Progress
          </button>
        </form>
      </Modal>

      {/* Add new goal modal */}
      <Modal 
        isOpen={isAddingGoal} 
        onClose={() => setIsAddingGoal(false)} 
        title="New Goal"
      >
        <form onSubmit={handleAddGoal} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
              Goal Name
            </label>
            <input 
              className="w-full bg-slate-950/50 border border-white/10 rounded-2xl p-4 text-white focus:ring-2 focus:ring-indigo-500/50 outline-none"
              placeholder="Run 1000km" 
              value={newGoalName} 
              onChange={e => setNewGoalName(e.target.value)} 
              required 
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                Target
              </label>
              <input 
                type="number" 
                step="any"
                className="w-full bg-slate-950/50 border border-white/10 rounded-2xl p-4 text-white focus:ring-2 focus:ring-indigo-500/50 outline-none"
                placeholder="1000" 
                value={newGoalTarget} 
                onChange={e => setNewGoalTarget(e.target.value)} 
                required 
              />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                Unit
              </label>
              <input 
                className="w-full bg-slate-950/50 border border-white/10 rounded-2xl p-4 text-white focus:ring-2 focus:ring-indigo-500/50 outline-none"
                placeholder="km" 
                value={newGoalUnit} 
                onChange={e => setNewGoalUnit(e.target.value)} 
              />
            </div>
          </div>
          
          <button 
            type="submit" 
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-2xl mt-2 transition-colours shadow-lg shadow-indigo-900/20"
          >
            Create Goal
          </button>
        </form>
      </Modal>

      {/* Analytics full-screen view */}
      {analyzingGoal && (
        <div className="fixed inset-0 bg-slate-950 z-50 flex flex-col animate-in slide-in-from-right duration-300">
          <div className="flex items-centre justify-between px-6 py-4 border-b border-white/5 bg-slate-900/50 backdrop-blur-md">
            <button 
              onClick={() => setAnalyzingGoal(null)} 
              className="flex items-centre text-slate-400 hover:text-white transition-colours"
            >
              <div className="p-2 rounded-full bg-white/5 mr-3">
                <ChevronRight className="rotate-180" size={20} />
              </div>
              <span className="font-medium">Back to Dashboard</span>
            </button>
            <div className="text-right">
              <h2 className="text-lg font-bold text-white tracking-tight">
                {analyzingGoal.name}
              </h2>
            </div>
          </div>
          <div className="flex-grow p-6 overflow-y-auto bg-gradient-to-b from-slate-950 to-indigo-950/20">
            <AnalyticsView 
              goal={analyzingGoal} 
              logs={logs} 
              onClose={() => setAnalyzingGoal(null)} 
            />
          </div>
        </div>
      )}
    </div>
  );
}

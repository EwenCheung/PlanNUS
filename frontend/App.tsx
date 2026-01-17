import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import SidebarLeft from './components/SidebarLeft';
import MainBoard from './components/MainBoard';
import SidebarRight from './components/SidebarRight';
import Login from './components/Login';
import Signup from './components/Signup';
import { AcademicYear } from './types';
import { GeneratePlanResponse } from './api';

// Types for Auth
interface User {
  id?: string;
  name: string;
  email: string;
  isGuest?: boolean;
}

// Initial Data (fallback when no plan is loaded)
const INITIAL_PLAN_DATA: AcademicYear[] = [
  {
    year: 1,
    label: "Year 1",
    academicYear: "2024/2025",
    totalUnits: 0,
    semesters: [
      { id: 1, name: "Semester 1", units: 0, modules: [] },
      { id: 2, name: "Semester 2", units: 0, modules: [] }
    ]
  },
  {
    year: 2,
    label: "Year 2",
    academicYear: "2025/2026",
    totalUnits: 0,
    semesters: [
      { id: 3, name: "Semester 1", units: 0, modules: [] },
      { id: 4, name: "Semester 2", units: 0, modules: [] }
    ]
  },
  {
    year: 3,
    label: "Year 3",
    academicYear: "2026/2027",
    totalUnits: 0,
    semesters: [
      { id: 5, name: "Semester 1", units: 0, modules: [] },
      { id: 6, name: "Semester 2", units: 0, modules: [] }
    ]
  },
  {
    year: 4,
    label: "Year 4",
    academicYear: "2027/2028",
    totalUnits: 0,
    semesters: [
      { id: 7, name: "Semester 1", units: 0, modules: [] },
      { id: 8, name: "Semester 2", units: 0, modules: [] }
    ]
  }
];

const App: React.FC = () => {
  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [authView, setAuthView] = useState<'login' | 'signup'>('login');

  // App State
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [saveTrigger, setSaveTrigger] = useState(0);
  const [exportTrigger, setExportTrigger] = useState(0);
  const [isSaved, setIsSaved] = useState(false);
  const [startAcademicYear, setStartAcademicYear] = useState('2024/2025');
  const [generatedPlan, setGeneratedPlan] = useState<GeneratePlanResponse | null>(null);
  const [currentSemester, setCurrentSemester] = useState('Y1S1');

  // User's selected degree and major (for AI context)
  const [userDegree, setUserDegree] = useState('Bachelor of Computing');
  const [userMajor, setUserMajor] = useState('Computer Science');

  // Current study plan for AI context
  const [currentPlan, setCurrentPlan] = useState<any>(null);

  // Restore session from localStorage on page load
  useEffect(() => {
    const savedUser = localStorage.getItem('nusplanner_user');
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
      } catch {
        localStorage.removeItem('nusplanner_user');
      }
    }
  }, []);

  // Save user to localStorage when it changes
  useEffect(() => {
    if (user) {
      localStorage.setItem('nusplanner_user', JSON.stringify(user));
    }
  }, [user]);

  // Auth Handlers
  const handleLogin = async (email: string, password: string): Promise<string> => {
    try {
      const response = await fetch('http://localhost:8000/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const userData = await response.json();

      if (userData.success) {
        setUser({
          id: userData.id,
          name: userData.name,
          email: userData.email,
          isGuest: false
        });
        return ''; // No error
      } else {
        return userData.message || 'Login failed';
      }
    } catch {
      return 'Unable to connect to server. Please try again.';
    }
  };

  const handleGuestLogin = async () => {
    try {
      const response = await fetch('http://localhost:8000/auth/guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const userData = await response.json();

      if (userData.success) {
        setUser({
          id: userData.id,
          name: userData.name,
          email: userData.email,
          isGuest: true
        });
      }
    } catch {
      // Fallback for offline mode
      setUser({
        name: 'Guest User',
        email: '',
        isGuest: true
      });
    }
  };

  const handleSignup = async (username: string, email: string, password: string): Promise<string> => {
    try {
      const response = await fetch('http://localhost:8000/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password })
      });

      const userData = await response.json();

      if (userData.success) {
        setUser({
          id: userData.id,
          name: userData.name,
          email: userData.email,
          isGuest: false
        });
        return ''; // No error
      } else {
        return userData.message || 'Signup failed';
      }
    } catch {
      return 'Unable to connect to server. Please try again.';
    }
  };

  const handleLogout = () => {
    // Auto-save before logout
    setSaveTrigger(prev => prev + 1);
    setTimeout(() => {
      localStorage.removeItem('nusplanner_user');
      setUser(null);
      setAuthView('login');
    }, 500);
  };

  const handleGeneratePlan = (result: GeneratePlanResponse) => {
    setGeneratedPlan(result);
    // Note: Don't increment refreshTrigger here - it would trigger fetchDummyPlan and overwrite the generated plan
  };

  const handleSavePlan = () => {
    setSaveTrigger(prev => prev + 1);
  };

  const handleExportPlan = () => {
    setExportTrigger(prev => prev + 1);
  };

  // Handle save success callback from MainBoard
  const handleSaveSuccess = () => {
    setIsSaved(true);
    // Reset after 3 seconds
    setTimeout(() => setIsSaved(false), 3000);
  };

  // Auto-save on page refresh/close
  useEffect(() => {
    const handleBeforeUnload = () => {
      setSaveTrigger(prev => prev + 1);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Render Auth Views if not logged in
  if (!user) {
    if (authView === 'login') {
      return (
        <Login
          onLogin={(email, password) => handleLogin(email, password)}
          onGuestLogin={handleGuestLogin}
          onSwitchToSignup={() => setAuthView('signup')}
        />
      );
    } else {
      return (
        <Signup
          onSignup={(username, email, password) => handleSignup(username, email, password)}
          onSwitchToLogin={() => setAuthView('login')}
        />
      );
    }
  }

  // Render Main App if logged in
  return (
    <div className="flex flex-col h-screen overflow-hidden text-slate-900 font-sans">
      <Header
        isAiOpen={isAiOpen}
        toggleAi={() => setIsAiOpen(!isAiOpen)}
        onSave={handleSavePlan}
        user={user}
        onLogout={handleLogout}
        isSaved={isSaved}
        onExport={handleExportPlan}
      />
      <div className="flex flex-1 overflow-hidden">
        <SidebarLeft
          onGeneratePlan={handleGeneratePlan}
          onAcademicYearChange={setStartAcademicYear}
          onCurrentSemesterChange={setCurrentSemester}
          initialAcademicYear={startAcademicYear}
          onDegreeChange={(d) => setUserDegree(d === 'computing' ? 'Bachelor of Computing' : 'Bachelor of Business Administration')}
          onMajorChange={setUserMajor}
        />
        <MainBoard
          refreshTrigger={refreshTrigger}
          saveTrigger={saveTrigger}
          exportTrigger={exportTrigger}
          onSaveSuccess={handleSaveSuccess}
          userId={user?.id}
          startAcademicYear={startAcademicYear}
          generatedPlan={generatedPlan}
          currentSemester={currentSemester}
          onPlanChange={setCurrentPlan}
        />
        <SidebarRight
          isOpen={isAiOpen}
          toggle={() => setIsAiOpen(!isAiOpen)}
          userDegree={userDegree}
          userMajor={userMajor}
          userId={user?.id}
          currentSemester={currentSemester}
          startYear={startAcademicYear}
          currentPlan={currentPlan}
        />
      </div>
    </div>
  );
};

export default App;
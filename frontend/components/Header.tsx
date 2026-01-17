import React, { useState, useEffect, useRef } from 'react';

interface User {
  name: string;
  email: string;
  isGuest?: boolean;
}

interface HeaderProps {
  isAiOpen: boolean;
  toggleAi: () => void;
  onSave: () => void;
  onExport?: () => void;
  user?: User | null;
  onLogout?: () => void;
  isSaved?: boolean;
}

const Header: React.FC<HeaderProps> = ({ isAiOpen, toggleAi, onSave, onExport, user, onLogout, isSaved = false }) => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const displayName = user?.name || "Guest User";
  const displayEmail = user?.email || "guest@nus.edu";
  const avatarUrl = user?.isGuest
    ? "https://ui-avatars.com/api/?name=Guest+User&background=cbd5e1&color=fff"
    : `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=3b82f6&color=fff`;

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 z-40 shadow-sm shrink-0">
      <div className="flex items-center gap-8">
        <div className="flex items-center select-none">
          <span className="text-3xl font-black text-accent">NUS</span>
          <span className="text-3xl font-black text-nus-blue">Planner</span>
        </div>

        <nav className="hidden md:flex items-center gap-1">
          <a href="#" className="px-3 py-2 text-sm font-bold text-primary border-b-2 border-primary">My Plan</a>
        </nav>
      </div>

      <div className="flex items-center gap-3">
        {/* Save Button */}
        <button
          onClick={onSave}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${isSaved
            ? 'bg-green-50 text-green-600 border-green-200'
            : 'bg-white text-slate-600 border-slate-200 hover:border-primary/50 hover:text-primary'
            }`}
        >
          <span className="material-symbols-outlined text-[18px]">
            {isSaved ? 'check_circle' : 'save'}
          </span>
          {isSaved ? 'Saved' : 'Save'}
        </button>

        {/* Export Button with Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsExportOpen(!isExportOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-slate-600 border border-slate-200 hover:border-primary/50 hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            Export
            <span className="material-symbols-outlined text-[14px]">expand_more</span>
          </button>

          {isExportOpen && (
            <div className="absolute top-full left-0 mt-2 bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 min-w-[140px]">
              <button
                onClick={() => {
                  onExport?.();
                  setIsExportOpen(false);
                }}
                className="w-full text-left px-4 py-2.5 text-xs font-medium text-slate-600 hover:bg-blue-50 hover:text-primary transition-colors flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[16px]">data_object</span>
                Export as JSON
              </button>
            </div>
          )}
        </div>

        <button
          onClick={toggleAi}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border ${isAiOpen ? 'bg-primary/10 text-primary border-primary/20' : 'bg-white text-slate-600 border-slate-200 hover:border-primary/50'}`}
        >
          <span className="material-symbols-outlined text-[18px] filled">{isAiOpen ? 'smart_toy' : 'smart_toy'}</span>
          AI Assistant
        </button>

        <div className="h-6 w-px bg-slate-200 mx-1"></div>

        {/* User Profile */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="w-10 h-10 rounded-full bg-orange-100 border-2 border-white shadow-sm overflow-hidden focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all block"
          >
            <img src={avatarUrl} alt="User" className="w-full h-full object-cover opacity-90 hover:opacity-100" />
          </button>

          {/* Dropdown Menu */}
          {isProfileOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-50">
              <div className="px-4 py-3 border-b border-slate-50 bg-slate-50/50">
                <p className="text-sm font-bold text-slate-800">{displayName}</p>
                <p className="text-[10px] font-medium text-slate-500 truncate" title={displayEmail}>{displayEmail}</p>
              </div>
              <div className="p-1">
                <button
                  onClick={onLogout}
                  className="w-full text-left px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-2 transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">logout</span>
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
import React from 'react';
import { Home, List, PlusCircle, Map, UserCircle, Bell, LogOut, Menu, X, Search } from 'lucide-react';
import { User, AppNotification } from '../../types';
import { motion, AnimatePresence } from 'framer-motion';

interface LayoutProps {
  user: User | null;
  onLogout: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onNotificationClick: (notif: AppNotification) => void;
  children: React.ReactNode;
  notifications: AppNotification[];
  connectionStatus: 'testing' | 'success' | 'failed';
}

export default function Layout({ 
  user, 
  onLogout, 
  activeTab, 
  setActiveTab, 
  children, 
  notifications,
  connectionStatus 
}: LayoutProps) {
  const unreadCount = notifications.filter(n => !n.read).length;

  const navItems = [
    { id: 'dashboard', label: 'Home', icon: Home },
    { id: 'my-errands', label: 'Tasks', icon: List },
    { id: 'create', label: 'Post', icon: PlusCircle, primary: true },
    { id: 'live-map', label: 'Map', icon: Map },
    { id: 'active', label: 'Profile', icon: UserCircle },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans selection:bg-black selection:text-white">
      {/* Header */}
      <header className="glass sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-black rounded-2xl flex items-center justify-center shadow-strong rotate-3 hover:rotate-0 transition-transform cursor-pointer">
            <PlusCircle className="text-white" size={20} />
          </div>
          <div>
            <h1 className="text-2xl leading-none mb-0.5">ErrandRunner</h1>
            <div className="flex items-center gap-2">
              <p className="text-micro text-muted-foreground">Nairobi, Kenya</p>
              {user?.isAdmin && (
                <>
                  <div className="w-1 h-1 bg-muted-foreground/30 rounded-full"></div>
                  <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter border ${
                    connectionStatus === 'testing' ? 'bg-slate-50 text-slate-400 border-slate-100' :
                    connectionStatus === 'success' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                    'bg-rose-50 text-rose-600 border-rose-100'
                  }`}>
                    <div className={`w-1 h-1 rounded-full ${
                      connectionStatus === 'testing' ? 'bg-slate-400 animate-pulse' :
                      connectionStatus === 'success' ? 'bg-emerald-600' :
                      'bg-rose-600'
                    }`} />
                    {connectionStatus === 'testing' ? 'Testing...' :
                     connectionStatus === 'success' ? 'Firebase Connected' :
                     'Local Mode'}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button className="p-2.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-xl transition-all relative group">
            <Search size={20} />
          </button>
          <button className="p-2.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-xl transition-all relative group">
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
            )}
          </button>
          {user && (
            <div className="h-8 w-[1px] bg-border mx-1"></div>
          )}
          {user && (
            <button 
              onClick={onLogout} 
              className="flex items-center gap-2 pl-2 pr-3 py-2 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-xl transition-all group"
            >
              <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center text-xs font-black uppercase overflow-hidden">
                {user.profilePhoto || user.avatar ? (
                  <img src={user.profilePhoto || user.avatar} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  user.name[0]
                )}
              </div>
              <LogOut size={18} className="group-hover:translate-x-0.5 transition-transform" />
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 pb-24">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-md">
        <nav className="glass rounded-[2.5rem] p-2 flex items-center justify-between shadow-strong">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            
            if (item.primary) {
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-strong ${
                    isActive ? 'bg-black text-white scale-110 -translate-y-2' : 'bg-black text-white hover:scale-105 active:scale-95'
                  }`}
                >
                  <Icon size={28} strokeWidth={2.5} />
                </button>
              );
            }

            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex-1 flex flex-col items-center gap-1 py-2 transition-all rounded-2xl ${
                  isActive ? 'text-black bg-secondary/50' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/30'
                }`}
              >
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                <span className={`text-[10px] font-black uppercase tracking-widest transition-all ${isActive ? 'opacity-100' : 'opacity-60'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

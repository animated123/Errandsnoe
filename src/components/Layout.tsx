import React from 'react';
import { Home, List, PlusCircle, Map, UserCircle, Bell, LogOut, Menu, X, Search, ShieldAlert } from 'lucide-react';
import { User, AppNotification, UserRole } from '../../types';
import { motion, AnimatePresence } from 'motion/react';

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
    { id: 'my-errands', label: user?.role === UserRole.REQUESTER ? 'My Errands' : 'Tasks', icon: List },
    { 
      id: user?.role === UserRole.RUNNER ? 'find' : 'create', 
      label: user?.role === UserRole.RUNNER ? 'Find' : 'Post', 
      icon: user?.role === UserRole.RUNNER ? Search : PlusCircle, 
      primary: true 
    },
    { id: 'live-map', label: 'Map', icon: Map },
    { id: 'active', label: 'Profile', icon: UserCircle },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row font-sans selection:bg-black selection:text-white">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-72 bg-white border-r border-slate-100 fixed inset-y-0 left-0 z-50">
        <div className="p-8">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 bg-black rounded-2xl flex items-center justify-center shadow-strong rotate-3">
              <PlusCircle className="text-white" size={20} />
            </div>
            <h1 className="text-2xl leading-none font-black tracking-tighter">ErrandRunner</h1>
          </div>

          <nav className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all group ${
                    isActive 
                      ? 'bg-black text-white shadow-strong translate-x-2' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                  }`}
                >
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 2} className={isActive ? '' : 'group-hover:scale-110 transition-transform'} />
                  <span className="text-xs font-black uppercase tracking-widest">
                    {item.label}
                  </span>
                  {isActive && (
                    <motion.div 
                      layoutId="active-pill"
                      className="ml-auto w-1.5 h-1.5 bg-white rounded-full"
                    />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="mt-auto p-8 space-y-4">
          {user && (
            <div className="p-4 bg-secondary/30 rounded-3xl border border-slate-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center text-xs font-black uppercase overflow-hidden shadow-soft border border-slate-100">
                  {user.profilePhoto || user.avatar ? (
                    <img src={user.profilePhoto || user.avatar} alt={user.name} className="w-full h-full object-cover" />
                  ) : (
                    user.name[0]
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-black text-slate-900 truncate">{user.name}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{user.role}</p>
                </div>
              </div>
              <button 
                onClick={onLogout}
                className="w-full flex items-center justify-center gap-2 py-3 bg-white text-red-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-50 transition-all border border-red-100"
              >
                <LogOut size={14} /> Sign Out
              </button>
            </div>
          )}
          
          <div className="flex items-center justify-center gap-4 text-slate-300">
            <div className="w-1 h-1 bg-current rounded-full"></div>
            <p className="text-[8px] font-black uppercase tracking-[0.3em]">v2.4.0</p>
            <div className="w-1 h-1 bg-current rounded-full"></div>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col md:pl-72">
        {/* Header */}
        <header className="glass sticky top-0 z-40 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 md:hidden">
            <div className="w-10 h-10 bg-black rounded-2xl flex items-center justify-center shadow-strong rotate-3">
              <PlusCircle className="text-white" size={20} />
            </div>
            <h1 className="text-xl leading-none font-black tracking-tighter">ErrandRunner</h1>
          </div>
          
          <div className="hidden md:block">
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
          
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center bg-secondary/50 rounded-2xl px-4 py-2 border border-slate-100">
              <Search size={16} className="text-slate-400 mr-2" />
              <input type="text" placeholder="Quick search..." className="bg-transparent border-none outline-none text-[10px] font-bold w-32" />
            </div>
            <button className="p-2.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-xl transition-all relative group">
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
              )}
            </button>
            <div className="md:hidden">
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
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 pb-32 md:pb-12">
          {user && (!user.phoneVerified || !user.emailVerified) && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="bg-amber-50 border-b border-amber-100 px-6 py-3 flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <ShieldAlert size={18} />
                </div>
                <div>
                  <p className="text-xs font-black text-amber-900 uppercase tracking-tight">Account Not Verified</p>
                  <p className="text-[10px] font-bold text-amber-700">Please verify your phone and email to access all features.</p>
                </div>
              </div>
              <button 
                onClick={() => setActiveTab('active')}
                className="px-4 py-2 bg-amber-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm hover:bg-amber-700 transition-colors whitespace-nowrap"
              >
                Verify Now
              </button>
            </motion.div>
          )}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="p-4 md:p-8"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Bottom Navigation (Mobile Only) */}
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-md md:hidden">
          <nav className="glass rounded-[2.5rem] p-2 flex items-center justify-between shadow-2xl border border-white/20 backdrop-blur-2xl">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              
              if (item.primary) {
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-xl relative group ${
                      isActive ? 'bg-black text-white scale-110 -translate-y-4' : 'bg-black text-white hover:scale-105 active:scale-95'
                    }`}
                  >
                    <Icon size={28} strokeWidth={2.5} />
                    {!isActive && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white animate-bounce" />
                    )}
                  </button>
                );
              }

              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`relative flex-1 flex flex-col items-center gap-1 py-2.5 transition-all rounded-3xl z-10 ${
                    isActive ? 'text-black' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {isActive && (
                    <motion.div 
                      layoutId="mobile-nav-active"
                      className="absolute inset-0 bg-slate-100/80 rounded-[2rem] -z-10"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 2} className="relative z-20" />
                  <span className={`text-[9px] font-black uppercase tracking-widest transition-all relative z-20 ${isActive ? 'opacity-100' : 'opacity-60'}`}>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>
    </div>
  </div>
  );
}

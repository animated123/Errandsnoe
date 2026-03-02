import React, { useState, useEffect } from 'react';
import { User, UserRole, AppNotification, AppSettings } from '../types';
import { LayoutDashboard, Plus, PlusCircle, UserCircle, LogOut, Briefcase, Bell, Clock, X, ChevronRight, Check, ShieldAlert, ShoppingBag, List, RefreshCw, Home, Search } from 'lucide-react';
import { firebaseService } from '../services/firebaseService';

interface LayoutProps {
  children: React.ReactNode;
  user: User | null;
  onLogout: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onNotificationClick?: (notif: AppNotification) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, user, onLogout, activeTab, setActiveTab, onNotificationClick }) => {
  const [showNotifs, setShowNotifs] = useState(false);
  const [notifs, setNotifs] = useState<AppNotification[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings>({ primaryColor: '#000000' });

  useEffect(() => {
    const unsub = firebaseService.subscribeToSettings((settings) => {
      setAppSettings(settings);
      if (settings.primaryColor) {
        document.documentElement.style.setProperty('--brand-primary', settings.primaryColor);
        document.documentElement.style.setProperty('--brand-primary-light', settings.primaryColor + '15');
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (user) {
      const unsub = firebaseService.subscribeToNotifications(user.id, setNotifs);
      return () => unsub();
    }
  }, [user]);

  const isRequester = !user || user.role === UserRole.REQUESTER;
  const isRunner = user?.role === UserRole.RUNNER;
  const isAdmin = user?.isAdmin || false;
  const unreadCount = notifs.filter(n => !n.read).length;

  const handleOpenNotifs = async () => {
    if (!user) return;
    setShowNotifs(true);
    await firebaseService.markNotificationsAsRead(user.id);
    const updated = await firebaseService.fetchNotifications(user.id);
    setNotifs(updated);
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div className="flex min-h-screen bg-[#fcfdff] relative overflow-x-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-white border-r flex-col sticky top-0 h-screen z-50">
        <div className="p-6 border-b flex items-center gap-3">
          {appSettings.iconUrl ? (
            <img src={appSettings.iconUrl} className="w-10 h-10 object-cover rounded-xl shadow-sm" alt="App Icon" />
          ) : (
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100">
              <ShoppingBag className="text-white" size={22} />
            </div>
          )}
          <h1 className="text-lg font-[900] text-slate-900 tracking-tight">Errands</h1>
        </div>
        
        <div className="flex-1 p-4 space-y-2">
          {appSettings.logoUrl && (
            <div className="px-3 py-4 mb-2 flex flex-col items-center gap-2 bg-slate-50 rounded-[2rem] border border-slate-100/50">
              <img src={appSettings.logoUrl} className="w-12 h-12 object-cover rounded-2xl shadow-sm" alt="Logo" />
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">Official Partner</p>
            </div>
          )}
          <SidebarButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<Home size={20} />} label="Home" />
          
          {isRunner ? (
            <SidebarButton active={activeTab === 'find'} onClick={() => setActiveTab('find')} icon={<Search size={20} />} label="Find" />
          ) : (
            <SidebarButton active={activeTab === 'menu'} onClick={() => setActiveTab('menu')} icon={<List size={20} />} label="Menu" />
          )}

          {isRequester && !isAdmin && (
            <SidebarButton active={activeTab === 'create'} onClick={() => setActiveTab('create')} icon={<PlusCircle size={20} />} label="Post" />
          )}
          <SidebarButton active={activeTab === 'my-errands'} onClick={() => setActiveTab('my-errands')} icon={<Briefcase size={20} />} label="Tasks" />
          {isAdmin && (
            <SidebarButton active={activeTab === 'admin'} onClick={() => setActiveTab('admin')} icon={<ShieldAlert size={20} />} label="Admin Panel" />
          )}
          <SidebarButton active={activeTab === 'active'} onClick={() => setActiveTab('active')} icon={<UserCircle size={20} />} label="Profile" />
        </div>

        <div className="p-4 border-t">
          {user ? (
            <button onClick={onLogout} className="w-full flex items-center gap-3 p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all font-black uppercase text-[10px] tracking-widest">
              <LogOut size={18} />
              Sign Out
            </button>
          ) : (
            <button onClick={() => setActiveTab('active')} className="w-full flex items-center gap-3 p-3 bg-indigo-600 text-white rounded-xl transition-all font-black uppercase text-[10px] tracking-widest justify-center shadow-lg shadow-indigo-100">
              Sign In
            </button>
          )}
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white/95 backdrop-blur-md px-5 py-3.5 flex items-center justify-between border-b sticky top-0 z-40 md:px-8">
          <div className="flex items-center gap-2 md:hidden">
            {appSettings.iconUrl ? (
              <img src={appSettings.iconUrl} className="w-9 h-9 object-cover rounded-lg shadow-sm" alt="App Icon" />
            ) : (
              <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100">
                <ShoppingBag className="text-white" size={20} />
              </div>
            )}
            <h1 className="text-base font-[900] text-slate-900 tracking-tight">Errands</h1>
          </div>
          <div className="hidden md:block">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Platform / {activeTab}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleRefresh} className="p-2.5 bg-slate-50 text-slate-400 rounded-xl active:scale-90 transition-all hover:text-indigo-600">
              <RefreshCw size={18} />
            </button>
            {user && (
              <button onClick={handleOpenNotifs} className="p-2.5 bg-slate-50 text-slate-400 rounded-xl relative active:scale-90 transition-all">
                <Bell size={18} />
                {unreadCount > 0 && (<span className="absolute top-1.5 right-1.5 w-3.5 h-3.5 bg-red-500 text-white text-[7px] font-black rounded-full flex items-center justify-center border-2 border-white">{unreadCount}</span>)}
              </button>
            )}
            {!user && (
              <button onClick={() => setActiveTab('active')} className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-100">Login</button>
            )}
            {user && <button onClick={onLogout} className="md:hidden p-2.5 bg-slate-50 text-slate-400 hover:text-red-500 rounded-xl active:scale-90 transition-all"><LogOut size={18} /></button>}
          </div>
        </header>

        {showNotifs && (
          <div className="fixed inset-0 z-50 bg-black/10 backdrop-blur-sm">
            <div className="absolute inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
              <header className="p-5 border-b flex items-center justify-between"><h2 className="text-base font-black text-slate-900">Activity</h2><button onClick={() => setShowNotifs(false)} className="p-2 bg-slate-50 text-slate-400 rounded-xl"><X size={18} /></button></header>
              <div className="flex-1 overflow-y-auto p-5 space-y-3">
                {notifs.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-2 opacity-50">
                    <Bell size={40} strokeWidth={1} />
                    <p className="text-xs font-bold">No notifications</p>
                  </div>
                ) : (
                  notifs.map(n => (
                    <div 
                      key={n.id} 
                      onClick={() => {
                        onNotificationClick?.(n);
                        setShowNotifs(false);
                      }}
                      className="p-4 rounded-2xl border border-slate-100 bg-white hover:bg-slate-50 transition-all cursor-pointer active:scale-95"
                    >
                      <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1">{n.title}</p>
                      <p className="text-[11px] text-slate-500 font-medium leading-tight">{n.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        <main className="flex-1 p-4 pb-24 md:p-8 md:pb-8 overflow-y-auto w-full max-w-6xl mx-auto">{children}</main>

        <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t px-4 py-3.5 flex justify-between items-center safe-area-bottom z-40 shadow-xl md:hidden">
          <NavButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<Home size={20} />} label="Home" />
          
          {isRunner ? (
            <NavButton active={activeTab === 'find'} onClick={() => setActiveTab('find')} icon={<Search size={20} />} label="Find" />
          ) : (
            <NavButton active={activeTab === 'menu'} onClick={() => setActiveTab('menu')} icon={<List size={20} />} label="Menu" />
          )}

          <NavButton active={activeTab === 'create'} onClick={() => setActiveTab('create')} icon={<PlusCircle size={20} />} label="Post" />
          <NavButton active={activeTab === 'my-errands'} onClick={() => setActiveTab('my-errands')} icon={<Briefcase size={20} />} label="Tasks" />
          <NavButton active={activeTab === 'active'} onClick={() => setActiveTab('active')} icon={<UserCircle size={20} />} label="Profile" />
        </nav>
      </div>
    </div>
  );
};

const SidebarButton: React.FC<any> = ({ active, onClick, icon, label }) => (
  <button 
    onClick={onClick} 
    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all active:scale-95 ${active ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:bg-slate-50'}`}
  >
    {icon}
    <span className="text-[11px] font-black uppercase tracking-widest">{label}</span>
  </button>
);

const NavButton: React.FC<any> = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1 transition-all active:scale-95 ${active ? 'text-indigo-600' : 'text-slate-400'}`}>{icon}<span className="text-[9px] font-black uppercase tracking-widest">{label}</span></button>
);

export default Layout;
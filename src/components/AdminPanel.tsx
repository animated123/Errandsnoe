import React, { useState, useEffect, useRef } from 'react';
import { User, AppSettings, RunnerApplication, FeaturedService, ServiceListing, ErrandCategory, UserRole, Errand, ErrandStatus, PriceRequest, LoyaltyLevel, ChatMessage, Coordinates } from '../../types';
import { firebaseService, formatPhoneDisplay, cloudinaryService } from '../../services/firebaseService';
import { Skeleton } from './ErrandCard';
import { 
  ShieldAlert, RefreshCw, Plus, Trash2, Upload, Save, MessageSquare, Loader2, 
  X, Settings, ImageIcon, ShoppingBag, Download, Check, MessageCircle, FileText,
  Search, UserCheck, CheckCircle, Briefcase, Navigation, Info, DollarSign, 
  Droplets, Wifi, Shield, Car, Star, ChevronRight, ChevronLeft, Camera, 
  ShieldCheck, ArrowRight, Sparkles, Map, MapPin, Mail
} from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';
import SupportChatView from './SupportChatView';
import UserAvatar from './UserAvatar';

interface AdminPanelProps {
  user: User;
  settings: AppSettings;
  stats: any;
  setStats: (stats: any) => void;
  userSearchQuery: string;
  setUserSearchQuery: (q: string) => void;
  userRoleFilter: UserRole | 'all';
  setUserRoleFilter: (r: UserRole | 'all') => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ 
  user, 
  settings, 
  stats, 
  setStats, 
  userSearchQuery, 
  setUserSearchQuery, 
  userRoleFilter, 
  setUserRoleFilter 
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'applications' | 'users' | 'services' | 'featured' | 'system' | 'branding' | 'support' | 'sms' | 'email'>('overview');
  const [applications, setApplications] = useState<RunnerApplication[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [services, setServices] = useState<ServiceListing[]>([]);
  const [featured, setFeatured] = useState<FeaturedService[]>([]);
  const [loading, setLoading] = useState(false);
  const [systemSettings, setSystemSettings] = useState<AppSettings>(settings);
  const [supportChats, setSupportChats] = useState<any[]>([]);
  const [selectedSupportUser, setSelectedSupportUser] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [apps, allUsers, allServices, allFeatured] = await Promise.all([
          firebaseService.fetchRunnerApplications(),
          firebaseService.fetchAllUsers(),
          firebaseService.fetchServiceListings(),
          firebaseService.fetchFeaturedServices()
        ]);
        setApplications(apps);
        setUsers(allUsers);
        setServices(allServices);
        setFeatured(allFeatured);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'support') {
      const unsub = firebaseService.subscribeToAllSupportChats((chats) => {
        setSupportChats(chats.sort((a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0)));
      });
      return () => unsub();
    }
  }, [activeTab]);

  if (user.role !== UserRole.ADMIN) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-[2.5rem] p-10 shadow-xl shadow-slate-200 text-center space-y-6">
          <div className="w-20 h-20 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mx-auto">
            <ShieldAlert size={40} />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-slate-900">Unauthorized Access</h2>
            <p className="text-slate-500 leading-relaxed">
              You do not have the required permissions to access the administration panel. 
              Please contact the system administrator if you believe this is an error.
            </p>
          </div>
          <button 
            onClick={() => window.location.href = '/'}
            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-sm tracking-widest hover:bg-slate-800 transition-colors"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const handleApproveApplication = async (app: RunnerApplication) => {
    if (!confirm(`Approve ${app.fullName} as a runner?`)) return;
    try {
      await firebaseService.adminUpdateUser(app.userId, { role: UserRole.RUNNER });
      await firebaseService.updateRunnerApplicationStatus(app.id, app.userId, 'approved');
      setApplications(applications.filter(a => a.id !== app.id));
      alert("Application approved!");
    } catch (e) { alert("Action failed"); }
  };

  const handleUpdateSettings = async () => {
    try {
      await firebaseService.saveAppSettings(systemSettings);
      alert("Settings updated!");
    } catch (e) { alert("Update failed"); }
  };

  const handleFeaturedUpload = async (file: File, index: number) => {
    try {
      const url = await cloudinaryService.uploadImage(file);
      const updated = [...featured];
      updated[index].imageUrl = url;
      setFeatured(updated);
    } catch (e) { alert("Upload failed"); }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(userSearchQuery.toLowerCase()) || 
                         u.email.toLowerCase().includes(userSearchQuery.toLowerCase());
    const matchesRole = userRoleFilter === 'all' || u.role === userRoleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight">Admin Control</h2>
          <p className="text-micro text-slate-400 mt-1">System Management & Oversight</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setActiveTab('overview')} className={`px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'overview' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-white text-slate-400 border border-slate-100'}`}>Overview</button>
          <button onClick={() => setActiveTab('support')} className={`px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all relative ${activeTab === 'support' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-white text-slate-400 border border-slate-100'}`}>
            Support
            {supportChats.some(c => c.unreadByAdmin) && <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white" />}
          </button>
          <button onClick={() => setActiveTab('system')} className={`px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'system' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-white text-slate-400 border border-slate-100'}`}>System</button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
        {[
          { id: 'applications', label: 'Applications', icon: <ShieldAlert size={14} />, count: applications.length },
          { id: 'users', label: 'User Directory', icon: <Settings size={14} />, count: users.length },
          { id: 'services', label: 'Service List', icon: <ShoppingBag size={14} />, count: services.length },
          { id: 'featured', label: 'Featured', icon: <Plus size={14} />, count: featured.length },
          { id: 'sms', label: 'SMS Config', icon: <MessageSquare size={14} /> },
          { id: 'email', label: 'Email Config', icon: <Mail size={14} /> },
          { id: 'branding', label: 'Branding', icon: <ImageIcon size={14} /> }
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-6 py-4 rounded-2xl text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all ${activeTab === tab.id ? 'bg-black text-white' : 'bg-white text-slate-400 border border-slate-100 hover:bg-slate-50'}`}
          >
            {tab.icon} {tab.label} {tab.count !== undefined && <span className="opacity-50">({tab.count})</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden p-10">
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100 space-y-4">
                  <Skeleton className="w-12 h-12 rounded-2xl" />
                  <div className="space-y-2">
                    <Skeleton className="w-20 h-3" />
                    <Skeleton className="w-32 h-10" />
                  </div>
                </div>
              ))}
            </div>
          )}
          {activeTab === 'applications' && (
            <div className="space-y-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center justify-between p-4 border-b border-slate-50">
                  <div className="flex items-center gap-6">
                    <Skeleton className="w-16 h-16 rounded-2xl" />
                    <div className="space-y-2">
                      <Skeleton className="w-40 h-6" />
                      <Skeleton className="w-32 h-4" />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Skeleton className="w-24 h-10 rounded-xl" />
                    <Skeleton className="w-24 h-10 rounded-xl" />
                  </div>
                </div>
              ))}
            </div>
          )}
          {activeTab === 'users' && (
            <div className="space-y-6">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex items-center justify-between p-4 border-b border-slate-50">
                  <div className="flex items-center gap-4">
                    <Skeleton className="w-12 h-12 rounded-xl" />
                    <div className="space-y-2">
                      <Skeleton className="w-32 h-5" />
                      <Skeleton className="w-48 h-3" />
                    </div>
                  </div>
                  <Skeleton className="w-20 h-6 rounded-lg" />
                </div>
              ))}
            </div>
          )}
          {['services', 'featured', 'sms', 'branding', 'system'].includes(activeTab) && (
            <div className="space-y-8">
              <Skeleton className="w-1/2 h-8" />
              <div className="grid grid-cols-2 gap-8">
                <Skeleton className="h-32 rounded-[2rem]" />
                <Skeleton className="h-32 rounded-[2rem]" />
                <Skeleton className="h-32 rounded-[2rem]" />
                <Skeleton className="h-32 rounded-[2rem]" />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden min-h-[500px]">
          {activeTab === 'overview' && (
            <div className="p-10 grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100 space-y-4">
                <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center"><ShoppingBag size={24} /></div>
                <div>
                  <h4 className="text-micro text-slate-400">Total Revenue</h4>
                  <p className="text-4xl font-black text-slate-900 mt-1">Ksh {stats.totalRevenue || 0}</p>
                </div>
              </div>
              <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100 space-y-4">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center"><CheckCircle size={24} /></div>
                <div>
                  <h4 className="text-micro text-slate-400">Completed Tasks</h4>
                  <p className="text-4xl font-black text-slate-900 mt-1">{stats.completedCount || 0}</p>
                </div>
              </div>
              <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100 space-y-4">
                <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center"><UserCheck size={24} /></div>
                <div>
                  <h4 className="text-micro text-slate-400">Active Runners</h4>
                  <p className="text-4xl font-black text-slate-900 mt-1">{users.filter(u => u.role === UserRole.RUNNER).length}</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'applications' && (
            <div className="divide-y divide-slate-50">
              {applications.length === 0 ? (
                <div className="p-20 text-center text-slate-300 font-black uppercase tracking-widest text-sm">No pending applications</div>
              ) : (
                applications.map(app => (
                  <div key={app.id} className="p-8 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-3">
                        <div className="w-16 h-16 bg-slate-100 rounded-2xl overflow-hidden border border-slate-200">
                          <img src={app.idFrontUrl} className="w-full h-full object-cover" alt="ID Front" />
                        </div>
                        <div className="w-16 h-16 bg-slate-100 rounded-2xl overflow-hidden border border-slate-200">
                          <img src={app.idBackUrl} className="w-full h-full object-cover" alt="ID Back" />
                        </div>
                        {app.selfieUrl && (
                          <div className="w-16 h-16 bg-slate-100 rounded-2xl overflow-hidden border border-slate-200">
                            <img src={app.selfieUrl} className="w-full h-full object-cover" alt="Selfie" />
                          </div>
                        )}
                      </div>
                      <div>
                        <h4 className="text-xl font-black text-slate-900">{app.fullName}</h4>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{app.categoryApplied} • {formatPhoneDisplay(app.phone || '')}</p>
                        <p className="text-xs font-bold text-slate-400 mt-1">ID: {app.nationalId}</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => handleApproveApplication(app)} className="px-6 py-3 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-emerald-100">Approve</button>
                      <button className="px-6 py-3 bg-red-50 text-red-600 rounded-xl text-xs font-black uppercase tracking-widest">Reject</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'users' && (
            <div className="flex flex-col h-full">
              <div className="p-6 border-b border-slate-50 flex gap-4 bg-slate-50/50">
                <div className="flex-1 relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input 
                    type="text" 
                    placeholder="Search users..." 
                    value={userSearchQuery}
                    onChange={e => setUserSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-white rounded-2xl border border-slate-100 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <select 
                  value={userRoleFilter}
                  onChange={e => setUserRoleFilter(e.target.value as any)}
                  className="px-6 py-4 bg-white rounded-2xl border border-slate-100 text-xs font-black uppercase tracking-widest outline-none"
                >
                  <option value="all">All Roles</option>
                  <option value={UserRole.REQUESTER}>Requesters</option>
                  <option value={UserRole.RUNNER}>Runners</option>
                  <option value={UserRole.ADMIN}>Admins</option>
                </select>
              </div>
              <div className="divide-y divide-slate-50">
                {filteredUsers.map(u => (
                  <div key={u.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <UserAvatar src={u.avatar} name={u.name} className="w-12 h-12 rounded-xl" />
                      <div>
                        <h4 className="text-base font-black text-slate-900">{u.name}</h4>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{u.email} • {formatPhoneDisplay(u.phone)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                        u.role === UserRole.ADMIN ? 'bg-indigo-50 text-indigo-600' :
                        u.role === UserRole.RUNNER ? 'bg-emerald-50 text-emerald-600' :
                        'bg-slate-50 text-slate-400'
                      }`}>
                        {u.role}
                      </span>
                      <button className="p-2 text-slate-300 hover:text-slate-600 transition-colors"><Settings size={16} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'system' && (
            <div className="p-10 space-y-10 max-w-2xl">
              <div className="space-y-6">
                <h3 className="text-base font-black uppercase tracking-widest text-slate-400">Financial Configuration</h3>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-micro text-slate-400 ml-1">Platform Fee (%)</label>
                    <input type="number" value={systemSettings.platformFee} onChange={e => setSystemSettings({...systemSettings, platformFee: parseFloat(e.target.value)})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-base outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-micro text-slate-400 ml-1">Min Errand Price (Ksh)</label>
                    <input type="number" value={systemSettings.minErrandPrice} onChange={e => setSystemSettings({...systemSettings, minErrandPrice: parseFloat(e.target.value)})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-base outline-none" />
                  </div>
                </div>
              </div>
              <div className="space-y-6">
                <h3 className="text-base font-black uppercase tracking-widest text-slate-400">Operational Controls</h3>
                <div className="flex items-center justify-between p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                  <div>
                    <h4 className="text-base font-black text-slate-900">Maintenance Mode</h4>
                    <p className="text-micro text-slate-400">Disable all new errand postings</p>
                  </div>
                  <button onClick={() => setSystemSettings({...systemSettings, maintenanceMode: !systemSettings.maintenanceMode})} className={`w-14 h-8 rounded-full transition-all relative ${systemSettings.maintenanceMode ? 'bg-red-500' : 'bg-slate-200'}`}>
                    <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${systemSettings.maintenanceMode ? 'right-1' : 'left-1'}`} />
                  </button>
                </div>
              </div>

              <div className="space-y-6">
                <h3 className="text-base font-black uppercase tracking-widest text-slate-400">API Integrations</h3>
                <div className="grid grid-cols-1 gap-4">
                  <div className="flex items-center justify-between p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
                        <Map size={20} />
                      </div>
                      <div>
                        <h4 className="text-base font-black text-slate-900">Google Maps API</h4>
                        <p className="text-micro text-slate-400">Real-time runner tracking & errand pins</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Active</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center">
                        <Sparkles size={20} />
                      </div>
                      <div>
                        <h4 className="text-base font-black text-slate-900">Gemini AI</h4>
                        <p className="text-micro text-slate-400">Smart errand parsing & automation</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Active</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
                        <ImageIcon size={20} />
                      </div>
                      <div>
                        <h4 className="text-base font-black text-slate-900">Cloudinary</h4>
                        <p className="text-micro text-slate-400">Image hosting & optimization</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Active</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <h3 className="text-base font-black uppercase tracking-widest text-slate-400">System Environment</h3>
                <div className="flex items-center justify-between p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-slate-200 text-slate-600 rounded-xl flex items-center justify-center">
                      <FileText size={20} />
                    </div>
                    <div>
                      <h4 className="text-base font-black text-slate-900">Environment File (.env)</h4>
                      <p className="text-micro text-slate-400">Download current environment configuration</p>
                    </div>
                  </div>
                  <button 
                    onClick={async () => {
                      try {
                        const { auth } = await import('../../src/lib/firebase');
                        const token = await auth.currentUser?.getIdToken();
                        const response = await fetch('/api/admin/download-env', {
                          headers: {
                            'Authorization': `Bearer ${token}`
                          }
                        });
                        if (!response.ok) throw new Error('Failed to download');
                        const blob = await response.blob();
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = '.env';
                        document.body.appendChild(a);
                        a.click();
                        window.URL.revokeObjectURL(url);
                        document.body.removeChild(a);
                      } catch (e: any) {
                        alert("Download failed: " + e.message);
                      }
                    }}
                    className="px-6 py-3 bg-black text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
                  >
                    <Download size={14} /> Download
                  </button>
                </div>
              </div>

              <button onClick={handleUpdateSettings} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase text-sm tracking-widest shadow-xl shadow-indigo-100 flex items-center justify-center gap-3">
                <Save size={18} /> Save System Configuration
              </button>
            </div>
          )}

          {activeTab === 'services' && (
            <div className="p-10 space-y-8">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black uppercase tracking-widest text-slate-400">Service Listings</h3>
                <button 
                  onClick={async () => {
                    const title = prompt("Service Title:");
                    const price = prompt("Price (Ksh):");
                    const category = prompt("Category:");
                    const description = prompt("Description:");
                    if (title && price && category) {
                      await firebaseService.addServiceListing({ 
                        title, 
                        price: parseFloat(price), 
                        category, 
                        description: description || '' 
                      });
                      // Refresh data
                      const allServices = await firebaseService.fetchServiceListings();
                      setServices(allServices);
                    }
                  }}
                  className="px-6 py-3 bg-black text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2"
                >
                  <Plus size={14} /> Add Service
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {services.map(s => (
                  <div key={s.id} className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 relative group">
                    <button 
                      onClick={async () => {
                        if (confirm("Delete this service?")) {
                          await firebaseService.deleteServiceListing(s.id);
                          setServices(services.filter(item => item.id !== s.id));
                        }
                      }}
                      className="absolute top-4 right-4 p-2 bg-white text-red-500 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                    >
                      <Trash2 size={14} />
                    </button>
                    <h4 className="text-lg font-black text-slate-900">{s.title}</h4>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{s.category}</p>
                    <p className="text-2xl font-black text-indigo-600 mt-4">Ksh {s.price}</p>
                    <p className="text-xs text-slate-500 mt-2 line-clamp-2">{s.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'featured' && (
            <div className="p-10 space-y-8">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black uppercase tracking-widest text-slate-400">Featured Services</h3>
                <button 
                  onClick={async () => {
                    const title = prompt("Service Title:");
                    const price = prompt("Price (Ksh):");
                    const category = prompt("Category:");
                    const description = prompt("Description:");
                    if (title && price && category) {
                      await firebaseService.addFeaturedService({ 
                        title, 
                        price: parseFloat(price), 
                        category, 
                        description: description || '',
                        imageUrl: 'https://picsum.photos/seed/service/800/600'
                      });
                      // Refresh data
                      const allFeatured = await firebaseService.fetchFeaturedServices();
                      setFeatured(allFeatured);
                    }
                  }}
                  className="px-6 py-3 bg-black text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2"
                >
                  <Plus size={14} /> Add Featured
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {featured.map((f, idx) => (
                  <div key={f.id} className="bg-slate-50 rounded-[2.5rem] border border-slate-100 overflow-hidden relative group">
                    <div className="aspect-video relative">
                      <img src={f.imageUrl} className="w-full h-full object-cover" alt={f.title} />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <label className="p-3 bg-white text-slate-900 rounded-2xl cursor-pointer hover:scale-110 transition-transform">
                          <Upload size={18} />
                          <input type="file" className="hidden" onChange={async e => {
                            if (e.target.files?.[0]) {
                              const url = await cloudinaryService.uploadImage(e.target.files[0]);
                              const updated = [...featured];
                              updated[idx].imageUrl = url;
                              // Update in Firestore
                              await firebaseService.updateFeaturedService(f.id, { imageUrl: url });
                              setFeatured(updated);
                            }
                          }} />
                        </label>
                        <button 
                          onClick={async () => {
                            if (confirm("Delete this featured service?")) {
                              await firebaseService.deleteFeaturedService(f.id);
                              setFeatured(featured.filter(item => item.id !== f.id));
                            }
                          }}
                          className="p-3 bg-red-500 text-white rounded-2xl hover:scale-110 transition-transform"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                    <div className="p-6">
                      <h4 className="text-lg font-black text-slate-900">{f.title}</h4>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{f.category}</p>
                      <p className="text-2xl font-black text-indigo-600 mt-4">Ksh {f.price}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'sms' && (
            <div className="p-10 space-y-10 max-w-2xl">
              <div className="space-y-6">
                <h3 className="text-base font-black uppercase tracking-widest text-slate-400">Textsasa SMS Integration</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-micro text-slate-400 ml-1">API Token</label>
                    <input 
                      type="password" 
                      placeholder="Enter Textsasa API Token"
                      className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-base outline-none" 
                      onChange={(e) => {
                        // This would ideally be saved to a secure backend setting
                        // For now, we'll just show a test interface
                      }}
                    />
                    <p className="text-[10px] text-slate-400 font-bold italic">Note: Token should be set in environment variables (TEXTSASA_API_TOKEN) for security.</p>
                  </div>
                  
                  <div className="bg-indigo-50 p-6 rounded-[2rem] border border-indigo-100 space-y-4">
                    <h4 className="text-sm font-black text-indigo-900">Test SMS Connection</h4>
                    <div className="space-y-3">
                      <input 
                        id="test-phone"
                        type="text" 
                        placeholder="Recipient Phone (e.g. 254...)" 
                        className="w-full p-3 bg-white rounded-xl text-xs font-bold outline-none"
                      />
                      <textarea 
                        id="test-message"
                        placeholder="Test Message Content" 
                        className="w-full p-3 bg-white rounded-xl text-xs font-bold outline-none h-20 resize-none"
                      />
                      <button 
                        onClick={async () => {
                          const phone = (document.getElementById('test-phone') as HTMLInputElement).value;
                          const msg = (document.getElementById('test-message') as HTMLTextAreaElement).value;
                          if (!phone || !msg) return alert("Phone and message required");
                          
                          const { smsService } = await import('../../services/firebaseService');
                          const res = await smsService.sendSMS(phone, msg);
                          if (res.success) {
                            alert("SMS Sent Successfully!");
                          } else {
                            alert("Failed to send SMS: " + JSON.stringify(res.error));
                          }
                        }}
                        className="w-full py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-100"
                      >
                        Send Test SMS
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'email' && (
            <div className="p-10 space-y-10 max-w-2xl">
              <div className="space-y-6">
                <h3 className="text-base font-black uppercase tracking-widest text-slate-400">SMTP Email Integration</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-micro text-slate-400 ml-1">SMTP Host</label>
                      <input type="text" placeholder="smtp.example.com" className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-base outline-none" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-micro text-slate-400 ml-1">SMTP Port</label>
                      <input type="number" placeholder="587" className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-base outline-none" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-micro text-slate-400 ml-1">SMTP User</label>
                      <input type="text" placeholder="user@example.com" className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-base outline-none" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-micro text-slate-400 ml-1">SMTP Password</label>
                      <input type="password" placeholder="••••••••" className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-base outline-none" />
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 font-bold italic">Note: SMTP credentials should be set in environment variables (SMTP_HOST, SMTP_USER, etc.) for security.</p>
                  
                  <div className="bg-emerald-50 p-6 rounded-[2rem] border border-emerald-100 space-y-4">
                    <h4 className="text-sm font-black text-emerald-900">Test Email Connection</h4>
                    <div className="space-y-3">
                      <input 
                        id="test-email-to"
                        type="email" 
                        placeholder="Recipient Email" 
                        className="w-full p-3 bg-white rounded-xl text-xs font-bold outline-none"
                      />
                      <input 
                        id="test-email-subject"
                        type="text" 
                        placeholder="Subject" 
                        className="w-full p-3 bg-white rounded-xl text-xs font-bold outline-none"
                      />
                      <textarea 
                        id="test-email-message"
                        placeholder="Message Content" 
                        className="w-full p-3 bg-white rounded-xl text-xs font-bold outline-none h-20 resize-none"
                      />
                      <button 
                        onClick={async () => {
                          const to = (document.getElementById('test-email-to') as HTMLInputElement).value;
                          const subject = (document.getElementById('test-email-subject') as HTMLInputElement).value;
                          const msg = (document.getElementById('test-email-message') as HTMLTextAreaElement).value;
                          if (!to || !subject || !msg) return alert("To, subject and message required");
                          
                          const { emailService } = await import('../../services/firebaseService');
                          const res = await emailService.sendEmail(to, subject, msg);
                          if (res.success) {
                            alert("Email Sent Successfully!");
                          } else {
                            alert("Failed to send email: " + JSON.stringify(res.error));
                          }
                        }}
                        className="w-full py-3 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-100"
                      >
                        Send Test Email
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'branding' && (
            <div className="p-10 space-y-10 max-w-2xl">
              <div className="space-y-6">
                <h3 className="text-base font-black uppercase tracking-widest text-slate-400">Visual Identity</h3>
                <div className="flex items-center gap-8">
                  <div className="w-32 h-32 bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden relative group">
                    {systemSettings.logoUrl ? <img src={systemSettings.logoUrl} className="w-full h-full object-cover" /> : <ImageIcon size={32} className="text-slate-200" />}
                    <button onClick={() => document.getElementById('logo-up')?.click()} className="absolute inset-0 bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><Upload size={20} /></button>
                    <input id="logo-up" type="file" className="hidden" onChange={async e => {
                      if (e.target.files?.[0]) {
                        const url = await cloudinaryService.uploadImage(e.target.files[0]);
                        setSystemSettings({...systemSettings, logoUrl: url});
                      }
                    }} />
                  </div>
                  <div className="flex-1 space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-micro text-slate-400 ml-1">App Name</label>
                      <input type="text" value={systemSettings.appName} onChange={e => setSystemSettings({...systemSettings, appName: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-base outline-none" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-micro text-slate-400 ml-1">Primary Color (Hex)</label>
                      <input type="text" value={systemSettings.primaryColor} onChange={e => setSystemSettings({...systemSettings, primaryColor: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-base outline-none" />
                    </div>
                  </div>
                </div>
              </div>
              <button onClick={handleUpdateSettings} className="w-full py-5 bg-black text-white rounded-2xl font-black uppercase text-sm tracking-widest shadow-xl flex items-center justify-center gap-3">
                <Save size={18} /> Update Branding
              </button>
            </div>
          )}

          {activeTab === 'support' && (
            <div className="grid grid-cols-1 md:grid-cols-3 h-[600px]">
              <div className="border-r border-slate-50 overflow-y-auto bg-slate-50/30">
                <div className="p-6 border-b border-slate-50 bg-white sticky top-0 z-10">
                  <h3 className="text-micro text-slate-400">Conversations</h3>
                </div>
                <div className="divide-y divide-slate-50">
                  {supportChats.length === 0 ? (
                    <div className="p-10 text-center text-micro text-slate-300">No active chats</div>
                  ) : (
                    supportChats.map(c => (
                      <button 
                        key={c.id} 
                        onClick={() => setSelectedSupportUser(c.userId)}
                        className={`w-full p-6 text-left hover:bg-white transition-all flex items-center justify-between ${selectedSupportUser === c.userId ? 'bg-white border-l-4 border-indigo-600' : ''}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-slate-200 rounded-xl flex items-center justify-center text-slate-400 font-black text-xs">
                            {c.userName?.charAt(0) || 'U'}
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-900">{c.userName || 'User'}</p>
                            <p className="text-[10px] font-bold text-slate-400 truncate max-w-[120px]">{c.lastMessage || 'No messages'}</p>
                          </div>
                        </div>
                        {c.unreadByAdmin && <div className="w-2 h-2 bg-red-500 rounded-full shrink-0 ml-2" />}
                      </button>
                    ))
                  )}
                </div>
              </div>
              <div className="md:col-span-2 bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col h-[600px]">
                {selectedSupportUser ? (
                  <SupportChatView user={user} targetUserId={selectedSupportUser} isAdmin={true} />
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-300 gap-3">
                    <MessageCircle size={48} strokeWidth={1} />
                    <p className="text-xs font-black uppercase tracking-widest">Select a conversation</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminPanel;


import React from 'react';
import { MapPin, DollarSign, Clock, Star, ChevronRight, CheckCircle2, AlertCircle, ArrowUpRight, FileText, MessageCircle, Activity, Zap, User, ArrowRight, Navigation, Home, Waves, ShoppingBag, Package, Car, ShoppingCart, Sparkles } from 'lucide-react';
import { Errand, ErrandStatus, Coordinates, ErrandCategory } from '../../types';
import { calculateDistance } from '../../services/firebaseService';

interface ErrandCardProps {
  errand: Errand;
  onClick: (errand: Errand, tab?: 'details' | 'map' | 'chat' | 'progress' | 'finish') => void;
  currentLocation: Coordinates | null;
}

export default function ErrandCard({ errand, onClick, currentLocation }: ErrandCardProps) {
  const distance = currentLocation && errand.pickupCoordinates 
    ? calculateDistance(currentLocation, errand.pickupCoordinates) 
    : null;

  const handleMapClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick(errand, 'map');
  };

  const getStatusStyles = (status: ErrandStatus) => {
    switch (status) {
      case ErrandStatus.PENDING: return 'bg-slate-100 text-slate-600';
      case ErrandStatus.BIDDING: return 'bg-blue-50 text-blue-600 border-blue-100';
      case ErrandStatus.ASSIGNED: return 'bg-indigo-50 text-indigo-600 border-indigo-100';
      case ErrandStatus.IN_PROGRESS: return 'bg-amber-50 text-amber-600 border-amber-100';
      case ErrandStatus.REVIEW: return 'bg-purple-50 text-purple-600 border-purple-100';
      case ErrandStatus.COMPLETED: return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case ErrandStatus.CANCELLED: return 'bg-red-50 text-red-600 border-red-100';
      case ErrandStatus.FAILED: return 'bg-rose-50 text-rose-600 border-rose-100';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  const getCategoryIcon = (category: ErrandCategory) => {
    switch (category) {
      case ErrandCategory.MAMA_FUA: return Waves;
      case ErrandCategory.MARKET_SHOPPING: return ShoppingBag;
      case ErrandCategory.HOUSE_HUNTING: return Home;
      case ErrandCategory.PACKAGE_DELIVERY: return Package;
      case ErrandCategory.TOWN_SERVICE: return Car;
      case ErrandCategory.SHOPPING: return ShoppingCart;
      case ErrandCategory.GIKOMBA_STRAWS: return ShoppingBag;
      default: return Sparkles;
    }
  };

  const CategoryIcon = getCategoryIcon(errand.category);

  return (
    <div 
      onClick={() => onClick(errand)}
      className="bg-white p-10 md:p-20 rounded-[4rem] border border-slate-100 shadow-sm hover:shadow-2xl hover:border-slate-200 transition-all cursor-pointer group relative overflow-hidden w-full active:scale-[0.99] min-h-[500px] flex flex-col justify-between"
    >
      {/* Background Category Accent */}
      <div className="absolute -right-20 -bottom-20 text-slate-50/50 group-hover:text-indigo-50/50 transition-colors rotate-12 scale-[2] pointer-events-none">
        <CategoryIcon size={400} />
      </div>

      {/* Top Section: Status and Distance */}
      <div className="flex items-center justify-between mb-12 relative z-10">
        <div className="flex items-center gap-6">
          <div className={`px-8 py-3 rounded-full text-xs font-black uppercase tracking-widest border shadow-sm ${getStatusStyles(errand.status)}`}>
            {errand.status}
          </div>
          {errand.category === ErrandCategory.HOUSE_HUNTING && (
            <div className="px-8 py-3 bg-indigo-50 text-indigo-600 rounded-full text-xs font-black uppercase tracking-widest border border-indigo-100 shadow-sm">
              Saka Keja
            </div>
          )}
        </div>
        
        {distance !== null && (
          <div className="flex items-center gap-3 px-6 py-3 bg-slate-50 rounded-full border border-slate-100 shadow-inner">
            <Navigation size={16} className="text-primary animate-pulse" />
            <span className="text-xs font-black text-slate-600 uppercase tracking-widest">
              {distance.toFixed(1)}km away
            </span>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="space-y-10 relative z-10">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-12">
          <div className="space-y-6 max-w-4xl">
            <h3 className="text-4xl md:text-7xl font-black leading-[0.9] text-slate-900 tracking-tighter group-hover:text-primary transition-colors">
              {errand.title}
            </h3>
            <p className="text-xl md:text-3xl text-slate-500 font-medium line-clamp-2 leading-relaxed max-w-2xl">
              {errand.description}
            </p>
          </div>
          
          <div className="text-left lg:text-right">
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Estimated Budget</p>
            <div className="text-5xl md:text-8xl font-black text-slate-900 tracking-tighter flex items-baseline gap-3 lg:justify-end">
              <span className="text-2xl md:text-3xl text-slate-400">KSH</span>
              {errand.budget?.toLocaleString()}
            </div>
          </div>
        </div>

        <div className="h-px bg-slate-100 w-full opacity-50" />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-12">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-slate-50 rounded-[2rem] flex items-center justify-center text-slate-400 shadow-inner border border-slate-100">
              <MapPin size={28} />
            </div>
            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Location</p>
              <p className="text-lg font-bold text-slate-700 truncate max-w-[200px]">{errand.pickupLocation}</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-slate-50 rounded-[2rem] flex items-center justify-center text-slate-400 shadow-inner border border-slate-100">
              <Clock size={28} />
            </div>
            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Posted</p>
              <p className="text-lg font-bold text-slate-700">
                {errand.createdAt && (
                  new Date(errand.createdAt?.seconds ? errand.createdAt.seconds * 1000 : errand.createdAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-slate-50 rounded-[2rem] flex items-center justify-center text-slate-400 shadow-inner border border-slate-100">
              <User size={28} />
            </div>
            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Requester</p>
              <p className="text-lg font-bold text-slate-700">{errand.requesterName}</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-slate-50 rounded-[2rem] flex items-center justify-center text-slate-400 shadow-inner border border-slate-100">
              <CategoryIcon size={28} />
            </div>
            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Category</p>
              <p className="text-lg font-bold text-slate-700">{errand.category}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer / Action Section */}
      <div className="mt-16 flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
        <div className="flex items-center gap-6">
          <div className="flex -space-x-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="w-14 h-14 rounded-full border-4 border-white bg-slate-100 flex items-center justify-center overflow-hidden shadow-md">
                <img src={`https://picsum.photos/seed/${i + 20}/100/100`} className="w-full h-full object-cover" alt="User" />
              </div>
            ))}
            <div className="w-14 h-14 rounded-full border-4 border-white bg-indigo-50 flex items-center justify-center text-xs font-black text-indigo-600 shadow-md">
              +{errand.bids?.length || 0}
            </div>
          </div>
          <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Active Bidders</p>
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto">
          {/* Quick Tabs for Active Errands */}
          {(errand.status === ErrandStatus.ACCEPTED || errand.status === ErrandStatus.IN_PROGRESS || errand.status === ErrandStatus.REVIEW) && (
            <div className="flex gap-2 bg-slate-50 p-2 rounded-[2rem] border border-slate-100 shadow-inner">
              {[
                { id: 'details', icon: FileText, label: 'Info' },
                { id: 'chat', icon: MessageCircle, label: 'Chat' },
                { id: 'progress', icon: Activity, label: 'Live' },
                { id: 'finish', icon: CheckCircle2, label: 'Finish' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onClick(errand, tab.id as any);
                  }}
                  className="flex items-center gap-3 px-6 py-3 rounded-2xl hover:bg-white hover:shadow-sm transition-all text-slate-500 hover:text-indigo-600 font-black text-[10px] uppercase tracking-widest"
                >
                  <tab.icon size={16} />
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          <button className="flex-1 md:flex-none px-12 py-6 bg-black text-white rounded-[2.5rem] font-black uppercase text-sm tracking-widest shadow-strong group-hover:bg-primary transition-all flex items-center justify-center gap-4">
            View Full Task
            <ArrowRight size={20} className="group-hover:translate-x-2 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
}

export const ErrandCardSkeleton = () => (
  <div className="bg-white p-10 md:p-20 rounded-[4rem] border border-slate-100 shadow-sm animate-pulse w-full min-h-[500px] flex flex-col justify-between">
    <div className="flex items-center justify-between mb-12">
      <div className="w-40 h-12 bg-slate-100 rounded-full"></div>
      <div className="w-32 h-12 bg-slate-50 rounded-full"></div>
    </div>
    
    <div className="space-y-12">
      <div className="space-y-6">
        <div className="w-3/4 h-20 bg-slate-100 rounded-3xl"></div>
        <div className="w-1/2 h-10 bg-slate-50 rounded-2xl"></div>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-12">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="flex items-center gap-6">
            <div className="w-16 h-16 bg-slate-50 rounded-[2rem]"></div>
            <div className="space-y-3">
              <div className="w-16 h-3 bg-slate-50 rounded-full"></div>
              <div className="w-24 h-5 bg-slate-100 rounded-full"></div>
            </div>
          </div>
        ))}
      </div>
    </div>

    <div className="mt-16 flex items-center justify-between">
      <div className="flex -space-x-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="w-14 h-14 rounded-full bg-slate-100 border-4 border-white"></div>
        ))}
      </div>
      <div className="w-60 h-20 bg-slate-100 rounded-[2.5rem]"></div>
    </div>
  </div>
);

export const Skeleton = ({ className }: { className?: string }) => (
  <div className={`bg-slate-100 animate-pulse rounded ${className}`}></div>
);

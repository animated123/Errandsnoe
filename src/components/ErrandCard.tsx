import React from 'react';
import { MapPin, DollarSign, Clock, Star, ChevronRight, CheckCircle2, AlertCircle, ArrowUpRight } from 'lucide-react';
import { Errand, ErrandStatus, Coordinates } from '../../types';
import { calculateDistance } from '../../services/firebaseService';

interface ErrandCardProps {
  errand: Errand;
  onClick: (errand: Errand, tab?: 'details' | 'map' | 'chat' | 'progress') => void;
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

  return (
    <div 
      onClick={() => onClick(errand)}
      className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-soft hover:shadow-strong hover:border-black/5 transition-all cursor-pointer group relative overflow-hidden max-w-md mx-auto w-full"
    >
      <div className="flex items-center justify-between mb-4">
        <div className={`px-3 py-1 rounded-full text-micro border ${getStatusStyles(errand.status)}`}>
          {errand.status}
        </div>
        <div className="flex items-center gap-1.5 text-micro text-muted-foreground">
          <Clock size={12} />
          {errand.createdAt && (
            new Date(errand.createdAt?.seconds ? errand.createdAt.seconds * 1000 : errand.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
          )}
        </div>
      </div>

      <div className="mb-4">
        <h3 className="text-lg font-black leading-tight mb-1 group-hover:text-primary transition-colors">
          {errand.title}
        </h3>
        <p className="text-sm text-muted-foreground line-clamp-2 font-medium">
          {errand.description}
        </p>
        {errand.status === ErrandStatus.COMPLETED && (errand.runnerRating || errand.requesterRating) && (
          <div className="flex items-center gap-1 mt-2">
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star 
                  key={star} 
                  size={10} 
                  className={`${star <= (errand.runnerRating || errand.requesterRating || 0) ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} 
                />
              ))}
            </div>
            <span className="text-[10px] font-black text-amber-600 ml-1">
              {(errand.runnerRating || errand.requesterRating)?.toFixed(1)}
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-secondary/50 p-3 rounded-2xl flex flex-col gap-1 relative group/loc">
          <span className="text-micro text-muted-foreground">Location</span>
          <div className="flex items-center gap-1.5 text-sm font-bold truncate">
            <MapPin size={12} className="text-primary/40" />
            <span className="truncate">{errand.pickupLocation}</span>
          </div>
          <button 
            onClick={handleMapClick}
            className="absolute top-2 right-2 p-1.5 bg-white rounded-lg shadow-sm opacity-0 group-hover/loc:opacity-100 transition-all hover:bg-black hover:text-white"
            title="View on Map"
          >
            <ArrowUpRight size={10} />
          </button>
        </div>
        <div className="bg-secondary/50 p-3 rounded-2xl flex flex-col gap-1">
          <span className="text-micro text-muted-foreground">Budget</span>
          <div className="flex items-center gap-1.5 text-sm font-black text-primary">
            <DollarSign size={12} className="text-primary/40" />
            <span>KSH {errand.budget.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-slate-50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center text-xs font-black uppercase overflow-hidden border border-white shadow-sm">
            {errand.requesterName?.[0]}
          </div>
          <div className="flex flex-col">
            <span className="text-micro text-muted-foreground">Posted by</span>
            <span className="text-xs font-bold text-foreground leading-none">
              {errand.requesterName}
            </span>
          </div>
        </div>
        
        <div className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300">
          <ArrowUpRight size={16} />
        </div>
      </div>
      
      {distance !== null && (
        <div className="absolute top-0 right-0 p-3">
          <div className="bg-black text-white px-2 py-0.5 rounded-bl-xl rounded-tr-xl text-[10px] font-black uppercase tracking-tighter">
            {distance.toFixed(1)}km
          </div>
        </div>
      )}
    </div>
  );
}

export const ErrandCardSkeleton = () => (
  <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-soft animate-pulse max-w-md mx-auto w-full">
    <div className="flex items-center justify-between mb-4">
      <div className="w-20 h-6 bg-secondary rounded-full"></div>
      <div className="w-16 h-4 bg-secondary rounded-full"></div>
    </div>
    <div className="w-3/4 h-6 bg-secondary rounded-lg mb-2"></div>
    <div className="w-full h-4 bg-secondary/50 rounded-lg mb-4"></div>
    <div className="grid grid-cols-2 gap-3 mb-5">
      <div className="h-14 bg-secondary/50 rounded-2xl"></div>
      <div className="h-14 bg-secondary/50 rounded-2xl"></div>
    </div>
    <div className="flex items-center justify-between pt-4 border-t border-slate-50">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 bg-secondary rounded-full"></div>
        <div className="space-y-1">
          <div className="w-12 h-2 bg-secondary/50 rounded"></div>
          <div className="w-20 h-3 bg-secondary rounded"></div>
        </div>
      </div>
    </div>
  </div>
);

export const Skeleton = ({ className }: { className?: string }) => (
  <div className={`bg-slate-100 animate-pulse rounded ${className}`}></div>
);

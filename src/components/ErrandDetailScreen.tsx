import React from 'react';
import { X, MapPin, DollarSign, Clock, User as UserIcon, MessageSquare, CheckCircle, Star, Shield, Navigation, Phone, Mail, ChevronLeft, Loader2 } from 'lucide-react';
import { Errand, ErrandStatus, User, UserRole } from '../../types';

interface ErrandDetailScreenProps {
  errand: Errand;
  user: User | null;
  onClose: () => void;
  onBid: (amount: number, message: string) => Promise<void>;
  onComplete: (id: string) => Promise<void>;
  onReview: (id: string, comments: string, photo?: string) => Promise<void>;
  loading: boolean;
}

export default function ErrandDetailScreen({ errand, user, onClose, onBid, onComplete, onReview, loading }: ErrandDetailScreenProps) {
  const isRequester = user?.id === errand.requesterId;
  const isRunner = user?.id === errand.runnerId;
  const canBid = user?.role === UserRole.RUNNER && !errand.runnerId && errand.status === ErrandStatus.PENDING;

  return (
    <div className="fixed inset-0 z-[100] bg-white flex flex-col animate-in slide-in-from-bottom-20 duration-500">
      {/* Header */}
      <header className="px-6 py-5 flex items-center justify-between border-b border-slate-50 sticky top-0 bg-white z-10">
        <button onClick={onClose} className="p-2 bg-slate-50 text-slate-400 hover:text-slate-900 rounded-xl transition-colors">
          <ChevronLeft size={20} />
        </button>
        <div className="text-center">
          <h2 className="text-base font-black text-slate-900 tracking-tight">Errand Details</h2>
          <p className={`text-[10px] font-black uppercase tracking-widest ${errand.status === ErrandStatus.COMPLETED ? 'text-emerald-500' : 'text-slate-400'}`}>
            {errand.status}
          </p>
        </div>
        <div className="w-10"></div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">{errand.title}</h1>
            <div className="bg-indigo-50 px-4 py-2 rounded-2xl text-indigo-600 font-black text-base">
              KSH {errand.budget}
            </div>
          </div>
          <p className="text-base font-bold text-slate-500 leading-relaxed">{errand.description}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-50 p-5 rounded-3xl space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-xl text-indigo-600 shadow-sm">
                <MapPin size={18} />
              </div>
              <div>
                <p className="text-micro text-slate-400">Pickup Location</p>
                <p className="text-sm font-black text-slate-900">{errand.pickupLocation}</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 p-5 rounded-3xl space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-xl text-emerald-600 shadow-sm">
                <Navigation size={18} />
              </div>
              <div>
                <p className="text-micro text-slate-400">Drop-off Location</p>
                <p className="text-sm font-black text-slate-900">{errand.dropoffLocation || 'Not specified'}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-xl font-black text-slate-900 tracking-tight">Requester</h3>
          <div className="bg-white p-4 rounded-3xl border border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-lg font-black text-slate-400">
                {errand.requesterName?.[0]}
              </div>
              <div>
                <p className="text-base font-black text-slate-900">{errand.requesterName}</p>
                <div className="flex items-center gap-1 text-[10px] font-black text-amber-500 uppercase tracking-widest">
                  <Star size={10} fill="currentColor" />
                  4.9 Rating
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:text-indigo-600 transition-colors">
                <Phone size={18} />
              </button>
              <button className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:text-indigo-600 transition-colors">
                <MessageSquare size={18} />
              </button>
            </div>
          </div>
        </div>

        {errand.runnerId && (
          <div className="space-y-4">
            <h3 className="text-xl font-black text-slate-900 tracking-tight">Runner</h3>
            <div className="bg-white p-4 rounded-3xl border border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-lg font-black text-indigo-400">
                  {errand.runnerName?.[0]}
                </div>
                <div>
                  <p className="text-base font-black text-slate-900">{errand.runnerName}</p>
                  <div className="flex items-center gap-1 text-[10px] font-black text-emerald-500 uppercase tracking-widest">
                    <Shield size={10} fill="currentColor" />
                    Verified Runner
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:text-indigo-600 transition-colors">
                  <Phone size={18} />
                </button>
                <button className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:text-indigo-600 transition-colors">
                  <MessageSquare size={18} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <footer className="p-6 border-t border-slate-50 bg-white sticky bottom-0">
        {canBid && (
          <button 
            onClick={() => onBid(errand.budget, "I'm interested in this task!")}
            disabled={loading}
            className="w-full py-5 bg-black text-white rounded-2xl font-black uppercase text-sm tracking-widest shadow-xl shadow-slate-200 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : "Place a Bid"}
          </button>
        )}
        {isRunner && errand.status === ErrandStatus.ASSIGNED && (
          <button 
            onClick={() => onReview(errand.id, "Task completed successfully!")}
            disabled={loading}
            className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase text-sm tracking-widest shadow-xl shadow-indigo-100 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : "Submit for Review"}
          </button>
        )}
        {isRequester && errand.status === ErrandStatus.REVIEW && (
          <button 
            onClick={() => onComplete(errand.id)}
            disabled={loading}
            className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black uppercase text-sm tracking-widest shadow-xl shadow-emerald-100 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : "Mark as Completed"}
          </button>
        )}
      </footer>
    </div>
  );
}

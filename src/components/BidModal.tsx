import React, { useState } from 'react';
import { X, DollarSign, MessageSquare, Loader2, Sparkles } from 'lucide-react';
import { Errand, User } from '../../types';

interface BidModalProps {
  isOpen: boolean;
  errand: Errand;
  onClose: () => void;
  onSubmit: (amount: number) => Promise<void>;
}

export default function BidModal({ isOpen, errand, onClose, onSubmit }: BidModalProps) {
  const [amount, setAmount] = useState(errand.budget);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit(amount);
      onClose();
    } catch (err) {
      alert("Failed to submit bid.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-10 duration-500">
        <div className="p-8 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Place a Bid</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Offer your service</p>
            </div>
            <button onClick={onClose} className="p-2 bg-slate-50 text-slate-400 hover:text-slate-900 rounded-xl transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="bg-indigo-50 p-4 rounded-2xl flex items-center gap-4">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm">
              <Sparkles className="text-indigo-600" size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Requester's Budget</p>
              <p className="text-xl font-black text-indigo-900">KSH {errand.budget}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Your Offer (KSH)</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                  <DollarSign className="text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={18} />
                </div>
                <input 
                  type="number" 
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full pl-12 pr-6 py-4 bg-slate-50 border-none rounded-2xl font-black text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all"
                  required
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full py-5 bg-black text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-slate-200 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : "Submit Bid"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

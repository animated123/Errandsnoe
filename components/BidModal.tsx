import React, { useState, useEffect } from 'react';
import { X, DollarSign, Loader2, AlertCircle } from 'lucide-react';
import { Errand, ErrandCategory } from '../types';

interface BidModalProps {
  isOpen: boolean;
  onClose: () => void;
  errand: Errand;
  onSubmit: (amount: number) => Promise<void>;
}

const BidModal: React.FC<BidModalProps> = ({ isOpen, onClose, errand, onSubmit }) => {
  const [amount, setAmount] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && errand) {
      // Default to budget for standard tasks, empty for house hunting
      if (errand.category === ErrandCategory.HOUSE_HUNTING) {
        setAmount('');
      } else {
        setAmount(errand.budget.toString());
      }
      setError(null);
    }
  }, [isOpen, errand]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const bidAmount = parseInt(amount);
    
    if (isNaN(bidAmount) || bidAmount <= 0) {
      setError("Please enter a valid amount.");
      return;
    }

    // Bid Validation: Max 50% above budget for non-house hunting
    if (errand.category !== ErrandCategory.HOUSE_HUNTING) {
      const maxAllowedBid = Math.ceil(errand.budget * 1.5);
      if (bidAmount > maxAllowedBid) {
        setError(`Bid cannot exceed Ksh ${maxAllowedBid} (50% above budget).`);
        return;
      }
    }

    setLoading(true);
    setError(null);
    try {
      await onSubmit(bidAmount);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to submit bid");
    } finally {
      setLoading(false);
    }
  };

  const isHouseHunting = errand.category === ErrandCategory.HOUSE_HUNTING;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-full max-w-sm bg-white rounded-[2rem] shadow-2xl overflow-hidden relative animate-in zoom-in-95 duration-300">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-slate-100 text-slate-400 rounded-full hover:bg-slate-200 transition-all"
        >
          <X size={20} />
        </button>

        <div className="p-8">
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
              <DollarSign size={28} strokeWidth={3} />
            </div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              {isHouseHunting ? 'Submit Proposal' : 'Accept Task'}
            </h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
              {isHouseHunting ? 'Enter your service fee' : `Budget: Ksh ${errand.budget}`}
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3 text-red-600">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <p className="text-[10px] font-black uppercase tracking-widest">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                {isHouseHunting ? 'Your Service Fee (Ksh)' : 'Your Bid Amount (Ksh)'}
              </label>
              <input 
                type="number" 
                value={amount} 
                onChange={e => setAmount(e.target.value)}
                placeholder="0"
                className="w-full p-4 bg-slate-50 border-none rounded-2xl font-black text-lg outline-none focus:ring-2 focus:ring-emerald-500/20 text-center"
                autoFocus
              />
            </div>

            {!isHouseHunting && parseInt(amount) > errand.budget && (
              <p className="text-[10px] font-bold text-amber-500 text-center bg-amber-50 p-2 rounded-xl">
                Note: Bidding higher than budget requires approval.
              </p>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-4 bg-black text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : (
                isHouseHunting ? 'Submit Proposal' : (parseInt(amount) > errand.budget ? 'Place Bid' : 'Accept Now')
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default BidModal;

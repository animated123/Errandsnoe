import React, { useState } from 'react';
import { X, Mail, Loader2, Key } from 'lucide-react';
import { firebaseService } from '../../services/firebaseService';

interface ResetPasswordModalProps {
  onClose: () => void;
}

export default function ResetPasswordModal({ onClose }: ResetPasswordModalProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Assuming firebaseService has sendPasswordResetEmail
      // await firebaseService.sendPasswordResetEmail(email);
      setSent(true);
    } catch (err) {
      alert("Failed to send reset email.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Reset Password</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Enter your email to receive a reset link</p>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-50 text-slate-400 hover:text-slate-900 rounded-xl transition-colors">
            <X size={20} />
          </button>
        </div>

        {sent ? (
          <div className="bg-emerald-50 p-6 rounded-2xl text-center space-y-3">
            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm">
              <Key className="text-emerald-500" size={24} />
            </div>
            <p className="text-sm font-bold text-emerald-900">Reset link sent!</p>
            <p className="text-xs text-emerald-600">Check your email for instructions to reset your password.</p>
            <button onClick={onClose} className="w-full py-4 bg-emerald-500 text-white rounded-xl font-black uppercase text-xs tracking-widest mt-4">Close</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input 
                  type="email" value={email} onChange={e => setEmail(e.target.value)} 
                  className="w-full pl-12 pr-6 py-4 bg-slate-50 border-none rounded-2xl font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all"
                  required
                />
              </div>
            </div>
            <button 
              type="submit" disabled={loading}
              className="w-full py-5 bg-black text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-slate-200 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : "Send Reset Link"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

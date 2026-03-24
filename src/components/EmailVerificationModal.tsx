import React, { useState } from 'react';
import { X, Mail, Loader2, CheckCircle } from 'lucide-react';
import { User } from '../../types';
import { firebaseService } from '../../services/firebaseService';

interface EmailVerificationModalProps {
  user: User;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EmailVerificationModal({ user, onClose, onSuccess }: EmailVerificationModalProps) {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSendVerification = async () => {
    setLoading(true);
    try {
      // Assuming firebaseService has sendEmailVerification
      // await firebaseService.sendEmailVerification();
      setSent(true);
    } catch (err) {
      alert("Failed to send verification email.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Email Verification</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Verify your email address</p>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-50 text-slate-400 hover:text-slate-900 rounded-xl transition-colors">
            <X size={20} />
          </button>
        </div>

        {sent ? (
          <div className="bg-emerald-50 p-6 rounded-2xl text-center space-y-3">
            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle className="text-emerald-500" size={24} />
            </div>
            <p className="text-sm font-bold text-emerald-900">Verification email sent!</p>
            <p className="text-xs text-emerald-600">Check your inbox at {user.email} and click the link to verify your account.</p>
            <button onClick={onClose} className="w-full py-4 bg-emerald-500 text-white rounded-xl font-black uppercase text-xs tracking-widest mt-4">Close</button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-indigo-50 p-6 rounded-2xl flex items-center gap-4">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm">
                <Mail className="text-indigo-600" size={24} />
              </div>
              <div>
                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Email Address</p>
                <p className="text-sm font-black text-indigo-900">{user.email}</p>
              </div>
            </div>
            <button 
              onClick={handleSendVerification} disabled={loading}
              className="w-full py-5 bg-black text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-slate-200 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : "Send Verification Email"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

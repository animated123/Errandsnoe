import React, { useState } from 'react';
import { X, Mail, Loader2, CheckCircle, ShieldCheck } from 'lucide-react';
import { User } from '../../types';
import { firebaseService } from '../../services/firebaseService';

interface EmailVerificationModalProps {
  user: User;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EmailVerificationModal({ user, onClose, onSuccess }: EmailVerificationModalProps) {
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const handleSendVerification = async () => {
    setLoading(true);
    setError('');
    try {
      await firebaseService.generateEmailVerificationCode(user.id, user.email);
      setSent(true);
    } catch (err) {
      setError("Failed to send verification email.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (code.length !== 6) {
      setError("Please enter a valid 6-digit code.");
      return;
    }
    setVerifying(true);
    setError('');
    try {
      await firebaseService.verifyEmailCode(user.id, code);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Invalid verification code.");
    } finally {
      setVerifying(false);
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
          <div className="space-y-6">
            <div className="bg-indigo-50 p-6 rounded-2xl text-center space-y-3">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm">
                <ShieldCheck className="text-indigo-500" size={24} />
              </div>
              <p className="text-sm font-bold text-indigo-900">Verification code sent!</p>
              <p className="text-xs text-indigo-600">Enter the 6-digit code sent to {user.email}</p>
            </div>

            <div className="space-y-4">
              <input 
                type="text" 
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="w-full py-5 bg-slate-50 rounded-2xl text-center text-3xl font-black tracking-[10px] outline-none border-2 border-transparent focus:border-indigo-500 transition-all"
              />
              
              {error && <p className="text-xs font-bold text-red-500 text-center">{error}</p>}

              <button 
                onClick={handleVerifyCode} disabled={verifying || code.length !== 6}
                className="w-full py-5 bg-black text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-slate-200 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
              >
                {verifying ? <Loader2 size={18} className="animate-spin" /> : "Verify Code"}
              </button>

              <button 
                onClick={handleSendVerification} disabled={loading}
                className="w-full py-3 text-slate-400 hover:text-slate-900 text-[10px] font-black uppercase tracking-widest transition-colors"
              >
                {loading ? "Sending..." : "Resend Code"}
              </button>
            </div>
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

            {error && <p className="text-xs font-bold text-red-500 text-center">{error}</p>}

            <button 
              onClick={handleSendVerification} disabled={loading}
              className="w-full py-5 bg-black text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-slate-200 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : "Send Verification Code"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

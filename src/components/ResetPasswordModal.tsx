import React, { useState } from 'react';
import { X, Mail, Loader2, Key, ShieldCheck, Lock, CheckCircle } from 'lucide-react';
import { firebaseService } from '../../services/firebaseService';

interface ResetPasswordModalProps {
  onClose: () => void;
}

export default function ResetPasswordModal({ onClose }: ResetPasswordModalProps) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'email' | 'code' | 'password' | 'success'>('email');
  const [error, setError] = useState('');
  const [userId, setUserId] = useState('');

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await firebaseService.generatePasswordResetCode(email);
      setStep('code');
    } catch (err: any) {
      setError(err.message || "Failed to send reset code.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await firebaseService.verifyPasswordResetCode(email, code);
      setUserId(res.userId);
      setStep('password');
    } catch (err: any) {
      setError(err.message || "Invalid reset code.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    setError('');
    try {
      await firebaseService.updatePassword(userId, newPassword);
      setStep('success');
    } catch (err: any) {
      setError(err.message || "Failed to reset password.");
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
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
              {step === 'email' && "Enter your email to receive a code"}
              {step === 'code' && "Enter the 6-digit code sent to your email"}
              {step === 'password' && "Create a new secure password"}
              {step === 'success' && "Your password has been updated"}
            </p>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-50 text-slate-400 hover:text-slate-900 rounded-xl transition-colors">
            <X size={20} />
          </button>
        </div>

        {step === 'email' && (
          <form onSubmit={handleSendCode} className="space-y-5">
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
            {error && <p className="text-xs font-bold text-red-500 text-center">{error}</p>}
            <button 
              type="submit" disabled={loading}
              className="w-full py-5 bg-black text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-slate-200 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : "Send Reset Code"}
            </button>
          </form>
        )}

        {step === 'code' && (
          <form onSubmit={handleVerifyCode} className="space-y-6">
            <div className="bg-indigo-50 p-6 rounded-2xl text-center space-y-3">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm">
                <ShieldCheck className="text-indigo-500" size={24} />
              </div>
              <p className="text-sm font-bold text-indigo-900">Code sent to {email}</p>
            </div>

            <div className="space-y-4">
              <input 
                type="text" 
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="w-full py-5 bg-slate-50 rounded-2xl text-center text-3xl font-black tracking-[10px] outline-none border-2 border-transparent focus:border-indigo-500 transition-all"
                required
              />
              
              {error && <p className="text-xs font-bold text-red-500 text-center">{error}</p>}

              <button 
                type="submit" disabled={loading || code.length !== 6}
                className="w-full py-5 bg-black text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-slate-200 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : "Verify Code"}
              </button>

              <button 
                type="button"
                onClick={handleSendCode} disabled={loading}
                className="w-full py-3 text-slate-400 hover:text-slate-900 text-[10px] font-black uppercase tracking-widest transition-colors"
              >
                {loading ? "Sending..." : "Resend Code"}
              </button>
            </div>
          </form>
        )}

        {step === 'password' && (
          <form onSubmit={handleResetPassword} className="space-y-5">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">New Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input 
                  type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} 
                  className="w-full pl-12 pr-6 py-4 bg-slate-50 border-none rounded-2xl font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all"
                  required
                  placeholder="At least 6 characters"
                />
              </div>
            </div>
            {error && <p className="text-xs font-bold text-red-500 text-center">{error}</p>}
            <button 
              type="submit" disabled={loading || newPassword.length < 6}
              className="w-full py-5 bg-black text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-slate-200 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : "Update Password"}
            </button>
          </form>
        )}

        {step === 'success' && (
          <div className="bg-emerald-50 p-6 rounded-2xl text-center space-y-3">
            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle className="text-emerald-500" size={24} />
            </div>
            <p className="text-sm font-bold text-emerald-900">Success!</p>
            <p className="text-xs text-emerald-600">Your password has been reset successfully. You can now log in with your new password.</p>
            <button onClick={onClose} className="w-full py-4 bg-emerald-500 text-white rounded-xl font-black uppercase text-xs tracking-widest mt-4">Back to Login</button>
          </div>
        )}
      </div>
    </div>
  );
}

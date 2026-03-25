import React, { useState } from 'react';
import { X, Phone, Loader2, Sparkles, CheckCircle } from 'lucide-react';
import { User } from '../../types';
import { firebaseService } from '../../services/firebaseService';

interface PhoneVerificationModalProps {
  user: User;
  onClose: () => void;
  onSuccess: () => void;
}

export default function PhoneVerificationModal({ user, onClose, onSuccess }: PhoneVerificationModalProps) {
  const [phone, setPhone] = useState(user.phone || '');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [loading, setLoading] = useState(false);

  const [devMode, setDevMode] = useState(false);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setDevMode(false);
    try {
      const result = await firebaseService.sendPhoneVerificationCode(phone);
      if (result.message?.includes('dev mode')) {
        setDevMode(true);
      }
      setStep('code');
    } catch (err: any) {
      alert(err.message || "Failed to send verification code.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await firebaseService.verifyPhoneCode(phone, code);
      await firebaseService.updateUserSettings(user.id, { phoneVerified: true, phone });
      onSuccess();
      onClose();
    } catch (err: any) {
      alert(err.message || "Invalid verification code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Phone Verification</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Verify your phone number to continue</p>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-50 text-slate-400 hover:text-slate-900 rounded-xl transition-colors">
            <X size={20} />
          </button>
        </div>

        {step === 'phone' ? (
          <form onSubmit={handleSendCode} className="space-y-5">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input 
                  type="tel" value={phone} onChange={e => setPhone(e.target.value)} 
                  className="w-full pl-12 pr-6 py-4 bg-slate-50 border-none rounded-2xl font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all"
                  required
                />
              </div>
            </div>
            <button 
              type="submit" disabled={loading}
              className="w-full py-5 bg-black text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-slate-200 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : "Send Code"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyCode} className="space-y-5">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Verification Code</label>
              <div className="relative">
                <CheckCircle className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input 
                  type="text" value={code} onChange={e => setCode(e.target.value)} 
                  className="w-full pl-12 pr-6 py-4 bg-slate-50 border-none rounded-2xl font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all"
                  required
                />
              </div>
            </div>
            {devMode && (
              <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest leading-relaxed">
                  Dev Mode: Check server logs for the verification code.
                </p>
              </div>
            )}
            <button 
              type="submit" disabled={loading}
              className="w-full py-5 bg-black text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-slate-200 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : "Verify Code"}
            </button>
            <button onClick={() => setStep('phone')} className="w-full text-center text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-colors">Change Phone Number</button>
          </form>
        )}
      </div>
    </div>
  );
}

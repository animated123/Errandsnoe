import React, { useState } from 'react';
import { X, Phone, ShieldCheck, Loader2, ArrowRight } from 'lucide-react';
import { firebaseService, normalizePhone, formatPhoneDisplay } from '../services/firebaseService';
import { User } from '../types';

interface PhoneVerificationModalProps {
  user: User;
  onClose: () => void;
  onSuccess: () => void;
}

const PhoneVerificationModal: React.FC<PhoneVerificationModalProps> = ({ user, onClose, onSuccess }) => {
  const [step, setStep] = useState<'input' | 'otp'>('input');
  const [phone, setPhone] = useState(user.phone || '');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSendOTP = async () => {
    setLoading(true);
    setError(null);
    try {
      const normalized = normalizePhone(phone);
      const response = await fetch('/api/auth/verify/send-package', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: normalized, type: 'phone' })
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setStep('otp');
    } catch (err: any) {
      setError(err.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    setLoading(true);
    setError(null);
    try {
      const normalized = normalizePhone(phone);
      const response = await fetch('/api/auth/verify/step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          phone: normalized, 
          smsCode: otp, 
          type: 'phone',
          userId: user.id 
        })
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      
      if (data.phoneVerified || data.fullyVerified) {
        onSuccess();
        onClose();
      } else {
        throw new Error("Invalid verification code");
      }
    } catch (err: any) {
      setError(err.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="p-8">
          <div className="flex justify-between items-center mb-8">
            <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center">
              <ShieldCheck className="text-indigo-600" size={24} />
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-full transition-colors">
              <X size={20} className="text-slate-400" />
            </button>
          </div>

          <h2 className="text-2xl font-black text-slate-900 mb-2">Verify Phone</h2>
          <p className="text-slate-500 text-sm font-medium mb-8 leading-relaxed">
            {step === 'input' 
              ? "Please confirm your phone number to receive a verification code." 
              : `We've sent a 6-digit code to ${formatPhoneDisplay(phone)}.`}
          </p>

          {error && (
            <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-xs font-bold animate-in slide-in-from-top-2">
              {error}
            </div>
          )}

          {step === 'input' ? (
            <div className="space-y-6">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="tel" 
                    value={phone} 
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+254..."
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-2xl font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  />
                </div>
              </div>
              <button 
                onClick={handleSendOTP}
                disabled={loading || !phone}
                className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-[12px] uppercase tracking-[0.2em] shadow-xl shadow-indigo-100 flex items-center justify-center gap-2 hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : (
                  <>Send Code <ArrowRight size={16} /></>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Verification Code</label>
                <input 
                  type="text" 
                  maxLength={6}
                  value={otp} 
                  onChange={e => setOtp(e.target.value)}
                  placeholder="••••••"
                  className="w-full p-4 bg-slate-50 border-none rounded-2xl font-bold text-center text-2xl tracking-[0.5em] text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                />
              </div>
              <button 
                onClick={handleVerifyOTP}
                disabled={loading || otp.length < 4}
                className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-[12px] uppercase tracking-[0.2em] shadow-xl shadow-indigo-100 flex items-center justify-center gap-2 hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : "Verify & Continue"}
              </button>
              <button 
                onClick={() => setStep('input')}
                className="w-full text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-all"
              >
                Change Phone Number
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PhoneVerificationModal;

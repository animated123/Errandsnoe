import React, { useState, useEffect } from 'react';
import { X, Phone, ShieldCheck, Loader2, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { User } from '../types';
import { formatPhoneDisplay, normalizePhone } from '../services/firebaseService';

interface PhoneVerificationModalProps {
  onClose: () => void;
  user: User;
  onSuccess?: () => void;
}

const PhoneVerificationModal: React.FC<PhoneVerificationModalProps> = ({ onClose, user, onSuccess }) => {
  const [step, setStep] = useState<'input' | 'otp'>('input');
  const [phone, setPhone] = useState(user.phone || '');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timer, setTimer] = useState(0);

  useEffect(() => {
    let interval: any;
    if (timer > 0) {
      interval = setInterval(() => setTimer(prev => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const handleSendOTP = async () => {
    if (!phone) return setError('Phone number is required');
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/verify/send-package', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          phone: normalizePhone(phone),
          type: 'phone'
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to send OTP');
      
      setStep('otp');
      setTimer(60);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp) return setError('Verification code is required');
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/verify/step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          phone: normalizePhone(phone),
          smsCode: otp,
          type: 'phone',
          userId: user.id
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Invalid verification code');
      
      if (data.phoneVerified) {
        if (onSuccess) onSuccess();
        onClose();
      } else {
        throw new Error('Verification failed. Please try again.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="p-6 pb-0 flex justify-between items-start">
          <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
            <ShieldCheck size={24} />
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        <div className="p-8 pt-6">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-2">
            {step === 'input' ? 'Verify Phone' : 'Enter Code'}
          </h2>
          <p className="text-sm font-medium text-slate-500 leading-relaxed mb-8">
            {step === 'input' 
              ? 'We need to verify your phone number to ensure secure transactions and real-time updates.'
              : `We've sent a 6-digit verification code to ${formatPhoneDisplay(phone)}`}
          </p>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3 animate-in slide-in-from-top-2">
              <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs font-bold text-red-600 leading-tight">{error}</p>
            </div>
          )}

          {step === 'input' ? (
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. 0712345678"
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-slate-900 outline-none focus:border-indigo-600 focus:bg-white transition-all"
                  />
                </div>
              </div>

              <button 
                onClick={handleSendOTP}
                disabled={loading || !phone}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2 group"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : (
                  <>
                    Send Code
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Verification Code</label>
                <input 
                  type="text"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="w-full px-4 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-3xl text-center tracking-[0.5em] text-slate-900 outline-none focus:border-indigo-600 focus:bg-white transition-all placeholder:text-slate-200"
                />
              </div>

              <div className="flex flex-col gap-4">
                <button 
                  onClick={handleVerifyOTP}
                  disabled={loading || otp.length < 6}
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-100 transition-all flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 size={18} className="animate-spin" /> : (
                    <>
                      Verify & Continue
                      <CheckCircle2 size={18} />
                    </>
                  )}
                </button>

                <button 
                  onClick={handleSendOTP}
                  disabled={loading || timer > 0}
                  className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-700 disabled:text-slate-400 transition-colors"
                >
                  {timer > 0 ? `Resend code in ${timer}s` : 'Resend Code'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 p-6 flex items-center justify-center gap-2">
          <ShieldCheck size={14} className="text-slate-400" />
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Secure 256-bit encrypted verification</span>
        </div>
      </div>
    </div>
  );
};

export default PhoneVerificationModal;

import React, { useState } from 'react';
import { X, Phone, ShieldCheck, Loader2, ArrowRight, Mail, CheckCircle } from 'lucide-react';
import { firebaseService, normalizePhone, formatPhoneDisplay } from '../services/firebaseService';
import { User } from '../types';

interface VerificationModalProps {
  user: User;
  onClose: () => void;
  onSuccess: () => void;
  type?: 'phone' | 'email' | 'both';
}

const VerificationModal: React.FC<VerificationModalProps> = ({ user, onClose, onSuccess, type = 'both' }) => {
  const [step, setStep] = useState<'input' | 'otp'>('input');
  const [phone, setPhone] = useState(user.phone || '');
  const [email, setEmail] = useState(user.email || '');
  const [smsCode, setSmsCode] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phoneVerified, setPhoneVerified] = useState(user.phoneVerified || false);
  const [emailVerified, setEmailVerified] = useState(user.emailVerified || false);

  const handleSendCodes = async () => {
    if ((type === 'phone' || type === 'both') && !phone) return setError('Phone number is required');
    if ((type === 'email' || type === 'both') && !email) return setError('Email address is required');

    setLoading(true);
    setError(null);
    try {
      const normalized = phone ? normalizePhone(phone) : '';
      const response = await fetch('/api/auth/verify/send-package', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          phone: normalized, 
          email: email,
          type: type
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || data.message || `Server error: ${response.status}`);
      }
      setStep('otp');
    } catch (err: any) {
      setError(err.message || "Failed to send verification codes");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyStep = async (verifyType: 'phone' | 'email') => {
    const code = verifyType === 'phone' ? smsCode : emailCode;
    if (code.length !== 6) return setError(`Enter 6-digit ${verifyType} code`);

    setLoading(true);
    setError(null);
    try {
      const normalized = normalizePhone(phone);
      const response = await fetch('/api/auth/verify/step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          phone: normalized, 
          email: email,
          smsCode: verifyType === 'phone' ? smsCode : undefined,
          emailCode: verifyType === 'email' ? emailCode : undefined,
          type: verifyType,
          userId: user.id 
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || data.message || `Verification failed: ${response.status}`);
      }
      
      if (verifyType === 'phone' && data.phoneVerified) setPhoneVerified(true);
      if (verifyType === 'email' && data.emailVerified) setEmailVerified(true);

      if (data.fullyVerified || (phoneVerified && data.emailVerified) || (emailVerified && data.phoneVerified)) {
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      setError(err.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
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

          <h2 className="text-2xl font-black text-slate-900 mb-2">Account Verification</h2>
          <p className="text-slate-500 text-sm font-medium mb-8 leading-relaxed">
            {step === 'input' 
              ? `Confirm your details to receive verification code via ${type === 'both' ? 'SMS and Email' : type.toUpperCase()}.` 
              : `Enter the code sent to your ${type === 'both' ? 'phone and email' : type} to complete verification.`}
          </p>

          {error && (
            <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-xs font-bold animate-in slide-in-from-top-2">
              {error}
            </div>
          )}

          {step === 'input' ? (
            <div className="space-y-6">
              <div className="space-y-4">
                {(type === 'phone' || type === 'both') && (
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
                )}
                {(type === 'email' || type === 'both') && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input 
                        type="email" 
                        value={email} 
                        onChange={e => setEmail(e.target.value)}
                        placeholder="email@example.com"
                        className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-2xl font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                      />
                    </div>
                  </div>
                )}
              </div>
              <button 
                onClick={handleSendCodes}
                disabled={loading || (type === 'phone' && !phone) || (type === 'email' && !email) || (type === 'both' && (!phone || !email))}
                className="w-full py-5 bg-black text-white rounded-2xl font-black text-[12px] uppercase tracking-[0.2em] shadow-xl active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : (
                  <>Send Verification Code{type === 'both' ? 's' : ''} <ArrowRight size={16} /></>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Phone Verification */}
              {(type === 'phone' || type === 'both') && (
                <div className={`p-5 rounded-3xl border-2 transition-all ${phoneVerified ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Phone size={14} className={phoneVerified ? 'text-emerald-600' : 'text-slate-400'} />
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-900">SMS Code</span>
                    </div>
                    {phoneVerified && <CheckCircle size={16} className="text-emerald-600" />}
                  </div>
                  {!phoneVerified ? (
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        maxLength={6}
                        value={smsCode} 
                        onChange={e => setSmsCode(e.target.value)}
                        placeholder="000000"
                        className="flex-1 p-3 bg-white rounded-xl font-black text-center text-lg tracking-[0.3em] text-slate-900 outline-none border-2 border-transparent focus:border-black transition-all"
                      />
                      <button 
                        onClick={() => handleVerifyStep('phone')}
                        disabled={loading || smsCode.length < 6}
                        className="px-4 bg-black text-white rounded-xl font-black text-[10px] uppercase tracking-widest disabled:opacity-50"
                      >
                        Verify
                      </button>
                    </div>
                  ) : (
                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Phone Verified</p>
                  )}
                </div>
              )}

              {/* Email Verification */}
              {(type === 'email' || type === 'both') && (
                <div className={`p-5 rounded-3xl border-2 transition-all ${emailVerified ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Mail size={14} className={emailVerified ? 'text-emerald-600' : 'text-slate-400'} />
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-900">Email Code</span>
                    </div>
                    {emailVerified && <CheckCircle size={16} className="text-emerald-600" />}
                  </div>
                  {!emailVerified ? (
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        maxLength={6}
                        value={emailCode} 
                        onChange={e => setEmailCode(e.target.value)}
                        placeholder="000000"
                        className="flex-1 p-3 bg-white rounded-xl font-black text-center text-lg tracking-[0.3em] text-slate-900 outline-none border-2 border-transparent focus:border-black transition-all"
                      />
                      <button 
                        onClick={() => handleVerifyStep('email')}
                        disabled={loading || emailCode.length < 6}
                        className="px-4 bg-black text-white rounded-xl font-black text-[10px] uppercase tracking-widest disabled:opacity-50"
                      >
                        Verify
                      </button>
                    </div>
                  ) : (
                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Email Verified</p>
                  )}
                </div>
              )}

              <button 
                onClick={() => setStep('input')}
                className="w-full text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-all"
              >
                Change Details
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VerificationModal;

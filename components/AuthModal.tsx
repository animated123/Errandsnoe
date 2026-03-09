import React, { useState, useEffect } from 'react';
import { X, ShoppingBag, Loader2, Phone, Mail, Key, CheckCircle } from 'lucide-react';
import { UserRole } from '../types';
import { formatFirebaseError, formatPhoneDisplay, normalizePhone } from '../services/firebaseService';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: any) => void;
  firebaseService: any;
  initialMode?: 'login' | 'register';
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onAuthSuccess, firebaseService, initialMode = 'login' }) => {
  const [isLogin, setIsLogin] = useState(initialMode === 'login');
  const [useOTP, setUseOTP] = useState(false);
  const [otpType, setOtpType] = useState<'phone' | 'email'>('phone');
  const [otpStep, setOtpStep] = useState<'phone' | 'verify'>('phone');
  const [smsCode, setSmsCode] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [smsResendTimer, setSmsResendTimer] = useState(0);
  const [emailResendTimer, setEmailResendTimer] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: UserRole.REQUESTER
  });

  useEffect(() => {
    let smsInterval: any;
    let emailInterval: any;
    if (smsResendTimer > 0) smsInterval = setInterval(() => setSmsResendTimer(t => t - 1), 1000);
    if (emailResendTimer > 0) emailInterval = setInterval(() => setEmailResendTimer(t => t - 1), 1000);
    return () => {
      clearInterval(smsInterval);
      clearInterval(emailInterval);
    };
  }, [smsResendTimer, emailResendTimer]);

  if (!isOpen) return null;

  const safeFetch = async (url: string, options: any) => {
    const res = await fetch(url, options);
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await res.json();
    }
    const text = await res.text();
    if (!res.ok) throw new Error(text || `Server error: ${res.status}`);
    return { success: true, message: text };
  };

  const handleSendVerificationPackage = async () => {
    if (otpType === 'phone' && !form.phone) return setError('Phone is required');
    if (otpType === 'email' && !form.email) return setError('Email is required');
    
    setLoading(true);
    setError(null);
    try {
      const data = await safeFetch('/api/auth/verify/send-package', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          phone: form.phone, 
          email: form.email,
          type: otpType
        })
      });
      if (data.error) throw new Error(data.error);
      setOtpStep('verify');
      if (otpType === 'phone') setSmsResendTimer(60);
      if (otpType === 'email') setEmailResendTimer(60);
    } catch (e: any) {
      setError(formatFirebaseError(e));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyStep = async (type: 'sms' | 'email') => {
    const code = type === 'sms' ? smsCode : emailCode;
    if (code.length !== 6) return setError(`Enter 6-digit ${type === 'sms' ? 'SMS' : 'email'} code`);
    
    setLoading(true);
    setError(null);
    try {
      const data = await safeFetch('/api/auth/verify/step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          phone: form.phone, 
          email: form.email,
          smsCode: type === 'sms' ? smsCode : undefined,
          emailCode: type === 'email' ? emailCode : undefined,
          type: otpType
        })
      });
      if (data.error) throw new Error(data.error);
      
      if (data.phoneVerified) setPhoneVerified(true);
      if (data.emailVerified) setEmailVerified(true);

      if (data.fullyVerified) {
        if (isLogin) {
          if (data.customToken) {
            const user = await firebaseService.signInWithToken(data.customToken);
            onAuthSuccess(user);
          } else if (data.needsRegistration) {
            setIsLogin(false);
            setUseOTP(false);
            setError("Account not found. Please register.");
            return;
          } else {
            throw new Error("Verification successful but no access token received.");
          }
        } else {
          const user = await firebaseService.register(
            form.name, 
            form.email, 
            normalizePhone(form.phone), 
            form.password,
            false,
            data.phoneVerified || data.fullyVerified
          );
          onAuthSuccess(user);
        }
        onClose();
      }
    } catch (e: any) {
      setError(formatFirebaseError(e));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (isLogin) {
        const user = await firebaseService.login(form.email, form.password);
        onAuthSuccess(user);
        onClose();
      } else {
        // For registration, trigger dual verification first
        await handleSendVerificationPackage();
        setUseOTP(true);
      }
    } catch (err: any) {
      setError(formatFirebaseError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden relative animate-in zoom-in-95 duration-300">
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-2 bg-slate-100 text-slate-400 rounded-xl hover:bg-slate-200 transition-all"
        >
          <X size={20} />
        </button>

        <div className="p-8 pt-12">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl">
              <ShoppingBag className="text-white" size={28} />
            </div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              {useOTP ? 'Verification' : (isLogin ? 'Welcome Back' : 'Join Errands')}
            </h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
              {useOTP 
                ? (isLogin ? 'Secure access via OTP' : 'Verify your details to create account') 
                : 'Login required to continue'}
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-[10px] font-black uppercase tracking-widest text-center">
              {error}
            </div>
          )}

          {useOTP ? (
            <div className="space-y-6">
              {otpStep === 'phone' ? (
                <div className="space-y-4">
                  <div className="flex p-1 bg-slate-100 rounded-2xl mb-2">
                    <button 
                      onClick={() => setOtpType('phone')}
                      className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${otpType === 'phone' ? 'bg-white text-black shadow-sm' : 'text-slate-400'}`}
                    >
                      Phone
                    </button>
                    <button 
                      onClick={() => setOtpType('email')}
                      className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${otpType === 'email' ? 'bg-white text-black shadow-sm' : 'text-slate-400'}`}
                    >
                      Email
                    </button>
                  </div>

                  {otpType === 'phone' ? (
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Phone Number</label>
                      <input 
                        type="tel" 
                        value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}
                        placeholder="+254..."
                        className="w-full p-4 bg-slate-50 border-none rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-black/5"
                      />
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">{isLogin ? 'Email or Phone Number' : 'Email Address'}</label>
                      <input 
                        type="text" 
                        value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                        placeholder={isLogin ? "email@example.com or 07..." : "email@example.com"}
                        className="w-full p-4 bg-slate-50 border-none rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-black/5"
                      />
                    </div>
                  )}
                  <button 
                    onClick={handleSendVerificationPackage} 
                    disabled={loading}
                    className="w-full py-5 bg-black text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all"
                  >
                    {loading ? <Loader2 className="animate-spin mx-auto" /> : `Send ${otpType.toUpperCase()} Code`}
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* SMS Verification Card */}
                  {otpType === 'phone' && (
                    <div className={`p-6 rounded-3xl border-2 transition-all ${phoneVerified ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <Phone size={16} className={phoneVerified ? 'text-emerald-600' : 'text-slate-400'} />
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-900">Phone Verification</span>
                        </div>
                        {phoneVerified && <CheckCircle size={16} className="text-emerald-600" />}
                      </div>
                      
                      {!phoneVerified ? (
                        <div className="space-y-4">
                          <input 
                            type="text" 
                            maxLength={6} 
                            value={smsCode} 
                            onChange={e => setSmsCode(e.target.value)} 
                            placeholder="000000"
                            className="w-full p-4 bg-white rounded-2xl font-black text-xl text-center tracking-[0.5em] outline-none border-2 border-transparent focus:border-black transition-all" 
                          />
                          <div className="flex gap-2">
                            <button 
                              onClick={() => handleVerifyStep('sms')} 
                              disabled={loading}
                              className="flex-1 py-3 bg-black text-white rounded-xl font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all"
                            >
                              Verify SMS
                            </button>
                            <button 
                              disabled={smsResendTimer > 0 || loading} 
                              onClick={handleSendVerificationPackage}
                              className="px-4 py-3 border-2 border-slate-200 rounded-xl font-black uppercase text-[10px] tracking-widest text-slate-400 disabled:opacity-50"
                            >
                              {smsResendTimer > 0 ? `${smsResendTimer}s` : 'Resend'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Phone number verified successfully</p>
                      )}
                    </div>
                  )}

                  {/* Email Verification Card */}
                  {otpType === 'email' && (
                    <div className={`p-6 rounded-3xl border-2 transition-all ${emailVerified ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <Mail size={16} className={emailVerified ? 'text-emerald-600' : 'text-slate-400'} />
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-900">Email Verification</span>
                        </div>
                        {emailVerified && <CheckCircle size={16} className="text-emerald-600" />}
                      </div>
                      
                      {!emailVerified ? (
                        <div className="space-y-4">
                          <input 
                            type="text" 
                            maxLength={6} 
                            value={emailCode} 
                            onChange={e => setEmailCode(e.target.value)} 
                            placeholder="000000"
                            className="w-full p-4 bg-white rounded-2xl font-black text-xl text-center tracking-[0.5em] outline-none border-2 border-transparent focus:border-black transition-all" 
                          />
                          <div className="flex gap-2">
                            <button 
                              onClick={() => handleVerifyStep('email')} 
                              disabled={loading}
                              className="flex-1 py-3 bg-black text-white rounded-xl font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all"
                            >
                              Verify Email
                            </button>
                            <button 
                              disabled={emailResendTimer > 0 || loading} 
                              onClick={handleSendVerificationPackage}
                              className="px-4 py-3 border-2 border-slate-200 rounded-xl font-black uppercase text-[10px] tracking-widest text-slate-400 disabled:opacity-50"
                            >
                              {emailResendTimer > 0 ? `${emailResendTimer}s` : 'Resend'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Email address verified successfully</p>
                      )}
                    </div>
                  )}

                  <button onClick={() => setOtpStep('phone')} className="w-full text-[10px] font-black uppercase tracking-widest text-indigo-600">Change Details</button>
                </div>
              )}
              <div className="pt-4 border-t border-slate-100 text-center">
                <button onClick={() => setUseOTP(false)} className="text-[10px] font-black uppercase tracking-widest text-slate-400">Back to Email Login</button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Full Name</label>
                    <input 
                      type="text" required
                      value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                      placeholder="John Doe"
                      className="w-full p-4 bg-slate-50 border-none rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-black/5"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Phone Number</label>
                    <input 
                      type="tel" required
                      value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}
                      placeholder="+254..."
                      className="w-full p-4 bg-slate-50 border-none rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-black/5"
                    />
                  </div>
                </>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">{isLogin ? 'Email or Phone Number' : 'Email Address'}</label>
                <input 
                  type="text" required
                  value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                  placeholder={isLogin ? "email@example.com or 07..." : "email@example.com"}
                  className="w-full p-4 bg-slate-50 border-none rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-black/5"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Password</label>
                <input 
                  type="password" required
                  value={form.password} onChange={e => setForm({...form, password: e.target.value})}
                  placeholder="••••••••"
                  className="w-full p-4 bg-slate-50 border-none rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-black/5"
                />
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full py-5 bg-black text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all mt-4 flex items-center justify-center gap-3"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : (isLogin ? 'Sign In' : 'Register')}
              </button>

              {isLogin && (
                <>
                  <div className="mt-6 flex items-center gap-4">
                    <div className="flex-1 h-px bg-slate-100" />
                    <span className="text-[8px] font-black text-slate-300 uppercase">OR</span>
                    <div className="flex-1 h-px bg-slate-100" />
                  </div>

                  <button 
                    type="button"
                    onClick={() => setUseOTP(true)}
                    className="w-full py-4 border-2 border-slate-100 rounded-2xl font-black text-[10px] uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                  >
                    <Phone size={14} /> Login with Phone (OTP)
                  </button>
                </>
              )}
            </form>
          )}

          <div className="mt-8 text-center">
            <button 
              onClick={() => setIsLogin(!isLogin)}
              className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-black transition-colors"
            >
              {isLogin ? "Don't have an account? Register" : "Already have an account? Login"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;

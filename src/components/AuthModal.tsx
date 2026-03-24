import React, { useState } from 'react';
import { X, Mail, Lock, User as UserIcon, Phone, Loader2, Sparkles, ArrowRight } from 'lucide-react';
import { UserRole, User } from '../../types';
import { firebaseService } from '../../services/firebaseService';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: User) => void;
  initialMode: 'login' | 'register';
}

export default function AuthModal({ isOpen, onClose, onAuthSuccess, initialMode }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [authForm, setAuthForm] = useState({ name: '', email: '', phone: '', password: '', role: UserRole.REQUESTER });
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setError(null);
    try {
      let user;
      if (mode === 'login') {
        user = await firebaseService.login(authForm.email, authForm.password);
      } else {
        user = await firebaseService.register(authForm.name, authForm.email, authForm.phone, authForm.password);
      }
      onAuthSuccess(user);
      onClose();
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-10 duration-500">
        <div className="p-8 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">{mode === 'login' ? 'Welcome Back' : 'Join Us'}</h2>
              <p className="text-micro text-slate-400 font-bold uppercase tracking-widest">{mode === 'login' ? 'Sign in to continue' : 'Create your account'}</p>
            </div>
            <button onClick={onClose} className="p-2 bg-slate-50 text-slate-400 hover:text-slate-900 rounded-xl transition-colors">
              <X size={20} />
            </button>
          </div>

          {error && (
            <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-xs font-black uppercase tracking-widest border border-red-100/50 text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div className="space-y-2">
                <label className="text-micro font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                    <UserIcon className="text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={18} />
                  </div>
                  <input 
                    type="text" 
                    value={authForm.name}
                    onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}
                    className="w-full pl-12 pr-6 py-4 bg-slate-50 border-none rounded-2xl font-black text-slate-900 text-base outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all"
                    required
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-micro font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                  <Mail className="text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={18} />
                </div>
                <input 
                  type="email" 
                  value={authForm.email}
                  onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                  className="w-full pl-12 pr-6 py-4 bg-slate-50 border-none rounded-2xl font-black text-slate-900 text-base outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all"
                  required
                />
              </div>
            </div>

            {mode === 'register' && (
              <div className="space-y-2">
                <label className="text-micro font-black text-slate-400 uppercase tracking-widest ml-1">Phone Number</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                    <Phone className="text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={18} />
                  </div>
                  <input 
                    type="tel" 
                    value={authForm.phone}
                    onChange={(e) => setAuthForm({ ...authForm, phone: e.target.value })}
                    className="w-full pl-12 pr-6 py-4 bg-slate-50 border-none rounded-2xl font-black text-slate-900 text-base outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all"
                    required
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-micro font-black text-slate-400 uppercase tracking-widest ml-1">Password</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                  <Lock className="text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={18} />
                </div>
                <input 
                  type="password" 
                  value={authForm.password}
                  onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                  className="w-full pl-12 pr-6 py-4 bg-slate-50 border-none rounded-2xl font-black text-slate-900 text-base outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all"
                  required
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={isProcessing}
              className="w-full py-5 bg-black text-white rounded-2xl font-black uppercase text-sm tracking-widest shadow-xl shadow-slate-200 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3 mt-4"
            >
              {isProcessing ? <Loader2 size={18} className="animate-spin" /> : mode === 'login' ? "Sign In" : "Create Account"}
              {!isProcessing && <ArrowRight size={16} />}
            </button>
          </form>

          <div className="text-center pt-2">
            <button 
              onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
              className="text-xs font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-colors"
            >
              {mode === 'login' ? "Don't have an account? Join Us" : "Already have an account? Sign In"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

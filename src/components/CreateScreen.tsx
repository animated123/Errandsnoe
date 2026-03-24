import React, { useState } from 'react';
import { ErrandCategory, User, UserRole } from '../../types';
import { Plus, MapPin, DollarSign, Calendar, Clock, Loader2, Sparkles, AlertCircle, ShoppingBag, Car, ShoppingCart, Waves, Home, Package, Info } from 'lucide-react';

interface CreateScreenProps {
  user: User | null;
  errandForm: any;
  setErrandForm: (form: any) => void;
  postErrand: (e: any) => void;
  loading: boolean;
  errors: any;
}

export default function CreateScreen({ user, errandForm, setErrandForm, postErrand, loading, errors }: CreateScreenProps) {
  const categories = [
    { id: ErrandCategory.GENERAL, label: 'General Task', icon: Sparkles, color: 'bg-indigo-50 text-indigo-600' },
    { id: ErrandCategory.MAMA_FUA, label: 'Mama Fua', icon: Waves, color: 'bg-blue-50 text-blue-600' },
    { id: ErrandCategory.MARKET_SHOPPING, label: 'Market Shopping', icon: ShoppingBag, color: 'bg-emerald-50 text-emerald-600' },
    { id: ErrandCategory.HOUSE_HUNTING, label: 'House Hunting', icon: Home, color: 'bg-amber-50 text-amber-600' },
    { id: ErrandCategory.PACKAGE_DELIVERY, label: 'Package Delivery', icon: Package, color: 'bg-rose-50 text-rose-600' },
    { id: ErrandCategory.TOWN_SERVICE, label: 'Town Service', icon: Car, color: 'bg-slate-50 text-slate-600' },
    { id: ErrandCategory.SHOPPING, label: 'Shopping', icon: ShoppingCart, color: 'bg-purple-50 text-purple-600' },
  ];

  return (
    <div className="space-y-6 pb-20">
      <div className="px-2">
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Create Errand</h2>
        <p className="text-micro text-slate-400 font-bold uppercase tracking-widest">Tell us what you need help with</p>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar px-2">
        {categories.map((cat) => {
          const Icon = cat.icon;
          const isActive = errandForm.category === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setErrandForm({ ...errandForm, category: cat.id })}
              className={`flex-shrink-0 px-5 py-4 rounded-2xl border transition-all flex flex-col items-center gap-2 ${
                isActive ? 'bg-black border-black text-white shadow-xl scale-105' : 'bg-white border-slate-100 text-slate-400 hover:border-indigo-100'
              }`}
            >
              <Icon size={20} className={isActive ? 'text-white' : cat.color.split(' ')[1]} />
              <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">{cat.label}</span>
            </button>
          );
        })}
      </div>

      <form onSubmit={postErrand} className="space-y-6 px-2">
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-5">
          <div className="space-y-2">
            <label className="text-micro font-black text-slate-400 uppercase tracking-widest ml-1">Task Title</label>
            <input 
              type="text" 
              value={errandForm.title}
              onChange={(e) => setErrandForm({ ...errandForm, title: e.target.value })}
              placeholder="e.g. Buy groceries from Naivas"
              className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-black text-slate-900 text-base outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-micro font-black text-slate-400 uppercase tracking-widest ml-1">Description</label>
            <textarea 
              value={errandForm.description}
              onChange={(e) => setErrandForm({ ...errandForm, description: e.target.value })}
              placeholder="Provide more details about the task..."
              className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-bold text-slate-900 text-base outline-none h-32 resize-none focus:ring-2 focus:ring-indigo-500/10 transition-all"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-micro font-black text-slate-400 uppercase tracking-widest ml-1">Pickup Location</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                  <MapPin className="text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={18} />
                </div>
                <input 
                  type="text" 
                  value={errandForm.pickup?.name || ''}
                  onChange={(e) => setErrandForm({ ...errandForm, pickup: { name: e.target.value, coords: { lat: 0, lng: 0 } } })}
                  placeholder="Where to start?"
                  className="w-full pl-12 pr-6 py-4 bg-slate-50 border-none rounded-2xl font-black text-slate-900 text-base outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-micro font-black text-slate-400 uppercase tracking-widest ml-1">Budget (KSH)</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                  <DollarSign className="text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={18} />
                </div>
                <input 
                  type="number" 
                  value={errandForm.budget}
                  onChange={(e) => setErrandForm({ ...errandForm, budget: Number(e.target.value) })}
                  className="w-full pl-12 pr-6 py-4 bg-slate-50 border-none rounded-2xl font-black text-slate-900 text-base outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all"
                  required
                />
              </div>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-5 bg-black text-white rounded-2xl font-black uppercase text-sm tracking-widest shadow-xl shadow-slate-200 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3 mt-4"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : "Post Errand Now"}
            {!loading && <Plus size={16} />}
          </button>
        </div>
      </form>
    </div>
  );
}

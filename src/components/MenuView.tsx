import React from 'react';
import { Search, Filter, Star, Plus, ShoppingBag, Waves, Home, Package, Car, ShoppingCart, Sparkles, Loader2 } from 'lucide-react';
import { ServiceListing, ErrandCategory } from '../../types';
import { Skeleton } from './ErrandCard';

interface MenuViewProps {
  listings: ServiceListing[];
  onSelect: (listing: ServiceListing) => void;
  isLoading?: boolean;
}

export default function MenuView({ listings, onSelect, isLoading }: MenuViewProps) {
  const categories = [
    { id: ErrandCategory.MAMA_FUA, label: 'Laundry', icon: Waves, color: 'bg-blue-50 text-blue-600' },
    { id: ErrandCategory.MARKET_SHOPPING, label: 'Market', icon: ShoppingBag, color: 'bg-emerald-50 text-emerald-600' },
    { id: ErrandCategory.HOUSE_HUNTING, label: 'Housing', icon: Home, color: 'bg-amber-50 text-amber-600' },
    { id: ErrandCategory.PACKAGE_DELIVERY, label: 'Delivery', icon: Package, color: 'bg-rose-50 text-rose-600' },
    { id: ErrandCategory.TOWN_SERVICE, label: 'Town', icon: Car, color: 'bg-slate-50 text-slate-600' },
    { id: ErrandCategory.SHOPPING, label: 'Shopping', icon: ShoppingCart, color: 'bg-purple-50 text-purple-600' },
  ];

  return (
    <div className="space-y-6 pb-20">
      <div className="px-2">
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Services</h2>
        <p className="text-micro text-slate-400 font-bold uppercase tracking-widest">Browse available services</p>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar px-2">
        {categories.map((cat) => {
          const Icon = cat.icon;
          return (
            <button
              key={cat.id}
              className="flex-shrink-0 px-5 py-4 bg-white rounded-2xl border border-slate-100 text-slate-400 hover:border-indigo-100 transition-all flex flex-col items-center gap-2"
            >
              <Icon size={20} className={cat.color.split(' ')[1]} />
              <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">{cat.label}</span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 px-2">
        {isLoading ? (
          [1, 2, 3, 4].map((i) => (
            <div key={`skeleton-listing-${i}`} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <Skeleton className="w-12 h-12 rounded-2xl" />
                <Skeleton className="w-20 h-6 rounded-full" />
              </div>
              <Skeleton className="w-3/4 h-6 mb-2" />
              <Skeleton className="w-full h-4 mb-1" />
              <Skeleton className="w-2/3 h-4 mb-4" />
              <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                <Skeleton className="w-24 h-4" />
                <Skeleton className="w-8 h-8 rounded-xl" />
              </div>
            </div>
          ))
        ) : listings.length === 0 ? (
          <div className="col-span-full p-20 text-center bg-white rounded-[3rem] border border-slate-100 shadow-sm">
            <Sparkles size={48} className="mx-auto mb-4 text-slate-200" />
            <h3 className="text-xl font-black text-slate-900 mb-1">No services found</h3>
            <p className="text-sm font-bold text-slate-400">Try adjusting your filters or search.</p>
          </div>
        ) : (
          listings.map((listing) => (
            <div 
              key={listing.id}
              onClick={() => onSelect(listing)}
              className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all group cursor-pointer"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center">
                  <ShoppingBag className="text-indigo-600" size={24} />
                </div>
                <div className="bg-emerald-50 px-3 py-1 rounded-full text-xs font-black text-emerald-600 uppercase tracking-widest">
                  KSH {listing.price}
                </div>
              </div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight mb-2 group-hover:text-indigo-600 transition-colors">
                {listing.title}
              </h3>
              <p className="text-sm font-bold text-slate-400 line-clamp-2 mb-4">
                {listing.description}
              </p>
              <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                <div className="flex items-center gap-1 text-amber-500">
                  <Star size={12} fill="currentColor" />
                  <span className="text-xs font-black uppercase tracking-widest">4.8 (120+)</span>
                </div>
                <button className="p-2 bg-black text-white rounded-xl hover:scale-110 transition-transform active:scale-95">
                  <Plus size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { ErrandCategory, User, UserRole } from '../../types';
import { Plus, MapPin, DollarSign, Calendar, Clock, Loader2, Sparkles, AlertCircle, ShoppingBag, Car, ShoppingCart, Waves, Home, Package, Info, Map as MapIcon, X, Target, Navigation } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import GoogleMapRoutePicker from './GoogleMapRoutePicker';

interface CreateScreenProps {
  user: User | null;
  errandForm: any;
  setErrandForm: (form: any) => void;
  postErrand: (e: any) => void;
  loading: boolean;
  errors: any;
  googleMapsApiKey: string;
  googlePlacesApiKey: string;
}

export default function CreateScreen({ user, errandForm, setErrandForm, postErrand, loading, errors, googleMapsApiKey, googlePlacesApiKey }: CreateScreenProps) {
  const [showMapPicker, setShowMapPicker] = useState(false);

  const handleMapConfirm = (pickup: any, dropoff: any, summary: any) => {
    setErrandForm({
      ...errandForm,
      pickup: { name: pickup.address, coords: pickup.coords, placeId: pickup.placeId },
      dropoff: { name: dropoff.address, coords: dropoff.coords, placeId: dropoff.placeId },
      estimatedDistance: summary.distance,
      estimatedDuration: summary.duration,
      distanceValue: summary.distanceValue,
      durationValue: summary.durationValue
    });
    setShowMapPicker(false);
  };
  const categories = [
    { id: ErrandCategory.GENERAL, label: 'General Task', icon: Sparkles, color: 'bg-indigo-50 text-indigo-600' },
    { id: ErrandCategory.MAMA_FUA, label: 'Mama Fua', icon: Waves, color: 'bg-blue-50 text-blue-600' },
    { id: ErrandCategory.MARKET_SHOPPING, label: 'Market Shopping', icon: ShoppingBag, color: 'bg-emerald-50 text-emerald-600' },
    { id: ErrandCategory.HOUSE_HUNTING, label: 'House Hunting', icon: Home, color: 'bg-amber-50 text-amber-600' },
    { id: ErrandCategory.PACKAGE_DELIVERY, label: 'Package Delivery', icon: Package, color: 'bg-rose-50 text-rose-600' },
    { id: ErrandCategory.TOWN_SERVICE, label: 'Town Service', icon: Car, color: 'bg-slate-50 text-slate-600' },
    { id: ErrandCategory.SHOPPING, label: 'Shopping', icon: ShoppingCart, color: 'bg-purple-50 text-purple-600' },
    { id: ErrandCategory.GIKOMBA_STRAWS, label: 'Gikomba Straws', icon: ShoppingBag, color: 'bg-orange-50 text-orange-600' },
  ];

  return (
    <div className="space-y-6 pb-20">
      <div className="px-2">
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Create Errand</h2>
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
        <div className="bg-white p-6 md:p-10 rounded-[2.5rem] border border-slate-100 shadow-sm">
          {errors?.create && (
            <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-600 mb-8">
              <AlertCircle size={18} />
              <p className="text-xs font-bold">{errors.create}</p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-micro font-black text-slate-400 uppercase tracking-widest ml-1">Task Title</label>
                <input 
                  type="text" 
                  value={errandForm.title}
                  onChange={(e) => setErrandForm({ ...errandForm, title: e.target.value })}
                  placeholder="e.g. Buy groceries from Naivas"
                  className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-black text-slate-900 text-base outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-micro font-black text-slate-400 uppercase tracking-widest ml-1">Description</label>
                <textarea 
                  value={errandForm.description}
                  onChange={(e) => setErrandForm({ ...errandForm, description: e.target.value })}
                  placeholder="Provide more details about the task..."
                  className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-bold text-slate-900 text-base outline-none h-48 resize-none focus:ring-2 focus:ring-indigo-500/10 transition-all"
                />
              </div>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4">
                <button
                  type="button"
                  onClick={() => setShowMapPicker(true)}
                  className="w-full p-6 bg-indigo-50 border-2 border-dashed border-indigo-200 rounded-[2rem] flex flex-col items-center justify-center gap-3 group hover:bg-indigo-100 hover:border-indigo-300 transition-all"
                >
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm group-hover:scale-110 transition-transform">
                    <MapIcon size={24} />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-black text-indigo-900 uppercase tracking-widest">Select Locations on Map</p>
                    <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mt-1">Pickup & Drop-off</p>
                  </div>
                </button>

                {errandForm.pickup?.name && (
                  <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl space-y-3 animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-white rounded-lg flex items-center justify-center text-emerald-600 shadow-sm mt-0.5">
                        <MapPin size={14} />
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Pickup</p>
                        <p className="text-xs font-bold text-emerald-900 truncate max-w-[200px]">{errandForm.pickup.name}</p>
                      </div>
                    </div>
                    {errandForm.dropoff?.name && (
                      <div className="flex items-start gap-3 pt-3 border-t border-emerald-100">
                        <div className="w-6 h-6 bg-white rounded-lg flex items-center justify-center text-rose-600 shadow-sm mt-0.5">
                          <Target size={14} />
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest">Drop-off</p>
                          <p className="text-xs font-bold text-rose-900 truncate max-w-[200px]">{errandForm.dropoff.name}</p>
                        </div>
                      </div>
                    )}
                    {errandForm.estimatedDistance && (
                      <div className="flex items-center gap-4 pt-3 border-t border-emerald-100">
                        <div className="flex items-center gap-1.5">
                          <Navigation size={12} className="text-slate-400" />
                          <span className="text-[10px] font-black text-slate-600">{errandForm.estimatedDistance}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock size={12} className="text-slate-400" />
                          <span className="text-[10px] font-black text-slate-600">{errandForm.estimatedDuration}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-micro font-black text-slate-400 uppercase tracking-widest ml-1">Budget (KSH)</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                      <DollarSign className="text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={18} />
                    </div>
                    <input 
                      type="number" 
                      value={errandForm.budget || ''}
                      onChange={(e) => setErrandForm({ ...errandForm, budget: Number(e.target.value) })}
                      className="w-full pl-12 pr-6 py-4 bg-slate-50 border-none rounded-2xl font-black text-slate-900 text-base outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Category Specific Fields */}
            <div className="mt-8 space-y-6">
              {(errandForm.category === ErrandCategory.MAMA_FUA || errandForm.category === ErrandCategory.GENERAL) && (
                <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl">
                  <input 
                    type="checkbox" 
                    id="isInHouse"
                    checked={errandForm.isInHouse}
                    onChange={(e) => setErrandForm({ ...errandForm, isInHouse: e.target.checked })}
                    className="w-5 h-5 rounded-lg border-slate-200 text-black focus:ring-black"
                  />
                  <label htmlFor="isInHouse" className="text-xs font-bold text-slate-600">Task is within the house (No delivery needed)</label>
                </div>
              )}

              {!errandForm.isInHouse && (errandForm.category === ErrandCategory.MAMA_FUA || errandCategoryRequiresDropoff(errandForm.category)) && (
                <div className="space-y-2">
                  <label className="text-micro font-black text-slate-400 uppercase tracking-widest ml-1">Drop-off Location</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                      <MapPin className="text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={18} />
                    </div>
                    <input 
                      type="text" 
                      value={errandForm.dropoff?.name || ''}
                      onChange={(e) => setErrandForm({ ...errandForm, dropoff: { name: e.target.value, coords: { lat: 0, lng: 0 } } })}
                      placeholder="Where to deliver?"
                      className="w-full pl-12 pr-6 py-4 bg-slate-50 border-none rounded-2xl font-black text-slate-900 text-base outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all"
                    />
                  </div>
                </div>
              )}

              {errandForm.category === ErrandCategory.HOUSE_HUNTING && (
                <div className="space-y-2">
                  <label className="text-micro font-black text-slate-400 uppercase tracking-widest ml-1">House Type</label>
                  <select 
                    value={errandForm.houseType}
                    onChange={(e) => setErrandForm({ ...errandForm, houseType: e.target.value })}
                    className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-black text-slate-900 text-base outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all appearance-none"
                  >
                    <option value="">Select House Type</option>
                    <option value="Bedsitter">Bedsitter</option>
                    <option value="One Bedroom">One Bedroom</option>
                    <option value="Two Bedroom">Two Bedroom</option>
                    <option value="Three Bedroom">Three Bedroom</option>
                    <option value="Studio">Studio</option>
                  </select>
                </div>
              )}

              {errandForm.category === ErrandCategory.TOWN_SERVICE && (
                <div className="space-y-2">
                  <label className="text-micro font-black text-slate-400 uppercase tracking-widest ml-1">Urgency</label>
                  <select 
                    value={errandForm.urgency}
                    onChange={(e) => setErrandForm({ ...errandForm, urgency: e.target.value })}
                    className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-black text-slate-900 text-base outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all appearance-none"
                  >
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              )}

              {errandForm.category === ErrandCategory.PACKAGE_DELIVERY && (
                <div className="space-y-2">
                  <label className="text-micro font-black text-slate-400 uppercase tracking-widest ml-1">Package Description</label>
                  <input 
                    type="text" 
                    value={errandForm.packageDescription}
                    onChange={(e) => setErrandForm({ ...errandForm, packageDescription: e.target.value })}
                    placeholder="What are we delivering?"
                    className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-black text-slate-900 text-base outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all"
                  />
                </div>
              )}

              {errandForm.category === ErrandCategory.SHOPPING && (
                <div className="space-y-2">
                  <label className="text-micro font-black text-slate-400 uppercase tracking-widest ml-1">Shopping List</label>
                  <textarea 
                    value={errandForm.shoppingList}
                    onChange={(e) => setErrandForm({ ...errandForm, shoppingList: e.target.value })}
                    placeholder="List the items you need..."
                    className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-bold text-slate-900 text-base outline-none h-32 resize-none focus:ring-2 focus:ring-indigo-500/10 transition-all"
                  />
                </div>
              )}

              {errandForm.category === ErrandCategory.GIKOMBA_STRAWS && (
                <div className="space-y-2">
                  <label className="text-micro font-black text-slate-400 uppercase tracking-widest ml-1">Market Section</label>
                  <input 
                    type="text" 
                    value={errandForm.marketSection}
                    onChange={(e) => setErrandForm({ ...errandForm, marketSection: e.target.value })}
                    placeholder="e.g. Shoes section, Clothes section"
                    className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-black text-slate-900 text-base outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all"
                  />
                </div>
              )}
            </div>

            <button 
              type="submit" 
              disabled={loading || !errandForm.pickup?.name}
              className="w-full py-5 bg-black text-white rounded-2xl font-black uppercase text-sm tracking-widest shadow-xl shadow-slate-200 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3 mt-8"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : "Post Errand Now"}
              {!loading && <Plus size={16} />}
            </button>
          </div>
        </form>

        {/* Map Picker Modal */}
      <AnimatePresence>
        {showMapPicker && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 md:p-10"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-5xl h-full max-h-[90vh] bg-white rounded-[3rem] overflow-hidden relative shadow-2xl"
            >
              <button 
                onClick={() => setShowMapPicker(false)}
                className="absolute top-6 right-6 z-[110] w-12 h-12 bg-white/80 backdrop-blur-md rounded-2xl flex items-center justify-center text-slate-900 shadow-xl active:scale-90 transition-all"
              >
                <X size={24} />
              </button>
              
              <GoogleMapRoutePicker 
                apiKey={googleMapsApiKey}
                placesApiKey={googlePlacesApiKey}
                onConfirm={handleMapConfirm}
                className="h-full"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function errandCategoryRequiresDropoff(category: ErrandCategory) {
  return [
    ErrandCategory.GENERAL,
    ErrandCategory.MARKET_SHOPPING,
    ErrandCategory.PACKAGE_DELIVERY,
    ErrandCategory.SHOPPING,
    ErrandCategory.GIKOMBA_STRAWS
  ].includes(category);
}


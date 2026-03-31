import React, { useState, useEffect, useCallback } from 'react';
import { ErrandCategory, User, UserRole } from '../../types';
import { Plus, MapPin, DollarSign, Calendar, Clock, Loader2, Sparkles, AlertCircle, ShoppingBag, Car, ShoppingCart, Waves, Home, Package, Info, Map as MapIcon, X, Target, Navigation, Trash2, Download, ReceiptText, ArrowRight, ChevronLeft, Calculator } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import GoogleMapRoutePicker from './GoogleMapRoutePicker';
import { firebaseService } from '../../services/firebaseService';
import { pdfService } from '../../services/pdfService';

interface CreateScreenProps {
  user: User | null;
  errandForm: any;
  setErrandForm: React.Dispatch<React.SetStateAction<any>>;
  postErrand: (e: any) => void;
  loading: boolean;
  errors: any;
  googleMapsApiKey: string;
  googlePlacesApiKey: string;
  googleRoutesApiKey: string;
}

export default function CreateScreen({ user, errandForm, setErrandForm, postErrand, loading, errors, googleMapsApiKey, googlePlacesApiKey, googleRoutesApiKey }: CreateScreenProps) {
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [newItem, setNewItem] = useState('');
  const [isEstimating, setIsEstimating] = useState(false);
  const [step, setStep] = useState(1);

  const handleEstimateCost = useCallback(async () => {
    setIsEstimating(true);
    try {
      const extraData = errandForm.category === ErrandCategory.HOUSE_HUNTING ? {
        numberOfHousesViewed: errandForm.numberOfHousesViewed || 1
      } : errandForm.category === ErrandCategory.MAMA_FUA ? {
        loadSize: errandForm.loadSize,
        serviceTypes: errandForm.serviceTypes,
        detergentProvided: errandForm.detergentProvided,
        waterAvailability: errandForm.waterAvailability,
        hangingPreference: errandForm.hangingPreference
      } : {};

      const estimation = await firebaseService.estimateErrandCost(
        errandForm.description,
        errandForm.pickup?.name || '',
        errandForm.urgency || 'Normal',
        errandForm.category,
        extraData
      );
      setErrandForm((prev: any) => ({
        ...prev,
        calculatedPrice: Math.round(estimation.breakdown.total),
        aiEstimatedScale: estimation.scale,
        aiEstimationBreakdown: estimation.breakdown,
        mamaFuaBreakdown: estimation.mamaFuaBreakdown || prev.mamaFuaBreakdown,
        propertyType: estimation.propertyType || prev.propertyType,
        vibe: estimation.vibe || prev.vibe,
        amenities: estimation.amenities?.length ? [...new Set([...(prev.amenities || []), ...estimation.amenities])] : prev.amenities
      }));
    } catch (e) {
      console.error(e);
    } finally {
      setIsEstimating(false);
    }
  }, [errandForm.description, errandForm.urgency, errandForm.pickup?.name, errandForm.category, errandForm.numberOfHousesViewed, errandForm.loadSize, errandForm.serviceTypes, errandForm.detergentProvided, errandForm.waterAvailability, errandForm.hangingPreference, setErrandForm]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (errandForm.description && errandForm.description.length > 10) {
        handleEstimateCost();
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [handleEstimateCost, errandForm.description]);

  const downloadShoppingPDF = () => {
    pdfService.downloadShoppingPDF(errandForm as any);
  };

  const addItem = () => {
    if (!newItem.trim()) return;
    const currentItems = errandForm.shoppingItems || [];
    setErrandForm({ ...errandForm, shoppingItems: [...currentItems, newItem.trim()] });
    setNewItem('');
  };

  const removeItem = (index: number) => {
    const currentItems = [...(errandForm.shoppingItems || [])];
    currentItems.splice(index, 1);
    setErrandForm({ ...errandForm, shoppingItems: currentItems });
  };

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
    { id: ErrandCategory.HOUSE_HUNTING, label: 'Saka Keja', icon: Home, color: 'bg-amber-50 text-amber-600' },
    { id: ErrandCategory.PACKAGE_DELIVERY, label: 'Package Delivery', icon: Package, color: 'bg-rose-50 text-rose-600' },
    { id: ErrandCategory.TOWN_SERVICE, label: 'Town Service', icon: Car, color: 'bg-slate-50 text-slate-600' },
    { id: ErrandCategory.SHOPPING, label: 'Shopping', icon: ShoppingCart, color: 'bg-purple-50 text-purple-600' },
    { id: ErrandCategory.GIKOMBA_STRAWS, label: 'Gikomba Straws', icon: ShoppingBag, color: 'bg-orange-50 text-orange-600' },
  ];

  const houseTypes = ['Bedsitter', '1 Bedroom', '2 Bedroom', 'Studio', 'Own Compound', 'Office Space'];
  const essentialAmenities = ['Constant Water', 'Tokens/Postpaid', 'Security (Gate/Fence)', 'Parking'];
  const lifestyleAmenities = ['Wi-Fi ready', 'Balcony', 'Tiled floors', 'Instant Shower', 'Top-floor preference', 'Ground-floor preference'];
  const runnerTasks = [
    { id: 'video', label: 'Live Video Call', desc: '5-minute WhatsApp video tour' },
    { id: 'photos', label: 'Photos of Specific Areas', desc: 'Bathroom, view, kitchen cabinets' },
    { id: 'interview', label: 'Caretaker Interview', desc: 'Ask about deposit & water' },
    { id: 'neighborhood', label: 'Neighborhood Check', desc: 'Check for mud/noise' }
  ];

  const toggleAmenity = (amenity: string) => {
    const current = errandForm.amenities || [];
    const updated = current.includes(amenity) 
      ? current.filter((a: string) => a !== amenity)
      : [...current, amenity];
    setErrandForm({ ...errandForm, amenities: updated });
  };

  const toggleRunnerTask = (taskId: string) => {
    const current = errandForm.runnerTasks || [];
    const updated = current.includes(taskId)
      ? current.filter((t: string) => t !== taskId)
      : [...current, taskId];
    setErrandForm({ ...errandForm, runnerTasks: updated });
  };

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
              onClick={() => {
                setErrandForm({ ...errandForm, category: cat.id });
                setStep(1);
              }}
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

          {(errandForm.category === ErrandCategory.SHOPPING || errandForm.category === ErrandCategory.MARKET_SHOPPING || errandForm.category === ErrandCategory.HOUSE_HUNTING || errandForm.category === ErrandCategory.MAMA_FUA) && (
            <div className="flex items-center gap-4 mb-8">
              <div className={`flex-1 h-1.5 rounded-full transition-all ${step >= 1 ? 'bg-indigo-600' : 'bg-slate-100'}`} />
              <div className={`flex-1 h-1.5 rounded-full transition-all ${step >= 2 ? 'bg-indigo-600' : 'bg-slate-100'}`} />
              {errandForm.category === ErrandCategory.HOUSE_HUNTING && (
                <div className={`flex-1 h-1.5 rounded-full transition-all ${step >= 3 ? 'bg-indigo-600' : 'bg-slate-100'}`} />
              )}
            </div>
          )}

          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.div 
                key="step1"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-8"
              >
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
                      <div className="space-y-3">
                        <label className="text-xs font-black uppercase tracking-widest text-slate-400">
                          {errandForm.category === ErrandCategory.HOUSE_HUNTING ? 'General Search Area' : 'Pickup & Drop-off Locations'}
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowMapPicker(true)}
                          className="w-full p-6 bg-indigo-50 border-2 border-dashed border-indigo-200 rounded-[2rem] flex flex-col items-center justify-center gap-3 group hover:bg-indigo-100 hover:border-indigo-300 transition-all"
                        >
                          <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm group-hover:scale-110 transition-transform">
                            <MapIcon size={24} />
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-black text-indigo-900 uppercase tracking-widest">
                              {errandForm.pickup?.name || (errandForm.category === ErrandCategory.HOUSE_HUNTING ? 'Select Area on Map' : 'Select Locations on Map')}
                            </p>
                            <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mt-1">
                              {errandForm.category === ErrandCategory.HOUSE_HUNTING ? 'Where should we look?' : 'Pickup & Drop-off'}
                            </p>
                          </div>
                        </button>
                      </div>

                      {errandForm.category !== ErrandCategory.HOUSE_HUNTING && errandForm.pickup?.name && (
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
                      <label className="text-micro font-black text-slate-400 uppercase tracking-widest ml-1">Urgency</label>
                      <div className="flex gap-2">
                        {['Normal', 'High', 'Urgent'].map((level) => (
                          <button
                            key={level}
                            type="button"
                            onClick={() => setErrandForm({ ...errandForm, urgency: level })}
                            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                              (errandForm.urgency || 'Normal') === level 
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' 
                                : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                            }`}
                          >
                            {level}
                          </button>
                        ))}
                      </div>
                    </div>

                    {errandForm.category === ErrandCategory.HOUSE_HUNTING ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-micro font-black text-slate-400 uppercase tracking-widest ml-1">Deadline</label>
                            <div className="relative">
                              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                              <input 
                                type="date" 
                                value={errandForm.deadline || ''}
                                onChange={(e) => setErrandForm({ ...errandForm, deadline: e.target.value })}
                                className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-2xl font-bold text-slate-900 text-sm outline-none focus:ring-2 focus:ring-amber-500/10 transition-all"
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-micro font-black text-slate-400 uppercase tracking-widest ml-1">Moving Date</label>
                            <div className="relative">
                              <Home className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                              <input 
                                type="date" 
                                value={errandForm.moveInDate || ''}
                                onChange={(e) => setErrandForm({ ...errandForm, moveInDate: e.target.value })}
                                className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-2xl font-bold text-slate-900 text-sm outline-none focus:ring-2 focus:ring-amber-500/10 transition-all"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="p-5 bg-amber-50 border border-amber-100 rounded-[2rem] flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-white rounded-xl text-amber-600 shadow-sm">
                              <Calculator size={18} />
                            </div>
                            <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Est. Service Fee</p>
                              <p className="text-xs font-bold text-slate-600">Autocalculated</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-black text-amber-600">
                              {isEstimating ? <Loader2 className="animate-spin inline" size={20} /> : `KSH ${errandForm.calculatedPrice || 0}`}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <label className="text-micro font-black text-slate-400 uppercase tracking-widest ml-1">Budget (KSH)</label>
                          <div className="relative group">
                            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                              {isEstimating ? <Loader2 className="text-indigo-600 animate-spin" size={18} /> : <DollarSign className="text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={18} />}
                            </div>
                            <input 
                              type="number" 
                              value={errandForm.budget || ''}
                              onChange={(e) => setErrandForm({ ...errandForm, budget: Number(e.target.value) })}
                              className="w-full pl-12 pr-6 py-4 bg-slate-50 border-none rounded-2xl font-black text-slate-900 text-base outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all"
                            />
                          </div>
                          {errandForm.aiEstimatedScale && (
                            <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest ml-1 flex items-center gap-1">
                              <Sparkles size={10} /> AI Estimated Complexity: {errandForm.aiEstimatedScale}/5
                            </p>
                          )}
                      </div>
                    )}
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

                  {!errandForm.isInHouse && errandForm.category !== ErrandCategory.SHOPPING && (errandForm.category === ErrandCategory.MAMA_FUA || errandCategoryRequiresDropoff(errandForm.category)) && (
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

                {errandForm.category === ErrandCategory.SHOPPING || errandForm.category === ErrandCategory.MARKET_SHOPPING || errandForm.category === ErrandCategory.HOUSE_HUNTING || errandForm.category === ErrandCategory.MAMA_FUA ? (
                  <button 
                    type="button" 
                    onClick={() => setStep(2)}
                    disabled={!errandForm.title || (errandForm.category !== ErrandCategory.HOUSE_HUNTING && !errandForm.pickup?.name)}
                    className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase text-sm tracking-widest shadow-xl shadow-indigo-100 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3 mt-8"
                  >
                    Next: {errandForm.category === ErrandCategory.HOUSE_HUNTING ? 'Property Specs' : errandForm.category === ErrandCategory.MAMA_FUA ? 'Laundry Details' : 'Items & Quantity'} <ArrowRight size={18} />
                  </button>
                ) : (
                  <button 
                    type="submit" 
                    disabled={loading || !errandForm.pickup?.name}
                    className="w-full py-5 bg-black text-white rounded-2xl font-black uppercase text-sm tracking-widest shadow-xl shadow-slate-200 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3 mt-8"
                  >
                    {loading ? <Loader2 size={18} className="animate-spin" /> : "Post Errand Now"}
                    {!loading && <Plus size={16} />}
                  </button>
                )}
              </motion.div>
            ) : step === 2 && errandForm.category === ErrandCategory.MAMA_FUA ? (
              <motion.div 
                key="step2-mamafua"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-micro font-black text-slate-400 uppercase tracking-widest ml-1">Load Size</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['Small', 'Medium', 'Large'].map(size => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => setErrandForm({ ...errandForm, loadSize: size })}
                          className={`py-3 px-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                            errandForm.loadSize === size ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                          }`}
                        >
                          {size}
                          <p className="text-[7px] opacity-70 mt-0.5">
                            {size === 'Small' ? '1-2 Basins' : size === 'Medium' ? '3-4 Basins' : 'Full Sack'}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-micro font-black text-slate-400 uppercase tracking-widest ml-1">Service Type</label>
                    <div className="grid grid-cols-2 gap-2">
                      {['Wash & Hang', 'Hand Wash Only', 'Ironing', 'Cleaning Only'].map(type => {
                        const isSelected = (errandForm.serviceTypes || []).includes(type);
                        return (
                          <button
                            key={type}
                            type="button"
                            onClick={() => {
                              const current = errandForm.serviceTypes || [];
                              const updated = isSelected ? current.filter((t: string) => t !== type) : [...current, type];
                              setErrandForm({ ...errandForm, serviceTypes: updated });
                            }}
                            className={`py-3 px-4 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border ${
                              isSelected ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-slate-100 text-slate-400'
                            }`}
                          >
                            {type}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-micro font-black text-slate-400 uppercase tracking-widest ml-1">Detergent</label>
                      <div className="flex gap-2">
                        {[true, false].map(val => (
                          <button
                            key={val ? 'yes' : 'no'}
                            type="button"
                            onClick={() => setErrandForm({ ...errandForm, detergentProvided: val })}
                            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                              errandForm.detergentProvided === val ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-400'
                            }`}
                          >
                            {val ? 'I Provide' : 'Runner Buys'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-micro font-black text-slate-400 uppercase tracking-widest ml-1">Water Availability</label>
                      <div className="flex gap-2">
                        {['Constant', 'Buying'].map(val => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setErrandForm({ ...errandForm, waterAvailability: val })}
                            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                              errandForm.waterAvailability === val ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-400'
                            }`}
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-micro font-black text-slate-400 uppercase tracking-widest ml-1">Hanging Preference</label>
                    <div className="flex gap-2">
                      {['Indoor', 'Outdoor'].map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setErrandForm({ ...errandForm, hangingPreference: val })}
                          className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                            errandForm.hangingPreference === val ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-400'
                          }`}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>

                  {errandForm.calculatedPrice && (
                    <div className="p-5 bg-blue-50 border border-blue-100 rounded-2xl space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-micro font-black text-blue-400 uppercase tracking-widest">Estimated Service Fee</p>
                          <Calculator size={14} className="text-blue-400" />
                        </div>
                        <p className="text-2xl font-black text-blue-900">KSH {errandForm.calculatedPrice}</p>
                      </div>
                      <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Includes base fee, load size, and ironing if selected.</p>
                    </div>
                  )}

                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="flex-1 py-5 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-sm tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                      <ChevronLeft size={18} /> Back
                    </button>
                    <button 
                      type="submit" 
                      disabled={loading || !errandForm.loadSize}
                      className="flex-[2] py-5 bg-black text-white rounded-2xl font-black uppercase text-sm tracking-widest shadow-xl shadow-slate-200 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                    >
                      {loading ? <Loader2 size={18} className="animate-spin" /> : "Post Errand Now"}
                      {!loading && <Plus size={16} />}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => pdfService.downloadMamaFuaPDF(errandForm as any)}
                    className="w-full py-4 bg-blue-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:bg-black transition-all"
                  >
                    <Download size={16} /> Download Mama Fua Receipt
                  </button>
                </div>
              </motion.div>
            ) : step === 2 && (errandForm.category === ErrandCategory.SHOPPING || errandForm.category === ErrandCategory.MARKET_SHOPPING) ? (
              <motion.div 
                key="step2-shopping"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-micro font-black text-slate-400 uppercase tracking-widest ml-1">Shopping Budget (KSH)</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                        <DollarSign className="text-slate-300 group-focus-within:text-purple-600 transition-colors" size={18} />
                      </div>
                      <input 
                        type="number" 
                        value={errandForm.budget || ''}
                        onChange={(e) => setErrandForm({ ...errandForm, budget: Number(e.target.value) })}
                        placeholder="Estimated cost of items"
                        className="w-full pl-12 pr-6 py-4 bg-slate-50 border-none rounded-2xl font-black text-slate-900 text-base outline-none focus:ring-2 focus:ring-purple-500/10 transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-micro font-black text-slate-400 uppercase tracking-widest ml-1">Items Required</label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={newItem}
                        onChange={(e) => setNewItem(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addItem())}
                        placeholder="Add an item (e.g. 2kg Sugar)"
                        className="flex-1 px-5 py-4 bg-slate-50 border-none rounded-2xl font-bold text-slate-900 text-base outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all"
                      />
                      <button 
                        type="button"
                        onClick={addItem}
                        className="px-6 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all"
                      >
                        Add
                      </button>
                    </div>
                    
                    <div className="mt-4 space-y-2">
                      {(errandForm.shoppingItems || []).map((item: string, idx: number) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl shadow-sm group">
                          <span className="text-sm font-bold text-slate-700">{item}</span>
                          <button 
                            type="button"
                            onClick={() => removeItem(idx)}
                            className="text-slate-300 hover:text-rose-500 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-micro font-black text-slate-400 uppercase tracking-widest ml-1">Shopping List (Notes)</label>
                    <textarea 
                      value={errandForm.shoppingList}
                      onChange={(e) => setErrandForm({ ...errandForm, shoppingList: e.target.value })}
                      placeholder="Any specific brands or extra instructions..."
                      className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-bold text-slate-900 text-base outline-none h-32 resize-none focus:ring-2 focus:ring-indigo-500/10 transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-micro font-black text-slate-400 uppercase tracking-widest ml-1">Payment Method</label>
                    <div className="grid grid-cols-2 gap-3">
                      {['Cash on Delivery', 'Mobile Money'].map((method) => (
                        <button
                          key={method}
                          type="button"
                          onClick={() => setErrandForm({ ...errandForm, paymentMethod: method })}
                          className={`py-4 px-6 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all border-2 ${
                            errandForm.paymentMethod === method 
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100' 
                              : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200'
                          }`}
                        >
                          {method}
                        </button>
                      ))}
                    </div>
                  </div>

                  {errandForm.calculatedPrice && (
                    <div className="p-5 bg-indigo-50 border border-indigo-100 rounded-2xl space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-micro font-black text-indigo-400 uppercase tracking-widest">Calculated Service Fee</p>
                          <Sparkles size={14} className="text-indigo-400" />
                        </div>
                        <p className="text-2xl font-black text-indigo-900">KSH {errandForm.calculatedPrice}</p>
                      </div>
                      
                      <div className="pt-4 border-t border-indigo-100 flex items-center justify-between">
                        <div>
                          <p className="text-micro font-black text-slate-400 uppercase tracking-widest">Total Estimated Cost</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">(Budget + Service Fee)</p>
                        </div>
                        <p className="text-xl font-black text-indigo-600">KSH {(errandForm.budget || 0) + errandForm.calculatedPrice}</p>
                      </div>
                      
                      <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Based on task complexity and urgency</p>
                    </div>
                  )}

                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="flex-1 py-5 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-sm tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                      <ChevronLeft size={18} /> Back
                    </button>
                    <button 
                      type="submit" 
                      disabled={loading || (errandForm.shoppingItems || []).length === 0}
                      className="flex-[2] py-5 bg-black text-white rounded-2xl font-black uppercase text-sm tracking-widest shadow-xl shadow-slate-200 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                    >
                      {loading ? <Loader2 size={18} className="animate-spin" /> : "Post Errand Now"}
                      {!loading && <Plus size={16} />}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={downloadShoppingPDF}
                    className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:bg-black transition-all"
                  >
                    <Download size={16} /> Download Shopping PDF
                  </button>
                </div>
              </motion.div>
            ) : step === 2 && errandForm.category === ErrandCategory.HOUSE_HUNTING ? (
              <motion.div 
                key="step2-house"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-micro font-black text-slate-400 uppercase tracking-widest ml-1">House Type</label>
                    <div className="grid grid-cols-2 gap-2">
                      {houseTypes.map(type => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setErrandForm({ ...errandForm, houseType: type })}
                          className={`py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                            errandForm.houseType === type ? 'bg-amber-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-micro font-black text-slate-400 uppercase tracking-widest ml-1">Monthly Rent Budget (KSH)</label>
                    <div className="flex gap-4">
                      <div className="flex-1 space-y-1">
                        <p className="text-[9px] font-bold text-slate-400 uppercase">Min</p>
                        <input 
                          type="number" 
                          value={errandForm.rentBudgetMin || ''}
                          onChange={(e) => setErrandForm({ ...errandForm, rentBudgetMin: Number(e.target.value) })}
                          placeholder="e.g. 10000"
                          className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl font-black text-slate-900 text-sm outline-none focus:ring-2 focus:ring-amber-500/10 transition-all"
                        />
                      </div>
                      <div className="flex-1 space-y-1">
                        <p className="text-[9px] font-bold text-slate-400 uppercase">Max</p>
                        <input 
                          type="number" 
                          value={errandForm.rentBudgetMax || ''}
                          onChange={(e) => setErrandForm({ ...errandForm, rentBudgetMax: Number(e.target.value) })}
                          placeholder="e.g. 30000"
                          className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl font-black text-slate-900 text-sm outline-none focus:ring-2 focus:ring-amber-500/10 transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-micro font-black text-slate-400 uppercase tracking-widest ml-1">Amenities</label>
                    
                    <div className="space-y-3">
                      <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Essential</p>
                      <div className="flex flex-wrap gap-2">
                        {essentialAmenities.map(amenity => (
                          <button
                            key={amenity}
                            type="button"
                            onClick={() => toggleAmenity(amenity)}
                            className={`px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-widest transition-all border ${
                              (errandForm.amenities || []).includes(amenity) ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-white border-slate-100 text-slate-400'
                            }`}
                          >
                            {amenity}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Lifestyle</p>
                      <div className="flex flex-wrap gap-2">
                        {lifestyleAmenities.map(amenity => (
                          <button
                            key={amenity}
                            type="button"
                            onClick={() => toggleAmenity(amenity)}
                            className={`px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-widest transition-all border ${
                              (errandForm.amenities || []).includes(amenity) ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-white border-slate-100 text-slate-400'
                            }`}
                          >
                            {amenity}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-micro font-black text-slate-400 uppercase tracking-widest ml-1">Target Estates (Up to 3)</label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={newItem}
                        onChange={(e) => setNewItem(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), (() => {
                          if (!newItem.trim() || (errandForm.targetEstates || []).length >= 3) return;
                          setErrandForm({ ...errandForm, targetEstates: [...(errandForm.targetEstates || []), newItem.trim()] });
                          setNewItem('');
                        })())}
                        placeholder="e.g. Roysambu"
                        className="flex-1 px-5 py-4 bg-slate-50 border-none rounded-2xl font-bold text-slate-900 text-base outline-none focus:ring-2 focus:ring-amber-500/10 transition-all"
                      />
                      <button 
                        type="button"
                        onClick={() => {
                          if (!newItem.trim() || (errandForm.targetEstates || []).length >= 3) return;
                          setErrandForm({ ...errandForm, targetEstates: [...(errandForm.targetEstates || []), newItem.trim()] });
                          setNewItem('');
                        }}
                        className="px-6 bg-amber-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all"
                      >
                        Add
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {(errandForm.targetEstates || []).map((estate: string, idx: number) => (
                        <div key={idx} className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-[10px] font-black uppercase tracking-widest border border-amber-100">
                          {estate}
                          <button type="button" onClick={() => setErrandForm({ ...errandForm, targetEstates: errandForm.targetEstates.filter((_: any, i: number) => i !== idx) })}>
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-white rounded-xl text-amber-600 shadow-sm">
                          <Navigation size={18} />
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Commute Distance</p>
                          <p className="text-xs font-bold text-slate-600">Prioritize houses near work</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setErrandForm({ ...errandForm, commuteDistanceEnabled: !errandForm.commuteDistanceEnabled })}
                        className={`w-12 h-6 rounded-full transition-all relative ${errandForm.commuteDistanceEnabled ? 'bg-amber-600' : 'bg-slate-200'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${errandForm.commuteDistanceEnabled ? 'left-7' : 'left-1'}`} />
                      </button>
                    </div>

                    {errandForm.commuteDistanceEnabled && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="space-y-2"
                      >
                        <label className="text-micro font-black text-slate-400 uppercase tracking-widest ml-1">Work/Reference Point</label>
                        <div className="relative">
                          <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                          <input 
                            type="text" 
                            value={errandForm.commuteReferencePoint || ''}
                            onChange={(e) => setErrandForm({ ...errandForm, commuteReferencePoint: e.target.value })}
                            placeholder="e.g. Haile Selassie Avenue"
                            className="w-full pl-12 pr-6 py-4 bg-slate-50 border-none rounded-2xl font-bold text-slate-900 text-sm outline-none focus:ring-2 focus:ring-amber-500/10 transition-all"
                          />
                        </div>
                      </motion.div>
                    )}
                  </div>

                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="flex-1 py-5 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-sm tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                      <ChevronLeft size={18} /> Back
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setStep(3)}
                      disabled={!errandForm.houseType || !errandForm.targetEstates || errandForm.targetEstates.length === 0}
                      className="flex-[2] py-5 bg-amber-600 text-white rounded-2xl font-black uppercase text-sm tracking-widest shadow-xl shadow-amber-100 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                    >
                      Next: Runner Tasks <ArrowRight size={18} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : step === 3 && errandForm.category === ErrandCategory.HOUSE_HUNTING ? (
              <motion.div 
                key="step3-house"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="space-y-6">
                  <div className="space-y-4">
                    <div className="px-1">
                      <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Runner Task Checklist</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Select what the runner should do</p>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      {runnerTasks.map(task => (
                        <button
                          key={task.id}
                          type="button"
                          onClick={() => toggleRunnerTask(task.id)}
                          className={`flex items-center gap-4 p-5 rounded-[2rem] border transition-all text-left ${
                            (errandForm.runnerTasks || []).includes(task.id) ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-100'
                          }`}
                        >
                          <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                            (errandForm.runnerTasks || []).includes(task.id) ? 'bg-amber-600 border-amber-600 text-white' : 'border-slate-200'
                          }`}>
                            {(errandForm.runnerTasks || []).includes(task.id) && <Plus size={14} />}
                          </div>
                          <div>
                            <p className={`text-xs font-black uppercase tracking-widest ${
                              (errandForm.runnerTasks || []).includes(task.id) ? 'text-amber-900' : 'text-slate-600'
                            }`}>{task.label}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{task.desc}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="p-5 bg-amber-50 border border-amber-100 rounded-2xl space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-micro font-black text-amber-600 uppercase tracking-widest">Scouting Fee (Base)</p>
                        <Home size={14} className="text-amber-400" />
                      </div>
                      <p className="text-2xl font-black text-amber-900">KSH 500</p>
                    </div>
                    
                    <div className="pt-4 border-t border-amber-100 flex items-center justify-between">
                      <div>
                        <p className="text-micro font-black text-slate-400 uppercase tracking-widest">Estimated Service Fee</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">(Includes complexity & urgency)</p>
                      </div>
                      <p className="text-xl font-black text-amber-600">KSH {errandForm.calculatedPrice || 0}</p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="flex-1 py-5 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-sm tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                      <ChevronLeft size={18} /> Back
                    </button>
                    <button 
                      type="submit" 
                      disabled={loading}
                      className="flex-[2] py-5 bg-black text-white rounded-2xl font-black uppercase text-sm tracking-widest shadow-xl shadow-slate-200 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                    >
                      {loading ? <Loader2 size={18} className="animate-spin" /> : "Post Errand Now"}
                      {!loading && <Plus size={16} />}
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
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
                apiKey={googleRoutesApiKey}
                placesApiKey={googlePlacesApiKey}
                onConfirm={handleMapConfirm}
                className="h-full"
                mode={errandForm.category === ErrandCategory.MAMA_FUA ? 'single' : 'route'}
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


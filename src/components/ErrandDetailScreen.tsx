import React, { useState } from 'react';
import { X, MapPin, DollarSign, Clock, User as UserIcon, MessageSquare, CheckCircle, Star, Shield, Navigation, Phone, Mail, ChevronLeft, Loader2, Download, Camera, Image, Trash2, Receipt, Sparkles, ShoppingCart, Check, Home, Map as MapIcon, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Errand, ErrandStatus, User, UserRole, ErrandCategory, PropertyListing, Coordinates } from '../../types';
import { pdfService } from '../../services/pdfService';
import { firebaseService } from '../../services/firebaseService';
import CameraCapture from './CameraCapture';
import MapComponent from './MapComponent';
import GoogleMapPicker from './GoogleMapPicker';

interface ErrandDetailScreenProps {
  errand: Errand;
  user: User | null;
  onClose: () => void;
  onBid: (amount: number, message: string) => Promise<void>;
  onComplete: (id: string) => Promise<void>;
  onReview: (id: string, comments: string, photo?: string) => Promise<void>;
  loading: boolean;
  googleMapsApiKey: string;
  googleRoutesApiKey: string;
}

export default function ErrandDetailScreen({ errand, user, onClose, onBid, onComplete, onReview, loading, googleMapsApiKey, googleRoutesApiKey }: ErrandDetailScreenProps) {
  const [showCamera, setShowCamera] = useState(false);
  const [cameraMode, setCameraMode] = useState<'receipt' | 'listing'>('receipt');
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'shopping' | 'map'>('details');
  const [showAddListing, setShowAddListing] = useState(false);
  const [newListing, setNewListing] = useState<Partial<PropertyListing>>({
    title: '',
    price: 0,
    location: '',
    type: errand.houseType || 'Bedsitter',
    description: '',
    runnerView: '',
    amenities: []
  });
  const [listingImage, setListingImage] = useState<string | null>(null);
  const [isSubmittingListing, setIsSubmittingListing] = useState(false);
  const [selectedListing, setSelectedListing] = useState<PropertyListing | null>(null);
  
  const isRequester = user?.id === errand.requesterId;
  const isRunner = user?.id === errand.runnerId;
  const canBid = user?.role === UserRole.RUNNER && !errand.runnerId && errand.status === ErrandStatus.PENDING;

  const handleCapture = async (dataUrl: string) => {
    if (cameraMode === 'receipt') {
      setUploadingReceipt(true);
      try {
        const url = await firebaseService.uploadFile(dataUrl, 'receipts');
        await firebaseService.updateErrand(errand.id, { receiptUrl: url });
        alert("Receipt uploaded successfully!");
      } catch (e) {
        console.error(e);
        alert("Failed to upload receipt.");
      } finally {
        setUploadingReceipt(false);
      }
    } else {
      setListingImage(dataUrl);
    }
    setShowCamera(false);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-white flex flex-col animate-in slide-in-from-bottom-20 duration-500 md:max-w-none md:rounded-none">
      {/* Header */}
      <header className="px-6 py-5 flex items-center justify-between border-b border-slate-50 sticky top-0 bg-white z-10">
        <button onClick={onClose} className="p-2 bg-slate-50 text-slate-400 hover:text-slate-900 rounded-xl transition-colors">
          <ChevronLeft size={20} />
        </button>
        <div className="text-center">
          <h2 className="text-base font-black text-slate-900 tracking-tight">Errand Details</h2>
          <p className={`text-[10px] font-black uppercase tracking-widest ${errand.status === ErrandStatus.COMPLETED ? 'text-emerald-500' : 'text-slate-400'}`}>
            {errand.status}
          </p>
        </div>
        <div className="w-10"></div>
      </header>

      {/* Tabs for Shopping/Market Shopping/House Hunting */}
      {(errand.category === ErrandCategory.SHOPPING || errand.category === ErrandCategory.MARKET_SHOPPING || errand.category === ErrandCategory.HOUSE_HUNTING) && (
        <div className="px-6 border-b border-slate-50 flex gap-8 overflow-x-auto no-scrollbar">
          <button 
            onClick={() => setActiveTab('details')}
            className={`py-4 text-xs font-black uppercase tracking-widest transition-all relative flex-shrink-0 ${activeTab === 'details' ? 'text-indigo-600' : 'text-slate-400'}`}
          >
            Details
            {activeTab === 'details' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 rounded-full" />}
          </button>
          <button 
            onClick={() => setActiveTab('shopping')}
            className={`py-4 text-xs font-black uppercase tracking-widest transition-all relative flex-shrink-0 ${activeTab === 'shopping' ? 'text-indigo-600' : 'text-slate-400'}`}
          >
            {errand.category === ErrandCategory.HOUSE_HUNTING ? 'Property Specs' : 'Shopping List'}
            {activeTab === 'shopping' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 rounded-full" />}
          </button>
          {errand.category === ErrandCategory.HOUSE_HUNTING && (
            <button 
              onClick={() => setActiveTab('map')}
              className={`py-4 text-xs font-black uppercase tracking-widest transition-all relative flex-shrink-0 ${activeTab === 'map' ? 'text-indigo-600' : 'text-slate-400'}`}
            >
              Map View
              {activeTab === 'map' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 rounded-full" />}
            </button>
          )}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {activeTab === 'details' ? (
          <>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">{errand.title}</h1>
                <div className="bg-indigo-50 px-4 py-2 rounded-2xl text-indigo-600 font-black text-base">
                  KSH {errand.budget}
                </div>
              </div>
              <p className="text-base font-bold text-slate-500 leading-relaxed">{errand.description}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-50 p-5 rounded-3xl space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-xl text-indigo-600 shadow-sm">
                    <MapPin size={18} />
                  </div>
                  <div>
                    <p className="text-micro text-slate-400">Pickup Location</p>
                    <p className="text-sm font-black text-slate-900">{errand.pickupLocation}</p>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 p-5 rounded-3xl space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-xl text-emerald-600 shadow-sm">
                    <Navigation size={18} />
                  </div>
                  <div>
                    <p className="text-micro text-slate-400">Drop-off Location</p>
                    <p className="text-sm font-black text-slate-900">{errand.dropoffLocation || 'Not specified'}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Requester</h3>
              <div className="bg-white p-4 rounded-3xl border border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-lg font-black text-slate-400">
                    {errand.requesterName?.[0]}
                  </div>
                  <div>
                    <p className="text-base font-black text-slate-900">{errand.requesterName}</p>
                    <div className="flex items-center gap-1 text-[10px] font-black text-amber-500 uppercase tracking-widest">
                      <Star size={10} fill="currentColor" />
                      4.9 Rating
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:text-indigo-600 transition-colors">
                    <Phone size={18} />
                  </button>
                  <button className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:text-indigo-600 transition-colors">
                    <MessageSquare size={18} />
                  </button>
                </div>
              </div>
            </div>

            {errand.runnerId && (
              <div className="space-y-4">
                <h3 className="text-xl font-black text-slate-900 tracking-tight">Runner</h3>
                <div className="bg-white p-4 rounded-3xl border border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-lg font-black text-indigo-400">
                      {errand.runnerName?.[0]}
                    </div>
                    <div>
                      <p className="text-base font-black text-slate-900">{errand.runnerName}</p>
                      <div className="flex items-center gap-1 text-[10px] font-black text-emerald-500 uppercase tracking-widest">
                        <Shield size={10} fill="currentColor" />
                        Verified Runner
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:text-indigo-600 transition-colors">
                      <Phone size={18} />
                    </button>
                    <button className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:text-indigo-600 transition-colors">
                      <MessageSquare size={18} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : errand.category === ErrandCategory.HOUSE_HUNTING ? (
          <div className="space-y-8">
            <div className="p-8 bg-amber-50 rounded-[3rem] border border-amber-100 space-y-8">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-amber-900 tracking-tight">Property Specifications</h3>
                <div className="px-4 py-2 bg-amber-100 text-amber-600 rounded-2xl text-xs font-black uppercase tracking-widest">
                  {errand.houseType}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Rent Budget</p>
                  <p className="text-lg font-black text-amber-900">KSH {errand.rentBudgetMin?.toLocaleString()} - {errand.rentBudgetMax?.toLocaleString()}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Target Estates</p>
                  <div className="flex flex-wrap gap-2">
                    {errand.targetEstates?.map((estate, idx) => (
                      <span key={idx} className="px-3 py-1 bg-white rounded-lg text-[10px] font-black text-amber-600 uppercase tracking-widest border border-amber-100 shadow-sm">
                        {estate}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {errand.commuteDistanceEnabled && (
                <div className="p-5 bg-white rounded-3xl border border-amber-100 shadow-sm space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-50 rounded-xl text-amber-600 shadow-sm">
                      <Navigation size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Commute Priority</p>
                      <p className="text-sm font-black text-slate-900">Near {errand.commuteReferencePoint || 'Work'}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Required Amenities</p>
                <div className="flex flex-wrap gap-2">
                  {errand.amenities?.map((amenity, idx) => (
                    <div key={idx} className="flex items-center gap-2 px-4 py-2 bg-white rounded-2xl text-xs font-bold text-slate-700 border border-amber-100 shadow-sm">
                      <div className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                      {amenity}
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-8 border-t border-amber-200 space-y-6">
                <div className="px-1">
                  <h4 className="text-sm font-black text-amber-900 uppercase tracking-widest">Runner Task Checklist</h4>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {errand.runnerTasks?.map((taskId, idx) => {
                    const taskLabels: Record<string, string> = {
                      video: 'Live Video Call',
                      photos: 'Photos of Specific Areas',
                      interview: 'Caretaker Interview',
                      neighborhood: 'Neighborhood Check'
                    };
                    return (
                      <div key={idx} className="flex items-center gap-4 p-5 bg-white rounded-3xl border border-amber-100 shadow-sm">
                        <div className="w-6 h-6 bg-amber-600 rounded-lg flex items-center justify-center text-white">
                          <Check size={14} />
                        </div>
                        <span className="text-sm font-black text-amber-900 uppercase tracking-widest">{taskLabels[taskId] || taskId}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-8 border-t border-amber-200 space-y-4">
                <div className="flex justify-between items-center px-2">
                  <span className="text-xs font-black text-amber-400 uppercase tracking-widest">Scouting Base Fee</span>
                  <span className="text-lg font-black text-amber-900">KSH 500</span>
                </div>
                {errand.calculatedPrice && (
                  <>
                    <div className="flex justify-between items-center px-2">
                      <div className="flex items-center gap-2">
                        <Sparkles size={14} className="text-amber-400" />
                        <span className="text-xs font-black text-amber-400 uppercase tracking-widest">Service Fee</span>
                      </div>
                      <span className="text-lg font-black text-amber-900">KSH {errand.calculatedPrice}</span>
                    </div>
                    
                    <div className="flex justify-between items-center p-5 bg-amber-600 rounded-3xl shadow-lg shadow-amber-100">
                      <span className="text-xs font-black text-white uppercase tracking-widest">Total Service Cost</span>
                      <span className="text-xl font-black text-white">KSH {errand.calculatedPrice}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Runner Property Listing Section */}
              {isRunner && errand.status === ErrandStatus.IN_PROGRESS && (
                <div className="pt-8 border-t border-amber-200 space-y-6">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-black text-amber-900 uppercase tracking-widest">Your Findings</h4>
                    <button 
                      onClick={() => setShowAddListing(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-amber-100"
                    >
                      <Plus size={14} /> Add House
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    {errand.propertyListings?.map((listing: PropertyListing) => (
                      <div key={listing.id} className="bg-white rounded-3xl border border-amber-100 overflow-hidden shadow-sm flex">
                        <img src={listing.imageUrl} alt={listing.title} className="w-24 h-24 object-cover" />
                        <div className="p-4 flex-1">
                          <div className="flex justify-between items-start">
                            <h5 className="text-sm font-black text-slate-900">{listing.title}</h5>
                            <span className="text-xs font-black text-amber-600">KSH {listing.price.toLocaleString()}</span>
                          </div>
                          <p className="text-[10px] text-slate-500 line-clamp-1">{listing.location}</p>
                          <p className="text-[10px] font-bold text-amber-500 mt-1 italic">"{listing.runnerView}"</p>
                        </div>
                      </div>
                    ))}
                    {(!errand.propertyListings || errand.propertyListings.length === 0) && (
                      <div className="p-10 text-center bg-white rounded-3xl border border-dashed border-amber-200">
                        <Home size={32} className="mx-auto text-amber-200 mb-2" />
                        <p className="text-xs font-bold text-amber-400">No houses added yet</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'map' ? (
          <div className="h-full flex flex-col space-y-4">
            <div className="flex-1 min-h-[500px] relative">
              <MapComponent 
                errands={[errand]}
                runners={[]}
                apiKey={googleMapsApiKey}
                routesApiKey={googleRoutesApiKey}
                center={errand.pickupCoordinates}
                onSelectProperty={(listing) => setSelectedListing(listing)}
                zoom={14}
              />
              
              {/* Custom Overlay for Property Pins */}
              <div className="absolute inset-0 pointer-events-none">
                {/* This is a placeholder for actual map integration. 
                    In a real app, I'd update MapComponent to handle propertyListings.
                    For now, I'll ensure MapComponent is updated next. */}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Found Houses</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {errand.propertyListings?.map((listing: PropertyListing) => (
                  <button 
                    key={listing.id}
                    onClick={() => setSelectedListing(listing)}
                    className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4 hover:border-indigo-200 transition-all text-left"
                  >
                    <img src={listing.imageUrl} alt={listing.title} className="w-16 h-16 rounded-2xl object-cover" />
                    <div>
                      <p className="text-sm font-black text-slate-900">{listing.title}</p>
                      <p className="text-xs font-bold text-indigo-600">KSH {listing.price.toLocaleString()}</p>
                      <p className="text-[10px] text-slate-400 truncate max-w-[150px]">{listing.location}</p>
                    </div>
                  </button>
                ))}
                {(!errand.propertyListings || errand.propertyListings.length === 0) && (
                  <div className="col-span-full p-10 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                    <MapIcon size={32} className="mx-auto text-slate-200 mb-2" />
                    <p className="text-xs font-bold text-slate-400">No houses mapped yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="p-8 bg-slate-50 rounded-[3rem] border border-slate-100 space-y-8">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-slate-900 tracking-tight">Shopping List</h3>
                <div className="px-4 py-2 bg-indigo-100 text-indigo-600 rounded-2xl text-xs font-black uppercase tracking-widest">
                  {errand.shoppingItems?.length || 0} Items
                </div>
              </div>
              
              <div className="space-y-3">
                {errand.shoppingItems?.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-4 p-5 bg-white rounded-3xl border border-slate-100 shadow-sm">
                    <div className="w-3 h-3 bg-indigo-500 rounded-full" />
                    <span className="text-base font-bold text-slate-700">{item}</span>
                  </div>
                ))}
                {(!errand.shoppingItems || errand.shoppingItems.length === 0) && (
                  <div className="py-10 text-center">
                    <ShoppingCart size={48} className="mx-auto text-slate-200 mb-4" />
                    <p className="text-sm font-bold text-slate-400">No items listed</p>
                  </div>
                )}
              </div>

              <div className="pt-8 border-t border-slate-200 space-y-4">
                <div className="flex justify-between items-center px-2">
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Items Budget</span>
                  <span className="text-lg font-black text-slate-900">KSH {errand.budget}</span>
                </div>
                {errand.calculatedPrice && (
                  <>
                    <div className="flex justify-between items-center px-2">
                      <div className="flex items-center gap-2">
                        <Sparkles size={14} className="text-indigo-400" />
                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Service Fee</span>
                      </div>
                      <span className="text-lg font-black text-slate-900">KSH {errand.calculatedPrice}</span>
                    </div>
                    
                    <div className="flex justify-between items-center p-5 bg-indigo-50 rounded-3xl border border-indigo-100">
                      <span className="text-xs font-black text-indigo-600 uppercase tracking-widest">Total Cost</span>
                      <span className="text-xl font-black text-indigo-600">KSH {errand.budget + errand.calculatedPrice}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Receipt Section */}
            {(errand.status === ErrandStatus.IN_PROGRESS || errand.status === ErrandStatus.REVIEW || errand.status === ErrandStatus.COMPLETED) && (
              <div className="space-y-4">
                <h3 className="text-xl font-black text-slate-900 tracking-tight">Receipt</h3>
                {errand.receiptUrl ? (
                  <div className="relative group rounded-[3rem] overflow-hidden border-4 border-slate-50 shadow-xl">
                    <img src={errand.receiptUrl} alt="Receipt" className="w-full aspect-[3/4] object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <a href={errand.receiptUrl} target="_blank" rel="noopener noreferrer" className="p-5 bg-white rounded-full text-slate-900 shadow-2xl">
                        <Download size={28} />
                      </a>
                    </div>
                  </div>
                ) : isRunner && errand.status === ErrandStatus.IN_PROGRESS ? (
                  <button 
                    onClick={() => {
                      setCameraMode('receipt');
                      setShowCamera(true);
                    }}
                    disabled={uploadingReceipt}
                    className="w-full aspect-[3/4] bg-slate-50 border-4 border-dashed border-slate-200 rounded-[3rem] flex flex-col items-center justify-center gap-4 text-slate-400 hover:bg-slate-100 hover:border-indigo-200 hover:text-indigo-500 transition-all group"
                  >
                    {uploadingReceipt ? (
                      <Loader2 size={48} className="animate-spin" />
                    ) : (
                      <>
                        <div className="p-8 bg-white rounded-full shadow-xl group-hover:scale-110 transition-transform">
                          <Camera size={40} />
                        </div>
                        <p className="text-sm font-black uppercase tracking-widest">Upload Receipt</p>
                      </>
                    )}
                  </button>
                ) : (
                  <div className="p-10 bg-slate-50 rounded-[3rem] border border-dashed border-slate-200 text-center">
                    <Receipt size={40} className="mx-auto text-slate-300 mb-4" />
                    <p className="text-sm font-bold text-slate-400">No receipt uploaded yet</p>
                  </div>
                )}
              </div>
            )}

            <button 
              onClick={() => pdfService.downloadShoppingPDF(errand)}
              className="w-full py-6 bg-slate-900 text-white rounded-[2rem] font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 hover:bg-black transition-all shadow-xl shadow-slate-200"
            >
              <Download size={20} /> Download List as PDF
            </button>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <footer className="p-6 border-t border-slate-50 bg-white sticky bottom-0 space-y-3">
        {canBid && (
          <button 
            onClick={() => onBid(errand.budget, "I'm interested in this task!")}
            disabled={loading}
            className="w-full py-5 bg-black text-white rounded-2xl font-black uppercase text-sm tracking-widest shadow-xl shadow-slate-200 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : "Place a Bid"}
          </button>
        )}
        {isRunner && errand.status === ErrandStatus.ASSIGNED && (
          <button 
            onClick={() => onReview(errand.id, "Task completed successfully!")}
            disabled={loading}
            className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase text-sm tracking-widest shadow-xl shadow-indigo-100 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : "Submit for Review"}
          </button>
        )}
        {isRequester && errand.status === ErrandStatus.REVIEW && (
          <button 
            onClick={() => onComplete(errand.id)}
            disabled={loading}
            className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black uppercase text-sm tracking-widest shadow-xl shadow-emerald-100 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : "Mark as Completed"}
          </button>
        )}
      </footer>

      {showCamera && (
        <CameraCapture 
          onCapture={handleCapture}
          onClose={() => setShowCamera(false)}
        />
      )}

      {/* Add Property Listing Modal */}
      <AnimatePresence>
        {showAddListing && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center p-4"
          >
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="bg-white w-full max-w-xl rounded-t-[3rem] md:rounded-[3rem] overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-slate-50 flex items-center justify-between">
                <h3 className="text-xl font-black text-slate-900 tracking-tight">Add House Finding</h3>
                <button onClick={() => setShowAddListing(false)} className="p-2 bg-slate-50 text-slate-400 rounded-xl">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Image Upload */}
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">House Photo</p>
                  {listingImage ? (
                    <div className="relative rounded-3xl overflow-hidden aspect-video">
                      <img src={listingImage} alt="Preview" className="w-full h-full object-cover" />
                      <button 
                        onClick={() => setListingImage(null)}
                        className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full backdrop-blur-md"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => {
                        setCameraMode('listing');
                        setShowCamera(true);
                      }}
                      className="w-full aspect-video bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center gap-2 text-slate-400 hover:bg-slate-100 transition-colors"
                    >
                      <Camera size={32} />
                      <span className="text-xs font-bold uppercase tracking-widest">Take Photo</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Title/Building Name</p>
                    <input 
                      type="text"
                      value={newListing.title}
                      onChange={e => setNewListing({...newListing, title: e.target.value})}
                      placeholder="e.g. South B Heights"
                      className="w-full p-4 bg-slate-50 rounded-2xl border-none focus:ring-2 focus:ring-indigo-500 font-bold"
                    />
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Monthly Rent (KSH)</p>
                    <input 
                      type="number"
                      value={newListing.price}
                      onChange={e => setNewListing({...newListing, price: Number(e.target.value)})}
                      placeholder="e.g. 25000"
                      className="w-full p-4 bg-slate-50 rounded-2xl border-none focus:ring-2 focus:ring-indigo-500 font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Specific Location</p>
                  <div className="h-48 rounded-2xl overflow-hidden border border-slate-100">
                    <GoogleMapPicker 
                      apiKey={googleMapsApiKey}
                      onConfirm={(loc) => setNewListing({...newListing, location: loc.address, coords: loc.coords})}
                      placeholder="Search for building location..."
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Runner's View/Comments</p>
                  <textarea 
                    value={newListing.runnerView}
                    onChange={e => setNewListing({...newListing, runnerView: e.target.value})}
                    placeholder="Tell the requester what you think about this house..."
                    className="w-full p-4 bg-slate-50 rounded-2xl border-none focus:ring-2 focus:ring-indigo-500 font-bold min-h-[100px]"
                  />
                </div>
              </div>

              <div className="p-6 border-t border-slate-50">
                <button 
                  disabled={isSubmittingListing || !newListing.title || !newListing.price || !newListing.location || !listingImage}
                  onClick={async () => {
                    setIsSubmittingListing(true);
                    try {
                      const imageUrl = await firebaseService.uploadFile(listingImage!, 'properties');
                      await firebaseService.addPropertyListing(errand.id, {
                        ...newListing,
                        imageUrl
                      });
                      setShowAddListing(false);
                      setNewListing({ title: '', price: 0, location: '', type: errand.houseType || 'Bedsitter', description: '', runnerView: '', amenities: [] });
                      setListingImage(null);
                      alert("House added successfully!");
                    } catch (e) {
                      console.error(e);
                      alert("Failed to add house.");
                    } finally {
                      setIsSubmittingListing(false);
                    }
                  }}
                  className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase text-sm tracking-widest shadow-xl shadow-indigo-100 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmittingListing ? <Loader2 size={18} className="animate-spin" /> : "Save House Finding"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Listing Detail Modal */}
      <AnimatePresence>
        {selectedListing && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center p-4"
          >
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="bg-white w-full max-w-xl rounded-t-[3rem] md:rounded-[3rem] overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="relative h-64">
                <img src={selectedListing.imageUrl} alt={selectedListing.title} className="w-full h-full object-cover" />
                <button 
                  onClick={() => setSelectedListing(null)}
                  className="absolute top-6 right-6 p-2 bg-black/50 text-white rounded-full backdrop-blur-md"
                >
                  <X size={20} />
                </button>
                <div className="absolute bottom-6 left-6 right-6 flex justify-between items-end">
                  <div className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-2xl shadow-xl">
                    <h3 className="text-xl font-black text-slate-900 leading-tight">{selectedListing.title}</h3>
                    <p className="text-xs font-bold text-slate-500">{selectedListing.location}</p>
                  </div>
                  <div className="bg-indigo-600 px-4 py-2 rounded-2xl text-white font-black shadow-xl">
                    KSH {selectedListing.price.toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="p-8 space-y-6 overflow-y-auto">
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Runner's Assessment</p>
                  <div className="p-6 bg-indigo-50 rounded-[2rem] border border-indigo-100 italic font-bold text-indigo-900 leading-relaxed">
                    "{selectedListing.runnerView}"
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-2xl">
                    <p className="text-micro text-slate-400 uppercase font-black tracking-widest mb-1">Type</p>
                    <p className="text-sm font-black text-slate-900">{selectedListing.type}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl">
                    <p className="text-micro text-slate-400 uppercase font-black tracking-widest mb-1">Agent Rating</p>
                    <div className="flex items-center gap-1 text-amber-500">
                      <Star size={12} fill="currentColor" />
                      <span className="text-sm font-black">{selectedListing.agentRating || '4.5'}</span>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => {
                    // In a real app, this would open directions or start a call
                    alert("Starting video call with runner...");
                  }}
                  className="w-full py-5 bg-black text-white rounded-2xl font-black uppercase text-sm tracking-widest shadow-xl flex items-center justify-center gap-3"
                >
                  <Phone size={18} /> Call Runner for Tour
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

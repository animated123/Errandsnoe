import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  Plus, MapPin, DollarSign, Calendar, Briefcase, 
  CheckCircle, Star, Camera, Navigation, Clock, Map as MapIcon, 
  List, ChevronLeft, LogOut, Search, Info,
  Phone, Mail, Globe, MapPinned, UserCheck, Loader2,
  ArrowRight, CreditCard, X, BellRing, Target,
  Wallet, MessageSquare, Sparkles, Key,
  Home, Calculator, Tag, AlertCircle, Trash2, Waves, Check,
  Zap, CameraOff, Image as ImageIcon, Maximize2, ShieldAlert, ShoppingBag, 
  FileText, Activity, MessageCircle, LayoutGrid,
  ChevronRight, Volume2, CheckCircle2, AlertTriangle, Droplets, Wifi, Shield, Car, ShieldCheck, Heart, Edit2, UserMinus,
  Settings, Palette, ImageIcon as LucideImageIcon, Save, Upload, Download,
  HelpCircle, PlusCircle, Filter, UserCircle,
  Mic, Square, Play, Pause, ChevronUp, ChevronDown
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { geminiService } from './services/geminiService';
import { APIProvider, Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';
import { User, UserRole, Errand, ErrandStatus, ErrandCategory, Coordinates, Bid, AppNotification, NotificationType, ChatMessage, AppSettings, LocationSuggestion, RunnerApplication, FeaturedService, ServiceListing, LoyaltyLevel, PriceRequest, PropertyListing } from './types';
import { firebaseService, calculateDistance, formatFirebaseError } from './services/firebaseService';
import { cloudinaryService } from './services/cloudinaryService';
import Layout from './components/Layout';
import ErrandCard from './components/ErrandCard';
import TopProgressBar from './components/TopProgressBar';
import LoadingSpinner from './components/LoadingSpinner';
import BidModal from './components/BidModal';
import AuthModal from './components/AuthModal';

const callGeminiWithRetry = async (prompt: string, maxRetries = 3): Promise<string> => {
  if (typeof prompt !== 'string') return "";
  for (let i = 0; i < maxRetries; i++) {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });
      return response.text || "";
    } catch (err: any) {
      if (i === maxRetries - 1) throw err;
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
    }
  }
  return "";
};

const CameraCapture: React.FC<{ onCapture: (file: File) => void, onClose: () => void }> = ({ onCapture, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
        .then(s => { 
          setStream(s); 
          if (videoRef.current) videoRef.current.srcObject = s; 
        })
        .catch(() => setError("Camera access denied. Please check site permissions."));
    } else {
      setError("Your device does not support camera access.");
    }
    return () => { if (stream) stream.getTracks().forEach(t => t.stop()); };
  }, []);

  const capture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        canvas.toBlob(blob => {
          if (blob) onCapture(new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' }));
        }, 'image/jpeg', 0.8);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-black flex flex-col items-center justify-center">
      {error ? (
        <div className="text-white text-center p-8">
          <CameraOff size={48} className="mx-auto mb-4 text-red-500" />
          <p className="font-bold text-lg mb-6">{error}</p>
          <button onClick={onClose} className="px-10 py-4 bg-white text-black rounded-2xl font-black uppercase text-xs">Close</button>
        </div>
      ) : (
        <>
          <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
          <canvas ref={canvasRef} className="hidden" />
          <div className="absolute top-6 left-6">
            <button onClick={onClose} className="p-4 bg-black/40 backdrop-blur-md rounded-2xl text-white hover:bg-black/60 transition-colors">
              <X size={24} />
            </button>
          </div>
          <div className="absolute bottom-12 left-0 right-0 flex flex-col items-center gap-6">
             <div className="px-4 py-2 bg-black/40 backdrop-blur-md rounded-full text-white text-[10px] font-black uppercase tracking-widest">Capture completion proof</div>
             <button onClick={capture} className="w-20 h-20 bg-white rounded-full border-8 border-white/20 flex items-center justify-center shadow-2xl active:scale-90 transition-all">
               <div className="w-14 h-14 bg-white rounded-full border-4 border-slate-900" />
             </button>
          </div>
        </>
      )}
    </div>
  );
};

const LocationAutocomplete: React.FC<{ label: string, icon: React.ReactNode, placeholder: string, onSelect: (loc: LocationSuggestion | null) => void, value?: string, error?: string, required?: boolean }> = ({ label, icon, placeholder, onSelect, value, error, required }) => {
  const [query, setQuery] = useState(value || '');
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [recentLocations, setRecentLocations] = useState<LocationSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);
  const isSelected = useRef(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const popularLocations: LocationSuggestion[] = [
    { name: "Sarit Centre", area: "Westlands", description: "Shopping Mall & Landmarks", coords: { lat: -1.2585, lng: 36.8037 } },
    { name: "Westlands", area: "Nairobi", description: "Commercial Hub", coords: { lat: -1.2646, lng: 36.8045 } },
    { name: "Village Market", area: "Gigiri", description: "Shopping & Recreation", coords: { lat: -1.2297, lng: 36.8042 } },
    { name: "Yaya Centre", area: "Kilimani", description: "Shopping Mall", coords: { lat: -1.2911, lng: 36.7865 } },
    { name: "Two Rivers Mall", area: "Ruaka", description: "Largest Mall in East Africa", coords: { lat: -1.2111, lng: 36.7911 } },
    { name: "Juja City Mall", area: "Juja", description: "Shopping along Thika Road", coords: { lat: -1.1022, lng: 37.0144 } },
    { name: "Nairobi CBD", area: "Nairobi", description: "City Centre", coords: { lat: -1.286389, lng: 36.817223 } },
    { name: "JKIA", area: "Embakasi", description: "International Airport", coords: { lat: -1.3192, lng: 36.9275 } },
    { name: "Greenspan Mall", area: "Donholm", description: "Shopping Centre", coords: { lat: -1.2944, lng: 36.9011 } },
    { name: "Garden City Mall", area: "Thika Road", description: "Shopping & Residential", coords: { lat: -1.2325, lng: 36.8783 } }
  ];

  useEffect(() => {
    const saved = localStorage.getItem('recent_locations');
    if (saved) {
      try {
        setRecentLocations(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse recent locations", e);
      }
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShow(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => { if (value !== undefined && !isSelected.current) setQuery(value); }, [value]);

  const fetchSuggestions = async (q: string) => {
    if (q.length < 2 || isSelected.current) return;
    
    // Check local popular locations first for instant feedback
    const localMatches = popularLocations.filter(loc => 
      loc.name.toLowerCase().includes(q.toLowerCase()) || 
      loc.area?.toLowerCase().includes(q.toLowerCase())
    );

    if (localMatches.length > 0) {
      setSuggestions(localMatches);
      setShow(true);
    }

    if (q.length < 3) return;

    setLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Find 5 real-world locations, buildings, estates, streets, or businesses in Kenya matching "${q}". 
        Be typo-tolerant.
        Return ONLY a JSON array of objects with: 
        name (string, the specific building or place), 
        area (string, the estate or suburb), 
        description (string, short 3-5 word description),
        lat (number), 
        lng (number).
        Focus on accuracy for Nairobi and major towns.`,
        config: { responseMimeType: "application/json" }
      });
      const data = JSON.parse(response.text || '[]');
      const geminiSuggestions = data.map((d: any) => ({ 
        name: d.name, 
        area: d.area,
        description: d.description,
        coords: { lat: d.lat, lng: d.lng } 
      }));

      // Merge and deduplicate
      const combined = [...localMatches];
      geminiSuggestions.forEach((gs: any) => {
        if (!combined.some(c => c.name.toLowerCase() === gs.name.toLowerCase())) {
          combined.push(gs);
        }
      });

      setSuggestions(combined.slice(0, 8));
      setShow(true);
    } catch (e) { 
      console.error(e); 
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => fetchSuggestions(query), 500);
    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (loc: LocationSuggestion) => {
    isSelected.current = true;
    setQuery(loc.name);
    onSelect(loc);
    setShow(false);

    // Save to recents
    const newRecents = [loc, ...recentLocations.filter(r => r.name !== loc.name)].slice(0, 5);
    setRecentLocations(newRecents);
    localStorage.setItem('recent_locations', JSON.stringify(newRecents));
  };

  return (
    <div className="space-y-1 relative" ref={dropdownRef}>
      {label && <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1 ml-1">{icon} {label} {required && "*"}</label>}
      <div className="relative">
        <input 
          type="text" value={query} placeholder={placeholder} 
          onChange={e => { isSelected.current = false; setQuery(e.target.value); if (!e.target.value) onSelect(null); }}
          onFocus={() => setShow(true)}
          className={`w-full p-3.5 brand-input rounded-2xl text-sm font-bold outline-none transition-all ${error ? 'border-red-500' : ''}`}
        />
        {loading && <div className="absolute right-4 top-1/2 -translate-y-1/2"><LoadingSpinner size={14} /></div>}
      </div>

      {show && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 shadow-2xl rounded-2xl z-[100] overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[300px] overflow-y-auto">
          {/* Recent Locations */}
          {query.length === 0 && recentLocations.length > 0 && (
            <div className="bg-slate-50/50 px-3.5 py-2 border-b border-slate-100">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Recently Used</p>
            </div>
          )}
          {query.length === 0 && recentLocations.map((loc, i) => (
            <button key={`recent-${i}`} type="button" onClick={() => handleSelect(loc)} className="w-full text-left p-3.5 hover:bg-slate-50 border-b border-slate-50 last:border-none transition-colors flex items-start gap-3">
              <Clock size={14} className="text-slate-400 mt-0.5" />
              <div>
                <p className="text-xs font-black text-slate-900">{loc.name}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase">{loc.area || 'Kenya'}</p>
              </div>
            </button>
          ))}

          {/* Popular Locations (when query is empty) */}
          {query.length === 0 && (
            <div className="bg-slate-50/50 px-3.5 py-2 border-b border-slate-100">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Popular Locations</p>
            </div>
          )}
          {query.length === 0 && popularLocations.slice(0, 5).map((loc, i) => (
            <button key={`popular-${i}`} type="button" onClick={() => handleSelect(loc)} className="w-full text-left p-3.5 hover:bg-slate-50 border-b border-slate-50 last:border-none transition-colors flex items-start gap-3">
              <Star size={14} className="text-amber-400 mt-0.5" />
              <div>
                <p className="text-xs font-black text-slate-900">{loc.name}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase">{loc.area || 'Kenya'}</p>
              </div>
            </button>
          ))}

          {/* Search Suggestions */}
          {query.length > 0 && suggestions.length > 0 ? (
            suggestions.map((s, i) => (
              <button key={`sug-${i}`} type="button" onClick={() => handleSelect(s)} className="w-full text-left p-3.5 hover:bg-slate-50 border-b border-slate-50 last:border-none transition-colors">
                <div className="flex justify-between items-start">
                  <p className="text-xs font-black text-slate-900">{s.name}</p>
                  <p className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">{s.area}</p>
                </div>
                {s.description && <p className="text-[10px] font-bold text-slate-400 mt-0.5">{s.description}</p>}
              </button>
            ))
          ) : query.length >= 3 && !loading && (
            <div className="p-4 text-center">
              <p className="text-xs font-bold text-slate-400">No locations found matching "{query}"</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const calculateMinPrice = (distance: number): number => {
  if (distance <= 0) return 0;
  let rate = 0;
  if (distance <= 3) {
    rate = 60;
  } else if (distance <= 7) {
    rate = 50;
  } else {
    rate = 40;
  }
  const calculated = distance * rate;
  return Math.max(100, Math.ceil(calculated));
};

const MapLocationPicker: React.FC<{ 
  label: string, 
  value?: LocationSuggestion | null, 
  onSelect: (loc: LocationSuggestion) => void,
  placeholder?: string
}> = ({ label, value, onSelect, placeholder }) => {
  const [showMap, setShowMap] = useState(false);
  const [searchQuery, setSearchQuery] = useState(value?.name || '');
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">{label}</label>
      <div className="relative">
        <div className="flex gap-2">
          <div className="flex-1">
            <LocationAutocomplete 
              label="" 
              placeholder={placeholder || "Search location..."} 
              icon={<MapPin size={10} />} 
              onSelect={onSelect} 
              value={value?.name} 
              required 
            />
          </div>
          <button 
            type="button"
            onClick={() => setShowMap(!showMap)}
            className={`p-4 rounded-xl border-2 transition-all ${showMap ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-100 text-slate-400'}`}
          >
            <MapIcon size={18} />
          </button>
        </div>

        {showMap && apiKey && (
          <div className="mt-3 h-64 rounded-2xl overflow-hidden border-2 border-slate-100 relative animate-in zoom-in-95 duration-200">
            <APIProvider apiKey={apiKey}>
              <Map
                defaultCenter={value?.coords || { lat: -1.286389, lng: 36.817223 }}
                defaultZoom={15}
                gestureHandling={'greedy'}
                disableDefaultUI={true}
                mapId="location_picker_map"
                onClick={(e) => {
                  if (e.detail.latLng) {
                    const coords = { lat: e.detail.latLng.lat, lng: e.detail.latLng.lng };
                    // In a real app, we'd reverse geocode here. 
                    // For now, we'll just set it as "Pinned Location"
                    onSelect({ name: `Pinned Location (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`, coords });
                  }
                }}
              >
                {value?.coords && (
                  <AdvancedMarker position={value.coords}>
                    <Pin background={'#4f46e5'} glyphColor={'#fff'} borderColor={'#4f46e5'} />
                  </AdvancedMarker>
                )}
              </Map>
              <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-lg shadow-sm border border-slate-100">
                <p className="text-[8px] font-black text-slate-900 uppercase tracking-widest">Tap map to pick</p>
              </div>
            </APIProvider>
          </div>
        )}
      </div>
    </div>
  );
};

const CreateScreen: React.FC<any> = ({ errandForm, setErrandForm, postErrand, loading, errors }) => {
  const [step, setStep] = useState(1);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<any>(null);

  const totalMamaFuaCost = (errandForm.laundryBaskets || 0) * (errandForm.pricePerBasket || 250);
  
  const handleUpdate = (updates: any) => { 
    const newForm = { ...errandForm, ...updates };
    
    // Auto-calculate budget based on distance for General tasks
    if (newForm.category === ErrandCategory.GENERAL && newForm.pickup && newForm.dropoff && !newForm.isInHouse) {
      const dist = calculateDistance(
        { lat: newForm.pickup.coords.lat, lng: newForm.pickup.coords.lng }, 
        { lat: newForm.dropoff.coords.lat, lng: newForm.dropoff.coords.lng }
      );
      const minPrice = calculateMinPrice(dist);
      newForm.distanceKm = parseFloat(dist.toFixed(2));
      newForm.calculatedPrice = minPrice;
      
      // Auto-set budget only when locations change or if budget is not set
      if (updates.pickup || updates.dropoff || !newForm.budget) {
        if (!newForm.budget || newForm.budget < minPrice) {
          newForm.budget = minPrice;
        }
        
        // Auto-set deadline based on distance
        const timeLimitHours = dist <= 7 ? 2 : 24;
        const deadlineDate = new Date(Date.now() + timeLimitHours * 60 * 60 * 1000);
        newForm.deadline = deadlineDate.toISOString().slice(0, 16);
      }
    } else if (newForm.category === ErrandCategory.GENERAL) {
      // Clear distance-based pricing if not applicable
      newForm.distanceKm = undefined;
      newForm.calculatedPrice = undefined;
    }
    
    setErrandForm(newForm); 
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      alert("Microphone access denied or not supported.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const uploadVoiceNote = async () => {
    if (!audioBlob) return;
    setIsUploadingAudio(true);
    try {
      const url = await cloudinaryService.uploadFile(audioBlob, 'auto', 'voice_notes');
      handleUpdate({ voiceNoteUrl: url });
      setAudioBlob(null);
    } catch (err) {
      alert("Failed to upload voice note.");
    } finally {
      setIsUploadingAudio(false);
    }
  };

  const toggleChecklistItem = (item: string) => {
    const currentChecklist = errandForm.checklist || [
      { item: 'Water Availability', checked: false },
      { item: 'Security Level', checked: false },
      { item: 'Tiling & Finishing', checked: false },
      { item: 'Electricity/Tokens', checked: false },
      { item: 'Natural Lighting', checked: false }
    ];
    const newChecklist = currentChecklist.map((i: any) => 
      i.item === item ? { ...i, checked: !i.checked } : i
    );
    handleUpdate({ checklist: newChecklist });
  };

  const renderStep1 = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="space-y-1">
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Task Category <span className="text-red-500">*</span></label>
        <select 
          value={errandForm.category} 
          onChange={e => handleUpdate({ category: e.target.value as ErrandCategory, isInHouse: false, pickup: null, dropoff: null })} 
          className="w-full p-4 brand-input rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white border-2 border-slate-100"
        >
          {Object.values(ErrandCategory).map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      <div className="space-y-4">
        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Task Title <span className="text-red-500">*</span></label>
          <input type="text" required value={errandForm.title} onChange={e => handleUpdate({ title: e.target.value })} placeholder="e.g., Buy groceries from Soko" className="w-full p-4 brand-input rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500/20" />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Description <span className="text-red-500">*</span></label>
            <div className="flex items-center gap-2">
              {isRecording ? (
                <button type="button" onClick={stopRecording} className="flex items-center gap-1.5 px-3 py-1 bg-red-500 text-white rounded-full text-[9px] font-black uppercase animate-pulse">
                  <Square size={10} fill="white" /> {recordingTime}s Recording...
                </button>
              ) : (
                <button type="button" onClick={startRecording} className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[9px] font-black uppercase hover:bg-indigo-100 hover:text-indigo-600 transition-all">
                  <Mic size={10} /> Voice Note
                </button>
              )}
            </div>
          </div>
          <textarea required value={errandForm.description} onChange={e => handleUpdate({ description: e.target.value })} placeholder="Be specific with instructions..." className="w-full p-4 brand-input rounded-xl font-bold text-sm outline-none h-32 resize-none focus:ring-2 focus:ring-indigo-500/20" />
          
          {audioBlob && (
            <div className="mt-2 p-3 bg-indigo-50 rounded-xl border border-indigo-100 flex items-center justify-between">
              <div className="flex items-center gap-2 text-indigo-600">
                <Volume2 size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest">Voice Note Recorded</span>
              </div>
              <button type="button" onClick={uploadVoiceNote} disabled={isUploadingAudio} className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest shadow-sm">
                {isUploadingAudio ? <LoadingSpinner size={10} color="white" /> : 'Attach Audio'}
              </button>
            </div>
          )}

          {errandForm.voiceNoteUrl && (
            <div className="mt-2 p-3 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center gap-3">
              <div className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center"><Volume2 size={16} /></div>
              <span className="text-xs font-black text-emerald-700">Voice Note Attached</span>
              <button type="button" onClick={() => handleUpdate({ voiceNoteUrl: undefined })} className="ml-auto text-emerald-600 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
            </div>
          )}
        </div>
      </div>

      <button 
        type="button" 
        onClick={() => setStep(2)} 
        disabled={!errandForm.title || !errandForm.description}
        className="w-full py-5 bg-black text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl disabled:opacity-50 transition-all flex items-center justify-center gap-2"
      >
        Next: Task Details <ArrowRight size={16} />
      </button>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="space-y-4">
        {errandForm.category === ErrandCategory.TOWN_SERVICE && (
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Urgency <span className="text-red-500">*</span></label>
            <select 
              value={errandForm.urgency || 'normal'} 
              onChange={e => handleUpdate({ urgency: e.target.value as any })} 
              className="w-full p-4 brand-input rounded-xl font-bold text-xs outline-none"
            >
              <option value="normal">Normal (Within 24h)</option>
              <option value="urgent">Urgent (Within 4h)</option>
              <option value="immediate">Immediate (ASAP)</option>
            </select>
          </div>
        )}

        {errandForm.category === ErrandCategory.PACKAGE_DELIVERY && (
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Package Description <span className="text-red-500">*</span></label>
              <textarea 
                value={errandForm.packageDescription || ''} 
                onChange={e => handleUpdate({ packageDescription: e.target.value })} 
                placeholder="Describe what is being delivered (e.g., Electronics, Documents, Food)"
                className="w-full p-4 brand-input rounded-xl font-bold text-xs outline-none h-24 resize-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Estimated Package Value (KES)</label>
              <input 
                type="number" 
                value={errandForm.packageCost || ''} 
                onChange={e => handleUpdate({ packageCost: Number(e.target.value) })} 
                placeholder="e.g., 5000"
                className="w-full p-4 brand-input rounded-xl font-bold text-xs outline-none"
              />
            </div>
          </div>
        )}

        {errandForm.category === ErrandCategory.SHOPPING && (
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Shopping List <span className="text-red-500">*</span></label>
            <textarea 
              value={errandForm.shoppingList || ''} 
              onChange={e => handleUpdate({ shoppingList: e.target.value })} 
              placeholder="List the items you need (e.g., 2kg Sugar, 1L Milk, Bread)"
              className="w-full p-4 brand-input rounded-xl font-bold text-xs outline-none h-32 resize-none"
            />
          </div>
        )}

        {errandForm.category === ErrandCategory.GIKOMBA_STRAWS && (
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Market Section/Specific Items <span className="text-red-500">*</span></label>
              <textarea 
                value={errandForm.marketSection || ''} 
                onChange={e => handleUpdate({ marketSection: e.target.value })} 
                placeholder="e.g., Shoes section, Mitumba bales, Specific stall number"
                className="w-full p-4 brand-input rounded-xl font-bold text-xs outline-none h-24 resize-none"
              />
            </div>
          </div>
        )}

        {errandForm.category === ErrandCategory.MAMA_FUA && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Baskets</label>
              <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-100">
                <button type="button" onClick={() => handleUpdate({ laundryBaskets: Math.max(1, (errandForm.laundryBaskets || 1) - 1) })} className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm"><ChevronDown size={14} /></button>
                <span className="flex-1 text-center font-black text-sm">{errandForm.laundryBaskets || 1}</span>
                <button type="button" onClick={() => handleUpdate({ laundryBaskets: (errandForm.laundryBaskets || 1) + 1 })} className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm"><ChevronUp size={14} /></button>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Price/Basket</label>
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 text-center font-black text-sm text-indigo-600">KES {errandForm.pricePerBasket || 250}</div>
            </div>
          </div>
        )}

        {errandForm.category === ErrandCategory.HOUSE_HUNTING && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">House Type</label>
                <select value={errandForm.houseType} onChange={e => handleUpdate({ houseType: e.target.value })} className="w-full p-4 brand-input rounded-xl font-bold text-xs outline-none">
                  <option value="">Select Type</option>
                  <option value="Bedsitter">Bedsitter</option>
                  <option value="One Bedroom">One Bedroom</option>
                  <option value="Two Bedroom">Two Bedroom</option>
                  <option value="Studio">Studio</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Move-in Date</label>
                <input type="date" value={errandForm.moveInDate} onChange={e => handleUpdate({ moveInDate: e.target.value })} className="w-full p-4 brand-input rounded-xl font-bold text-xs outline-none" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Checklist Requirements</label>
              <div className="grid grid-cols-2 gap-2">
                {['Water Availability', 'Security Level', 'Tiling & Finishing', 'Electricity/Tokens', 'Natural Lighting'].map(item => (
                  <button key={item} type="button" onClick={() => toggleChecklistItem(item)} className={`p-3 rounded-xl border-2 text-[9px] font-black uppercase tracking-tight transition-all flex items-center gap-2 ${errandForm.checklist?.find((i: any) => i.item === item)?.checked ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-100 text-slate-400'}`}>
                    {errandForm.checklist?.find((i: any) => i.item === item)?.checked ? <Check size={10} /> : <Plus size={10} />}
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button type="button" onClick={() => setStep(1)} className="flex-1 py-5 border border-slate-200 rounded-2xl font-black uppercase text-[10px] tracking-widest text-slate-400 hover:bg-slate-50 transition-all">Back</button>
        <button 
          type="button" 
          onClick={() => setStep(3)} 
          disabled={errandForm.category === ErrandCategory.HOUSE_HUNTING && !errandForm.houseType}
          className="flex-[2] py-5 bg-black text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl disabled:opacity-50 transition-all flex items-center justify-center gap-2"
        >
          Next: Location & Budget <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="space-y-4">
        {errandForm.category === ErrandCategory.GENERAL && (
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
            <div>
              <p className="text-xs font-black text-slate-900">In-House Service?</p>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Runner comes to your home</p>
            </div>
            <button type="button" onClick={() => handleUpdate({ isInHouse: !errandForm.isInHouse, dropoff: null })} className={`w-12 h-6 rounded-full transition-all relative ${errandForm.isInHouse ? 'bg-indigo-600 shadow-lg shadow-indigo-100' : 'bg-slate-200'}`}><div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${errandForm.isInHouse ? 'left-7' : 'left-1'}`} /></button>
          </div>
        )}

        {errandForm.category === ErrandCategory.MAMA_FUA && (
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
            <div>
              <p className="text-xs font-black text-slate-900">In-House Cleaning?</p>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Runner comes to your home</p>
            </div>
            <button type="button" onClick={() => handleUpdate({ isInHouse: !errandForm.isInHouse })} className={`w-12 h-6 rounded-full transition-all relative ${errandForm.isInHouse ? 'bg-indigo-600 shadow-lg shadow-indigo-100' : 'bg-slate-200'}`}><div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${errandForm.isInHouse ? 'left-7' : 'left-1'}`} /></button>
          </div>
        )}

        <MapLocationPicker 
          label={errandForm.category === ErrandCategory.HOUSE_HUNTING ? "Preferred Area" : (errandForm.isInHouse ? "Your Location" : "Pickup Location")} 
          placeholder="Search or pick on map..." 
          onSelect={loc => handleUpdate({ pickup: loc })} 
          value={errandForm.pickup} 
        />

        {((errandForm.category === ErrandCategory.GENERAL && !errandForm.isInHouse) || (errandForm.category === ErrandCategory.MAMA_FUA && !errandForm.isInHouse)) && (
          <MapLocationPicker 
            label="Drop-off Location" 
            placeholder="Where to?" 
            onSelect={loc => handleUpdate({ dropoff: loc })} 
            value={errandForm.dropoff} 
          />
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Your Budget (Ksh) <span className="text-red-500">*</span></label>
            <input type="number" required value={errandForm.budget || ''} onChange={e => handleUpdate({ budget: parseInt(e.target.value) })} className="w-full p-4 brand-input rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500/20" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Deadline <span className="text-red-500">*</span></label>
            <input type="datetime-local" required value={errandForm.deadline} onChange={e => handleUpdate({ deadline: e.target.value })} className="w-full p-4 brand-input rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500/20" />
          </div>
        </div>

        {errandForm.distanceKm && (
          <div className="p-5 bg-slate-900 text-white rounded-[1.5rem] space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Pricing Breakdown</span>
              <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">{errandForm.distanceKm} KM Trip</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-slate-400">Rate per KM</span>
                <span className="text-xs font-black">{errandForm.distanceKm <= 3 ? 60 : errandForm.distanceKm <= 7 ? 50 : 40} KES</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-slate-400">System Minimum</span>
                <span className="text-xs font-black">KES {errandForm.calculatedPrice}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-slate-400">Time Limit</span>
                <span className="text-xs font-black">{errandForm.distanceKm <= 7 ? '2 Hours' : '24 Hours'}</span>
              </div>
            </div>
            <div className="pt-3 border-t border-white/10 flex justify-between items-center">
              <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Your Offer</span>
              <span className="text-lg font-black text-white">KES {errandForm.budget}</span>
            </div>
            {errandForm.budget < (errandForm.calculatedPrice || 0) && (
              <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-xl flex items-center gap-2 text-red-400">
                <AlertCircle size={14} />
                <span className="text-[9px] font-black uppercase tracking-widest">Budget below recommended minimum</span>
              </div>
            )}
          </div>
        )}

        {errandForm.category === ErrandCategory.MAMA_FUA && (
          <div className="p-5 bg-indigo-600 text-white rounded-[1.5rem] flex justify-between items-center shadow-xl shadow-indigo-100">
            <div>
              <p className="text-[9px] font-black text-indigo-200 uppercase tracking-widest">Mama Fua Total</p>
              <p className="text-xs font-bold">{errandForm.laundryBaskets} Baskets @ {errandForm.pricePerBasket}/ea</p>
            </div>
            <span className="text-xl font-black">KES {totalMamaFuaCost}</span>
          </div>
        )}

        {(errandForm.category === ErrandCategory.SHOPPING || errandForm.category === ErrandCategory.TOWN_SERVICE) && (
          <div className="p-5 bg-amber-50 border border-amber-100 rounded-[1.5rem] space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500 text-white rounded-lg"><DollarSign size={16} /></div>
              <div>
                <p className="text-xs font-black text-slate-900">Shopping Float (Escrow)</p>
                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Max amount runner can spend</p>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase tracking-widest text-amber-600 ml-1">Max Budget (Ksh)</label>
              <input 
                type="number" 
                value={errandForm.maxShoppingBudget || ''} 
                onChange={e => handleUpdate({ maxShoppingBudget: parseInt(e.target.value) })} 
                placeholder="e.g. 2000"
                className="w-full p-4 bg-white rounded-xl font-bold text-sm outline-none border border-amber-200 focus:ring-2 focus:ring-amber-500/20" 
              />
            </div>
            <p className="text-[8px] text-amber-600 font-bold italic">This amount will be held in escrow and only released upon your approval of receipts.</p>
          </div>
        )}
      </div>

      <div className="flex gap-3 pt-4">
        <button type="button" onClick={() => setStep(2)} className="flex-1 py-5 border border-slate-200 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all">Back</button>
        <button 
          type="submit" 
          disabled={loading || !errandForm.budget || !errandForm.deadline || !errandForm.pickup || (errandForm.category === ErrandCategory.GENERAL && !errandForm.isInHouse && !errandForm.dropoff)}
          className="flex-[2] py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-indigo-100 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <><Plus size={16} /> Post Errand</>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto pb-10">
      <div className="bg-white rounded-[3rem] p-8 border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="p-3.5 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-100"><Plus size={24} /></div>
            <div>
              <h2 className="text-lg font-[900] text-slate-900">Post an Errand</h2>
              <div className="flex items-center gap-2 mt-0.5">
                {[1, 2, 3].map(s => (
                  <div key={s} className={`h-1 rounded-full transition-all ${step >= s ? 'w-6 bg-indigo-600' : 'w-2 bg-slate-100'}`} />
                ))}
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Step</p>
            <p className="text-sm font-black text-slate-900">{step} of 3</p>
          </div>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); postErrand(e); setStep(1); }} className="space-y-6">
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
        </form>
      </div>
    </div>
  );
};

const MenuView: React.FC<{ listings: ServiceListing[], onSelect: (listing: ServiceListing) => void }> = ({ listings, onSelect }) => {
  const [activeCategory, setActiveCategory] = useState<ErrandCategory | 'All'>('All');
  const [viewingListing, setViewingListing] = useState<ServiceListing | null>(null);
  
  const filtered = activeCategory === 'All' ? listings : listings.filter(l => l.category === activeCategory);
  
  const categories = ['All', ...Object.values(ErrandCategory)];

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center justify-between px-2">
        <h2 className="text-xl font-black text-slate-900 tracking-tight">Service Menu</h2>
        <div className="p-2 bg-slate-100 rounded-xl">
          <Search size={16} className="text-slate-400" />
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 px-2 no-scrollbar">
        {categories.map(cat => (
          <button 
            key={cat} 
            onClick={() => setActiveCategory(cat as any)}
            className={`px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${activeCategory === cat ? 'bg-black text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-100'}`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="space-y-4 px-2">
        {filtered.length === 0 ? (
          <div className="p-20 text-center bg-white rounded-[2rem] border-2 border-dashed border-slate-100 text-slate-300 font-black uppercase text-[10px] tracking-widest">
            No services listed in this category
          </div>
        ) : (
          filtered.map(item => (
            <div 
              key={item.id} 
              onClick={() => setViewingListing(item)}
              className="bg-white rounded-[2rem] p-4 border border-slate-100 shadow-sm flex gap-4 items-center animate-in fade-in slide-in-from-bottom-2 cursor-pointer hover:border-indigo-100 transition-all"
            >
              <div className="w-24 h-24 rounded-2xl overflow-hidden flex-shrink-0 border border-slate-50">
                <img src={item.imageUrl} className="w-full h-full object-cover" alt={item.title} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                  <h3 className="font-black text-slate-900 text-sm leading-tight">{item.title} {item.scope && <span className="text-slate-400 font-bold">({item.scope})</span>}</h3>
                  <div className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
                    <Info size={12} />
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 font-medium line-clamp-2 mt-1 leading-relaxed">{item.description}</p>
                <div className="flex justify-between items-center mt-3">
                  <p className="font-black text-slate-900 text-sm">KSh{item.price}</p>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(item);
                    }}
                    className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                  >
                    <Plus size={14} /> Add
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {viewingListing && (
        <ServiceListingDetailModal 
          listing={viewingListing} 
          onClose={() => setViewingListing(null)} 
          onOrder={(l) => {
            onSelect(l);
            setViewingListing(null);
          }}
        />
      )}
    </div>
  );
};

const ServiceListingDetailModal: React.FC<{ listing: ServiceListing, onClose: () => void, onOrder: (l: ServiceListing) => void }> = ({ listing, onClose, onOrder }) => {
  const [explanation, setExplanation] = useState(listing.explanation || '');
  const [paymentGuide, setPaymentGuide] = useState(listing.paymentGuide || '');
  const [loading, setLoading] = useState(!listing.explanation || !listing.paymentGuide);

  useEffect(() => {
    if (!listing.explanation || !listing.paymentGuide) {
      const generateDetails = async () => {
        try {
          const prompt = `Generate a detailed explanation and a payment guide for a service listing in an on-demand errands app.
          Service Title: ${listing.title}
          Category: ${listing.category}
          Description: ${listing.description}
          Base Price: KSh ${listing.price}

          Return the response in JSON format with two fields: "explanation" (what the runner does) and "paymentGuide" (how the pricing works, including potential extra costs like transport).
          Make it professional and concise.`;
          
          const response = await callGeminiWithRetry(prompt);
          const cleaned = response.replace(/```json|```/g, '').trim();
          const data = JSON.parse(cleaned);
          setExplanation(data.explanation);
          setPaymentGuide(data.paymentGuide);
        } catch (e) {
          setExplanation(listing.description);
          setPaymentGuide(`Base price is KSh ${listing.price}. Additional costs may apply for distance or extra requirements.`);
        } finally {
          setLoading(false);
        }
      };
      generateDetails();
    }
  }, [listing]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
        <div className="relative h-56 flex-shrink-0">
          <img src={listing.imageUrl} className="w-full h-full object-cover" alt={listing.title} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-white/20 backdrop-blur-md text-white rounded-full hover:bg-white/40 transition-all z-10">
            <X size={20} />
          </button>
          <div className="absolute bottom-6 left-6 right-6">
            <span className="text-[9px] font-black uppercase tracking-widest text-white bg-indigo-600 px-3 py-1 rounded-full">{listing.category}</span>
            <h3 className="text-2xl font-[900] text-white mt-2 leading-tight">{listing.title}</h3>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-8 space-y-6 no-scrollbar">
          <div className="space-y-2">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Task Explanation</h4>
            {loading ? (
              <div className="flex items-center gap-2 text-slate-400 py-2">
                <Loader2 size={14} className="animate-spin" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Generating details...</span>
              </div>
            ) : (
              <p className="text-xs text-slate-600 font-medium leading-relaxed">{explanation}</p>
            )}
          </div>

          <div className="space-y-2">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Payment Guide</h4>
            {loading ? (
              <div className="flex items-center gap-2 text-slate-400 py-2">
                <Loader2 size={14} className="animate-spin" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Calculating guide...</span>
              </div>
            ) : (
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                <p className="text-xs text-slate-600 font-medium leading-relaxed mb-3">{paymentGuide}</p>
                <div className="flex justify-between items-center pt-3 border-t border-slate-200">
                  <span className="text-[10px] font-black text-slate-400 uppercase">Base Price</span>
                  <span className="text-lg font-black text-slate-900">KSh {listing.price}</span>
                </div>
              </div>
            )}
          </div>

          <div className="bg-indigo-50 p-5 rounded-2xl border border-indigo-100/50 flex items-start gap-3">
            <Info size={18} className="text-indigo-600 shrink-0 mt-0.5" />
            <p className="text-[10px] text-indigo-600/80 font-bold leading-relaxed">
              By ordering, you'll be matched with a verified runner. You only pay once the task is completed to your satisfaction.
            </p>
          </div>
        </div>

        <div className="p-6 bg-white border-t border-slate-50 flex-shrink-0">
          <button 
            onClick={() => onOrder(listing)}
            className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl shadow-indigo-100 active:scale-95 transition-all flex items-center justify-center gap-3"
          >
            <ShoppingBag size={18} /> Order Now
          </button>
        </div>
      </div>
    </div>
  );
};

const DashboardGuide: React.FC = () => {
  return (
    <div className="space-y-6 py-4">
      <div className="px-2">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Platform Guide</h3>
        <h2 className="text-xl font-black text-slate-900 tracking-tight mt-1">How it Works</h2>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Section 1: What are tasks */}
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
            <Target size={24} />
          </div>
          <div>
            <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">What are Tasks?</h4>
            <p className="text-[11px] text-slate-500 font-medium leading-relaxed mt-2">
              Tasks are on-demand services ranging from grocery shopping and laundry (Mama Fua) to specialized house hunting. We bridge the gap between your needs and reliable local assistance.
            </p>
          </div>
        </div>

        {/* Section 2: Posting Errands */}
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
            <PlusCircle size={24} />
          </div>
          <div>
            <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">Post an Errand</h4>
            <p className="text-[11px] text-slate-500 font-medium leading-relaxed mt-2">
              Need something done? Click "Post Errand", choose a category, set your budget, and describe the task. Local runners will see your request and send proposals instantly.
            </p>
          </div>
        </div>

        {/* Section 3: Accepting Errands */}
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
            <Zap size={24} />
          </div>
          <div>
            <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">Accept & Earn</h4>
            <p className="text-[11px] text-slate-500 font-medium leading-relaxed mt-2">
              As a runner, browse "Available Errands" on the map or list. Send your interest at the specified budget. Once assigned, complete the task, upload proof, and get paid securely.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-slate-900 rounded-[2rem] p-8 text-white relative overflow-hidden">
        <div className="relative z-10 max-w-lg">
          <h3 className="text-lg font-black tracking-tight mb-2">Secure & Reliable</h3>
          <p className="text-xs text-slate-400 font-medium leading-relaxed">
            Every transaction is protected. Funds are held securely and only released when you sign off on the completed task. Our rating system ensures high-quality service for everyone.
          </p>
        </div>
        <ShieldAlert className="absolute -right-6 -bottom-6 text-white/5" size={140} />
      </div>
    </div>
  );
};

const SupportChatOverlay: React.FC<{ user: User }> = ({ user }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [chat, setChat] = useState<any>(null);
  const [text, setText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      const unsub = firebaseService.subscribeToSupportChat(user.id, (data) => {
        setChat(data);
        if (data?.unreadByUser) {
          firebaseService.markSupportChatAsRead(user.id, false);
        }
      });
      return () => unsub();
    }
  }, [isOpen, user.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chat?.messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    const msg = text;
    setText('');
    await firebaseService.sendSupportMessage(user.id, user.name, msg);
  };

  return (
    <div className="fixed bottom-24 right-6 z-[60] md:bottom-8">
      {isOpen ? (
        <div className="w-[320px] h-[450px] bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
          <header className="p-5 bg-black text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
                <MessageCircle size={18} />
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest">Support Chat</h3>
                <p className="text-[8px] font-bold opacity-60 uppercase">We're online</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-all">
              <X size={18} />
            </button>
          </header>
          
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
            {!chat || !chat.messages || chat.messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                  <HelpCircle size={24} />
                </div>
                <div>
                  <p className="text-xs font-black text-slate-900 uppercase">How can we help?</p>
                  <p className="text-[10px] text-slate-400 font-medium leading-relaxed mt-1">Send us a message and our team will get back to you shortly.</p>
                </div>
              </div>
            ) : (
              chat.messages.map((m: any, i: number) => (
                <div key={i} className={`flex flex-col ${m.senderId === user.id ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[85%] p-3 rounded-2xl text-[11px] font-medium leading-relaxed ${m.senderId === user.id ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white text-slate-900 border border-slate-100 rounded-tl-none shadow-sm'}`}>
                    {m.text}
                  </div>
                  <span className="text-[7px] font-black text-slate-400 uppercase mt-1 px-1">{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleSend} className="p-3 bg-white border-t flex gap-2">
            <input 
              type="text" value={text} onChange={e => setText(e.target.value)} 
              placeholder="Type your message..." 
              className="flex-1 bg-slate-50 border-none rounded-xl px-4 py-2.5 text-[11px] font-bold outline-none focus:ring-2 focus:ring-black/5"
            />
            <button type="submit" className="p-2.5 bg-black text-white rounded-xl active:scale-90 transition-all shadow-lg">
              <ArrowRight size={18} />
            </button>
          </form>
        </div>
      ) : (
        <button 
          onClick={() => setIsOpen(true)} 
          className="w-14 h-14 bg-black text-white rounded-2xl shadow-2xl flex items-center justify-center hover:scale-110 active:scale-90 transition-all group relative"
        >
          <MessageCircle size={24} />
          {chat?.unreadByUser && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 border-2 border-white rounded-full" />
          )}
          <div className="absolute right-full mr-3 px-3 py-1.5 bg-black text-white text-[9px] font-black uppercase tracking-widest rounded-lg opacity-0 group-hover:opacity-100 transition-all pointer-events-none whitespace-nowrap">
            Chat with Support
          </div>
        </button>
      )}
    </div>
  );
};

export default function App() {
  const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const [user, setUser] = useState<User | null>(null);
  const [showLoyaltyModal, setShowLoyaltyModal] = useState(false);
  const [showPriceRequestModal, setShowPriceRequestModal] = useState<PriceRequest | null>(null);
  const [showAddPropertyModal, setShowAddPropertyModal] = useState(false);
  const [showComparisonModal, setShowComparisonModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [errands, setErrands] = useState<Errand[]>([]);
  const [isLoadingErrands, setIsLoadingErrands] = useState(true);
  const [availableErrands, setAvailableErrands] = useState<Errand[]>([]);
  const [isLoadingAvailable, setIsLoadingAvailable] = useState(true);
  const [nearbyRunners, setNearbyRunners] = useState<User[]>([]);
  const [selectedErrand, setSelectedErrand] = useState<Errand | null>(null);
  const [isLogin, setIsLogin] = useState(true);
  const [appSettings, setAppSettings] = useState<AppSettings>({ primaryColor: '#000000' });
  const [formErrors, setFormErrors] = useState<any>({});
  const [currentLocation, setCurrentLocation] = useState<Coordinates | null>(null);
  const [stats, setStats] = useState<any>({ 
    totalUsers: 0, 
    totalTasks: 0, 
    onlineUsers: 0,
    avgDistance: 0,
    avgCompletionTime: 0,
    avgPenalty: 0,
    topRunners: [],
    topRequesters: [],
    revenuePerDay: [],
    failedErrandsPercent: 0
  });
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [profileView, setProfileView] = useState<'main' | 'edit' | 'history'>('main');
  const [proximityFilter, setProximityFilter] = useState<number | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showPriceGuideModal, setShowPriceGuideModal] = useState(false);
  const [showContactUsModal, setShowContactUsModal] = useState(false);
  const [featuredServices, setFeaturedServices] = useState<FeaturedService[]>([]);
  const [selectedFeaturedService, setSelectedFeaturedService] = useState<FeaturedService | null>(null);
  const [serviceListings, setServiceListings] = useState<ServiceListing[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([]);
  const [smartInput, setSmartInput] = useState('');
  const [isParsing, setIsParsing] = useState(false);

  const ALL_SUGGESTIONS = [
    "Mama Fua (Laundry)",
    "Market Shopping",
    "House Hunting",
    "Package Delivery",
    "Town Service",
    "Gikomba straws",
    "Buy groceries",
    "Clean the house",
    "Find a bedsitter"
  ];

  useEffect(() => {
    if (searchQuery.length > 0) {
      const filtered = ALL_SUGGESTIONS.filter(s => 
        s.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setSearchSuggestions(filtered);
    } else {
      setSearchSuggestions([]);
    }
  }, [searchQuery]);

  const handleSmartCreate = async () => {
    if (!smartInput.trim()) return;
    setIsParsing(true);
    try {
      const result = await geminiService.parseErrandDescription(smartInput);
      if (result) {
        setErrandForm({
          ...errandForm,
          category: result.category as ErrandCategory,
          title: result.title,
          description: smartInput,
          pickupLocation: result.location || ''
        });
        setActiveTab('create');
        setSmartInput('');
        alert(`AI detected this as ${result.category}. We've pre-filled the details for you!`);
      }
    } catch (e) {
      alert("AI parsing failed. Please fill manually.");
    } finally {
      setIsParsing(false);
    }
  };
  
  const [errandForm, setErrandForm] = useState<any>({ 
    category: ErrandCategory.GENERAL, 
    title: '', 
    budget: 0, 
    deadline: '', 
    pickup: null, 
    dropoff: null, 
    laundryBaskets: 1, 
    pricePerBasket: 250, 
    houseType: '', 
    minBudget: 0, 
    maxBudget: 0, 
    moveInDate: '', 
    additionalRequirements: '', 
    description: '', 
    isInHouse: false,
    maxShoppingBudget: 0,
    urgency: 'normal',
    packageDescription: '',
    packageCost: 0,
    shoppingList: '',
    marketSection: ''
  });
  const [authForm, setAuthForm] = useState({ name: '', email: '', phone: '', password: '', role: UserRole.REQUESTER });

  useEffect(() => {
    firebaseService.getCurrentUser().then(u => { 
      if (u) { 
        setUser(u); 
        setIsDarkMode(u.theme === 'dark');
      } 
      setLoading(false); 
    });
  }, []);

  useEffect(() => {
    const unsub = firebaseService.subscribeToSettings(setAppSettings);
    return () => unsub();
  }, [user?.id]);

  useEffect(() => {
    if (user?.isAdmin) {
      firebaseService.getAppStats().then(setStats);
    }
  }, [user?.id, user?.isAdmin]);

  useEffect(() => {
    firebaseService.fetchFeaturedServices().then(setFeaturedServices);
    firebaseService.fetchServiceListings().then(setServiceListings);
  }, []);

  useEffect(() => {
    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setCurrentLocation(coords);
          if (user) {
            firebaseService.updateUserSettings(user.id, { lastKnownLocation: coords });
          }
        },
        (err) => console.error("Geolocation error:", err),
        { enableHighAccuracy: true }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [user?.id]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  useEffect(() => {
    if (!user) return;
    
    const unsubErrands = firebaseService.subscribeToUserErrands(user.id, user.role, (list) => {
      setErrands(list);
      setIsLoadingErrands(false);
      if (selectedErrand) {
        const updated = list.find(e => e.id === selectedErrand.id);
        if (updated) setSelectedErrand(updated);
      }
    });

    const unsubNotifs = firebaseService.subscribeToNotifications(user.id, setNotifications);

    let unsubAvailable: any = null;
    if (user.role === UserRole.RUNNER) {
      unsubAvailable = firebaseService.subscribeToAvailableErrands((list) => {
        setAvailableErrands(list);
        setIsLoadingAvailable(false);
      });
    } else {
      firebaseService.getNearbyRunners().then(setNearbyRunners);
    }

    return () => {
      unsubErrands();
      unsubNotifs();
      if (unsubAvailable) unsubAvailable();
    };
  }, [user, selectedErrand?.id]);

  const filteredErrands = useMemo(() => {
    if (!proximityFilter || !currentLocation) return availableErrands;
    return availableErrands.filter(e => {
      if (!e.pickupCoordinates) return false;
      const dist = calculateDistance(currentLocation, e.pickupCoordinates);
      return dist <= proximityFilter;
    });
  }, [availableErrands, proximityFilter, currentLocation]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setFormErrors({});
    try {
      const u = isLogin ? await firebaseService.login(authForm.email, authForm.password) : await firebaseService.register(authForm.name, authForm.email, authForm.phone, authForm.password);
      setUser(u);
      setIsDarkMode(u.theme === 'dark');
    } catch (err: any) { setFormErrors({ auth: formatFirebaseError(err) }); } finally { setIsProcessing(false); }
  };

  const toggleDarkMode = async () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    if (user) {
      await firebaseService.updateUserSettings(user.id, { theme: newMode ? 'dark' : 'light' });
    }
  };

  const validateForm = () => {
    if (!errandForm.title) return "Title is required";
    if (!errandForm.pickup) return "Location is required";
    if (errandForm.category === ErrandCategory.HOUSE_HUNTING && (!errandForm.budget || !errandForm.houseType)) return "Budget and house type are required";
    if (errandForm.category === ErrandCategory.MAMA_FUA && !errandForm.isInHouse && !errandForm.dropoff) return "Delivery location is required for laundry pickup";
    if (errandForm.category === ErrandCategory.GENERAL && !errandForm.isInHouse && !errandForm.dropoff) return "Drop-off is required";
    if (errandForm.category === ErrandCategory.TOWN_SERVICE && !errandForm.urgency) return "Urgency is required";
    if (errandForm.category === ErrandCategory.PACKAGE_DELIVERY && !errandForm.packageDescription) return "Package description is required";
    if (errandForm.category === ErrandCategory.SHOPPING && !errandForm.shoppingList) return "Shopping list is required";
    if (errandForm.category === ErrandCategory.GIKOMBA_STRAWS && !errandForm.marketSection) return "Market section is required";
    if (!errandForm.budget) return "Budget is required";
    
    if (errandForm.category === ErrandCategory.GENERAL && errandForm.calculatedPrice && errandForm.budget < errandForm.calculatedPrice) {
      return `Budget cannot be less than the minimum charge of Ksh ${errandForm.calculatedPrice} for this distance.`;
    }
    
    return null;
  };

  const handleRebook = (oldErrand: Errand) => {
    setErrandForm({
      category: oldErrand.category,
      title: oldErrand.title,
      description: oldErrand.description,
      pickupLocation: oldErrand.pickupLocation,
      pickupCoordinates: oldErrand.pickupCoordinates,
      dropoffLocation: oldErrand.dropoffLocation,
      dropoffCoordinates: oldErrand.dropoffCoordinates,
      budget: oldErrand.budget,
      preferredRunnerId: oldErrand.runnerId
    });
    setActiveTab('create');
    setProfileView('main');
    alert(`Re-booking "${oldErrand.title}". Instructions and locations have been cloned.`);
  };

  const postErrand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Check suspension
    if (user.isSuspended) {
      alert(`Your account is suspended: ${user.suspensionReason}`);
      return;
    }

    const error = validateForm();
    if (error) { alert(error); return; }
    setIsProcessing(true);
    try {
      let finalBudget = errandForm.budget;
      if (errandForm.category === ErrandCategory.MAMA_FUA) finalBudget = (errandForm.laundryBaskets || 1) * (errandForm.pricePerBasket || 250);
      
      const data = { 
        ...errandForm, 
        budget: finalBudget, 
        requesterId: user.id, 
        requesterName: user.name, 
        pickupLocation: errandForm.pickup?.name || '', 
        pickupCoordinates: errandForm.pickup?.coords || { lat: 0, lng: 0 }, 
        dropoffLocation: errandForm.isInHouse ? (errandForm.pickup?.name || '') : (errandForm.dropoff?.name || errandForm.pickup?.name || ''), 
        dropoffCoordinates: errandForm.isInHouse ? (errandForm.pickup?.coords || { lat: 0, lng: 0 }) : (errandForm.dropoff?.coords || errandForm.pickup?.coords || { lat: 0, lng: 0 }),
        maxShoppingBudget: errandForm.maxShoppingBudget || 0
      };
      await firebaseService.createErrand(data);
      triggerHaptic();
      setErrandForm({ 
        category: ErrandCategory.GENERAL, title: '', budget: 0, deadline: '', 
        pickup: null, dropoff: null, laundryBaskets: 1, pricePerBasket: 250, 
        houseType: '', minBudget: 0, maxBudget: 0, moveInDate: '', 
        additionalRequirements: '', description: '', isInHouse: false,
        voiceNoteUrl: undefined, checklist: undefined,
        maxShoppingBudget: 0,
        urgency: 'normal',
        packageDescription: '',
        packageCost: 0,
        shoppingList: '',
        marketSection: ''
      });
      setActiveTab('dashboard');
    } catch (e) { alert("Post failed."); } finally { setIsProcessing(false); }
  };

  const handleRunnerComplete = async (id: string, comments: string, photo?: string) => {
    if (!user) return;
    
    // GPS Spoofing check
    if (currentLocation && selectedErrand?.dropoffCoordinates) {
      const dist = calculateDistance(currentLocation, selectedErrand.dropoffCoordinates);
      if (dist > 0.5) { // 500m threshold
        if (!window.confirm(`You appear to be ${dist.toFixed(1)}km away from the drop-off location. Are you sure you want to submit? This may be flagged as GPS spoofing.`)) {
          return;
        }
      }
    }

    setIsProcessing(true);
    try {
      await firebaseService.submitForReview(id, comments, photo);
      await refreshErrand();
    } catch (e) { alert("Submission failed."); } finally { setIsProcessing(false); }
  };

  const handleCompleteErrand = async (errandId: string) => {
    if (!user) return;
    setIsProcessing(true);
    try {
      await firebaseService.completeErrand(errandId, 'SIGNED', 5);
      
      // Update loyalty points and hours saved
      const pointsEarned = 100; // Base points per errand
      const hoursSavedEarned = 2; // Estimated hours saved per errand
      
      const newPoints = (user.loyaltyPoints || 0) + pointsEarned;
      const newHours = (user.hoursSaved || 0) + hoursSavedEarned;
      
      // Determine new level
      let newLevel = LoyaltyLevel.BRONZE;
      if (newPoints >= 5000) newLevel = LoyaltyLevel.PLATINUM;
      else if (newPoints >= 2500) newLevel = LoyaltyLevel.GOLD;
      else if (newPoints >= 1000) newLevel = LoyaltyLevel.SILVER;
      
      const updates = {
        loyaltyPoints: newPoints,
        hoursSaved: newHours,
        loyaltyLevel: newLevel
      };
      
      await firebaseService.updateUserSettings(user.id, updates);
      setUser({ ...user, ...updates });
      
      triggerHaptic();
      
      // Refresh errand
      await refreshErrand();
    } catch (e) {
      alert("Completion failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  const refreshErrand = async () => {
    if (selectedErrand) {
      const updated = await firebaseService.fetchErrandById(selectedErrand.id);
      if (updated) setSelectedErrand(updated);
    }
  };

  if (loading) return <div className="h-screen flex items-center justify-center"><LoadingSpinner size={40} color="#000000" /></div>;

  const protectedAction = (action: () => void) => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    action();
  };

  return (
    <APIProvider apiKey={googleMapsApiKey || ''}>
      <Layout 
        user={user} 
      onLogout={() => firebaseService.logout().then(() => setUser(null))} 
      activeTab={activeTab} 
      setActiveTab={setActiveTab}
      onNotificationClick={(notif) => {
        if (notif.errandId) {
          const errand = errands.concat(availableErrands).find(e => e.id === notif.errandId);
          if (errand) {
            setSelectedErrand(errand);
          } else {
            // If not in current lists, try to fetch it
            firebaseService.fetchErrandById(notif.errandId).then(e => {
              if (e) setSelectedErrand(e);
            });
          }
        } else if (notif.type === 'message') {
          setActiveTab('my-errands');
        }
      }}
    >
      <TopProgressBar isLoading={isProcessing} />
      <div className="max-w-5xl mx-auto space-y-3 px-2">
        {activeTab === 'dashboard' && (
          <div className="space-y-5 pb-8">
            <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-[2rem] p-6 text-white relative overflow-hidden shadow-xl shadow-indigo-100">
              <div className="relative z-10">
                <h2 className="text-xl font-black mb-0.5 tracking-tight">Hello, {user ? user.name.split(' ')[0] : 'Guest'}!</h2>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] opacity-80 mb-4">What can we do for you today?</p>
                {user?.isAdmin && (
                  <div className="grid grid-cols-3 gap-2 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <div className="bg-white/10 backdrop-blur-md p-3 rounded-xl border border-white/5"><p className="text-[7px] font-black uppercase opacity-70 mb-0.5">Users</p><p className="text-sm font-black">{stats.totalUsers}</p></div>
                    <div className="bg-white/10 backdrop-blur-md p-3 rounded-xl border border-white/5"><p className="text-[7px] font-black uppercase opacity-70 mb-0.5">Tasks</p><p className="text-sm font-black">{stats.totalTasks}</p></div>
                    <div className="bg-white/10 backdrop-blur-md p-3 rounded-xl border border-white/5"><p className="text-[7px] font-black uppercase opacity-70 mb-0.5">Online</p><p className="text-sm font-black text-emerald-300">{stats.onlineUsers}</p></div>
                  </div>
                )}
              </div>
              <Sparkles className="absolute -right-4 -bottom-4 text-white/10" size={120} />
            </div>

            {/* Search Bar */}
            <div className="relative group z-30">
              <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
                <Search className="text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={18} />
              </div>
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="What do you need help with?" 
                className="w-full pl-12 pr-6 py-4 bg-white border border-slate-100 rounded-2xl font-bold text-slate-900 outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500/20 transition-all shadow-sm"
              />
              {searchSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl border border-slate-100 shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  {searchSuggestions.map((s, idx) => (
                    <button 
                      key={idx}
                      onClick={() => {
                        setSearchQuery(s);
                        setSearchSuggestions([]);
                        // Optionally trigger search or navigate
                      }}
                      className="w-full px-5 py-3 text-left text-xs font-bold text-slate-600 hover:bg-slate-50 border-b border-slate-50 last:border-none transition-colors flex items-center gap-3"
                    >
                      <Sparkles size={12} className="text-indigo-400" />
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Smart Create NLP */}
            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-900 tracking-tight">Quick Post (AI Assist)</h3>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Just type what you need</p>
                </div>
                <div className="bg-indigo-50 p-2 rounded-xl">
                  <Zap size={16} className="text-indigo-600" />
                </div>
              </div>
              <div className="relative">
                <textarea 
                  value={smartInput}
                  onChange={(e) => setSmartInput(e.target.value)}
                  placeholder="e.g. I need someone to buy me onions at Muthurwa market..."
                  className="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none h-24 resize-none focus:ring-2 focus:ring-indigo-500/10 transition-all"
                />
                <button 
                  onClick={handleSmartCreate}
                  disabled={isParsing || !smartInput.trim()}
                  className="absolute bottom-3 right-3 px-4 py-2 bg-black text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all disabled:opacity-50"
                >
                  {isParsing ? <Loader2 size={12} className="animate-spin" /> : "Post Errand"}
                </button>
              </div>
            </div>

            {/* Categories */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-base font-black text-slate-900 tracking-tight">Categories</h3>
                <button onClick={() => setActiveTab('menu')} className="text-[9px] font-black uppercase text-indigo-600 tracking-widest bg-indigo-50 px-3 py-1 rounded-full">Explore</button>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                {Object.values(ErrandCategory).map((cat) => (
                  <button 
                    key={cat}
                    onClick={() => {
                      setErrandForm({ ...errandForm, category: cat });
                      setActiveTab('create');
                    }}
                    className="flex-shrink-0 w-24 bg-white p-3 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all text-center group"
                  >
                    <div className="w-12 h-12 bg-indigo-50 rounded-xl mx-auto mb-2 overflow-hidden group-hover:scale-110 transition-transform flex items-center justify-center">
                      <img src={`https://picsum.photos/seed/${cat}/100/100`} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt={cat} />
                    </div>
                    <p className="text-[9px] font-black text-slate-700 uppercase leading-tight truncate">{cat}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Featured Services */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-base font-black text-slate-900 tracking-tight">Featured Services</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {featuredServices.length === 0 ? (
                  <div className="col-span-full p-12 text-center bg-white rounded-3xl border-2 border-dashed border-slate-100 text-slate-300 font-black uppercase text-[9px] tracking-widest">
                    No featured services yet
                  </div>
                ) : (
                  featuredServices.map(service => (
                    <div 
                      key={service.id} 
                      onClick={() => setSelectedFeaturedService(service)}
                      className="bg-white rounded-3xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all group cursor-pointer"
                    >
                      <div className="aspect-square relative overflow-hidden">
                        <img src={service.imageUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={service.title} />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                           <p className="text-[8px] font-black text-white uppercase tracking-widest">View Details</p>
                        </div>
                      </div>
                      <div className="p-3">
                        <h4 className="text-xs font-black text-slate-900 tracking-tight truncate mb-1">{service.title}</h4>
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-black text-indigo-600">From KSH {service.price}</p>
                          <Plus size={12} className="text-slate-300 group-hover:text-indigo-600 transition-colors" />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-base font-black text-slate-900 tracking-tight">Recent Activity</h3>
                <button onClick={() => setActiveTab('my-errands')} className="text-[9px] font-black uppercase text-indigo-600 tracking-widest bg-indigo-50 px-3 py-1 rounded-full">History</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {isLoadingErrands ? (
                  [1,2].map(i => <ErrandCardSkeleton key={i} />)
                ) : errands.slice(0, 4).length === 0 ? (
                  <div className="col-span-full p-10 text-center bg-white rounded-3xl border-2 border-dashed border-slate-100 text-slate-300 font-black uppercase text-[9px] tracking-widest">No Recent Activity</div>
                ) : (
                  errands.slice(0, 4).map(e => <ErrandCard key={e.id} errand={e} onClick={setSelectedErrand} currentLocation={currentLocation} />)
                )}
              </div>
            </div>
          </div>
        )}
        {activeTab === 'my-errands' && (
          <div className="space-y-6">
            {!user ? (
              <div className="p-20 text-center bg-white rounded-[2.5rem] border-2 border-dashed border-slate-100">
                <ShieldAlert size={48} className="mx-auto mb-4 text-slate-200" />
                <h3 className="text-lg font-black text-slate-900 mb-2">Login Required</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Sign in to view your tasks</p>
                <button onClick={() => setShowAuthModal(true)} className="px-10 py-4 bg-black text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl">Sign In Now</button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between px-2">
                  <div>
                    <h2 className="text-xl font-black text-slate-900 tracking-tight">My Errands</h2>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Manage your tasks</p>
                  </div>
                  <div className="bg-slate-100 px-3 py-1 rounded-full text-[10px] font-black text-slate-500 uppercase">{errands.length} Total</div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {isLoadingErrands ? (
                    [1,2,3,4].map(i => <ErrandCardSkeleton key={i} />)
                  ) : errands.length === 0 ? (
                    <div className="col-span-full p-12 md:p-20 text-center bg-white rounded-[3rem] border border-slate-100 shadow-sm animate-in fade-in zoom-in-95">
                      <div className="w-24 h-24 bg-indigo-50 rounded-[2rem] flex items-center justify-center mx-auto mb-6 relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-tr from-indigo-100 to-transparent opacity-50" />
                        <Sparkles size={40} className="text-indigo-400 relative z-10" />
                      </div>
                      <h3 className="text-xl font-black text-slate-900 mb-2">Your afternoon looks busy</h3>
                      <p className="text-sm font-bold text-slate-400 mb-8 max-w-[240px] mx-auto">Want us to handle the laundry or run some errands for you?</p>
                      <button 
                        onClick={() => setActiveTab('create')}
                        className="px-8 py-4 bg-black text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-slate-200 active:scale-95 transition-all"
                      >
                        Create New Errand
                      </button>
                    </div>
                  ) : (
                    errands.map(e => <ErrandCard key={e.id} errand={e} onClick={setSelectedErrand} currentLocation={currentLocation} />)
                  )}
                </div>
              </>
            )}
          </div>
        )}
        {activeTab === 'menu' && (
          <MenuView 
            listings={serviceListings} 
            onSelect={(listing) => {
              setSelectedFeaturedService(listing as any);
            }} 
          />
        )}
        {activeTab === 'create' && (
          <CreateScreen 
            errandForm={errandForm} 
            setErrandForm={setErrandForm} 
            postErrand={(e: any) => protectedAction(() => postErrand(e))} 
            loading={isProcessing} 
            errors={formErrors} 
          />
        )}
        {activeTab === 'find' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-xl font-black text-slate-900 tracking-tight">Find Errands</h2>
              <div className="flex items-center gap-2">
                <Filter size={14} className="text-slate-400" />
                <select 
                  value={proximityFilter || ''} 
                  onChange={e => setProximityFilter(e.target.value ? parseInt(e.target.value) : null)}
                  className="bg-slate-100 border-none rounded-xl px-3 py-1.5 text-[10px] font-black uppercase tracking-widest outline-none"
                >
                  <option value="">All Distances</option>
                  <option value="5">Within 5km</option>
                  <option value="10">Within 10km</option>
                  <option value="20">Within 20km</option>
                  <option value="50">Within 50km</option>
                </select>
              </div>
            </div>
            <MapView errands={filteredErrands} onSelectErrand={setSelectedErrand} height="300px" userLocation={currentLocation} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {isLoadingAvailable ? (
                [1,2,3,4].map(i => <ErrandCardSkeleton key={i} />)
              ) : filteredErrands.length === 0 ? (
                <div className="col-span-full p-16 text-center bg-white rounded-[2rem] border border-slate-100 shadow-sm animate-in fade-in zoom-in-95">
                  <div className="w-20 h-20 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <Search size={32} className="text-slate-200" />
                  </div>
                  <h3 className="text-lg font-black text-slate-900 mb-1">No errands nearby</h3>
                  <p className="text-xs font-bold text-slate-400">Try increasing your search range or check back later.</p>
                </div>
              ) : (
                filteredErrands.map(e => <ErrandCard key={e.id} errand={e} onClick={setSelectedErrand} currentLocation={currentLocation} />)
              )}
            </div>
          </div>
        )}
        {activeTab === 'admin' && user && <AdminPanel user={user} settings={appSettings} stats={stats} />}
        {activeTab === 'active' && (
           <div className="max-w-xl mx-auto pb-10 -mt-2 md:-mt-4">
            {!user ? (
              <div className="bg-white rounded-[2.5rem] p-12 border border-slate-100 shadow-sm text-center animate-in fade-in zoom-in-95">
                <div className="w-24 h-24 bg-slate-50 rounded-[2rem] flex items-center justify-center mx-auto mb-8 relative overflow-hidden">
                   <div className="absolute inset-0 bg-gradient-to-tr from-slate-100 to-transparent opacity-50" />
                   <UserCircle size={48} className="text-slate-200 relative z-10" />
                </div>
                <h2 className="text-2xl font-black text-slate-900 mb-2">My Profile</h2>
                <p className="text-sm font-bold text-slate-400 mb-10">Login to see your info</p>
                <button onClick={() => setShowAuthModal(true)} className="w-full py-5 bg-[#00aeef] text-white rounded-[2rem] font-black uppercase text-sm tracking-widest shadow-xl active:scale-95 transition-all">Login</button>
                
                <div className="mt-12 space-y-1">
                  <ProfileMenuItem icon={<Globe size={18} />} label="Change Language" onClick={() => setShowLanguageModal(true)} />
                  <ProfileMenuItem icon={<Calculator size={18} />} label="Price Guide" onClick={() => setShowPriceGuideModal(true)} />
                  <ProfileMenuItem icon={<HelpCircle size={18} />} label="FAQs" />
                  <ProfileMenuItem icon={<Phone size={18} />} label="Contact Us" onClick={() => setShowContactUsModal(true)} />
                  <ProfileMenuItem icon={<ShieldAlert size={18} />} label="Cookies Policy" />
                  <ProfileMenuItem icon={<Info size={18} />} label="About Us" />
                  <ProfileMenuItem icon={<ShieldAlert size={18} />} label="Privacy Policy" />
                  <ProfileMenuItem icon={<List size={18} />} label="Terms and Conditions" />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {profileView === 'main' && (
                  <>
                    <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm text-center">
                      <img src={user.avatar || `https://i.pravatar.cc/150?u=${user.id}`} className="w-20 h-20 rounded-[1.5rem] mx-auto mb-5 border-4 border-white shadow-xl" />
                      <h2 className="text-lg font-black text-slate-900">{user.name}</h2>
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1 mb-4">{user.role}</p>
                      
                      {user.biography && (
                        <p className="text-xs text-slate-500 font-medium mb-6 px-4 leading-relaxed italic">"{user.biography}"</p>
                      )}

                      <div className="grid grid-cols-3 gap-2 mb-4">
                        <div className="bg-slate-50 p-3 rounded-2xl"><p className="text-[7px] font-black uppercase text-slate-400">Rating</p><p className="text-sm font-black text-slate-900">{user.rating.toFixed(1)}</p></div>
                        <div className="bg-slate-50 p-3 rounded-2xl"><p className="text-[7px] font-black uppercase text-slate-400">Earnings</p><p className="text-sm font-black text-emerald-600">Ksh {user.balanceOnHold || 0}</p></div>
                        <div className="bg-slate-50 p-3 rounded-2xl"><p className="text-[7px] font-black uppercase text-slate-400">Wallet</p><p className="text-sm font-black text-indigo-600">Ksh {user.walletBalance || 0}</p></div>
                      </div>

                      {user.role === UserRole.RUNNER && (
                        <div className="grid grid-cols-3 gap-2 mb-6">
                          <div className="bg-slate-50 p-3 rounded-2xl">
                            <p className="text-[7px] font-black uppercase text-slate-400">Cancel Rate</p>
                            <p className={`text-sm font-black ${user.cancellationRate && user.cancellationRate > 30 ? 'text-red-600' : 'text-slate-900'}`}>
                              {Math.round((user.cancellationRate || 0) * 100)}%
                            </p>
                          </div>
                          <div className="bg-slate-50 p-3 rounded-2xl">
                            <p className="text-[7px] font-black uppercase text-slate-400">Late Rate</p>
                            <p className={`text-sm font-black ${user.lateCompletionRate && user.lateCompletionRate > 30 ? 'text-red-600' : 'text-slate-900'}`}>
                              {Math.round((user.lateCompletionRate || 0) * 100)}%
                            </p>
                          </div>
                          <div className="bg-slate-50 p-3 rounded-2xl">
                            <p className="text-[7px] font-black uppercase text-slate-400">Reject Rate</p>
                            <p className={`text-sm font-black ${user.rejectionRate && user.rejectionRate > 30 ? 'text-red-600' : 'text-slate-900'}`}>
                              {Math.round((user.rejectionRate || 0) * 100)}%
                            </p>
                          </div>
                        </div>
                      )}

                      {user.isSuspended && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-left">
                          <div className="flex items-center gap-2 text-red-600 mb-1">
                            <AlertCircle size={16} />
                            <p className="text-[10px] font-black uppercase tracking-widest">Account Suspended</p>
                          </div>
                          <p className="text-[10px] font-bold text-red-500 leading-relaxed">
                            Reason: {user.suspensionReason}
                            {user.suspensionExpiresAt && ` until ${new Date(user.suspensionExpiresAt).toLocaleDateString()}`}
                          </p>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => setProfileView('edit')} className="py-3.5 bg-black text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:opacity-90 transition-all">Edit Profile</button>
                        <button onClick={() => setProfileView('history')} className="py-3.5 border border-slate-200 text-slate-600 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 transition-all">Task History</button>
                      </div>

                      {user.role === UserRole.REQUESTER && (
                        <button onClick={() => setProfileView('apply-runner')} className="w-full mt-3 py-4 bg-indigo-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-indigo-700 transition-all flex items-center justify-center gap-2">
                          <Briefcase size={16} /> Become a Runner
                        </button>
                      )}

                      <button onClick={() => firebaseService.logout().then(() => setUser(null))} className="w-full mt-3 py-3.5 border border-red-100 text-red-500 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-red-50 transition-all">Sign Out</button>
                    </div>

                    {/* Loyalty & Impact Section */}
                    <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm overflow-hidden relative">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full -mr-16 -mt-16 opacity-50" />
                      <div className="relative z-10">
                        <div className="flex items-center justify-between mb-8">
                          <div className="flex items-center gap-3">
                            <div className="p-3 bg-amber-500 text-white rounded-xl shadow-lg shadow-amber-100"><Sparkles size={20} /></div>
                            <div>
                              <h3 className="text-base font-black text-slate-900">Loyalty Status</h3>
                              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Rewards & Impact</p>
                            </div>
                          </div>
                          <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                            user.loyaltyLevel === LoyaltyLevel.GOLD ? 'bg-amber-100 text-amber-600' :
                            user.loyaltyLevel === LoyaltyLevel.SILVER ? 'bg-slate-100 text-slate-600' :
                            user.loyaltyLevel === LoyaltyLevel.PLATINUM ? 'bg-indigo-100 text-indigo-600' :
                            'bg-orange-100 text-orange-600'
                          }`}>
                            {user.loyaltyLevel || LoyaltyLevel.BRONZE}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-8">
                          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center"><Clock size={12} /></div>
                              <p className="text-[8px] font-black uppercase text-slate-400">Hours Saved</p>
                            </div>
                            <p className="text-xl font-black text-slate-900">{user.hoursSaved || 0}</p>
                            <p className="text-[7px] font-bold text-slate-400 mt-1 uppercase">This month</p>
                          </div>
                          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-6 h-6 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center"><Target size={12} /></div>
                              <p className="text-[8px] font-black uppercase text-slate-400">Points</p>
                            </div>
                            <p className="text-xl font-black text-slate-900">{user.loyaltyPoints || 0}</p>
                            <p className="text-[7px] font-bold text-slate-400 mt-1 uppercase">Total Earned</p>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">
                            <span>Progress to {user.loyaltyLevel === LoyaltyLevel.GOLD ? 'Platinum' : user.loyaltyLevel === LoyaltyLevel.SILVER ? 'Gold' : 'Silver'}</span>
                            <span>{Math.min(100, ((user.loyaltyPoints || 0) % 1000) / 10)}%</span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-indigo-600 transition-all duration-1000" 
                              style={{ width: `${Math.min(100, ((user.loyaltyPoints || 0) % 1000) / 10)}%` }} 
                            />
                          </div>
                        </div>

                        <button onClick={() => setShowLoyaltyModal(true)} className="w-full mt-6 py-3 bg-slate-900 text-white rounded-xl font-black uppercase text-[9px] tracking-widest hover:bg-black transition-all">
                          View Level Benefits
                        </button>
                      </div>
                    </div>

                    <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm">
                      <div className="flex items-center gap-3 mb-8">
                        <div className="p-3 bg-black text-white rounded-xl"><Settings size={20} /></div>
                        <div><h3 className="text-base font-black text-slate-900">Settings</h3><p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Preferences</p></div>
                      </div>
                      <UserSettings user={user} isDarkMode={isDarkMode} onToggleDarkMode={toggleDarkMode} />
                    </div>

                    <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm">
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                          <div className="p-3 bg-indigo-600 text-white rounded-xl"><HelpCircle size={20} /></div>
                          <div><h3 className="text-base font-black text-slate-900">Support</h3><p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Get Help</p></div>
                        </div>
                        <button onClick={() => setShowContactUsModal(true)} className="text-[9px] font-black uppercase text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">Contact Us</button>
                      </div>
                      <div className="space-y-1">
                        <ProfileMenuItem icon={<Globe size={18} />} label="Change Language" onClick={() => setShowLanguageModal(true)} />
                        <ProfileMenuItem icon={<Calculator size={18} />} label="Price Guide" onClick={() => setShowPriceGuideModal(true)} />
                        <ProfileMenuItem icon={<MessageCircle size={18} />} label="Live Support Chat" onClick={() => setActiveTab('support-chat')} />
                      </div>
                    </div>
                  </>
                )}

                {profileView === 'edit' && (
                  <ProfileEditor 
                    user={user} 
                    onUpdate={(updates) => setUser({...user, ...updates})} 
                    onBack={() => setProfileView('main')} 
                  />
                )}

                {profileView === 'apply-runner' && (
                  <RunnerApplicationFlow user={user} onBack={() => setProfileView('main')} />
                )}

                {profileView === 'history' && (
                  <TaskHistory 
                    user={user} 
                    onBack={() => setProfileView('main')} 
                    onSelectErrand={(e) => {
                      setSelectedErrand(e);
                      setProfileView('main');
                    }}
                    onRebook={handleRebook}
                  />
                )}
              </div>
            )}
           </div>
        )}
        {activeTab === 'support-chat' && user && (
          <div className="max-w-xl mx-auto h-[600px] bg-white rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col overflow-hidden">
            <header className="p-6 border-b flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button onClick={() => setActiveTab('active')} className="p-2 bg-slate-50 text-slate-400 rounded-xl"><ChevronLeft size={18} /></button>
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Support Center</h3>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Live with Admin</p>
                </div>
              </div>
            </header>
            <SupportChatView user={user} />
          </div>
        )}
      </div>
      {selectedErrand && (
        <ErrandDetailScreen 
          selectedErrand={selectedErrand} 
          setSelectedErrand={setSelectedErrand} 
          user={user} 
          setUser={setUser} 
          refresh={refreshErrand} 
          onRunnerComplete={handleRunnerComplete} 
          onCompleteErrand={handleCompleteErrand} 
          loading={isProcessing}
          setShowPriceRequestModal={setShowPriceRequestModal}
          setShowAddPropertyModal={setShowAddPropertyModal}
          setShowComparisonModal={setShowComparisonModal}
          setShowAuthModal={setShowAuthModal}
        />
      )}
      {selectedFeaturedService && (
        <FeaturedServiceModal 
          service={selectedFeaturedService} 
          onClose={() => setSelectedFeaturedService(null)} 
          onOrder={(s) => {
            setErrandForm({ ...errandForm, category: s.category, title: s.title, description: s.description });
            setActiveTab('create');
            setSelectedFeaturedService(null);
          }}
        />
      )}
      {showLanguageModal && <LanguageModal onClose={() => setShowLanguageModal(false)} />}
      {showPriceGuideModal && <PriceGuideModal onClose={() => setShowPriceGuideModal(false)} />}
      {showContactUsModal && <ContactUsModal onClose={() => setShowContactUsModal(false)} setActiveTab={setActiveTab} />}
      {user && !user.isAdmin && <SupportChatOverlay user={user} />}
      {showLoyaltyModal && <LoyaltyBenefitsModal onClose={() => setShowLoyaltyModal(false)} />}
      
      {showPriceRequestModal && (
        <PriceRequestModal 
          request={showPriceRequestModal} 
          onRespond={async (status) => {
            if (!selectedErrand) return;
            await firebaseService.respondToPriceRequest(selectedErrand.id, showPriceRequestModal.id, status);
            setShowPriceRequestModal(null);
            refreshErrand();
          }} 
        />
      )}

      {showAddPropertyModal && (
        <AddPropertyModal 
          onClose={() => setShowAddPropertyModal(false)}
          onAdd={async (listing) => {
            if (!selectedErrand) return;
            await firebaseService.addPropertyListing(selectedErrand.id, listing);
            setShowAddPropertyModal(false);
            refreshErrand();
          }}
        />
      )}

      {showComparisonModal && selectedErrand && (
        <PropertyComparisonModal 
          listings={selectedErrand.propertyListings || []}
          onClose={() => setShowComparisonModal(false)}
        />
      )}

      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)} 
        onAuthSuccess={(u) => setUser(u)} 
        firebaseService={firebaseService} 
      />
    </Layout>
  </APIProvider>
  );
}

const AuthScreen: React.FC<any> = ({ appSettings, isLogin, setIsLogin, authForm, setAuthForm, handleAuth, loading, error }) => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 font-sans">
    <div className="w-full max-w-md flex flex-col items-center">
      <div className="text-center mb-10 animate-in fade-in slide-in-from-top-4 duration-700">
        <div className="w-24 h-24 bg-indigo-600 rounded-[2rem] flex items-center justify-center mx-auto mb-6 logo-shadow overflow-hidden shadow-xl shadow-indigo-100">
          {appSettings.logoUrl ? <img src={appSettings.logoUrl} className="w-full h-full object-cover" alt="Logo" /> : <ShoppingBag className="text-white" size={38} />}
        </div>
        <h1 className="text-4xl font-[900] text-slate-900 tracking-tight leading-none mb-3">Errands</h1>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.45em] ml-1">On Demand Excellence</p>
      </div>
      <div className="w-full bg-white rounded-[3rem] p-8 border border-slate-100 brand-shadow animate-in zoom-in-95 duration-500">
        <div className="text-center mb-8">
          <h2 className="text-xl font-[900] text-slate-900 tracking-tight mb-1.5">{isLogin ? 'Welcome Back' : 'Create Account'}</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{isLogin ? 'Sign in to your account' : 'Join our community today'}</p>
        </div>
        {error && <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-[10px] font-black mb-6 border border-red-100/50 uppercase text-center tracking-widest animate-shake">{error}</div>}
        <form onSubmit={handleAuth} className="space-y-6">
          {!isLogin && (
            <>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Full Name <span className="text-red-500">*</span></label>
                <input type="text" placeholder="John Doe" value={authForm.name} onChange={e => setAuthForm({...authForm, name: e.target.value})} className="w-full p-4 brand-input rounded-2xl font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20" required />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Phone Number <span className="text-red-500">*</span></label>
                <input type="tel" placeholder="+254..." value={authForm.phone} onChange={e => setAuthForm({...authForm, phone: e.target.value})} className="w-full p-4 brand-input rounded-2xl font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20" required />
              </div>
            </>
          )}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Email or Phone <span className="text-red-500">*</span></label>
            <input type="text" placeholder="email@example.com or 07..." value={authForm.email} onChange={e => setAuthForm({...authForm, email: e.target.value})} className="w-full p-4 brand-input rounded-2xl font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20" required />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Password <span className="text-red-500">*</span></label>
            <input type="password" placeholder="••••••••" value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})} className="w-full p-4 brand-input rounded-2xl font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20" required />
          </div>
          <button disabled={loading} className="w-full py-6 bg-indigo-600 text-white rounded-2xl font-[900] text-[12px] uppercase tracking-[0.2em] shadow-xl shadow-indigo-100 flex items-center justify-center gap-2 mt-4 hover:bg-indigo-700 active:scale-95 transition-all">
            {loading ? <LoadingSpinner color="white" /> : (isLogin ? 'SIGN IN' : 'REGISTER')}
          </button>
        </form>
        <button onClick={() => setIsLogin(!isLogin)} className="w-full mt-8 text-[11px] font-black text-slate-500 uppercase tracking-widest hover:text-indigo-600 transition-all">{isLogin ? "Don't have an account? Sign Up" : 'Already have an account? Sign In'}</button>
      </div>
    </div>
  </div>
);

const FeaturedServiceModal: React.FC<{ service: FeaturedService, onClose: () => void, onOrder: (s: FeaturedService) => void }> = ({ service, onClose, onOrder }) => {
  const [explanation, setExplanation] = useState(service.explanation || '');
  const [paymentGuide, setPaymentGuide] = useState(service.paymentGuide || '');
  const [loading, setLoading] = useState(!service.explanation || !service.paymentGuide);

  useEffect(() => {
    if (!service.explanation || !service.paymentGuide) {
      const generateDetails = async () => {
        try {
          const prompt = `Generate a detailed explanation and a payment guide for a featured service in an on-demand errands app.
          Service Title: ${service.title}
          Category: ${service.category}
          Description: ${service.description}
          Base Price: KSh ${service.price}

          Return the response in JSON format with two fields: "explanation" (what the runner does) and "paymentGuide" (how the pricing works, including potential extra costs like transport).
          Make it professional and concise.`;
          
          const response = await callGeminiWithRetry(prompt);
          const cleaned = response.replace(/```json|```/g, '').trim();
          const data = JSON.parse(cleaned);
          setExplanation(data.explanation);
          setPaymentGuide(data.paymentGuide);
        } catch (e) {
          setExplanation(service.description);
          setPaymentGuide(`Base price is KSh ${service.price}. Additional costs may apply for distance or extra requirements.`);
        } finally {
          setLoading(false);
        }
      };
      generateDetails();
    }
  }, [service]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
        <div className="relative h-56 flex-shrink-0">
          <img src={service.imageUrl} className="w-full h-full object-cover" alt={service.title} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-white/20 backdrop-blur-md text-white rounded-full hover:bg-white/40 transition-all z-10">
            <X size={20} />
          </button>
          <div className="absolute bottom-6 left-6 right-6">
            <span className="text-[9px] font-black uppercase tracking-widest text-white bg-indigo-600 px-3 py-1 rounded-full">{service.category}</span>
            <h3 className="text-2xl font-[900] text-white mt-2 leading-tight">{service.title}</h3>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-8 space-y-6 no-scrollbar">
          <div className="space-y-2">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Task Explanation</h4>
            {loading ? (
              <div className="flex items-center gap-2 text-slate-400 py-2">
                <Loader2 size={14} className="animate-spin" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Generating details...</span>
              </div>
            ) : (
              <p className="text-xs text-slate-600 font-medium leading-relaxed">{explanation}</p>
            )}
          </div>

          <div className="space-y-2">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Payment Guide</h4>
            {loading ? (
              <div className="flex items-center gap-2 text-slate-400 py-2">
                <Loader2 size={14} className="animate-spin" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Calculating guide...</span>
              </div>
            ) : (
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                <p className="text-xs text-slate-600 font-medium leading-relaxed mb-3">{paymentGuide}</p>
                <div className="flex justify-between items-center pt-3 border-t border-slate-200">
                  <span className="text-[10px] font-black text-slate-400 uppercase">Base Price</span>
                  <span className="text-lg font-black text-slate-900">KSh {service.price}</span>
                </div>
              </div>
            )}
          </div>

          <div className="bg-indigo-50 p-5 rounded-2xl border border-indigo-100/50 flex items-start gap-3">
            <Info size={18} className="text-indigo-600 shrink-0 mt-0.5" />
            <p className="text-[10px] text-indigo-600/80 font-bold leading-relaxed">
              This is a featured service. Our top-rated runners are prioritized for these tasks to ensure the best experience.
            </p>
          </div>
        </div>

        <div className="p-6 bg-white border-t border-slate-50 flex-shrink-0">
          <button 
            onClick={() => onOrder(service)}
            className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl shadow-indigo-100 active:scale-95 transition-all flex items-center justify-center gap-3"
          >
            <ShoppingBag size={18} /> Order Service
          </button>
        </div>
      </div>
    </div>
  );
};

const LanguageModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
    <div className="bg-white rounded-[2rem] w-full max-w-xs overflow-hidden shadow-2xl animate-in zoom-in-95">
      <div className="p-6 border-b flex justify-between items-center">
        <h3 className="text-sm font-black uppercase tracking-widest">Select Language</h3>
        <button onClick={onClose} className="p-2 bg-slate-50 rounded-xl"><X size={16} /></button>
      </div>
      <div className="p-2">
        <button className="w-full flex items-center justify-between p-4 bg-indigo-50 text-indigo-600 rounded-xl font-black text-xs uppercase tracking-widest">
          English <Check size={16} />
        </button>
        <button className="w-full flex items-center justify-between p-4 hover:bg-slate-50 text-slate-400 rounded-xl font-black text-xs uppercase tracking-widest">
          Swahili <span>(Coming Soon)</span>
        </button>
        <button className="w-full flex items-center justify-between p-4 hover:bg-slate-50 text-slate-400 rounded-xl font-black text-xs uppercase tracking-widest">
          French <span>(Coming Soon)</span>
        </button>
      </div>
    </div>
  </div>
);

const PriceGuideModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
    <div className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 max-h-[80vh] flex flex-col">
      <div className="p-6 border-b flex justify-between items-center bg-slate-50">
        <div>
          <h3 className="text-sm font-black uppercase tracking-widest">Pricing Guide</h3>
          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Estimated Base Rates</p>
        </div>
        <button onClick={onClose} className="p-2 bg-white rounded-xl shadow-sm"><X size={16} /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {[
          { category: 'Laundry (Mama Fua)', price: 'Ksh 250', unit: 'per basket' },
          { category: 'House Hunting', price: 'Ksh 1,500', unit: 'per day' },
          { category: 'Grocery Shopping', price: 'Ksh 300', unit: 'per trip' },
          { category: 'Parcel Delivery', price: 'Ksh 200', unit: 'per 5km' },
          { category: 'Cleaning Services', price: 'Ksh 800', unit: 'per room' },
          { category: 'Pet Walking', price: 'Ksh 400', unit: 'per hour' },
          { category: 'General Errands', price: 'Ksh 500', unit: 'base rate' }
        ].map((item, idx) => (
          <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <div>
              <p className="text-xs font-black text-slate-900">{item.category}</p>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{item.unit}</p>
            </div>
            <p className="text-sm font-black text-indigo-600">From {item.price}</p>
          </div>
        ))}
        <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
          <p className="text-[9px] font-bold text-indigo-600 leading-relaxed italic">
            * Prices are estimates and may vary based on urgency, distance, and specific requirements. Runners may bid higher or lower than these rates.
          </p>
        </div>
      </div>
    </div>
  </div>
);

const ContactUsModal: React.FC<{ onClose: () => void, setActiveTab: (t: string) => void }> = ({ onClose, setActiveTab }) => (
  <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
    <div className="bg-white rounded-[2.5rem] w-full max-w-xs overflow-hidden shadow-2xl animate-in zoom-in-95">
      <div className="p-6 border-b flex justify-between items-center">
        <h3 className="text-sm font-black uppercase tracking-widest">Contact Us</h3>
        <button onClick={onClose} className="p-2 bg-slate-50 rounded-xl"><X size={16} /></button>
      </div>
      <div className="p-2">
        <ProfileMenuItem icon={<MessageCircle size={18} />} label="Live Support Chat" onClick={() => { setActiveTab('support-chat'); onClose(); }} />
        <ProfileMenuItem icon={<Mail size={18} />} label="Email Support" onClick={() => window.location.href = "mailto:errand.support@codexict.co.ke"} />
        <ProfileMenuItem icon={<MessageCircle size={18} className="text-emerald-500" />} label="WhatsApp" onClick={() => window.open("https://wa.me/254722603149", "_blank")} />
        <ProfileMenuItem icon={<Phone size={18} className="text-indigo-500" />} label="Call Support" onClick={() => window.location.href = "tel:+254752269300"} />
      </div>
    </div>
  </div>
);

const ProfileMenuItem: React.FC<{ icon: React.ReactNode, label: string, onClick?: () => void }> = ({ icon, label, onClick }) => (
  <button onClick={onClick} className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-all border-b border-slate-50 last:border-none group">
    <div className="flex items-center gap-4">
      <div className="text-slate-400 group-hover:text-black transition-colors">{icon}</div>
      <span className="text-sm font-black text-slate-700 tracking-tight">{label}</span>
    </div>
    <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
  </button>
);

const AdminPanel: React.FC<{ user: User; settings: AppSettings; stats: { totalUsers: number, totalTasks: number, onlineUsers: number } }> = ({ user, settings, stats }) => {
  const [primaryColor, setPrimaryColor] = useState(settings.primaryColor);
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl || '');
  const [iconUrl, setIconUrl] = useState(settings.iconUrl || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isIconUploading, setIsIconUploading] = useState(false);
  const [activeAdminTab, setActiveAdminTab] = useState<'stats' | 'branding' | 'support' | 'applications' | 'services' | 'listings' | 'users'>('stats');
  const [dbUsers, setDbUsers] = useState<User[]>([]);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [supportChats, setSupportChats] = useState<any[]>([]);
  const [applications, setApplications] = useState<RunnerApplication[]>([]);
  const [adminFeaturedServices, setAdminFeaturedServices] = useState<FeaturedService[]>([]);
  const [adminServiceListings, setAdminServiceListings] = useState<ServiceListing[]>([]);
  const [newService, setNewService] = useState({ title: '', description: '', price: 0, imageUrl: '', category: ErrandCategory.GENERAL });
  const [newListing, setNewListing] = useState({ title: '', description: '', price: 0, imageUrl: '', category: ErrandCategory.GENERAL, scope: '' });
  const [isAddingService, setIsAddingService] = useState(false);
  const [isAddingListing, setIsAddingListing] = useState(false);
  const [selectedSupportUser, setSelectedSupportUser] = useState<string | null>(null);
  const logoFileRef = useRef<HTMLInputElement>(null);
  const iconFileRef = useRef<HTMLInputElement>(null);

  const isSuperAdmin = user.email === 'admin@codexict.co.ke' || user.email === 'ngugimaina4@gmail.com';

  useEffect(() => {
    setPrimaryColor(settings.primaryColor);
    setLogoUrl(settings.logoUrl || '');
    setIconUrl(settings.iconUrl || '');
  }, [settings]);

  useEffect(() => {
    if (activeAdminTab === 'support') {
      const unsub = firebaseService.subscribeToAllSupportChats(setSupportChats);
      return () => unsub();
    }
    if (activeAdminTab === 'applications') {
      firebaseService.fetchRunnerApplications().then(setApplications);
    }
    if (activeAdminTab === 'services') {
      firebaseService.fetchFeaturedServices().then(setAdminFeaturedServices);
    }
    if (activeAdminTab === 'listings') {
      firebaseService.fetchServiceListings().then(setAdminServiceListings);
    }
    if (activeAdminTab === 'users') {
      firebaseService.fetchAllUsers().then(setDbUsers);
    }
  }, [activeAdminTab]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const url = await cloudinaryService.uploadImage(file, 'app_logos');
      setLogoUrl(url);
      await firebaseService.saveAppSettings({ logoUrl: url });
      alert("Logo uploaded and updated.");
    } catch (e) { alert("Logo upload failed."); } finally { setIsUploading(false); }
  };

  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsIconUploading(true);
    try {
      const url = await cloudinaryService.uploadImage(file, 'app_icons');
      setIconUrl(url);
      await firebaseService.saveAppSettings({ iconUrl: url });
      alert("Icon uploaded and updated.");
    } catch (e) { alert("Icon upload failed."); } finally { setIsIconUploading(false); }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      await firebaseService.saveAppSettings({ primaryColor, logoUrl, iconUrl });
      alert("Settings updated globally.");
    } catch (e) { alert("Failed to save settings."); } finally { setIsSaving(false); }
  };

  const handleApprove = async (app: RunnerApplication) => {
    try {
      await firebaseService.updateRunnerApplicationStatus(app.id, app.userId, 'approved', app.categoryApplied);
      setApplications(prev => prev.map(a => a.id === app.id ? {...a, status: 'approved'} : a));
      alert("Application approved!");
    } catch (e) { alert("Action failed"); }
  };

  const handleAddService = async () => {
    if (!newService.title || !newService.imageUrl) return;
    setIsAddingService(true);
    try {
      await firebaseService.addFeaturedService(newService);
      const updated = await firebaseService.fetchFeaturedServices();
      setAdminFeaturedServices(updated);
      setNewService({ title: '', description: '', price: 0, imageUrl: '', category: ErrandCategory.GENERAL });
      alert("Service added!");
    } catch (e) { alert("Failed to add service"); } finally { setIsAddingService(false); }
  };

  const handleDeleteService = async (id: string) => {
    if (!confirm("Delete this service?")) return;
    try {
      await firebaseService.deleteFeaturedService(id);
      setAdminFeaturedServices(prev => prev.filter(s => s.id !== id));
    } catch (e) { alert("Delete failed"); }
  };

  const handleServiceImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const url = await cloudinaryService.uploadImage(file);
      setNewService({ ...newService, imageUrl: url });
    } catch (e) { alert("Image upload failed"); } finally { setIsUploading(false); }
  };

  const handleListingImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const url = await cloudinaryService.uploadImage(file);
      setNewListing({ ...newListing, imageUrl: url });
    } catch (e) { alert("Image upload failed"); } finally { setIsUploading(false); }
  };

  const handleAddListing = async () => {
    if (!newListing.title || !newListing.imageUrl) return;
    setIsAddingListing(true);
    try {
      await firebaseService.addServiceListing(newListing);
      const updated = await firebaseService.fetchServiceListings();
      setAdminServiceListings(updated);
      setNewListing({ title: '', description: '', price: 0, imageUrl: '', category: ErrandCategory.GENERAL, scope: '' });
      alert("Listing added!");
    } catch (e) { alert("Failed to add listing"); } finally { setIsAddingListing(false); }
  };

  const handleDeleteListing = async (id: string) => {
    if (!confirm("Delete this listing?")) return;
    try {
      await firebaseService.deleteServiceListing(id);
      setAdminServiceListings(prev => prev.filter(s => s.id !== id));
    } catch (e) { alert("Delete failed"); }
  };

  return (
    <div className="space-y-4 pb-10">
      <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl w-fit mb-4 overflow-x-auto max-w-full">
        <button onClick={() => setActiveAdminTab('stats')} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeAdminTab === 'stats' ? 'bg-white text-black shadow-sm' : 'text-slate-400'}`}>Stats</button>
        <button onClick={() => setActiveAdminTab('applications')} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeAdminTab === 'applications' ? 'bg-white text-black shadow-sm' : 'text-slate-400'}`}>Applications</button>
        <button onClick={() => setActiveAdminTab('listings')} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeAdminTab === 'listings' ? 'bg-white text-black shadow-sm' : 'text-slate-400'}`}>Menu Listings</button>
        <button onClick={() => setActiveAdminTab('users')} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeAdminTab === 'users' ? 'bg-white text-black shadow-sm' : 'text-slate-400'}`}>Users</button>
        <button onClick={() => setActiveAdminTab('services')} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeAdminTab === 'services' ? 'bg-white text-black shadow-sm' : 'text-slate-400'}`}>Featured</button>
        {isSuperAdmin && <button onClick={() => setActiveAdminTab('branding')} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeAdminTab === 'branding' ? 'bg-white text-black shadow-sm' : 'text-slate-400'}`}>Branding</button>}
        <button onClick={() => setActiveAdminTab('support')} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeAdminTab === 'support' ? 'bg-white text-black shadow-sm' : 'text-slate-400'} flex items-center gap-2`}>
          Support
          {supportChats.some(c => c.unreadByAdmin) && <span className="w-2 h-2 bg-red-500 rounded-full" />}
        </button>
      </div>

      {activeAdminTab === 'stats' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-black text-white rounded-xl"><ShieldAlert size={24} /></div>
              <div>
                <h2 className="text-lg font-black text-slate-900">Admin Dashboard</h2>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">System Performance Metrics</p>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-3">
              <div className="p-4 bg-slate-50 rounded-2xl text-center">
                <p className="text-[8px] font-black uppercase text-slate-400">Users</p>
                <p className="text-base font-black text-slate-900">{stats.totalUsers}</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl text-center">
                <p className="text-[8px] font-black uppercase text-slate-400">Tasks</p>
                <p className="text-base font-black text-black">{stats.totalTasks}</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl text-center">
                <p className="text-[8px] font-black uppercase text-slate-400">Online</p>
                <p className="text-base font-black text-emerald-600">{stats.onlineUsers}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-4 bg-indigo-50 rounded-2xl">
                <p className="text-[7px] font-black uppercase text-indigo-400 mb-1">Avg Distance</p>
                <p className="text-sm font-black text-indigo-600">{stats.avgDistance?.toFixed(1)} KM</p>
              </div>
              <div className="p-4 bg-emerald-50 rounded-2xl">
                <p className="text-[7px] font-black uppercase text-emerald-400 mb-1">Avg Time</p>
                <p className="text-sm font-black text-emerald-600">{stats.avgCompletionTime?.toFixed(0)} MIN</p>
              </div>
              <div className="p-4 bg-rose-50 rounded-2xl">
                <p className="text-[7px] font-black uppercase text-rose-400 mb-1">Avg Penalty</p>
                <p className="text-sm font-black text-rose-600">Ksh {stats.avgPenalty?.toFixed(0)}</p>
              </div>
              <div className="p-4 bg-amber-50 rounded-2xl">
                <p className="text-[7px] font-black uppercase text-amber-400 mb-1">Failure Rate</p>
                <p className="text-sm font-black text-amber-600">{stats.failedErrandsPercent?.toFixed(1)}%</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Revenue Chart */}
            <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Revenue (Last 7 Days)</h3>
              <div className="h-40 flex items-end gap-2">
                {stats.revenuePerDay?.map((day: any, i: number) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                    <div 
                      className="w-full bg-indigo-600 rounded-t-lg transition-all group-hover:bg-indigo-700" 
                      style={{ height: `${Math.max(10, (day.amount / Math.max(...stats.revenuePerDay.map((d: any) => d.amount || 1))) * 100)}%` }}
                    />
                    <p className="text-[7px] font-black text-slate-400 uppercase rotate-45 mt-2">{day.date.split('/')[0]}/{day.date.split('/')[1]}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Lists */}
            <div className="space-y-4">
              <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Top Runners</h3>
                <div className="space-y-3">
                  {stats.topRunners?.map((r: any, i: number) => (
                    <div key={r.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-slate-300">#{i+1}</span>
                        <p className="text-xs font-black text-slate-900">{r.name}</p>
                      </div>
                      <p className="text-[10px] font-black text-indigo-600 uppercase">{r.errandsCompleted || 0} Tasks</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Top Requesters</h3>
                <div className="space-y-3">
                  {stats.topRequesters?.map((r: any, i: number) => (
                    <div key={r.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-slate-300">#{i+1}</span>
                        <p className="text-xs font-black text-slate-900">{r.name}</p>
                      </div>
                      <p className="text-[10px] font-black text-emerald-600 uppercase">{r.tasksCount || 0} Posts</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeAdminTab === 'applications' && (
        <div className="space-y-4 animate-in fade-in">
          {applications.length === 0 ? (
            <div className="p-20 text-center bg-white rounded-[2rem] border-2 border-dashed border-slate-100 text-slate-300 font-black uppercase text-[10px] tracking-widest">No applications yet</div>
          ) : (
            applications.map(app => (
              <div key={app.id} className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-black text-slate-900">{app.fullName}</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{app.categoryApplied} • {app.phone}</p>
                  </div>
                  <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-lg border ${app.status === 'pending' ? 'bg-amber-50 text-amber-600 border-amber-100' : app.status === 'approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                    {app.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <img src={app.idFrontUrl} className="rounded-xl aspect-video object-cover border" alt="ID Front" />
                  <img src={app.idBackUrl} className="rounded-xl aspect-video object-cover border" alt="ID Back" />
                </div>
                {app.status === 'pending' ? (
                  <div className="flex gap-2 pt-2">
                    <button onClick={() => firebaseService.updateRunnerApplicationStatus(app.id, app.userId, 'rejected').then(() => setActiveAdminTab('applications'))} className="flex-1 py-2.5 border border-red-100 text-red-500 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-red-50 transition-all">Reject</button>
                    <button onClick={() => handleApprove(app)} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all">Approve</button>
                  </div>
                ) : (
                  <div className="flex gap-2 pt-2">
                    <button 
                      onClick={() => firebaseService.updateRunnerApplicationStatus(app.id, app.userId, app.status === 'approved' ? 'rejected' : 'approved', app.categoryApplied).then(() => setActiveAdminTab('applications'))} 
                      className={`flex-1 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all ${app.status === 'approved' ? 'border border-red-100 text-red-500 hover:bg-red-50' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100'}`}
                    >
                      {app.status === 'approved' ? 'Revoke / Reject' : 'Re-Approve'}
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {activeAdminTab === 'users' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm flex justify-between items-center">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">User Management</h3>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{dbUsers.length} Total Users</p>
          </div>
          
          <div className="grid grid-cols-1 gap-3">
            {dbUsers.map(u => (
              <div key={u.id} className="bg-white rounded-[2rem] p-5 border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <img src={u.avatar || `https://i.pravatar.cc/150?u=${u.id}`} className="w-12 h-12 rounded-2xl object-cover border-2 border-slate-50" alt="" />
                    <span className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white ${u.isOnline ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900 text-sm">{u.name}</h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{u.email} • {u.phone || 'No Phone'}</p>
                    <div className="flex gap-2 mt-1">
                      <span className={`text-[7px] font-black uppercase px-2 py-0.5 rounded-md ${u.isAdmin ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>{u.isAdmin ? 'Admin' : u.role}</span>
                      {u.isVerified && <span className="text-[7px] font-black uppercase px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-600">Verified</span>}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setEditingUser(u)}
                    className="px-4 py-2 bg-slate-50 text-slate-600 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-slate-100 transition-all"
                  >
                    Edit User
                  </button>
                  {isSuperAdmin && !u.isAdmin && (
                    <button 
                      onClick={() => {
                        if(confirm(`Make ${u.name} an Admin?`)) {
                          firebaseService.adminUpdateUser(u.id, { isAdmin: true }).then(() => firebaseService.fetchAllUsers().then(setDbUsers));
                        }
                      }}
                      className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-indigo-100 transition-all"
                    >
                      Make Admin
                    </button>
                  )}
                  <button 
                    onClick={async () => {
                      if (confirm(`Are you sure you want to delete ${u.name}? This action cannot be undone.`)) {
                        try {
                          await firebaseService.adminDeleteUser(u.id);
                          const updated = await firebaseService.fetchAllUsers();
                          setDbUsers(updated);
                          alert("User deleted successfully.");
                        } catch (e: any) {
                          console.error("Delete failed:", e);
                          alert("Delete failed: " + (e.message || "Unknown error"));
                        }
                      }
                    }}
                    className="p-2 text-red-400 hover:bg-red-50 rounded-xl transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {editingUser && (
            <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95">
                <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                  <h3 className="text-sm font-black uppercase tracking-widest">Edit User: {editingUser.name}</h3>
                  <button onClick={() => setEditingUser(null)} className="p-2 bg-white rounded-xl shadow-sm"><X size={16} /></button>
                </div>
                <div className="p-6 space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Role</label>
                    <select 
                      value={editingUser.role} 
                      onChange={e => setEditingUser({...editingUser, role: e.target.value as UserRole})}
                      className="w-full p-4 bg-slate-50 rounded-2xl border-none outline-none font-bold text-sm"
                    >
                      {Object.values(UserRole).map(r => <option key={r} value={r}>{r.toUpperCase()}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Verification Status</label>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setEditingUser({...editingUser, isVerified: true})}
                        className={`flex-1 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all ${editingUser.isVerified ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100' : 'bg-slate-50 text-slate-400'}`}
                      >
                        Verified
                      </button>
                      <button 
                        onClick={() => setEditingUser({...editingUser, isVerified: false})}
                        className={`flex-1 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all ${!editingUser.isVerified ? 'bg-red-600 text-white shadow-lg shadow-red-100' : 'bg-slate-50 text-slate-400'}`}
                      >
                        Unverified
                      </button>
                    </div>
                  </div>
                  <button 
                    onClick={async () => {
                      await firebaseService.adminUpdateUser(editingUser.id, { role: editingUser.role, isVerified: editingUser.isVerified });
                      const updated = await firebaseService.fetchAllUsers();
                      setDbUsers(updated);
                      setEditingUser(null);
                      alert("User updated successfully!");
                    }}
                    className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl mt-4"
                  >
                    Save Changes
                  </button>
                  <button 
                    onClick={async () => {
                      if (confirm(`Are you sure you want to delete ${editingUser.name}? This action cannot be undone.`)) {
                        try {
                          await firebaseService.adminDeleteUser(editingUser.id);
                          const updated = await firebaseService.fetchAllUsers();
                          setDbUsers(updated);
                          setEditingUser(null);
                          alert("User deleted successfully.");
                        } catch (e: any) {
                          console.error("Delete failed:", e);
                          alert("Delete failed: " + (e.message || "Unknown error"));
                        }
                      }
                    }}
                    className="w-full py-3 border border-red-100 text-red-500 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-red-50 transition-all mt-2"
                  >
                    Delete User
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeAdminTab === 'listings' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm space-y-4">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Add Menu Listing</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input 
                type="text" 
                placeholder="Listing Title (e.g. Duvet Washing)" 
                value={newListing.title} 
                onChange={e => setNewListing({...newListing, title: e.target.value})}
                className="p-4 bg-slate-50 rounded-2xl border-none outline-none font-bold text-sm"
              />
              <input 
                type="text" 
                placeholder="Scope (e.g. Hand Wash, Per Hour)" 
                value={newListing.scope} 
                onChange={e => setNewListing({...newListing, scope: e.target.value})}
                className="p-4 bg-slate-50 rounded-2xl border-none outline-none font-bold text-sm"
              />
              <input 
                type="number" 
                placeholder="Price (KSH)" 
                value={newListing.price || ''} 
                onChange={e => setNewListing({...newListing, price: Number(e.target.value)})}
                className="p-4 bg-slate-50 rounded-2xl border-none outline-none font-bold text-sm"
              />
              <select 
                value={newListing.category} 
                onChange={e => setNewListing({...newListing, category: e.target.value as ErrandCategory})}
                className="p-4 bg-slate-50 rounded-2xl border-none outline-none font-bold text-sm"
              >
                {Object.values(ErrandCategory).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => document.getElementById('listing-img')?.click()}
                  className="flex-1 p-4 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 font-bold text-xs flex items-center justify-center gap-2"
                >
                  {newListing.imageUrl ? <Check size={14} className="text-emerald-500" /> : <Upload size={14} />}
                  {newListing.imageUrl ? "Image Ready" : "Upload Image"}
                </button>
                <input id="listing-img" type="file" className="hidden" accept="image/*" onChange={handleListingImageUpload} />
              </div>
            </div>
            <textarea 
              placeholder="Description" 
              value={newListing.description} 
              onChange={e => setNewListing({...newListing, description: e.target.value})}
              className="w-full p-4 bg-slate-50 rounded-2xl border-none outline-none font-bold text-sm h-24 resize-none"
            />
            <button 
              disabled={isAddingListing || !newListing.title || !newListing.imageUrl}
              onClick={handleAddListing}
              className="w-full py-5 bg-black text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl disabled:opacity-50"
            >
              {isAddingListing ? <LoadingSpinner color="white" /> : "Add Menu Listing"}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {adminServiceListings.map(s => (
              <div key={s.id} className="bg-white rounded-[2rem] p-4 border border-slate-100 shadow-sm flex gap-4 items-center">
                <img src={s.imageUrl} className="w-16 h-16 rounded-xl object-cover border" alt="" />
                <div className="flex-1 min-w-0">
                  <h4 className="font-black text-slate-900 text-xs truncate">{s.title}</h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{s.category} • KSh{s.price}</p>
                </div>
                <button onClick={() => handleDeleteListing(s.id)} className="p-2 text-red-400 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeAdminTab === 'services' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm space-y-4">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Add Featured Service</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input 
                type="text" 
                placeholder="Service Title" 
                value={newService.title} 
                onChange={e => setNewService({...newService, title: e.target.value})}
                className="p-4 bg-slate-50 rounded-2xl border-none outline-none font-bold text-sm"
              />
              <input 
                type="number" 
                placeholder="Price (KSH)" 
                value={newService.price || ''} 
                onChange={e => setNewService({...newService, price: Number(e.target.value)})}
                className="p-4 bg-slate-50 rounded-2xl border-none outline-none font-bold text-sm"
              />
              <select 
                value={newService.category} 
                onChange={e => setNewService({...newService, category: e.target.value as ErrandCategory})}
                className="p-4 bg-slate-50 rounded-2xl border-none outline-none font-bold text-sm"
              >
                {Object.values(ErrandCategory).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => document.getElementById('service-img')?.click()}
                  className="flex-1 p-4 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 font-bold text-xs flex items-center justify-center gap-2"
                >
                  {newService.imageUrl ? <Check size={14} className="text-emerald-500" /> : <Upload size={14} />}
                  {newService.imageUrl ? "Image Ready" : "Upload Image"}
                </button>
                <input id="service-img" type="file" className="hidden" accept="image/*" onChange={handleServiceImageUpload} />
              </div>
            </div>
            <textarea 
              placeholder="Description" 
              value={newService.description} 
              onChange={e => setNewService({...newService, description: e.target.value})}
              className="w-full p-4 bg-slate-50 rounded-2xl border-none outline-none font-bold text-sm h-24 resize-none"
            />
            <button 
              disabled={isAddingService || !newService.title || !newService.imageUrl}
              onClick={handleAddService}
              className="w-full py-5 bg-black text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl disabled:opacity-50"
            >
              {isAddingService ? <LoadingSpinner color="white" /> : "Add Featured Service"}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {adminFeaturedServices.map(s => (
              <div key={s.id} className="bg-white rounded-[2rem] p-4 border border-slate-100 shadow-sm flex gap-4 items-center">
                <img src={s.imageUrl} className="w-20 h-20 rounded-2xl object-cover" alt={s.title} />
                <div className="flex-1 min-w-0">
                  <h4 className="font-black text-slate-900 truncate">{s.title}</h4>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{s.category} • KSH {s.price}</p>
                </div>
                <button onClick={() => handleDeleteService(s.id)} className="p-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-all">
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      {activeAdminTab === 'branding' && isSuperAdmin && (
        <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm space-y-6 animate-in slide-in-from-bottom-4">
          <div className="flex items-center gap-3"><div className="p-3 bg-black text-white rounded-xl"><Settings size={24} /></div><div><h2 className="text-lg font-black text-slate-900">Branding</h2><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Global Styles</p></div></div>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Primary Color</label>
              <div className="flex gap-3">
                <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-12 h-12 rounded-xl cursor-pointer" />
                <input type="text" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="flex-1 p-3 brand-input rounded-xl font-bold text-sm" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">App Logo</label>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-indigo-600 rounded-xl border-2 border-dashed border-indigo-200 flex items-center justify-center overflow-hidden">
                  {logoUrl ? <img src={logoUrl} className="w-full h-full object-cover" alt="Logo" /> : <LucideImageIcon className="text-white/50" />}
                </div>
                <button disabled={isUploading} onClick={() => logoFileRef.current?.click()} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">{isUploading ? <LoadingSpinner color="white" /> : <><Upload size={14} /> Upload Logo</>}</button>
                <input type="file" ref={logoFileRef} className="hidden" accept="image/*" onChange={handleLogoUpload} />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">App Icon</label>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-indigo-600 rounded-xl border-2 border-dashed border-indigo-200 flex items-center justify-center overflow-hidden">
                  {iconUrl ? <img src={iconUrl} className="w-full h-full object-cover" alt="Icon" /> : <ShoppingBag className="text-white/50" />}
                </div>
                <button disabled={isIconUploading} onClick={() => iconFileRef.current?.click()} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">{isIconUploading ? <LoadingSpinner color="white" /> : <><Upload size={14} /> Upload Icon</>}</button>
                <input type="file" ref={iconFileRef} className="hidden" accept="image/*" onChange={handleIconUpload} />
              </div>
            </div>
            <button disabled={isSaving} onClick={handleSaveSettings} className="w-full py-5 btn-navy rounded-2xl font-black text-[11px] uppercase tracking-[0.2em]">{isSaving ? <LoadingSpinner color="white" /> : "Save Settings"}</button>
            
            <div className="pt-6 border-t border-slate-100">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">System Configuration</h3>
              <button 
                onClick={() => window.open('/api/admin/export-env', '_blank')}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-black transition-all shadow-xl shadow-slate-200"
              >
                <Download size={14} /> Export .env File
              </button>
            </div>
          </div>
        </div>
      )}

      {activeAdminTab === 'support' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in">
          <div className="md:col-span-1 bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col h-[600px]">
            <header className="p-5 border-b bg-slate-50">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Conversations</h3>
            </header>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {supportChats.length === 0 ? (
                <div className="p-10 text-center opacity-20"><MessageSquare size={32} className="mx-auto mb-2" /><p className="text-[10px] font-black uppercase">No Chats</p></div>
              ) : (
                supportChats.map(c => (
                  <button 
                    key={c.id} 
                    onClick={() => setSelectedSupportUser(c.userId)}
                    className={`w-full p-4 rounded-2xl text-left transition-all flex items-center justify-between ${selectedSupportUser === c.userId ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'hover:bg-slate-50'}`}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-black truncate">{c.userName}</p>
                      <p className={`text-[9px] truncate ${selectedSupportUser === c.userId ? 'text-white/60' : 'text-slate-400'}`}>
                        {c.messages?.[c.messages.length - 1]?.text || 'No messages'}
                      </p>
                    </div>
                    {c.unreadByAdmin && <div className="w-2 h-2 bg-red-500 rounded-full shrink-0 ml-2" />}
                  </button>
                ))
              )}
            </div>
          </div>
          <div className="md:col-span-2 bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col h-[600px]">
            {selectedSupportUser ? (
              <SupportChatView user={user} targetUserId={selectedSupportUser} isAdmin={true} />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-300 gap-3">
                <MessageCircle size={48} strokeWidth={1} />
                <p className="text-[10px] font-black uppercase tracking-widest">Select a conversation</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const SupportChatView: React.FC<{ user: User, targetUserId?: string, isAdmin?: boolean }> = ({ user, targetUserId, isAdmin = false }) => {
  const [chat, setChat] = useState<any>(null);
  const [text, setText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const chatUserId = targetUserId || user.id;

  useEffect(() => {
    const unsub = firebaseService.subscribeToSupportChat(chatUserId, (data) => {
      setChat(data);
      if (isAdmin ? data?.unreadByAdmin : data?.unreadByUser) {
        firebaseService.markSupportChatAsRead(chatUserId, isAdmin);
      }
    });
    return () => unsub();
  }, [chatUserId, isAdmin]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chat?.messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    const msg = text;
    setText('');
    await firebaseService.sendSupportMessage(chatUserId, user.name, msg, isAdmin);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/30">
        {!chat || !chat.messages || chat.messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-10 opacity-30">
            <MessageSquare size={48} strokeWidth={1} />
            <p className="text-xs font-black uppercase mt-4">No messages yet</p>
          </div>
        ) : (
          chat.messages.map((m: any, i: number) => (
            <div key={i} className={`flex flex-col ${m.senderId === (isAdmin ? 'admin' : user.id) ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[80%] p-4 rounded-2xl text-xs font-medium leading-relaxed ${m.senderId === (isAdmin ? 'admin' : user.id) ? 'bg-indigo-600 text-white rounded-tr-none shadow-lg shadow-indigo-100' : 'bg-white text-slate-900 border border-slate-100 rounded-tl-none shadow-sm'}`}>
                {m.text}
              </div>
              <span className="text-[8px] font-black text-slate-400 uppercase mt-1.5 px-1">{m.senderName} • {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          ))
        )}
      </div>
      <form onSubmit={handleSend} className="p-4 bg-white border-t flex gap-3">
        <input 
          type="text" value={text} onChange={e => setText(e.target.value)} 
          placeholder="Type your message..." 
          className="flex-1 bg-slate-50 border-none rounded-2xl px-5 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
        />
        <button type="submit" className="p-3 bg-indigo-600 text-white rounded-2xl active:scale-90 transition-all shadow-lg shadow-indigo-100">
          <ArrowRight size={20} />
        </button>
      </form>
    </div>
  );
};

const triggerHaptic = () => {
  if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
    window.navigator.vibrate(10);
  }
};

const Skeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={`animate-pulse bg-slate-100 rounded-xl ${className}`} />
);

const ErrandCardSkeleton = () => (
  <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm space-y-2">
    <div className="flex justify-between items-start gap-3">
      <div className="flex-1 space-y-2">
        <div className="flex gap-2">
           <Skeleton className="h-4 w-16 rounded-md" />
           <Skeleton className="h-3 w-12 rounded-md" />
        </div>
        <Skeleton className="h-4 w-3/4 rounded-md" />
        <Skeleton className="h-3 w-1/2 rounded-md" />
      </div>
      <div className="flex flex-col items-end gap-1.5">
        <Skeleton className="h-4 w-16 rounded-md" />
        <Skeleton className="h-4 w-12 rounded-md" />
      </div>
    </div>
  </div>
);

const ErrandStatusTimeline: React.FC<{ status: ErrandStatus, category?: ErrandCategory }> = ({ status, category }) => {
  const isShopping = category === ErrandCategory.SHOPPING;
  
  const defaultStages = [
    { id: ErrandStatus.PENDING, label: 'Posted', icon: <Plus size={12} /> },
    { id: ErrandStatus.ACCEPTED, label: 'Assigned', icon: <UserCheck size={12} /> },
    { id: ErrandStatus.VERIFYING, label: 'Review', icon: <Search size={12} /> },
    { id: ErrandStatus.COMPLETED, label: 'Finished', icon: <CheckCircle size={12} /> }
  ];

  const shoppingStages = [
    { id: ErrandStatus.PENDING, label: 'Order Placed', icon: <ShoppingBag size={12} /> },
    { id: ErrandStatus.ACCEPTED, label: 'Shopping', icon: <Briefcase size={12} /> },
    { id: ErrandStatus.VERIFYING, label: 'On the Way', icon: <Navigation size={12} /> },
    { id: ErrandStatus.COMPLETED, label: 'Delivered', icon: <CheckCircle size={12} /> }
  ];

  const stages = isShopping ? shoppingStages : defaultStages;

  const getStatusIndex = (s: ErrandStatus) => {
    if (s === ErrandStatus.CANCELLED) return -1;
    return stages.findIndex(stage => stage.id === s);
  };

  const currentIndex = getStatusIndex(status);

  if (status === ErrandStatus.CANCELLED) {
    return (
      <div className="bg-red-50 p-4 rounded-2xl border border-red-100 flex items-center gap-3 mb-6">
        <div className="w-8 h-8 bg-red-100 text-red-600 rounded-full flex items-center justify-center">
          <X size={16} />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-red-600">Errand Cancelled</p>
          <p className="text-[8px] font-bold text-red-400 uppercase">This task is no longer active</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8 px-2">
      <div className="flex items-center justify-between relative">
        {/* Progress Line Background */}
        <div className="absolute top-4 left-0 right-0 h-0.5 bg-slate-100 -z-0" />
        
        {/* Active Progress Line */}
        <div 
          className="absolute top-4 left-0 h-0.5 bg-indigo-600 transition-all duration-500 -z-0" 
          style={{ width: `${Math.max(0, currentIndex) * (100 / (stages.length - 1))}%` }}
        />

        {stages.map((stage, idx) => {
          const isCompleted = idx < currentIndex;
          const isCurrent = idx === currentIndex;
          const isPending = idx > currentIndex;

          return (
            <div key={stage.id} className="flex flex-col items-center relative z-10">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 border-2 ${
                isCompleted ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100' : 
                isCurrent ? 'bg-white border-indigo-600 text-indigo-600 shadow-xl scale-110' : 
                'bg-white border-slate-200 text-slate-300'
              }`}>
                {isCompleted ? <Check size={14} strokeWidth={3} /> : stage.icon}
              </div>
              <span className={`mt-2 text-[8px] font-black uppercase tracking-tighter transition-colors ${
                isCurrent ? 'text-indigo-600' : 'text-slate-400'
              }`}>
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const MapView: React.FC<{ errands?: Errand[], onSelectErrand?: (e: Errand) => void, height?: string, userLocation?: Coordinates | null }> = ({ errands = [], onSelectErrand, height = "400px", userLocation }) => {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return (
      <div style={{ height }} className="rounded-[2rem] flex flex-col items-center justify-center bg-slate-100 text-slate-400 font-bold text-[10px] uppercase tracking-widest p-8 text-center gap-3">
        <ShieldAlert size={32} className="opacity-20" />
        <p>Google Maps API Key missing.<br/>Configure VITE_GOOGLE_MAPS_API_KEY.</p>
      </div>
    );
  }

  return (
    <APIProvider apiKey={apiKey}>
      <div style={{ height }} className="rounded-[2rem] overflow-hidden border border-slate-100 shadow-inner bg-slate-50 relative">
        <Map
          defaultCenter={userLocation || { lat: -1.286389, lng: 36.817223 }}
          defaultZoom={12}
          gestureHandling={'greedy'}
          disableDefaultUI={true}
          mapId="errands_map"
        >
          {userLocation && (
            <AdvancedMarker position={userLocation}>
              <div className="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg animate-pulse" />
            </AdvancedMarker>
          )}
          {errands.map(e => (
            e.pickupCoordinates && (
              <AdvancedMarker 
                key={e.id} 
                position={{ lat: e.pickupCoordinates.lat, lng: e.pickupCoordinates.lng }}
                onClick={() => onSelectErrand?.(e)}
              >
                <Pin background={'#000'} glyphColor={'#fff'} borderColor={'#000'} />
              </AdvancedMarker>
            )
          ))}
        </Map>
      </div>
    </APIProvider>
  );
};

const RunnerApplicationFlow: React.FC<{ user: User, onBack: () => void }> = ({ user, onBack }) => {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    fullName: user.name,
    phone: user.phone || '',
    nationalId: '',
    idFrontUrl: '',
    idBackUrl: '',
    categoryApplied: ErrandCategory.GENERAL
  });

  const handleUpload = async (file: File, field: 'idFrontUrl' | 'idBackUrl') => {
    setLoading(true);
    try {
      const url = await cloudinaryService.uploadImage(file);
      setForm(prev => ({ ...prev, [field]: url }));
    } catch (e) { alert("Upload failed"); } finally { setLoading(false); }
  };

  const handleSubmit = async () => {
    if (!form.nationalId || !form.idFrontUrl || !form.idBackUrl) {
      alert("Please complete all fields and uploads");
      return;
    }
    setLoading(true);
    try {
      await firebaseService.submitRunnerApplication({
        userId: user.id,
        ...form
      });
      alert("Application submitted successfully! We will review it shortly.");
      onBack();
    } catch (e) { alert("Submission failed"); } finally { setLoading(false); }
  };

  return (
    <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm animate-in slide-in-from-bottom-4">
      <button onClick={onBack} className="mb-6 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-black transition-colors">
        <ChevronLeft size={16} /> Back to Profile
      </button>

      <div className="mb-8">
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Become a Runner</h2>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Join our elite team of pros</p>
      </div>

      <div className="space-y-6">
        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Full Name</label>
          <input type="text" value={form.fullName} onChange={e => setForm({...form, fullName: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-sm outline-none" />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">National ID Number</label>
          <input type="text" value={form.nationalId} onChange={e => setForm({...form, nationalId: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-sm outline-none" />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Category</label>
          <select value={form.categoryApplied} onChange={e => setForm({...form, categoryApplied: e.target.value as ErrandCategory})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-sm outline-none">
            {Object.values(ErrandCategory).map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">ID Front</label>
            <div className="aspect-video bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden relative">
              {form.idFrontUrl ? <img src={form.idFrontUrl} className="w-full h-full object-cover" /> : <button onClick={() => document.getElementById('idFront')?.click()} className="text-[10px] font-black uppercase text-slate-400">Upload</button>}
              <input id="idFront" type="file" className="hidden" onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0], 'idFrontUrl')} />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">ID Back</label>
            <div className="aspect-video bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden relative">
              {form.idBackUrl ? <img src={form.idBackUrl} className="w-full h-full object-cover" /> : <button onClick={() => document.getElementById('idBack')?.click()} className="text-[10px] font-black uppercase text-slate-400">Upload</button>}
              <input id="idBack" type="file" className="hidden" onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0], 'idBackUrl')} />
            </div>
          </div>
        </div>

        <button disabled={loading} onClick={handleSubmit} className="w-full py-5 bg-black text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all mt-4">
          {loading ? <LoadingSpinner color="white" /> : "Submit Application"}
        </button>
      </div>
    </div>
  );
};

const ChatSection: React.FC<{ errandId: string, messages: ChatMessage[], user: User | null, onSendMessage: (text: string) => void }> = ({ errandId, messages, user, onSendMessage }) => {
  const [text, setText] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const QUICK_REPLIES = [
    "Leave it at the gate",
    "I'm coming down",
    "Call me when you arrive",
    "Thank you!",
    "On my way"
  ];

  useEffect(() => {
    if (scrollRef.current && !isCollapsed) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isCollapsed]);

  const handleSend = (e?: React.FormEvent, customText?: string) => {
    if (e) e.preventDefault();
    const messageText = customText || text;
    if (!messageText.trim()) return;
    onSendMessage(messageText);
    if (!customText) setText('');
  };

  return (
    <div className={`flex flex-col bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden transition-all duration-300 ${isCollapsed ? 'h-[50px]' : 'h-[450px]'}`}>
      <button 
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="p-3 border-b bg-white flex items-center justify-between w-full hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <MessageSquare size={14} className="text-indigo-600" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-900">Live Chat</span>
          {messages.length > 0 && isCollapsed && (
            <span className="bg-indigo-600 text-white text-[8px] px-1.5 py-0.5 rounded-full font-black">{messages.length}</span>
          )}
        </div>
        {isCollapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {!isCollapsed && (
        <>
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-50 gap-2">
                <MessageSquare size={32} strokeWidth={1} />
                <p className="text-[10px] font-bold uppercase">No messages yet</p>
              </div>
            ) : (
              messages.map((m, i) => (
                <div key={i} className={`flex flex-col ${m.senderId === user?.id ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[80%] p-3 rounded-2xl text-xs font-medium ${m.senderId === user?.id ? 'bg-black text-white rounded-tr-none' : 'bg-white text-slate-900 border border-slate-100 rounded-tl-none shadow-sm'}`}>
                    {m.text}
                  </div>
                  <span className="text-[8px] font-black text-slate-400 uppercase mt-1 px-1">{m.senderName} • {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              ))
            )}
          </div>
          
          <div className="px-3 py-2 bg-white border-t overflow-x-auto flex gap-2 no-scrollbar">
            {QUICK_REPLIES.map((reply, idx) => (
              <button 
                key={idx} 
                onClick={() => handleSend(undefined, reply)}
                className="whitespace-nowrap px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full text-[9px] font-black uppercase tracking-tight transition-colors"
              >
                {reply}
              </button>
            ))}
          </div>

          <form onSubmit={handleSend} className="p-3 bg-white border-t flex gap-2">
            <input 
              type="text" value={text} onChange={e => setText(e.target.value)} 
              placeholder="Type a message..." 
              className="flex-1 bg-slate-50 border-none rounded-xl px-4 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-black/5"
            />
            <button type="submit" className="p-2 bg-black text-white rounded-xl active:scale-90 transition-all">
              <ArrowRight size={18} />
            </button>
          </form>
        </>
      )}
    </div>
  );
};

const UserSettings: React.FC<{ user: User, isDarkMode: boolean, onToggleDarkMode: () => void }> = ({ user, isDarkMode, onToggleDarkMode }) => {
  const [notifSettings, setNotifSettings] = useState(user.notificationSettings || { email: true, push: true, sms: false });

  const handleToggleNotif = async (key: keyof typeof notifSettings) => {
    const updated = { ...notifSettings, [key]: !notifSettings[key] };
    setNotifSettings(updated);
    await firebaseService.updateUserSettings(user.id, { notificationSettings: updated });
  };

  return (
    <div className="space-y-6 text-left">
      <div className="space-y-4">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Notifications</h3>
        <div className="space-y-2">
          {Object.entries(notifSettings).map(([key, val]) => (
            <div key={key} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
              <span className="text-xs font-black uppercase tracking-tight text-slate-700">{key} Notifications</span>
              <button 
                onClick={() => handleToggleNotif(key as any)}
                className={`w-12 h-6 rounded-full transition-all relative ${val ? 'bg-indigo-600' : 'bg-slate-200'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${val ? 'right-1' : 'left-1'}`} />
              </button>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-4">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Appearance</h3>
        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
          <span className="text-xs font-black uppercase tracking-tight text-slate-700">Dark Mode</span>
          <button 
            onClick={onToggleDarkMode}
            className={`w-12 h-6 rounded-full transition-all relative ${isDarkMode ? 'bg-indigo-600' : 'bg-slate-200'}`}
          >
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isDarkMode ? 'right-1' : 'left-1'}`} />
          </button>
        </div>
      </div>
    </div>
  );
};

const LoyaltyBenefitsModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const levels = [
    {
      level: LoyaltyLevel.BRONZE,
      points: '0 - 999',
      benefits: ['Standard Service Fees', 'Standard Support', 'Access to all categories'],
      color: 'bg-orange-500',
      lightColor: 'bg-orange-50',
      textColor: 'text-orange-600'
    },
    {
      level: LoyaltyLevel.SILVER,
      points: '1,000 - 2,499',
      benefits: ['5% Lower Service Fees', 'Priority Support', 'Silver Badge on Profile'],
      color: 'bg-slate-400',
      lightColor: 'bg-slate-50',
      textColor: 'text-slate-600'
    },
    {
      level: LoyaltyLevel.GOLD,
      points: '2,500 - 4,999',
      benefits: ['10% Lower Service Fees', 'Priority Dispatch (Rainy Days)', 'Gold Badge on Profile'],
      color: 'bg-amber-500',
      lightColor: 'bg-amber-50',
      textColor: 'text-amber-600'
    },
    {
      level: LoyaltyLevel.PLATINUM,
      points: '5,000+',
      benefits: ['15% Lower Service Fees', 'VIP Support', 'Free Delivery on 1st Errand/Month'],
      color: 'bg-indigo-600',
      lightColor: 'bg-indigo-50',
      textColor: 'text-indigo-600'
    }
  ];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-end sm:items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-50 w-full max-w-lg rounded-[2.5rem] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-8 duration-300">
        <div className="p-8 bg-white border-b border-slate-100 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-black text-slate-900">Loyalty Rewards</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Level up for better perks</p>
          </div>
          <button onClick={onClose} className="p-3 bg-slate-100 text-slate-400 rounded-2xl hover:bg-slate-200 transition-all"><X size={20} /></button>
        </div>
        
        <div className="p-6 max-h-[70vh] overflow-y-auto space-y-4 no-scrollbar">
          {levels.map((l, idx) => (
            <div key={idx} className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 ${l.color} text-white rounded-xl flex items-center justify-center shadow-lg shadow-slate-100`}><Sparkles size={20} /></div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900">{l.level} Status</h4>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{l.points} Points</p>
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${l.lightColor} ${l.textColor}`}>
                  {idx === 0 ? 'Current' : 'Locked'}
                </div>
              </div>
              <div className="space-y-2">
                {l.benefits.map((b, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center"><Check size={10} /></div>
                    <p className="text-[10px] font-bold text-slate-600">{b}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        
        <div className="p-8 bg-white border-t border-slate-100">
          <button onClick={onClose} className="w-full py-4 bg-black text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all">Got it</button>
        </div>
      </div>
    </div>
  );
};

const PriceRequestModal: React.FC<{ request: PriceRequest, onRespond: (status: 'approved' | 'rejected') => void }> = ({ request, onRespond }) => {
  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
      <div className="w-full max-w-sm bg-white rounded-[2.5rem] p-8 space-y-6 shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <DollarSign size={32} />
          </div>
          <h3 className="text-xl font-black text-slate-900">Price Adjustment</h3>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Action Required</p>
        </div>

        <div className="bg-slate-50 rounded-2xl p-5 space-y-4 border border-slate-100">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Item</span>
            <span className="text-sm font-black text-slate-900">{request.itemName}</span>
          </div>
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200">
            <div>
              <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Original</p>
              <p className="text-lg font-black text-slate-400 line-through">Ksh {request.originalPrice}</p>
            </div>
            <div className="text-right">
              <p className="text-[8px] font-black text-amber-600 uppercase mb-1">New Price</p>
              <p className="text-xl font-black text-amber-600">Ksh {request.newPrice}</p>
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button 
            onClick={() => onRespond('rejected')}
            className="flex-1 py-4 border-2 border-slate-100 text-slate-400 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 transition-all"
          >
            Reject
          </button>
          <button 
            onClick={() => onRespond('approved')}
            className="flex-1 py-4 bg-amber-500 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-amber-100 hover:scale-105 transition-all"
          >
            Approve
          </button>
        </div>
      </div>
    </div>
  );
};

const AddPropertyModal: React.FC<{ onAdd: (listing: any) => void, onClose: () => void }> = ({ onAdd, onClose }) => {
  const [form, setForm] = useState({
    title: '',
    price: 0,
    location: '',
    description: '',
    amenities: { water: false, wifi: false, security: false, parking: false },
    agentRating: 5,
    imageUrl: ''
  });
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const url = await cloudinaryService.uploadImage(file);
      setForm({ ...form, imageUrl: url });
    } catch (e) { alert("Upload failed"); } finally { setIsUploading(false); }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-[3rem] p-8 space-y-6 overflow-y-auto max-h-[90vh]">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Add Property Listing</h3>
          <button onClick={onClose} className="p-2 bg-slate-100 rounded-xl text-slate-400"><X size={20} /></button>
        </div>

        <div className="space-y-4">
          <div className="aspect-video bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center overflow-hidden relative group">
            {form.imageUrl ? (
              <>
                <img src={form.imageUrl} className="w-full h-full object-cover" />
                <button onClick={() => setForm({...form, imageUrl: ''})} className="absolute top-2 right-2 p-2 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><X size={14} /></button>
              </>
            ) : (
              <div className="text-center space-y-2">
                <Camera size={24} className="mx-auto text-slate-300" />
                <button onClick={() => document.getElementById('propImg')?.click()} className="text-[10px] font-black uppercase text-slate-400">Upload Photo</button>
                <input id="propImg" type="file" className="hidden" onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])} />
              </div>
            )}
            {isUploading && <div className="absolute inset-0 bg-white/80 flex items-center justify-center"><Loader2 className="animate-spin text-indigo-600" /></div>}
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Property Title</label>
            <input type="text" value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="e.g. Modern Studio in Kilimani" className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-sm outline-none" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Rent (Ksh)</label>
              <input type="number" value={form.price || ''} onChange={e => setForm({...form, price: parseInt(e.target.value)})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-sm outline-none" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Agent Rating (1-5)</label>
              <input type="number" min="1" max="5" value={form.agentRating} onChange={e => setForm({...form, agentRating: parseInt(e.target.value)})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-sm outline-none" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Amenities</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(form.amenities).map(([key, val]) => (
                <button 
                  key={key} 
                  onClick={() => setForm({...form, amenities: {...form.amenities, [key]: !val}})}
                  className={`p-3 rounded-xl border-2 flex items-center gap-2 transition-all ${val ? 'border-indigo-600 bg-indigo-50 text-indigo-600' : 'border-slate-100 text-slate-400'}`}
                >
                  {key === 'water' && <Droplets size={14} />}
                  {key === 'wifi' && <Wifi size={14} />}
                  {key === 'security' && <Shield size={14} />}
                  {key === 'parking' && <Car size={14} />}
                  <span className="text-[10px] font-black uppercase">{key}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Agent Notes</label>
            <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Describe the condition, neighborhood, etc." className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs outline-none h-24 resize-none" />
          </div>
        </div>

        <button 
          disabled={!form.title || !form.price || !form.imageUrl} 
          onClick={() => onAdd(form)} 
          className="w-full py-5 bg-black text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all disabled:opacity-50"
        >
          Add Listing
        </button>
      </div>
    </div>
  );
};

const PropertyComparisonModal: React.FC<{ listings: PropertyListing[], onClose: () => void }> = ({ listings, onClose }) => {
  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-6">
      <div className="w-full max-w-4xl bg-white rounded-[3rem] p-8 space-y-8 overflow-x-auto">
        <div className="flex justify-between items-center min-w-[600px]">
          <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Property Comparison Matrix</h3>
          <button onClick={onClose} className="p-2 bg-slate-100 rounded-xl text-slate-400"><X size={20} /></button>
        </div>

        <table className="w-full min-w-[600px]">
          <thead>
            <tr>
              <th className="text-left py-4 border-b border-slate-100 text-[10px] font-black uppercase text-slate-400">Feature</th>
              {listings.map(l => (
                <th key={l.id} className="text-center py-4 border-b border-slate-100 px-4">
                  <div className="space-y-2">
                    <img src={l.imageUrl} className="w-24 h-24 rounded-2xl object-cover mx-auto shadow-md" />
                    <p className="text-xs font-black text-slate-900">{l.title}</p>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            <tr>
              <td className="py-6 text-[10px] font-black uppercase text-slate-400">Rent</td>
              {listings.map(l => (
                <td key={l.id} className="text-center py-6 font-black text-emerald-600">Ksh {l.price}</td>
              ))}
            </tr>
            <tr>
              <td className="py-6 text-[10px] font-black uppercase text-slate-400">Agent Rating</td>
              {listings.map(l => (
                <td key={l.id} className="text-center py-6">
                  <div className="flex items-center justify-center gap-1">
                    <Star size={12} className="text-amber-400 fill-amber-400" />
                    <span className="text-xs font-black">{l.agentRating}/5</span>
                  </div>
                </td>
              ))}
            </tr>
            <tr>
              <td className="py-6 text-[10px] font-black uppercase text-slate-400">Amenities</td>
              {listings.map(l => (
                <td key={l.id} className="text-center py-6">
                  <div className="flex flex-wrap justify-center gap-2">
                    {l.amenities.water && <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg" title="Water"><Droplets size={14} /></div>}
                    {l.amenities.wifi && <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg" title="WiFi"><Wifi size={14} /></div>}
                    {l.amenities.security && <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg" title="Security"><Shield size={14} /></div>}
                    {l.amenities.parking && <div className="p-1.5 bg-slate-50 text-slate-600 rounded-lg" title="Parking"><Car size={14} /></div>}
                  </div>
                </td>
              ))}
            </tr>
            <tr>
              <td className="py-6 text-[10px] font-black uppercase text-slate-400 align-top">Agent Notes</td>
              {listings.map(l => (
                <td key={l.id} className="text-center py-6 px-4">
                  <p className="text-[10px] font-medium text-slate-500 leading-relaxed italic">"{l.description}"</p>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

const ProfileEditor: React.FC<{ user: User, onUpdate: (updates: Partial<User>) => void, onBack: () => void }> = ({ user, onUpdate, onBack }) => {
  const [formData, setFormData] = useState({
    name: user.name,
    phone: user.phone || '',
    biography: user.biography || '',
    avatar: user.avatar || ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const url = await cloudinaryService.uploadImage(file, 'profile_pictures');
      setFormData({ ...formData, avatar: url });
    } catch (e) {
      alert("Avatar upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await firebaseService.updateUserSettings(user.id, formData);
      onUpdate(formData);
      alert("Profile updated successfully!");
      onBack();
    } catch (e) {
      alert("Failed to update profile.");
    } finally {
      setIsSaving(false);
    }
  };

  const isPhoneDisabled = !!user.phone;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="p-2 bg-slate-100 rounded-xl text-slate-500"><ChevronLeft size={20} /></button>
        <h2 className="text-xl font-black text-slate-900">Edit Profile</h2>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-6 bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
        <div className="flex flex-col items-center gap-4 mb-4">
          <div className="relative group">
            <img 
              src={formData.avatar || `https://i.pravatar.cc/150?u=${user.id}`} 
              className="w-24 h-24 rounded-[2rem] object-cover border-4 border-slate-50 shadow-lg" 
              alt="Avatar"
            />
            <button 
              type="button"
              onClick={() => document.getElementById('avatar-upload')?.click()}
              className="absolute inset-0 bg-black/40 rounded-[2rem] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
            >
              <Camera size={24} />
            </button>
          </div>
          <input 
            id="avatar-upload" 
            type="file" 
            className="hidden" 
            accept="image/*" 
            onChange={handleAvatarUpload} 
          />
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            {isUploading ? 'Uploading...' : 'Tap photo to change'}
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Full Name</label>
          <input 
            type="text" 
            value={formData.name} 
            onChange={e => setFormData({...formData, name: e.target.value})} 
            className="w-full p-4 brand-input rounded-2xl font-bold text-black outline-none" 
            required 
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Email (Read-only)</label>
          <input 
            type="email" 
            value={user.email} 
            className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-slate-400 outline-none cursor-not-allowed" 
            disabled 
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Phone Number {isPhoneDisabled && '(Locked)'}</label>
          <input 
            type="tel" 
            value={formData.phone} 
            onChange={e => setFormData({...formData, phone: e.target.value})} 
            className={`w-full p-4 rounded-2xl font-bold outline-none ${isPhoneDisabled ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : 'brand-input text-black'}`} 
            disabled={isPhoneDisabled}
            placeholder="+254..."
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Biography</label>
          <textarea 
            value={formData.biography} 
            onChange={e => setFormData({...formData, biography: e.target.value})} 
            placeholder="Tell us about yourself..." 
            className="w-full p-4 brand-input rounded-2xl font-bold text-slate-900 outline-none h-32 resize-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        <button 
          disabled={isSaving} 
          className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] shadow-xl shadow-indigo-100 flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all"
        >
          {isSaving ? <LoadingSpinner color="white" /> : "Save Changes"}
        </button>
      </form>
    </div>
  );
};

const TaskHistory: React.FC<{ user: User, onBack: () => void, onSelectErrand: (e: Errand) => void, onRebook: (e: Errand) => void }> = ({ user, onBack, onSelectErrand, onRebook }) => {
  const [errands, setErrands] = useState<Errand[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = firebaseService.subscribeToUserErrands(user.id, user.role, (data) => {
      setErrands(data.sort((a, b) => b.createdAt - a.createdAt));
      setLoading(false);
    });
    return () => unsub();
  }, [user.id, user.role]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="p-2 bg-slate-100 rounded-xl text-slate-500"><ChevronLeft size={20} /></button>
        <h2 className="text-xl font-black text-slate-900">Task History</h2>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><LoadingSpinner /></div>
      ) : errands.length === 0 ? (
        <div className="bg-white p-12 rounded-[2rem] border border-slate-100 shadow-sm text-center space-y-4">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-300">
            <ShoppingBag size={32} />
          </div>
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No tasks found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {errands.map(e => (
            <div key={e.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
              <div onClick={() => onSelectErrand(e)} className="cursor-pointer">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-black text-slate-900 group-hover:text-indigo-600 transition-colors">{e.title}</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{new Date(e.createdAt).toLocaleDateString()}</p>
                  </div>
                  <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-lg border ${
                    e.status === ErrandStatus.COMPLETED ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                    e.status === ErrandStatus.CANCELLED ? 'bg-red-50 text-red-600 border-red-100' :
                    'bg-amber-50 text-amber-600 border-amber-100'
                  }`}>
                    {e.status}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-black text-emerald-600">Ksh {e.acceptedPrice || e.budget}</p>
                  <ChevronRight size={14} className="text-slate-300 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
              
              {e.status === ErrandStatus.COMPLETED && user.role === UserRole.REQUESTER && (
                <div className="mt-4 pt-4 border-t border-slate-50 flex justify-end">
                  <button 
                    onClick={(event) => {
                      event.stopPropagation();
                      onRebook(e);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg shadow-indigo-100 active:scale-95 transition-all"
                  >
                    <Plus size={12} /> Re-book this Errand
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const ErrandDetailScreen: React.FC<any> = ({ 
  selectedErrand, setSelectedErrand, user, setUser, refresh, 
  onRunnerComplete, onCompleteErrand, loading,
  setShowPriceRequestModal, setShowAddPropertyModal, setShowComparisonModal, setShowAuthModal
}) => {
  if (!user) return null;
  
  const [comments, setComments] = useState(selectedErrand.runnerComments || '');
  const [photo, setPhoto] = useState<string | null>(selectedErrand.completionPhoto || null);
  const [showCamera, setShowCamera] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const [isReassigning, setIsReassigning] = useState(false);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [rescheduleDeadline, setRescheduleDeadline] = useState(selectedErrand.deadline || '');
  const [reassignReason, setReassignReason] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [overdueReasonInput, setOverdueReasonInput] = useState('');
  const [editForm, setEditForm] = useState({ description: selectedErrand.description || '', budget: selectedErrand.budget || 0, deadline: selectedErrand.deadline || '' });
  const [showProofs, setShowProofs] = useState(false);
  const [proofLabel, setProofLabel] = useState('');
  const [isUploadingProof, setIsUploadingProof] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState<'details' | 'map' | 'chat' | 'progress'>('details');
  
  const isOverdue = selectedErrand.deadlineTimestamp && 
                    Date.now() > selectedErrand.deadlineTimestamp && 
                    selectedErrand.status === ErrandStatus.ACCEPTED;
  const fileRef = useRef<HTMLInputElement>(null);
  const proofFileRef = useRef<HTMLInputElement>(null);
  const chatSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editMode) {
      setEditForm({
        description: selectedErrand.description || '',
        budget: selectedErrand.budget || 0,
        deadline: selectedErrand.deadline || ''
      });
    }
  }, [selectedErrand.description, selectedErrand.budget, selectedErrand.deadline, editMode]);

  const isRequester = user.id === selectedErrand.requesterId;
  const isRunner = user.id === selectedErrand.runnerId;

  useEffect(() => {
    if (isRequester && selectedErrand.priceRequests) {
      const pending = selectedErrand.priceRequests.find(r => r.status === 'pending');
      if (pending) setShowPriceRequestModal(pending);
    }
  }, [selectedErrand.priceRequests, isRequester]);

  const handleToggleMicroStep = async (idx: number, completed: boolean) => {
    try {
      await firebaseService.updateMicroStep(selectedErrand.id, idx, completed);
      refresh();
    } catch (e) { alert("Failed to update progress."); }
  };

  const handleSOS = () => {
    if (window.confirm("This will alert our support team immediately. Are you in danger?")) {
      firebaseService.sendSupportMessage(user.id, user.name, "SOS ALERT: I need immediate assistance with errand: " + selectedErrand.title, false);
      alert("Support has been notified. They will contact you shortly.");
    }
  };

  const handleUploadProof = async (file: File) => {
    if (!proofLabel.trim()) {
      alert("Please enter a label for this photo (e.g., 'Receipt', 'House Front').");
      return;
    }
    if ((selectedErrand.proofs?.length || 0) >= 10) {
      alert("Maximum 10 photos allowed.");
      return;
    }
    setIsUploadingProof(true);
    try {
      const url = await cloudinaryService.uploadFile(file, 'image', 'errand_proofs');
      await firebaseService.addErrandProof(selectedErrand.id, url, proofLabel);
      
      // OCR for Receipts
      if (proofLabel.toLowerCase().includes('receipt')) {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = async () => {
          const base64 = (reader.result as string).split(',')[1];
          const ocrResult = await geminiService.extractReceiptTotal(base64);
          if (ocrResult && ocrResult.total) {
            const serviceFee = selectedErrand.acceptedPrice || selectedErrand.budget;
            await firebaseService.updateErrandReceiptData(selectedErrand.id, ocrResult.total, serviceFee);
            refresh();
          }
        };
      }

      setProofLabel('');
      refresh();
      alert("Photo proof uploaded successfully.");
    } catch (e) {
      alert("Upload failed.");
    } finally {
      setIsUploadingProof(false);
    }
  };

  const handleUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const url = await cloudinaryService.uploadImage(file);
      setPhoto(url);
      if (selectedErrand.status === ErrandStatus.VERIFYING) {
        await firebaseService.submitForReview(selectedErrand.id, comments, url);
        refresh();
      }
    } catch (err) { alert("Upload failed."); } finally { setIsUploading(false); setShowCamera(false); }
  };

  const [showBidModal, setShowBidModal] = useState(false);

  const handleAcceptBudget = () => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    setShowBidModal(true);
  };

  const handleBidSubmit = async (amount: number) => {
    if (!selectedErrand || !user) return;

    // Check suspension
    if (user.isSuspended) {
      alert(`Your account is suspended: ${user.suspensionReason}`);
      return;
    }

    try {
      console.log("Processing bid:", { amount, budget: selectedErrand.budget, errandId: selectedErrand.id, userId: user.id });
      // For House Hunting, budget is 0, so amount > budget is always true, triggering placeBid (approval flow)
      if (selectedErrand.category !== ErrandCategory.HOUSE_HUNTING && amount <= selectedErrand.budget) {
        console.log("Accepting bid automatically");
        await firebaseService.acceptBid(selectedErrand.id, user.id, amount);
        triggerHaptic();
        alert("Task assigned to you automatically!");
        refresh();
      } else {
        console.log("Placing bid for approval");
        await firebaseService.placeBid(selectedErrand.id, user.id, user.name, amount, 'Ready now');
        alert("Your proposal has been submitted for approval.");
        refresh();
      }
      setShowBidModal(false);
    } catch (e) { 
      console.error("Action failed:", e);
      alert("Action failed: " + (e as any).message); 
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!user) return;
    try {
      await firebaseService.sendMessage(selectedErrand.id, user.id, user.name, text);
    } catch (e) { console.error("Failed to send message:", e); }
  };

  const handleReassign = async () => {
    if (!reassignReason) { alert("Please select a reason for reassignment."); return; }
    
    if (selectedErrand.status === ErrandStatus.VERIFYING) {
      try {
        await firebaseService.requestReassignment(selectedErrand.id, reassignReason);
        setIsReassigning(false);
        alert("Reassignment request sent to the runner for approval.");
      } catch (e) { alert("Failed to request reassignment."); }
    } else {
      try {
        await firebaseService.reassignErrand(selectedErrand.id, reassignReason);
        setIsReassigning(false);
        alert("Runner reassigned successfully.");
      } catch (e) { alert("Failed to reassign runner."); }
    }
  };

  const handleSaveChanges = async () => {
    try {
      await firebaseService.updateErrand(selectedErrand.id, editForm);
      setEditMode(false);
      alert("Changes saved.");
    } catch (e) { alert("Failed to save changes."); }
  };

  const handleReschedule = async () => {
    if (!rescheduleDeadline) { alert("Please select a new deadline."); return; }
    try {
      await firebaseService.updateErrand(selectedErrand.id, { deadline: rescheduleDeadline });
      setIsRescheduling(false);
      alert("Errand rescheduled successfully.");
    } catch (e) { alert("Failed to reschedule errand."); }
  };

  const handleCancelErrand = async () => {
    if (!window.confirm("Are you sure you want to cancel this errand? All bidders will be notified.")) return;
    try {
      await firebaseService.cancelErrand(selectedErrand.id);
      setSelectedErrand(null);
      alert("Errand cancelled successfully.");
    } catch (e: any) { alert(e.message || "Failed to cancel errand."); }
  };

  const scrollToChat = () => {
    chatSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const REASSIGN_REASONS = ["Wait time too long", "Budget bid so high", "Communication issues", "Runner changed their mind", "Other"];

  return (
    <div className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm flex flex-col items-center justify-end md:justify-center p-0 md:p-6">
      {showCamera && <CameraCapture onCapture={handleUpload} onClose={() => setShowCamera(false)} />}
      {fullScreenImage && <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-6" onClick={() => setFullScreenImage(null)}><img src={fullScreenImage} className="max-w-full max-h-full object-contain rounded-xl" alt="Proof" /></div>}
      <div className="w-full max-w-2xl bg-white rounded-t-[3rem] md:rounded-[3rem] shadow-2xl overflow-y-auto max-h-[95vh] animate-in slide-in-from-bottom-6">
        <header className="px-6 py-5 border-b border-slate-50 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            <button onClick={() => setSelectedErrand(null)} className="p-2.5 bg-slate-100 rounded-xl text-slate-500"><ChevronLeft size={20} /></button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <h3 className="font-black text-slate-900 text-base truncate leading-tight">{selectedErrand.title}</h3>
                {selectedErrand.isFundsLocked && (
                  <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded-md border border-emerald-100 text-[7px] font-black uppercase tracking-tighter">
                    <ShieldCheck size={8} />
                    Secured
                  </div>
                )}
              </div>
              <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-lg border ${selectedErrand.status === ErrandStatus.PENDING ? 'bg-amber-50 text-amber-600 border-amber-100' : selectedErrand.status === ErrandStatus.ACCEPTED ? 'bg-blue-50 text-blue-600 border-blue-100' : selectedErrand.status === ErrandStatus.COMPLETED ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-black border-slate-200'}`}>{selectedErrand.status}</span>
            </div>
          </div>
          <div className="text-right shrink-0"><p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Budget</p><p className="text-base font-black text-emerald-600">Ksh {selectedErrand.budget}</p></div>
        </header>
        
        <div className="px-6 pt-4 flex items-center gap-2 overflow-x-auto no-scrollbar border-b border-slate-50 pb-4">
            {[
              { id: 'details', icon: FileText, label: 'Details' },
              { id: 'map', icon: MapIcon, label: 'Map' },
              { id: 'chat', icon: MessageCircle, label: 'Chat' },
              { id: 'progress', icon: Activity, label: 'Progress' }
            ].map(tab => (
              <button 
                key={tab.id}
                onClick={() => setActiveDetailTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeDetailTab === tab.id ? 'bg-black text-white shadow-lg' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
              >
                <tab.icon size={14} /> {tab.label}
              </button>
            ))}
        </div>
        <div className="p-6 space-y-6">
          {activeDetailTab === 'details' && (
            <>
              {(selectedErrand.status === ErrandStatus.ACCEPTED || selectedErrand.status === ErrandStatus.VERIFYING) && (
            <div className="flex gap-2">
              <button onClick={handleSOS} className="flex-1 py-3 bg-red-50 text-red-600 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 border border-red-100 hover:bg-red-100 transition-all">
                <AlertTriangle size={14} /> SOS / Emergency
              </button>
              <button onClick={() => window.location.href = 'tel:+254700000000'} className="flex-1 py-3 bg-indigo-50 text-indigo-600 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 border border-indigo-100 hover:bg-indigo-100 transition-all">
                <Phone size={14} /> Call Support
              </button>
            </div>
          )}

          <ErrandStatusTimeline status={selectedErrand.status} category={selectedErrand.category} />

          {/* Financial Breakdown (Shopping Float) */}
          {(selectedErrand.category === ErrandCategory.SHOPPING || selectedErrand.category === ErrandCategory.TOWN_SERVICE) && (
            <section className="bg-amber-50 p-6 rounded-[2rem] border border-amber-100 space-y-4 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Financial Summary</h4>
                <div className="px-2 py-0.5 bg-amber-500 text-white rounded-full text-[8px] font-black uppercase">Escrow Active</div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-white rounded-2xl border border-amber-100">
                  <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Max Shopping Budget</p>
                  <p className="text-lg font-black text-slate-900">Ksh {selectedErrand.maxShoppingBudget || 0}</p>
                </div>
                <div className="p-4 bg-white rounded-2xl border border-amber-100">
                  <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Actual Spent</p>
                  <p className="text-lg font-black text-emerald-600">Ksh {selectedErrand.actualShoppingTotal || 0}</p>
                </div>
              </div>

              {/* Price Requests */}
              {selectedErrand.priceRequests && selectedErrand.priceRequests.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[8px] font-black text-amber-600 uppercase tracking-widest ml-1">Price Adjustments</p>
                  {selectedErrand.priceRequests.map((req: any) => (
                    <div key={req.id} className="bg-white p-3 rounded-xl border border-amber-100 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-black text-slate-900">{req.itemName}</p>
                        <p className="text-[8px] font-bold text-slate-400 uppercase">Ksh {req.originalPrice} → Ksh {req.newPrice}</p>
                      </div>
                      <div className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase ${req.status === 'approved' ? 'bg-emerald-50 text-emerald-600' : req.status === 'rejected' ? 'bg-red-50 text-red-600' : 'bg-amber-100 text-amber-600 animate-pulse'}`}>
                        {req.status}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {isRunner && selectedErrand.status === ErrandStatus.ACCEPTED && (
                <button 
                  onClick={() => {
                    const itemName = window.prompt("Item Name:");
                    const originalPrice = parseInt(window.prompt("Original Price (Ksh):") || '0');
                    const newPrice = parseInt(window.prompt("New Price (Ksh):") || '0');
                    if (itemName && originalPrice && newPrice) {
                      firebaseService.sendPriceRequest(selectedErrand.id, itemName, originalPrice, newPrice);
                      alert("Price request sent!");
                      refresh();
                    }
                  }}
                  className="w-full py-3 bg-amber-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-amber-100 flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                  <DollarSign size={14} /> Request Price Adjustment
                </button>
              )}
            </section>
          )}

          {/* House Hunting Property Listings */}
          {selectedErrand.category === ErrandCategory.HOUSE_HUNTING && (
            <section className="bg-indigo-50 p-6 rounded-[2rem] border border-indigo-100 space-y-4 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Saka Keja Report</h4>
                {selectedErrand.propertyListings && selectedErrand.propertyListings.length >= 2 && isRequester && (
                  <button 
                    onClick={() => setShowComparisonModal(true)}
                    className="px-3 py-1 bg-indigo-600 text-white rounded-full text-[8px] font-black uppercase shadow-lg shadow-indigo-100 active:scale-95 transition-all"
                  >
                    Compare Houses
                  </button>
                )}
              </div>

              {selectedErrand.propertyListings && selectedErrand.propertyListings.length > 0 ? (
                <div className="grid grid-cols-1 gap-4">
                  {selectedErrand.propertyListings.map((listing: any) => (
                    <div key={listing.id} className="bg-white rounded-2xl overflow-hidden border border-indigo-100 shadow-sm group">
                      <div className="aspect-video relative">
                        <img src={listing.imageUrl} className="w-full h-full object-cover" />
                        <div className="absolute top-3 right-3 px-3 py-1 bg-black/60 backdrop-blur-md text-white rounded-full text-[10px] font-black">
                          Ksh {listing.price}
                        </div>
                        <div className="absolute bottom-3 left-3 flex gap-1">
                          {listing.amenities.water && <div className="p-1.5 bg-white/90 rounded-lg text-blue-600"><Droplets size={12} /></div>}
                          {listing.amenities.wifi && <div className="p-1.5 bg-white/90 rounded-lg text-indigo-600"><Wifi size={12} /></div>}
                          {listing.amenities.security && <div className="p-1.5 bg-white/90 rounded-lg text-emerald-600"><Shield size={12} /></div>}
                          {listing.amenities.parking && <div className="p-1.5 bg-white/90 rounded-lg text-slate-600"><Car size={12} /></div>}
                        </div>
                      </div>
                      <div className="p-4 space-y-2">
                        <div className="flex justify-between items-start">
                          <h5 className="font-black text-slate-900 text-sm">{listing.title}</h5>
                          <div className="flex items-center gap-1">
                            <Star size={10} className="text-amber-400 fill-amber-400" />
                            <span className="text-[10px] font-black">{listing.agentRating}/5</span>
                          </div>
                        </div>
                        <p className="text-[10px] font-medium text-slate-500 leading-relaxed line-clamp-2 italic">"{listing.description}"</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-10 text-center border-2 border-dashed border-indigo-100 rounded-2xl bg-white/50">
                  <Home size={24} className="mx-auto text-indigo-200 mb-2" />
                  <p className="text-[10px] font-bold text-indigo-300 uppercase">No houses visited yet</p>
                </div>
              )}

              {isRunner && selectedErrand.status === ErrandStatus.ACCEPTED && (
                <button 
                  onClick={() => setShowAddPropertyModal(true)}
                  className="w-full py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                  <Plus size={14} /> Add Property Listing
                </button>
              )}
            </section>
          )}

          {selectedErrand.runnerId && selectedErrand.runnerProfileSnapshot && (
            <section className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm space-y-4 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-center justify-between">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Assigned Agent</p>
                {selectedErrand.runnerProfileSnapshot.isVerified && (
                  <div className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full text-[8px] font-black uppercase border border-emerald-100">
                    <ShieldCheck size={10} /> Identity Verified
                  </div>
                )}
              </div>
              <div className="flex items-center gap-4">
                <img src={selectedErrand.runnerProfileSnapshot.avatar || `https://ui-avatars.com/api/?name=Runner&background=random`} className="w-14 h-14 rounded-2xl object-cover border-2 border-slate-50 shadow-sm" alt="Runner" />
                <div className="flex-1">
                  <h4 className="font-black text-slate-900 text-sm">Agent CV</h4>
                  <div className="flex items-center gap-3 mt-1">
                    <div className="flex items-center gap-1">
                      <Star size={10} className="text-amber-400 fill-amber-400" />
                      <span className="text-[10px] font-black text-slate-700">{selectedErrand.runnerProfileSnapshot.rating.toFixed(1)}</span>
                    </div>
                    <div className="w-1 h-1 rounded-full bg-slate-200" />
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-tight">{selectedErrand.runnerProfileSnapshot.errandsCompleted} Errands Done</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={async () => {
                      if (user) {
                        await firebaseService.toggleFavoriteRunner(user.id, selectedErrand.runnerId!);
                        const updatedUser = await firebaseService.getCurrentUser();
                        if (updatedUser) setUser(updatedUser);
                      }
                    }}
                    className={`p-2.5 rounded-xl transition-all ${user?.favoriteRunnerIds?.includes(selectedErrand.runnerId!) ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-400'}`}
                  >
                    <Heart size={18} fill={user?.favoriteRunnerIds?.includes(selectedErrand.runnerId!) ? 'currentColor' : 'none'} />
                  </button>
                  <button onClick={scrollToChat} className="p-3 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-100 hover:scale-105 transition-all">
                    <MessageCircle size={18} />
                  </button>
                </div>
              </div>
            </section>
          )}
          </>
          )}


          {activeDetailTab === 'details' && (
            <>
          {isReassigning ? (
            <section className="space-y-4 animate-in fade-in zoom-in-95"><h4 className="text-sm font-black uppercase tracking-widest text-slate-900">Why reassign?</h4><div className="space-y-2">{REASSIGN_REASONS.map((r, idx) => (<button key={idx} onClick={() => setReassignReason(r)} className={`w-full text-left p-4 rounded-2xl border-2 font-bold text-xs transition-all ${reassignReason === r ? 'border-black bg-slate-50' : 'border-slate-100'}`}>{r}</button>))}</div><div className="flex gap-3"><button onClick={() => setIsReassigning(false)} className="flex-1 py-4 border border-slate-200 rounded-2xl font-black text-[10px] uppercase tracking-widest">Cancel</button><button onClick={handleReassign} className="flex-1 py-4 bg-black text-white rounded-2xl font-black text-[10px] uppercase tracking-widest">Confirm Reassign</button></div></section>
          ) : isRescheduling ? (
            <section className="space-y-5 animate-in fade-in slide-in-from-bottom-2">
              <h4 className="text-sm font-black uppercase tracking-widest text-slate-900">Reschedule Errand</h4>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">New Deadline</label>
                  <input 
                    type="datetime-local" 
                    value={rescheduleDeadline} 
                    onChange={e => setRescheduleDeadline(e.target.value)} 
                    className="w-full p-4 brand-input rounded-xl font-bold text-xs outline-none" 
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setIsRescheduling(false)} className="flex-1 py-4 border border-slate-200 rounded-2xl font-black text-[10px] uppercase tracking-widest">Cancel</button>
                <button onClick={handleReschedule} className="flex-1 py-4 bg-black text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2">
                  <Clock size={14} /> Confirm Reschedule
                </button>
              </div>
            </section>
          ) : editMode ? (
            <section className="space-y-5 animate-in fade-in slide-in-from-bottom-2"><h4 className="text-sm font-black uppercase tracking-widest text-slate-900">Edit Errand</h4><div className="space-y-4"><div className="space-y-1"><label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Description</label><textarea value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value})} className="w-full p-4 brand-input rounded-xl font-bold text-xs outline-none h-24 resize-none" /></div><div className="grid grid-cols-2 gap-3"><div className="space-y-1"><label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Budget (Ksh)</label><input type="number" value={editForm.budget} onChange={e => setEditForm({...editForm, budget: parseInt(e.target.value)})} className="w-full p-4 brand-input rounded-xl font-bold text-xs outline-none" /></div><div className="space-y-1"><label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Deadline</label><input type="datetime-local" value={editForm.deadline} onChange={e => setEditForm({...editForm, deadline: e.target.value})} className="w-full p-4 brand-input rounded-xl font-bold text-xs outline-none" /></div></div></div><div className="flex gap-3"><button onClick={() => setEditMode(false)} className="flex-1 py-4 border border-slate-200 rounded-2xl font-black text-[10px] uppercase tracking-widest">Cancel</button><button onClick={handleSaveChanges} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2"><Save size={14} /> Save Changes</button></div></section>
          ) : (
            <>
              <section className="bg-slate-50 rounded-[1.5rem] p-5 space-y-3">
                <div className="flex justify-between items-start"><div><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Requester</p><p className="text-xs font-black text-slate-900">{selectedErrand.requesterName}</p></div><div className="text-right"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Distance</p><p className="text-xs font-black text-slate-900">{selectedErrand.distanceKm || '--'} KM</p></div></div>
                
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Task Details</p>
                    {isRequester && selectedErrand.status === ErrandStatus.PENDING && (
                      <button onClick={() => setEditMode(true)} className="flex items-center gap-1 text-[9px] font-black text-indigo-600 uppercase">
                        <Edit2 size={10} /> Edit
                      </button>
                    )}
                  </div>
                  <div className="bg-white/80 p-3 rounded-xl border border-white shadow-sm space-y-3">
                    <p className="text-xs font-medium text-slate-600 leading-relaxed">{selectedErrand.description || "No description provided."}</p>
                    
                    {selectedErrand.voiceNoteUrl && (
                      <div className="p-2 bg-indigo-50 rounded-lg flex items-center gap-3">
                        <Volume2 size={14} className="text-indigo-600" />
                        <audio src={selectedErrand.voiceNoteUrl} controls className="h-6 flex-1" />
                      </div>
                    )}

                    {selectedErrand.checklist && selectedErrand.checklist.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Visual Checklist</p>
                        <div className="grid grid-cols-1 gap-1">
                          {selectedErrand.checklist.map((item: any, idx: number) => (
                            <div key={idx} className="flex items-center gap-2 text-[10px] font-bold text-slate-600">
                              {item.checked ? <CheckCircle2 size={12} className="text-emerald-500" /> : <div className="w-3 h-3 rounded-full border border-slate-200" />}
                              <span className={item.checked ? 'line-through opacity-50' : ''}>{item.item}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedErrand.category === ErrandCategory.MAMA_FUA && (
                      <div className="space-y-2">
                        <div className="p-2 bg-slate-50 rounded-lg flex items-center justify-between">
                          <span className="text-[10px] font-black text-slate-400 uppercase">Quantity</span>
                          <span className="text-xs font-black text-black">{selectedErrand.laundryBaskets} Baskets</span>
                        </div>
                        {selectedErrand.isInHouse && (
                          <div className="p-2 bg-indigo-50 rounded-lg flex items-center gap-2 text-indigo-600">
                            <Home size={12} />
                            <span className="text-[10px] font-black uppercase tracking-widest">In-House Service</span>
                          </div>
                        )}
                      </div>
                    )}

                    {selectedErrand.category === ErrandCategory.HOUSE_HUNTING && (
                      <div className="p-2 bg-slate-50 rounded-lg space-y-1">
                        <div className="flex justify-between">
                          <span className="text-[10px] font-black text-slate-400 uppercase">Type</span>
                          <span className="text-xs font-black text-black">{selectedErrand.houseType}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[10px] font-black text-slate-400 uppercase">Budget</span>
                          <span className="text-xs font-black text-black">Ksh {selectedErrand.budget}</span>
                        </div>
                      </div>
                    )}

                    {selectedErrand.deadlineTimestamp && (
                      <div className="p-2 bg-slate-50 rounded-lg flex items-center justify-between">
                        <span className="text-[10px] font-black text-slate-400 uppercase">Deadline</span>
                        <span className={`text-xs font-black ${isOverdue ? 'text-red-500 animate-pulse' : 'text-black'}`}>
                          {new Date(selectedErrand.deadlineTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {isOverdue && " (OVERDUE)"}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {isOverdue && isRunner && !selectedErrand.overdueReason && (
                  <div className="p-4 bg-red-50 rounded-2xl border border-red-100 space-y-3">
                    <div className="flex items-center gap-2 text-red-600">
                      <AlertCircle size={16} />
                      <p className="text-[10px] font-black uppercase tracking-widest">Overdue – Reason Required</p>
                    </div>
                    <p className="text-[10px] font-bold text-red-500">You have 15 minutes to submit a reason for the delay.</p>
                    <textarea 
                      value={overdueReasonInput} 
                      onChange={e => setOverdueReasonInput(e.target.value)}
                      placeholder="Why is the task delayed?"
                      className="w-full p-3 bg-white border border-red-100 rounded-xl text-xs font-bold outline-none h-20 resize-none"
                    />
                    <button 
                      onClick={() => firebaseService.submitOverdueReason(selectedErrand.id, overdueReasonInput)}
                      className="w-full py-3 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-red-100"
                    >
                      Submit Reason
                    </button>
                  </div>
                )}

                {selectedErrand.overdueReasonStatus && selectedErrand.overdueReasonStatus !== 'pending' && (
                  <div className={`p-4 rounded-2xl border flex items-center justify-between ${selectedErrand.overdueReasonStatus === 'approved' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-red-50 border-red-100 text-red-600'}`}>
                    <div className="flex items-center gap-2">
                      {selectedErrand.overdueReasonStatus === 'approved' ? <CheckCircle size={16} /> : <X size={16} />}
                      <p className="text-[10px] font-black uppercase tracking-widest">Delay Reason {selectedErrand.overdueReasonStatus}</p>
                    </div>
                    {selectedErrand.overdueReasonAutoApproved && (
                      <span className="text-[8px] font-black bg-emerald-600 text-white px-2 py-0.5 rounded-lg uppercase tracking-widest">Auto-Approved</span>
                    )}
                  </div>
                )}

                {selectedErrand.overdueReasonStatus && selectedErrand.overdueReasonStatus !== 'pending' && (
                  <div className={`p-3 rounded-xl border flex items-center justify-between ${selectedErrand.overdueReasonStatus === 'approved' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-red-50 border-red-100 text-red-600'}`}>
                    <div className="flex items-center gap-2">
                      {selectedErrand.overdueReasonStatus === 'approved' ? <CheckCircle size={14} /> : <X size={14} />}
                      <p className="text-[10px] font-black uppercase tracking-widest">Delay Reason {selectedErrand.overdueReasonStatus}</p>
                    </div>
                    {selectedErrand.overdueReasonAutoApproved && (
                      <span className="text-[8px] font-black bg-emerald-600 text-white px-1.5 py-0.5 rounded uppercase tracking-tighter">System Auto-Approved</span>
                    )}
                  </div>
                )}

                {selectedErrand.status === ErrandStatus.VERIFYING && selectedErrand.submittedForReviewAt && (
                  <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-2">
                    <div className="flex justify-between items-center">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Review Period</p>
                      <p className="text-xs font-black">
                        {Math.floor((Date.now() - selectedErrand.submittedForReviewAt) / (1000 * 60 * 60))}h elapsed
                      </p>
                    </div>
                    {(() => {
                      const delayMs = Date.now() - selectedErrand.submittedForReviewAt;
                      const delayHours = Math.floor(delayMs / (1000 * 60 * 60));
                      if (delayHours > 12) {
                        const penalty = (delayHours - 12) * 10;
                        return (
                          <div className="pt-2 border-t border-white/10 flex justify-between items-center animate-pulse">
                            <p className="text-[9px] font-black uppercase tracking-widest text-red-400">Approval Delay Penalty</p>
                            <p className="text-xs font-black text-red-400">KES {penalty} accumulated</p>
                          </div>
                        );
                      }
                      return (
                        <p className="text-[9px] font-bold text-slate-500 italic">Penalty starts after 12 hours of inactivity.</p>
                      );
                    })()}
                  </div>
                )}
              </section>
              {selectedErrand.status === ErrandStatus.PENDING && (isRequester ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => setEditMode(true)} 
                      className="py-4 border-2 border-dashed border-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest hover:bg-indigo-50 transition-all"
                    >
                      <Edit2 size={14} /> Edit Details
                    </button>
                    <button 
                      onClick={() => setIsRescheduling(true)} 
                      className="py-4 border-2 border-dashed border-slate-200 text-slate-600 rounded-2xl flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all"
                    >
                      <Clock size={14} /> Reschedule
                    </button>
                  </div>
                  
                  <button 
                    onClick={handleCancelErrand}
                    className="w-full py-4 border-2 border-dashed border-red-100 text-red-500 rounded-2xl flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest hover:bg-red-50 transition-all"
                  >
                    <Trash2 size={14} /> Cancel Errand
                  </button>
                  
                  <div className="space-y-3">
                    <p className="text-[10px] font-black uppercase text-slate-400 px-1 tracking-widest">Proposals Received</p>
                    {selectedErrand.bids.length === 0 ? (
                      <div className="p-10 border-2 border-dashed border-slate-100 rounded-[1.5rem] text-center text-slate-300 font-bold">Waiting for runners...</div>
                    ) : (
                      <div className="grid grid-cols-1 gap-3">
                        {selectedErrand.bids.map((b: any, i: number) => (
                          <div key={i} className="bg-white border border-slate-100 p-4 rounded-2xl flex items-center justify-between shadow-sm">
                            <div className="flex items-center gap-3">
                              <img src={`https://ui-avatars.com/api/?name=${b.runnerName}&background=000&color=fff`} className="w-10 h-10 rounded-xl" />
                              <div>
                                <p className="text-sm font-black text-slate-900">{b.runnerName}</p>
                                <p className="text-[9px] font-bold text-black uppercase tracking-widest">Ready: {b.eta || 'Now'}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-black text-slate-900 mb-1.5">Ksh {b.price}</p>
                              <button 
                                onClick={() => {
                                  firebaseService.acceptBid(selectedErrand.id, b.runnerId, b.price);
                                  triggerHaptic();
                                }} 
                                className="px-5 py-2 bg-black text-white text-[9px] font-black uppercase rounded-lg"
                              >
                                Assign
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <button onClick={handleAcceptBudget} className="w-full py-5 bg-black text-white rounded-[1.5rem] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all text-sm">
                    Accept Task (Ksh {selectedErrand.budget})
                  </button>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <p className="text-[9px] font-black text-slate-400 uppercase text-center">
                      Accepting at the current budget assigns the task to you instantly!
                    </p>
                  </div>
                </div>
              ))}
            </>
          )}
            </>
          )}

          {activeDetailTab === 'map' && selectedErrand.pickupCoordinates && selectedErrand.dropoffCoordinates && (
            <div className="h-[50vh] w-full rounded-[2rem] overflow-hidden border border-slate-200 shadow-sm animate-in zoom-in-95">
              <Map 
                defaultCenter={{ lat: selectedErrand.pickupCoordinates.lat, lng: selectedErrand.pickupCoordinates.lng }} 
                defaultZoom={13} 
                gestureHandling={'greedy'}
                disableDefaultUI={false}
                mapId="errand_detail_map_tab"
              >
                <AdvancedMarker position={{ lat: selectedErrand.pickupCoordinates.lat, lng: selectedErrand.pickupCoordinates.lng }}>
                  <Pin background={'#000'} glyphColor={'#fff'} borderColor={'#000'} />
                </AdvancedMarker>
                <AdvancedMarker position={{ lat: selectedErrand.dropoffCoordinates.lat, lng: selectedErrand.dropoffCoordinates.lng }}>
                  <Pin background={'#4f46e5'} glyphColor={'#fff'} borderColor={'#4f46e5'} />
                </AdvancedMarker>
              </Map>
            </div>
          )}

          {activeDetailTab === 'chat' && (selectedErrand.status === ErrandStatus.ACCEPTED || selectedErrand.status === ErrandStatus.VERIFYING) && (isRequester || isRunner) && (
            <div ref={chatSectionRef}>
              <ChatSection 
                errandId={selectedErrand.id} 
                messages={selectedErrand.chat || []} 
                user={user} 
                onSendMessage={handleSendMessage} 
              />
            </div>
          )}
          {activeDetailTab === 'details' && (
            <>
              {isRunner && selectedErrand.reassignmentRequested && (
                <div className="p-5 bg-amber-50 border border-amber-100 rounded-[2rem] space-y-4 animate-in zoom-in-95">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-100 text-amber-600 rounded-lg"><ShieldAlert size={18} /></div>
                    <div>
                      <p className="text-xs font-black text-slate-900 uppercase tracking-tight">Reassignment Requested</p>
                      <p className="text-[10px] text-slate-500 font-bold">Reason: {selectedErrand.reassignReason}</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => firebaseService.rejectReassignment(selectedErrand.id)}
                      className="flex-1 py-3 border border-amber-200 text-amber-600 rounded-xl font-black text-[9px] uppercase tracking-widest"
                    >
                      Reject
                    </button>
                    <button 
                      onClick={() => firebaseService.approveReassignment(selectedErrand.id)}
                      className="flex-1 py-3 bg-amber-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest"
                    >
                      Approve & Release
                    </button>
                  </div>
                </div>
              )}
              {isRequester && selectedErrand.reassignmentRequested && (
                <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl text-center animate-pulse">
                  <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Waiting for runner to approve reassignment</p>
                </div>
              )}
              {(selectedErrand.status === ErrandStatus.ACCEPTED || selectedErrand.status === ErrandStatus.VERIFYING) && isRequester && (
                <div className="space-y-3">
                  <button 
                    onClick={scrollToChat}
                    className="w-full py-4 bg-black text-white rounded-2xl flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest shadow-lg active:scale-95 transition-all"
                  >
                    <MessageSquare size={16} /> Contact Runner
                  </button>
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => setIsRescheduling(true)} className="py-4 border border-slate-200 text-slate-600 rounded-2xl flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all">
                      <Clock size={16} /> Reschedule
                    </button>
                    <button 
                      disabled={selectedErrand.reassignmentRequested}
                      onClick={() => setIsReassigning(true)} 
                      className="py-4 border border-red-100 text-red-500 rounded-2xl flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest hover:bg-red-50 transition-all disabled:opacity-50"
                    >
                      <UserMinus size={16} /> {selectedErrand.reassignmentRequested ? 'Requested' : 'Reassign'}
                    </button>
                  </div>
                  <p className="text-[9px] text-slate-400 text-center uppercase font-bold px-4">You can reschedule or reassign the runner if needed.</p>
                </div>
              )}
            </>
          )}

          {activeDetailTab === 'progress' && (
            <>
              {/* Real-Time Progress (MicroSteps) */}
              {selectedErrand.microSteps && selectedErrand.microSteps.length > 0 && (
                <section className="bg-slate-900 p-6 rounded-[2rem] shadow-2xl space-y-5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Real-Time Progress</h4>
                    <div className="px-2 py-0.5 bg-indigo-500/20 text-indigo-400 rounded-full text-[8px] font-black uppercase">
                      {selectedErrand.microSteps.filter((s: any) => s.completed).length} / {selectedErrand.microSteps.length} Steps
                    </div>
                  </div>
                  <div className="space-y-4">
                    {selectedErrand.microSteps.map((step: any, idx: number) => (
                      <div key={idx} className="flex items-start gap-4 group">
                        <div className="flex flex-col items-center">
                          <button 
                            disabled={!isRunner || selectedErrand.status !== ErrandStatus.ACCEPTED}
                            onClick={() => handleToggleMicroStep(idx, !step.completed)}
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${step.completed ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-slate-700 bg-slate-800'}`}
                          >
                            {step.completed && <Check size={12} strokeWidth={4} />}
                          </button>
                          {idx < selectedErrand.microSteps.length - 1 && (
                            <div className={`w-0.5 h-8 my-1 transition-all ${step.completed ? 'bg-indigo-500' : 'bg-slate-800'}`} />
                          )}
                        </div>
                        <div className="flex-1 pt-0.5">
                          <p className={`text-xs font-black transition-all ${step.completed ? 'text-white' : 'text-slate-500'}`}>{step.label}</p>
                          {step.completed && step.timestamp && (
                            <p className="text-[8px] font-bold text-indigo-400 uppercase tracking-widest mt-0.5">
                              {new Date(step.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Execution Board (Runner) */}
              {(selectedErrand.status === ErrandStatus.ACCEPTED || selectedErrand.status === ErrandStatus.VERIFYING) && isRunner && (
                <div className="bg-black rounded-[2rem] p-6 text-white space-y-5 shadow-2xl">
                  <div className="flex items-center justify-between"><h4 className="text-lg font-black uppercase tracking-widest">Execution Board</h4></div>
                  <div className="space-y-1.5"><label className="text-[9px] font-black uppercase tracking-widest text-slate-300 ml-1">Comments</label><textarea value={comments} onChange={e => setComments(e.target.value)} placeholder="Work progress update..." className="w-full p-4 bg-white/10 rounded-2xl border-none text-white placeholder:text-slate-500 font-bold outline-none h-24 resize-none text-xs" /></div>
                  <div className="space-y-3">
                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-300">Proof Image</label>
                    <div className="grid grid-cols-2 gap-3"><button onClick={() => setShowCamera(true)} className="py-3 bg-white/10 rounded-xl flex items-center justify-center gap-2 font-black text-[9px] uppercase"><Camera size={16} /> Camera</button><button onClick={() => fileRef.current?.click()} className="py-3 bg-white/10 rounded-xl flex items-center justify-center gap-2 font-black text-[9px] uppercase"><ImageIcon size={16} /> Gallery</button><input type="file" ref={fileRef} className="hidden" accept="image/*" onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])} /></div>
                    {(photo || isUploading) && (<div className="relative rounded-2xl overflow-hidden border-2 border-white/20 h-40 bg-black/10 flex items-center justify-center">{isUploading ? <LoadingSpinner color="white" /> : <img src={photo!} className="w-full h-full object-cover" alt="Proof" onClick={() => setFullScreenImage(photo)} />}</div>)}
                  </div>
                  <button disabled={loading || isUploading} onClick={() => onRunnerComplete(selectedErrand.id, comments, photo || undefined)} className="w-full py-5 bg-white text-black rounded-[1.5rem] font-black uppercase text-xs tracking-widest disabled:opacity-50">{loading ? <LoadingSpinner color="black" /> : 'Complete & Submit'}</button>
                </div>
              )}

              {/* Verification (Requester) */}
              {selectedErrand.status === ErrandStatus.VERIFYING && isRequester && (
                <div className="bg-emerald-600 rounded-[2rem] p-6 text-white space-y-5"><h4 className="text-lg font-black uppercase tracking-widest text-center">Verification</h4>{selectedErrand.completionPhoto && (<img src={selectedErrand.completionPhoto} className="w-full h-48 object-cover rounded-2xl border-4 border-white/20 shadow-xl" alt="Proof" onClick={() => setFullScreenImage(selectedErrand.completionPhoto)} />)}<div className="bg-white/10 p-4 rounded-xl text-xs font-semibold italic border border-white/5">"{selectedErrand.runnerComments || 'No comments.'}"</div><button disabled={loading} onClick={() => onCompleteErrand(selectedErrand.id)} className="w-full py-5 bg-white text-emerald-600 rounded-[1.5rem] font-black uppercase text-xs tracking-widest shadow-xl">Approve & Release Funds</button></div>
              )}

              {/* Report View (Proofs) */}
              {(selectedErrand.status === ErrandStatus.ACCEPTED || selectedErrand.status === ErrandStatus.VERIFYING || selectedErrand.status === ErrandStatus.COMPLETED) && (
                <section className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Report View (Media Timeline)</h4>
                      <p className="text-[8px] font-bold text-slate-300 uppercase">Task evidence & receipts</p>
                    </div>
                    <button 
                      onClick={() => setShowProofs(!showProofs)}
                      className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[8px] font-black uppercase border border-indigo-100"
                    >
                      {showProofs ? 'Hide Report' : `View Report (${selectedErrand.proofs?.length || 0})`}
                    </button>
                  </div>

                  {showProofs && (
                    <div className="space-y-4 animate-in fade-in zoom-in-95">
                      {selectedErrand.receiptTotal && (
                        <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 space-y-2">
                          <div className="flex justify-between items-center">
                            <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Digital Receipt Summary</p>
                            <Tag size={12} className="text-emerald-400" />
                          </div>
                          <div className="flex justify-between items-end">
                            <div>
                              <p className="text-[8px] font-bold text-emerald-400 uppercase">Total Spent</p>
                              <p className="text-lg font-black text-emerald-700">Ksh {selectedErrand.receiptTotal}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[8px] font-bold text-emerald-400 uppercase">Service Fee</p>
                              <p className="text-sm font-black text-emerald-600">Ksh {selectedErrand.serviceFee || 0}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {selectedErrand.proofs && selectedErrand.proofs.length > 0 ? (
                        <div className="grid grid-cols-2 gap-3">
                          {selectedErrand.proofs.map((proof: any, idx: number) => (
                            <div key={idx} className="space-y-1.5 group cursor-pointer" onClick={() => setFullScreenImage(proof.url)}>
                              <div className="aspect-square rounded-2xl overflow-hidden border border-slate-100 shadow-sm relative">
                                <img src={proof.url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt={proof.label} />
                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                                  <p className="text-[8px] font-black text-white uppercase truncate">{proof.label}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-10 text-center border-2 border-dashed border-slate-50 rounded-2xl">
                          <ImageIcon size={24} className="mx-auto text-slate-200 mb-2" />
                          <p className="text-[10px] font-bold text-slate-300 uppercase">No proofs uploaded yet</p>
                        </div>
                      )}

                      {isRunner && selectedErrand.status === ErrandStatus.ACCEPTED && (
                        <div className="pt-4 border-t border-slate-50 space-y-3">
                          <div className="space-y-1.5">
                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Photo Label (e.g. Receipt)</label>
                            <input 
                              type="text" 
                              value={proofLabel} 
                              onChange={e => setProofLabel(e.target.value)}
                              placeholder="What is this photo?"
                              className="w-full p-3 bg-slate-50 border-none rounded-xl text-xs font-bold outline-none"
                            />
                          </div>
                          <input 
                            type="file" 
                            ref={proofFileRef} 
                            className="hidden" 
                            accept="image/*" 
                            onChange={e => e.target.files?.[0] && handleUploadProof(e.target.files[0])} 
                          />
                          <button 
                            onClick={() => proofFileRef.current?.click()}
                            disabled={isUploadingProof}
                            className="w-full py-3 bg-black text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-slate-100 disabled:opacity-50"
                          >
                            {isUploadingProof ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
                            Upload Photo Proof
                          </button>
                          <p className="text-[8px] font-bold text-slate-400 text-center uppercase">Max 10 photos allowed</p>
                        </div>
                      )}
                    </div>
                  )}
                </section>
              )}

              {/* Task Completed */}
              {selectedErrand.status === ErrandStatus.COMPLETED && (<div className="bg-slate-50 rounded-[1.5rem] p-6 border border-slate-200 text-center space-y-2"><div className="w-12 h-12 bg-black text-white rounded-full flex items-center justify-center mx-auto mb-2"><CheckCircle size={24} /></div><h4 className="text-lg font-black text-slate-900">Task Completed</h4><p className="text-[10px] font-black text-slate-400 uppercase">Closed on {new Date(selectedErrand.completedAt!).toLocaleDateString()}</p></div>)}
            </>
          )}

          {showBidModal && selectedErrand && (
                <BidModal 
                  isOpen={showBidModal}
                  onClose={() => setShowBidModal(false)}
                  errand={selectedErrand}
                  onSubmit={handleBidSubmit}
                />
              )}
        </div>
      </div>
    </div>
  );
};
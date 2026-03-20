/// <reference types="google.maps" />
import React, { useState, useEffect } from 'react';
import { Errand, ErrandStatus, ErrandCategory, Coordinates } from '../types';
import { MapPin, DollarSign, Clock, ChevronRight, ArrowRight, Globe, Waves, Home, Briefcase, ShoppingBag, ShieldCheck, Map as MapIcon } from 'lucide-react';
import { calculateDistance } from '../services/firebaseService';

interface ErrandCardProps {
  errand: Errand;
  onClick: (errand: Errand) => void;
  currentLocation?: Coordinates | null;
}

import { Map, AdvancedMarker, Pin, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';

const Directions: React.FC<{ start: { lat: number, lng: number }, end: { lat: number, lng: number }, onDurationChange: (d: string) => void }> = ({ start, end, onDurationChange }) => {
  const map = useMap();
  const routesLibrary = useMapsLibrary('routes');
  const [directionsService, setDirectionsService] = useState<google.maps.DirectionsService>();
  const [directionsRenderer, setDirectionsRenderer] = useState<google.maps.DirectionsRenderer>();

  useEffect(() => {
    if (!routesLibrary || !map) return;
    setDirectionsService(new routesLibrary.DirectionsService());
    setDirectionsRenderer(new routesLibrary.DirectionsRenderer({ 
      map, 
      suppressMarkers: true,
      polylineOptions: { strokeColor: '#4f46e5', strokeWeight: 5, strokeOpacity: 0.8 }
    }));
  }, [routesLibrary, map]);

  useEffect(() => {
    if (!directionsService || !directionsRenderer) return;

    directionsService.route({
      origin: start,
      destination: end,
      travelMode: google.maps.TravelMode.DRIVING,
    }).then(response => {
      directionsRenderer.setDirections(response);
      const leg = response.routes[0]?.legs[0];
      if (leg?.duration?.text) {
        onDurationChange(leg.duration.text);
      }
    }).catch(e => console.error("Directions request failed", e));
  }, [directionsService, directionsRenderer, start, end]);

  return null;
};

const MapView: React.FC<{ errand: Errand }> = ({ errand }) => {
  if (!errand.pickupCoordinates || !errand.dropoffCoordinates) return null;

  const start = { lat: errand.pickupCoordinates.lat, lng: errand.pickupCoordinates.lng };
  const end = { lat: errand.dropoffCoordinates.lat, lng: errand.dropoffCoordinates.lng };
  const [duration, setDuration] = useState<string | null>(null);

  return (
    <div className="h-64 w-full rounded-2xl overflow-hidden border border-slate-200 shadow-sm relative group">
      <Map
        defaultCenter={start}
        defaultZoom={13}
        gestureHandling={'greedy'}
        disableDefaultUI={false}
        zoomControl={true}
        streetViewControl={false}
        mapTypeControl={false}
        fullscreenControl={true}
        mapId="errand_card_map"
        className="w-full h-full"
      >
        <AdvancedMarker position={start}>
          <Pin background={'#000'} glyphColor={'#fff'} borderColor={'#000'} />
        </AdvancedMarker>
        <AdvancedMarker position={end}>
          <Pin background={'#4f46e5'} glyphColor={'#fff'} borderColor={'#4f46e5'} />
        </AdvancedMarker>
        <Directions start={start} end={end} onDurationChange={setDuration} />
      </Map>
      
      {duration && (
        <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm z-10 border border-slate-100 flex items-center gap-1.5 animate-in fade-in slide-in-from-top-2">
          <Clock size={12} className="text-indigo-600" />
          <span>Est. {duration}</span>
        </div>
      )}
    </div>
  );
};

const ErrandCard: React.FC<ErrandCardProps> = ({ errand, onClick, currentLocation }) => {
  const [showMap, setShowMap] = useState(false);
  const distance = currentLocation && errand.pickupCoordinates ? calculateDistance(currentLocation, errand.pickupCoordinates) : null;

  const getStatusColor = (status: ErrandStatus) => {
    switch (status) {
      case ErrandStatus.PENDING: return 'bg-amber-50 text-amber-600 border-amber-100';
      case ErrandStatus.ACCEPTED: return 'bg-blue-50 text-blue-600 border-blue-100';
      case ErrandStatus.VERIFYING: return 'bg-slate-100 text-black border-slate-200';
      case ErrandStatus.COMPLETED: return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      default: return 'bg-gray-50 text-gray-600 border-gray-100';
    }
  };

  const getCategoryColor = (cat: ErrandCategory) => {
    switch(cat) {
      case ErrandCategory.SHOPPING: return 'text-emerald-600 bg-emerald-50 border-emerald-100';
      case ErrandCategory.TOWN_SERVICE: return 'text-blue-600 bg-blue-50 border-blue-100';
      case ErrandCategory.GENERAL: return 'text-amber-600 bg-amber-50 border-amber-100';
      case ErrandCategory.MAMA_FUA: return 'text-indigo-600 bg-indigo-50 border-indigo-100';
      case ErrandCategory.HOUSE_HUNTING: return 'text-rose-600 bg-rose-50 border-rose-100';
      case ErrandCategory.PACKAGE_DELIVERY: return 'text-cyan-600 bg-cyan-50 border-cyan-100';
      default: return 'text-slate-400 bg-slate-50 border-slate-100';
    }
  };

  const getCategoryIcon = (cat: ErrandCategory) => {
    switch(cat) {
      case ErrandCategory.MAMA_FUA: return <Waves size={10} />;
      case ErrandCategory.HOUSE_HUNTING: return <Home size={10} />;
      case ErrandCategory.SHOPPING: return <ShoppingBag size={10} />;
      case ErrandCategory.PACKAGE_DELIVERY: return <Briefcase size={10} />;
      default: return <Briefcase size={10} />;
    }
  }

  const formatRelativeTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `Posted ${days}d ago`;
    if (hours > 0) return `Posted ${hours}h ago`;
    if (minutes > 0) return `Posted ${minutes}m ago`;
    return 'Posted just now';
  };

  const isOverdue = errand.deadlineTimestamp && 
                    Date.now() > errand.deadlineTimestamp && 
                    errand.status === ErrandStatus.ACCEPTED;

  return (
    <div 
      onClick={() => onClick(errand)}
      className="bg-white rounded-2xl border border-slate-100 p-3 shadow-sm active:scale-[0.98] transition-all cursor-pointer group relative"
    >
      <div className="flex justify-between items-start gap-3">
        {/* Left Content */}
        <div className="flex-1 min-w-0">
          {/* Header Row: Category & Time */}
          <div className="flex items-center gap-2 mb-1">
             <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md border ${getCategoryColor(errand.category)}`}>
               {getCategoryIcon(errand.category)}
               <span className="text-[8px] font-[800] uppercase tracking-widest">
                 {errand.category?.replace(/_/g, ' ') || 'General'}
               </span>
             </div>
             <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
               {formatRelativeTime(errand.createdAt)}
             </span>
          </div>

          {/* Title */}
          <h3 className="font-black text-slate-900 line-clamp-1 leading-tight text-sm mb-1.5">{errand.title}</h3>

          {/* Location Row */}
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-semibold mb-1.5">
             <MapPin size={10} className="shrink-0" />
             <span className="truncate">{errand.pickupLocation}</span>
             {distance !== null && (
               <span className="text-[8px] font-black text-indigo-600 bg-indigo-50 px-1 py-0.5 rounded uppercase tracking-tighter shrink-0 ml-1">
                 {distance} KM
               </span>
             )}
          </div>

          {/* Context Tags (Compact) */}
          <div className="flex flex-wrap gap-1.5">
             {errand.isFundsLocked && (
               <div className="flex items-center gap-1 text-[8px] font-black bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded border border-emerald-100 uppercase tracking-widest">
                 <ShieldCheck size={10} />
                 Secured Job
               </div>
             )}
             {errand.category === ErrandCategory.MAMA_FUA && errand.laundryBaskets && (
               <span className="text-[8px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">{errand.laundryBaskets} Baskets</span>
             )}
             {errand.category === ErrandCategory.HOUSE_HUNTING && errand.houseType && (
               <span className="text-[8px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">{errand.houseType}</span>
             )}
             {errand.deadlineTimestamp && (
                <div className={`text-[8px] font-bold uppercase tracking-tighter px-1.5 py-0.5 rounded border ${isOverdue ? 'bg-red-50 text-red-600 border-red-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                  Due {new Date(errand.deadlineTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
             )}
          </div>
        </div>

        {/* Right Content */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className="font-[900] text-sm text-slate-900">
            Ksh {errand.acceptedPrice || errand.budget}
          </span>
          <span className={`text-[8px] uppercase font-black px-1.5 py-0.5 rounded-md border ${isOverdue ? 'bg-red-50 text-red-600 border-red-100 animate-pulse' : getStatusColor(errand.status)}`}>
            {isOverdue ? 'Overdue' : errand.status}
          </span>
          <button 
            onClick={(e) => { 
              e.stopPropagation(); 
              setShowMap(!showMap); 
            }} 
            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition-all border ${
              showMap 
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100' 
                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
            }`}
          >
            <MapIcon size={12} className={showMap ? 'animate-pulse' : ''} />
            <span className="text-[9px] font-black uppercase tracking-widest">
              {showMap ? 'Hide Map' : 'View Map'}
            </span>
          </button>
        </div>
      </div>

      {showMap && (
        <div className="mt-3 animate-in zoom-in-95 duration-200 rounded-xl overflow-hidden border border-slate-100" onClick={e => e.stopPropagation()}>
          <MapView errand={errand} />
        </div>
      )}
    </div>
  );
};

export default ErrandCard;
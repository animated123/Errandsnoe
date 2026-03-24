import React from 'react';
import { Map as MapIcon } from 'lucide-react';
import { Errand, Coordinates } from '../../types';

interface MapViewProps {
  errands: Errand[];
  onSelectErrand: (errand: Errand) => void;
  height?: string;
  userLocation: Coordinates | null;
}

export default function MapView({ errands, onSelectErrand, height = '400px', userLocation }: MapViewProps) {
  return (
    <div style={{ height }} className="rounded-[2rem] flex flex-col items-center justify-center bg-slate-100 text-slate-400 font-bold text-[10px] uppercase tracking-widest p-8 text-center gap-3 border-2 border-dashed border-slate-200">
      <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-slate-400 mb-2 shadow-sm">
        <MapIcon size={32} />
      </div>
      <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Interactive Map Placeholder</h3>
      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-relaxed max-w-[200px]">
        Map integration has been removed for static mode. In a live environment, this would show real-time runner locations and errand pins.
      </p>
    </div>
  );
}

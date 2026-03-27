import React from 'react';
import { Errand, Coordinates } from '../../types';
import MapComponent from './MapComponent';

interface MapViewProps {
  errands: Errand[];
  onSelectErrand: (errand: Errand) => void;
  height?: string;
  userLocation: Coordinates | null;
  apiKey: string;
}

export default function MapView({ errands, onSelectErrand, height = '400px', userLocation, apiKey }: MapViewProps) {
  return (
    <div style={{ height }} className="rounded-[2rem] overflow-hidden border border-slate-100 shadow-soft">
      <MapComponent 
        errands={errands} 
        runners={[]} 
        center={userLocation || undefined}
        onSelectErrand={onSelectErrand}
        apiKey={apiKey}
      />
    </div>
  );
}

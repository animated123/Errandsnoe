import React, { useEffect, useState } from 'react';
import { APIProvider, Map, Marker, InfoWindow, useMarkerRef } from '@vis.gl/react-google-maps';
import { Errand, User, Coordinates } from '../../types';
import UserAvatar from './UserAvatar';

interface MapComponentProps {
  errands: Errand[];
  runners: User[];
  center?: Coordinates;
  zoom?: number;
}

export default function MapComponent({ errands, runners, center, zoom = 13 }: MapComponentProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<'errand' | 'runner' | null>(null);
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  const defaultCenter = center || { lat: -1.2921, lng: 36.8219 }; // Nairobi

  return (
    <div className="w-full h-full min-h-[400px] rounded-[2rem] overflow-hidden shadow-soft border border-slate-100">
      <APIProvider apiKey={apiKey}>
        <Map
          defaultCenter={defaultCenter}
          defaultZoom={zoom}
          gestureHandling={'greedy'}
          disableDefaultUI={false}
          mapId="errand_runner_map"
        >
          {/* Errand Markers */}
          {errands.map((errand) => (
            errand.pickupCoordinates && (
              <Marker
                key={errand.id}
                position={errand.pickupCoordinates}
                onClick={() => {
                  setSelectedId(errand.id);
                  setSelectedType('errand');
                }}
                title={errand.title}
              />
            )
          ))}

          {/* Runner Markers */}
          {runners.map((runner) => (
            runner.lastKnownLocation && (
              <Marker
                key={runner.id}
                position={runner.lastKnownLocation}
                onClick={() => {
                  setSelectedId(runner.id);
                  setSelectedType('runner');
                }}
                title={runner.name}
                // Custom icon for runner could be added here
              />
            )
          ))}

          {/* Info Windows */}
          {selectedId && selectedType === 'errand' && (
            <InfoWindow
              position={errands.find(e => e.id === selectedId)?.pickupCoordinates}
              onCloseClick={() => setSelectedId(null)}
            >
              <div className="p-2 max-w-[200px]">
                <h4 className="font-black text-xs mb-1">{errands.find(e => e.id === selectedId)?.title}</h4>
                <p className="text-[10px] text-slate-500 line-clamp-2 mb-2">{errands.find(e => e.id === selectedId)?.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-indigo-600">KSH {errands.find(e => e.id === selectedId)?.budget}</span>
                  <span className="text-[8px] px-2 py-0.5 bg-secondary rounded-full uppercase font-bold">{errands.find(e => e.id === selectedId)?.status}</span>
                </div>
              </div>
            </InfoWindow>
          )}

          {selectedId && selectedType === 'runner' && (
            <InfoWindow
              position={runners.find(r => r.id === selectedId)?.lastKnownLocation}
              onCloseClick={() => setSelectedId(null)}
            >
              <div className="p-2 flex items-center gap-3">
                <UserAvatar 
                  src={runners.find(r => r.id === selectedId)?.profilePhoto} 
                  name={runners.find(r => r.id === selectedId)?.name} 
                  className="w-10 h-10" 
                />
                <div>
                  <h4 className="font-black text-xs">{runners.find(r => r.id === selectedId)?.name}</h4>
                  <p className="text-[10px] text-emerald-600 font-bold">Online Now</p>
                </div>
              </div>
            </InfoWindow>
          )}
        </Map>
      </APIProvider>
    </div>
  );
}

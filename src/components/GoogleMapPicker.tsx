/// <reference types="@types/google.maps" />
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  APIProvider,
  Map,
  useMapsLibrary,
  useMap,
  AdvancedMarker,
  Pin,
  ControlPosition,
  MapControl
} from '@vis.gl/react-google-maps';
import { MapPin, Search, Target, CheckCircle2, X } from 'lucide-react';

interface LocationData {
  address: string;
  coords: google.maps.LatLngLiteral;
  placeId: string;
}

interface GoogleMapPickerProps {
  apiKey: string;
  onConfirm: (location: LocationData) => void;
  className?: string;
  placeholder?: string;
}

export default function GoogleMapPicker({ apiKey, onConfirm, className, placeholder = "Search for a location..." }: GoogleMapPickerProps) {
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);
  const [mapCenter, setMapCenter] = useState<google.maps.LatLngLiteral>({ lat: -1.286389, lng: 36.817223 }); // Nairobi default

  const handleConfirm = () => {
    if (selectedLocation) {
      onConfirm(selectedLocation);
    }
  };

  return (
    <div className={`flex flex-col h-full bg-slate-50 ${className}`}>
      <APIProvider apiKey={apiKey}>
        <div className="flex-1 relative">
          <Map
            defaultCenter={mapCenter}
            defaultZoom={13}
            mapId="bf51a910020fa1cf"
            className="w-full h-full"
            disableDefaultUI={true}
          >
            {selectedLocation && (
              <AdvancedMarker position={selectedLocation.coords}>
                <Pin background={'#FF6321'} glyphColor={'#fff'} borderColor={'#FF6321'} />
              </AdvancedMarker>
            )}
            
            <MapControl position={ControlPosition.TOP_LEFT}>
              <div className="m-4 w-[300px] md:w-[400px]">
                <PlacesAutocomplete 
                  onLocationSelect={(loc) => {
                    setSelectedLocation(loc);
                    setMapCenter(loc.coords);
                  }} 
                  placeholder={placeholder}
                />
              </div>
            </MapControl>

            <MapControl position={ControlPosition.BOTTOM_CENTER}>
              <div className="mb-8 px-4 w-full max-w-md">
                {selectedLocation ? (
                  <div className="bg-white p-4 rounded-3xl shadow-strong border border-slate-100 animate-in slide-in-from-bottom-4">
                    <div className="flex items-start gap-3 mb-4">
                      <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 flex-shrink-0">
                        <MapPin size={20} />
                      </div>
                      <div>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Selected Location</p>
                        <p className="text-sm font-bold text-slate-700 line-clamp-2">{selectedLocation.address}</p>
                      </div>
                    </div>
                    <button
                      onClick={handleConfirm}
                      className="w-full py-4 bg-black text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-strong active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 size={18} />
                      Confirm Location
                    </button>
                  </div>
                ) : (
                  <div className="bg-white/80 backdrop-blur-md p-4 rounded-3xl shadow-soft border border-white/20 text-center">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Search and select a location on the map</p>
                  </div>
                )}
              </div>
            </MapControl>
          </Map>
        </div>
      </APIProvider>
    </div>
  );
}

function PlacesAutocomplete({ onLocationSelect, placeholder }: { onLocationSelect: (loc: LocationData) => void, placeholder: string }) {
  const [inputValue, setInputValue] = useState("");
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const places = useMapsLibrary("places");
  const map = useMap();
  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesService = useRef<google.maps.places.PlacesService | null>(null);

  useEffect(() => {
    if (!places || !map) return;
    autocompleteService.current = new places.AutocompleteService();
    placesService.current = new places.PlacesService(map);
  }, [places, map]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);

    if (!value || !autocompleteService.current) {
      setSuggestions([]);
      return;
    }

    autocompleteService.current.getPlacePredictions(
      { input: value, componentRestrictions: { country: 'ke' } },
      (predictions) => {
        setSuggestions(predictions || []);
      }
    );
  };

  const handleSelect = (prediction: google.maps.places.AutocompletePrediction) => {
    if (!placesService.current || !map) return;

    placesService.current.getDetails(
      { placeId: prediction.place_id, fields: ['geometry', 'formatted_address', 'place_id'] },
      (place, status) => {
        if (status === "OK" && place?.geometry?.location) {
          const loc = {
            address: place.formatted_address || prediction.description,
            coords: {
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng()
            },
            placeId: place.place_id || prediction.place_id
          };
          onLocationSelect(loc);
          setInputValue(loc.address);
          setSuggestions([]);
          map.panTo(loc.coords);
          map.setZoom(16);
        }
      }
    );
  };

  return (
    <div className="relative">
      <div className="relative group">
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
          <Search size={18} className="text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
        </div>
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          placeholder={placeholder}
          className="w-full pl-12 pr-12 py-4 bg-white border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:ring-8 focus:ring-indigo-500/5 focus:border-indigo-500/20 transition-all shadow-strong"
        />
        {inputValue && (
          <button 
            onClick={() => { setInputValue(""); setSuggestions([]); }}
            className="absolute inset-y-0 right-4 flex items-center text-slate-400 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl border border-slate-100 shadow-strong overflow-hidden z-[1000]">
          {suggestions.map((s) => (
            <button
              key={s.place_id}
              onClick={() => handleSelect(s)}
              className="w-full px-6 py-4 text-left hover:bg-slate-50 border-b border-slate-50 last:border-none transition-colors flex items-start gap-3 group"
            >
              <MapPin size={16} className="text-slate-300 mt-1 group-hover:text-indigo-600 transition-colors" />
              <div>
                <p className="text-sm font-bold text-slate-700">{s.structured_formatting.main_text}</p>
                <p className="text-xs text-slate-400">{s.structured_formatting.secondary_text}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

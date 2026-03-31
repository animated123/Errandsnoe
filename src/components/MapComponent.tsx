import React, { useState, useEffect, useRef } from 'react';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Pin,
  InfoWindow,
  useMap
} from '@vis.gl/react-google-maps';
import { Errand, User, Coordinates, ErrandStatus, PropertyListing } from '../../types';

interface MapComponentProps {
  errands: Errand[];
  runners: User[];
  center?: Coordinates;
  zoom?: number;
  onSelectErrand?: (errand: Errand) => void;
  onSelectProperty?: (property: PropertyListing) => void;
  apiKey: string;
  routesApiKey?: string;
  showRoute?: boolean;
  travelMode?: 'DRIVE' | 'WALK';
  customRoute?: { origin: Coordinates; destination: Coordinates };
  onRouteCalculated?: (summary: { distance: string; duration: string }) => void;
}

function Directions({ origin, destination, apiKey, travelMode = 'DRIVE', onRouteCalculated }: { 
  origin: Coordinates; 
  destination: Coordinates;
  apiKey: string;
  travelMode?: 'DRIVE' | 'WALK';
  onRouteCalculated?: (summary: { distance: string; duration: string }) => void;
}) {
  const map = useMap();
  const polylineRef = useRef<google.maps.Polyline | null>(null);

  useEffect(() => {
    if (!origin || !destination || !map) {
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
        polylineRef.current = null;
      }
      return;
    }

    const fetchRoute = async () => {
      try {
        const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline',
          },
          body: JSON.stringify({
            origin: {
              location: {
                latLng: {
                  latitude: origin.lat,
                  longitude: origin.lng
                }
              }
            },
            destination: {
              location: {
                latLng: {
                  latitude: destination.lat,
                  longitude: destination.lng
                }
              }
            },
            travelMode: travelMode,
            computeAlternativeRoutes: false,
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          console.error('Routes API Error Details:', data);
          return;
        }
        
        if (!data.routes || data.routes.length === 0) {
          console.warn('No routes found in API response');
          return;
        }

        const route = data.routes[0];

        if (route) {
          if (onRouteCalculated) {
            const durationSeconds = Number(route.duration.replace('s', ''));
            onRouteCalculated({
              distance: (route.distanceMeters / 1000).toFixed(1) + ' km',
              duration: durationSeconds / 60 < 60 
                ? Math.round(durationSeconds / 60) + ' mins'
                : Math.floor(durationSeconds / 3600) + 'h ' + Math.round((durationSeconds % 3600) / 60) + 'm'
            });
          }

          const path = google.maps.geometry.encoding.decodePath(route.polyline.encodedPolyline);
          
          if (polylineRef.current) polylineRef.current.setMap(null);
          
          const newPolyline = new google.maps.Polyline({
            path,
            map,
            strokeColor: '#4f46e5',
            strokeWeight: 5,
            strokeOpacity: 0.8
          });
          
          polylineRef.current = newPolyline;

          // Fit bounds
          const bounds = new google.maps.LatLngBounds();
          path.forEach(p => bounds.extend(p));
          map.fitBounds(bounds, 100);
        }
      } catch (error) {
        console.error('Routes error:', error);
      }
    };

    fetchRoute();
  }, [origin, destination, map, apiKey, travelMode, onRouteCalculated]);

  useEffect(() => {
    return () => {
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
        polylineRef.current = null;
      }
    };
  }, []);

  return null;
}

function MapHandler({ center, zoom, active }: { center: google.maps.LatLngLiteral; zoom: number; active: boolean }) {
  const map = useMap();

  useEffect(() => {
    if (!map || !active || !center) return;
    map.panTo(center);
    map.setZoom(zoom);
  }, [map, center, center.lat, center.lng, zoom, active]);

  return null;
}

export default function MapComponent({ 
  errands, 
  runners, 
  center, 
  zoom = 13, 
  onSelectErrand, 
  onSelectProperty,
  apiKey, 
  routesApiKey,
  showRoute = false,
  travelMode = 'DRIVE',
  customRoute,
  onRouteCalculated
}: MapComponentProps) {
  const [selectedMarker, setSelectedMarker] = useState<{ type: 'errand' | 'runner' | 'property', id: string } | null>(null);

  const mapCenter = (center && typeof center.lat === 'number' && typeof center.lng === 'number') 
    ? { lat: center.lat, lng: center.lng } 
    : { lat: -1.286389, lng: 36.817223 }; // Default to Nairobi

  const singleErrand = errands.length === 1 ? errands[0] : null;
  
  let routeToDisplay = null;
  if (showRoute) {
    if (customRoute) {
      routeToDisplay = customRoute;
    } else if (singleErrand && singleErrand.pickupCoordinates && singleErrand.dropoffCoordinates) {
      routeToDisplay = { origin: singleErrand.pickupCoordinates, destination: singleErrand.dropoffCoordinates };
    }
  }

  const getStatusColor = (status: ErrandStatus) => {
    switch (status) {
      case ErrandStatus.PENDING:
      case ErrandStatus.BIDDING:
        return '#3b82f6'; // Blue
      case ErrandStatus.ASSIGNED:
      case ErrandStatus.IN_PROGRESS:
      case ErrandStatus.ACCEPTED:
        return '#10b981'; // Green
      case ErrandStatus.VERIFYING:
      case ErrandStatus.REVIEW:
        return '#eab308'; // Yellow
      case ErrandStatus.COMPLETED:
        return '#94a3b8'; // Gray
      case ErrandStatus.CANCELLED:
      case ErrandStatus.FAILED:
        return '#ef4444'; // Red
      default:
        return '#4f46e5'; // Indigo (Default)
    }
  };

  return (
    <div className="w-full h-full min-h-[400px] rounded-[2.5rem] overflow-hidden shadow-soft border border-slate-100 bg-slate-50 relative">
      <APIProvider apiKey={apiKey} libraries={['marker', 'geometry']}>
        <Map
          key={singleErrand?.id || 'multi'}
          defaultCenter={mapCenter}
          defaultZoom={zoom}
          mapId="DEMO_MAP_ID"
          disableDefaultUI={false}
          gestureHandling={'greedy'}
          className="w-full h-full"
        >
          <MapHandler center={mapCenter} zoom={zoom} active={!routeToDisplay} />
          
          {routeToDisplay && (
            <Directions 
              origin={routeToDisplay.origin} 
              destination={routeToDisplay.destination} 
              apiKey={routesApiKey || apiKey} 
              travelMode={travelMode}
              onRouteCalculated={onRouteCalculated}
            />
          )}

          {errands.map((errand) => (
            errand.pickupCoordinates && typeof errand.pickupCoordinates.lat === 'number' && typeof errand.pickupCoordinates.lng === 'number' && (
              <AdvancedMarker
                key={`errand-${errand.id}`}
                position={{ lat: errand.pickupCoordinates.lat, lng: errand.pickupCoordinates.lng }}
                onClick={() => {
                  setSelectedMarker({ type: 'errand', id: errand.id });
                  onSelectErrand?.(errand);
                }}
              >
                <Pin background={getStatusColor(errand.status)} glyphColor={'#ffffff'} borderColor={'#ffffff'} />
                {selectedMarker?.type === 'errand' && selectedMarker.id === errand.id && (
                  <InfoWindow
                    position={{ lat: errand.pickupCoordinates.lat, lng: errand.pickupCoordinates.lng }}
                    onCloseClick={() => setSelectedMarker(null)}
                  >
                    <div className="p-1">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-900 mb-1">{errand.title}</p>
                      <p className="text-[8px] font-bold text-emerald-600 uppercase tracking-tighter">Ksh {errand.budget}</p>
                    </div>
                  </InfoWindow>
                )}
              </AdvancedMarker>
            )
          ))}

          {singleErrand?.dropoffCoordinates && (
            <AdvancedMarker
              position={{ lat: singleErrand.dropoffCoordinates.lat, lng: singleErrand.dropoffCoordinates.lng }}
            >
              <Pin background={'#e11d48'} glyphColor={'#ffffff'} borderColor={'#ffffff'} />
            </AdvancedMarker>
          )}

          {/* Property Listings Pins */}
          {errands.map(errand => 
            errand.propertyListings?.map(listing => (
              listing.coords && (
                <AdvancedMarker
                  key={`property-${listing.id}`}
                  position={{ lat: listing.coords.lat, lng: listing.coords.lng }}
                  onClick={() => {
                    setSelectedMarker({ type: 'property', id: listing.id });
                    onSelectProperty?.(listing);
                  }}
                >
                  <Pin background={'#f59e0b'} glyphColor={'#ffffff'} borderColor={'#ffffff'} />
                  {selectedMarker?.type === 'property' && selectedMarker.id === listing.id && (
                    <InfoWindow
                      position={{ lat: listing.coords.lat, lng: listing.coords.lng }}
                      onCloseClick={() => setSelectedMarker(null)}
                    >
                      <div className="p-1 min-w-[100px]">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-900 mb-1">{listing.title}</p>
                        <p className="text-[8px] font-bold text-amber-600 uppercase tracking-tighter">Ksh {listing.price.toLocaleString()}</p>
                        <img src={listing.imageUrl} alt={listing.title} className="w-full h-12 object-cover rounded-md mt-1" />
                      </div>
                    </InfoWindow>
                  )}
                </AdvancedMarker>
              )
            ))
          )}

          {runners.map((runner) => (
            runner.lastKnownLocation && typeof runner.lastKnownLocation.lat === 'number' && typeof runner.lastKnownLocation.lng === 'number' && (
              <AdvancedMarker
                key={`runner-${runner.id}`}
                position={{ lat: runner.lastKnownLocation.lat, lng: runner.lastKnownLocation.lng }}
                onClick={() => setSelectedMarker({ type: 'runner', id: runner.id })}
              >
                <Pin background={'#ef4444'} glyphColor={'#ffffff'} borderColor={'#ffffff'} />
                {selectedMarker?.type === 'runner' && selectedMarker.id === runner.id && (
                  <InfoWindow
                    position={{ lat: runner.lastKnownLocation.lat, lng: runner.lastKnownLocation.lng }}
                    onCloseClick={() => setSelectedMarker(null)}
                  >
                    <div className="p-1">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-900 mb-1">{runner.name}</p>
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Active Runner</p>
                    </div>
                  </InfoWindow>
                )}
              </AdvancedMarker>
            )
          ))}
        </Map>
      </APIProvider>

      <div className="absolute bottom-6 right-6 z-[10] bg-white/90 backdrop-blur-md p-4 rounded-2xl border border-slate-100 shadow-xl space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
          <span className="text-[8px] font-black uppercase tracking-widest text-slate-600">Pending/Bidding</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
          <span className="text-[8px] font-black uppercase tracking-widest text-slate-600">Active/Accepted</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
          <span className="text-[8px] font-black uppercase tracking-widest text-slate-600">Verifying</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
          <span className="text-[8px] font-black uppercase tracking-widest text-slate-600">Houses Found</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-red-500 rounded-full"></div>
          <span className="text-[8px] font-black uppercase tracking-widest text-slate-600">Runners</span>
        </div>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { Navigation, Coffee, Fuel, Utensils, MapPin, Compass, ExternalLink, ShieldAlert, Sparkles, Phone, Clock, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { RestStop, DriverState, SpeedData } from '../types';

interface RestStopNavigatorProps {
  driverState: DriverState;
  speedData: SpeedData;
}

const DEFAULT_REST_STOPS: RestStop[] = [
  {
    id: 'stop-1',
    name: 'Vista Point Highway Rest Area',
    category: 'rest_area',
    distanceMiles: 3.4,
    etaMinutes: 4,
    rating: 4.6,
    address: 'Mile Marker 48, Hwy 101 North',
    amenities: ['24/7 Restrooms', 'Designated Sleep Zone', 'Vending Machines', 'Well-Lit Parking'],
    lat: 37.7833,
    lng: -122.4167,
    isOpen24Hours: true,
    phone: '(800) 555-7378',
  },
  {
    id: 'stop-2',
    name: 'Starbucks Coffee & Drive-Thru',
    category: 'coffee',
    distanceMiles: 5.1,
    etaMinutes: 7,
    rating: 4.7,
    address: '1420 Grand Avenue, Exit 52',
    amenities: ['Fresh Espresso', 'Cold Brew Energy', 'Drive-Thru', 'Free Wi-Fi'],
    lat: 37.7900,
    lng: -122.4080,
    isOpen24Hours: true,
    phone: '(555) 234-5678',
  },
  {
    id: 'stop-3',
    name: 'Shell Travel Center & Fast EV Charging',
    category: 'fuel_ev',
    distanceMiles: 7.8,
    etaMinutes: 10,
    rating: 4.5,
    address: '2200 Interstate Blvd, Exit 55',
    amenities: ['150kW DC Fast EV', 'Snack Mart', 'Clean Restrooms', 'Air & Water'],
    lat: 37.8020,
    lng: -122.3990,
    isOpen24Hours: true,
    phone: '(555) 876-5432',
  },
  {
    id: 'stop-4',
    name: 'Oasis 24/7 Highway Diner & Fuel',
    category: 'diner',
    distanceMiles: 9.5,
    etaMinutes: 13,
    rating: 4.8,
    address: '3100 Skyline Way, Exit 58',
    amenities: ['Hot Meals', 'Unlimited Coffee', 'Truck Parking', 'Showers'],
    lat: 37.8150,
    lng: -122.3850,
    isOpen24Hours: true,
    phone: '(555) 345-6789',
  },
];

export const RestStopNavigator: React.FC<RestStopNavigatorProps> = ({
  driverState,
  speedData,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'rest_area' | 'coffee' | 'diner' | 'fuel_ev'>('all');
  const [activeStop, setActiveStop] = useState<RestStop>(DEFAULT_REST_STOPS[0]);
  const [isNavigating, setIsNavigating] = useState(false);

  const filteredStops = selectedCategory === 'all'
    ? DEFAULT_REST_STOPS
    : DEFAULT_REST_STOPS.filter(s => s.category === selectedCategory);

  const handleLaunchGoogleMaps = (stop: RestStop) => {
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(stop.name + ' ' + stop.address)}&travelmode=driving`;
    window.open(mapsUrl, '_blank', 'noopener,noreferrer');
  };

  const handleStartInAppNavigation = (stop: RestStop) => {
    setActiveStop(stop);
    setIsNavigating(true);
  };

  const isFatigued = driverState.alertLevel === 'RED' || driverState.drowsinessLevel >= 45 || driverState.eyesClosed;

  return (
    <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-4 shadow-xl flex flex-col justify-between h-full">
      {/* Header & Urgent Pull-Over Alert if fatigued */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
              <Navigation className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                Smart Rest Stop & Route Navigator
                <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20">
                  Google Maps
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Live location: {speedData.locationName}
              </p>
            </div>
          </div>

          <button
            onClick={() => handleLaunchGoogleMaps(activeStop)}
            id="btn-open-google-maps"
            className="flex items-center gap-1 text-[11px] font-semibold text-sky-400 hover:text-sky-300 transition-colors bg-sky-500/10 px-2.5 py-1 rounded-lg border border-sky-500/20"
          >
            <ExternalLink className="w-3 h-3" />
            <span>Open in Maps</span>
          </button>
        </div>

        {/* Dynamic Drowsiness Pull-Over Emergency Recommendation */}
        <AnimatePresence>
          {isFatigued && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="mb-3 p-3 rounded-xl bg-gradient-to-r from-red-950/90 to-amber-950/80 border border-red-500/40 shadow-lg shadow-red-950/50"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5 animate-pulse" />
                  <div>
                    <h4 className="text-xs font-bold text-red-200">
                      High Fatigue Detected — Immediate Rest Recommended
                    </h4>
                    <p className="text-[11px] text-red-300/90 mt-0.5">
                      Nearest safe resting area: <strong className="text-white">{DEFAULT_REST_STOPS[0].name}</strong> ({DEFAULT_REST_STOPS[0].distanceMiles} mi, ~{DEFAULT_REST_STOPS[0].etaMinutes} min)
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => handleStartInAppNavigation(DEFAULT_REST_STOPS[0])}
                  id="btn-emergency-route-rest"
                  className="shrink-0 bg-red-500 hover:bg-red-600 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg shadow-md transition-all active:scale-95 flex items-center gap-1"
                >
                  <Compass className="w-3 h-3" />
                  Route Now
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Category Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-all whitespace-nowrap ${
              selectedCategory === 'all'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            All Spots ({DEFAULT_REST_STOPS.length})
          </button>
          <button
            onClick={() => setSelectedCategory('rest_area')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium transition-all whitespace-nowrap ${
              selectedCategory === 'rest_area'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            <MapPin className="w-3 h-3 text-emerald-400" />
            <span>Rest Areas</span>
          </button>
          <button
            onClick={() => setSelectedCategory('coffee')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium transition-all whitespace-nowrap ${
              selectedCategory === 'coffee'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            <Coffee className="w-3 h-3 text-amber-400" />
            <span>Coffee & Energy</span>
          </button>
          <button
            onClick={() => setSelectedCategory('fuel_ev')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium transition-all whitespace-nowrap ${
              selectedCategory === 'fuel_ev'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            <Fuel className="w-3 h-3 text-sky-400" />
            <span>Fuel & EV</span>
          </button>
          <button
            onClick={() => setSelectedCategory('diner')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium transition-all whitespace-nowrap ${
              selectedCategory === 'diner'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            <Utensils className="w-3 h-3 text-rose-400" />
            <span>24/7 Diners</span>
          </button>
        </div>

        {/* Interactive Radar Route Map Visualization */}
        <div className="relative mt-2.5 w-full h-32 bg-slate-950/90 rounded-xl overflow-hidden border border-white/10 p-2 flex items-center justify-between">
          {/* Radar Circles & Highway Grid */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
            <div className="w-24 h-24 rounded-full border border-sky-400 animate-ping"></div>
            <div className="w-48 h-48 rounded-full border border-sky-400"></div>
            <div className="w-72 h-72 rounded-full border border-sky-400"></div>
            {/* Highway Corridor Line */}
            <div className="absolute w-full h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent"></div>
          </div>

          {/* User Vehicle Pin */}
          <div className="relative z-10 flex flex-col items-center ml-4">
            <div className="relative flex items-center justify-center">
              <span className="absolute w-6 h-6 rounded-full bg-blue-500/30 animate-pulse"></span>
              <div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow-lg shadow-blue-500/80 flex items-center justify-center">
                <Navigation className="w-2.5 h-2.5 text-white transform -rotate-45" />
              </div>
            </div>
            <span className="text-[10px] font-bold text-blue-300 mt-1 bg-slate-900/80 px-1.5 py-0.5 rounded border border-blue-500/30">
              Vehicle ({speedData.isSpeedAvailable && speedData.currentSpeedKmh !== null ? `${speedData.currentSpeedKmh} km/h` : 'Speed unavailable'})
            </span>
          </div>

          {/* Interactive Route Pins along Highway corridor */}
          <div className="relative z-10 flex-1 flex items-center justify-around px-3">
            {filteredStops.map((stop, index) => {
              const isSelected = activeStop.id === stop.id;
              return (
                <button
                  key={stop.id}
                  onClick={() => setActiveStop(stop)}
                  className={`group relative flex flex-col items-center transition-all ${
                    isSelected ? 'scale-110' : 'opacity-75 hover:opacity-100'
                  }`}
                >
                  <div className={`p-1.5 rounded-full border shadow-md transition-all ${
                    isSelected
                      ? 'bg-amber-500 text-slate-950 border-amber-300 ring-2 ring-amber-400/50'
                      : stop.category === 'rest_area'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                      : stop.category === 'coffee'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-400/40'
                      : 'bg-sky-500/20 text-sky-300 border-sky-400/40'
                  }`}>
                    {stop.category === 'rest_area' && <MapPin className="w-3.5 h-3.5" />}
                    {stop.category === 'coffee' && <Coffee className="w-3.5 h-3.5" />}
                    {stop.category === 'fuel_ev' && <Fuel className="w-3.5 h-3.5" />}
                    {stop.category === 'diner' && <Utensils className="w-3.5 h-3.5" />}
                  </div>

                  <span className="text-[9px] font-mono text-slate-200 mt-1 bg-slate-900/90 px-1 rounded border border-white/10 whitespace-nowrap">
                    {stop.distanceMiles} mi ({stop.etaMinutes}m)
                  </span>
                </button>
              );
            })}
          </div>

          {/* Radar Live Status Tag */}
          <div className="absolute top-2 right-2 text-[9px] font-mono text-emerald-400 flex items-center gap-1 bg-slate-900/90 px-2 py-0.5 rounded-full border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
            RADAR ACTIVE
          </div>
        </div>

        {/* Selected Stop Details Card */}
        <div className="mt-3 p-3 rounded-xl bg-white/5 border border-white/10 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold text-slate-100">{activeStop.name}</h4>
                <span className="flex items-center gap-0.5 text-[10px] text-amber-400 font-bold bg-amber-400/10 px-1.5 py-0.5 rounded">
                  <Star className="w-2.5 h-2.5 fill-amber-400" />
                  {activeStop.rating}
                </span>
                {activeStop.isOpen24Hours && (
                  <span className="text-[9px] text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded font-medium">
                    24/7 Open
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                {activeStop.address}
              </p>
            </div>

            <div className="text-right">
              <span className="text-xs font-bold text-sky-400">{activeStop.etaMinutes} min</span>
              <p className="text-[10px] text-slate-400 font-mono">{activeStop.distanceMiles} miles away</p>
            </div>
          </div>

          {/* Amenities Chips */}
          <div className="flex items-center gap-1.5 flex-wrap mt-2">
            {activeStop.amenities.map(amenity => (
              <span
                key={amenity}
                className="text-[10px] text-slate-300 bg-white/5 px-2 py-0.5 rounded-md border border-white/5"
              >
                ✓ {amenity}
              </span>
            ))}
          </div>

          {/* Navigation Action Buttons */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              onClick={() => handleStartInAppNavigation(activeStop)}
              id="btn-nav-direct"
              className="flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold py-2 px-3 rounded-xl transition-all shadow-md shadow-blue-950/50"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>{isNavigating ? 'In-App Route Active' : 'Start Navigation'}</span>
            </button>

            <button
              onClick={() => handleLaunchGoogleMaps(activeStop)}
              id="btn-nav-gmaps-external"
              className="flex items-center justify-center gap-1.5 bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-semibold py-2 px-3 rounded-xl transition-all border border-white/10"
            >
              <ExternalLink className="w-3.5 h-3.5 text-sky-400" />
              <span>Google Maps App</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import {
  Sun,
  Moon,
  Zap,
  ShieldAlert,
  Sparkles,
  Sliders,
  Cpu,
  Bluetooth,
  Usb,
  Power,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Radio,
  ExternalLink,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DriverState, CabinLightConfig, CabinLightHardwareStatus } from '../types';

interface AmbientCabinLightProps {
  driverState: DriverState;
  config: CabinLightConfig;
  setConfig: React.Dispatch<React.SetStateAction<CabinLightConfig>>;
  isTestFlashing: boolean;
  hardwareMessage: string;
  onConnectBluetooth: () => void;
  onConnectSerial: () => void;
  onDisconnectHardware: () => void;
  onSetHardwareState: (status: CabinLightHardwareStatus) => void;
  onTogglePower: () => void;
  onTriggerTestFlash: () => void;
}

export const AmbientCabinLight: React.FC<AmbientCabinLightProps> = ({
  driverState,
  config,
  setConfig,
  isTestFlashing,
  hardwareMessage,
  onConnectBluetooth,
  onConnectSerial,
  onDisconnectHardware,
  onSetHardwareState,
  onTogglePower,
  onTriggerTestFlash,
}) => {
  const isEmergencyTriggered =
    config.hardwareStatus === 'connected' &&
    ((config.autoStrobeOnAlert && (driverState.alertLevel === 'RED' || driverState.eyesClosed)) ||
      isTestFlashing);

  const isConnected = config.hardwareStatus === 'connected';
  const isOff = config.hardwareStatus === 'off';
  const isUnavailable = config.hardwareStatus === 'unavailable';

  return (
    <div
      id="ambient-cabin-lighting-section"
      className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-4 shadow-xl flex flex-col justify-between h-full relative overflow-hidden"
    >
      {/* On-screen visual pulse only if hardware is connected & emergency strobe is triggered */}
      <AnimatePresence>
        {isEmergencyTriggered && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{
              opacity: [0.15, 0.7, 0.15],
              backgroundColor: [
                'rgba(239,68,68,0.2)',
                'rgba(239,68,68,0.7)',
                'rgba(239,68,68,0.2)',
              ],
            }}
            exit={{ opacity: 0 }}
            transition={{
              duration: 0.25,
              repeat: Infinity,
              repeatType: 'reverse',
              ease: 'easeInOut',
            }}
            className="fixed inset-0 pointer-events-none z-50 mix-blend-screen"
          />
        )}
      </AnimatePresence>

      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <Sun className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                Ambient Cabin Lighting
              </h3>
              <p className="text-[11px] text-slate-400">
                Automotive CAN-Bus & BLE Hardware Abstraction
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {isConnected ? (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span>HARDWARE SYNCED</span>
              </span>
            ) : isOff ? (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                <Power className="w-3 h-3 text-amber-400" />
                <span>STANDBY</span>
              </span>
            ) : (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1">
                <XCircle className="w-3 h-3 text-slate-400" />
                <span>NO HARDWARE</span>
              </span>
            )}
          </div>
        </div>

        {/* 
          PROMINENT STATUS DISPLAY:
          CABIN LIGHT
          ● ACTIVE
          or
          CABIN LIGHT
          ● OFF
          or
          CABIN LIGHT
          ● HARDWARE UNAVAILABLE
        */}
        <div
          id="cabin-light-prominent-status"
          className={`p-4 rounded-xl border transition-all mb-3 relative overflow-hidden ${
            isConnected
              ? 'bg-gradient-to-r from-emerald-950/50 to-cyan-950/40 border-emerald-500/40 shadow-lg shadow-emerald-950/40'
              : isOff
              ? 'bg-slate-900/80 border-amber-500/30 shadow-md'
              : 'bg-slate-950/80 border-white/10'
          }`}
        >
          {/* Subtle glow aura when active */}
          {isConnected && (
            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 blur-2xl pointer-events-none" />
          )}

          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">
                CABIN LIGHT
              </span>

              {isConnected ? (
                <div className="flex items-center gap-2 mt-1">
                  <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                  <span className="text-2xl font-black font-mono tracking-tight text-emerald-300">
                    ACTIVE
                  </span>
                </div>
              ) : isOff ? (
                <div className="flex items-center gap-2 mt-1">
                  <span className="w-3 h-3 rounded-full bg-amber-400" />
                  <span className="text-2xl font-black font-mono tracking-tight text-amber-300">
                    OFF
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 mt-1">
                  <span className="w-3 h-3 rounded-full bg-slate-500" />
                  <span className="text-xl font-bold font-mono tracking-tight text-slate-400">
                    HARDWARE UNAVAILABLE
                  </span>
                </div>
              )}
            </div>

            {/* Power Toggle Button */}
            <div>
              <button
                onClick={onTogglePower}
                disabled={isUnavailable}
                id="btn-toggle-cabin-power"
                title={
                  isUnavailable
                    ? 'Cannot toggle: hardware unavailable'
                    : isConnected
                    ? 'Turn cabin light OFF'
                    : 'Turn cabin light ON'
                }
                className={`px-3 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all ${
                  isUnavailable
                    ? 'bg-slate-800/50 text-slate-500 border border-slate-700/50 cursor-not-allowed'
                    : isConnected
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 hover:bg-emerald-500/30'
                    : 'bg-white/10 text-slate-300 border border-white/20 hover:bg-white/20'
                }`}
              >
                <Power className="w-4 h-4" />
                <span>{isConnected ? 'Power: ON' : isOff ? 'Power: OFF' : 'Unavailable'}</span>
              </button>
            </div>
          </div>

          {/* Hardware status explanation text */}
          <div className="mt-2.5 pt-2 border-t border-white/5 text-[11px] text-slate-400 flex items-center justify-between">
            <span className="truncate max-w-[280px]">
              {isConnected
                ? `Active controller: ${config.hardwareInfo.deviceName || 'Automotive CAN-Bus Interface'}`
                : isOff
                ? 'Controller connected. Ambient lighting is switched off.'
                : 'Web app not connected to physical cabin lighting hardware.'}
            </span>
            <span className="font-mono text-[10px] text-slate-500 shrink-0">
              {config.hardwareInfo.protocol !== 'NONE'
                ? config.hardwareInfo.protocol
                : 'NO LINK'}
            </span>
          </div>
        </div>

        {/* 3 Explicit State Tabs for Bench-Testing & Architecture Validation */}
        <div className="mb-3">
          <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1.5">
            Hardware State Selector (Interface Test)
          </span>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              onClick={() => onSetHardwareState('connected')}
              id="tab-state-connected"
              className={`py-1.5 px-2 rounded-lg text-[11px] font-mono font-semibold border flex items-center justify-center gap-1 transition-all ${
                isConnected
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm'
                  : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>Active</span>
            </button>

            <button
              onClick={() => onSetHardwareState('off')}
              id="tab-state-off"
              className={`py-1.5 px-2 rounded-lg text-[11px] font-mono font-semibold border flex items-center justify-center gap-1 transition-all ${
                isOff
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm'
                  : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              <span>Off</span>
            </button>

            <button
              onClick={() => onSetHardwareState('unavailable')}
              id="tab-state-unavailable"
              className={`py-1.5 px-2 rounded-lg text-[11px] font-mono font-semibold border flex items-center justify-center gap-1 transition-all ${
                isUnavailable
                  ? 'bg-slate-800 text-slate-200 border-slate-600 shadow-sm'
                  : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-slate-500"></span>
              <span>Unavailable</span>
            </button>
          </div>
        </div>

        {/* Clean Architecture: Hardware Connection Ports */}
        <div className="bg-white/5 rounded-xl border border-white/10 p-3 mb-3 text-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-slate-200 flex items-center gap-1.5 text-xs">
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              <span>Vehicle Controller Interface</span>
            </span>
            {config.hardwareStatus !== 'unavailable' && (
              <button
                onClick={onDisconnectHardware}
                className="text-[10px] text-rose-400 hover:underline"
              >
                Disconnect
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* Bluetooth LE Button */}
            <button
              onClick={onConnectBluetooth}
              id="btn-connect-ble"
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] flex items-center gap-2 text-slate-300 transition-colors"
            >
              <Bluetooth className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span className="truncate">Connect BLE</span>
            </button>

            {/* Serial / CAN-Bus Button */}
            <button
              onClick={onConnectSerial}
              id="btn-connect-serial"
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] flex items-center gap-2 text-slate-300 transition-colors"
            >
              <Usb className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="truncate">CAN-Bus USB</span>
            </button>
          </div>

          <p className="text-[10px] text-slate-400 mt-2">
            {hardwareMessage}
          </p>
        </div>

        {/* Lighting Mode Selector (Active when hardware is connected) */}
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-300 font-medium">Alert Spectrum Preset</span>
            <span className="text-[10px] text-cyan-400 font-mono">
              {isConnected ? `${config.intensity}% Intensity` : 'Inactive'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            <button
              onClick={() => setConfig(prev => ({ ...prev, mode: 'alertness_cyan', colorHex: '#06b6d4' }))}
              disabled={isUnavailable}
              className={`p-2 rounded-xl border text-[11px] font-semibold transition-all flex flex-col items-center gap-1 ${
                config.mode === 'alertness_cyan' && isConnected
                  ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-md shadow-cyan-950/50'
                  : 'bg-white/5 border-white/10 text-slate-300'
              } ${isUnavailable ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/10'}`}
            >
              <Sun className="w-3.5 h-3.5 text-cyan-400" />
              <span>470nm Cyan</span>
            </button>

            <button
              onClick={() => setConfig(prev => ({ ...prev, mode: 'pulse_wave', colorHex: '#0ea5e9' }))}
              disabled={isUnavailable}
              className={`p-2 rounded-xl border text-[11px] font-semibold transition-all flex flex-col items-center gap-1 ${
                config.mode === 'pulse_wave' && isConnected
                  ? 'bg-sky-500/20 border-sky-400 text-sky-300 shadow-md shadow-sky-950/50'
                  : 'bg-white/5 border-white/10 text-slate-300'
              } ${isUnavailable ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/10'}`}
            >
              <Zap className="w-3.5 h-3.5 text-sky-400" />
              <span>Pulse Wave</span>
            </button>

            <button
              onClick={() => setConfig(prev => ({ ...prev, mode: 'sunset_amber', colorHex: '#f59e0b' }))}
              disabled={isUnavailable}
              className={`p-2 rounded-xl border text-[11px] font-semibold transition-all flex flex-col items-center gap-1 ${
                config.mode === 'sunset_amber' && isConnected
                  ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-md shadow-amber-950/50'
                  : 'bg-white/5 border-white/10 text-slate-300'
              } ${isUnavailable ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/10'}`}
            >
              <Moon className="w-3.5 h-3.5 text-amber-400" />
              <span>Sunset Amber</span>
            </button>
          </div>

          {/* Strobe Test & Driver Safety Link */}
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={config.autoStrobeOnAlert}
                onChange={e => setConfig(prev => ({ ...prev, autoStrobeOnAlert: e.target.checked }))}
                className="rounded border-slate-700 text-cyan-600 focus:ring-0 bg-slate-900 w-3.5 h-3.5"
              />
              <span>Strobe on Micro-Sleep</span>
            </label>

            <button
              onClick={onTriggerTestFlash}
              disabled={isTestFlashing}
              id="btn-test-cabin-strobe"
              className="text-[11px] font-semibold text-red-400 hover:text-red-300 bg-red-500/10 px-2.5 py-1 rounded-lg border border-red-500/20 transition-all flex items-center gap-1 active:scale-95"
            >
              <ShieldAlert className="w-3 h-3" />
              <span>{isTestFlashing ? 'Flashing...' : 'Test Strobe'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

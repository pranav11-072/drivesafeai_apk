import { useState, useCallback, useEffect } from 'react';
import { CabinLightConfig, CabinLightHardwareStatus, DriverState } from '../types';
import { vehicleHardware } from '../services/vehicleHardwareService';

export function useCabinLighting(driverState: DriverState) {
  const [config, setConfig] = useState<CabinLightConfig>({
    hardwareStatus: 'unavailable', // 'connected' | 'off' | 'unavailable'
    isEnabled: false,
    mode: 'alertness_cyan',
    intensity: 75,
    colorHex: '#06b6d4',
    autoStrobeOnAlert: true,
    strobeSpeedHz: 4,
    hardwareInfo: {
      protocol: 'NONE',
      connectionType: 'None',
    },
  });

  const [isTestFlashing, setIsTestFlashing] = useState(false);
  const [hardwareMessage, setHardwareMessage] = useState<string>(
    'No physical vehicle lighting hardware detected. Connect via CAN-Bus or Bluetooth LE.'
  );

  // Check physical hardware availability on mount
  useEffect(() => {
    const check = vehicleHardware.checkHardwareAvailability();
    if (!check.isAvailable) {
      setConfig(prev => ({
        ...prev,
        hardwareStatus: 'unavailable',
        isEnabled: false,
      }));
      setHardwareMessage(check.reason);
    }
  }, []);

  // When driver fatigue is critical (RED alert or prolonged eye closure), trigger alert strobe if hardware is active
  useEffect(() => {
    const isFatigued = driverState.alertLevel === 'RED' || driverState.eyesClosed;
    if (isFatigued && config.autoStrobeOnAlert && config.hardwareStatus === 'connected') {
      vehicleHardware.dispatchCommand({
        action: 'TRIGGER_STROBE',
        powerOn: true,
        colorHex: '#ef4444',
        intensityPercent: 100,
        strobeSpeedHz: config.strobeSpeedHz,
        timestamp: Date.now(),
      });
    }
  }, [driverState.alertLevel, driverState.eyesClosed, config.autoStrobeOnAlert, config.hardwareStatus, config.strobeSpeedHz]);

  // Connect to actual Web Bluetooth hardware
  const connectBluetooth = useCallback(async () => {
    const res = await vehicleHardware.connectBle();
    if (res.success) {
      const info = vehicleHardware.getHardwareInfo();
      setConfig(prev => ({
        ...prev,
        hardwareStatus: 'connected',
        isEnabled: true,
        hardwareInfo: info,
      }));
      setHardwareMessage(`Connected to ${info.deviceName || 'BLE Ambient Light Controller'}`);
    } else {
      setHardwareMessage(res.error || 'Bluetooth hardware connection failed or cancelled.');
    }
  }, []);

  // Connect to actual Web Serial / CAN-Bus hardware
  const connectSerial = useCallback(async () => {
    const res = await vehicleHardware.connectSerial();
    if (res.success) {
      const info = vehicleHardware.getHardwareInfo();
      setConfig(prev => ({
        ...prev,
        hardwareStatus: 'connected',
        isEnabled: true,
        hardwareInfo: info,
      }));
      setHardwareMessage(`Connected to ${info.deviceName || 'CAN-Bus Controller'}`);
    } else {
      setHardwareMessage(res.error || 'Serial CAN-Bus connection failed or cancelled.');
    }
  }, []);

  // Disconnect hardware
  const disconnectHardware = useCallback(async () => {
    await vehicleHardware.disconnect();
    setConfig(prev => ({
      ...prev,
      hardwareStatus: 'unavailable',
      isEnabled: false,
      hardwareInfo: { protocol: 'NONE', connectionType: 'None' },
    }));
    setHardwareMessage('Vehicle hardware disconnected.');
  }, []);

  // Set explicit hardware state (for bench-testing the 3 states: 'connected' / 'off' / 'unavailable')
  const setHardwareState = useCallback((status: CabinLightHardwareStatus) => {
    if (status === 'connected') {
      vehicleHardware.setEmulatedHardware(true, true);
      setConfig(prev => ({
        ...prev,
        hardwareStatus: 'connected',
        isEnabled: true,
        hardwareInfo: vehicleHardware.getHardwareInfo(),
      }));
      setHardwareMessage('Vehicle CAN-Bus interface active & emitting 470nm alertness light.');
    } else if (status === 'off') {
      vehicleHardware.setEmulatedHardware(true, false);
      setConfig(prev => ({
        ...prev,
        hardwareStatus: 'off',
        isEnabled: false,
        hardwareInfo: vehicleHardware.getHardwareInfo(),
      }));
      setHardwareMessage('Vehicle hardware standby. Cabin lighting is turned OFF.');
    } else {
      vehicleHardware.setEmulatedHardware(false, false);
      setConfig(prev => ({
        ...prev,
        hardwareStatus: 'unavailable',
        isEnabled: false,
        hardwareInfo: { protocol: 'NONE', connectionType: 'None' },
      }));
      setHardwareMessage('No vehicle lighting hardware connected to browser.');
    }
  }, []);

  // Toggle power state (ACTIVE vs OFF) when hardware is available
  const togglePower = useCallback(() => {
    if (config.hardwareStatus === 'unavailable') {
      setHardwareMessage('Cannot toggle light: physical vehicle hardware is unavailable.');
      return;
    }

    const nextActive = config.hardwareStatus !== 'connected';
    const nextStatus: CabinLightHardwareStatus = nextActive ? 'connected' : 'off';
    
    setConfig(prev => ({
      ...prev,
      hardwareStatus: nextStatus,
      isEnabled: nextActive,
    }));

    vehicleHardware.dispatchCommand({
      action: 'SET_POWER',
      powerOn: nextActive,
      colorHex: config.colorHex,
      intensityPercent: config.intensity,
      timestamp: Date.now(),
    });
  }, [config.hardwareStatus, config.colorHex, config.intensity]);

  // Test strobe
  const triggerTestFlash = useCallback(() => {
    setIsTestFlashing(true);
    if (config.hardwareStatus === 'connected') {
      vehicleHardware.dispatchCommand({
        action: 'TRIGGER_STROBE',
        powerOn: true,
        colorHex: '#ef4444',
        intensityPercent: 100,
        strobeSpeedHz: config.strobeSpeedHz,
        timestamp: Date.now(),
      });
    }
    setTimeout(() => {
      setIsTestFlashing(false);
    }, 2500);
  }, [config.hardwareStatus, config.strobeSpeedHz]);

  return {
    config,
    setConfig,
    isTestFlashing,
    hardwareMessage,
    connectBluetooth,
    connectSerial,
    disconnectHardware,
    setHardwareState,
    togglePower,
    triggerTestFlash,
  };
}

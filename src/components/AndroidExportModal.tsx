import React, { useState } from 'react';
import { X, Smartphone, Copy, Check, Download, Terminal, Folder, Layers, Code, PlayCircle } from 'lucide-react';

interface AndroidExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AndroidExportModal: React.FC<AndroidExportModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [copiedTab, setCopiedTab] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'commands' | 'config' | 'manifest' | 'activity'>('commands');

  if (!isOpen) return null;

  const handleCopy = (text: string, tabId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTab(tabId);
    setTimeout(() => setCopiedTab(null), 2000);
  };

  const commandSnippet = `# 1. Download/Export project files from AI Studio Settings menu
# 2. Open project terminal and install Capacitor:
npm install @capacitor/core @capacitor/cli @capacitor/android

# 3. Initialize Capacitor for Android:
npx cap init DriveSafeAI com.drivesafe.ai --web-dir dist

# 4. Build web production bundle:
npm run build

# 5. Add Android platform & sync:
npx cap add android
npx cap sync android

# 6. Open project in Android Studio:
npx cap open android

# 7. Inside Android Studio:
# Go to Menu -> Build -> Build Bundle(s) / APK(s) -> Build APK(s)
# Your debug APK will be generated at: android/app/build/outputs/apk/debug/app-debug.apk`;

  const capacitorConfig = `{
  "appId": "com.drivesafe.ai",
  "appName": "DriveSafe AI",
  "webDir": "dist",
  "server": {
    "androidScheme": "https",
    "cleartext": true
  },
  "plugins": {
    "Camera": {
      "permissions": ["camera"]
    },
    "Geolocation": {
      "permissions": ["location"]
    }
  }
}`;

  const manifestXml = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.drivesafe.ai">

    <!-- DriveSafe AI Required Android Permissions -->
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.VIBRATE" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />

    <uses-feature android:name="android.hardware.camera" android:required="true" />
    <uses-feature android:name="android.hardware.location.gps" android:required="false" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="DriveSafe AI"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/AppTheme"
        android:usesCleartextTraffic="true">

        <activity
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|layoutDirection|fontScale|screenLayout|density|uiMode"
            android:name=".MainActivity"
            android:label="DriveSafe AI"
            android:theme="@style/AppTheme.NoActionBar"
            android:launchMode="singleTask"
            android:exported="true">

            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>`;

  const kotlinMainActivity = `package com.drivesafe.ai

import android.os.Bundle
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // DriveSafe AI Native Bridge Initialized
    }
}`;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Convert & Build Mobile APK in Android Studio</h2>
              <p className="text-xs text-slate-400">Step-by-step export setup for Android Studio & Capacitor</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs sm:text-sm">
          {/* Quick Intro Banner */}
          <div className="bg-gradient-to-r from-emerald-950/60 to-slate-950 p-3.5 rounded-xl border border-emerald-500/30 text-emerald-200 flex items-start gap-3">
            <PlayCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-white">Ready for Android Studio!</p>
              <p className="text-xs text-emerald-300/80 mt-0.5">
                DriveSafe AI uses standard React + Vite camera & location APIs. You can wrap it into an Android Studio APK using Capacitor in under 2 minutes.
              </p>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-1 border-b border-slate-800 pb-2">
            <button
              onClick={() => setActiveTab('commands')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                activeTab === 'commands'
                  ? 'bg-emerald-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Terminal className="w-4 h-4" /> 1. Build Commands
            </button>
            <button
              onClick={() => setActiveTab('config')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                activeTab === 'config'
                  ? 'bg-emerald-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Layers className="w-4 h-4" /> 2. capacitor.config.json
            </button>
            <button
              onClick={() => setActiveTab('manifest')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                activeTab === 'manifest'
                  ? 'bg-emerald-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Code className="w-4 h-4" /> 3. AndroidManifest.xml
            </button>
            <button
              onClick={() => setActiveTab('activity')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                activeTab === 'activity'
                  ? 'bg-emerald-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Smartphone className="w-4 h-4" /> 4. MainActivity.kt
            </button>
          </div>

          {/* Active Tab Content Display */}
          <div className="relative">
            {activeTab === 'commands' && (
              <div>
                <p className="text-xs text-slate-400 mb-2 font-medium">Run these terminal commands in your exported project folder:</p>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs text-emerald-300 whitespace-pre-wrap overflow-x-auto leading-relaxed">
                  {commandSnippet}
                </div>
                <button
                  onClick={() => handleCopy(commandSnippet, 'cmd')}
                  className="mt-2.5 flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold"
                >
                  {copiedTab === 'cmd' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedTab === 'cmd' ? 'Copied Commands!' : 'Copy Terminal Commands'}</span>
                </button>
              </div>
            )}

            {activeTab === 'config' && (
              <div>
                <p className="text-xs text-slate-400 mb-2 font-medium">Place this file at project root as <code className="text-emerald-400">capacitor.config.json</code>:</p>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs text-indigo-300 whitespace-pre-wrap overflow-x-auto">
                  {capacitorConfig}
                </div>
                <button
                  onClick={() => handleCopy(capacitorConfig, 'cfg')}
                  className="mt-2.5 flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold"
                >
                  {copiedTab === 'cfg' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedTab === 'cfg' ? 'Copied Config!' : 'Copy capacitor.config.json'}</span>
                </button>
              </div>
            )}

            {activeTab === 'manifest' && (
              <div>
                <p className="text-xs text-slate-400 mb-2 font-medium">Place this inside <code className="text-emerald-400">android/app/src/main/AndroidManifest.xml</code>:</p>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs text-amber-200 whitespace-pre-wrap overflow-x-auto max-h-60">
                  {manifestXml}
                </div>
                <button
                  onClick={() => handleCopy(manifestXml, 'manifest')}
                  className="mt-2.5 flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold"
                >
                  {copiedTab === 'manifest' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedTab === 'manifest' ? 'Copied Manifest!' : 'Copy AndroidManifest.xml'}</span>
                </button>
              </div>
            )}

            {activeTab === 'activity' && (
              <div>
                <p className="text-xs text-slate-400 mb-2 font-medium">Place this inside <code className="text-emerald-400">android/app/src/main/java/com/drivesafe/ai/MainActivity.kt</code>:</p>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs text-sky-300 whitespace-pre-wrap overflow-x-auto">
                  {kotlinMainActivity}
                </div>
                <button
                  onClick={() => handleCopy(kotlinMainActivity, 'act')}
                  className="mt-2.5 flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold"
                >
                  {copiedTab === 'act' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedTab === 'act' ? 'Copied Kotlin Activity!' : 'Copy MainActivity.kt'}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex justify-between items-center">
          <p className="text-xs text-slate-500 hidden sm:block">Export project via Top Right Menu &gt; Export to ZIP/GitHub</p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl transition-all shadow-md"
          >
            Got it, Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};

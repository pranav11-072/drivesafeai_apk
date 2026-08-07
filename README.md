# DriveSafe AI - Driver Safety & Drowsiness Alert System

**DriveSafe AI** is an advanced AI-powered driver fatigue, drowsiness detection, and real-time safety monitoring Heads-Up Display (HUD) application built with React, TypeScript, Tailwind CSS, Framer Motion, and Google Gemini AI.

---

## 🌟 Key Features

### 👁️ AI Vision & Drowsiness Monitoring (`CameraHUD`)
- **Live Eye Aspect Ratio (EAR) Tracking**: Real-time eye closures, micro-sleep detection, yawn tracking, and distraction alerts.
- **Gemini Vision AI Analysis**: Analyze webcam snapshot frames on demand using Google Gemini AI to evaluate driver alertness and receive real-time observations.
- **Framer Motion HUD Overlays**: Animated target reticles, pulse bounding boxes, and flashing red warning banners during critical drowsiness events.

### 🎙️ Hands-Free Voice Commands (`VoiceCommandControl`)
- **Browser Speech Recognition**: Control the system hands-free while driving.
- **Supported Commands**:
  - `"Start DriveSafe"` / `"Start Monitor"`: Activates driver monitoring.
  - `"Stop DriveSafe"` / `"Stop Monitor"`: Pauses driver monitoring.
  - `"Mute Audio"` / `"Unmute Audio"`: Toggles alarm sounds.
  - `"Open AI Coach"`: Launches the AI Safety Assistant.
  - `"Emergency SOS"`: Triggers emergency contact alerts.

### 🔊 Dual-Oscillator Siren & Speech Synthesis (`soundManager`)
- **Multi-Tone Piercing Sirens**: Dual-frequency square and sawtooth sound generator for severe drowsiness or speed violations.
- **Text-to-Speech (TTS)**: Voice confirmation for monitoring state transitions, speed warnings, and emergency dispatches.

### 🗺️ GPS SVG Mini-Map & Trip Log (`TripTracker`)
- **Live Vector Mini-Map**: Dynamic SVG route map depicting vehicle trajectory, current GPS coordinates, speed indicators, and alert location markers.
- **Trip Analytics**: Real-time logging of drive distance (km), duration, average speed, max speed, and fatigue event counts.

### ⏱️ Vehicle Speedometer & Limits (`Speedometer`)
- **Interactive Gauge HUD**: Radial speed meter with live speed simulation, manual speed adjustments, and customizable speed limit warnings.

### 📊 Fatigue & Safety Rating (`SafetyMetrics`)
- **0–100 Safety Score**: Calculated in real-time based on micro-sleeps, yawn frequency, speed violations, and continuous drive duration.
- **Continuous Drive Timer**: Reminds drivers when it is time to take a rest break.

### 🚨 Emergency SOS Dispatch (`EmergencySOS`)
- **One-Touch & Voice SOS**: Dispatch emergency notifications with current GPS location to saved emergency contacts.
- **Contact Management**: Add and manage custom emergency contacts with phone numbers and relationships.

### 🤖 Gemini AI Safety Coach (`AICoachModal`)
- **Personalized Advice**: Conversational AI assistant providing customized guidance on fatigue management, rest stop planning, and safe driving habits.

### 📱 Android APK Export Ready (`AndroidExportModal`)
- **Capacitor Integration Guide**: Comprehensive instructions, terminal commands, `capacitor.config.json`, `AndroidManifest.xml`, and `MainActivity.kt` code snippets to export the app to an Android APK via Android Studio.

---

## 🛠️ Tech Stack

- **Framework**: React 18 with TypeScript & Vite
- **Styling**: Tailwind CSS (Frosted Glassmorphism UI)
- **Animations**: Framer Motion (`motion/react`)
- **Icons**: Lucide React
- **Audio & Speech**: Web Audio API & Web Speech API (`SpeechRecognition`, `SpeechSynthesis`)
- **AI Service**: Google Gemini API (`@google/genai`)

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm installed

### Installation & Run

1. **Clone the repository and install dependencies**:
   ```bash
   npm install
   ```

2. **Set up Environment Variables**:
   Create a `.env` file at the project root with your Gemini API Key:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

3. **Start the Development Server**:
   ```bash
   npm run dev
   ```

4. **Build for Production**:
   ```bash
   npm run build
   ```

---

## 📱 Android APK Export with Capacitor

To build an Android APK from this project:

```bash
# 1. Install Capacitor dependencies
npm install @capacitor/core @capacitor/cli @capacitor/android

# 2. Initialize Capacitor
npx cap init DriveSafeAI com.drivesafe.ai --web-dir dist

# 3. Build production web bundle & add Android platform
npm run build
npx cap add android
npx cap sync android

# 4. Open in Android Studio to build APK
npx cap open android
```

---

## 🔒 Privacy & Safety
- Camera streams and voice recognition process locally in browser memory.
- Optional frame snapshots sent to Gemini API are strictly used for live safety observations.

---

## 📄 License
MIT License

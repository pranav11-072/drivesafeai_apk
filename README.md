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

## 💻 How to Run in Visual Studio Code (VS Code)

### Step 1: Open Project in VS Code
1. Launch **Visual Studio Code**.
2. Click **File > Open Folder...** (or `Ctrl+K Ctrl+O` / `Cmd+O`).
3. Select the project root folder.

### Step 2: Open Integrated Terminal
- Press **`Ctrl + ~`** (or go to **Terminal > New Terminal** in the top menu bar).

### Step 3: Install Dependencies
In the VS Code terminal, run:
```bash
npm install
```

### Step 4: Configure `.env` File
Create a new file named `.env` in the root folder and add your Gemini API key:
```env
GEMINI_API_KEY=your_gemini_api_key_here
```

### Step 5: Start the App
In the terminal, run:
```bash
npm run dev
```

### Step 6: View in Browser
Open your browser and navigate to:
```
http://localhost:3000
```

> **Tip:** You can also press **`F5`** or go to the **Run & Debug** tab in VS Code and click **"Dev (Full Stack Express + Vite)"** to launch with debugger support!

---

## 📱 Mobile APK & Installation Options

### Option A: Local Build with Capacitor & Android Studio
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

### Option B: Alternatives Without Android Studio

1. **PWABuilder.com (Cloud APK Generation - 1 Minute)**:
   - Deploy your built web app to Vercel, Netlify, or Cloud Run.
   - Enter your URL into [PWABuilder.com](https://www.pwabuilder.com/).
   - Download the generated `.apk` and Google Play Store package (`.aab`) automatically!

2. **PWA "Add to Home Screen" (Direct Mobile Installation)**:
   - Open your deployed URL on any Android device in Chrome or Edge.
   - Tap **⋮ (Menu) > Add to Home Screen** or **Install App**.
   - Runs full-screen with offline support, camera access, speech recognition, and geolocation.

3. **GitHub Actions Cloud CI/CD**:
   - Push your code to GitHub with a `.github/workflows/android.yml` action.
   - GitHub's cloud runners execute `./gradlew assembleDebug` and automatically attach the downloadable `.apk` file to your GitHub repository artifacts.

4. **Command Line Build (No Studio GUI)**:
   - Install Android Command Line Tools / SDK directly.
   - Run `./gradlew assembleDebug` inside the `android/` directory to output `android/app/build/outputs/apk/debug/app-debug.apk`.

---

## 🔒 Privacy & Safety
- Camera streams and voice recognition process locally in browser memory.
- Optional frame snapshots sent to Gemini API are strictly used for live safety observations.

---

## 📄 License
MIT License

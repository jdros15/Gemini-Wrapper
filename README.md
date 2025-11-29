# Gemini Wrapper

<div align="center">

![Gemini Wrapper](build/icon.png)

**A powerful, native Windows desktop client for Google Gemini AI**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Electron](https://img.shields.io/badge/Electron-32.0.0-47848F?logo=electron)](https://www.electronjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0.0-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.2.0-61DAFB?logo=react)](https://reactjs.org/)

</div>

## 🌟 Features

### 🚀 Quick Access
- **Global Hotkeys**: Instant access to Gemini from anywhere with customizable keyboard shortcuts
  - Default: `Alt+G` for quick chat window
  - Default: `Ctrl+N` for new chat in main window
- **System Tray Integration**: Always running in the background, ready when you need it
- **Quick Window**: Lightweight, always-on-top mini window for rapid queries

### 🎨 Seamless Experience
- **Native Windows Integration**: Feels like a native Windows application
- **Single Instance**: Prevents multiple instances from running simultaneously
- **Auto-Start**: Optional launch on system startup (minimized or visible)
- **Persistent Sessions**: Your conversations are saved and restored automatically

### ⚙️ Customization
- **Configurable Hotkeys**: Set your preferred keyboard shortcuts
- **Window Preferences**: Choose startup behavior and window settings
- **Auto-Reset Timer**: Automatically reset conversations after a specified time
- **Always-on-Top**: Keep the quick window above other applications

## 📸 Screenshots

*(Add screenshots of your application here)*

## 🔧 Installation

### Pre-built Binaries

1. Download the latest release from the [Releases](https://github.com/yourusername/gemini-wrapper/releases) page
2. Run the installer (`Gemini-Wrapper-Setup-1.0.0.exe`)
3. Follow the installation wizard
4. Launch Gemini Wrapper from the Start Menu or Desktop shortcut

### Build from Source

#### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- [npm](https://www.npmjs.com/) (comes with Node.js)
- Windows 10/11

#### Steps

```bash
# Clone the repository
git clone https://github.com/yourusername/gemini-wrapper.git
cd gemini-wrapper

# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build
```

The built application will be available in the `release` directory.

## 🎯 Usage

### First Launch
1. Launch the application
2. The main window will open with Google Gemini
3. Log in to your Google account if prompted
4. Start chatting with Gemini!

### Quick Window
- Press `Alt+G` (or your custom hotkey) to toggle the quick chat window
- Type your query and get instant responses
- The window stays on top of other applications for easy access

### Settings
- Click the settings icon in the system tray
- Configure:
  - Global hotkeys
  - Startup behavior
  - Window preferences
  - Auto-reset timer

### System Tray
Right-click the system tray icon to:
- Open main window
- Toggle quick window
- Access settings
- Quit the application

## 🏗️ Architecture

### Project Structure

```
gemini-wrapper/
├── app/
│   ├── main/           # Electron main process
│   │   ├── index.ts    # Application entry point
│   │   ├── windows.ts  # Window management
│   │   ├── tray.ts     # System tray integration
│   │   ├── shortcuts.ts # Global hotkey registration
│   │   └── menu.ts     # Application menu
│   ├── renderer/       # React UI
│   │   ├── Settings.tsx
│   │   └── components/
│   ├── preload/        # Preload scripts for IPC
│   ├── config/         # Settings management
│   ├── common/         # Shared types and utilities
│   └── resources/      # Static assets
├── build/              # Build assets (icons, installer scripts)
├── dist/               # Compiled application
└── release/            # Production builds

```

### Tech Stack

- **Framework**: [Electron](https://www.electronjs.org/) - Cross-platform desktop framework
- **UI**: [React](https://reactjs.org/) - Component-based UI library
- **Language**: [TypeScript](https://www.typescriptlang.org/) - Type-safe JavaScript
- **Build Tool**: [Vite](https://vitejs.dev/) - Fast build tool and dev server
- **Bundler**: [electron-builder](https://www.electron.build/) - Package and build
- **Validation**: [Zod](https://zod.dev/) - TypeScript-first schema validation

### Key Features Implementation

#### Global Hotkeys
Uses Electron's `globalShortcut` API to register system-wide keyboard shortcuts that work even when the app is in the background.

#### Single Instance Lock
Implements `app.requestSingleInstanceLock()` to ensure only one instance runs at a time, focusing the existing window when a second launch is attempted.

#### Custom Protocol
Registers a `gemini-resource://` protocol handler to serve local resources securely within the Gemini web view.

## 🔐 Privacy & Security

- **Automatic Watermark Removal**: Downloaded images are automatically processed to remove watermarks, all done locally on your device using advanced ML models
- **No Data Collection**: This application does not collect or transmit any user data
- **Session Persistence**: Uses Electron's session partitioning for isolated storage
- **Secure Settings**: Settings are stored locally in your user data directory

## ⚙️ Configuration

Settings are stored in JSON format at:
```
%APPDATA%/gemini-electron-wrapper/settings.json
```

### Available Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `quickWindowHotkey` | string | `Alt+G` | Hotkey to toggle quick window |
| `newChatHotkey` | string | `Ctrl+N` | Hotkey for new chat |
| `runOnStartup` | boolean | `true` | Launch on Windows startup |
| `startMinimized` | boolean | `true` | Start minimized to tray |
| `quickWindowAlwaysOnTop` | boolean | `true` | Keep quick window on top |
| `autoResetTimer` | number | `5` | Minutes before auto-reset (0 = disabled) |

## 🛠️ Development

### Development Mode

```bash
# Run with hot reload
npm run dev
```

This starts:
- TypeScript compiler in watch mode
- Vite dev server for the renderer
- Electron in development mode

### Building

```bash
# Compile TypeScript and build renderer
npm run compile

# Full production build
npm run build
```

### Project Scripts

- `npm run dev` - Start development environment
- `npm run dev:tsc` - TypeScript compiler in watch mode
- `npm run dev:main` - Run Electron in development
- `npm run dev:renderer` - Start Vite dev server
- `npm run compile` - Compile TypeScript
- `npm run build` - Build production application

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Guidelines

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Google Gemini](https://gemini.google.com/) - The AI powering this application
- [Electron](https://www.electronjs.org/) - For making cross-platform desktop apps possible
- [ONNX Runtime](https://onnxruntime.ai/) - Cross-platform ML inference

## ⚠️ Disclaimer

This is an unofficial desktop client for Google Gemini. It is not affiliated with, endorsed by, or in any way officially connected to Google LLC. Google and Gemini are trademarks of Google LLC.

---

<div align="center">

**If you find this project useful, please consider giving it a ⭐!**

Made with ❤️ by JD Ros

</div>

# Tanu-XAI Session Generator

> Official WhatsApp Session ID Generator for **Tanu-XAI Bot**, powered by Baileys Multi-File Auth and React.

---

## ⚡ Overview

Tanu-XAI Session Generator allows users to link their WhatsApp accounts securely via **Pairing Code** (8-digit code) or **QR Code** scanning, creating a self-contained, portable `SESSION_ID` (`Tanu-XAI~...`) for deploying Tanu-XAI WhatsApp bots.

### ✨ Key Features

- **Pairing Code Authentication**: Enter your phone number and link WhatsApp directly with an 8-character Crockford code without needing a second screen or camera.
- **Live QR Code Scanner**: Scan the dynamic QR code directly from your WhatsApp mobile app.
- **Zero-Database Multi-File Auth**: Utilizes ephemeral isolated multi-file auth directories (`temp/<sessionId>`), eliminating external SQL/Supabase dependencies.
- **Direct WhatsApp DM Delivery**: Automatically sends the generated raw session token and setup card to the user's private WhatsApp chat.
- **Base64 BufferJSON Session Export**: Self-contained credentials payload compatible with `@whiskeysockets/baileys` `useMultiFileAuthState`.
- **Single-Flight Lock & Concurrency**: Dedicated isolation per session request with protection against duplicate phone pairing conflicts.
- **Modern Futuristic UI**: Built with React, Vite, Tailwind CSS, and Framer Motion.
- **Unified Railway Deployment**: Express backend serves the optimized Vite React SPA in a single container service.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS v4, Framer Motion, Lucide Icons
- **Backend**: Node.js, Express, `@whiskeysockets/baileys ^6.7.9`, Pino, `@hapi/boom`, QRCode
- **Storage**: Ephemeral temporary filesystem (`./temp/`) with automatic post-auth cleanup
- **Deployment**: Railway (Nixpacks builder) / Cloud Run / VPS

---

## 🚀 How It Works

```text
User enters Phone (or selects QR)
               ↓
Backend creates isolated temp directory (temp/TXG_xxx)
               ↓
useMultiFileAuthState() + makeWASocket()
               ↓
requestPairingCode() (or real-time QR stream)
               ↓
User enters 8-character code in WhatsApp Linked Devices
               ↓
WhatsApp emits connection === 'open'
               ↓
creds.json is serialized with BufferJSON.replacer & Base64 encoded
               ↓
Session delivered to Web UI & user's WhatsApp DM
               ↓
Temporary auth directory is safely deleted
```

---

## 🤖 Consuming the Session in Tanu-XAI Bot

When deploying your Tanu-XAI Bot, set the environment variable:

```env
SESSION_ID="Tanu-XAI~eyJu..."
```

Inside your bot startup script, reconstruct the Baileys auth credentials:

```javascript
import makeWASocket, { BufferJSON, useMultiFileAuthState } from '@whiskeysockets/baileys';
import fs from 'fs';
import path from 'path';

async function startBot() {
  const sessionDir = path.join(process.cwd(), 'session');
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  // Decode Base64 session string into creds.json
  const rawSession = process.env.SESSION_ID.replace(/^Tanu-XAI~/i, '').trim();
  const credsJson = Buffer.from(rawSession, 'base64').toString('utf8');
  const creds = JSON.parse(credsJson, BufferJSON.reviver);

  fs.writeFileSync(path.join(sessionDir, 'creds.json'), JSON.stringify(creds, null, 2));

  // Initialize Baileys Multi-File Auth
  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
    browser: ['Tanu-XAI', 'Chrome', '20.0.04']
  });

  sock.ev.on('creds.update', saveCreds);
}
```

---

## ⚙️ Environment Variables

Copy `.env.example` to `.env`:

```env
PORT=3000
NODE_ENV=production
SESSION_PREFIX=Tanu-XAI~
BOT_NAME=Tanu-XAI
PAIRING_TIMEOUT_MS=300000
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
SESSION_RATE_LIMIT_MAX=10
```

---

## 📦 Local Development

```bash
# Install dependencies
npm install

# Build frontend
npm run build

# Start backend server
npm start
```

---

## 🚂 Railway Deployment

1. Connect your GitHub repository to Railway.
2. Railway detects `package.json` and uses the Nixpacks builder.
3. The build phase executes `npm run build` to generate `dist/`.
4. The deployment command executes `npm start` to run `node src/server.js` on Railway's assigned `$PORT`.

---

## 🔒 Security & Privacy

- **No Remote Database**: Sessions are never stored in a central database or shared storage.
- **Instant File Deletion**: Temporary credential files in `./temp/` are deleted upon successful session export or session expiry.
- **Redacted Logs**: Credentials, private keys, pairing codes, and phone numbers are redacted from server logs.

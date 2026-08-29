# Tanu Xai Session Generator

**WhatsApp Session Generator for the Tanu Xai Bot**

---

## Project Overview

This is **Phase 1** of the Tanu Xai project. This repository contains **ONLY** the WhatsApp Session Generator.

The main Tanu Xai WhatsApp bot will be built in a **separate repository** and deployed on Render.

### Purpose

This application provides a web-based interface to generate WhatsApp pairing code sessions. Users can:

1. Enter their WhatsApp phone number
2. Receive a pairing code
3. Link their device via WhatsApp
4. Have their authentication state securely stored in Supabase

The stored session can then be used by the future Tanu Xai main bot.

---

## Requirements

- Node.js >= 18.0.0
- Supabase account (free tier works)
- Railway account (for deployment)

---

## Baileys Version

This project uses **@whiskeysockets/baileys v7.0.0-rc14**.

Key APIs verified:
- `makeWASocket()` - Create WhatsApp socket
- `requestPairingCode(phoneNumber)` - Request pairing code (returns 8-character code)
- `AuthenticationState` interface - Custom auth state implementation
- Connection events via `sock.ev.on('connection.update')`
- Credentials updates via `sock.ev.on('creds.update')`

---

## Installation

### Local Development

```bash
# Clone the repository
git clone <repository-url>
cd Tanu-Xai-Session-Generator

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Edit .env and add your Supabase credentials
```

### Environment Variables

Create a `.env` file based on `.env.example`:

```env
PORT=3000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SESSION_NAMESPACE=tanu-xai
NODE_ENV=development
```

**Important:** Never commit `.env` to version control.

---

## Supabase Setup

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Wait for the database to be ready

### 2. Get Your Credentials

1. Go to **Settings** → **API**
2. Copy the **Project URL** → `SUPABASE_URL`
3. Copy the **service_role secret** → `SUPABASE_SERVICE_ROLE_KEY`

⚠️ **Security Warning:** The `service_role` key bypasses Row Level Security. Only use it in your backend server, never expose it to the frontend.

### 3. Run the SQL Schema

1. Go to **SQL Editor** in Supabase dashboard
2. Click **New Query**
3. Copy the contents of `supabase/schema.sql`
4. Paste and run the query

This creates three tables:
- `sessions` - Session lifecycle tracking
- `auth_credentials` - Baileys authentication credentials
- `auth_keys` - Signal protocol keys (pre-keys, sessions, etc.)

---

## Local Development

```bash
# Start the server
npm start

# Or with auto-reload
npm run dev
```

Open http://localhost:3000 in your browser.

---

## Pairing Code Process

### User Flow

1. **User enters phone number** on the website
2. **Server creates session** with unique ID (e.g., `TX_abc12345`)
3. **Server requests pairing code** from WhatsApp via Baileys
4. **Pairing code displayed** to user (format: `XXXX-XXXX`)
5. **User opens WhatsApp** on their phone
6. **User navigates to:** Settings → Linked Devices → Link a Device → Link with phone number
7. **User enters the code** shown on the website
8. **WhatsApp authenticates** the connection
9. **Server detects successful auth** and stores complete auth state in Supabase
10. **Website shows "Connected"** status

### Session Lifecycle States

```
CREATED
   ↓
REQUESTING_PAIRING_CODE
   ↓
WAITING_FOR_AUTH
   ↓
AUTHENTICATING
   ↓
CONNECTED ✓
```

Error/terminal states:
- `FAILED` - Authentication failed
- `LOGGED_OUT` - User logged out from WhatsApp
- `DISCONNECTED` - Connection closed
- `EXPIRED` - Session timed out (auto-cleanup after 7 days)

---

## API Reference

### Health Check

```http
GET /api/health
```

Response:
```json
{
  "status": "healthy",
  "service": "Tanu Xai Session Generator",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Start Session

```http
POST /api/session/start
Content-Type: application/json

{
  "phoneNumber": "+923001234567"
}
```

Response:
```json
{
  "success": true,
  "sessionId": "TX_abc12345"
}
```

### Request Pairing Code

```http
POST /api/session/:sessionId/pairing-code
```

Response:
```json
{
  "success": true,
  "pairingCode": "ABCD1234"
}
```

### Get Session Status

```http
GET /api/session/:sessionId/status
```

Response:
```json
{
  "sessionId": "TX_abc12345",
  "status": "connected",
  "phone": "***4567",
  "whatsappJid": "***4567@s.whatsapp.net",
  "whatsappName": "John Doe",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:01:00.000Z"
}
```

### Stop Session

```http
POST /api/session/:sessionId/stop
```

### List All Sessions

```http
GET /api/session/list
```

---

## Railway Deployment

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-repo-url>
git push -u origin main
```

### 2. Deploy on Railway

1. Go to [railway.app](https://railway.app)
2. Click **New Project**
3. Select **Deploy from GitHub repo**
4. Choose your repository
5. Railway will auto-detect Node.js

### 3. Configure Environment Variables

In Railway dashboard, go to **Variables** and add:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SESSION_NAMESPACE=tanu-xai
NODE_ENV=production
```

### 4. Set Start Command

Railway auto-detects `npm start`. Verify in **Settings** → **Start Command**:

```
npm start
```

### 5. Deploy

Railway will deploy automatically. Your app will be available at:
```
https://your-app.up.railway.app
```

---

## Security

### Implemented Security Measures

1. **Helmet.js** - Secure HTTP headers
2. **CORS** - Configured cross-origin policies
3. **Rate Limiting** - Prevent abuse (100 req/15min general, 10 sessions/hour)
4. **Input Validation** - Phone number validation
5. **Safe Logging** - Sensitive data redacted from logs
6. **No Credential Exposure** - Auth state never sent to browser
7. **Environment Variables** - Secrets not committed to git
8. **Graceful Shutdown** - Clean session cleanup on SIGTERM/SIGINT

### What's NEVER Exposed

- Signal keys
- Private keys
- Authentication credentials
- Supabase service role key
- Complete auth state
- Full phone numbers (masked as `***4567`)

---

## Troubleshooting

### "Failed to create session"

- Check Supabase credentials in `.env`
- Verify Supabase schema is applied
- Check server logs for specific error

### "Pairing code request failed"

- Ensure phone number includes country code (no leading 0)
- Check if WhatsApp account already has too many linked devices
- Verify internet connectivity

### "Session not found"

- Session may have expired (7-day cleanup)
- Session ID incorrect

### "Connection closed" or "Logged out"

- User may have logged out from WhatsApp
- Re-start the session generation process

### Database errors

- Verify Supabase project is active
- Check RLS policies allow service role access
- Ensure schema.sql was executed successfully

---

## Architecture Notes

### Why Supabase for Auth Storage?

Baileys requires persistent storage for:
- Authentication credentials (`creds`)
- Signal protocol keys (pre-keys, sessions, sender-keys)
- App state sync keys and versions
- Device mappings

Using Supabase ensures:
- **Persistence** - Survives server restarts/deployments
- **Scalability** - Handles concurrent key updates
- **Reliability** - Proper transaction handling
- **Future-proof** - Main bot can load existing sessions

### Custom SupabaseAuthState

We implement Baileys' `AuthenticationState` interface using Supabase:

```javascript
{
  creds: AuthenticationCreds,
  keys: {
    get(type, ids) => Promise<{ [id]: keyData }>,
    set(data) => Promise<void>
  }
}
```

Buffers are serialized to base64 for JSONB storage.

### Concurrency Handling

Keys are stored individually with composite unique constraints:
```sql
UNIQUE(session_id, key_type, key_id)
```

Upsert operations prevent race conditions during concurrent updates.

---

## Future: Tanu Xai Main Bot (Phase 2)

The main bot will be a **separate repository** deployed on **Render**.

It will:
1. Load existing auth state from Supabase
2. Connect to WhatsApp using stored credentials
3. Handle messages, commands, plugins
4. NOT include session generation (handled by this repo)

### Architecture Preview

```
Render
   ↓
Tanu Xai Main Bot
   ↓
Supabase (load existing auth state)
   ↓
WhatsApp (already authenticated)
```

---

## Project Structure

```
Tanu-Xai-Session-Generator/
│
├── src/
│   ├── server.js              # Main Express server
│   ├── config/
│   │   └── env.js             # Environment configuration
│   ├── routes/
│   │   ├── health.js          # Health check endpoint
│   │   └── sessions.js        # Session management API
│   ├── services/
│   │   ├── baileys.js         # Baileys WhatsApp integration
│   │   ├── sessionManager.js  # Session lifecycle management
│   │   └── supabase.js        # Supabase database service
│   ├── auth/
│   │   └── supabaseAuthState.js # Custom Baileys auth state
│   └── utils/
│       ├── logger.js          # Structured logging
│       └── phone.js           # Phone validation
│
├── public/
│   ├── index.html             # Web UI
│   ├── app.js                 # Frontend JavaScript
│   └── style.css              # Styling
│
├── supabase/
│   └── schema.sql             # Database schema
│
├── .env.example               # Environment template
├── .gitignore                 # Git ignore rules
├── package.json               # Dependencies
├── railway.json               # Railway config
└── README.md                  # This file
```

---

## Credits

- **Owner:** Arman HTX
- **Owner's Owner:** Tanu Darling
- **Technology:** Node.js + Baileys + Supabase + Express

---

## License

ISC

---

## Support

For issues related to:
- **Session Generator:** This repository
- **Main Bot (future):** Separate Tanu-Xai repository

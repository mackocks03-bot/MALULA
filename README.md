# NEWHOPE-CHAT v2.0

React + Express rebuild of the NEWHOPE-CHAT affiliate community platform.

## Tech Stack

- **Frontend:** React 18, Vite, React Router
- **Backend:** Express.js (API + static serving)
- **Database:** Firebase Realtime Database + Firebase Auth

## Getting Started

```bash
# Install all dependencies
npm run install:all

# Run development (React on :5173, Express on :5000)
npm run dev

# Production build
npm run build
npm start
```

## Project Structure

```
├── client/          # React frontend (Vite) — all pages are .jsx
│   ├── src/
│   │   ├── components/   # Shared UI components
│   │   ├── contexts/     # Auth, Theme, Language, Toast
│   │   ├── pages/        # React pages (replaces old HTML pages/)
│   │   ├── services/     # Firebase services
│   │   └── utils/        # Helpers, i18n, cache
│   └── public/
├── functions/       # Firebase Cloud Functions (activation + commissions + deposits)
│   ├── index.js
│   └── lib/
├── server/          # Express server (PalmPesa API + payment queue)
└── package.json     # Root scripts
```

## Features

- User auth (login, register, activation)
- Dashboard with earnings, referrals, quick actions
- Daily tasks, wallet, withdrawals
- Global chat, lucky spin, weekly challenge
- Affiliate/referral system (3-level MLM)
- Shop marketplace
- Admin panel
- Multi-language (EN, SW, FR)
- Light/dark theme

## PalmPesa Deposits (Tanzania)

Tanzanian users (`country: TZ`) can deposit to shop balance automatically via **PalmPesa** USSD push on the Wallet page.

1. Copy `server/.env.example` to `server/.env`
2. Add your PalmPesa API token from the [PalmPesa dashboard](https://palmpesa.drmlelwa.co.tz/)
3. Add `FIREBASE_API_KEY` (same as `client/src/services/firebase-config.js`)
4. Optional but recommended: set `FIREBASE_SERVICE_ACCOUNT_JSON` for server-side balance crediting

```bash
# server/.env
PALMPESA_API_KEY=your_api_key_here
PALMPESA_USER_ID=your_palmpesa_user_id
PALMPESA_VENDOR=TILL61103867
FIREBASE_API_KEY=your_firebase_web_api_key
```

When PalmPesa is configured, TZ users see **Pay with PalmPesa** on Wallet and **Pay & Activate with PalmPesa** on the Activation page — no manual transaction ID or admin approval needed.

## Firebase Cloud Functions (commissions & balances)

Heavy post-payment work runs in **Cloud Functions** (not the browser or Express):

| Function | Trigger | Does |
|----------|---------|------|
| `processActivationPayment` | `activationPayments/{id}` when PalmPesa completes or admin approves | Activates user, welcome bonus, **3-level MLM commissions** |
| `processPalmpesaDeposit` | `palmpesaPending/{orderId}` when deposit completes | Credits shop balance |

### Deploy Cloud Functions

```bash
npm run install:all
firebase login
npm run deploy:functions
```

Requires Firebase CLI (`npm i -g firebase-tools`) and Blaze plan for RTDB triggers.

Express only initiates PalmPesa STK push and **queues** completion in Realtime Database; Cloud Functions process commissions reliably and idempotently.


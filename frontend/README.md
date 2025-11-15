# TradeFX - Web3 Trading Platform

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Then update the following values in `.env`:

#### Required Variables:

- **VITE_THIRDWEB_CLIENT_ID**: Get your client ID from [Thirdweb Dashboard](https://thirdweb.com/dashboard)
  1. Go to https://thirdweb.com/dashboard
  2. Create a new project or select existing one
  3. Copy your Client ID

#### Optional Variables (for Circle Wallet):

- **CIRCLE_API_KEY**: Get your API key from [Circle Developer Console](https://console.circle.com)
  - **Note**: This API key is used on your backend server, not in the frontend
  - The frontend communicates with your backend API which uses this key
- **VITE_GOOGLE_CLIENT_ID**: Google OAuth Client ID (for Google social login)
- **VITE_APPLE_FIREBASE_CONFIG**: Firebase configuration for Apple Sign In (JSON string)
  - Apple login uses Firebase configuration
  - Get this from [Firebase Console](https://console.firebase.google.com/)
  - Should be a JSON string of your Firebase config object
  - Example: `{"apiKey":"...","authDomain":"...","projectId":"...","storageBucket":"...","messagingSenderId":"...","appId":"..."}`
  
#### Optional Variables (for Onramp):

- **VITE_ARC_API_KEY**: Get your API key from [Arc](https://arc.market)
  1. Sign up at https://arc.market
  2. Navigate to API settings
  3. Generate and copy your API key

### 3. Run Development Server
```bash
npm run dev
```

## Features

### Wallet Options

#### Thirdweb Embedded Wallets
- **Email Authentication**: Sign in with email
- **Social Login**: Google and Apple authentication
- **Passkey Support**: Passwordless authentication using passkeys
- Powered by Thirdweb's embedded wallet infrastructure

#### Circle User-Controlled Wallets
- **PIN Authentication**: Secure PIN-based wallet access
- **Email Authentication**: Email-based wallet creation
- **Social Login**: Google and Apple authentication
- **User-Controlled**: Users maintain full control of their keys
- Requires backend API implementation (see Backend Setup below)

### Onramp Integration
- **Buy USDT with EUR**: Purchase USDT directly with Euros
- **Arc Payment Gateway**: Secure fiat-to-crypto onramp
- **Ethereum Network**: USDT on Ethereum mainnet

## Project Structure
```
frontend/
├── src/
│   ├── components/
│   │   ├── WalletAuth.jsx      # Wallet connection & authentication
│   │   └── OnrampPayment.jsx   # USDT purchase with EUR
│   ├── App.jsx                  # Main application component
│   └── main.jsx                 # Entry point with ThirdwebProvider
├── .env                         # Environment variables (not in git)
├── .env.example                 # Environment variables template
└── package.json
```

## Usage

1. **Connect Wallet**: Click "Connect Wallet" and choose your preferred authentication method (Email, Google, Apple, or Passkey)
2. **Buy USDT**: Navigate to "Buy USDT" tab, enter amount in EUR, and complete purchase through Arc gateway

## Technologies Used
- React + Vite
- Thirdweb SDK (Embedded Wallets)
- Arc (Onramp Integration)
- Ethers.js

## Circle Wallet Backend Setup

The Circle wallet feature requires backend API endpoints that use your Circle API key. The frontend makes requests to these endpoints:

### Required Backend Endpoints:

1. **GET `/api/circle/get-app-id`**
   - Returns: `{ appId: string }`
   - Used for social login initialization

2. **POST `/api/circle/initialize-wallet`**
   - Body: `{ method: 'pin' | 'email' }`
   - Returns: `{ appId: string, userToken: string, encryptionKey: string, challengeId: string }`
   - This endpoint should:
     1. Create a user (if needed)
     2. Create a session token (returns userToken, encryptionKey)
     3. Initialize user account and create wallet (returns appId, challengeId)
   - See [Circle Documentation](https://developers.circle.com/interactive-quickstarts/user-controlled-wallets) for API details

3. **POST `/api/circle/create-wallet`**
   - Body: `{ userToken: string }`
   - Returns: `{ challengeId: string }`
   - Used for creating additional wallets or after social login

### Backend Implementation Example:

Your backend should use the Circle API with your API key. Example flow:

```javascript
// 1. Create user
POST https://api.circle.com/v1/w3s/users
Headers: { Authorization: `Bearer ${CIRCLE_API_KEY}` }
Body: { userId: "unique-user-id" }

// 2. Create session token
POST https://api.circle.com/v1/w3s/user/sessions
Headers: { Authorization: `Bearer ${CIRCLE_API_KEY}` }
Body: { userId: "unique-user-id" }
// Returns: { userToken, encryptionKey }

// 3. Initialize user and create wallet
POST https://api.circle.com/v1/w3s/user/initialize
Headers: { Authorization: `Bearer ${CIRCLE_API_KEY}`, "X-User-Token": userToken }
Body: { idempotencyKey: "unique-key", blockchains: ["ETH"] }
// Returns: { challengeId }
```

For complete implementation details, see the [Circle User-Controlled Wallets Quickstart](https://developers.circle.com/interactive-quickstarts/user-controlled-wallets).

## Support
For issues or questions, please refer to:
- [Thirdweb Documentation](https://portal.thirdweb.com/)
- [Circle Documentation](https://developers.circle.com/)
- [Arc Documentation](https://docs.arc.market/)

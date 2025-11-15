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

- **VITE_CIRCLE_API_KEY**: Get your API key from [Circle Developer Console](https://console.circle.com)
  1. Go to https://console.circle.com
  2. Navigate to API settings
  3. Generate and copy your API key
  4. **Note**: For production, consider using a backend proxy to keep your API key secure
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
- **API Key Based**: Uses Circle API key directly (no backend required for basic setup)

### Onramp Integration
- **Buy USDT with EUR**: Purchase USDT directly with Euros
- **Arc Payment Gateway**: Secure fiat-to-crypto onramp
- **Ethereum Network**: USDT on Ethereum mainnet

### Cross-Chain Bridge (CCTP)
- **Bridge USDC/EURC to Arc**: Transfer USDC and EURC from supported networks to Arc network
- **Circle CCTP Protocol**: Uses Circle's Cross-Chain Transfer Protocol for secure transfers
- **Fast Transfers**: Complete transfers in under 30 seconds with Fast Transfer option
- **Supported Networks**: Ethereum, Base, Arbitrum, Optimism, Polygon, Avalanche
- **User-Controlled Wallets**: Works with both Thirdweb and Circle user-controlled wallets
- Powered by [Circle Bridge Kit](https://developers.circle.com/bridge-kit) and [CCTP](https://developers.circle.com/cctp)

## Project Structure
```
frontend/
├── src/
│   ├── components/
│   │   ├── WalletAuth.jsx        # Wallet connection & authentication
│   │   ├── BridgeInterface.jsx   # Cross-chain bridge to Arc network
│   │   └── OnrampPayment.jsx     # USDT purchase with EUR
│   ├── App.jsx                    # Main application component
│   └── main.jsx                   # Entry point with ThirdwebProvider
├── .env                           # Environment variables (not in git)
├── .env.example                   # Environment variables template
└── package.json
```

## Usage

1. **Connect Wallet**: Click "Connect Wallet" and choose your preferred authentication method (Email, Google, Apple, or Passkey)
2. **Bridge to Arc**: Navigate to "Bridge to Arc" tab, select source chain and token (USDC/EURC), enter amount, and bridge to Arc network
3. **Buy USDT**: Navigate to "Buy USDT" tab, enter amount in EUR, and complete purchase through Arc gateway

## Technologies Used
- React + Vite
- Thirdweb SDK (Embedded Wallets)
- Circle Bridge Kit & CCTP (Cross-Chain Transfers)
- Arc (Onramp Integration)
- Viem (EVM interactions)
- Ethers.js

## Circle Wallet Setup

The Circle wallet feature uses the Circle API key directly to make API calls. The frontend handles all Circle API interactions:

### How It Works:

1. **Get App ID**: Uses API key to fetch app configuration from Circle API
2. **Create User**: Creates a new user in Circle's system
3. **Create Session**: Gets userToken and encryptionKey for SDK authentication
4. **Initialize Wallet**: Creates wallet and gets challenge ID
5. **Execute Challenge**: Uses Circle SDK to complete wallet setup

### API Calls Made by Frontend:

```javascript
// 1. Get app ID
GET https://api.circle.com/v1/w3s/config/entity
Headers: { Authorization: `Bearer ${VITE_CIRCLE_API_KEY}` }

// 2. Create user
POST https://api.circle.com/v1/w3s/users
Headers: { Authorization: `Bearer ${VITE_CIRCLE_API_KEY}` }
Body: { userId: "unique-user-id" }

// 3. Create session token
POST https://api.circle.com/v1/w3s/user/sessions
Headers: { Authorization: `Bearer ${VITE_CIRCLE_API_KEY}` }
Body: { userId: "unique-user-id" }
// Returns: { userToken, encryptionKey }

// 4. Initialize user and create wallet
POST https://api.circle.com/v1/w3s/user/initialize
Headers: { Authorization: `Bearer ${VITE_CIRCLE_API_KEY}`, "X-User-Token": userToken }
Body: { idempotencyKey: "unique-key", blockchains: ["ETH"] }
// Returns: { challengeId }
```

### Security Note:

⚠️ **For Production**: While the current implementation uses the API key directly in the frontend, for production applications, consider:
- Using a backend proxy to keep your API key secure
- Implementing rate limiting and request validation
- Using environment-specific API keys

For complete implementation details, see the [Circle User-Controlled Wallets Quickstart](https://developers.circle.com/interactive-quickstarts/user-controlled-wallets).

## Bridge Kit Configuration

The Bridge Interface uses Circle's Bridge Kit SDK which works with EIP1193-compatible wallet providers (MetaMask, WalletConnect, etc.). No additional environment variables are required for the bridge functionality - it works directly with connected wallets.

### Bridge Features:
- **Fast Transfer**: Transfers complete in under 30 seconds (uses Circle's Fast Transfer Allowance)
- **Standard Transfer**: Alternative option with standard finality times (15-19 minutes for most chains)
- **Supported Tokens**: USDC (primary), EURC (limited support - verify with Circle documentation)
- **Destination**: Arc network (user's connected wallet address)

### How It Works:
1. User connects their wallet (Thirdweb or Circle wallet)
2. User selects source chain (Ethereum, Base, Arbitrum, etc.)
3. User selects token (USDC or EURC)
4. User enters amount to bridge
5. Bridge Kit handles:
   - Burning tokens on source chain
   - Getting attestation from Circle's Attestation Service
   - Minting tokens on Arc network
   - All transaction signing and execution

For more details, see:
- [Circle Bridge Kit Documentation](https://developers.circle.com/bridge-kit)
- [CCTP Documentation](https://developers.circle.com/cctp)
- [Arc Network Documentation](https://docs.arc.network/)

## Support
For issues or questions, please refer to:
- [Thirdweb Documentation](https://portal.thirdweb.com/)
- [Circle Documentation](https://developers.circle.com/)
- [Circle Bridge Kit Documentation](https://developers.circle.com/bridge-kit)
- [CCTP Documentation](https://developers.circle.com/cctp)
- [Arc Documentation](https://docs.arc.market/)

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

- **VITE_THIRDWEB_CLIENT_ID**: Get your client ID from [Thirdweb Dashboard](https://thirdweb.com/dashboard)
  1. Go to https://thirdweb.com/dashboard
  2. Create a new project or select existing one
  3. Copy your Client ID

- **VITE_ARC_API_KEY**: Get your API key from [Arc](https://arc.market)
  1. Sign up at https://arc.market
  2. Navigate to API settings
  3. Generate and copy your API key

### 3. Run Development Server
```bash
npm run dev
```

## Features

### Embedded Wallets
- **Email Authentication**: Sign in with email
- **Social Login**: Google and Apple authentication
- **Passkey Support**: Passwordless authentication using passkeys
- Powered by Thirdweb's embedded wallet infrastructure

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

## Support
For issues or questions, please refer to:
- [Thirdweb Documentation](https://portal.thirdweb.com/)
- [Arc Documentation](https://docs.arc.market/)

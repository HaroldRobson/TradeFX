# Circle Wallet Backend API Setup

Backend REST API implementation for Circle User-Controlled Wallets using Python (FastAPI).

## Quick Start

See [backend/README.md](./backend/README.md) for detailed setup instructions.

**Quick start:**
```bash
cd backend
pip install -r requirements.txt
export CIRCLE_API_KEY="your-key"
export CIRCLE_APP_ID="your-app-id"
python app.py
```

## Required Environment Variables

- `CIRCLE_API_KEY`: Your Circle API key from [Circle Developer Console](https://console.circle.com)
- `CIRCLE_APP_ID`: Your Circle App ID from [Circle Developer Console](https://console.circle.com)

## API Endpoints

The backend provides the following endpoints:

1. **GET `/api/circle/get-app-id`**
   - Returns: `{ "appId": "your-app-id" }`
   - Used for social login initialization

2. **POST `/api/circle/initialize-wallet`**
   - Body: `{ "method": "pin" | "email" }`
   - Returns: `{ "appId": "...", "userToken": "...", "encryptionKey": "...", "challengeId": "..." }`
   - Creates user, session, and initializes wallet

3. **POST `/api/circle/create-wallet`**
   - Body: `{ "userToken": "..." }`
   - Returns: `{ "challengeId": "..." }`
   - Creates wallet challenge for existing user (after social login)

## Frontend Integration

Update your frontend's `vite.config.js` to proxy API requests:

```javascript
export default {
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000', // Python FastAPI default port
        changeOrigin: true,
      },
    },
  },
}
```

Or configure your frontend to make requests directly to the backend URL.

## Port

The backend runs on `http://localhost:8000` by default (configurable when running uvicorn).


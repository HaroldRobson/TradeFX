# Frontend Setup Guide

Follow these steps to get the frontend running locally.

---

## 1. Create Your `.env` File

In the **same directory as this `FRONTEND_SETUP.md`**, create a file named `.env`.

Copy **exactly** this into the `.env` file:

```


# Thirdweb Configuration (Required)
# Get your Client ID from https://thirdweb.com/dashboard
VITE_THIRDWEB_CLIENT_ID=167c662fec03996fcab78575d7f75de7

# Circle API Configuration (Optional - for Circle Wallet)
# Get your API key from Circle Developer Console: https://console.circle.com
# Note: The API key is used on the backend. The frontend communicates with your backend API.
VITE_CIRCLE_API_KEY=TEST_API_KEY:df15f06506d86558ef2a39a0d42cedd5:cadaac05caeff0837769c65da195f259

# Social Login Configuration (Optional - for Circle Wallet)
# Google OAuth Client ID
VITE_GOOGLE_CLIENT_ID=540027820320-78f8n7fvfhhksisign2gqql7balnlsfm.apps.googleusercontent.com

# Arc Payment Gateway (Optional - for Onramp)
VITE_ARC_API_KEY=ydc64bf10-b89e-4d22-bb51-04bdaad489b6

TRADE_FX_ADDRESS=0x8D3b9A10d10e3932fb74B621b537cf2412d965E6

VITE_TRADE_FX_ADDRESS=0x8D3b9A10d10e3932fb74B621b537cf2412d965E6

VITE_USDC_ADDRESS=0x3600000000000000000000000000000000000000

VITE_CONTRACT_ADDRESS=0x8D3b9A10d10e3932fb74B621b537cf2412d965E6

CONTRACT_ADDRESS=0x8D3b9A10d10e3932fb74B621b537cf2412d965E6

VITE_EURC_ADDRESS=0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a



```

---

## 2. Install Dependencies

Run:

```bash
npm install
```

---

## 3. Start the Development Server

Run:

```bash
npm run dev
```

---

## 4. Open the App in Your Browser

Visit:

```
http://localhost:3000
```

(Or whichever port your dev server specifies.)

---

You're all set! 🚀

```

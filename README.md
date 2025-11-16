
# **TradeFX — On-Chain FX Perpetual Futures (Encode x Arc Hackathon)**

### Perpetual Futures Trading for Stablecoins on Arc

**Presentation:** [https://www.canva.com/design/DAG42y7zucA/9WgpjpgAGjZIRzZ46j9o4Q/edit](https://www.canva.com/design/DAG42y7zucA/9WgpjpgAGjZIRzZ46j9o4Q/edit)
**Demo Video:** [https://youtu.be/24fh6lGwCDY](https://youtu.be/24fh6lGwCDY)

---

## **Overview**

**TradeFX** is a fully on-chain **FX perpetual futures protocol**, designed specifically for **stablecoins**, built for the **Arc Network** as part of the **Encode x Arc Hackathon**.

It combines:

* 🏦 **A complete on-chain margin trading engine**
* 💸 **Time-dependent lending fees and dynamic interest accumulation**
* ⚖️ **Collateralised perpetual futures with liquidation mechanics**
* 💧 **Liquidity provider tokens that accumulate protocol yield**
* 🛡️ **No run-on-the-bank safeguards**
* 🌉 **Seamless bridging via Circle CCTP**
* 🔐 **Account-abstracted wallets via Circle User-Controlled Wallets**
* 📡 **Frontend DApp with websockets-driven live price feed + contract interaction**

TradeFX integrates deep stablecoin logic, dynamic accounting, and real-time liquidity management across a novel FXEngine architecture tailored for Arc.

---

# **Directory Structure**

```
TradeFX/
├── backend/      # Python backend for Circle User-Controlled Wallet authentication
├── frontend/     # React + Thirdweb DApp: bridging, wallet auth, contract interaction, UI
└── contracts/    # Solidity protocol: TradeFX.sol, FXEngine.sol + utils
```

## **1. `backend/` — Circle User Wallet Authentication**

A lightweight Python backend used solely for **Circle User-Controlled Wallet** authentication flow:

* Email login
* PIN setup
* Google / Apple auth
* Session + challenge management
* Purely wallet-side — **no protocol logic happens here**

This enables **account abstraction** for users trading on your DApp.

---

## **2. `frontend/` — React DApp + BridgeKit + Smart Contracts**

A full-featured trading interface built with:

* **React + Vite**
* **Thirdweb wallets** (email, social, passkey)
* **Circle user-controlled wallets**
* **Circle BridgeKit (CCTP)** for bridging USDC/EURC → Arc
* **Contract interaction** for:

  * Providing LP liquidity
  * Opening/closing perpetual futures
  * Triggering liquidation flows
* **Websockets price feed** with live graph
* **FXEngine simulator integration**
* **Supports traders AND LPs**

The DApp is designed for real on-chain trading and deep stablecoin accounting.

---

## **3. `contracts/src` — Solidity Protocol (Core of TradeFX)**

Contains all on-chain logic:

### **`TradeFX.sol` — Main Protocol (700+ lines)**

A complete perpetual futures engine:

* Margin accounting
* Collateral tracking
* Open interest and position rebalancing
* LP share dilution + interest accumulation
* Liquidation incentives
* Preventative *no run-on-the-bank* logic
* Time-dependent lending fees
* Internal stablecoin conversions for FX exposure

**Deployed on Arc:**
`0x8D3b9A10d10e3932fb74B621b537cf2412d965E6`

---

### **`FXEngine.sol` — Arc FXEngine Simulator**

A reconstruction of the upcoming **Arc native FXEngine**, required by TradeFX.

* Not an AMM
* Simulates the *zero-friction stablecoin conversion environment* Arc will provide
* TradeFX interacts with it frequently to rebalance liquidity
* Enables real multi-currency liquidity across stablecoins

**Deployed on Arc:**
`0xb26D2BdEfaF2A8ac6509cdEF04575441698ED0B8`

---

# ⭐ **Key Innovations**

## **🔹 Fully On-Chain FX Perpetual Futures**

TradeFX allows leveraged FX positions using only stablecoins.
All accounting is done entirely on-chain with transparent ledger-style logic.

---

## **🔹 Stablecoin Liquidity Providers (LPs)**

LPs deposit into one unified liquidity pool.
Their LP tokens automatically:

* Accrue lending fees
* Accumulate trading fees
* Maintain multi-asset stablecoin ratios through FXEngine interactions

---

## **🔹 Liquidation Protocol**

* Third-party liquidators
* Incentive-based system
* LP funds protected via safety buffer logic
* No bank-run scenarios (preventative mechanisms included)

---

## **🔹 Circle CCTP Integration**

Bridge USDC/EURC directly to Arc from:

* Ethereum
* Base
* Arbitrum
* Optimism
* Polygon
* Avalanche

Fast transfers typically complete in **under 30 seconds**.

---

## **🔹 Circle User-Controlled Wallets**

Full account abstraction:

* Email login
* PIN-based control
* Google & Apple auth
* Users fully control private keys
* Backend handles authentication only

---

## **🔹 FXEngine Simulator**

To demonstrate how Arc revolutionizes FX markets:

* Frequent zero-fee stablecoin rebalancing
* Efficient liquidity allocation
* Endless multi-stablecoin arbitrage prevention
* Critical dependency of TradeFX

TradeFX is **not possible on standard EVM chains** — Arc’s architecture makes it viable.

---

# **Deployed Contracts**

| Contract         | Purpose                              | Address                                      |
| ---------------- | ------------------------------------ | -------------------------------------------- |
| **TradeFX.sol**  | Perpetual futures engine (700 lines) | `0x8D3b9A10d10e3932fb74B621b537cf2412d965E6` |
| **FXEngine.sol** | Arc FXEngine simulator               | `0xb26D2BdEfaF2A8ac6509cdEF04575441698ED0B8` |

---

# **Run Locally**

### **Frontend**

```bash
cd frontend
# follow FRONTEND_SETUP.md
npm install
npm run dev
```

Visit:
`http://localhost:3000`

### **Backend**

```
go to backend/BACKEND_SETUP.md for details.
```

---

# **Hackathon Submission Links**

📊 **Presentation:**
[https://www.canva.com/design/DAG42y7zucA/9WgpjpgAGjZIRzZ46j9o4Q/edit](https://www.canva.com/design/DAG42y7zucA/9WgpjpgAGjZIRzZ46j9o4Q/edit)

🎥 **Demo Video:**
[https://youtu.be/24fh6lGwCDY](https://youtu.be/24fh6lGwCDY)

---

# **Summary**

TradeFX demonstrates:

* New FX market primitives
* On-chain multi-stablecoin liquidity
* Advanced margin trading with complete protocol logic
* Full integration of Circle CCTP + Wallets
* A production-ready UI
* A novel FXEngine model uniquely suited for Arc

It is a **complete trading ecosystem**, end-to-end, built in just one hackathon.

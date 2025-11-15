# TradeFX Contract

## Overview

TradeFX is a leveraged FX trading protocol that allows users to take leveraged long/short positions on EUR/USD exchange rates using USDC and EURC stablecoins. It operates as a liquidity pool where LPs provide capital that traders borrow to create leveraged positions.

## Core Concept

The protocol enables **synthetic FX leverage** through a borrowing mechanism:

1. **Traders** deposit collateral in one currency (USDC or EURC)
2. **Borrow** additional funds from the liquidity pool
3. **Swap** both collateral + borrowed funds into the position token
4. **Bet** on exchange rate movements
5. **Close** position by swapping back and repaying the loan + fees

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        TradeFX Contract                          │
│                                                                   │
│  ┌─────────────────┐         ┌──────────────────┐               │
│  │  Liquidity Pool │◄────────┤   LP Providers   │               │
│  │   (USDC+EURC)   │────────►│  (Buy/Sell LPT)  │               │
│  └────────┬────────┘         └──────────────────┘               │
│           │                                                       │
│           │ Lends to Traders                                     │
│           ▼                                                       │
│  ┌─────────────────┐                                             │
│  │   Traders       │                                             │
│  │  Open Positions │                                             │
│  │  (Leveraged)    │                                             │
│  └────────┬────────┘                                             │
│           │                                                       │
│           │ Uses FXEngine                                        │
│           ▼                                                       │
│  ┌─────────────────┐                                             │
│  │   FXEngine      │                                             │
│  │ (Price Oracle & │                                             │
│  │     Swaps)      │                                             │
│  └─────────────────┘                                             │
└─────────────────────────────────────────────────────────────────┘
```

## Position Lifecycle

### 1. Opening a Position

**Function:** `openPosition(address start_token, uint256 collateral, uint256 borrow, address pos_token, uint256 FakeRate)`

**Example Scenario:** Trader wants to long EUR vs USD
- Start token: USDC (what they have)
- Collateral: 1000 USDC
- Borrow: 4000 USDC (4x leverage)
- Position token: EURC (what they want exposure to)

**Steps:**
```
1. User deposits 1000 USDC collateral
2. Protocol lends 4000 USDC from pool
3. Swap 1000 USDC → ~900 EURC (converted_collateral)
4. Swap 4000 USDC → ~3600 EURC (converted_borrowed)
5. Total position: ~4500 EURC (pos_token_amount)
6. Borrowed amount recorded: 4000 USDC
7. Position created with barriers and fees
```

**State Updates:**
```
USDCBorrowed += 4000
EURCBorrowedFromUSDC += 3600 (the converted amount)
EURCCollateral += 900
```

**Position Structure Created:**
```solidity
Position {
    start_token: USDC
    collateral: 1000 USDC
    converted_collateral: 900 EURC
    borrowed: 4000 USDC
    converted_borrowed: 3600 EURC
    pos_token: EURC
    pos_token_amount: 4500 EURC
    liquidation_barrier: 4000 + (4000 * LiquidationBuffer/10000)
    insolvency_barrier: 4000
    barrier_increase_per_10_000_seconds: (LendingRate * 4000) / 10000
}
```

### 2. Position Health Over Time

**Three Solvency States:**

```
Position Value (in start_token)
│
│  ┌────────────────────────────────────┐
│  │         SOLVENT                     │  ← Safe zone
│  │  Value > borrowed + fees +         │
│  │          liquidation_buffer        │
│  └────────────────────────────────────┘
│         ↓ Price moves against trader
│  ┌────────────────────────────────────┐
│  │       LIQUIDATABLE                  │  ← Danger zone
│  │  Value > borrowed + fees           │    Liquidators can step in
│  │  Value < borrowed + fees +         │    and earn fee
│  │          liquidation_buffer        │
│  └────────────────────────────────────┘
│         ↓ Price continues down
│  ┌────────────────────────────────────┐
│  │        INSOLVENT                    │  ← Protocol loss
│  │  Value < borrowed + fees           │    Bad debt
│  └────────────────────────────────────┘
│
└──────────────────────────────────────── Time
```

**Barriers Explanation:**

- **Liquidation Barrier:** `borrowed + (borrowed * LiquidationBuffer / 10000)`
  - Example: If borrowed = 4000 USDC and LiquidationBuffer = 500 (5%)
  - Liquidation barrier = 4000 + 200 = 4200 USDC
  
- **Insolvency Barrier:** `borrowed` (just the borrowed amount)
  - Example: 4000 USDC

- **Fees Accumulate Over Time:** `barrier_increase_per_10_000_seconds * time_elapsed / 10000`
  - These fees increase what's owed continuously

### 3. Closing a Position

**Function:** `closePosition(uint256 position_id, uint256 FakeRate)`

**Scenario:** EUR strengthened, position is profitable

```
1. Check solvency
   - If LIQUIDATABLE → auto-liquidate
   - If INSOLVENT → handle insolvency
   
2. If SOLVENT:
   - Swap 4500 EURC back to USDC
   - Suppose get 5200 USDC (profit!)
   
3. Calculate owed:
   - Borrowed: 4000 USDC
   - Fees: ~50 USDC (time-based)
   - Total owed: 4050 USDC
   
4. Return to user:
   - 5200 - 4050 = 1150 USDC
   - Started with 1000, gained 150 USDC profit
   
5. Update pool state:
   - USDCBorrowed -= 4000
   - EURCBorrowedFromUSDC -= 3600
   - EURCCollateral -= 900
```

### 4. Liquidation

**Function:** `liquidate(uint256 position_id, uint256 FakeRate)`

**Scenario:** EUR weakened, position is liquidatable

```
1. Position value check:
   - 4500 EURC now worth 4100 USDC
   - Owed: 4000 + 50 fees = 4050 USDC
   - Liquidation barrier: 4200 USDC
   - Status: LIQUIDATABLE (4100 < 4200 but > 4050)

2. Liquidator calls liquidate():
   - Swap 4500 EURC → 4100 USDC
   
3. Distribution:
   - Borrowed repayment: 4000 USDC → pool
   - Protocol fees: 50 USDC → pool
   - Liquidator fee: (4100 - 4050) * LiquidatorFee/10000
   - Remaining: goes back to position owner
   
4. Liquidator earns fee for maintaining protocol health
```

### 5. Insolvency Handling

**Worst case scenario:**

```
Position value: 3900 USDC
Owed: 4050 USDC
Status: INSOLVENT (value < owed)

Result:
- Swap back what's there: 3900 USDC
- Protocol takes a 150 USDC loss
- No liquidator fee (would incentivize waiting)
- User gets nothing back
- This is BAD for the protocol
```

## Liquidity Provider System

### Pool Value Calculation

The pool owns:
1. **Direct holdings:** USDC and EURC not used as collateral or borrowed
2. **Claims on borrowed funds:** The borrowed amounts that will be repaid
3. **Collateral:** Which belongs to position holders, not the pool

**Formula for pool value in USDC:**
```
Total USDC in contract = all USDC held
Subtract: USDCCollateral (belongs to traders)
Subtract: USDCBorrowedFromEURC (borrowed out as EURC)
Add: Value of EURCBorrowedFromUSDC in USDC terms (pool's claim)

Same for EURC side, then convert one to the other for total
```

### LP Token Pricing

**Dynamic pricing based on pool value:**

```
Price per LPT in USDC = Total Pool Value in USDC / Total LPT Supply

When buying LPT:
- Pay: (amount * pool_value) / supply
- Receive: amount of LPT
- Half gets swapped to maintain 50/50 balance

When selling LPT:
- Burn: amount of LPT  
- Receive: (amount * pool_value) / supply
- Half gets swapped to maintain 50/50 balance
```

## State Variables Tracking

```
┌─────────────────────────────────────────────────────────┐
│                    Pool Accounting                       │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  USDCBorrowed: Amount of USDC borrowed (in USDC terms)  │
│  EURCBorrowed: Amount of EURC borrowed (in EURC terms)  │
│                                                           │
│  USDCBorrowedFromEURC: USDC borrowed that's now as EURC │
│  EURCBorrowedFromUSDC: EURC borrowed that's now as USDC │
│                                                           │
│  USDCCollateral: USDC held as collateral                │
│  EURCCollateral: EURC held as collateral                │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

**Example state after one position:**

```
Position: Long EUR with USDC
- Collateral: 1000 USDC → 900 EURC
- Borrowed: 4000 USDC → 3600 EURC

State:
USDCBorrowed = 4000
USDCBorrowedFromEURC = 0
EURCBorrowed = 0
EURCBorrowedFromUSDC = 3600
USDCCollateral = 0
EURCCollateral = 900
```

## Fee Structure

### Lending Fees (Time-based)
- Accumulate continuously
- Rate: `LendingRate` (in basis points per 10,000 seconds)
- Applied to borrowed amount
- Formula: `(barrier_increase_per_10_000_seconds * time_elapsed) / 10000`

### Liquidator Fees
- Only paid on LIQUIDATABLE positions (not INSOLVENT)
- Incentivizes timely liquidation
- Formula: `(position_value - owed) * LiquidatorFee / 10000`
- Comes from the "excess" above what's owed

## Key Mechanisms

### 1. Liquidity Check
Before lending, checks if pool has enough free capital:
```
Available USDC = Balance - Collateral - BorrowedFromEURC
```

### 2. Rebalancing
When LPs buy/sell tokens, protocol swaps half to maintain rough 50/50 USDC:EURC ratio

### 3. Position Tracking
- Each position gets unique ID
- Stored in `IDToPosition` mapping
- User's positions tracked in `UserPositions[user]` array
- Enables easy lookup and management

## Risk Model

### For Traders:
- **Leverage Risk:** Can lose entire collateral + more if insolvent
- **Liquidation Risk:** Position closed automatically if barriers breached
- **Fee Accumulation:** Time works against position health

### For LPs:
- **Insolvency Risk:** If positions go insolvent, pool takes losses
- **Utilization Risk:** If too much capital lent out, withdrawals may fail
- **Exchange Rate Risk:** Pool holds both USDC and EURC

### For Protocol:
- **Bad Debt:** Insolvent positions create protocol losses
- **Liquidation Timing:** Must liquidate before insolvency
- **Oracle Dependence:** Relies on FXEngine for accurate rates

## Critical Parameters

1. **LiquidationBuffer:** Safety margin above borrowed amount
   - Too high → traders liquidated too early
   - Too low → insolvency risk increases

2. **LiquidatorFee:** Incentive for liquidators
   - Too high → eats into trader returns
   - Too low → positions may not get liquidated

3. **LendingRate:** Cost of borrowing
   - Revenue for LPs
   - Cost for traders

## Flow Diagrams

### Opening Position Flow
```
User                Contract              FXEngine           Pool
 │                     │                     │                │
 │──deposit collateral─→                     │                │
 │                     │                     │                │
 │                     │──check liquidity────→                │
 │                     │                     │                │
 │                     │──approve tokens─────→                │
 │                     │                     │                │
 │                     │──swap collateral────→                │
 │                     ←──return EURC────────│                │
 │                     │                     │                │
 │                     │──swap borrowed──────→                │
 │                     ←──return EURC────────│                │
 │                     │                     │                │
 │                     │──update state───────────────────────→│
 │                     │                     │                │
 │                     │──create position────│                │
 │                     │                     │                │
 │←──position ID───────│                     │                │
```

### Liquidation Flow
```
Liquidator          Contract              FXEngine           Pool
 │                     │                     │                │
 │──liquidate(id)──────→                     │                │
 │                     │                     │                │
 │                     │──check solvency─────→                │
 │                     │                     │                │
 │                     │──swap position──────→                │
 │                     ←──return start_token─│                │
 │                     │                     │                │
 │                     │──calculate fees─────│                │
 │                     │                     │                │
 │                     │──repay borrowed─────────────────────→│
 │                     │                     │                │
 │                     │──pay protocol fee───────────────────→│
 │                     │                     │                │
 │←──liquidator fee────│                     │                │
 │                     │                     │                │
 │                     │──return remainder───→ User           │
```

## Summary

TradeFX is essentially a **peer-to-pool leveraged FX trading platform**:

- **Traders** can get leveraged exposure to EUR/USD movements
- **LPs** earn fees from lending capital to traders
- **Liquidators** maintain system health by closing risky positions
- **Protocol** manages risk through barriers and time-based fees

The system's health depends on:
1. Accurate price feeds from FXEngine
2. Timely liquidations before insolvency
3. Proper parameter tuning (buffers, fees)
4. Sufficient liquidity for both trading and withdrawals

The main innovation is synthetic FX leverage using stablecoins without requiring a traditional order book or counterparty matching.

# TradeFX Contract - Complete Documentation 

## Table of Contents
1. [Overview](#overview)
2. [Core Mechanics](#core-mechanics)
3. [Position Lifecycle](#position-lifecycle)
4. [Liquidity Provider System](#liquidity-provider-system)
5. [Accounting System](#accounting-system)
6. [Solvency & Liquidation](#solvency--liquidation)
7. [Fee Structure](#fee-structure)
8. [Security Features](#security-features)
9. [Known Limitations](#known-limitations)
10. [Technical Reference](#technical-reference)

---

## Overview

TradeFX is a leveraged FX trading protocol enabling synthetic exposure to EUR/USD exchange rate movements using USDC and EURC stablecoins. The protocol operates as a peer-to-pool lending system where:

- **Traders** deposit collateral and borrow from the pool to create leveraged positions
- **Liquidity Providers (LPs)** supply capital and earn time-based fees from borrowers
- **Liquidators** maintain system health by closing underwater positions for a fee

### Key Innovation

Traders can gain leveraged FX exposure **without counterparty matching** or order books, using a simple deposit-borrow-swap mechanism backed by a shared liquidity pool.

---

## Core Mechanics

### The Basic Trade Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    OPENING A LONG EUR POSITION                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  1. Trader deposits: 1,000 USDC (collateral)                    │
│  2. Protocol lends: 4,000 USDC (from pool)                      │
│  3. Swap both amounts: 5,000 USDC → 4,500 EURC                  │
│  4. Position created: 4,500 EURC exposure (5x leverage)         │
│                                                                   │
│  Position Health Barriers:                                       │
│  • Liquidation: 4,200 USDC (borrowed + 5% buffer)              │
│  • Insolvency: 4,000 USDC (borrowed amount)                     │
│  • Fees accumulate: ~40 USDC per 10,000 seconds                │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     TradeFX Ecosystem                         │
│                                                                │
│  ┌─────────────────┐                                          │
│  │  Liquidity Pool │  ◄───── LP Deposits (USDC/EURC)         │
│  │  (USDC + EURC)  │  ─────► LP Withdrawals                   │
│  └────────┬────────┘                                          │
│           │                                                    │
│           │ Lends Capital                                     │
│           ▼                                                    │
│  ┌─────────────────┐         ┌──────────────┐                │
│  │   Trader        │────────►│  FXEngine    │                │
│  │   Positions     │◄────────│ (Oracle &    │                │
│  │   (Leveraged)   │         │  Swaps)      │                │
│  └─────────────────┘         └──────────────┘                │
│           │                                                    │
│           │ If Unhealthy                                      │
│           ▼                                                    │
│  ┌─────────────────┐                                          │
│  │  Liquidators    │                                          │
│  │  (Close risky   │                                          │
│  │   positions)    │                                          │
│  └─────────────────┘                                          │
└──────────────────────────────────────────────────────────────┘
```

---

## Position Lifecycle

### 1. Opening a Position

**Function:** `openPosition(address start_token, uint256 collateral, uint256 borrow, address pos_token, uint256 FakeRate)`

**Example: Long EUR with 5x leverage**

```javascript
// Parameters:
start_token: USDC      // What you're depositing
collateral: 1000e6     // 1,000 USDC
borrow: 4000e6         // 4,000 USDC borrowed
pos_token: EURC        // What you want exposure to
FakeRate: 1100000      // Exchange rate (for testing)

// Execution flow:
1. Check pool has 4,000 USDC available
2. Transfer 1,000 USDC from user to contract
3. Approve FXEngine to spend 5,000 USDC
4. Swap 1,000 USDC → ~900 EURC (converted_collateral)
5. Swap 4,000 USDC → ~3,600 EURC (converted_borrowed)
6. Total position: 4,500 EURC

// State updates:
USDCBorrowed += 4,000
EURCBorrowedFromUSDC += 3,600
EURCCollateral += 900

// Position struct created with:
liquidation_barrier = 4,000 + (4,000 * 500/10,000) = 4,200 USDC
insolvency_barrier = 4,000 USDC
barrier_increase_per_10_000_seconds = (100 * 4,000) / 10,000 = 40 USDC
```

**Position Structure:**
```solidity
struct Position {
    address start_token;              // USDC
    uint256 collateral;               // 1,000 USDC
    uint256 converted_collateral;     // 900 EURC
    uint256 borrowed;                 // 4,000 USDC
    uint256 converted_borrowed;       // 3,600 EURC
    address pos_token;                // EURC
    uint256 pos_token_amount;         // 4,500 EURC
    uint256 id;                       // Unique position ID
    address user;                     // Position owner
    uint256 block_timestamp;          // When opened
    uint256 lending_rate;             // Fee rate at opening
    uint256 liquidation_barrier;      // 4,200 USDC
    uint256 insolvency_barrier;       // 4,000 USDC
    uint256 barrier_increase_per_10_000_seconds; // 40 USDC
}
```

### 2. Position Health States

```
Position Value Over Time (in start_token)
│
│  ╔══════════════════════════════════════╗
│  ║         SOLVENT ZONE                 ║  
│  ║  Value > borrowed + fees + buffer    ║  ← Safe, can close anytime
│  ║  Example: 4,500 > 4,080 + 200        ║
│  ╚══════════════════════════════════════╝
│         ↓ EUR weakens / fees accumulate
│  ╔══════════════════════════════════════╗
│  ║      LIQUIDATABLE ZONE               ║  
│  ║  Value > borrowed + fees             ║  ← Danger! Liquidators
│  ║  Value < borrowed + fees + buffer    ║     can close for fee
│  ║  Example: 4,150 between 4,080-4,280  ║
│  ╚══════════════════════════════════════╝
│         ↓ EUR continues weakening
│  ╔══════════════════════════════════════╗
│  ║       INSOLVENT ZONE                 ║  
│  ║  Value < borrowed + fees             ║  ← Protocol takes loss
│  ║  Example: 3,900 < 4,080              ║     Bad debt situation
│  ╚══════════════════════════════════════╝
│
└────────────────────────────────────────────► Time
        Fees accumulate continuously
```

**Health Check Logic:**
```solidity
function checkSolvency(uint256 position_id, uint256 FakeRate) returns (Solvency) {
    fees = calculateLendingFees(position_id);
    value = getPositionValue(position_id, FakeRate);
    
    if (value > fees + liquidation_barrier) return SOLVENT;
    if (value > fees + insolvency_barrier) return LIQUIDATABLE;
    return INSOLVENT;
}
```

### 3. Closing a Position (Solvent)

**Function:** `closePosition(uint256 position_id, uint256 FakeRate)`

**Scenario: EUR strengthened to 1.15, position is profitable**

```
Initial state:
- Position: 4,500 EURC
- Borrowed: 4,000 USDC
- Time elapsed: 20,000 seconds
- Fees accrued: 80 USDC

Close execution:
1. Check solvency: SOLVENT ✓
2. Approve FXEngine to spend 4,500 EURC
3. Swap 4,500 EURC → 5,175 USDC (EUR strengthened!)
4. Calculate owed: 4,000 + 80 = 4,080 USDC
5. Return to user: 5,175 - 4,080 = 1,095 USDC

Profit calculation:
- Initial investment: 1,000 USDC
- Final return: 1,095 USDC
- Profit: 95 USDC (9.5% return)
- Leveraged gain: ~5x the underlying move

State updates:
USDCBorrowed -= 4,000
EURCBorrowedFromUSDC -= 3,600
EURCCollateral -= 900
```

**Auto-liquidation:** If position is LIQUIDATABLE or INSOLVENT when user tries to close, `closePosition` automatically calls the appropriate handler.

### 4. Liquidation (Liquidatable Position)

**Function:** `liquidate(uint256 position_id, uint256 FakeRate)`

**Scenario: EUR weakened, position is liquidatable**

```
Position state:
- Position: 4,500 EURC
- Current value: 4,150 USDC (EUR weakened to 1.08)
- Borrowed: 4,000 USDC
- Fees: 80 USDC
- Total owed: 4,080 USDC
- Liquidation barrier: 4,200 USDC
- Status: LIQUIDATABLE (4,150 is between 4,080 and 4,280)

Liquidation execution:
1. Anyone can call liquidate()
2. Approve and swap 4,500 EURC → 4,150 USDC
3. Calculate distribution:
   - Borrowed repayment: 4,000 USDC → pool
   - Protocol fees: 80 USDC → pool
   - Liquidator fee: (4,150 - 4,080) * 300/10,000 = 2.1 USDC → liquidator
   - Remainder: 4,150 - 4,080 - 2.1 = 67.9 USDC → position owner

Key insight:
- Liquidator fee is % of EXCESS above owed amount
- User still gets remaining equity back
- Protocol is made whole (gets borrowed + fees)
- System remains healthy

State updates:
USDCBorrowed -= 4,000
EURCBorrowedFromUSDC -= 3,600
EURCCollateral -= 900
```

**Why liquidators liquidate:**
- Earn 3% (LiquidatorFee) of the excess value
- In this example: 2.1 USDC for calling a function
- Incentivized to monitor and act quickly

### 5. Insolvency Handling (Worst Case)

**Function:** `handleInsolvency(uint256 position_id, uint256 FakeRate)` (internal)

**Scenario: EUR collapsed, position is insolvent**

```
Position state:
- Position: 4,500 EURC
- Current value: 3,950 USDC (EUR crashed to 1.14)
- Borrowed: 4,000 USDC
- Fees: 80 USDC
- Total owed: 4,080 USDC
- Status: INSOLVENT (3,950 < 4,080)

Insolvency handling:
1. Automatically triggered (can't be avoided)
2. Swap 4,500 EURC → 3,950 USDC
3. Protocol receives: 3,950 USDC
4. Protocol is owed: 4,080 USDC
5. Bad debt: 130 USDC (protocol loss!)
6. User receives: 0 USDC
7. Liquidator receives: 0 USDC (no incentive for insolvency)

Impact:
- Pool LPs absorb the 130 USDC loss
- This reduces pool value slightly
- LPT price decreases proportionally
- System continues operating

Prevention:
- LiquidationBuffer creates safety margin
- Liquidators incentivized to act early
- Time-based fees create urgency
```

**Why no liquidator fee for insolvency:**
If liquidators earned fees on insolvent positions, they would be incentivized to WAIT for a liquidatable position to become insolvent rather than liquidating it early. This would harm the protocol.

---

## Liquidity Provider System

### How LPs Earn

LPs provide capital that traders borrow. They earn:
1. **Lending fees** - Time-based fees from all open positions
2. **Liquidation profits** - When positions are liquidated profitably
3. **Exchange rate exposure** - Pool holds both USDC and EURC

### Pool Value Calculation

The pool tracks what it **actually owns** vs what belongs to traders:

```solidity
function getValueOfPool(uint256 FakeRate, address token) returns (uint256) {
    // USDC side:
    totalUSDC = IUSDC.balanceOf(address(this));
    
    // Remove what we DON'T own:
    - USDCCollateral           // Belongs to traders (as collateral)
    - USDCBorrowedFromEURC     // Lent out (now as EURC in positions)
    
    // Add what we DO own:
    + EURCBorrowedFromUSDC converted to USDC  // Our EURC claim converted back
    
    = USDCOwnedByPool
    
    // Same for EURC side...
    
    // Total pool value = USDCOwnedByPool + EURCOwnedByPool (converted)
}
```

**Example calculation:**

```
Contract balances:
- USDC balance: 10,000
- EURC balance: 9,000

Accounting variables:
- USDCCollateral: 500 (locked in positions)
- USDCBorrowedFromEURC: 1,000 (lent out, now EURC)
- EURCCollateral: 450 (locked in positions)
- EURCBorrowedFromUSDC: 3,600 (lent out, now USDC)

Pool's USDC:
= 10,000 - 500 - 1,000 + getRate(EURC, USDC, 3,600)
= 10,000 - 500 - 1,000 + 4,000
= 12,500 USDC owned by pool

Pool's EURC:
= 9,000 - 450 - 3,600 + getRate(USDC, EURC, 1,000)
= 9,000 - 450 - 3,600 + 900
= 5,850 EURC owned by pool

Total pool value in USDC:
= 12,500 + getRate(EURC, USDC, 5,850)
= 12,500 + 6,500
= 19,000 USDC
```

### LP Token Pricing

LPTs represent proportional ownership of the pool:

```
Price per LPT = Total Pool Value / Total LPT Supply

If buying 100 LPT:
Price = (Pool Value * 100) / Total Supply
```

**Dynamic pricing means:**
- LPT value increases as fees accumulate
- LPT value decreases if positions become insolvent
- LPT value fluctuates with EUR/USD rate

### Buying LP Tokens

**Function:** `buyLPTWithUSDC(uint256 amount, address recipient, uint256 FakeRate)`

```
User wants to buy 1,000 LPT:

1. Calculate price:
   Pool value: 19,000 USDC
   Total supply: 10,000 LPT
   Price = (19,000 * 1,000) / 10,000 = 1,900 USDC

2. User pays 1,900 USDC

3. Mint 1,000 LPT to user

4. Rebalance pool:
   Swap 950 USDC → EURC (half of what was paid)
   
5. Pool now has:
   - 950 more USDC
   - ~860 more EURC
   - Maintains rough 50/50 balance
```

**Why rebalance?**
Without rebalancing, the pool would become heavily skewed toward one currency, increasing exchange rate risk.

### Selling LP Tokens

**Function:** `sellLPTForUSDC(uint256 amount, address recipient, uint256 FakeRate)`

```
User wants to sell 1,000 LPT for USDC:

1. Calculate price:
   Pool value: 19,000 USDC
   Total supply: 11,000 LPT (after previous buy)
   Price = (19,000 * 1,000) / 11,000 = 1,727 USDC

2. Check liquidity:
   Available USDC = Balance - Collateral - BorrowedFromEURC
   Require: Available >= 1,727

3. Burn 1,000 LPT from user

4. Send 1,727 USDC to user

5. Rebalance pool:
   Pool now has less USDC, same EURC (EURC-heavy)
   Swap 863 EURC → USDC (half of what was paid out)
   
6. Pool restored to rough 50/50 balance
```

**"Run on the bank" protection:**
The liquidity check prevents withdrawals that would:
- Take collateral needed for positions
- Take borrowed funds that are out in positions
- Cause the pool to become illiquid

---

## Accounting System

### State Variables Explained

The contract tracks 6 critical accounting variables:

```solidity
uint256 public USDCBorrowed;         // USDC borrowed in USDC terms
uint256 public EURCBorrowed;         // EURC borrowed in EURC terms

uint256 public USDCBorrowedFromEURC; // Borrowed EURC, now as USDC
uint256 public EURCBorrowedFromUSDC; // Borrowed USDC, now as EURC

uint256 public USDCCollateral;       // USDC locked as collateral
uint256 public EURCCollateral;       // EURC locked as collateral
```

### Example Accounting Flow

**Position 1: Long EUR starting with USDC**
```
Open position:
- Collateral: 1,000 USDC → 900 EURC
- Borrowed: 4,000 USDC → 3,600 EURC

State after:
USDCBorrowed = 4,000        (we lent 4,000 USDC)
EURCBorrowedFromUSDC = 3,600 (those 4,000 USDC are now 3,600 EURC)
EURCCollateral = 900        (collateral is held as EURC)
```

**Position 2: Long USD starting with EURC**
```
Open position:
- Collateral: 1,000 EURC → 1,100 USDC
- Borrowed: 4,000 EURC → 4,400 USDC

State after (cumulative):
USDCBorrowed = 4,000
EURCBorrowed = 4,000        (we lent 4,000 EURC)
USDCBorrowedFromEURC = 4,400 (those 4,000 EURC are now 4,400 USDC)
EURCBorrowedFromUSDC = 3,600
USDCCollateral = 1,100      (collateral is held as USDC)
EURCCollateral = 900
```

**Why this matters:**
- Pool needs to know what's locked vs available
- Pool value calculation needs to track borrowed amounts in both terms
- When positions close, we update both the original and converted amounts

### Liquidity Availability

```solidity
// For USDC borrowing:
Available USDC = Balance - USDCCollateral - USDCBorrowedFromEURC

// For EURC borrowing:
Available EURC = Balance - EURCCollateral - EURCBorrowedFromUSDC
```

**Interpretation:**
- `Balance` = Total in contract
- `Collateral` = Locked, belongs to traders
- `BorrowedFrom` = Already lent out, can't lend again

---

## Solvency & Liquidation

### The Barrier System

Each position has two critical thresholds:

```
Liquidation Barrier = borrowed + (borrowed * LiquidationBuffer / 10,000)
Insolvency Barrier = borrowed

Example with 5% buffer:
Borrowed: 4,000 USDC
Liquidation Barrier: 4,000 + 200 = 4,200 USDC
Insolvency Barrier: 4,000 USDC
```

**These are STATIC** - set at position opening and never change.

### Time-Based Fee Accumulation

Fees accumulate linearly over time:

```solidity
barrier_increase_per_10_000_seconds = (LendingRate * borrowed) / 10,000

fees_accumulated = barrier_increase_per_10_000_seconds * time_elapsed / 10,000
```

**Example:**
```
Borrowed: 4,000 USDC
LendingRate: 100 bsps per 10,000 seconds (1%)
barrier_increase: 40 USDC per 10,000 seconds

After 20,000 seconds:
fees = 40 * 20,000 / 10,000 = 80 USDC

After 50,000 seconds:
fees = 40 * 50,000 / 10,000 = 200 USDC (ate the whole buffer!)
```

**Key insight:** Even if price doesn't move, fees will eventually push a position from SOLVENT → LIQUIDATABLE → INSOLVENT if not closed.

### Solvency Check Formula

```
Position value in start_token = getRate(pos_token, start_token, pos_token_amount)

If value > fees + liquidation_barrier:
    ✓ SOLVENT
Else if value > fees + insolvency_barrier:
    ⚠ LIQUIDATABLE  
Else:
    ✗ INSOLVENT
```

**Visual example over time:**

```
t=0:     value=4,500, fees=0,   barrier=4,200  → SOLVENT
t=10k:   value=4,400, fees=40,  barrier=4,200  → SOLVENT (4,400 > 4,240)
t=20k:   value=4,300, fees=80,  barrier=4,200  → SOLVENT (4,300 > 4,280)
t=25k:   value=4,250, fees=100, barrier=4,200  → LIQUIDATABLE (4,250 < 4,300 but > 4,100)
t=30k:   value=4,100, fees=120, barrier=4,200  → INSOLVENT (4,100 < 4,120)
```

### Liquidator Fee Calculation

```solidity
function calculateLiquidatorFee(position_id, FakeRate) returns (uint256) {
    if (SOLVENT) return 0;
    
    excess = pos_value - (borrowed + fees);
    fee = excess * LiquidatorFee / 10,000;
    
    if (LIQUIDATABLE) return fee;
    if (INSOLVENT) return 0;  // No incentive to wait for insolvency
}
```

**Example:**
```
Position value: 4,150 USDC
Borrowed + fees: 4,080 USDC
Excess: 70 USDC
LiquidatorFee: 300 bsps (3%)

Liquidator fee = 70 * 300 / 10,000 = 2.1 USDC
```

**Distribution on liquidation:**
- Pool receives: 4,000 (borrowed) + 80 (fees) = 4,080 USDC
- Liquidator receives: 2.1 USDC
- User receives: 67.9 USDC
- Total: 4,150 USDC ✓

### Why Liquidation Exists

Without liquidation, scenarios like this would happen:

```
Day 1: Position worth 4,500, owes 4,000 → Healthy
Day 5: Position worth 4,200, owes 4,100 → Borderline
Day 7: Position worth 3,900, owes 4,150 → INSOLVENT!

Pool expected to get: 4,150
Pool actually gets: 3,900
Loss: 250 USDC absorbed by LPs
```

Liquidation creates a buffer zone where external actors are incentivized to close positions before they go fully underwater, protecting the pool.

---

## Fee Structure

### 1. Lending Fees (Time-Based)

**Parameters:**
- `LendingRate`: basis points per 10,000 seconds
- Applied to: borrowed amount
- Accrues: continuously from position opening

**Calculation:**
```solidity
barrier_increase_per_10_000_seconds = (LendingRate * borrowed) / 10,000
fees = barrier_increase_per_10_000_seconds * time_elapsed / 10,000
```

**Example rates:**
```
LendingRate = 100 bsps (1% per 10,000 seconds)

Over 10,000 seconds:  1% of borrowed
Over 100,000 seconds: 10% of borrowed  
Over 1,000,000 seconds: 100% of borrowed (borrowed amount doubles!)
```

**Who receives:** The pool (LPs collectively)

### 2. Liquidator Fees

**Parameters:**
- `LiquidatorFee`: basis points (e.g., 300 = 3%)
- Applied to: excess value above owed amount
- Paid: only on LIQUIDATABLE positions

**Calculation:**
```solidity
excess = position_value - (borrowed + fees)
liquidator_fee = excess * LiquidatorFee / 10,000
```

**Constraints:**
- Maximum fee = entire excess (if LiquidatorFee = 10,000)
- No mathematical requirement that LiquidationBuffer > LiquidatorFee
- However, setting LiquidatorFee too high leaves little for users

**Who receives:** The liquidator (caller of liquidate function)

### 3. Fee Distribution on Liquidation

```
Total position value when liquidated: X

Distribution:
1. Borrowed amount → Pool
2. Accumulated fees → Pool  
3. Liquidator fee → Liquidator
4. Remainder → Position owner

Require: X > (1) + (2) + (3)
Otherwise: Position is INSOLVENT, not LIQUIDATABLE
```

---

## Security Features

### 1. Reentrancy Protection

All state-changing functions use `nonReentrant`:
```solidity
function openPosition(...) public nonReentrant { }
function closePosition(...) public nonReentrant { }
function liquidate(...) public nonReentrant { }
function buyLPTWithUSDC(...) public nonReentrant { }
function sellLPTForUSDC(...) public nonReentrant { }
// ... etc
```

Prevents reentrancy attacks via malicious ERC20 tokens.

### 2. Liquidity Checks

Before lending to traders:
```solidity
require(checkLiquidity(start_token, borrow), "insufficient Liquidity");
```

Before paying out LPs:
```solidity
availableUSDC = Balance - USDCBorrowedFromEURC - USDCCollateral;
require(availableUSDC >= price, "Run on the bank situation");
```

Prevents:
- Over-lending beyond available capital
- Withdrawals that would break existing positions
- Illiquidity cascades

### 3. Position Ownership

```solidity
require(msg.sender == IDToPosition[position_id].user, "Not Your Position");
```

Only position owner can close their own position (but anyone can liquidate).

### 4. Solvency-Based Auto-Handling

When user calls `closePosition`:
```solidity
if (LIQUIDATABLE) → liquidate()
if (INSOLVENT) → handleInsolvency()
if (SOLVENT) → normal close
```

Prevents users from closing insolvent positions without proper accounting.

### 5. Token Approvals

Before every swap:
```solidity
IUSDC.approve(address(engine), amount);
```

Approvals are fresh for each operation, minimizing approval-related attack surface.

---

## Known Limitations

### 1. Immediately Liquidatable Positions

**Issue:** A user could open a position that's immediately liquidatable due to:
- Slippage during opening swaps
- Poorly chosen leverage ratio
- Unfortunate timing with exchange rate movement

**Example:**
```
User deposits: 1,000 USDC
Borrows: 10,000 USDC (10x leverage)
Liquidation barrier: 10,500 USDC

Swaps happen with slippage:
11,000 USDC → 9,500 EURC (should be 10,000 EURC)

Immediate value if closed: 10,400 USDC
Status: LIQUIDATABLE (10,400 < 10,500)

Someone liquidates immediately, user loses most of deposit.
```

**Mitigation options:**
- Frontend should warn users about dangerous leverage
- Could add a minimum health ratio check after opening
- Could add a grace period before liquidation

### 2. No Slippage Protection

All swaps execute at whatever rate the FXEngine returns with no minimum output checks.

**Risk:**
- Sandwich attacks
- Unfavorable execution
- MEV extraction

**Mitigation:**
- FXEngine could have internal slippage limits
- Add minReturn parameters to functions
- Use price impact checks

### 3. FakeRate is User-Controlled

**Issue:** LP functions accept `FakeRate` from users, which determines pool valuation.

**Potential exploit:**
```
1. Manipulate FakeRate to make pool appear undervalued
2. Buy LPT at discount
3. Sell at real rate
```

**Mitigation:**
- Use trusted oracle instead of user input
- FakeRate should only be for testing
- Production should use FXEngine's real rate

### 4. No Parameter Updates

Critical parameters are immutable:
- `LendingRate`
- `LiquidationBuffer`
- `LiquidatorFee`

**Risk:**
- Market conditions change
- Optimal parameters may shift
- No governance mechanism to adapt

**Mitigation:**
- Add admin functions with timelock
- Implement governance
- Start with conservative parameters

### 5. No Same-Token Check

Users can call:
```solidity
openPosition(USDC, 1000, 4000, USDC, FakeRate)
```

This swaps USDC → USDC, which doesn't make sense.

**Mitigation:**
```solidity
require(start_token != pos_token, "Cannot open position in same token");
```

### 6. FXEngine Dependency

All operations depend on FXEngine:
- If it fails, all positions freeze
- If it's exploited, this contract is exploited
- Single point of failure

**Mitigation:**
- Thoroughly audit FXEngine
- Add emergency pause mechanism
- Consider multiple oracle sources

### 7. Precision Loss in Rebalancing

```solidity
uint256 rebalance_amount = price / 2;
```

If price is odd, loses 1 wei per transaction.

**Impact:**
- Over millions of transactions, could accumulate
- Pool ratio slowly drifts

**Mitigation:**
- Use higher precision math
- Periodic manual rebalancing
- Accept minor drift as negligible

### 8. Position Array Management

Position removal uses swap-and-pop:
```solidity
user_pos_arr[i] = user_pos_arr[length - 1];
user_pos_arr.pop();
```

**Risk:**
- Gas cost linear in number of positions
- User with 100 positions pays high gas to close one

**Mitigation:**
- Use mapping instead of array for gas efficiency
- Limit positions per user
- Use enumerable set library

---

## Technical Reference

### Events

```solidity
event NewPosition(
    address start_token,
    uint256 collateral,
    uint256 borrowed,
    address pos_token,
    uint256 pos_token_amount,
    uint256 id,
    address user,
    uint256 block_timestamp,
    uint256 lending_rate,
    uint256 liquidation_barrier,
    uint256 insolvency_barrier,
    uint256 barrier_increase_per_10_000_seconds
);

event PositionClosed(...);
event PositionLiquidated(..., address liquidator);
event InsolventPositionClosed(...);
event LPTokenPurchased(...);
event LPTokenSold(...);
```

### View Functions

```solidity
checkSolvency(position_id, FakeRate) → Solvency enum
calculateLiquidatorFee(position_id, FakeRate) → uint256
calculateOwedWithFees(position_id) → uint256
calculateLendingFees(position_id) → uint256

getValueOfPool(FakeRate, token) → uint256
getUSDCPricePerLPT(FakeRate) → uint256
getEURCPricePerLPT(FakeRate) → uint256
getUSDCPrice(amount, FakeRate) → uint256
getEURCPrice(amount, FakeRate) → uint256
```

### State-Changing Functions

```solidity
// Trading
openPosition(start_token, collateral, borrow, pos_token, FakeRate) → (id, liq_barrier, insol_barrier, barrier_increase)
closePosition(position_id, FakeRate)
liquidate(position_id, FakeRate)

// LP Operations
buyLPTWithUSDC(amount, recipient, FakeRate)
buyLPTWithEURC(amount, recipient, FakeRate)
sellLPTForUSDC(amount, recipient, FakeRate)
sellLPTForEURC(amount, recipient, FakeRate)
```

### Constructor Parameters

```solidity
constructor(
    uint256 initialSupply,      // Initial LPT minted to deployer
    address usdc,               // USDC token address
    address eurc,               // EURC token address
    address FXENGINE,           // FXEngine oracle/swap contract
    uint256 _lending_rate,      // Bsps per 10,000 seconds
    uint256 _liquidation_buffer, // Bsps above borrowed (e.g., 500 = 5%)
    uint256 _liquidator_fee     // Bsps of excess (e.g., 300 = 3%)
)
```

### Key Formulas

**Liquidation Barrier:**
```
liquidation_barrier = borrowed + (borrowed * LiquidationBuffer / 10,000)
```

**Fee Accumulation:**
```
barrier_increase_per_10k_sec = (LendingRate * borrowed) / 10,000
fees = barrier_increase_per_10k_sec * time_elapsed / 10,000
```

**Liquidator Fee:**
```
excess = position_value - (borrowed + fees)
liquidator_fee = excess * LiquidatorFee / 10,000
```

**Pool Value (USDC terms):**
```
USDCOwnedByPool = totalUSDC - USDCCollateral - USDCBorrowedFromEURC 
                  + getRate(EURC, USDC, EURCBorrowedFromUSDC)

EURCOwnedByPool = totalEURC - EURCCollateral - EURCBorrowedFromUSDC
                  + getRate(USDC, EURC, USDCBorrowedFromEURC)

TotalValue = USDCOwnedByPool + getRate(EURC, USDC, EURCOwnedByPool)
```

**LPT Price:**
```
PricePerLPT = TotalPoolValue / TotalSupply
PriceForAmount = (TotalPoolValue * amount) / TotalSupply
```

---

## Usage Examples

### Example 1: Opening a Long EUR Position

```javascript
// Setup
const usdc = "0x...";
const eurc = "0x...";
const tradeFX = "0x...";

// User has 1,000 USDC, wants 5x leverage long EUR
await usdcContract.approve(tradeFX, 1000e6);

const tx = await tradeFXContract.openPosition(
    usdc,           // start_token
    1000e6,         // collateral: 1,000 USDC
    4000e6,         // borrow: 4,000 USDC (4x on top of collateral)
    eurc,           // pos_token: want EURC exposure
    1100000         // FakeRate (1.10 EUR/USD)
);

// Returns: (positionId, liquidationBarrier, insolvencyBarrier, barrierIncrease)
```

### Example 2: Monitoring Position Health

```javascript
// Check position solvency
const solvency = await tradeFXContract.checkSolvency(positionId, currentRate);

if (solvency == 0) {
    console.log("Position is SOLVENT ✓");
} else if (solvency == 1) {
    console.log("Position is LIQUIDATABLE ⚠");
    // Consider closing or adding collateral
} else {
    console.log("Position is INSOLVENT ✗");
    // Will be handled automatically
}

// Check fees accumulated
const fees = await tradeFXContract.calculateLendingFees(positionId);
const owed = await tradeFXContract.calculateOwedWithFees(positionId);

console.log(`Fees: ${fees}, Total owed: ${owed}`);
```

### Example 3: Closing a Profitable Position

```javascript
// Close position manually
await tradeFXContract.closePosition(positionId, currentRate);

// Automatically:
// - Swaps EURC back to USDC
// - Repays borrowed amount + fees
// - Returns profit to user
// - Emits PositionClosed event
```

### Example 4: Liquidating an Underwater Position

```javascript
// Anyone can call liquidate on a LIQUIDATABLE position
const liquidatorFee = await tradeFXContract.calculateLiquidatorFee(positionId, currentRate);

if (liquidatorFee > 0) {
    // Position is liquidatable and we'll earn a fee
    await tradeFXContract.liquidate(positionId, currentRate);
    
    // Liquidator receives liquidatorFee
    // Position owner receives remainder
    // Pool made whole
}
```

### Example 5: Becoming an LP

```javascript
// Buy 1,000 LPT with USDC
const amount = 1000e18; // 1,000 LPT tokens
const price = await tradeFXContract.getUSDCPrice(amount, currentRate);

await usdcContract.approve(tradeFX, price);
await tradeFXContract.buyLPTWithUSDC(amount, myAddress, currentRate);

// Pool mints 1,000 LPT to you
// Half your USDC is swapped to EURC for rebalancing
```

### Example 6: Exiting as an LP

```javascript
// Sell 500 LPT for USDC
const amount = 500e18;
const price = await tradeFXContract.getUSDCPrice(amount, currentRate);

await tradeFXContract.sellLPTForUSDC(amount, myAddress, currentRate);

// Burns 500 LPT
// Sends you USDC worth 500 LPT
// Rebalances pool by swapping EURC → USDC
```

---

## Risk Analysis

### For Traders

**High Risk:**
1. **Liquidation** - Position can be closed without your consent
2. **Time decay** - Fees accumulate continuously
3. **Exchange rate** - Adverse moves amplified by leverage

**Medium Risk:**
4. **Slippage** - Opening/closing may have unfavorable execution
5. **FXEngine** - Dependency on external oracle

**Low Risk:**
6. **Contract bugs** - Smart contract risk (mitigated by audits)

**Risk Mitigation:**
- Use lower leverage (2-3x instead of 10x)
- Monitor positions actively
- Close positions before fees accumulate significantly
- Understand liquidation barriers

### For LPs

**High Risk:**
1. **Insolvency** - Bad debt from underwater positions
2. **Utilization** - High utilization = withdrawal risk

**Medium Risk:**
3. **Exchange rate** - Pool holds both currencies
4. **Liquidation timing** - Depends on liquidators acting promptly

**Low Risk:**
5. **Fee accumulation** - Generally positive, LPs earn over time

**Risk Mitigation:**
- Monitor pool utilization rate
- Diversify across multiple protocols
- Ensure liquidation parameters are conservative
- Exit before utilization gets too high

### For the Protocol

**Critical Risks:**
1. **Insolvency cascade** - Multiple positions going insolvent
2. **FXEngine failure** - Oracle manipulation or failure
3. **Bank run** - All LPs trying to exit simultaneously

**Mitigation:**
- Conservative LiquidationBuffer (5-10%)
- Attractive LiquidatorFee (3-5%)
- Circuit breakers / emergency pause
- Redundant oracle sources

---

## Comparison to Traditional Systems

### vs Traditional Forex Margin Trading

**TradeFX:**
- ✓ No KYC required
- ✓ Permissionless access
- ✓ Transparent fees
- ✓ On-chain settlement
- ✗ Limited to EUR/USD via stablecoins
- ✗ No stop-loss orders
- ✗ Higher gas costs

**Traditional Forex:**
- ✓ Access to all currency pairs
- ✓ Advanced order types
- ✓ Lower transaction costs
- ✗ Requires broker account
- ✗ Counterparty risk
- ✗ Opaque fee structures

### vs Perpetual Futures (Perps)

**TradeFX:**
- ✓ No funding rate volatility
- ✓ Fixed fee structure
- ✓ Simpler model
- ✗ Time-based fees accumulate regardless of position
- ✗ No short positions (can only long one currency vs another)

**Perps:**
- ✓ Both long and short
- ✓ Funding rates balance market
- ✗ Funding rates can be unpredictable
- ✗ More complex mechanisms

### vs Lending Protocols (Aave, Compound)

**TradeFX:**
- ✓ Specialized for FX trading
- ✓ Integrated swaps
- ✗ Less mature
- ✗ Smaller liquidity

**Traditional Lending:**
- ✓ Battle-tested
- ✓ Deep liquidity
- ✓ Governance mechanisms
- ✗ Requires manual position construction
- ✗ Multiple transactions needed

---

## Future Improvements

### Short-term (Security & UX)

1. **Add slippage protection**
   ```solidity
   function openPosition(..., uint256 minPositionSize) {
       require(pos_token_amount >= minPositionSize, "Slippage too high");
   }
   ```

2. **Prevent same-token positions**
   ```solidity
   require(start_token != pos_token, "Must trade different tokens");
   ```

3. **Add minimum health check**
   ```solidity
   require(checkSolvency(id, FakeRate) == SOLVENT, "Opens liquidatable");
   ```

4. **Emit more detailed events**
   - Include exchange rates used
   - Include gas costs for better tracking

### Medium-term (Features)

5. **Partial position closing**
   ```solidity
   function closePositionPartial(uint256 id, uint256 percentage) { }
   ```

6. **Add collateral to existing position**
   ```solidity
   function addCollateral(uint256 id, uint256 amount) { }
   ```

7. **Stop-loss automation**
   ```solidity
   function setStopLoss(uint256 id, uint256 triggerPrice) { }
   ```

8. **Multiple currency pair support**
   - GBP/USD
   - JPY/USD
   - etc.

### Long-term (Governance & Scaling)

9. **Parameter governance**
   ```solidity
   function updateLendingRate(uint256 newRate) onlyGovernance { }
   ```

10. **Insurance fund**
    - Reserve for covering insolvency
    - Funded by % of protocol fees

11. **Layer 2 deployment**
    - Lower gas costs
    - Better UX for traders

12. **Advanced order types**
    - Limit orders
    - Take-profit orders
    - Trailing stops

---

## Conclusion

TradeFX provides a novel approach to leveraged FX trading in DeFi by combining:
- Peer-to-pool lending
- Automated liquidations
- Time-based fees
- Integrated swaps

The system creates aligned incentives:
- **Traders** get leveraged exposure
- **LPs** earn yield from lending
- **Liquidators** maintain system health

Key to success:
1. Conservative liquidation parameters
2. Active liquidator ecosystem
3. Reliable oracle (FXEngine)
4. Sufficient LP liquidity

The contract is production-ready with minor fixes, though additional safety features (slippage protection, parameter governance) would improve robustness.

---

## Appendix: Common Questions

**Q: Can I short a currency?**
A: Yes, indirectly. To short EUR vs USD, you'd open a position where `start_token=EURC` and `pos_token=USDC`. You're effectively going long USD vs EUR, which is the same as shorting EUR vs USD.

**Q: What happens if there are no liquidators?**
A: Positions would go from LIQUIDATABLE to INSOLVENT, causing bad debt for the pool. This is why LiquidatorFee must be attractive enough to incentivize monitoring.

**Q: Can the pool run out of money?**
A: Yes, if utilization is 100% and LPs try to withdraw. The liquidity checks prevent this by blocking withdrawals when insufficient funds are available.

**Q: How are fees distributed to LPs?**
A: Fees increase the pool value, which increases LPT price. LPs earn by selling their LPT at a higher price than they bought it.

**Q: What's the maximum leverage?**
A: Theoretically unlimited, but practically limited by:
1. Available pool liquidity
2. Risk of immediate liquidation
3. Fee accumulation rate

**Q: Can I have multiple positions?**
A: Yes, the contract tracks an array of position IDs per user via `UserPositions[user]`.

**Q: What's FakeRate for?**
A: Testing and demonstration. Production should use FXEngine's actual oracle rate, not user-supplied values.

**Q: How often should I check my position?**
A: Depends on leverage and volatility. With 10x leverage, a 5% adverse move liquidates you. Check at least daily for high leverage, weekly for low leverage.

**Q: Can I recover from liquidation?**
A: You receive the remainder after fees and liquidator fee are paid. You could use this to open a new position if you still want exposure.

---

*End of Documentation*

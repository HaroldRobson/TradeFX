# TradeFX Frontend Integration Guide (Trader Features)

## 1. Overview for Frontend Devs

This guide covers everything you need to build the trader-facing components of the TradeFX user interface. We'll break down the two primary user stories: **opening a new position** and **managing existing positions**.

The core of the protocol is a single smart contract, `TradeFX`. All trader interactions will be with this contract. The user will need to connect their wallet (e.g., MetaMask) to interact with the application.

### Key Concept: The `FakeRate`

In our current testnet environment, the EUR/USD exchange rate is not read from a live on-chain oracle. Instead, it is supplied by the frontend with every relevant function call.

*   **Source:** You will receive a live stream of the EUR/USD price from a Kraken websocket.
*   **Format:** The contract requires the rate to be formatted as a `uint256`. It represents **how many USDC can be bought with 1 EUR (1e6 EURC)**.
    *   If EUR/USD = `1.10`, `FakeRate` = `1_100_000`.
    *   If EUR/USD = `1.05`, `FakeRate` = `1_050_000`.
    *   If EUR/USD = `0.98`, `FakeRate` = `980_000`. (however the contract asserts that the rate is greater than 1000000)
*   **Implementation:** You must pass this formatted `FakeRate` with every function call that requires it, such as opening, closing, or checking the value of a position.

---

## 2. UX Flow #1: Opening a New Position

This flow covers the UI where a user can configure and execute a new leveraged trade.

### Step 1: User Input & Configuration

The user needs to provide the following inputs:

| UI Element                                | Description                                                                                                                                              | Smart Contract Parameter | Data Type     | Example                               |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | ------------- | ------------------------------------- |
| **"You Pay" Token Selector**            | A dropdown to select either USDC or EURC. This is the token the user is depositing as collateral.                                                          | `start_token`            | `address`     | `0xUSDC_ADDRESS`                      |
| **"You Pay" Amount Input**              | A number input for the amount of collateral the user wants to deposit. This needs to be converted to a `uint256` with the correct decimals (usually 6). | `collateral`             | `uint256`     | `1000 * 1e6` (for 1,000 USDC)         |
| **"You Borrow" Amount Input**           | A number input for the amount the user wants to borrow from the pool. This determines the leverage.                                                        | `borrow`                 | `uint256`     | `4000 * 1e6` (for 4,000 USDC)         |
| **"You Get Exposure To" Token Selector** | The token the user wants to long. This must be the opposite of the "You Pay" token. Your UI should enforce this.                                         | `pos_token`              | `address`     | `0xEURC_ADDRESS`                      |
| **(Hidden) Live Exchange Rate**         | The latest rate from your Kraken websocket, formatted as described above.                                                                                | `FakeRate`               | `uint256`     | `1100000` (for a 1.10 rate)           |

**Calculating Leverage:** Your UI should display the effective leverage to the user. The formula is: `Leverage = (Collateral) / Borrow`.
*   Example: `(4000) / 1000 = 4x`

### Step 2: Pre-Transaction Checks (Client-Side)

Before enabling the "Open Position" button, your UI should perform these checks to provide a good user experience:

1.  **Check Allowance:** The user must approve the `TradeFX` contract to spend their `start_token`.
    *   Call the `allowance(userAddress, tradeFxContractAddress)` function on the `start_token`'s contract.
    *   If `allowance < collateral`, the user must first sign an `approve` transaction. Your UI should prompt them for this. The button should say "Approve USDC" instead of "Open Position".

2.  **Check Balance:** The user must have enough `start_token` in their wallet.
    *   Call `balanceOf(userAddress)` on the `start_token`'s contract.
    *   If `balance < collateral`, disable the button and show an "Insufficient Balance" message.

3.  **Check Pool Liquidity:** The protocol might not have enough funds for the user's desired borrow amount.
    *   This is a read-only check. Call the `checkLiquidity(token, amount)` function on the `TradeFX` contract.
    *   `token` is the `start_token` address, `amount` is the `borrow` amount.
    *   If this returns `false`, disable the button and show a message like "Insufficient pool liquidity for this borrow amount."

### Step 3: Executing the Transaction

When the user clicks "Open Position", you will call the `openPosition` function on the `TradeFX` contract.

**Function Signature:**
```solidity
function openPosition(
    address start_token,
    uint256 collateral,
    uint256 borrow,
    address pos_token,
    uint256 FakeRate
) public returns (uint256, uint256, uint256, uint256);
```

**Return Values:**
This function returns four crucial `uint256` values that you **must** capture and store. These are the initial parameters for the position's health display.

1.  `positionId`: The unique ID for this new position.
2.  `liquidation_barrier`: The **static** value of the position (in `start_token` terms) below which it can be liquidated.
3.  `insolvency_barrier`: The **static** value of the position below which it is insolvent. This is simply the `borrow` amount.
4.  `barrier_increase_per_10_000_seconds`: The amount by which the liquidation and insolvency thresholds increase every 10,000 seconds due to borrowing fees.

### Step 4: Handling the Response

*   **On Success:** A `NewPosition` event is emitted. You can listen for this event to confirm the transaction and update the UI. You should now see the new position in the user's list of open positions.
*   **On Failure:** The transaction will revert with an error message (e.g., `"Position could be liquidated immediately"`). Your UI should catch this error and display a user-friendly message.

---

## 3. UX Flow #2: Displaying and Managing Open Positions

This flow covers the UI dashboard where a user sees all their active trades.

### Step 1: Fetching User's Positions

1.  Get the user's connected wallet address.
2.  Call the `UserPositions(userAddress)` public mapping on the `TradeFX` contract. This will return an array of `uint256` position IDs that belong to the user.
3.  For each `positionId` in the array, call the `IDToPosition(positionId)` public mapping. This returns the `Position` struct with all its details.

### Step 2: Displaying Position Details

For each position, you should display a card or a row in a table with the following information, derived from the `Position` struct:

| UI Element              | Data Source (from `Position` struct)                                | Notes                                                                                                    |
| ----------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **Position ID**         | `id`                                                                | Display as `#1`, `#2`, etc.                                                                              |
| **Direction**           | `start_token` and `pos_token`                                       | If `pos_token` is EURC, display "Long EUR/USD". If `pos_token` is USDC, display "Short EUR/USD".        |
| **Size**                | `pos_token_amount` (in `pos_token`)                                 | The total size of the leveraged position. Format with correct decimals.                                  |
| **Collateral**          | `collateral` (in `start_token`)                                     | The user's initial deposit.                                                                              |
| **Leverage**            | `(collateral /borrowed)`                              | Calculate and display (e.g., "5.0x").                                                                    |
| **Entry Price**         | This is not stored on-chain. You should calculate and store this locally when the position is opened. |
| **Current Value**       | Mixture of Kraken for exchange rate, timestamp to see fees owed, pos_token_amount, and borrowed. Ask me if unsure of maths.
| **PnL (Profit/Loss)**   | `Current Value - collateral`                                        | Display in `start_token` and as a percentage. This is the unrealized profit or loss.                       |
| **Liquidation Price**   | **See section below.**                                              | The exchange rate at which the position becomes liquidatable. This is a dynamic value.               |
| **Action Button**       |                                                                     | A "Close Position" button.                                                                               |

### Step 3: The Dynamic Liquidation Graph (CRITICAL)

The `liquidation_barrier` and `insolvency_barrier` you receive from `openPosition` are **static**. They represent the position's value thresholds *at the moment of creation*. These thresholds increase over time due to fees. **It is the frontend's responsibility to calculate and display the current, time-adjusted thresholds.**

**Frontend Calculation Logic:**

1.  **Get static values from the stored position data:** `liquidation_barrier`, `insolvency_barrier`, `barrier_increase_per_10_000_seconds`, and `block_timestamp`.
2.  **Calculate time elapsed:** `time_elapsed = (current_unix_timestamp - block_timestamp)`.
3.  **Calculate total fees accrued:** `fees = (barrier_increase_per_10_000_seconds * time_elapsed) / 10_000`.
4.  **Calculate current thresholds:**
    *   `current_liquidation_threshold = liquidation_barrier + fees`.
    *   `current_insolvency_threshold = insolvency_barrier + fees`.

**Displaying on the Graph:**

You will receive these values as position values (e.g., "4,200 USDC" or "3500 EURC"). To plot them as dotted lines on the EUR/USD candlestick chart, you need to convert them into an exchange rate.

*   **Formula:** `Liquidation Price (EUR/USD) = current_liquidation_threshold / pos_token_amount` (adjust for decimals).
*   **Example:**
    *   `current_liquidation_threshold = 4280 * 1e6` (USDC)
    *   `pos_token_amount = 4000 * 1e6` (EURC)
    *   `Liquidation Price = 4280 / 4000 = 1.07`
*   Your frontend should recalculate these prices every few seconds and update the dotted lines on the chart. This visually shows the user how their liquidation price is "creeping up" towards the market price as fees accumulate.

### Step 4: Closing a Position

When the user clicks the "Close Position" button:

1.  Call the `closePosition(position_id, FakeRate)` function on the `TradeFX` contract.
2.  Pass the `position_id` of the position they want to close and the latest `FakeRate` from your websocket.
3.  The contract handles everything: swapping the assets back, repaying the debt and fees, and sending the profit/loss to the user's wallet.
4.  Listen for the `PositionClosed` event to confirm and remove the position from the UI. as with the other event, you can just use a successful transaction.

// Static demo positions shaped like the on-chain Position struct.
// All uint256 fields are represented as decimal strings to avoid precision issues.
//
// struct Position {
//   address start_token;
//   uint256 collateral;
//   uint256 converted_collateral;
//   uint256 borrowed;
//   uint256 converted_borrowed;
//   address pos_token;
//   uint256 pos_token_amount;
//   uint256 id;
//   address user;
//   uint256 block_timestamp;
//   uint256 lending_rate;
//   uint256 liquidation_barrier;
//   uint256 insolvency_barrier;
//   uint256 barrier_increase_per_10_000_seconds;
// }
//
// We also attach a few UI-only helper fields:
// - start_token_symbol, pos_token_symbol
// - pair, side, entryPrice, leverage

const nowSec = Math.floor(Date.now() / 1000);

/** @type {Array<Object>} */
const fakePositions = Array.from({ length: 20 }).map((_, idx) => {
  const id = idx + 1;
  const isEven = id % 2 === 0;

  // Alternate between USDC start_token (long EURC) and EURC start_token (short USDC)
  const start_token_symbol = isEven ? "EURC" : "USDC";
  const pos_token_symbol = isEven ? "USDC" : "EURC";

  const start_token =
    start_token_symbol === "USDC"
      ? "0x0000000000000000000000000000000000000US1"
      : "0x0000000000000000000000000000000000000EU1";

  const pos_token =
    pos_token_symbol === "USDC"
      ? "0x0000000000000000000000000000000000000US1"
      : "0x0000000000000000000000000000000000000EU1";

  // Collateral / borrowed scaled as 1e6 for USDC/EURC
  const baseNotional = 500 + id * 50; // 550, 600, ...
  const collateral = (baseNotional * 0.6 * 1e6).toFixed(0); // 60% collateral
  const converted_collateral = collateral;
  const borrowed = (baseNotional * 0.4 * 1e6).toFixed(0); // 40% borrowed
  const converted_borrowed = borrowed;

  const pos_token_amount = (baseNotional * 1e6).toFixed(0); // full notional in pos_token units

  const lending_rate_bps = 20 + id * 2; // vary a bit
  const lending_rate = String(lending_rate_bps); // store as bps

  const liquidation_barrier = (baseNotional * 0.98 * 1e6).toFixed(0); 
  const insolvency_barrier = (baseNotional * 0.95 * 1e6).toFixed(0); 

  const barrier_increase_per_10_000_seconds = 0.01 * 1e6 ;

  // Stagger timestamps over the past ~18 months
  const monthsAgo = 2 + (id % 12); // between 2 and 13 months ago
  const block_timestamp = String(nowSec - monthsAgo * 30 * 24 * 60 * 60);

  // UI helpers
  const pair = "USDC_EURC";
  const side = isEven ? "SHORT" : "LONG";
  const entryPrice = 1.0; // simplify: 1 USDC per 1 EURC
  const leverage = 3 + (id % 5); // between 3x and 7x

  return {
    // on-chain-like fields
    start_token,
    collateral,
    converted_collateral,
    borrowed,
    converted_borrowed,
    pos_token,
    pos_token_amount,
    id: String(id),
    user: `0x111111111111111111111111111111111111${id
      .toString()
      .padStart(2, "0")}`,
    block_timestamp,
    lending_rate,
    liquidation_barrier,
    insolvency_barrier,
    barrier_increase_per_10_000_seconds,

    // UI helper fields
    start_token_symbol,
    pos_token_symbol,
    pair,
    side,
    entryPrice,
    leverage,
  };
});

export default fakePositions;



// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import "../src/TradeFX.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "mUSDC") {}
    function mint(address to, uint256 amount) public {_mint(to, amount);}
    function decimals() public view override returns (uint8) {
        return 6; // Example: setting 6 decimals
    }
}
contract TradeFXTest is Test {
    TradeFX tradeFX;
    address public FXEngineAddress;
    MockUSDC public mUSDC;

    address constant EURC_ADDRESS = 0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a;
    address constant WHALE = 0x70E3Fb28e1794bb91D5bCEB7d66b731d0C61Af8e;

    IERC20 IMUSDC;
    IERC20 IEURC = IERC20(EURC_ADDRESS);

    address lp = makeAddr("LiquidityProvider");
    address trader = makeAddr("Trader");
    address liquidator = makeAddr("Liquidator");
    
    uint256 constant usdc_decimals = 1e6;
    uint256 constant eurc_decimals = 1e6;
    uint256 constant lpt_decimals = 1e18;

    function setUp() public {
        string memory rpcURL = "https://rpc.drpc.testnet.arc.network";
        vm.createSelectFork(rpcURL);

        mUSDC = new MockUSDC();
        IMUSDC = IERC20(address(mUSDC));

        console.log("--- SETUP: DEPLOYING CONTRACTS ---");
        uint256 initialLPTSupply = 10_000 * lpt_decimals;
        tradeFX = new TradeFX(initialLPTSupply, address(mUSDC), EURC_ADDRESS, address(0), 100, 500, 300, true);
        FXEngineAddress = tradeFX.FXEngineAddress();

        console.log("\n--- SETUP: FUNDING ACCOUNTS ---");
        uint256 engineFunding = 5_000_000 * usdc_decimals; 
        uint256 initialLiquidity = 20_000 * usdc_decimals;
        uint256 userFunding = 100_000 * usdc_decimals;

        mUSDC.mint(FXEngineAddress, engineFunding);
        mUSDC.mint(address(tradeFX), initialLiquidity);
        mUSDC.mint(lp, userFunding);
        mUSDC.mint(trader, userFunding);

        vm.startPrank(WHALE);
        IEURC.transfer(FXEngineAddress, engineFunding);
        IEURC.transfer(lp, userFunding);
        IEURC.transfer(trader, userFunding);
        vm.stopPrank();
    }

    function test_StandardLifecycle() public {
        console.log("\n==================================================");
        console.log("SCENARIO (i): LP PROVIDES LIQUIDITY");
        console.log("==================================================");
        uint256 rate_1_10 = 1_100_000;
        
        vm.startPrank(lp);
        uint256 lptToBuy = 20_000 * lpt_decimals;
        uint256 usdcPrice = tradeFX.getUSDCPrice(lptToBuy, rate_1_10);
        IMUSDC.approve(address(tradeFX), usdcPrice);
        tradeFX.buyLPTWithUSDC(lptToBuy, lp, rate_1_10);
        uint256 eurcPrice = tradeFX.getEURCPrice(lptToBuy, rate_1_10);
        IEURC.approve(address(tradeFX), eurcPrice);
        tradeFX.buyLPTWithEURC(lptToBuy, lp, rate_1_10);
        vm.stopPrank();
        console.log("LP Final LPT Balance:", tradeFX.balanceOf(lp) / lpt_decimals);

        console.log("\n==================================================");
        console.log("SCENARIO (ii): TRADER TAKES PROFITABLE POSITIONS");
        console.log("==================================================");
        
        uint256 traderInitialUSDC = IMUSDC.balanceOf(trader);
        uint256 collateralUSDC_5x = 1_000 * usdc_decimals;
        uint256 borrowUSDC_5x = 4_000 * usdc_decimals;

        vm.startPrank(trader);
        IMUSDC.approve(address(tradeFX), collateralUSDC_5x);
        (uint posId1,,,) = tradeFX.openPosition(address(mUSDC), collateralUSDC_5x, borrowUSDC_5x, EURC_ADDRESS, rate_1_10);
        vm.stopPrank();

        vm.warp(block.timestamp + 10_000);
        uint256 rate_1_15 = 1_150_000;

        vm.prank(trader);
        tradeFX.closePosition(posId1, rate_1_15);
        uint256 traderFinalUSDC = IMUSDC.balanceOf(trader);
        console.log("5x Position closed for profit:", (traderFinalUSDC - traderInitialUSDC) / usdc_decimals, "mUSDC");
        
        console.log("\n==================================================");
        console.log("SCENARIO (iv): HIGH LEVERAGE LIQUIDATION");
        console.log("==================================================");

        uint256 collateral_10x = 1_000 * usdc_decimals;
        uint256 borrow_10x = 9_000 * usdc_decimals;

        vm.startPrank(trader);
        IMUSDC.approve(address(tradeFX), collateral_10x);
        (uint posId3, , ,) = tradeFX.openPosition(address(mUSDC), collateral_10x, borrow_10x, EURC_ADDRESS, rate_1_15);
        vm.stopPrank();

        vm.warp(block.timestamp + 10_000);
        
        uint256 rate_1_08 = 1_080_000;

        console.log("\n--- PRE-LIQUIDATION STATE ANALYSIS (posId:", posId3, ") ---");
        
        // *** THE FIX: Destructure the 14 return values from the public getter ***
        (
            address start_token,
            , // collateral
            , // converted_collateral
            , // borrowed
            , // converted_borrowed
            address pos_token,
            uint256 pos_token_amount,
            , // id
            , // user
            , // block_timestamp
            , // lending_rate
            uint256 liquidation_barrier,
            uint256 insolvency_barrier,
        ) = tradeFX.IDToPosition(posId3);
        
        uint256 currentValue = tradeFX.engine().getRate(pos_token, start_token, pos_token_amount, rate_1_08);
        uint256 fees = tradeFX.calculateLendingFees(posId3);

        console.log("Leverage: 10x");
        console.log("Position Opened At Rate: 1.15");
        console.log("Current Check Rate: 1.08");
        console.log("Position EURC Amount:", pos_token_amount / eurc_decimals);
        console.log("-------------------------------------------------");
        console.log("Position Current Value:", currentValue / usdc_decimals, "mUSDC");
        console.log("-------------------------------------------------");
        console.log("Liquidation Barrier (static):", liquidation_barrier / usdc_decimals, "mUSDC");
        console.log("Accumulated Fees:", fees / usdc_decimals, "mUSDC");
        console.log("Total Liquidation Threshold:", (liquidation_barrier + fees) / usdc_decimals, "mUSDC  <-- MUST BE > CURRENT VALUE");
        console.log("-------------------------------------------------");
        console.log("Insolvency Barrier (static):", insolvency_barrier / usdc_decimals, "mUSDC");
        console.log("Total Insolvency Threshold:", (insolvency_barrier + fees) / usdc_decimals, "mUSDC  <-- MUST BE < CURRENT VALUE");
        console.log("-------------------------------------------------");

        TradeFX.Solvency status = tradeFX.checkSolvency(posId3, rate_1_08);
        
        if (status == TradeFX.Solvency.LIQUIDATABLE) {
            console.log("VERDICT: Position is LIQUIDATABLE! (Value is between thresholds)");
        } else if (status == TradeFX.Solvency.SOLVENT) {
            console.log("VERDICT: Position is SOLVENT! (Value is above liquidation threshold)");
        } else {
            console.log("VERDICT: Position is INSOLVENT! (Value is below insolvency threshold)");
        }
        
        require(status == TradeFX.Solvency.LIQUIDATABLE, "TEST FAILED: Position was expected to be liquidatable, but it is not.");
        
        console.log("\n--- PERFORMING LIQUIDATION ---");
        vm.prank(liquidator);
        tradeFX.liquidate(posId3, rate_1_08);
        console.log("Liquidation successful.");
    }
}

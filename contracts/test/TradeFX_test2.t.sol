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
        return 6;
    }
}

contract TradeFXComprehensiveTest is Test {
    TradeFX tradeFX;
    address public FXEngineAddress;
    MockUSDC public mUSDC;

    address constant EURC_ADDRESS = 0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a;
    address constant WHALE = 0x70E3Fb28e1794bb91D5bCEB7d66b731d0C61Af8e;
    
    uint256 constant usdc_decimals = 1e6;
    uint256 constant eurc_decimals = 1e6;
    uint256 constant lpt_decimals = 1e18;

    IERC20 IMUSDC;
    IERC20 IEURC = IERC20(EURC_ADDRESS);

    address lp = makeAddr("LiquidityProvider");
    address trader = makeAddr("Trader");
    address liquidator = makeAddr("Liquidator");
    
    function setUp() public {
        string memory rpcURL = "https://rpc.drpc.testnet.arc.network";
        vm.createSelectFork(rpcURL);

        mUSDC = new MockUSDC();
        IMUSDC = IERC20(address(mUSDC));

        uint256 initialLPTSupply = 10_000 * lpt_decimals;
        tradeFX = new TradeFX(initialLPTSupply, address(mUSDC), EURC_ADDRESS, address(0), 100, 500, 300, true);
        FXEngineAddress = tradeFX.FXEngineAddress();

        uint256 engineFunding = 5_000_000 * usdc_decimals; 
        uint256 initialLiquidity = 20_000 * usdc_decimals;
        uint256 userFunding = 500_000 * usdc_decimals;

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

    function test_HappyPath_StandardLifecycle() public {
        console.log("--- TEST: Standard Lifecycle ---");
        uint256 rate_1_10 = 1_100_000;
        vm.startPrank(lp);
        uint256 lptToBuy = 20_000 * lpt_decimals;
        uint256 usdcPrice = tradeFX.getUSDCPrice(lptToBuy, rate_1_10);
        IMUSDC.approve(address(tradeFX), usdcPrice);
        tradeFX.buyLPTWithUSDC(lptToBuy, lp, rate_1_10);
        vm.stopPrank();
        console.log("LP provided liquidity successfully.");

        uint256 traderInitialUSDC = IMUSDC.balanceOf(trader);
        vm.startPrank(trader);
        IMUSDC.approve(address(tradeFX), 1_000 * usdc_decimals);
        (uint posId1,,,) = tradeFX.openPosition(address(mUSDC), 1_000 * usdc_decimals, 4_000 * usdc_decimals, EURC_ADDRESS, rate_1_10);
        vm.stopPrank();

        vm.warp(block.timestamp + 10_000); 
        uint256 rate_1_15 = 1_150_000;
        vm.prank(trader);
        tradeFX.closePosition(posId1, rate_1_15);
        uint256 traderFinalUSDC = IMUSDC.balanceOf(trader);
        assertTrue(traderFinalUSDC > traderInitialUSDC, "Trader should have made a profit");
        console.log("Trader closed position for a profit.");
        
        vm.startPrank(trader);
        IMUSDC.approve(address(tradeFX), 1_000 * usdc_decimals);
        (uint posId2, , ,) = tradeFX.openPosition(address(mUSDC), 1_000 * usdc_decimals, 9_000 * usdc_decimals, EURC_ADDRESS, rate_1_15);
        vm.stopPrank();

        vm.warp(block.timestamp + 10_000);
        uint256 rate_1_08 = 1_080_000;

        TradeFX.Solvency status = tradeFX.checkSolvency(posId2, rate_1_08);
        assertEq(uint(status), uint(TradeFX.Solvency.LIQUIDATABLE), "Position should be liquidatable");
        console.log("Position correctly identified as LIQUIDATABLE.");

        uint256 liquidatorInitialUSDC = IMUSDC.balanceOf(liquidator);
        vm.prank(liquidator);
        tradeFX.liquidate(posId2, rate_1_08);
        uint256 liquidatorFinalUSDC = IMUSDC.balanceOf(liquidator);
        assertTrue(liquidatorFinalUSDC > liquidatorInitialUSDC, "Liquidator should have earned a fee");
        console.log("Liquidator successfully liquidated the position and earned a fee.");
    }

    function test_UnhappyPath_Insolvency() public {
        console.log("--- TEST: Insolvency due to severe price drop ---");
        uint256 rate_1_15 = 1_150_000;
        
        vm.startPrank(lp);
        uint256 lptToBuy = 50_000 * lpt_decimals;
        uint256 usdcPrice = tradeFX.getUSDCPrice(lptToBuy, rate_1_15);
        IMUSDC.approve(address(tradeFX), usdcPrice);
        tradeFX.buyLPTWithUSDC(lptToBuy, lp, rate_1_15);
        vm.stopPrank();

        vm.startPrank(trader);
        IMUSDC.approve(address(tradeFX), 1_000 * usdc_decimals);
        (uint posId, , ,) = tradeFX.openPosition(address(mUSDC), 1_000 * usdc_decimals, 9_000 * usdc_decimals, EURC_ADDRESS, rate_1_15);
        vm.stopPrank();

        vm.warp(block.timestamp + 5_000);
        uint256 rate_crash = 1_010_000;

        TradeFX.Solvency status = tradeFX.checkSolvency(posId, rate_crash);
        assertEq(uint(status), uint(TradeFX.Solvency.INSOLVENT), "Position should be INSOLVENT");
        console.log("Position correctly identified as INSOLVENT.");
        
        // FIX: Compare pool value BEFORE and AFTER using the SAME crash rate to isolate the bad debt loss.
        uint256 poolValueBefore = tradeFX.getValueOfPool(rate_crash, address(mUSDC));
        console.log(poolValueBefore);
        vm.prank(trader);
        tradeFX.closePosition(posId, rate_crash);

        uint256 poolValueAfter = tradeFX.getValueOfPool(rate_crash, address(mUSDC));
        console.log(poolValueAfter);
        assertTrue(poolValueAfter < poolValueBefore, "Pool value should decrease after absorbing bad debt");
        console.log("Pool value decreased, correctly reflecting the bad debt.");
    }

    function test_Revert_LpBankRun() public {
        console.log("--- TEST: LP withdrawal blocked by high utilization ('Bank Run') ---");
        uint256 rate = 1_100_000;
        
        vm.startPrank(lp);
        uint256 lptToBuy = 100_000 * lpt_decimals;
        uint256 lpDepositPrice = tradeFX.getUSDCPrice(lptToBuy, rate);
        IMUSDC.approve(address(tradeFX), lpDepositPrice);
        tradeFX.buyLPTWithUSDC(lptToBuy, lp, rate);
        vm.stopPrank();
        console.log("LP provided liquidity.");

        // FIX: Create a healthy, low-leverage position that achieves high utilization.
        uint256 totalPoolUSDC = IMUSDC.balanceOf(address(tradeFX));
        uint256 borrowAmount = (totalPoolUSDC * 95) / 100;
        uint256 collateralAmount = (borrowAmount * 10) / 100; // 10% collateral, healthy 10x leverage

        vm.startPrank(trader);
        IMUSDC.approve(address(tradeFX), collateralAmount);
        tradeFX.openPosition(address(mUSDC), collateralAmount, borrowAmount, EURC_ADDRESS, rate);
        vm.stopPrank();
        console.log("Trader borrowed 95% of the pool's USDC in a healthy position.");

        vm.prank(lp);
        vm.expectRevert(bytes("Run on the bank situation"));
        tradeFX.sellLPTForUSDC(lptToBuy, lp, rate);
        console.log("LP withdrawal correctly reverted due to insufficient available funds.");
    }
    
    function test_Revert_ZeroValueInputs() public {
        console.log("--- TEST: Functions revert on zero-value or invalid inputs ---");
        uint256 rate = 1_100_000;
        
        // FIX: Use vm.startPrank and vm.stopPrank for clear context management.
        vm.startPrank(trader);
        IMUSDC.approve(address(tradeFX), 1000 * usdc_decimals);
        vm.expectRevert(bytes("Position could be liquidated immediately")); 
        tradeFX.openPosition(address(mUSDC), 0, 1000 * usdc_decimals, EURC_ADDRESS, rate);
        vm.stopPrank();
        console.log("openPosition reverted with zero collateral as expected.");
        
        uint256 initialPositions = tradeFX.PositionIDCounter();
        vm.startPrank(trader);
        IMUSDC.approve(address(tradeFX), 1000 * usdc_decimals);
        // FIX: A tiny borrow amount should NOT revert. It's a valid position.
        tradeFX.openPosition(address(mUSDC), 1000 * usdc_decimals, 1 * 1e2, EURC_ADDRESS, rate); // 100 wei borrow
        uint256 finalPositions = tradeFX.PositionIDCounter();
        assertTrue(finalPositions > initialPositions, "Position with minimal borrow should be created.");
        vm.stopPrank();
        console.log("openPosition with minimal borrow succeeded as expected.");

        uint256 initialLPT = tradeFX.balanceOf(lp);
        vm.prank(lp);
        // FIX: Buying 0 LPT is a no-op that shouldn't revert.
        tradeFX.buyLPTWithUSDC(0, lp, rate);
        uint256 finalLPT = tradeFX.balanceOf(lp);
        assertEq(initialLPT, finalLPT, "Buying 0 LPT should not change balance.");
        console.log("buyLPT with zero amount succeeded without state change as expected.");
    }

    function test_Unit_FeeCalculationIsCorrect() public {
        console.log("--- TEST: Fee calculation is precise over time ---");
        uint256 rate = 1_100_000;
        
        uint256 borrowAmount = 10_000 * usdc_decimals;
        
        vm.startPrank(trader);
        IMUSDC.approve(address(tradeFX), 5_000 * usdc_decimals);
        (uint posId, , , uint barrier_increase) = tradeFX.openPosition(address(mUSDC), 5_000 * usdc_decimals, borrowAmount, EURC_ADDRESS, rate);
        vm.stopPrank();

        uint snapshotId = vm.snapshot();
        uint timeToAdvance = 20_000;
        vm.warp(block.timestamp + timeToAdvance);

        uint256 expectedFees = (barrier_increase * timeToAdvance) / 10_000;
        uint256 actualFees = tradeFX.calculateLendingFees(posId);
        assertEq(actualFees, expectedFees, "Fee calculation is incorrect after time warp");
        console.log("Fee calculation is correct.");

        vm.revertTo(snapshotId);
        console.log("State reverted via snapshot.");
    }

function test_Debug_Insolvency_State_Changes() public {
        console.log("--- TEST: Deep Debug of Insolvency State Changes ---");
        uint256 rate_1_15 = 1_150_000;
        
        // 1. Setup liquidity
        vm.startPrank(lp);
        uint256 lptToBuy = 50_000 * lpt_decimals;
        uint256 usdcPrice = tradeFX.getUSDCPrice(lptToBuy, rate_1_15);
        IMUSDC.approve(address(tradeFX), usdcPrice);
        tradeFX.buyLPTWithUSDC(lptToBuy, lp, rate_1_15);
        vm.stopPrank();

        // 2. Open a high-leverage position
        vm.startPrank(trader);
        IMUSDC.approve(address(tradeFX), 1_000 * usdc_decimals);
        (uint posId, , ,) = tradeFX.openPosition(address(mUSDC), 1_000 * usdc_decimals, 9_000 * usdc_decimals, EURC_ADDRESS, rate_1_15);
        vm.stopPrank();
        
        // 3. Simulate time and a market crash
        vm.warp(block.timestamp + 5_000);
        uint256 rate_crash = 1_010_000;

        TradeFX.Solvency status = tradeFX.checkSolvency(posId, rate_crash);
        assertEq(uint(status), uint(TradeFX.Solvency.INSOLVENT), "Position should be INSOLVENT");
        console.log("Position correctly identified as INSOLVENT.");
        
        // =============================================================
        // LOGGING STATE: BEFORE INSOLVENCY HANDLING
        // =============================================================
        console.log("\n--- STATE BEFORE INSOLVENCY ---");
        console.log("Valuation Rate:", rate_crash);
        
        uint256 poolValueBefore = tradeFX.getValueOfPool(rate_crash, address(mUSDC));
        console.log("Pool Value:", poolValueBefore);
        console.log("--- Accounting State ---");
        console.log("USDCBorrowed:", tradeFX.USDCBorrowed());
        console.log("EURCBorrowed:", tradeFX.EURCBorrowed());
        console.log("USDCBorrowedFromEURC:", tradeFX.USDCBorrowedFromEURC());
        console.log("EURCBorrowedFromUSDC:", tradeFX.EURCBorrowedFromUSDC());
        console.log("USDCCollateral:", tradeFX.USDCCollateral());
        console.log("EURCCollateral:", tradeFX.EURCCollateral());
        console.log("--- Physical Balances ---");
        console.log("Contract mUSDC Balance:", IMUSDC.balanceOf(address(tradeFX)));
        console.log("Contract EURC Balance:", IEURC.balanceOf(address(tradeFX)));

        // 4. Trigger insolvency handling
        vm.prank(trader);
        tradeFX.closePosition(posId, rate_crash);

        // =============================================================
        // LOGGING STATE: AFTER INSOLVENCY HANDLING
        // =============================================================
        console.log("\n--- STATE AFTER INSOLVENCY ---");
        console.log("Valuation Rate:", rate_crash);

        uint256 poolValueAfter = tradeFX.getValueOfPool(rate_crash, address(mUSDC));
        console.log("Pool Value:", poolValueAfter);
        console.log("--- Accounting State ---");
        console.log("USDCBorrowed:", tradeFX.USDCBorrowed());
        console.log("EURCBorrowed:", tradeFX.EURCBorrowed());
        console.log("USDCBorrowedFromEURC:", tradeFX.USDCBorrowedFromEURC());
        console.log("EURCBorrowedFromUSDC:", tradeFX.EURCBorrowedFromUSDC());
        console.log("USDCCollateral:", tradeFX.USDCCollateral());
        console.log("EURCCollateral:", tradeFX.EURCCollateral());
        console.log("--- Physical Balances ---");
        console.log("Contract mUSDC Balance:", IMUSDC.balanceOf(address(tradeFX)));
        console.log("Contract EURC Balance:", IEURC.balanceOf(address(tradeFX)));

        // This assertion will fail, but the logs above will prove why.
        assertTrue(poolValueAfter < poolValueBefore, "Pool value should decrease after absorbing bad debt");
    }
}

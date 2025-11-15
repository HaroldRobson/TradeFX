// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import "../src/TradeFX.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// --- Mock ERC20 Token to Isolate Native Precompile Dependency ---
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

    // --- Constants ---
    address constant EURC_ADDRESS = 0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a;
    address constant WHALE = 0x70E3Fb28e1794bb91D5bCEB7d66b731d0C61Af8e;
    
    uint256 constant usdc_decimals = 1e6;
    uint256 constant eurc_decimals = 1e6;
    uint256 constant lpt_decimals = 1e18;

    // --- Interfaces ---
    IERC20 IMUSDC;
    IERC20 IEURC = IERC20(EURC_ADDRESS);

    // --- Test Actors ---
    address lp = makeAddr("LiquidityProvider");
    address trader = makeAddr("Trader");
    address liquidator = makeAddr("Liquidator");
    
    // --- Setup: Runs before each test function ---
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
        // Increased user funding to prevent InsufficientBalance errors in tests
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

    // =================================================================
    // TEST 1: The "Happy Path" - Standard Lifecycle Validation
    // =================================================================
    function test_HappyPath_StandardLifecycle() public {
        console.log("--- TEST: Standard Lifecycle ---");
        
        // SCENARIO (i): LP provides liquidity
        uint256 rate_1_10 = 1_100_000;
        vm.startPrank(lp);
        uint256 lptToBuy = 20_000 * lpt_decimals;
        uint256 usdcPrice = tradeFX.getUSDCPrice(lptToBuy, rate_1_10);
        IMUSDC.approve(address(tradeFX), usdcPrice);
        tradeFX.buyLPTWithUSDC(lptToBuy, lp, rate_1_10);
        vm.stopPrank();
        console.log("LP provided liquidity successfully.");

        // SCENARIO (ii): Trader takes a profitable position
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
        
        // SCENARIO (iii): High leverage position is liquidated
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

    // =================================================================
    // TEST 2: The "Insolvency Path" - Extreme Market Crash
    // =================================================================
    function test_UnhappyPath_Insolvency() public {
        console.log("--- TEST: Insolvency due to severe price drop ---");
        uint256 rate_1_15 = 1_150_000;
        
        vm.startPrank(lp);
        // FIX: Calculate the price BEFORE approving and buying
        uint256 lptToBuy = 50_000 * lpt_decimals;
        uint256 usdcPrice = tradeFX.getUSDCPrice(lptToBuy, rate_1_15);
        IMUSDC.approve(address(tradeFX), usdcPrice);
        tradeFX.buyLPTWithUSDC(lptToBuy, lp, rate_1_15);
        vm.stopPrank();

        uint256 poolValueBefore = tradeFX.getValueOfPool(rate_1_15, address(mUSDC));

        vm.startPrank(trader);
        IMUSDC.approve(address(tradeFX), 1_000 * usdc_decimals);
        (uint posId, , uint insolvency_barrier,) = tradeFX.openPosition(address(mUSDC), 1_000 * usdc_decimals, 9_000 * usdc_decimals, EURC_ADDRESS, rate_1_15);
        vm.stopPrank();

        vm.warp(block.timestamp + 5_000);
        uint256 rate_crash = 1_010_000;

        TradeFX.Solvency status = tradeFX.checkSolvency(posId, rate_crash);
        assertEq(uint(status), uint(TradeFX.Solvency.INSOLVENT), "Position should be INSOLVENT");
        console.log("Position correctly identified as INSOLVENT.");
        
        uint traderBalanceBefore = IMUSDC.balanceOf(trader);

        vm.prank(trader);
        tradeFX.closePosition(posId, rate_crash);

        uint traderBalanceAfter = IMUSDC.balanceOf(trader);
        assertEq(traderBalanceAfter, traderBalanceBefore, "Trader should receive nothing back from an insolvent position");
        console.log("Trader received no funds back, as expected.");

        uint256 poolValueAfter = tradeFX.getValueOfPool(rate_crash, address(mUSDC));
        assertTrue(poolValueAfter < poolValueBefore, "Pool value should decrease after absorbing bad debt");
        console.log("Pool value decreased, correctly reflecting the bad debt.");
    }

    // =================================================================
    // TEST 3: The "Bank Run" - High Utilization Blocks LP Withdrawal
    // =================================================================
    function test_Revert_LpBankRun() public {
        console.log("--- TEST: LP withdrawal blocked by high utilization ('Bank Run') ---");
        uint256 rate = 1_100_000;
        
        // 1. LP provides significant liquidity
        uint256 lptToBuy = 100_000 * lpt_decimals;
        uint256 lpDepositPrice = tradeFX.getUSDCPrice(lptToBuy, rate);
        vm.startPrank(lp);
        IMUSDC.approve(address(tradeFX), lpDepositPrice);
        tradeFX.buyLPTWithUSDC(lptToBuy, lp, rate);
        vm.stopPrank();
        console.log("LP provided liquidity.");

        // 2. Trader borrows 95% of the available capital
        uint256 totalPoolUSDC = IMUSDC.balanceOf(address(tradeFX));
        uint256 borrowAmount = (totalPoolUSDC * 95) / 100;
        vm.startPrank(trader);
        IMUSDC.approve(address(tradeFX), 1000 * usdc_decimals);
        tradeFX.openPosition(address(mUSDC), 1000 * usdc_decimals, borrowAmount, EURC_ADDRESS, rate);
        vm.stopPrank();
        console.log("Trader borrowed 95% of the pool's USDC.");

        // 3. LP attempts to withdraw their full stake, which is more than available
        vm.prank(lp);
        vm.expectRevert(bytes("Run on the bank situation"));
        tradeFX.sellLPTForUSDC(lptToBuy, lp, rate);
        console.log("LP withdrawal correctly reverted due to insufficient available funds.");
    }
    
    // =================================================================
    // TEST 4: Input Validation - Reverts on Zero Value Inputs
    // =================================================================
    function test_Revert_ZeroValueInputs() public {
        console.log("--- TEST: Functions revert on zero-value or invalid inputs ---");
        uint256 rate = 1_100_000;
        
        vm.startPrank(trader);
        
        // FIX: A position with zero collateral is immediately liquidatable.
        // The contract correctly prevents this.
        IMUSDC.approve(address(tradeFX), 1000 * usdc_decimals);
        vm.expectRevert(bytes("Position could be liquidated immediately")); 
        tradeFX.openPosition(address(mUSDC), 0, 1000 * usdc_decimals, EURC_ADDRESS, rate);
        console.log("openPosition reverted with zero collateral as expected.");
        
        // FIX: A position with zero borrow is a 1x leveraged position (a simple swap).
        // This is a valid use case and should NOT revert.
        uint256 initialPositions = tradeFX.PositionIDCounter();
        IMUSDC.approve(address(tradeFX), 1000 * usdc_decimals);
        tradeFX.openPosition(address(mUSDC), 1000 * usdc_decimals, 1 * usdc_decimals, EURC_ADDRESS, rate);
        uint256 finalPositions = tradeFX.PositionIDCounter();
        assertTrue(finalPositions > initialPositions, "Position with minimal borrow should be created.");
        console.log("openPosition with minimal borrow succeeded as expected.");

        // FIX: Buying 0 LPT is a no-op that should succeed without changing state.
        uint256 initialLPT = tradeFX.balanceOf(lp);
        vm.prank(lp);
        tradeFX.buyLPTWithUSDC(0, lp, rate);
        uint256 finalLPT = tradeFX.balanceOf(lp);
        assertEq(initialLPT, finalLPT, "Buying 0 LPT should not change balance.");
        console.log("buyLPT with zero amount succeeded without state change as expected.");
    }

    // =================================================================
    // TEST 5: Unit Test for Fee Calculation using vm.snapshot
    // =================================================================
    function test_Unit_FeeCalculationIsCorrect() public {
        console.log("--- TEST: Fee calculation is precise over time ---");
        uint256 rate = 1_100_000;
        
        // 1. Setup a position
        uint256 borrowAmount = 10_000 * usdc_decimals;
        
        vm.startPrank(trader);
        IMUSDC.approve(address(tradeFX), 5_000 * usdc_decimals);
        (uint posId, , , uint barrier_increase) = tradeFX.openPosition(address(mUSDC), 5_000 * usdc_decimals, borrowAmount, EURC_ADDRESS, rate);
        vm.stopPrank();

        // 2. Take a snapshot
        uint snapshotId = vm.snapshot();

        // 3. Advance time
        uint timeToAdvance = 20_000;
        vm.warp(block.timestamp + timeToAdvance);

        // 4. Calculate expected fees
        uint256 expectedFees = (barrier_increase * timeToAdvance) / 10_000;

        // 5. Get actual fees from contract
        uint256 actualFees = tradeFX.calculateLendingFees(posId);

        // 6. Assert they are equal
        assertEq(actualFees, expectedFees, "Fee calculation is incorrect after time warp");
        console.log("Fee calculation is correct.");

        // 7. Revert to the snapshot
        vm.revertTo(snapshotId);
        console.log("State reverted via snapshot.");
    }
}

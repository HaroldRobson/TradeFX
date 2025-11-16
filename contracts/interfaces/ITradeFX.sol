// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

interface TradeFX {
    type Solvency is uint8;

    error ERC20InsufficientAllowance(address spender, uint256 allowance, uint256 needed);
    error ERC20InsufficientBalance(address sender, uint256 balance, uint256 needed);
    error ERC20InvalidApprover(address approver);
    error ERC20InvalidReceiver(address receiver);
    error ERC20InvalidSender(address sender);
    error ERC20InvalidSpender(address spender);
    error ReentrancyGuardReentrantCall();

    event Approval(address indexed owner, address indexed spender, uint256 value);
    event InsolventPositionClosed(
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
    event LPTokenPurchased(
        address purchaser, address purchase_token, uint256 purchase_token_amount, uint256 lp_token_amount
    );
    event LPTokenSold(address seller, address sale_token, uint256 sale_token_amount, uint256 lp_token_amount);
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
    event PositionClosed(
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
    event PositionLiquidated(
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
        uint256 barrier_increase_per_10_000_seconds,
        address liquidator
    );
    event Transfer(address indexed from, address indexed to, uint256 value);

    function EURCBorrowed() external view returns (uint256);
    function EURCBorrowedFromUSDC() external view returns (uint256);
    function EURCCollateral() external view returns (uint256);
    function IDToPosition(uint256)
        external
        view
        returns (
            address start_token,
            uint256 collateral,
            uint256 converted_collateral,
            uint256 borrowed,
            uint256 converted_borrowed,
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
    function LendingRate() external view returns (uint256);
    function LiquidationBuffer() external view returns (uint256);
    function LiquidatorFee() external view returns (uint256);
    function PositionIDCounter() external view returns (uint256);
    function USDCBorrowed() external view returns (uint256);
    function USDCBorrowedFromEURC() external view returns (uint256);
    function USDCCollateral() external view returns (uint256);
    function UserPositions(address, uint256) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function buyLPTWithEURC(uint256 amount, address recipient, uint256 FakeRate) external;
    function buyLPTWithUSDC(uint256 amount, address recipient, uint256 FakeRate) external;
    function calculateLendingFees(uint256 position_id) external view returns (uint256);
    function calculateLiquidatorFee(uint256 position_id, uint256 FakeRate) external view returns (uint256);
    function calculateOwedWithFees(uint256 position_id) external view returns (uint256);
    function checkSolvency(uint256 position_id, uint256 FakeRate) external view returns (Solvency);
    function closePosition(uint256 position_id, uint256 FakeRate) external;
    function decimals() external view returns (uint8);
    function getEURCPrice(uint256 amount, uint256 FakeRate) external view returns (uint256);
    function getEURCPricePerLPT(uint256 FakeRate) external view returns (uint256);
    function getUSDCPrice(uint256 amount, uint256 FakeRate) external view returns (uint256);
    function getUSDCPricePerLPT(uint256 FakeRate) external view returns (uint256);
    function getValueOfPool(uint256 FakeRate, address token) external view returns (uint256);
    function liquidate(uint256 position_id, uint256 FakeRate) external;
    function name() external view returns (string memory);
    function openPosition(address start_token, uint256 collateral, uint256 borrow, address pos_token, uint256 FakeRate)
        external
        payable
        returns (uint256, uint256, uint256, uint256);
    function sellLPTForEURC(uint256 amount, address recipient, uint256 FakeRate) external;
    function sellLPTForUSDC(uint256 amount, address recipient, uint256 FakeRate) external;
    function symbol() external view returns (string memory);
    function totalSupply() external view returns (uint256);
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}

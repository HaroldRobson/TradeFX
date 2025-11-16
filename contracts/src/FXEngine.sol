pragma solidity ^0.8.0;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract FXEngine { // this is our very simple mockup of the proposed Arc FXEngine.
    address TRADEFX; // only let TradeFX use this (so we dont get out testnet tokens stolen as easily)
    address OWNER;
    address USDC;
    address EURC;
    IERC20 IUSDC;
    IERC20 IEURC;
    // also FakeRate is not a state - it is made each time the functions are called

    modifier onlyTradeFXorOwner() {
        require(msg.sender == TRADEFX || msg.sender == OWNER);
        _;
    }

    constructor(address _tradefx, address usdc, address eurc, address owner) {
        USDC = usdc;
        EURC = eurc;
        IUSDC = IERC20(USDC);
        IEURC = IERC20(EURC);
        TRADEFX = _tradefx;
        OWNER = owner;
    }

    function swapExactTokensForTokens(
        address tokenA,
        address tokenB,
        uint256 amountA,
        address recipient,
        uint256 FakeRate
    ) external returns (uint256) {
        require(FakeRate > 1e6, "You messed up the decimal point/ trade direction"); // FakeRate is how many USDC 1e6 EURC can buy
        require(tokenA != tokenB, "cannot swap a token for itself");
        require(tokenA == USDC || tokenA == EURC, "invalid token choice");
        require(tokenB == USDC || tokenB == EURC, "invalid token choice");

        if (tokenA == EURC) {
            IEURC.transferFrom(msg.sender, address(this), amountA);
            uint256 return_amount = FakeRate * amountA / 1e6;
            IUSDC.transfer(recipient, return_amount);
            return return_amount;
        }

        if (tokenA == USDC) {
            IUSDC.transferFrom(msg.sender, address(this), amountA);
            uint256 return_amount = amountA * 1e6 / FakeRate;
            IEURC.transfer(recipient, return_amount);
            return return_amount;
        }

        revert("BAD TOKEN ADDRESSES SUPPLIED");
    }

    function getRate(address tokenA, address tokenB, uint256 amountA, uint256 FakeRate)
        external
        view
        returns (uint256)
    {
        require(FakeRate > 1e6, "You messed up the decimal point/ trade direction"); // FakeRate is how many USDC 1e6 EURC can buy
        require(tokenA != tokenB, "cannot swap a token for itself");
        require(tokenA == USDC || tokenA == EURC, "invalid token choice");
        require(tokenB == USDC || tokenB == EURC, "invalid token choice");

        if (tokenA == EURC) {
            uint256 return_amount = FakeRate * amountA/ 1e6;
            return return_amount;
        }

        if (tokenA == USDC) {
            uint256 return_amount = amountA * 1e6 / FakeRate;
            return return_amount;
        }

        revert("BAD TOKEN ADDRESSES SUPPLIED");
    }

    function withdraw(address token, uint256 amount, address recipient) external onlyTradeFXorOwner {
        // in case we need to redeploy
        if (token == USDC) {
            IUSDC.transfer(recipient, amount);
            return;
        }

        if (token == EURC) {
            IEURC.transfer(recipient, amount);
            return;
        } else {
            revert("INVALID TOKEN");
        }
    }
}

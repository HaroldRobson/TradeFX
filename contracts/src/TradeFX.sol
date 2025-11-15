pragma solidity ^0.8.0;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

interface FXEngine {
    function swapExactTokensForTokens(
        address tokenA,
        address tokenB,
        uint256 amountA,
        address recipient,
        uint256 FakeRate
    ) external returns (uint256);
    function getRate(address tokenA, address tokenB, uint256 amountA, uint256 FakeRate)
        external
        view
        returns (uint256);
    function setRate(uint256 EURToDoll) external; // How many dollars can you buy with 1e6 euros?
}

contract TradeFX is ERC20, ReentrancyGuard {
    uint256 public LiquidationBuffer; // How close you can get to insolvency before you're liquidated in bsps.
    uint256 public USDCBorrowed; // borrowed then converted to EURC for user's position
    uint256 public EURCBorrowed;
    uint256 public USDCBorrowedFromEURC; // borrowed funds after conversion
    uint256 public EURCBorrowedFromUSDC;
    uint256 public USDCCollateral; // must be traded back to pay EURCCollateral
    uint256 public EURCCollateral;
    uint256 public PositionIDCounter;
    uint256 public LiquidatorFee; // in bsps
    address USDC;
    address EURC;
    uint256 public LendingRate; // bsps per 10,000 seconds.
    IERC20 IUSDC;
    IERC20 IEURC;
    FXEngine engine;

    mapping(uint256 => Position) public IDToPosition;
    mapping(address => uint256[]) public UserPositions;

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

    struct Position {
        address start_token;
        uint256 collateral;
        uint256 converted_collateral; // how much collateral after conversion
        uint256 borrowed;
        uint256 converted_borrowed;
        address pos_token;
        uint256 pos_token_amount;
        uint256 id;
        address user;
        uint256 block_timestamp;
        uint256 lending_rate; // recorded when position opened.
        uint256 liquidation_barrier;
        uint256 insolvency_barrier;
        uint256 barrier_increase_per_10_000_seconds;
    }

    enum Solvency {
        SOLVENT,
        LIQUIDATABLE,
        INSOLVENT // if this ever happens we're in trouble. ideally position is liquidated before being fully insolvent

    }

    constructor(
        uint256 initialSupply,
        address usdc,
        address eurc,
        address FXENGINE,
        uint256 _lending_rate,
        uint256 _liquidation_buffer,
        uint256 _liquidator_fee
    ) ERC20("TradeFX Liquidity Token", "TFXL") {
        _mint(msg.sender, initialSupply);
        USDC = usdc;
        EURC = eurc;
        engine = FXEngine(FXENGINE);
        LendingRate = _lending_rate;
        LiquidationBuffer = _liquidation_buffer;
        LiquidatorFee = _liquidator_fee;
        IUSDC = IERC20(USDC);
        IEURC = IERC20(EURC);
    }

    function checkLiquidity(address token, uint256 amount) internal returns (bool) {
        if (token == USDC) {
            uint256 balance = IUSDC.balanceOf(address(this));
            uint256 available = balance - USDCCollateral - USDCBorrowedFromEURC;
            return available >= amount;
        }
        if (token == EURC) {
            uint256 balance = IEURC.balanceOf(address(this));
            uint256 available = balance - EURCCollateral - EURCBorrowedFromUSDC;
            return available >= amount;
        }

        return false;
    }

    function checkSolvency(uint256 position_id, uint256 FakeRate) public view returns (Solvency) {
        uint256 fees = calculateLendingFees(position_id);
        uint256 value = engine.getRate(
            IDToPosition[position_id].pos_token,
            IDToPosition[position_id].start_token,
            IDToPosition[position_id].pos_token_amount,
            FakeRate
        );

        if (value > fees + IDToPosition[position_id].liquidation_barrier) {
            return Solvency.SOLVENT;
        }

        if (value > fees + IDToPosition[position_id].insolvency_barrier) {
            return Solvency.LIQUIDATABLE;
        }

        return Solvency.INSOLVENT;
    }

    function calculateLiquidatorFee(uint256 position_id, uint256 FakeRate) public view returns (uint256) {
        if (checkSolvency(position_id, FakeRate) == Solvency.SOLVENT) {
            return 0;
        }
        uint256 pos_value_in_start_token = engine.getRate(
            IDToPosition[position_id].pos_token,
            IDToPosition[position_id].start_token,
            IDToPosition[position_id].pos_token_amount,
            FakeRate
        );
        uint256 fee = (pos_value_in_start_token - calculateOwedWithFees(position_id)) * LiquidatorFee / uint256(10_000);
        if (checkSolvency(position_id, FakeRate) == Solvency.LIQUIDATABLE) {
            return fee;
        }
        // if we gave any fee to liquidators liquidating insolvency, there would be scenarios in which they are incentivised not to liquidate a liquidatable position.
        return 0;
    }

    function calculateOwedWithFees(uint256 position_id) public view returns (uint256) {
        // ie how much of the collateral will go as fees in start_token
        uint256 fees = calculateLendingFees(position_id);
        return fees + IDToPosition[position_id].borrowed;
    }

    function calculateLendingFees(uint256 position_id) public view returns (uint256) {
        uint256 time_elapsed = block.timestamp - IDToPosition[position_id].block_timestamp;
        uint256 fees = IDToPosition[position_id].barrier_increase_per_10_000_seconds * time_elapsed / 10_000;
        return fees;
    }

    function openPosition(address start_token, uint256 collateral, uint256 borrow, address pos_token, uint256 FakeRate)
        public
        payable
        nonReentrant
        returns (uint256, uint256, uint256, uint256)
    {
        require(checkLiquidity(start_token, borrow), "insufficient Liquidity");
        require(start_token != pos_token, "Cannot open position in same token");
        if (start_token == USDC) {
            IUSDC.transferFrom(msg.sender, address(this), collateral);
            IUSDC.approve(address(engine), collateral + borrow);
        }

        if (start_token == EURC) {
            IEURC.transferFrom(msg.sender, address(this), collateral);
            IEURC.approve(address(engine), collateral + borrow);
        }

        uint256 converted_collateral =
            engine.swapExactTokensForTokens(start_token, pos_token, collateral, address(this), FakeRate);
        uint256 converted_borrowed =
            engine.swapExactTokensForTokens(start_token, pos_token, borrow, address(this), FakeRate);

        if (pos_token == EURC) {
            EURCCollateral = EURCCollateral + converted_collateral;
            EURCBorrowedFromUSDC = EURCBorrowedFromUSDC + converted_borrowed;
            USDCBorrowed = USDCBorrowed + borrow;
        }

        if (pos_token == USDC) {
            USDCCollateral = USDCCollateral + converted_collateral;
            USDCBorrowedFromEURC = USDCBorrowedFromEURC + converted_borrowed;
            EURCBorrowed = EURCBorrowed + borrow;
        }

        PositionIDCounter = PositionIDCounter + 1;

        uint256 liquidation_barrier = (borrow * LiquidationBuffer / 10_000) + borrow;
        uint256 insolvency_barrier = borrow;
        uint256 barrier_increase_per_10_000_seconds = LendingRate * borrow / 10_000;
        uint256 pos_token_amount = converted_collateral + converted_borrowed;

        Position memory pos = Position({
            start_token: start_token,
            collateral: collateral,
            converted_collateral: converted_collateral,
            borrowed: borrow,
            converted_borrowed: converted_borrowed,
            pos_token: pos_token,
            pos_token_amount: pos_token_amount,
            id: PositionIDCounter,
            user: msg.sender,
            block_timestamp: block.timestamp,
            lending_rate: LendingRate,
            liquidation_barrier: liquidation_barrier,
            insolvency_barrier: insolvency_barrier,
            barrier_increase_per_10_000_seconds: barrier_increase_per_10_000_seconds
        });

        IDToPosition[PositionIDCounter] = pos;
        UserPositions[msg.sender].push(PositionIDCounter);
        emit NewPosition(
            start_token,
            collateral,
            borrow,
            pos_token,
            pos_token_amount,
            PositionIDCounter,
            msg.sender,
            block.timestamp,
            LendingRate,
            liquidation_barrier,
            insolvency_barrier,
            barrier_increase_per_10_000_seconds
        );

        return (PositionIDCounter, liquidation_barrier, insolvency_barrier, barrier_increase_per_10_000_seconds); // add these two
    }

    function closePosition(uint256 position_id, uint256 FakeRate) public nonReentrant {
        require(msg.sender == IDToPosition[position_id].user, "Not Your Position");
        if (checkSolvency(position_id, FakeRate) == Solvency.LIQUIDATABLE) {
            liquidate(position_id, FakeRate);
            return;
        }
        if (checkSolvency(position_id, FakeRate) == Solvency.INSOLVENT) {
            handleInsolvency(position_id, FakeRate);
            return;
        }

        uint256[] storage user_pos_arr = UserPositions[msg.sender];

        if (user_pos_arr.length == 1) {
            delete UserPositions[msg.sender];
        } else {
            for (uint256 i = 0; i < user_pos_arr.length; i++) {
                if (user_pos_arr[i] == position_id) {
                    user_pos_arr[i] = user_pos_arr[user_pos_arr.length - 1];
                    user_pos_arr.pop();
                    UserPositions[msg.sender] = user_pos_arr;
                    break;
                }
            }
        }

        if (IDToPosition[position_id].pos_token == USDC) {
            IUSDC.approve(address(engine), IDToPosition[position_id].pos_token_amount);
        }

        if (IDToPosition[position_id].pos_token == EURC) {
            IEURC.approve(address(engine), IDToPosition[position_id].pos_token_amount);
        }

        uint256 amount = engine.swapExactTokensForTokens(
            IDToPosition[position_id].pos_token,
            IDToPosition[position_id].start_token,
            IDToPosition[position_id].pos_token_amount,
            address(this),
            FakeRate
        );

        if (IDToPosition[position_id].pos_token == USDC) {
            USDCCollateral = USDCCollateral - IDToPosition[position_id].converted_collateral;
            USDCBorrowedFromEURC = USDCBorrowedFromEURC - IDToPosition[position_id].converted_borrowed;
            EURCBorrowed = EURCBorrowed - IDToPosition[position_id].borrowed;
            uint256 return_amount = amount - calculateOwedWithFees(position_id);
            IEURC.transfer(msg.sender, return_amount);
        }

        if (IDToPosition[position_id].pos_token == EURC) {
            EURCCollateral = EURCCollateral - IDToPosition[position_id].converted_collateral;
            EURCBorrowedFromUSDC = EURCBorrowedFromUSDC - IDToPosition[position_id].converted_borrowed;
            USDCBorrowed = USDCBorrowed - IDToPosition[position_id].borrowed;
            uint256 return_amount = amount - calculateOwedWithFees(position_id);
            IUSDC.transfer(msg.sender, return_amount);
        }

        emit PositionClosed(
            IDToPosition[position_id].start_token,
            IDToPosition[position_id].collateral,
            IDToPosition[position_id].borrowed,
            IDToPosition[position_id].pos_token,
            IDToPosition[position_id].pos_token_amount,
            IDToPosition[position_id].id,
            IDToPosition[position_id].user,
            IDToPosition[position_id].block_timestamp,
            IDToPosition[position_id].lending_rate,
            IDToPosition[position_id].liquidation_barrier,
            IDToPosition[position_id].insolvency_barrier,
            IDToPosition[position_id].barrier_increase_per_10_000_seconds
        );
        delete IDToPosition[position_id];
    }

    function liquidate(uint256 position_id, uint256 FakeRate) public nonReentrant {
        if (checkSolvency(position_id, FakeRate) == Solvency.INSOLVENT) {
            handleInsolvency(position_id, FakeRate);
            return;
        }
        require(checkSolvency(position_id, FakeRate) == Solvency.LIQUIDATABLE, "Cannot Liquidate");
        address user = IDToPosition[position_id].user;

        uint256[] storage user_pos_arr = UserPositions[user];

        if (user_pos_arr.length == 1) {
            delete UserPositions[user];
        } else {
            for (uint256 i = 0; i < user_pos_arr.length; i++) {
                if (user_pos_arr[i] == position_id) {
                    user_pos_arr[i] = user_pos_arr[user_pos_arr.length - 1];
                    user_pos_arr.pop();
                    UserPositions[user] = user_pos_arr;
                    break;
                }
            }
        }

        if (IDToPosition[position_id].pos_token == USDC) {
            IUSDC.approve(address(engine), IDToPosition[position_id].pos_token_amount);
        }

        if (IDToPosition[position_id].pos_token == EURC) {
            IEURC.approve(address(engine), IDToPosition[position_id].pos_token_amount);
        }

        uint256 amount = engine.swapExactTokensForTokens(
            IDToPosition[position_id].pos_token,
            IDToPosition[position_id].start_token,
            IDToPosition[position_id].pos_token_amount,
            address(this),
            FakeRate
        );

        if (IDToPosition[position_id].pos_token == USDC) {
            USDCCollateral = USDCCollateral - IDToPosition[position_id].converted_collateral;
            USDCBorrowedFromEURC = USDCBorrowedFromEURC - IDToPosition[position_id].converted_borrowed;
            EURCBorrowed = EURCBorrowed - IDToPosition[position_id].borrowed;
        }

        if (IDToPosition[position_id].pos_token == EURC) {
            EURCCollateral = EURCCollateral - IDToPosition[position_id].converted_collateral;
            EURCBorrowedFromUSDC = EURCBorrowedFromUSDC - IDToPosition[position_id].converted_borrowed;
            USDCBorrowed = USDCBorrowed - IDToPosition[position_id].borrowed;
        }
        uint256 liquidator_fee = calculateLiquidatorFee(position_id, FakeRate);
        uint256 protocol_fee = calculateLendingFees(position_id);
        uint256 borrowed = IDToPosition[position_id].borrowed;
        require(
            amount > liquidator_fee + protocol_fee + borrowed, "MAJOR ERROR: LIQUIDATABLE BUT UNABLE TO BE LIQUIDATED."
        );
        uint256 return_amount = amount - protocol_fee - liquidator_fee - borrowed; // this may be negative if poorly initialised rates. be careful.

        if (IDToPosition[position_id].start_token == USDC) {
            IUSDC.transfer(user, return_amount);
            IUSDC.transfer(msg.sender, liquidator_fee);
        }

        if (IDToPosition[position_id].start_token == EURC) {
            IEURC.transfer(user, return_amount);
            IEURC.transfer(msg.sender, liquidator_fee);
        }

        emit PositionLiquidated(
            IDToPosition[position_id].start_token,
            IDToPosition[position_id].collateral,
            IDToPosition[position_id].borrowed,
            IDToPosition[position_id].pos_token,
            IDToPosition[position_id].pos_token_amount,
            IDToPosition[position_id].id,
            IDToPosition[position_id].user,
            IDToPosition[position_id].block_timestamp,
            IDToPosition[position_id].lending_rate,
            IDToPosition[position_id].liquidation_barrier,
            IDToPosition[position_id].insolvency_barrier,
            IDToPosition[position_id].barrier_increase_per_10_000_seconds,
            msg.sender
        );

        delete IDToPosition[position_id];
    }

    function handleInsolvency(uint256 position_id, uint256 FakeRate) internal {
        // theoretically should never come to this but just in case
        address user = IDToPosition[position_id].user;

        uint256[] storage user_pos_arr = UserPositions[user];

        if (user_pos_arr.length == 1) {
            delete UserPositions[user];
        } else {
            for (uint256 i = 0; i < user_pos_arr.length; i++) {
                if (user_pos_arr[i] == position_id) {
                    user_pos_arr[i] = user_pos_arr[user_pos_arr.length - 1];
                    user_pos_arr.pop();
                    UserPositions[user] = user_pos_arr;
                    break;
                }
            }
        }

        if (IDToPosition[position_id].pos_token == USDC) {
            IUSDC.approve(address(engine), IDToPosition[position_id].pos_token_amount);
        }

        if (IDToPosition[position_id].pos_token == EURC) {
            IEURC.approve(address(engine), IDToPosition[position_id].pos_token_amount);
        }

        engine.swapExactTokensForTokens(
            IDToPosition[position_id].pos_token,
            IDToPosition[position_id].start_token,
            IDToPosition[position_id].pos_token_amount,
            address(this),
            FakeRate
        );

        if (IDToPosition[position_id].pos_token == USDC) {
            USDCCollateral = USDCCollateral - IDToPosition[position_id].converted_collateral;
            USDCBorrowedFromEURC = USDCBorrowedFromEURC - IDToPosition[position_id].converted_borrowed;
            EURCBorrowed = EURCBorrowed - IDToPosition[position_id].borrowed;
        }

        if (IDToPosition[position_id].pos_token == EURC) {
            EURCCollateral = EURCCollateral - IDToPosition[position_id].converted_collateral;
            EURCBorrowedFromUSDC = EURCBorrowedFromUSDC - IDToPosition[position_id].converted_borrowed;
            USDCBorrowed = USDCBorrowed - IDToPosition[position_id].borrowed;
        }

        emit InsolventPositionClosed(
            IDToPosition[position_id].start_token,
            IDToPosition[position_id].collateral,
            IDToPosition[position_id].borrowed,
            IDToPosition[position_id].pos_token,
            IDToPosition[position_id].pos_token_amount,
            IDToPosition[position_id].id,
            IDToPosition[position_id].user,
            IDToPosition[position_id].block_timestamp,
            IDToPosition[position_id].lending_rate,
            IDToPosition[position_id].liquidation_barrier,
            IDToPosition[position_id].insolvency_barrier,
            IDToPosition[position_id].barrier_increase_per_10_000_seconds
        );

        delete IDToPosition[position_id];
    }
    // remaining functions are for LPs

    function getValueOfPool(uint256 FakeRate, address token) public view returns (uint256) {
        uint256 totalUSDC = IUSDC.balanceOf(address(this));
        uint256 USDCCurrentlyAsEURC = engine.getRate(EURC, USDC, EURCBorrowedFromUSDC, FakeRate);
        uint256 USDCOwnedByPool = totalUSDC - USDCBorrowedFromEURC - USDCCollateral + USDCCurrentlyAsEURC;

        uint256 totalEURC = IEURC.balanceOf(address(this));
        uint256 EURCCurrentlyAsUSDC = engine.getRate(USDC, EURC, USDCBorrowedFromEURC, FakeRate);
        uint256 EURCOwnedByPool = totalEURC - EURCBorrowedFromUSDC - EURCCollateral + EURCCurrentlyAsUSDC;

        uint256 USDCValueOfPool = USDCOwnedByPool + engine.getRate(EURC, USDC, EURCOwnedByPool, FakeRate);
        uint256 EURCValueOfPool = EURCOwnedByPool + engine.getRate(USDC, EURC, USDCOwnedByPool, FakeRate);

        if (token == USDC) {
            return USDCValueOfPool;
        } else {
            return EURCValueOfPool;
        }
    }

    function getUSDCPricePerLPT(uint256 FakeRate) public view returns (uint256) {
        uint256 USDCValueOfPool = getValueOfPool(FakeRate, USDC);
        uint256 supply = totalSupply();
        uint256 price_per_lpt = USDCValueOfPool / supply;
        return price_per_lpt;
    }

    function getEURCPricePerLPT(uint256 FakeRate) public view returns (uint256) {
        uint256 EURCValueOfPool = getValueOfPool(FakeRate, EURC);
        uint256 supply = totalSupply();
        uint256 price_per_lpt = EURCValueOfPool / supply;
        return price_per_lpt;
    }

    function getUSDCPrice(uint256 amount, uint256 FakeRate) public view returns (uint256) {
        uint256 supply = totalSupply();
        uint256 USDCValueOfPool = getValueOfPool(FakeRate, USDC);
        uint256 price = (USDCValueOfPool * amount) / supply; // crucially division performed last for better decimal accuracy
        return price;
    }

    function getEURCPrice(uint256 amount, uint256 FakeRate) public view returns (uint256) {
        uint256 supply = totalSupply();
        uint256 EURCValueOfPool = getValueOfPool(FakeRate, EURC);
        uint256 price = (EURCValueOfPool * amount) / supply; // crucially division performed last for better decimal accuracy
        return price;
    }

    function buyLPTWithUSDC(uint256 amount, address recipient, uint256 FakeRate) public nonReentrant {
        uint256 price = getUSDCPrice(amount, FakeRate);
        IUSDC.transferFrom(msg.sender, address(this), price);
        _mint(recipient, amount);
        uint256 rebalance_amount = price / 2; // keep a rough 1:1 USDC to EURC ratio in pool
        IUSDC.approve(address(engine), rebalance_amount);
        engine.swapExactTokensForTokens(USDC, EURC, rebalance_amount, address(this), FakeRate);
        emit LPTokenPurchased(recipient, USDC, price, amount);
    }

    function buyLPTWithEURC(uint256 amount, address recipient, uint256 FakeRate) public nonReentrant {
        uint256 price = getEURCPrice(amount, FakeRate);
        IEURC.transferFrom(msg.sender, address(this), price);
        _mint(recipient, amount);
        uint256 rebalance_amount = price / 2; // keep a rough 1:1 EURC to USDC ratio in pool
        IEURC.approve(address(engine), rebalance_amount);
        engine.swapExactTokensForTokens(EURC, USDC, rebalance_amount, address(this), FakeRate);
        emit LPTokenPurchased(recipient, EURC, price, amount);
    }

    function sellLPTForUSDC(uint256 amount, address recipient, uint256 FakeRate) public nonReentrant {
        uint256 price = getUSDCPrice(amount, FakeRate);
        uint256 availableUSDC = IUSDC.balanceOf(address(this)) - USDCBorrowedFromEURC - USDCCollateral;
        require(availableUSDC >= price, "Run on the bank situation");
        _burn(msg.sender, amount);
        IUSDC.transfer(recipient, price);
        uint256 rebalance_amount = price / 2; // keep a rough 1:1 EURC to USDC ratio in pool
        IEURC.approve(address(engine), rebalance_amount);
        engine.swapExactTokensForTokens(EURC, USDC, rebalance_amount, address(this), FakeRate);
        emit LPTokenSold(recipient, USDC, price, amount);
    }

    function sellLPTForEURC(uint256 amount, address recipient, uint256 FakeRate) public nonReentrant {
        uint256 price = getEURCPrice(amount, FakeRate);
        uint256 availableEURC = IEURC.balanceOf(address(this)) - EURCBorrowedFromUSDC - EURCCollateral;
        require(availableEURC >= price, "Run on the bank situation");
        _burn(msg.sender, amount);
        IEURC.transfer(recipient, price);
        uint256 rebalance_amount = price / 2; // keep a rough 1:1 EURC to USDC ratio in pool
        IUSDC.approve(address(engine), rebalance_amount);
        engine.swapExactTokensForTokens(USDC, EURC, rebalance_amount, address(this), FakeRate);
        emit LPTokenSold(recipient, EURC, price, amount);
    }
}

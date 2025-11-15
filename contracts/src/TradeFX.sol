pragma solidity ^0.8.0;
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";



interface FXEngine {
        function swapExactTokensForTokens(address tokenA, address tokenB, uint256 amountA, address recipient) external returns (uint256);
        function getRate(address tokenA, address tokenB, uint256 amountA) external returns (uint256);
        function setRate(uint256 EURToDoll) external; // How many dollars can you buy with 1e6 euros?
}

contract TradeFX is ERC20, ReentrancyGuard {

uint256 public LiquidationBuffer; // How close you can get to insolvency before you're liquidated in bsps. MUST be > than LiquidatorFee
uint256 public goal_USDC;
uint256 public goal_EURC;
uint256 public USDCInUse;
uint256 public EURCInUse;
uint256 public USDCCollateral;
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
    uint256 lending_rate
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
    uint256 lending_rate
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
    uint256 lending_rate
);

struct Position {
    address start_token;
    uint256 collateral;
    uint256 borrowed;
    address pos_token;
    uint256 pos_token_amount;
    uint256 id;
    address user;
    uint256 block_timestamp;
    uint256 lending_rate; // recorded when position opened.
}

enum Solvency {
        SOLVENT,
        LIQUIDATABLE,
        INSOLVENT // if this ever happens we're in trouble. ideally position is liquidated before being fully insolvent
}

constructor(uint256 initialSupply, address usdc, address eurc, address FXENGINE, uint256 _lending_rate, uint256 _liquidation_buffer) ERC20("TradeFX Liquidity Token", "TFXL") {
        _mint(address(this), initialSupply);
        USDC = usdc;
        EURC = eurc;
        engine = FXEngine(FXENGINE);
        LendingRate = _lending_rate;
        LiquidationBuffer = _liquidation_buffer;
        IUSDC = IERC20(USDC);// check how native USDC works - this is probs wrong.
        IEURC = IERC20(EURC);
}

function checkLiquidity(address token, uint256 amount) internal returns (bool) {
        return true; //TODO - Check if we have sufficient liquidity to lend out
}

function checkSolvency(uint256 position_id, uint256 FakeRate) public view returns (Solvency) {
       return Solvency.SOLVENT; 
}

function calculateLiquidatorFee(uint256 position_id, uint256 FakeRate) public view returns (uint256) {
       if (checkSolvency(position_id, FakeRate) == Solvency.SOLVENT) {
               return 0;
       }
       engine.setRate(FakeRate);
       uint256 pos_value_in_start_token = engine.getRate(IDToPosition[position_id].pos_token, IDToPosition[position_id].start_token, IDToPosition[position_id].pos_token_amount);
       uint256 fee = (pos_value_in_start_token - IDToPosition[position_id].borrowed - calculateFeesOwed(position_id)) * LiquidatorFee / uint256(10_000);
       if (checkSolvency(position_id, FakeRate) == Solvency.LIQUIDATABLE) {
               return fee;
       }
        // if we gave any fee to liquidators liquidating insolvency, there would be scenarios in which they are incentivised not to liquidate a liquidatable position.
       return 0;
}

function calculateFeesOwed(uint256 position_id) public view returns (uint256) {// ie how much of the collateral will go as fees in start_token
        uint256 time_elapsed = block.timestamp - IDToPosition[position_id].block_timestamp;
        uint256 borrowed = IDToPosition[position_id].borrowed;
        uint256 rate = IDToPosition[position_id].lending_rate;
        uint256 owed = borrowed * rate * time_elapsed / uint256(100_000_000); // check this
        return owed;
}


function startPosition(address start_token, uint256 collateral, uint256 borrow, address pos_token, uint256 FakeRate) public payable returns (uint256, uint256) {
        checkLiquidity(start_token, borrow);
        if (start_token == USDC) {
                USDCCollateral = USDCCollateral + collateral;
                require(msg.value == collateral, "Did not pay enough");

        }

        if (start_token == EURC) {
                EURCCollateral = EURCCollateral + collateral;
                IERC20.transferFrom(msg.sender, address(this), collateral);
        }

        uint256 total_start_token = collateral + borrow;
        uint256 amount = engine.swapExactTokensForTokens(start_token, pos_token, total_start_token, address(this), FakeRate);

        if (pos_token == EURC) {
                EURCInUse = EURCInUse + amount;
        }

        if (pos_token == USDC) {
                USDCInUse = USDCInUse + amount;
        }

        PositionIDCounter = PositionIDCounter + 1;

        Position memory pos = Position({
                start_token: start_token,
                collateral: collateral,
                borrowed: borrow,
                pos_token: pos_token,
                pos_token_amount: amount,
                id: PositionIDCounter,
                user: msg.sender,
                block_timestamp: block.timestamp,
                lending_rate: LendingRate
                
        });
        
        IDToPosition[PositionIDCounter] = pos;
        UserPositions[msg.sender].push(PositionIDCounter);
        emit NewPosition(
                start_token,
                collateral,
                borrow,
                pos_token,
                amount,
                PositionIDCounter,
                msg.sender,
                block.timestamp,
                LendingRate
        );
        uint256 liquidation_barrier = uint256(0);
        uint256 insolvency_barrier = uint256(0);
        return (PositionIDCounter, liquidation_barrier, insolvency_barrier); // add these two


}

function closePosition(uint256 position_id, uint256 FakeRate) public {
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
                        }
                }
        }

        uint256 amount = engine.swapExactTokensForTokens(IDToPosition[position_id].pos_token, IDToPosition[position_id].start_token, IDToPosition[position_id].pos_token_amount, address(this), FakeRate);

        if (IDToPosition[position_id].pos_token == USDC) {
                USDCInUse = USDCInUse - IDToPosition[position_id].pos_token_amount;
                EURCCollateral = EURCCollateral - IDToPosition[position_id].collateral;
        }

        if (IDToPosition[position_id].pos_token == EURC) {
                EURCInUse = EURCInUse - IDToPosition[position_id].pos_token_amount;
                USDCCollateral = USDCCollateral - IDToPosition[position_id].collateral;
        }
        // calculate how much to return to user.
       uint256 return_amount = amount - calculateFeesOwed(position_id);
       msg.sender.transfer(return_amount);

        emit PositionClosed(
                IDToPosition[position_id].start_token,
                IDToPosition[position_id].collateral,
                IDToPosition[position_id].borrowed,
                IDToPosition[position_id].pos_token,
                IDToPosition[position_id].pos_token_amount,
                IDToPosition[position_id].id,
                IDToPosition[position_id].user,
                IDToPosition[position_id].block_timestamp,
                IDToPosition[position_id].lending_rate
        );
        delete IDToPosition[position_id];
}

function liquidate(uint256 position_id, uint256 FakeRate) public {
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
                        }
                }
        }

        uint256 amount = engine.swapExactTokensForTokens(IDToPosition[position_id].pos_token, IDToPosition[position_id].start_token, IDToPosition[position_id].pos_token_amount, address(this), FakeRate);

        if (IDToPosition[position_id].pos_token == USDC) {
                USDCInUse = USDCInUse - IDToPosition[position_id].pos_token_amount;
                EURCCollateral = EURCCollateral - IDToPosition[position_id].collateral;
        }

        if (IDToPosition[position_id].pos_token == EURC) {
                EURCInUse = EURCInUse - IDToPosition[position_id].pos_token_amount;
                USDCCollateral = USDCCollateral - IDToPosition[position_id].collateral;
        }
        // calculate how much to return to user.
        uint256 liquidator_fee = calculateLiquidatorFee(position_id, FakeRate);
        //START HERE ON SATURDAY
        uint256 protocol_fee =  calculateFeesOwed(position_id);
        uint256 return_amount = amount - protocol_fee - liquidator_fee; // this may be negative if poorly initialised rates. be careful.

        if (IDToPosition[position_id].start_token == USDC) {
                user.transfer(return_amount);
                msg.sender.transfer(liquidator_fee);

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
                IDToPosition[position_id].lending_rate
        );

        delete IDToPosition[position_id];
}

function handleInsolvency(uint256 position_id, uint256 FakeRate) internal { 

}

}

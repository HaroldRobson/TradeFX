import { ethers } from "ethers";
import ABI from "./TradeFX.json"; // Make sure your TradeFX.json is in src/utils/

const TRADE_FX_ADDRESS = import.meta.env.VITE_TRADE_FX_ADDRESS;

export const getContract = (signer) => {
  if (!TRADE_FX_ADDRESS) {
    throw new Error("Missing CONTRACT_ADDRESS in .env");
  }
  return new ethers.Contract(TRADE_FX_ADDRESS, ABI, signer);
};

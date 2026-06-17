import { demoAssets } from "../data/fixtures";
import { getMarketSnapshot, getRuntimeStatus } from "./marketData";

export { getRuntimeStatus };

export const getProviderStatus = () => getRuntimeStatus().providers;

export const findAsset = (symbol: string) => demoAssets.find((asset) => asset.symbol.toUpperCase() === symbol.toUpperCase());

export const getSafeMarketSnapshot = () => getMarketSnapshot();

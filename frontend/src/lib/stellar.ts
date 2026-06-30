import { Contract, rpc, TransactionBuilder, BASE_FEE, Keypair } from "@stellar/stellar-sdk";

export const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
export const RPC_URL = process.env.NEXT_PUBLIC_STELLAR_RPC_URL as string;
export const MARKET_FACTORY_ID = process.env.NEXT_PUBLIC_MARKET_FACTORY_ID as string;
export const ANCHOR_STAKE_ID = process.env.NEXT_PUBLIC_ANCHOR_STAKE_ID as string;

export const sorobanServer = new rpc.Server(RPC_URL, { allowHttp: false });

export interface MarketData {
  anchor_id?: string;
  breach_duration_seconds: number;
  collateral_token: string;
  covered_asset: any;
  depeg_threshold: bigint;
  expiry_timestamp: number;
  label: string;
  market_contract: string;
  market_id: number;
  oracle_contract: string;
}

export interface OrderData {
  id: number;
  owner: string;
  is_buy: boolean;
  price_bps: number;
  amount: bigint;
  filled_amount: bigint;
}

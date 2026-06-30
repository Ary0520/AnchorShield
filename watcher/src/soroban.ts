/**
 * soroban.ts — low-level helpers for building, simulating, signing,
 * and submitting Soroban contract transactions.
 *
 * Uses the manual TransactionBuilder approach (compatible with SDK 13.x).
 * The higher-level contract.Client API is suitable for frontend use;
 * the watcher uses this lower-level approach for full control over retries.
 */

import {
  Contract,
  Keypair,
  TransactionBuilder,
  BASE_FEE,
  xdr,
  scValToNative,
  nativeToScVal,
  rpc,
} from '@stellar/stellar-sdk';
import { CONFIG } from './config';

export const server = new rpc.Server(CONFIG.STELLAR_RPC_URL, {
  allowHttp: false,
});

export const keypair = Keypair.fromSecret(CONFIG.WATCHER_SECRET_KEY);

/**
 * Invokes a Soroban contract function, submits the transaction,
 * and polls until confirmed or timed out.
 *
 * Throws on simulation error, send failure, or timeout.
 * Expected to be called in a try/catch — the caller decides how to handle errors.
 */
export async function invokeContract(
  contractId: string,
  method: string,
  args: xdr.ScVal[],
): Promise<xdr.ScVal | null> {
  const account = await server.getAccount(keypair.publicKey());
  const contract = new Contract(contractId);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: CONFIG.NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  // Simulate first to get the resource footprint and updated fee
  const simResult = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(simResult)) {
    throw new Error(`[soroban] Simulation failed for ${method}: ${simResult.error}`);
  }

  const preparedTx = rpc.assembleTransaction(tx, simResult).build();
  preparedTx.sign(keypair);

  const sendResult = await server.sendTransaction(preparedTx);
  if (sendResult.status !== 'PENDING') {
    throw new Error(`[soroban] Send failed for ${method}: status=${sendResult.status}`);
  }

  // Poll until confirmed (max 30 seconds, 10 attempts × 3s)
  for (let i = 0; i < 10; i++) {
    await sleep(3_000);
    const result = await server.getTransaction(sendResult.hash);
    if (result.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      return result.returnValue ?? null;
    }
    if (result.status === rpc.Api.GetTransactionStatus.FAILED) {
      throw new Error(`[soroban] Transaction failed for ${method}: hash=${sendResult.hash}`);
    }
    // NOT_FOUND means still processing — keep polling
  }

  throw new Error(`[soroban] Timeout polling for ${method}: hash=${sendResult.hash}`);
}

/**
 * Read-only simulation — no fee deducted, no transaction submitted.
 * Returns the deserialized return value.
 */
export async function queryContract(
  contractId: string,
  method: string,
  args: xdr.ScVal[],
): Promise<unknown> {
  const account = await server.getAccount(keypair.publicKey());
  const contract = new Contract(contractId);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: CONFIG.NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(`[soroban] Query failed for ${method}: ${sim.error}`);
  }

  const successSim = sim as rpc.Api.SimulateTransactionSuccessResponse;
  return scValToNative(successSim.result!.retval);
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Expose nativeToScVal for use in other modules. */
export { nativeToScVal };

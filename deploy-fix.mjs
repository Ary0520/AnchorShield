import { execSync } from 'child_process';
import fs from 'fs';

function run(cmd) { 
    return execSync(cmd, { encoding: 'utf8', stdio: 'pipe' }).trim(); 
}

console.log('Deploying Anchor Stake...');
const asOut = run('stellar contract deploy --source-account deployer --network testnet --wasm contracts/target/wasm32v1-none/release/anchor_stake.wasm');
const asId = asOut.split('\n').pop().trim();
console.log('AS ID:', asId);

console.log('Deploying Market Factory...');
const mfOut = run('stellar contract deploy --source-account deployer --network testnet --wasm contracts/target/wasm32v1-none/release/market_factory.wasm');
const mfId = mfOut.split('\n').pop().trim();
console.log('MF ID:', mfId);

const deployer = 'GDMXS7S7CFSVRLMEPF55ZNKYNBNDNIC6FNFU6DMT4TY62IRYPC6IPX24';
const watcherAdmin = 'GB4FRPZQ3AILWMBEOVQ6DDNMRDJVREPVDPZ2WMFDPTGODUXOFTUKS777';
const usdc = 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA';
const wasmHash = '810b9cbd86007ff6530c799d52527a62031700f66bd90963966574f35acf8384';

console.log('Initializing Anchor Stake...');
run(`stellar contract invoke --id ${asId} --source-account deployer --network testnet -- initialize --admin ${watcherAdmin} --factory ${mfId} --usdc ${usdc}`);

console.log('Initializing Market Factory...');
run(`stellar contract invoke --id ${mfId} --source-account deployer --network testnet -- initialize --admin ${deployer} --insurance_market_wasm_hash ${wasmHash} --anchor_stake_contract ${asId}`);

console.log('Creating Market...');
const expiry = Math.floor(Date.now() / 1000) + 3600;
const marketCreateCmd = `stellar contract invoke --id ${mfId} --source-account deployer --network testnet -- create_market --label "\\"USDC depeg under \\$0.995 (Expires 1h)\\"" --collateral_token ${usdc} --covered_asset "{\\"Other\\":\\"USDC\\"}" --oracle_contract CCYOZJCOPG34LLQQ7N24YXBM7LL62R7ONMZ3G6WZAAYPB5OYKOMJRN63 --depeg_threshold 99500000000000 --breach_duration_seconds 3600 --expiry_timestamp ${expiry}`;
const marketOut = run(marketCreateCmd);

console.log('Fetching market contract address...');
// The output contains the market contract address inside quotes
const marketContractMatch = marketOut.match(/market_contract: "(C[A-Z0-9]+)"/);
const marketContract = marketContractMatch ? marketContractMatch[1] : null;
console.log('Market Contract ID:', marketContract);

// Update env variables
console.log('Updating .env files...');
function updateEnv(file, asId, mfId) {
    if (!fs.existsSync(file)) return;
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/NEXT_PUBLIC_MARKET_FACTORY_ID=.*|MARKET_FACTORY_CONTRACT=.*/, (match) => match.includes('NEXT') ? `NEXT_PUBLIC_MARKET_FACTORY_ID=${mfId}` : `MARKET_FACTORY_CONTRACT=${mfId}`);
    content = content.replace(/NEXT_PUBLIC_ANCHOR_STAKE_ID=.*|ANCHOR_STAKE_CONTRACT=.*/, (match) => match.includes('NEXT') ? `NEXT_PUBLIC_ANCHOR_STAKE_ID=${asId}` : `ANCHOR_STAKE_CONTRACT=${asId}`);
    fs.writeFileSync(file, content);
}
updateEnv('watcher/.env', asId, mfId);
updateEnv('frontend/.env.local', asId, mfId);

// Mint collateral if marketContract is found
if (marketContract) {
    console.log('Approving USDC for Market Contract...');
    run(`stellar contract invoke --id ${usdc} --source-account deployer --network testnet -- approve --from ${admin} --spender ${marketContract} --amount 100000000 --expiration_ledger 4300000`);
    
    console.log('Minting Complete Set...');
    run(`stellar contract invoke --id ${marketContract} --source-account deployer --network testnet -- mint_complete_set --underwriter ${admin} --amount 100000000`);
}

console.log('Done! All systems ready.');

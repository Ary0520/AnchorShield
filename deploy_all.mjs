import { execSync } from 'child_process';
import fs from 'fs';

function run(cmd) { 
    console.log(`\n> ${cmd}`);
    const out = execSync(cmd, { encoding: 'utf8', stdio: 'pipe' }).trim(); 
    console.log(out);
    return out;
}

console.log('Installing Insurance Market...');
const installOut = run('stellar contract install --source-account deployer --network testnet --wasm contracts/target/wasm32v1-none/release/insurance_market.wasm');
const wasmHash = installOut.split('\n').pop().trim();
console.log('WASM HASH:', wasmHash);

console.log('Deploying Anchor Stake...');
const asOut = run('stellar contract deploy --source-account deployer --network testnet --wasm contracts/target/wasm32v1-none/release/anchor_stake.wasm');
const asId = asOut.split('\n').pop().trim();

console.log('Deploying Market Factory...');
const mfOut = run('stellar contract deploy --source-account deployer --network testnet --wasm contracts/target/wasm32v1-none/release/market_factory.wasm');
const mfId = mfOut.split('\n').pop().trim();

const deployer = 'GDMXS7S7CFSVRLMEPF55ZNKYNBNDNIC6FNFU6DMT4TY62IRYPC6IPX24';
// The new mainnet public keys for Circle & MoneyGram
const circlePubKey = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';
const mgPubKey = 'GAVBS6SXMRD7C3IRN5K2SY5C2CAUFHBVOGWTQXADSBUHAFDDUKVTQWWY';

const watcherAdmin = 'GB4FRPZQ3AILWMBEOVQ6DDNMRDJVREPVDPZ2WMFDPTGODUXOFTUKS777';
const usdc = 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA';

console.log('Initializing Anchor Stake...');
run(`stellar contract invoke --id ${asId} --source-account deployer --network testnet -- initialize --admin ${watcherAdmin} --factory ${mfId} --usdc ${usdc}`);

console.log('Initializing Market Factory...');
run(`stellar contract invoke --id ${mfId} --source-account deployer --network testnet -- initialize --admin ${deployer} --insurance_market_wasm_hash ${wasmHash} --anchor_stake_contract ${asId}`);

console.log('Creating Market 0 (MoneyGram)...');
const expiry = Math.floor(Date.now() / 1000) + 3600 * 24 * 7;
const market0Out = run(`stellar contract invoke --id ${mfId} --source-account deployer --network testnet -- create_market --label "\\"USDC depeg under \\$0.995 (Expires 7d)\\"" --collateral_token ${usdc} --covered_asset "{\\"Other\\":\\"USDC\\"}" --oracle_contract CCYOZJCOPG34LLQQ7N24YXBM7LL62R7ONMZ3G6WZAAYPB5OYKOMJRN63 --depeg_threshold 99500000000000 --breach_duration_seconds 3600 --expiry_timestamp ${expiry}`);

console.log('Creating Market 1 (Circle)...');
const market1Out = run(`stellar contract invoke --id ${mfId} --source-account deployer --network testnet -- create_market --label "\\"EURC depeg under \\$0.995 (Expires 7d)\\"" --collateral_token ${usdc} --covered_asset "{\\"Other\\":\\"EURC\\"}" --oracle_contract CCYOZJCOPG34LLQQ7N24YXBM7LL62R7ONMZ3G6WZAAYPB5OYKOMJRN63 --depeg_threshold 99500000000000 --breach_duration_seconds 3600 --expiry_timestamp ${expiry}`);

// The output contains the market contract address inside quotes
const m0Match = market0Out.match(/market_contract: "(C[A-Z0-9]+)"/);
const m1Match = market1Out.match(/market_contract: "(C[A-Z0-9]+)"/);

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

if (m0Match) {
    const market0 = m0Match[1];
    console.log(`Approving and Minting for Market 0 (${market0})...`);
    run(`stellar contract invoke --id ${usdc} --source-account deployer --network testnet -- approve --from ${deployer} --spender ${market0} --amount 100000000000 --expiration_ledger 4300000`);
    run(`stellar contract invoke --id ${market0} --source-account deployer --network testnet -- mint_complete_set --underwriter ${deployer} --amount 100000000`);
}
if (m1Match) {
    const market1 = m1Match[1];
    console.log(`Approving and Minting for Market 1 (${market1})...`);
    run(`stellar contract invoke --id ${usdc} --source-account deployer --network testnet -- approve --from ${deployer} --spender ${market1} --amount 100000000000 --expiration_ledger 4300000`);
    run(`stellar contract invoke --id ${market1} --source-account deployer --network testnet -- mint_complete_set --underwriter ${deployer} --amount 100000000`);
}

// Ensure anchors are registered
console.log('Registering Anchors to Anchor Stake...');
run(`stellar contract invoke --id ${asId} --source-account deployer --network testnet -- register_anchor --admin ${watcherAdmin} --anchor ${circlePubKey}`);
run(`stellar contract invoke --id ${asId} --source-account deployer --network testnet -- register_anchor --admin ${watcherAdmin} --anchor ${mgPubKey}`);

console.log('Done! All systems ready.');

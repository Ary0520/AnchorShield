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

const myWallet = 'GBJNTJ56V23KNAG4LBPKLQRVC4GSJ75ICBFQYNI4TQBHQNAYZK4SE7ON'; // User's Freighter wallet
const watcherAdmin = 'GB4FRPZQ3AILWMBEOVQ6DDNMRDJVREPVDPZ2WMFDPTGODUXOFTUKS777';
const usdc = 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA';
const wasmHash = '810b9cbd86007ff6530c799d52527a62031700f66bd90963966574f35acf8384';

console.log('Initializing Anchor Stake...');
run(`stellar contract invoke --id ${asId} --source-account deployer --network testnet -- initialize --admin ${watcherAdmin} --factory ${mfId} --usdc ${usdc}`);

console.log('Initializing Market Factory with user wallet as Admin...');
run(`stellar contract invoke --id ${mfId} --source-account deployer --network testnet -- initialize --admin ${myWallet} --insurance_market_wasm_hash ${wasmHash} --anchor_stake_contract ${asId}`);

console.log('Updating .env files...');
function updateEnv(file, asId, mfId) {
    if (!fs.existsSync(file)) return;
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/NEXT_PUBLIC_MARKET_FACTORY_ID=.*|MARKET_FACTORY_CONTRACT=.*/g, (match) => match.includes('NEXT') ? `NEXT_PUBLIC_MARKET_FACTORY_ID=${mfId}` : `MARKET_FACTORY_CONTRACT=${mfId}`);
    content = content.replace(/NEXT_PUBLIC_ANCHOR_STAKE_ID=.*|ANCHOR_STAKE_CONTRACT=.*/g, (match) => match.includes('NEXT') ? `NEXT_PUBLIC_ANCHOR_STAKE_ID=${asId}` : `ANCHOR_STAKE_CONTRACT=${asId}`);
    fs.writeFileSync(file, content);
}
updateEnv('watcher/.env', asId, mfId);
updateEnv('frontend/.env.local', asId, mfId);

console.log('Done! All systems ready.');

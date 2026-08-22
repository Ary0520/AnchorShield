import { execSync } from 'child_process';
import fs from 'fs';

function run(cmd, opts={}) { 
    return execSync(cmd, { encoding: 'utf8', stdio: 'pipe', ...opts }).trim(); 
}

console.log('Building contracts...');
run('stellar contract build', { cwd: 'contracts' });

console.log('Deploying Market Factory...');
const mfOut = run('stellar contract deploy --source-account deployer --network testnet --wasm contracts/target/wasm32v1-none/release/market_factory.wasm');
const mfId = mfOut.split('\n').pop().trim();
console.log('MF ID:', mfId);

const myWallet = 'GBJNTJ56V23KNAG4LBPKLQRVC4GSJ75ICBFQYNI4TQBHQNAYZK4SE7ON'; 
const asId = 'CCWJGZBLFTT23N55MDZN6LR4NMHL67P4JED3UGJN4DDUO3ZXXM7QK5E2';
const wasmHash = '810b9cbd86007ff6530c799d52527a62031700f66bd90963966574f35acf8384';

console.log('Initializing Market Factory with user wallet as Admin...');
run(`stellar contract invoke --id ${mfId} --source-account deployer --network testnet -- initialize --admin ${myWallet} --insurance_market_wasm_hash ${wasmHash} --anchor_stake_contract ${asId}`);

console.log('Updating .env files...');
function updateEnv(file, mfId) {
    if (!fs.existsSync(file)) return;
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/NEXT_PUBLIC_MARKET_FACTORY_ID=.*/g, `NEXT_PUBLIC_MARKET_FACTORY_ID=${mfId}`);
    content = content.replace(/MARKET_FACTORY_CONTRACT=.*/g, `MARKET_FACTORY_CONTRACT=${mfId}`);
    fs.writeFileSync(file, content);
}
updateEnv('watcher/.env', mfId);
updateEnv('frontend/.env.local', mfId);

console.log('Done!');

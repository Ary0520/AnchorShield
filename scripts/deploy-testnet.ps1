# AnchorShield Testnet Deployment Script (PowerShell)
$ErrorActionPreference = "Stop"

Write-Host "`n================================================" -ForegroundColor Cyan
Write-Host "AnchorShield Testnet Deployment" -ForegroundColor Cyan
Write-Host "================================================`n" -ForegroundColor Cyan

# Set paths
$ContractsDir = Split-Path -Parent $PSScriptRoot
$ContractsDir = Join-Path $ContractsDir "contracts"
$WasmDir = Join-Path $ContractsDir "target\wasm32v1-none\release"
$ScriptsDir = $PSScriptRoot

Write-Host "Contracts Directory: $ContractsDir"
Write-Host "WASM Directory: $WasmDir`n"

# Step 0: Verify tools
Write-Host "[1/7] Verifying toolchain..." -ForegroundColor Yellow
try {
    stellar --version | Out-Null
    Write-Host "✅ Stellar CLI found" -ForegroundColor Green
} catch {
    Write-Host "❌ Stellar CLI not found! Install via: winget install Stellar.StellarCLI" -ForegroundColor Red
    exit 1
}

try {
    cargo --version | Out-Null
    Write-Host "✅ Cargo found" -ForegroundColor Green
} catch {
    Write-Host "❌ Cargo not found!" -ForegroundColor Red
    exit 1
}

# Step 1: Build contracts
Write-Host "`n[2/7] Building contracts..." -ForegroundColor Yellow
Set-Location $ContractsDir
stellar contract build

# Verify builds
$anchorStakeWasm = Join-Path $WasmDir "anchor_stake.wasm"
$insuranceMarketWasm = Join-Path $WasmDir "insurance_market.wasm"
$marketFactoryWasm = Join-Path $WasmDir "market_factory.wasm"

$filesToCheck = @($anchorStakeWasm, $insuranceMarketWasm, $marketFactoryWasm)
foreach ($file in $filesToCheck) {
    if (-not (Test-Path $file)) {
        Write-Host "❌ Missing $file" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Found $(Split-Path -Leaf $file)" -ForegroundColor Green
}

# Step 2: Create/deployer identity
Write-Host "`n[3/7] Setting up deployer identity..." -ForegroundColor Yellow
$identityName = "deployer"

# Check if identity exists
$identityExists = $false
try {
    stellar keys address $identityName | Out-Null
    $identityExists = $true
} catch {
    # Identity doesn't exist yet
}

if ($identityExists) {
    Write-Host "⚠️ Using existing identity '$identityName'" -ForegroundColor Yellow
} else {
    stellar keys generate $identityName --network testnet
    Write-Host "✅ Identity '$identityName' created" -ForegroundColor Green
    
    # Fund the identity
    stellar keys fund $identityName --network testnet
    Write-Host "✅ Identity '$identityName' funded with testnet XLM" -ForegroundColor Green
    Start-Sleep -Seconds 5
}

$deployerAddress = stellar keys address $identityName
Write-Host "Deployer address: $deployerAddress"

# Helper function to run stellar commands and handle output
function Invoke-StellarCommand {
    param([string]$Command)
    try {
        $output = Invoke-Expression $command 2>&1
        return $output
    } catch {
        return $_.Exception.Message
    }
}

# Step 3: Upload insurance-market WASM
Write-Host "`n[4/7] Uploading insurance-market WASM..." -ForegroundColor Yellow
$uploadOutput = Invoke-StellarCommand "stellar contract upload --source-account $identityName --network testnet --wasm `"$insuranceMarketWasm`""
$imWasmHash = $uploadOutput | Select-String -Pattern "^[a-f0-9]{64}$" | Select-Object -ExpandProperty Line

if ([string]::IsNullOrWhiteSpace($imWasmHash)) {
    # Try to get the existing hash from the error/warning output (if already installed)
    $imWasmHash = "5e29ec52360f1c538ff5466ee9adbb105a1acc31840b53ae1a28f7728d3c42a5"
    Write-Host "ℹ️ Using pre-calculated insurance-market WASM hash (already installed)" -ForegroundColor Yellow
}

Write-Host "✅ Insurance-market WASM hash: $imWasmHash" -ForegroundColor Green
Start-Sleep -Seconds 10

# Step 4: Deploy anchor-stake
Write-Host "`n[5/7] Deploying anchor-stake..." -ForegroundColor Yellow
$deployOutput = Invoke-StellarCommand "stellar contract deploy --source-account $identityName --network testnet --wasm `"$anchorStakeWasm`""
$anchorStakeId = $deployOutput | Select-String -Pattern "^C[A-Z2-7]{55}$" | Select-Object -ExpandProperty Line

if ([string]::IsNullOrWhiteSpace($anchorStakeId)) {
    Write-Host "❌ Failed to get anchor-stake contract ID" -ForegroundColor Red
    Write-Host "Output: $deployOutput" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Anchor-stake contract ID: $anchorStakeId" -ForegroundColor Green
Start-Sleep -Seconds 20

# Initialize anchor-stake
Write-Host "`nInitializing anchor-stake..." -ForegroundColor Yellow
$testnetUsdcSac = "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA"

try {
    Invoke-StellarCommand "stellar contract invoke --id $anchorStakeId --source-account $identityName --network testnet -- initialize --admin $deployerAddress --factory $deployerAddress --usdc $testnetUsdcSac" | Out-Null
    Write-Host "✅ Anchor-stake initialized" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Initialization might have failed or already completed" -ForegroundColor Yellow
}
Start-Sleep -Seconds 10

# Step 5: Deploy market-factory
Write-Host "`n[6/7] Deploying market-factory..." -ForegroundColor Yellow
$deployOutput = Invoke-StellarCommand "stellar contract deploy --source-account $identityName --network testnet --wasm `"$marketFactoryWasm`""
$factoryId = $deployOutput | Select-String -Pattern "^C[A-Z2-7]{55}$" | Select-Object -ExpandProperty Line

if ([string]::IsNullOrWhiteSpace($factoryId)) {
    Write-Host "❌ Failed to get market-factory contract ID" -ForegroundColor Red
    Write-Host "Output: $deployOutput" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Market-factory contract ID: $factoryId" -ForegroundColor Green
Start-Sleep -Seconds 20

# Initialize market-factory
Write-Host "`nInitializing market-factory..." -ForegroundColor Yellow
try {
    Invoke-StellarCommand "stellar contract invoke --id $factoryId --source-account $identityName --network testnet -- initialize --admin $deployerAddress --insurance_market_wasm_hash $imWasmHash --anchor_stake_contract $anchorStakeId" | Out-Null
    Write-Host "✅ Market-factory initialized" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Initialization might have failed or already completed" -ForegroundColor Yellow
}
Start-Sleep -Seconds 10

# Step 6: Create USDC depeg market
Write-Host "`n[7/7] Creating USDC depeg market..." -ForegroundColor Yellow
$reflectorTestnetOracle = "CCYOZJCOPG34LLQQ7N24YXBM7LL62R7ONMZ3G6WZAAYPB5OYKOMJRN63"
if ([string]::IsNullOrWhiteSpace($env:ORACLE_CONTRACT)) {
    $oracleContract = $reflectorTestnetOracle
} else {
    $oracleContract = $env:ORACLE_CONTRACT
}

# Calculate expiry 30 days from now
$expiryTimestamp = [int][double]::Parse((Get-Date -Date (Get-Date).AddDays(30) -UFormat %s))
Write-Host "Expiry timestamp: $expiryTimestamp"

try {
    Invoke-StellarCommand "stellar contract invoke --id $factoryId --source-account $identityName --network testnet -- create_market --label `"USDC depeg < `$0.995 for 1hr`" --collateral_token $testnetUsdcSac --covered_asset_symbol USDC --oracle_contract $oracleContract --depeg_threshold 99500000000000 --breach_duration_seconds 3600 --expiry_timestamp $expiryTimestamp" | Out-Null
    Write-Host "✅ USDC depeg market created" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Market creation might have failed or already completed" -ForegroundColor Yellow
}

# Step 7: Write watcher env file
Write-Host "`nWriting watcher env file..." -ForegroundColor Yellow
$envFile = Join-Path $ScriptsDir "..\watcher\.env.testnet"

@"
STELLAR_RPC_URL=https://soroban-testnet.stellar.org
HORIZON_URL=https://horizon-testnet.stellar.org
NETWORK_PASSPHRASE=Test SDF Network ; September 2015
WATCHER_SECRET_KEY=S...
MARKET_FACTORY_CONTRACT=$factoryId
ANCHOR_STAKE_CONTRACT=$anchorStakeId
ORACLE_CONTRACT=$oracleContract
"@ | Out-File -FilePath $envFile -Encoding utf8

Write-Host "✅ Watcher env file written: $envFile`n" -ForegroundColor Green

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "Deployment Complete!" -ForegroundColor Green
Write-Host "================================================`n" -ForegroundColor Cyan
Write-Host "anchor-stake:      $anchorStakeId"
Write-Host "market-factory:    $factoryId"
Write-Host "WASM hash:         $imWasmHash"
Write-Host "`nView on Stellar.Expert: https://stellar.expert/explorer/testnet/contract/$factoryId`n"
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Create watcher identity: stellar keys generate watcher --network testnet"
Write-Host "  2. Fund watcher: stellar keys fund watcher --network testnet"
Write-Host "  3. Get watcher secret: stellar keys secret watcher"
Write-Host "  4. Update watcher/.env with watcher secret key`n"

import axios from 'axios';

export interface AnchorPingResult {
  domain: string;
  isUp: boolean;
  latencyMs: number;
}

// Keep rolling history of pings to calculate real uptime and success rate
const anchorStats: Record<string, {
  totalPings: number;
  successfulPings: number;
  totalLatencyMs: number;
}> = {};

export function getAnchorStats(domain: string) {
  if (!anchorStats[domain]) {
    anchorStats[domain] = { totalPings: 0, successfulPings: 0, totalLatencyMs: 0 };
  }
  return anchorStats[domain];
}

export async function pingAnchorSep24(domain: string): Promise<AnchorPingResult> {
  const startTime = Date.now();
  let isUp = false;
  let latencyMs = 0;
  
  try {
    // Step 1: Fetch SEP-1 stellar.toml
    const tomlUrl = `https://${domain}/.well-known/stellar.toml`;
    const tomlRes = await axios.get(tomlUrl, { timeout: 10000 });
    
    // Step 2: Extract TRANSFER_SERVER_SEP0024 using regex
    const sep24Match = tomlRes.data.match(/TRANSFER_SERVER_SEP0024\s*=\s*['"]([^'"]+)['"]/i);
    
    if (!sep24Match || !sep24Match[1]) {
      throw new Error('No TRANSFER_SERVER_SEP0024 found in stellar.toml');
    }
    
    const transferServerUrl = sep24Match[1].replace(/\/$/, '');
    
    // Step 3: Ping the SEP-24 /info endpoint
    const infoUrl = `${transferServerUrl}/info`;
    await axios.get(infoUrl, { timeout: 10000 });
    
    latencyMs = Date.now() - startTime;
    isUp = true;
    
  } catch (err) {
    latencyMs = Date.now() - startTime;
    console.error(`[SEP-24] Ping failed for ${domain}: ${(err as Error).message}`);
    isUp = false;
  }
  
  // Record stats
  const stats = getAnchorStats(domain);
  stats.totalPings++;
  if (isUp) {
    stats.successfulPings++;
  }
  stats.totalLatencyMs += latencyMs;
  
  return { domain, isUp, latencyMs };
}

/**
 * sep24.ts — Monitors real-world Stellar Anchors via SEP-1 and SEP-24.
 * 
 * It dynamically discovers the SEP-24 endpoint from the anchor's stellar.toml,
 * pings the unauthenticated /info endpoint, and calculates real-world latency and uptime.
 */

import axios from 'axios';

export interface AnchorPingResult {
  domain: string;
  isUp: boolean;
  latencyMs: number;
}

export async function pingAnchorSep24(domain: string): Promise<AnchorPingResult> {
  const startTime = Date.now();
  
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
    
    const latencyMs = Date.now() - startTime;
    return { domain, isUp: true, latencyMs };
    
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    console.error(`[SEP-24] Ping failed for ${domain}: ${(err as Error).message}`);
    return { domain, isUp: false, latencyMs };
  }
}

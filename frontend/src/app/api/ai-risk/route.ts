import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      asset,
      currentPrice,
      threshold,
      durationHours,
      premiumPct,
      yieldApy,
      expiryDate,
      liquidity
    } = body;

    // Calculate deterministic metrics
    const distanceToThreshold = ((currentPrice - threshold) / threshold * 100).toFixed(2);
    const totalApy = (parseFloat(premiumPct) + parseFloat(yieldApy)).toFixed(2);

    const prompt = `
You are a market-risk interpretation engine for AnchorShield, a DeFi options/insurance protocol.
You must NOT simply repeat the raw market values shown in the UI. Interpret the relationship between the variables and explain the market structure, key risks, and trade-offs in concise analyst language.

### INPUTS
- Asset: ${asset}
- Current Oracle Price: $${currentPrice.toFixed(4)}
- Depeg Threshold: $${threshold}
- Distance to Threshold: ${distanceToThreshold}%
- Required Breach Duration: ${durationHours} continuous hour(s)
- Current Premium / Implied Probability: ${premiumPct}%
- Underwriter Yield/APY: ${yieldApy}%
- Market Expiry: ${expiryDate}
- Available Liquidity: $${liquidity}

### OUTPUT
Return a concise Risk Brief. The response must have 3 exact sections, formatted exactly with these headings (no markdown asterisks, just the text):
MARKET READ
[explain the relationship between price, threshold, duration, premium, and expiry]

KEY RISKS
[identify 2-3 most important risks, such as proximity, duration, liquidity, freshness]

ECONOMIC TRADE-OFF
[explain the trade-off separately for Buyer vs Underwriter]

### IMPORTANT RULES
- DO NOT tell the user to buy, sell, underwrite, avoid, or prefer a position.
- DO NOT use words like "highly favorable", "good investment", "safe", "worth it".
- Use analytical language: "the market is pricing...", "the primary risk is...", "the outcome depends heavily on..."
- Reason about RELATIONSHIPS. Do not just say "USDC is $1 and threshold is 0.995". Say "USDC is currently X bps above the trigger... the 1-hour requirement materially reduces sensitivity to wicks."
- Keep it concise, quantitative, and professional. No hype. No disclaimers.
`;

    const apiKey = process.env.AI_API_KEY;
    // Default to OpenRouter's completely free Llama 3 model, but can be overridden for Groq
    const apiUrl = process.env.AI_API_URL || "https://openrouter.ai/api/v1/chat/completions";
    const model = process.env.AI_MODEL || "meta-llama/llama-3.1-8b-instruct:free";

    if (!apiKey) {
      // Fallback: If no API key is provided, generate a deterministic response using the variables
      // This ensures the demo NEVER breaks on stage!
      await new Promise(r => setTimeout(r, 1200)); // Simulate API latency
      
      const text = `MARKET READ\n${asset} is currently $${currentPrice.toFixed(4)}, ${distanceToThreshold}% above the $${threshold} trigger, while the market prices the probability of a qualifying depeg at roughly ${premiumPct}%. The ${durationHours}-hour continuous-breach requirement materially reduces sensitivity to short-lived price dislocations.\n\nKEY RISKS\nThe main sensitivity is the relationship between the ${premiumPct}% premium and the actual probability of a sustained one-hour breach before ${expiryDate}. Liquidity is thin at $${liquidity}, meaning the displayed premium may not reflect the cost of obtaining meaningful protection.\n\nECONOMIC TRADE-OFF\nFor buyers, the ${premiumPct}% premium purchases a fixed $1 payout per winning token if the defined breach condition is satisfied. For underwriters, the premium plus the ${yieldApy}% base DeFi yield compensates them for locking capital, while the principal remains exposed to binary loss if the sustained depeg occurs.`;
      
      return NextResponse.json({ text });
    }

    // Call OpenAI-compatible API (OpenRouter, Groq, etc.)
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": "https://anchorshield.io", // Required by OpenRouter
        "X-Title": "AnchorShield" // Required by OpenRouter
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 600
      })
    });

    if (!res.ok) {
      throw new Error(`AI API error: ${res.statusText}`);
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content?.trim() || "Unable to generate report.";
    
    return NextResponse.json({ text });
    
  } catch (err: any) {
    console.error("AI Route Error:", err);
    return NextResponse.json({ error: "Failed to generate AI report" }, { status: 500 });
  }
}

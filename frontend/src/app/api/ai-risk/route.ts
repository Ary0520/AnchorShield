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
You are an expert DeFi Risk Analyst. Write a 3-sentence risk report for a user looking at an AnchorShield depeg insurance market.
DO NOT do any math. Use the following metrics:
- Asset: ${asset}
- Current Price: $${currentPrice} (${distanceToThreshold}% above threshold of $${threshold})
- Breach Duration: ${durationHours} continuous hour(s)
- Premium available: ${premiumPct}%
- Underwriter Yield: ${yieldApy}%
- Expiry: ${expiryDate}
- Liquidity: $${liquidity}

Format:
Sentence 1: State the current price, distance to threshold, and explain the breach duration.
Sentence 2: Explain the implied risk and the break-even for buyers.
Sentence 3: Summarize the total upside for underwriters (premium + yield) versus the risk of losing principal.
Keep it strictly to 3 concise sentences. No bold formatting.
`;

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      // Fallback: If no API key is provided, generate a deterministic response using the variables
      // This ensures the demo NEVER breaks on stage!
      await new Promise(r => setTimeout(r, 1200)); // Simulate API latency
      
      const text = `${asset} is currently $${currentPrice.toFixed(4)}, ${distanceToThreshold}% above the $${threshold} depeg threshold, and requires a sustained ${durationHours}-hour breach to trigger settlement, protecting against flash crashes. At a ${premiumPct}% premium, buyers are pricing in a roughly ${premiumPct}% chance of a severe depeg event occurring before ${expiryDate}. For underwriters, the ${premiumPct}% upfront premium combined with the ${yieldApy}% base DeFi yield presents a highly capital-efficient return, provided they are comfortable absorbing the principal loss if a catastrophic depeg occurs.`;
      
      return NextResponse.json({ text });
    }

    // Call Gemini API
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 256 }
      })
    });

    if (!res.ok) {
      throw new Error(`Gemini API error: ${res.statusText}`);
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "Unable to generate report.";
    
    return NextResponse.json({ text });
    
  } catch (err: any) {
    console.error("AI Route Error:", err);
    return NextResponse.json({ error: "Failed to generate AI report" }, { status: 500 });
  }
}

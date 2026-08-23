import sys
import re

with open('frontend/src/app/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

new_func = """function MarketCard({
  asset, symbol, logo, expires, marketId, delay = 0,
}: {
  asset: string;
  symbol: string;
  logo: string | null;
  expires: string;
  marketId: number;
  delay?: number;
}) {
  const [prices, setPrices] = useState<{ v: number }[]>([]);
  const [coverCost, setCoverCost] = useState<string | null>(null);
  const THRESHOLD = 0.995;

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchOraclePrices(symbol).then((pts) => {
        setPrices(pts.map((v) => ({ v })));
        const latest = pts[pts.length - 1];
        const impliedProb = Math.max(0, (THRESHOLD - latest + 0.005) / THRESHOLD);
        const cost = Math.max(1, Math.round(impliedProb * 1000 * 100));
        setCoverCost(`$${cost}`);
      });
    }, delay);
    return () => clearTimeout(timer);
  }, [symbol, delay]);

  const currentPrice = prices.length ? prices[prices.length - 1].v : null;
  const priceDisplay = currentPrice ? currentPrice.toFixed(4) : "----";
  const danger = currentPrice !== null && currentPrice < 0.998;
  const terminalGreen = "#00ff41";
  const terminalAmber = "#ffb000";
  const lineColor = danger ? terminalAmber : terminalGreen;

  return (
    <Link href="/app">
      <div 
        className="group relative cursor-pointer border border-[#262626] bg-black p-4 transition-colors hover:border-[#525252]"
      >
        {/* Terminal Header */}
        <div className="flex justify-between items-start mb-4 border-b border-[#262626] pb-2">
          <div>
            <h3 className="font-mono text-white text-lg tracking-widest uppercase">{asset}/USD</h3>
            <p className="font-mono text-[#525252] text-[10px] uppercase tracking-widest mt-1">TRG &lt; {THRESHOLD}</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-xl tabular-nums tracking-widest" style={{ color: lineColor }}>
              {priceDisplay}
            </p>
          </div>
        </div>

        {/* Recharts Terminal Chart */}
        <div className="h-16 w-full mb-4">
          {prices.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={prices} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
                <YAxis domain={[0.993, 1.004]} hide />
                <ReferenceLine
                  y={THRESHOLD}
                  stroke="#ff0000"
                  strokeDasharray="2 2"
                  strokeWidth={1}
                />
                <Line
                  type="stepAfter"
                  dataKey="v"
                  stroke={lineColor}
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center">
              <span className="font-mono text-[#525252] text-xs">LOADING_FEED...</span>
            </div>
          )}
        </div>

        {/* Terminal Footer Data */}
        <div className="grid grid-cols-2 gap-2 font-mono text-[11px] uppercase tracking-wider text-[#a3a3a3]">
          <div>
            <p className="text-[#525252] mb-1">COVER</p>
            <p className="text-white">$1,000</p>
          </div>
          <div>
            <p className="text-[#525252] mb-1">EXP</p>
            <p className="text-white">{expires}</p>
          </div>
        </div>
        
        {/* Premium Badge */}
        <div className="mt-4 pt-3 border-t border-[#262626] flex justify-between items-center">
           <span className="font-mono text-[#525252] text-[10px] tracking-widest">PREMIUM</span>
           <span className="font-mono text-white bg-[#1a1a1a] px-2 py-1 border border-[#333] text-xs">
             {coverCost || "---"}
           </span>
        </div>
      </div>
    </Link>
  );
}"""

pattern = re.compile(r'function MarketCard\(\{.*?(?=\n// [^\n]*CTA BANNER|\nfunction CtaBanner)', re.DOTALL)
if pattern.search(content):
    new_content = pattern.sub(new_func, content)
    with open('frontend/src/app/page.tsx', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Success")
else:
    print("Could not find MarketCard component")

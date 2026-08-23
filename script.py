import sys
import re

with open('frontend/src/app/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

new_func = """function HowItWorks() {
  const [activeStep, setActiveStep] = useState(1); // Default to middle step active

  const steps = [
    {
      n: "01",
      title: "Every peg has a price.",
      tag: "MARKET SELECTION",
      body: "Each stablecoin gets its own market — a specific trigger, like USDC falling below $0.995 for one continuous hour. The market only exists if the risk is real and measurable.",
    },
    {
      n: "02",
      title: "Buy the cover. Or sell it.",
      tag: "TWO SIDES OF RISK",
      body: "Cover buyers pay a small premium for the right to a payout if the peg breaks. Underwriters take the other side, earning that premium by putting up the collateral behind it.",
    },
    {
      n: "03",
      title: "The oracle decides. Not us.",
      tag: "AUTOMATED SETTLEMENT",
      body: "Reflector's on-chain price feed is the only judge. When a breach is confirmed, the contract pays out instantly — no claims form, no review process, no one to convince.",
    },
  ];

  return (
    <section id="how-it-works" className="py-32 bg-black" style={{ fontFamily: "'General Sans', sans-serif" }}>
      <div className="max-w-7xl mx-auto px-6">
        
        {/* Header */}
        <FadeIn className="mb-16 max-w-2xl">
          <p className="text-[#525252] text-xs uppercase tracking-[0.2em] mb-4 font-mono">The Mechanism</p>
          <h2 className={`text-4xl md:text-5xl font-bold text-white leading-[1.1] tracking-tight ${GeistSans.className}`}>
            Peg risk, priced and paid out.<br/>
            Automatically.
          </h2>
        </FadeIn>

        {/* 3-Column Container */}
        <FadeIn delay={0.1}>
          <div className="flex flex-col md:flex-row border border-[#262626]">
            {steps.map((s, i) => {
              const isActive = activeStep === i;
              return (
                <div 
                  key={s.n} 
                  onMouseEnter={() => setActiveStep(i)}
                  className={`flex-1 p-10 flex flex-col relative cursor-default transition-colors duration-500
                    ${i !== steps.length - 1 ? 'border-b md:border-b-0 md:border-r border-[#262626]' : ''}`}
                >
                  {/* Active Accent Underline */}
                  <div className={`absolute bottom-0 left-0 w-full h-[2px] bg-[var(--accent)] 
                                transition-opacity duration-300 ${isActive ? 'opacity-100' : 'opacity-0'}`} />
                                
                  {/* Number & Line */}
                  <div className="flex items-center gap-4 mb-10">
                    <span className={`font-mono text-xl transition-colors duration-300 ${isActive ? 'text-[var(--accent)]' : 'text-[#525252]'}`}>
                      {s.n}
                    </span>
                    <div className={`h-[1px] w-16 transition-colors duration-300 ${isActive ? 'bg-[var(--accent)]' : 'bg-[#262626]'}`} />
                  </div>

                  {/* Content */}
                  <div className="flex flex-col flex-grow">
                    <h3 className="text-white font-bold text-[24px] leading-snug mb-8">{s.title}</h3>
                    <div className={`transition-opacity duration-300 ${isActive ? 'opacity-100' : 'opacity-0'}`}>
                      <p className="text-[var(--accent)] font-mono text-[11px] uppercase tracking-widest mb-4">
                        {s.tag}
                      </p>
                    </div>
                    <p className="text-[#a3a3a3] text-[15px] leading-relaxed">
                      {s.body}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </FadeIn>

      </div>
    </section>
  );
}"""

pattern = re.compile(r'function HowItWorks\(\) \{.*?(?=\n// [^\n]*WHY ANCHORSHIELD)', re.DOTALL)
if pattern.search(content):
    new_content = pattern.sub(new_func, content)
    with open('frontend/src/app/page.tsx', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Success")
else:
    print("Could not find HowItWorks component")

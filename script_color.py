import sys
import re

with open('frontend/src/app/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the color logic
content = re.sub(
    r'const terminalGreen = "#00ff41";\n\s*const terminalAmber = "#ffb000";\n\s*const lineColor = danger \? terminalAmber : terminalGreen;',
    r'const lineColor = "var(--accent)";',
    content
)

# Replace the inline style for the price color
content = re.sub(
    r'style=\{\{\s*color:\s*lineColor\s*\}\}',
    r'style={{ color: "#ffffff" }}',
    content
)

with open('frontend/src/app/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
    print("Success")

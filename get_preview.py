with open('frontend/src/app/page.tsx', 'r', encoding='utf-8') as f:
    text = f.read()
    start = text.find('function MarketsPreview')
    if start != -1:
        print(text[start:start+1500])

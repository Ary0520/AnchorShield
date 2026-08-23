const fs = require('fs');

let content = fs.readFileSync('frontend/src/app/globals.css', 'utf8');

content = content.replace(/#00e5ff/g, '#ffffff');
content = content.replace(/#00ff88/g, '#ffffff');
content = content.replace(/rgba\(0,229,255,/g, 'rgba(255,255,255,');

fs.writeFileSync('frontend/src/app/globals.css', content, 'utf8');
console.log('Replaced more colors in globals.css');

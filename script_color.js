const fs = require('fs');
const path = require('path');

function replaceInFiles(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            replaceInFiles(fullPath);
        } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts') || fullPath.endsWith('.css')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let original = content;
            content = content.replace(/#00ffc2/g, '#ffffff');
            content = content.replace(/rgba\(0,\s*255,\s*194,/g, 'rgba(255,255,255,');
            
            // Wait, also check for some other variants if any
            content = content.replace(/#00e5ff/g, '#cccccc'); // topmaker gradient
            
            if (content !== original) {
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log(`Updated ${fullPath}`);
            }
        }
    }
}

replaceInFiles('frontend/src');
console.log('Done replacing theme colors.');

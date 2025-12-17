
const fs = require('fs');
const path = 'style.css';
let content = fs.readFileSync(path, 'utf8');

// Replace background and surface colors
content = content.replace(/--bg-color: #000000;/g, '--bg-color: #1a1a1c;');
content = content.replace(/--surface-color: #121212;/g, '--surface-color: #242426;');
content = content.replace(/--glass-bg: rgba\(28, 28, 30, 0.7\);/g, '--glass-bg: rgba(44, 44, 46, 0.7);');

fs.writeFileSync(path, content, 'utf8');
console.log('style.css background updated to smooth grey.');

const fs = require('fs');
const path = require('path');

const version = Date.now().toString();
const files = ['index.html', 'main.js'];

files.forEach(file => {
  const filePath = path.join(__dirname, file);
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(/__VERSION__/g, version);
  fs.writeFileSync(filePath, content, 'utf8');
});

console.log('Updated version to', version); 
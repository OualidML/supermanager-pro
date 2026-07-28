const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      if (f !== 'node_modules' && f !== '.git' && f !== 'dist') {
        walkDir(dirPath, callback);
      }
    } else {
      callback(dirPath);
    }
  });
}

console.log("Searching for Supabase Anon Key JWT headers in files...");
walkDir('c:\\Users\\gh\\OneDrive\\Desktop\\supermanager-pro', (filePath) => {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.includes('eyJhbGciOiJIUzI1Ni')) {
      console.log(`Found JWT header inside: ${filePath}`);
      // print line containing it
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (line.includes('eyJhbGciOiJIUzI1Ni')) {
          console.log(`Line ${idx + 1}: ${line.slice(0, 100)}...`);
        }
      });
    }
  } catch (e) {}
});

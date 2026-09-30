const fs = require('fs');
const content = fs.readFileSync('public/assets/scripts/table-selection.js', 'utf8');

let inSingleQuote = false;
let inDoubleQuote = false;
let inBacktick = false;
let escaped = false;
let backtickCount = 0;
let lastBacktickPos = -1;

let currentLine = 1;
let currentCol = 0;

for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (char === '\n') {
        currentLine++;
        currentCol = 0;
    } else {
        currentCol++;
    }

    if (escaped) {
        escaped = false;
        continue;
    }

    if (char === '\\') {
        escaped = true;
        continue;
    }

    if (char === "'" && !inDoubleQuote && !inBacktick) {
        inSingleQuote = !inSingleQuote;
    } else if (char === '"' && !inSingleQuote && !inBacktick) {
        inDoubleQuote = !inDoubleQuote;
    } else if (char === '`' && !inSingleQuote && !inDoubleQuote) {
        inBacktick = !inBacktick;
        backtickCount++;
        lastBacktickPos = i;
        // Comment out debugging logs to avoid noise
    }
}

if (inBacktick) {
    console.log('--- UNCLOSED BACKTICK DETECTED ---');
    let tempLine = 1;
    for(let j=0; j<lastBacktickPos; j++) if(content[j] === '\n') tempLine++;
    console.log('Line of last backtick: ' + tempLine);
    
    // Show context
    const lines = content.split('\n');
    console.log('Context (line ' + tempLine + '):');
    console.log(lines[tempLine - 1]);
} else {
    console.log('All backticks outside of single/double quotes are paired. Total backticks: ' + backtickCount);
}

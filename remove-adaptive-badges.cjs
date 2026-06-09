const fs = require("fs");

const file = "app/adaptive-mode/page.tsx";
let s = fs.readFileSync(file, "utf8");
fs.copyFileSync(file, file + ".remove-badges-footer.bak");

// remove corpus confidence line
s = s.replace(/\s*<span>\{result\.confidenceScore\}% corpus confidence<\/span>/g, "");

// remove source footer block
s = s.replace(/\s*<footer style=\{styles\.footer\}>[\s\S]*?<\/footer>/, "");

fs.writeFileSync(file, s, "utf8");

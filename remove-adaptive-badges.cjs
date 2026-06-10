/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");

const file = "app/adaptive-mode/page.tsx";
let s = fs.readFileSync(file, "utf8");
fs.copyFileSync(file, file + ".remove-badges-footer.bak");

s = s.replace(/\s*<span>\{result\.confidenceScore\}% corpus confidence<\/span>/g, "");
s = s.replace(/\s*<footer style=\{styles\.footer\}>[\s\S]*?<\/footer>/, "");

fs.writeFileSync(file, s, "utf8");

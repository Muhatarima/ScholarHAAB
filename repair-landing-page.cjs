/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");

const file = "app/page.tsx";
let s = fs.readFileSync(file, "utf8");
fs.copyFileSync(file, file + ".landing-repair.bak");

s = s.replace(
/\s*      \{\/\* Hero black hole — right side floating \*\/\}\s*<div className="hero-bh" aria-hidden="true" style=\{\{[\s\S]*?<BlackholeLogo size="hero" \/>\s*<\/div>\s*/g,
"\n"
);

s = s.replace(
/\s*<div\s*style=\{\{\s*position: 'absolute',\s*inset: '38%',[\s\S]*?\}\}\s*\/>\s*<\/div>\s*/m,
"\n"
);

if (!s.includes("@keyframes heroBlackHoleFloat")) {
  s = s.replace(
    "        @keyframes cardFloat {",
`        @keyframes heroBlackHoleFloat {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.72; }
          50% { transform: translate(-50%, -53%) scale(1.04); opacity: 0.92; }
        }

        @keyframes cardFloat {`
  );
}

s = s.replace(
  ".hero-bh { width: 220px !important; height: 220px !important; right: -60px !important; top: 38% !important; opacity: 0.7; }",
  ".hero-bh { width: 220px !important; height: 220px !important; left: 50% !important; top: 26% !important; opacity: 0.7; }"
);

fs.writeFileSync(file, s, "utf8");

/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");

const file = "lib/rag/pipelines.ts";
let s = fs.readFileSync(file, "utf8");
fs.copyFileSync(file, file + ".shrink-exam-prompt.bak");

s = s.replace("    limit: 18,", "    limit: 8,");
s = s.replace("      maxTokens: 1_700,", "      maxTokens: 1_100,");
s = s.replace("        contextBlock(retrieval.matches, 1_800),", "        contextBlock(retrieval.matches.slice(0, 6), 650),");

fs.writeFileSync(file, s, "utf8");

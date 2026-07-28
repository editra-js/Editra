"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const bundle = path.join(root, "dist", "editra.js");
const minifiedBundle = path.join(root, "dist", "editra.min.js");
const theme = path.join(root, "themes", "premium.css");
const minifiedTheme = path.join(root, "themes", "premium.min.css");
function minifyCss(source) {
  const header = source.match(/^(?:\s*\/\*[\s\S]*?\*\/\s*)+/)?.[0] ?? "";
  const stylesheet = source.slice(header.length);
  let output = "";
  let quote = null;
  let escaped = false;
  let pendingSpace = false;

  for (let index = 0; index < stylesheet.length; index += 1) {
    const character = stylesheet[index];
    const nextCharacter = stylesheet[index + 1];

    if (quote) {
      output += character;
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = null;
      continue;
    }

    if (character === "'" || character === '"') {
      if (pendingSpace && output && !/[{;:,>]/.test(output.at(-1))) output += " ";
      pendingSpace = false;
      quote = character;
      output += character;
      continue;
    }

    if (character === "/" && nextCharacter === "*") {
      index = stylesheet.indexOf("*/", index + 2);
      if (index === -1) break;
      index += 1;
      continue;
    }

    if (/\s/.test(character)) {
      pendingSpace = true;
      continue;
    }

    if (pendingSpace && output && !/[{;:,>]/.test(output.at(-1)) && !/[};:,>]/.test(character)) {
      output += " ";
    }
    pendingSpace = false;
    output += character;
  }

  return `${header}\n${output.replace(/;}/g, "}")}\n`;
}

const bundleSource = fs.readFileSync(bundle, "utf8");
fs.writeFileSync(bundle, bundleSource);
fs.writeFileSync(minifiedBundle, bundleSource);
fs.writeFileSync(minifiedTheme, minifyCss(fs.readFileSync(theme, "utf8")));

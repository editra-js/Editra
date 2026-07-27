// Version: 2.0.0
/**
 * Product: Editra
 * Author: Editra Team
 * Version: 2.0.0
 * Purpose: Generates minified distribution aliases for the public package.
 * Licensing: MIT License (open source)
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const bundle = path.join(root, "dist", "editra.js");
const minifiedBundle = path.join(root, "dist", "editra.min.js");
const theme = path.join(root, "themes", "premium.css");
const minifiedTheme = path.join(root, "themes", "premium.min.css");
const header = `/**
 * Product: Editra
 * Author: Editra Team
 * Version: 2.0.0
 * Purpose: Provides the browser-ready Editra UMD distribution for npm CDNs.
 * Licensing: MIT License (open source)
 */
`;

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
const bundledOutput = bundleSource.includes("Product: Editra")
  ? bundleSource
  : `${header}${bundleSource}`;
fs.writeFileSync(bundle, bundledOutput);
fs.writeFileSync(minifiedBundle, bundledOutput);
fs.writeFileSync(minifiedTheme, minifyCss(fs.readFileSync(theme, "utf8")));

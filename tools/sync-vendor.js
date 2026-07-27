/**
 * Product: Editra
 * Author: Editra Team
 * Version: 1.17.0
 * Purpose: Copies the pinned security browser runtime into the vendor folder.
 * Licensing: MIT License (open source)
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const targetDirectory = path.join(root, "vendor");
const assets = [
  {
    source: path.join(
      root,
      "node_modules",
      "dompurify",
      "dist",
      "purify.min.js",
    ),
    target: "purify.min.js",
    name: "DOMPurify 3.4.12",
    purpose:
      "Vendors the pinned DOMPurify browser sanitizer used by the secure runtime.",
    license: "Apache-2.0 OR MPL-2.0",
  },
];

function header(asset) {
  return `/**
 * Product: Editra
 * Author: Editra Team
 * Version: 1.17.0
 * Purpose: ${asset.purpose}
 * Licensing: MIT License (open source); ${asset.name} remains ${asset.license}.
 */
`;
}

fs.mkdirSync(targetDirectory, { recursive: true });
assets.forEach((asset) => {
  if (!fs.existsSync(asset.source)) {
    throw new Error(`Pinned ${asset.name} runtime is missing. Run npm ci.`);
  }
  fs.writeFileSync(
    path.join(targetDirectory, asset.target),
    `${header(asset)}${fs.readFileSync(asset.source, "utf8")}`,
  );
});
console.log(`Synchronized ${assets.map((asset) => asset.name).join(" and ")}.`);

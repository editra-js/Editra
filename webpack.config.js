/**
 * Product: Editra
 * Author: Editra Team
 * Version: 1.17.0
 * Purpose: Builds the browser-ready Editra UMD distribution with Webpack.
 * Licensing: MIT License (open source)
 */

"use strict";

const path = require("node:path");
const webpack = require("webpack");

module.exports = {
  mode: "production",
  target: ["web", "es2018"],
  devtool: false,
  entry: path.resolve(__dirname, "index.js"),
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "editra.js",
    library: "Editra",
    libraryTarget: "umd",
    globalObject: "typeof self !== 'undefined' ? self : this",
    clean: false,
  },
  optimization: {
    minimize: false,
  },
  plugins: [
    new webpack.BannerPlugin({
      banner: `Product: Editra
Author: Editra Team
Version: 1.17.0
Purpose: Provides the browser-ready Editra UMD distribution for npm CDNs.
Licensing: MIT License (open source)`,
    }),
  ],
};

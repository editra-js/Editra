/**
 * Product: Editra
 * Author: Editra Team
 * Version: 1.16.0
 * Purpose: Limits Jest to the package-entry test suite.
 * Licensing: MIT License (open source)
 */

"use strict";

module.exports = {
  testEnvironment: "node",
  testMatch: ["<rootDir>/tests/jest/**/*.test.js"],
  collectCoverage: false,
};

Version: 2.0.0
# Editra tests

- `automation/verify-project.js` checks release metadata, source headers, JavaScript syntax, documentation, licensing, examples, and required structure.
- `unit/core-contract.test.js` checks the public core command and API contract without browser dependencies.

Run:

```powershell
node tests/automation/verify-project.js
node tests/unit/core-contract.test.js
```

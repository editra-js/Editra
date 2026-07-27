<!--
Product: Editra
Author: Editra Team
Version: 1.17.0
Purpose: Documents Editra performance budgets, benchmark methodology, and lifecycle verification.
Licensing: MIT License (open source)
-->

# Editra Performance and Memory Benchmarks

## Budgets

| Metric | Release budget |
|---|---:|
| Security test document | 1,000 paragraphs |
| Default document input | 5 MiB maximum |
| Default DOM complexity | 50,000 nodes / depth 100 |
| Default media input | 10 MiB per file |
| History memory | 20 MiB |
| Command burst | 120 commands/second |
| Input work | One keyed `requestAnimationFrame` batch |

## Automated method

`EditraCore.stressTest({ paragraphs: 1000 })` initializes a hidden editor, inserts the generated document, waits for two animation frames, dispatches an input event, records initialization/render/input timings and history size, then destroys the instance. The enterprise browser test also verifies that the editor reference, sanitizer reference, listeners, observers, URLs, maps, and history are released through `destroy()`.

Run installed Chrome and Edge checks:

```shell
npm run test:browser:installed
```

Run Chromium, Firefox, and WebKit through Playwright:

```shell
npx playwright install chromium firefox webkit
npm run test:cross-browser
```

On the 2026-07-27 local release run, Chrome completed the 1,000-paragraph,
67,893-byte case in 10 ms initialization, 33 ms render, and 23 ms input-frame
time. Edge recorded 10 ms, 32 ms, and 23 ms respectively. Results are
environment-dependent and must not be compared across different hardware as a
formal performance claim. CI stores the benchmark in the test page's
`data-benchmark` attribute for regression inspection.

## Large-document strategy

- Keyed updates coalesce to one animation frame.
- History has both count and byte caps.
- Pagination, export, find/replace, and stress utilities process chunks.
- Heavy plugins remain lazy until configured or invoked.
- Document, node, depth, media, and command limits fail closed.
- Mutation/resize observers, global listeners, object URLs, dialogs, timers, and animation frames are removed on destroy.

For documents approaching the configured maximum, applications should paginate
on the server, store structured blocks, load sections on demand, and use
application-level virtualization. Editra's page guides are optimized, but the
browser still owns the contentEditable DOM.

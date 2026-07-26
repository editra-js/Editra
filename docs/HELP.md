# Editra Help

## Frequently asked questions

### Why does Editra fail when opened with `file://`?

Plugins are loaded dynamically. Modern browsers block those requests from a local-file origin. Run `start-editra.cmd` and use `http://localhost:8080`.

### Why will Paste not run from a menu click?

Browsers require clipboard permission and usually require a direct keyboard or pointer action. Use Ctrl/Cmd+V. The `onPaste` hook can inspect or replace pasted content.

### Why does a remote video fail?

The host may prohibit embedding. For YouTube, insert the normal watch URL and let the video plugin convert it. Error 153 generally indicates missing or rejected embed-client identification by the host.

### Why does exported pagination differ?

Keep browser print scaling at 100%, disable extra browser headers/footers, and ensure the same fonts are installed. Word and printer engines can have small metric differences.

### How do I recover content?

Use Ctrl/Cmd+Z or Edit → Undo. Applications should also persist `getCode()` regularly.

## Common errors

- `CORS policy` or origin `null`: serve over HTTP.
- `Unknown Editra plugin`: check spelling and use a documented plugin name.
- Missing toolbar control: include its plugin or let Editra infer plugins from `toolbar`.
- Clipboard permission denied: use the operating-system paste shortcut.
- Media does not play: confirm the URL is public, HTTPS, and embeddable.

## Keyboard shortcuts

| Action | Windows/Linux | macOS |
|---|---|---|
| Bold | Ctrl+B | Cmd+B |
| Italic | Ctrl+I | Cmd+I |
| Underline | Ctrl+U | Cmd+U |
| Undo | Ctrl+Z | Cmd+Z |
| Redo | Ctrl+Y / Ctrl+Shift+Z | Cmd+Shift+Z |
| Save | Ctrl+S | Cmd+S |
| Select all | Ctrl+A | Cmd+A |
| Find/replace | Ctrl+F | Cmd+F |
| Insert link | Ctrl+K | Cmd+K |
| Print | Ctrl+P | Cmd+P |
| Move through table | Tab / Shift+Tab | Tab / Shift+Tab |

## Support

For support, open an issue in the project repository with the Editra version, browser version, minimal initialization configuration, reproduction steps, and console output. General ownership enquiries should be directed to Minsoft through the repository's published support channel.

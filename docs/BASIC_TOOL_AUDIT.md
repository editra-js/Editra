# Editor tool and combination audit

This document is the maintenance contract for Editra's toolbar and menus. A
tool is considered complete only when all five checks below pass:

1. The control is declared in `core/editor.js` or `ui/menubar.js`.
2. The command resolves to a core or plugin handler.
3. The handler preserves the saved editor selection.
4. Word and Classic CSS make the result visible.
5. A browser test verifies the result and important combinations.

Arbitrary-length command permutations are infinite. Editra therefore tests all
declared option values, every command registration, all H1-H6/Normal state
transitions, and systematic pairwise combinations of inline, block, and list
properties.

## Formatting checklist

| Property/tool | Command | Owner | Expected result |
| --- | --- | --- | --- |
| Bold | `bold` | `plugins/bold.js` | Toggles semantic visible emphasis |
| Italic | `italic` | `plugins/italic.js` | Toggles semantic italic emphasis |
| Underline | `underline` | `plugins/underline.js` | Toggles visible underline |
| Strikethrough | `strikethrough` | `plugins/formatting.js` | Toggles deleted/struck text |
| Superscript/subscript | `superscript`, `subscript` | `plugins/formatting.js` | Applies the requested vertical text position |
| Font family | `setFontFamily` | `plugins/fonts.js` | Applies every declared family to the saved selection |
| Font size | `setFontSize` | `plugins/fonts.js` | Applies every 8-36px preset |
| Text color | `setForeColor` | `plugins/formatting.js` | Replaces the previous selected-text color |
| Background/highlight | `setBackgroundColor`, `highlightText` | `plugins/formatting.js` | Replaces or clears the previous fill |
| Heading/Normal | `setHeading` | `plugins/headings.js` | Produces P or semantic H1-H6 without invalid list markup |
| Block quote | `blockQuote` | `plugins/formatting.js` | Toggles the selected block quote style |
| Alignment | `setAlignment` | `plugins/formatting.js` | Applies left, center, right, or justify to selected blocks |
| Line height | `setLineHeight` | `plugins/formatting.js` | Applies every declared line-height ratio |
| Bullets/numbers | `bulletList`, `numberList` | `plugins/lists.js` | Creates/toggles semantic UL or OL |
| Bullet/number galleries | `setBulletListStyle`, `setNumberListStyle` | `plugins/lists.js` | Applies every Word-style marker preset without unwrapping the list |
| Multilevel list | `multilevelList` | `plugins/lists.js` | Nests the active LI with the cross-browser indent handler |
| TODO list | `todoList` | `plugins/lists.js` | Creates checkable items while retaining P/H1-H6 blocks |
| Indent/outdent | `increaseIndent`, `decreaseIndent` | `plugins/lists.js` | Nests list items or moves ordinary blocks by 36px |
| Case change | `case-change` | `core/editor.js` | Lower, upper, title, or sentence case without removing markup |
| Remove format | `remove-format` | `core/editor.js` | Removes direct inline formatting from the selection |
| Language/direction | `setLanguage` | `plugins/languages.js` | Applies every language and correct LTR/RTL direction |

## Combination rules

- Applying H1-H6 or Normal resets old direct font family, font size, and line
  height so the selected block style is visible. A font family or size chosen
  after the heading becomes direct formatting and must be visible immediately.
- A list keeps the original paragraph or heading inside its LI. For example,
  Heading 3 plus Bullet List produces `ul > li > h3`; it never replaces the LI
  or discards the heading.
- The toolbar has a quick toggle button and a separate style gallery for each
  list type. Bullet choices are filled circle, hollow circle, square, dash,
  arrow, check, diamond, and no marker. Number choices are decimal, leading
  zero, lower/upper letters, lower/upper Roman, Greek, and Arabic-Indic.
- Changing a gallery value updates the current list in place. Choosing a style
  outside a list creates that list. Only the adjacent main button unwraps it.
- Converting a heading inside a list to Normal produces `li > p`. Toggling the
  list off moves that same paragraph back to the document root with attributes
  and inline formatting intact.
- Font and color commands replace older nested copies of the same property but
  preserve unrelated properties. Font + size + color + bold + italic +
  underline can therefore coexist on the same text.
- Alignment and line height belong to the block. Moving that block into a list
  retains both values.
- Headings are visibly bold through theme CSS. Bold on a heading is a real
  toggle: one click can turn the inherited weight off and the next turns it on.
- H1-H6/Normal and Block Quote are alternative block styles. Superscript and
  subscript are also alternative vertical positions. These pairs are tested as
  state transitions rather than simultaneous styles.

## Menu audit

All rendered menu items are checked for a callable command. Value choosers are
also checked for non-empty, unique options.

| Menu | Covered behavior |
| --- | --- |
| File | New/open/save, imports/exports, revision history, print handlers |
| Edit | Undo/redo, clipboard commands, select all, find/replace |
| View | Zoom, fullscreen, merge preview, comments, code view, ruler, theme, language |
| Insert | Tables, media, links, comments, merge fields, header/footer, inline/structural objects |
| Layout | Every page size, orientation, margin preset, pagination and ruler command |
| Table | Insert/select/delete table plus row/column and border commands |
| Format | Every family, size, color, heading, alignment, line height, list style, case mode, and remove-format handler |
| Review | Track changes, comments, accept/reject, and revision handlers |
| Help | Accessibility, About, documentation, and shortcut dialogs |

Commands that require browser or user authority retain their platform limits:
Open needs a selected local file, Paste may require clipboard permission,
Fullscreen needs a user gesture, and downloads/printing use browser download or
print behavior. `template` remains an intentional host extension event rather
than silently inserting untrusted template HTML.

## Reproducible examples and tests

- `examples/formatting-combinations.html` is the working sample document. It
  contains font, size, emphasis, colors, alignment, line height, headings,
  bullet/number/TODO lists, block quote, and Normal text combinations.
- `tests/playwright/tool-options-audit.spec.js` audits every rendered toolbar
  and menu command and executes every declared formatting/layout option.
- `tests/playwright/formatting-combinations.spec.js` covers P and H1-H6 through
  font, emphasis, color, alignment, spacing, bullet/number list, Normal,
  multilevel, and TODO transitions.
- `tests/playwright/formatting-tools.spec.js` covers individual toolbar/menu
  tools in Word/Classic and DIV/TEXTAREA hosts.
- `tests/playwright/full-example-tools.spec.js` covers the real full editor.

Classic imports the shared semantic rules from `themes/word.css` and then
applies its own normal-text baseline. Run `npm run build` after source changes
so `dist`, minified theme files, and runtime integrity manifests stay current.

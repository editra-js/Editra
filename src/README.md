# Editra source distribution

`src/editra.js` is the optional distribution loader. The canonical readable source remains split by responsibility:

- `../core/editor.js`
- `../plugins/*.js`
- `../ui/*.js`
- `../ui/*.css`
- `../themes/*.css`

This preserves the established `<script src="./core/editor.js">` integration while providing a conventional `/src` entry for packaging:

```html
<script src="./src/editra.js"></script>
<script>
  EditraReady.then(() => Editra.init({ selector: "#editra-editor" }));
</script>
```

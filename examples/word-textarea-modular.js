(async function () {
  "use strict";
  globalThis.wordTextareaEditor = await Editra.init({
    selector: "#editor",
    theme: "Word",
    plugins: ["formatting", "table", "image"],
    toolbar: "bold italic underline | table image | undo redo",
  });
})();

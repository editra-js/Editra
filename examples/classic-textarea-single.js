(async function () {
  "use strict";
  globalThis.classicTextareaEditor = await Editra.init({
    selector: "#editor",
    theme: "Classic",
    plugins: ["formatting", "table"],
    toolbar: "bold italic underline | table | undo redo",
  });
})();

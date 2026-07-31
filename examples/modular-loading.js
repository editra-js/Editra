(async function () {
  "use strict";
  globalThis.modularEditor = await Editra.init({
    selector: "#media-editor",
    theme: "Word",
    plugins: ["formatting", "table"],
    toolbar: "foreColor highlighter | table undo redo",
  });
})();

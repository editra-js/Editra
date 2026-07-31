(async function () {
  "use strict";
  globalThis.wordDivEditor = await Editra.init({
    selector: "#editor",
    theme: "Word",
    plugins: ["formatting", "table", "image"],
    toolbar: "foreColor highlighter | table image | undo redo",
  });
})();

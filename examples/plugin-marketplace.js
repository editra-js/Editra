(async function () {
  "use strict";
  const list = document.querySelector("#plugin-list");
  const search = document.querySelector("#plugin-search");
  const editor = await Editra.init({
    selector: "#marketplace-editor",
    theme: "Word",
    pageSize: "Letter",
    orientation: "portrait",
    plugins: ["formatting"],
    toolbar: "foreColor highlighter | undo redo",
  });
  editor.setCode("<h2>Plugin sandbox</h2><p>This this sample contains a repeated word for the spell checker.</p>");
  const response = await fetch("../plugins/registry.json");
  if (!response.ok) throw new Error(`Unable to load registry: ${response.status}`);
  const registry = await response.json();
  const plugins = Array.isArray(registry.plugins) ? registry.plugins : [];
  const installed = new Map(
    JSON.parse(localStorage.getItem("editra.plugins.installed") || "[]")
      .map((item) => [item.id, item.version]),
  );

  function saveInstalled() {
    localStorage.setItem(
      "editra.plugins.installed",
      JSON.stringify([...installed].map(([id, version]) => ({ id, version }))),
    );
  }

  function card(plugin) {
    const article = document.createElement("article");
    article.className = "plugin-card";
    const heading = document.createElement("h2");
    heading.textContent = plugin.name;
    const metadata = document.createElement("small");
    metadata.textContent = `${plugin.version} · ${plugin.author} · ${plugin.type}`;
    const description = document.createElement("p");
    description.textContent = plugin.description;
    const action = document.createElement("button");
    action.type = "button";
    if (plugin.type === "builtin") {
      action.textContent = "Included with Editra";
      action.disabled = true;
    } else {
      action.textContent = installed.has(plugin.id) ? "Update / reload" : "Install in preview";
      action.addEventListener("click", async () => {
        action.disabled = true;
        try {
          await editor.installCommunityPlugin(plugin);
          installed.set(plugin.id, plugin.version);
          saveInstalled();
          action.textContent = `Installed ${plugin.version}`;
        } catch (error) {
          action.textContent = error.message;
        }
      });
    }
    article.append(heading, metadata, description, action);
    return article;
  }

  function render() {
    const query = search.value.trim().toLowerCase();
    const matches = plugins.filter((plugin) =>
      `${plugin.name} ${plugin.author} ${plugin.description}`.toLowerCase().includes(query),
    );
    list.replaceChildren(...matches.map(card));
  }

  search.addEventListener("input", render);
  render();
  globalThis.marketplaceEditor = editor;
})().catch((error) => {
  document.querySelector("#plugin-list").textContent = error.message;
});

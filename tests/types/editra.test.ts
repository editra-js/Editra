import Editra, {
  init,
  type EditraConfig,
  type EditraInstance,
  type IsolatedEditraInstance,
} from "editra-js";

const config: EditraConfig = {
  selector: "#editor",
  theme: "Word",
  plugins: ["bold", "productivity", "pagination"],
  pageSize: "A4",
  orientation: "portrait",
  margins: { top: "20mm", right: 72, bottom: "20mm", left: 72 },
  pagination: { repeatTableHeader: true, allowRowSplitting: true },
  onChange({ html, text }) {
    html.toUpperCase();
    text.toLowerCase();
  },
};

async function useEditra(): Promise<void> {
  const editor: EditraInstance = await Editra.init(config);
  editor.setHTML("<p>Hello</p>");
  editor.getCode().toUpperCase();
  await editor.executeCommand("insertMergeField", "Name");
  editor.destroy();

  const second = await init(document.createElement("div"), {
    theme: "Classic",
  });
  second.focus();

  const isolated: IsolatedEditraInstance = await Editra.init({
    selector: "#isolated-editor",
    isolation: "iframe",
    isolationUrl: "https://documents.example.test/frame.html",
  });
  (await isolated.getCode()).toUpperCase();
  await isolated.destroy();
}

void useEditra;

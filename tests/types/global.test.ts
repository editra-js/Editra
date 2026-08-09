/// <reference path="../../index.d.ts" />

async function useGlobalEditra(): Promise<void> {
  const options: Omit<Editra.EditraConfig, "selector"> = {
    theme: "Word",
    pageSize: "Legal",
    plugins: ["table", "export"],
  };
  const editor = await Editra.init("#global-editor", options);
  editor.getHTML().toUpperCase();
}

void useGlobalEditra;

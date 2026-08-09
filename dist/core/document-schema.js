(function (global) {
  "use strict";

  const SCHEMA = "https://editra.in/schema/document/v1";
  const VERSION = "1.0.0";
  const MAX_DEPTH = 100;
  const MAX_NODES = 100000;
  const MAX_TEXT_BYTES = 20 * 1024 * 1024;
  const TAGS = new Set((
    "a abbr address area article aside audio b bdi bdo blockquote br button caption " +
    "cite code col colgroup data dd del details dfn dialog div dl dt em figcaption figure " +
    "footer h1 h2 h3 h4 h5 h6 header hgroup hr i img ins kbd label li main map mark " +
    "menu meter nav ol p picture pre progress q rp rt ruby s samp section small source " +
    "span strong sub summary sup table tbody td tfoot th thead time tr track u ul var video " +
    "wbr svg circle ellipse g line path polygon polyline rect text title defs clipPath linearGradient " +
    "radialGradient stop symbol mask pattern marker desc"
  ).toLowerCase().split(/\s+/));
  const ATTRIBUTE_NAME = /^(?:[a-z_:][a-z0-9_.:-]*|data-[a-z0-9_.:-]+|aria-[a-z0-9_.:-]+)$/i;

  function textBytes(value) {
    return new TextEncoder().encode(value).byteLength;
  }

  class EditraDocumentSchema {
    constructor(editor) {
      this.editor = editor;
    }

    validate(documentModel) {
      const errors = [];
      let nodes = 0;
      let textSize = 0;
      const visit = (node, path, depth) => {
        nodes += 1;
        if (nodes > MAX_NODES) errors.push(`${path}: node limit exceeded`);
        if (depth > MAX_DEPTH) errors.push(`${path}: depth limit exceeded`);
        if (!node || typeof node !== "object" || Array.isArray(node)) {
          errors.push(`${path}: node must be an object`);
          return;
        }
        if (node.type === "text") {
          if (typeof node.text !== "string") errors.push(`${path}.text: must be a string`);
          else textSize += textBytes(node.text);
          return;
        }
        if (node.type !== "element") {
          errors.push(`${path}.type: unsupported node type`);
          return;
        }
        const tag = String(node.tag || "").toLowerCase();
        if (!TAGS.has(tag)) errors.push(`${path}.tag: unsupported element ${tag || "(empty)"}`);
        if (node.namespace !== undefined && node.namespace !== "svg") {
          errors.push(`${path}.namespace: unsupported namespace`);
        }
        if (
          node.attributes !== undefined &&
          (!node.attributes || typeof node.attributes !== "object" || Array.isArray(node.attributes))
        ) {
          errors.push(`${path}.attributes: must be an object`);
        } else {
          Object.entries(node.attributes || {}).forEach(([name, value]) => {
            if (!ATTRIBUTE_NAME.test(name) || /^on/i.test(name)) {
              errors.push(`${path}.attributes.${name}: unsupported attribute`);
            }
            if (typeof value !== "string") {
              errors.push(`${path}.attributes.${name}: value must be a string`);
            }
          });
        }
        if (!Array.isArray(node.content)) {
          errors.push(`${path}.content: must be an array`);
          return;
        }
        node.content.forEach((child, index) => visit(child, `${path}.content[${index}]`, depth + 1));
      };

      if (!documentModel || typeof documentModel !== "object" || Array.isArray(documentModel)) {
        errors.push("document: must be an object");
      } else {
        if (documentModel.schema !== SCHEMA) errors.push("schema: unsupported document schema");
        if (documentModel.version !== VERSION) errors.push("version: unsupported schema version");
        if (documentModel.type !== "document") errors.push("type: must be document");
        if (!Array.isArray(documentModel.content)) errors.push("content: must be an array");
        else documentModel.content.forEach((node, index) => visit(node, `content[${index}]`, 1));
      }
      if (textSize > MAX_TEXT_BYTES) errors.push("document: text byte limit exceeded");
      return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
    }

    export() {
      const template = document.createElement("template");
      template.innerHTML = this.editor.security.trustedHTML(
        this.editor.getCode(),
        "structured document export",
      );
      this.editor.security.restoreDeferredStyles(template.content);
      const convert = (node) => {
        if (node.nodeType === Node.TEXT_NODE) return { type: "text", text: node.nodeValue || "" };
        if (node.nodeType !== Node.ELEMENT_NODE) return null;
        const attributes = {};
        [...node.attributes]
          .sort((left, right) => left.name.localeCompare(right.name))
          .forEach((attribute) => { attributes[attribute.name] = attribute.value; });
        return {
          type: "element",
          tag: node.localName,
          ...(node.namespaceURI === "http://www.w3.org/2000/svg" ? { namespace: "svg" } : {}),
          ...(Object.keys(attributes).length ? { attributes } : {}),
          content: [...node.childNodes].map(convert).filter(Boolean),
        };
      };
      return {
        schema: SCHEMA,
        version: VERSION,
        type: "document",
        content: [...template.content.childNodes].map(convert).filter(Boolean),
      };
    }

    import(documentModel) {
      const outcome = this.validate(documentModel);
      if (!outcome.valid) {
        throw new TypeError(`Invalid Editra document: ${outcome.errors.join("; ")}`);
      }
      const create = (node) => {
        if (node.type === "text") return document.createTextNode(node.text);
        const element = node.namespace === "svg"
          ? document.createElementNS("http://www.w3.org/2000/svg", node.tag)
          : document.createElement(node.tag);
        Object.entries(node.attributes || {}).forEach(([name, value]) => {
          element.setAttribute(
            name.toLowerCase() === "style" ? "data-editra-deferred-style" : name,
            value,
          );
        });
        node.content.forEach((child) => element.append(create(child)));
        return element;
      };
      const container = document.createElement("div");
      documentModel.content.forEach((node) => container.append(create(node)));
      return String(this.editor.security.sanitize(container.innerHTML, {
        trusted: false,
        kind: "structured document import",
      }));
    }
  }

  EditraDocumentSchema.schema = SCHEMA;
  EditraDocumentSchema.version = VERSION;
  global.EditraDocumentSchema = EditraDocumentSchema;
})(window);

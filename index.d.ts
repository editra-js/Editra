/** TypeScript declarations for the framework-independent Editra JavaScript API. */

export as namespace Editra;

/** Visual layout applied to the editor surface. */
export type EditraTheme = "Word" | "Classic";
/** Color preference used by Editra controls. */
export type EditraColorScheme = "light" | "dark" | "system";
/** Direction in which a physical page is displayed and exported. */
export type EditraOrientation = "portrait" | "landscape";
/** Physical paper sizes supported by the page-size plugin. */
export type EditraPageSize =
  | "A3"
  | "A4"
  | "A5"
  | "B4"
  | "B5"
  | "Letter"
  | "Legal"
  | "Executive"
  | "Tabloid"
  | "Ledger"
  | "Statement"
  | "Folio"
  | "Quarto"
  | "10x14"
  | "C5 Envelope";

/** Identifier of a built-in plugin that can be enabled or disabled. */
export type EditraPluginName =
  | "bold"
  | "italic"
  | "underline"
  | "table"
  | "image"
  | "video"
  | "productivity"
  | "export"
  | "collaboration"
  | "formatting"
  | "fonts"
  | "languages"
  | "headings"
  | "lists"
  | "structure"
  | "codes"
  | "pagination"
  | "codeview"
  | "paste"
  | "uiConfig"
  | "theme"
  | "shortcuts"
  | "ruler"
  | "headerfooter"
  | "pagesize"
  | "margins"
  | "ecosystem";

/** CSS length such as `"20mm"`, `"1in"`, `"72px"`, or a pixel number. */
export type CSSLength = string | number;

/** Optional physical margins for each side of the document page. */
export interface EditraMargins {
  /** Distance between page content and the top edge. */
  top?: CSSLength;
  /** Distance between page content and the right edge. */
  right?: CSSLength;
  /** Distance between page content and the bottom edge. */
  bottom?: CSSLength;
  /** Distance between page content and the left edge. */
  left?: CSSLength;
}

/** Rules used by visual pagination and page-fidelity export. */
export interface EditraPaginationOptions {
  /** Keep each paragraph on one page when it fits. */
  keepParagraphsTogether?: boolean;
  /** Prevent individual list items from splitting when they fit. */
  keepListItemsTogether?: boolean;
  /** Allow a table row to continue onto the next page. */
  allowRowSplitting?: boolean;
  /** Keep table rows intact when their height permits it. */
  keepRowsTogether?: boolean;
  /** Keep a complete table on one page when the table fits. */
  keepTableTogether?: boolean;
  /** Keep code blocks intact when their height permits it. */
  keepCodeBlocksTogether?: boolean;
  /** Repeat a semantic `thead` when a table spans exported pages. */
  repeatTableHeader?: boolean;
}

/** Security policy applied to content, URLs, plugins, and network requests. */
export interface EditraSecurityOptions {
  /** Selects standard sanitization or the locked regulated profile. */
  profile?: "standard" | "regulated";
  /** SHA-256 integrity values keyed by runtime-relative asset path. */
  pluginIntegrity?: Record<string, string>;
  /** Optional CSP nonce placed on runtime plugin assets. */
  pluginNonce?: string;
  /** Origins from which reviewed plugin assets may load. */
  allowedPluginOrigins?: string[];
  /** Origins allowed for document links and external media. */
  allowedUrlOrigins?: string[];
  /** Origins allowed for collaboration and other live connections. */
  allowedConnectionOrigins?: string[];
  /** Additional safe protocols, commonly `mailto:` or `tel:`. */
  allowedExternalProtocols?: string[];
  /** Token forwarded by `secureRequest()` for request verification. */
  csrfToken?: string;
  [option: string]: unknown;
}

/** Metadata required to validate and sandbox a community plugin. */
export interface EditraCommunityPluginManifest {
  /** Stable lowercase registry identifier. */
  id: string;
  /** Human-readable plugin name. */
  name: string;
  /** Semantic plugin version. */
  version: string;
  /** Person or organization responsible for the plugin. */
  author: string;
  /** Short description shown to developers and users. */
  description: string;
  /** Minimum compatible Editra version. */
  compatibility: `>=${number}.${number}.${number}`;
  /** URL loaded inside the community-plugin sandbox. */
  entry: string;
  /** SHA-256 integrity value for the immutable entry document. */
  integrity: `sha256-${string}`;
  /** Minimum capabilities requested by the sandboxed plugin. */
  permissions: Array<
    | "document.readText"
    | "document.readHTML"
    | "commands.execute"
    | "ui.notify"
  >;
  /** Commands the plugin may request when command capability is granted. */
  allowedCommands?: string[];
  homepage?: string;
  ui?: { visible?: boolean; title?: string };
}

/** Payload delivered to the `onChange` callback. */
export interface EditraChangeDetail {
  /** Sanitized HTML that can be persisted by the host application. */
  html: string;
  /** Plain-text view of the current editor content. */
  text: string;
  /** Editable element, or `null` when the editor runs in an iframe. */
  editor: HTMLElement | null;
  isolated?: boolean;
}

/** Information emitted after a command has completed. */
export interface EditraCommandDetail {
  /** Command name passed to `executeCommand()`. */
  command: string;
  /** Arguments forwarded to the command handler. */
  args: unknown[];
  /** Synchronous or resolved result returned by the handler. */
  result: unknown;
  editor: EditraInstance;
  source: string;
  plugin: string | null;
}

/** Current toolbar, history, selection, and page-layout state. */
export interface EditraState {
  /** Whether an earlier history snapshot can be restored. */
  canUndo: boolean;
  /** Whether a newer history snapshot can be restored. */
  canRedo: boolean;
  /** Plugins active for this editor instance. */
  plugins: string[];
  pageSize?: EditraPageSize | "Custom";
  orientation?: EditraOrientation | "mixed";
  pageCount?: number;
  [state: string]: unknown;
}

/** Configuration accepted by `Editra.init()`. */
export interface EditraConfig {
  /** Div or textarea host, or a selector that resolves to one. */
  selector: string | HTMLElement;
  /** Optional URL used to resolve core, plugin, style, and asset files. */
  baseUrl?: string | URL;
  /** Word provides a page canvas; Classic provides a continuous surface. */
  theme?: EditraTheme;
  /** Light, dark, or operating-system color preference. */
  colorScheme?: EditraColorScheme;
  /** Built-in plugins to enable. The default enables all built-in plugins. */
  plugins?: EditraPluginName[];
  /** Built-in plugins to exclude from automatic loading. */
  disabledPlugins?: EditraPluginName[];
  /** Validated community plugins installed during initialization. */
  communityPlugins?: EditraCommunityPluginManifest[];
  /** Space-separated toolbar controls; `|` separates visual groups. */
  toolbar?: string;
  /** Menu names and items allowed in the menu bar. */
  menu?: Record<string, readonly unknown[]> | null;
  /** Set to `false` to build the editor without its menu bar. */
  showMenuBar?: boolean;
  /** Standard physical paper size used by the Word layout. */
  pageSize?: EditraPageSize;
  /** Portrait or landscape physical page orientation. */
  orientation?: EditraOrientation;
  /** Content padding, a numeric value, or a named margin preset. */
  margins?: EditraMargins | number | "normal" | "narrow" | "moderate" | "wide";
  /** Rules controlling which document blocks may split across pages. */
  pagination?: EditraPaginationOptions;
  /** Classic-theme surface width; standard Word pages ignore custom width. */
  editorWidth?: CSSLength;
  /** Classic-theme surface height; standard Word pages ignore custom height. */
  editorHeight?: CSSLength;
  editorHeightFixed?: boolean;
  /** Initial header content or header configuration. */
  header?: string | Record<string, unknown>;
  /** Initial footer content or footer configuration. */
  footer?: string | Record<string, unknown>;
  /** Crop printing to document content instead of the configured physical page. */
  printContentOnly?: boolean;
  /** Empty-editor helper text. */
  placeholder?: string;
  spellcheck?: boolean;
  sanitizePaste?: boolean;
  /** Maximum number of undo snapshots retained in memory. */
  historyLimit?: number;
  /** Maximum combined byte size of undo snapshots. */
  historyByteLimit?: number;
  /** BCP 47 language code used for document language behavior. */
  language?: string;
  /** Text direction, or `auto` to infer it from content. */
  direction?: "auto" | "ltr" | "rtl";
  translations?: Record<string, string>;
  /** Enables the locked regulated security profile. */
  regulated?: boolean;
  /** Active content, URL, request, and plugin security settings. */
  security?: EditraSecurityOptions;
  requestUrl?: string | null;
  /** Runs the editor behind the supported iframe message boundary. */
  isolation?: "iframe";
  /** URL of the Editra isolation frame; required with iframe isolation. */
  isolationUrl?: string | URL;
  /** Accessible title used by an isolated editor iframe. */
  label?: string;
  /** Runs after sanitized HTML or plain text changes. */
  onChange?: (detail: EditraChangeDetail) => void;
  /** Runs when selection, formatting, history, or page state changes. */
  onStateChange?: (state: EditraState) => void;
  /** Runs after a registered command completes. */
  onCommand?: (detail: EditraCommandDetail) => void;
  onPaste?: (detail: unknown) => unknown;
  /** Runs when editor focus is received. */
  onFocus?: (detail: unknown) => void;
  /** Runs when editor focus leaves. */
  onBlur?: (detail: unknown) => void;
  onMenuToggle?: (detail: unknown) => void;
  onToolbarBuild?: (detail: unknown) => void;
  onRulerAdjust?: (detail: unknown) => void;
  /** Runs when page count, size, orientation, or margins change. */
  onPageChange?: (detail: unknown) => void;
  onThemeToggle?: (detail: unknown) => void;
  onLanguageChange?: (detail: unknown) => void;
  /** Reports blocked content, URLs, requests, or security limits. */
  onSecurityViolation?: (detail: unknown) => void;
}

/** Persistable metadata for an image or video in the document. */
export interface EditraMediaRecord {
  source: string;
  value: string;
  bytes?: string | null;
  name: string | null;
  mime: string | null;
}

/** Media records separated by their document element type. */
export interface EditraMediaData {
  images: EditraMediaRecord[];
  videos: EditraMediaRecord[];
}

/** Public API of an editor running directly in the current document. */
export interface EditraInstance {
  /** Contenteditable element owned by this instance. */
  readonly editor: HTMLElement;
  /** Original div or textarea supplied during initialization. */
  readonly host: HTMLElement;
  /** Indicates that resources have been released and calls are no longer valid. */
  readonly destroyed: boolean;
  /** Returns sanitized HTML without temporary editor controls. */
  getCode(): string;
  /** Alias of `getCode()`. */
  getHTML(): string;
  /** Returns the document as plain text. */
  getText(): string;
  /** Returns a detached DOM clone without temporary editor controls. */
  getFormatted(): HTMLElement;
  /** Exports the versioned structured document representation. */
  getJSON(): unknown;
  /** Validates structured data without importing it. */
  validateJSON(documentModel: unknown): unknown;
  /** Replaces content from a valid structured document. */
  setJSON(documentModel: unknown): this;
  /** Replaces content with sanitized HTML. */
  setCode(html: string): this;
  /** Alias of `setCode()` for host applications that prefer HTML naming. */
  setHTML(html: string): this;
  /** Returns image and video metadata needed for durable persistence. */
  getMediaData(): EditraMediaData;
  /** Sanitizes untrusted HTML using this editor's active security profile. */
  sanitizeHTML(html: string, options?: Record<string, unknown>): string;
  /** Performs an origin-checked request using the active security policy. */
  secureRequest(url: string | URL, options?: RequestInit): Promise<Response>;
  /** Executes a registered editor or plugin command. */
  executeCommand<T = unknown>(name: string, ...args: unknown[]): T | Promise<T> | false;
  /** Registers a host command and returns an unregister function. */
  registerCommand(
    name: string,
    handler: (...args: unknown[]) => unknown,
    options?: { plugin?: string | null; source?: string },
  ): () => void;
  /** Registers resource cleanup and returns a function that can run it early. */
  registerCleanup(callback: () => void): () => void;
  /** Focuses the editable surface without replacing document content. */
  focus(): void;
  /** Restores the previous document history snapshot. */
  undo(): void;
  /** Restores the next document history snapshot. */
  redo(): void;
  /** Releases listeners, observers, plugins, URLs, UI, and textarea state. */
  destroy(): void;
  /** Validates and installs a community plugin in its sandbox. */
  installCommunityPlugin(manifest: EditraCommunityPluginManifest): Promise<unknown>;
  /** Removes a community plugin and releases its sandbox resources. */
  uninstallCommunityPlugin(id: string): Promise<unknown>;
  /** Returns validated metadata for installed community plugins. */
  getInstalledCommunityPlugins(): Promise<readonly EditraCommunityPluginManifest[]>;
  /** Compares installed plugins with a compatible registry document. */
  checkCommunityPluginUpdates(registryUrl?: string): Promise<unknown>;
}

/** Async proxy API of an editor running in a separate iframe. */
export interface IsolatedEditraInstance {
  /** Identifies this instance as an iframe proxy. */
  readonly isolation: "iframe";
  /** Original host hidden while the isolated editor is active. */
  readonly host: HTMLElement;
  /** Iframe containing the isolated editor runtime. */
  readonly frame: HTMLIFrameElement;
  /** Resolves after the message channel and editor are initialized. */
  readonly ready: Promise<IsolatedEditraInstance>;
  /** Requests sanitized HTML through the isolation channel. */
  getCode(): Promise<string>;
  /** Alias of `getCode()`. */
  getHTML(): Promise<string>;
  /** Requests plain document text through the isolation channel. */
  getText(): Promise<string>;
  /** Requests the current editor state. */
  getState(): Promise<EditraState>;
  /** Requests the structured document representation. */
  getJSON(): Promise<unknown>;
  validateJSON(documentModel: unknown): Promise<unknown>;
  setJSON(documentModel: unknown): Promise<unknown>;
  setCode(html: string): Promise<unknown>;
  setHTML(html: string): Promise<unknown>;
  /** Executes a command inside the isolated editor. */
  executeCommand<T = unknown>(name: string, ...args: unknown[]): Promise<T>;
  /** Requests focus inside the isolated editor. */
  focus(): Promise<unknown>;
  /** Destroys the iframe editor and restores the original host. */
  destroy(): Promise<void>;
}

/** Browser core returned by `Editra.load()`. */
export interface EditraRuntime {
  init(config: EditraConfig & { selector: string | HTMLElement }): Promise<EditraInstance>;
}

/** Package and browser-global Editra API. */
export interface EditraStatic {
  /** Runtime version exposed by the loaded package entry. */
  readonly version: string;
  /** npm package version used to build the entry. */
  readonly packageVersion: string;
  init(
    config: EditraConfig & {
      selector: string | HTMLElement;
      isolation: "iframe";
      isolationUrl: string | URL;
    },
  ): Promise<IsolatedEditraInstance>;
  init(
    config: EditraConfig & { selector: string | HTMLElement },
  ): Promise<EditraInstance>;
  init(
    selector: string | HTMLElement,
    options?: Omit<EditraConfig, "selector">,
  ): Promise<EditraInstance>;
  load(
    baseUrl?: string | URL,
    config?: Partial<EditraConfig> | null,
  ): Promise<EditraRuntime>;
}

/** Initializes an iframe-isolated editor and returns its asynchronous proxy. */
export declare function init(
  config: EditraConfig & {
    selector: string | HTMLElement;
    isolation: "iframe";
    isolationUrl: string | URL;
  },
): Promise<IsolatedEditraInstance>;
/** Initializes Editra from a configuration object containing a host selector. */
export declare function init(
  config: EditraConfig & { selector: string | HTMLElement },
): Promise<EditraInstance>;
/** Initializes Editra using the convenient `selector, options` call style. */
export declare function init(
  selector: string | HTMLElement,
  options?: Omit<EditraConfig, "selector">,
): Promise<EditraInstance>;

/** Loads the browser core without creating an editor instance. */
export declare function load(
  baseUrl?: string | URL,
  config?: Partial<EditraConfig> | null,
): Promise<EditraRuntime>;

/** Default package export and the value exposed as `window.Editra`. */
declare const Editra: EditraStatic;
export default Editra;

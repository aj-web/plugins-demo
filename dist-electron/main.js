"use strict";
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
const electron = require("electron");
const child_process = require("child_process");
const fs$8 = require("fs");
const path$6 = require("path");
const https = require("https");
const http = require("http");
const require$$0 = require("events");
const require$$0$1 = require("constants");
const require$$0$2 = require("stream");
const require$$0$3 = require("util");
const require$$5 = require("assert");
const require$$0$4 = require("buffer");
const require$$0$5 = require("zlib");
const url = require("url");
const os = require("os");
const crypto = require("crypto");
function _interopNamespaceDefault(e) {
  const n = Object.create(null, { [Symbol.toStringTag]: { value: "Module" } });
  if (e) {
    for (const k in e) {
      if (k !== "default") {
        const d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: () => e[k]
        });
      }
    }
  }
  n.default = e;
  return Object.freeze(n);
}
const fs__namespace = /* @__PURE__ */ _interopNamespaceDefault(fs$8);
const path__namespace = /* @__PURE__ */ _interopNamespaceDefault(path$6);
const os__namespace = /* @__PURE__ */ _interopNamespaceDefault(os);
class PathManager {
  constructor() {
    this.isPackaged = !!(process.resourcesPath && !process.resourcesPath.includes("node_modules"));
    this.isDev = !this.isPackaged;
  }
  /**
   * 获取应用根目录
   * @returns {string} 应用根目录路径
   */
  getAppRoot() {
    if (this.isPackaged) {
      return path$6.dirname(process.resourcesPath);
    } else {
      return path$6.resolve(__dirname, "..");
    }
  }
  /**
   * 获取插件目录路径
   * @returns {string} 插件目录路径
   */
  getPluginsDir() {
    if (this.isPackaged) {
      return path$6.join(process.resourcesPath, "plugins");
    } else {
      return path$6.join(this.getAppRoot(), "plugins");
    }
  }
  /**
   * 获取指定插件的目录路径
   * @param {string} pluginName 插件名称
   * @returns {string} 插件目录路径
   */
  getPluginDir(pluginName) {
    return path$6.join(this.getPluginsDir(), pluginName);
  }
  /**
   * 获取插件的 manifest.json 路径
   * @param {string} pluginName 插件名称
   * @returns {string} manifest.json 路径
   */
  getPluginManifestPath(pluginName) {
    return path$6.join(this.getPluginDir(pluginName), "manifest.json");
  }
  /**
   * 获取插件的入口文件路径（plugin_host.js）
   * @param {string} pluginName 插件名称
   * @returns {string} 插件入口文件路径
   */
  getPluginHostPath(pluginName) {
    return path$6.join(this.getPluginDir(pluginName), "plugin_host.js");
  }
  /**
   * 获取插件的业务文件路径
   * @param {string} pluginName 插件名称
   * @param {string} jsFile 业务文件名
   * @returns {string} 业务文件路径
   */
  getPluginBusinessPath(pluginName, jsFile) {
    return path$6.join(this.getPluginDir(pluginName), jsFile);
  }
  /**
   * 获取插件的资源路径（用于前端加载）
   * @param {string} pluginName 插件名称
   * @returns {string} 插件资源路径
   */
  getPluginResourcePath(pluginName) {
    const pluginPath = this.getPluginDir(pluginName);
    return `file://${pluginPath.replace(/\\/g, "/")}`;
  }
  /**
   * 获取 FFmpeg 可执行文件路径
   * @returns {string|null} FFmpeg 路径，如果不存在则返回 null
   */
  getFfmpegPath() {
    const possiblePaths = [
      // 打包环境：resources/ffmpeg.exe
      this.isPackaged ? path$6.join(process.resourcesPath, "ffmpeg.exe") : null,
      // 开发环境：项目根目录下的 ffmpeg.exe
      path$6.join(this.getAppRoot(), "ffmpeg.exe"),
      // 当前工作目录下的 ffmpeg.exe
      path$6.join(process.cwd(), "ffmpeg.exe")
    ].filter(Boolean);
    for (const ffmpegPath of possiblePaths) {
      if (fs$8.existsSync(ffmpegPath)) {
        return ffmpegPath;
      }
    }
    return null;
  }
  getChromePath() {
    const possiblePaths = [
      // 打包环境：resources/chromium-1181/chrome-win/chrome.exe
      this.isPackaged ? path$6.join(process.resourcesPath, "chromium-1181", "chrome-win", "chrome.exe") : null,
      // 开发环境：项目根目录下的 chromium-1181/chrome-win/chrome.exe
      path$6.join(this.getAppRoot(), "chromium-1181", "chrome-win", "chrome.exe"),
      // 当前工作目录下的 chromium-1181/chrome-win/chrome.exe
      path$6.join(process.cwd(), "chromium-1181", "chrome-win", "chrome.exe")
    ].filter(Boolean);
    for (const chromePath of possiblePaths) {
      if (fs$8.existsSync(chromePath)) {
        return chromePath;
      }
    }
    return null;
  }
  /**
   * 检查插件是否存在
   * @param {string} pluginName 插件名称
   * @returns {boolean} 插件是否存在
   */
  pluginExists(pluginName) {
    const pluginDir = this.getPluginDir(pluginName);
    const manifestPath = this.getPluginManifestPath(pluginName);
    const hostPath = this.getPluginHostPath(pluginName);
    return fs$8.existsSync(pluginDir) && fs$8.existsSync(manifestPath) && fs$8.existsSync(hostPath);
  }
  /**
   * 获取所有可用的插件列表
   * @returns {string[]} 插件名称列表
   */
  getAvailablePlugins() {
    const pluginsDir = this.getPluginsDir();
    if (!fs$8.existsSync(pluginsDir)) {
      return [];
    }
    try {
      return fs$8.readdirSync(pluginsDir, { withFileTypes: true }).filter((dirent) => dirent.isDirectory()).map((dirent) => dirent.name).filter((pluginName) => this.pluginExists(pluginName));
    } catch (error2) {
      console.error("Error reading plugins directory:", error2);
      return [];
    }
  }
  /**
   * 获取环境信息（用于调试）
   * @returns {object} 环境信息
   */
  getEnvironmentInfo() {
    return {
      isDev: this.isDev,
      isPackaged: this.isPackaged,
      appRoot: this.getAppRoot(),
      pluginsDir: this.getPluginsDir(),
      ffmpegPath: this.getFfmpegPath(),
      availablePlugins: this.getAvailablePlugins()
    };
  }
}
const pathManager = new PathManager();
class PluginManager {
  constructor() {
    __publicField(this, "pluginProcesses", /* @__PURE__ */ new Map());
    __publicField(this, "manifestCache", /* @__PURE__ */ new Map());
    __publicField(this, "displayNameToFolderMap", /* @__PURE__ */ new Map());
  }
  async getManifest(pluginName) {
    console.log("[PluginManager] getManifest called with pluginName:", pluginName);
    if (this.manifestCache.has(pluginName)) {
      console.log("[PluginManager] getManifest returning cached manifest for:", pluginName);
      return this.manifestCache.get(pluginName);
    }
    const actualPluginName = this.getActualPluginName(pluginName);
    const manifestPath = pathManager.getPluginManifestPath(actualPluginName);
    console.log("[PluginManager] getManifest manifestPath:", manifestPath);
    if (!fs$8.existsSync(manifestPath)) {
      console.error("[PluginManager] getManifest manifest not found at:", manifestPath);
      throw new Error("manifest.json not found");
    }
    const manifestRaw = fs$8.readFileSync(manifestPath, "utf-8");
    const manifest = JSON.parse(manifestRaw);
    console.log("[PluginManager] getManifest parsed manifest:", manifest);
    this.manifestCache.set(pluginName, manifest);
    return manifest;
  }
  async triggerEvent(pluginName, eventType, params = {}) {
    var _a;
    console.log("[PluginManager] triggerEvent called with:", { pluginName, eventType, params });
    const manifest = await this.getManifest(pluginName);
    const eventRoute = (_a = manifest.events) == null ? void 0 : _a.find((e) => e.id === eventType);
    console.log("[PluginManager] triggerEvent found eventRoute:", eventRoute);
    if (!eventRoute) {
      console.error("[PluginManager] triggerEvent event not found in manifest for eventType:", eventType);
      throw new Error("event not found in manifest");
    }
    if (eventType === "stop-processing") {
      console.log("[PluginManager] triggerEvent calling stopPluginProcess for:", pluginName);
      return this.stopPluginProcess(pluginName);
    }
    console.log("[PluginManager] triggerEvent calling executePluginEvent for:", { pluginName, eventRoute });
    return this.executePluginEvent(pluginName, eventRoute, params);
  }
  stopPluginProcess(pluginName) {
    const child = this.pluginProcesses.get(pluginName);
    if (child) {
      child.send({ type: "stop" });
      return { success: true };
    }
    return { success: false, error: "No plugin process" };
  }
  async executePluginEvent(pluginName, eventRoute, params) {
    console.log("[PluginManager] executePluginEvent called with:", { pluginName, eventRoute, params });
    const callData = {
      class: eventRoute.class,
      method: eventRoute.method,
      args: params.args || []
    };
    const data = { ...params, call: callData };
    console.log("[PluginManager] executePluginEvent callData:", callData);
    console.log("[PluginManager] executePluginEvent data:", data);
    let child = this.pluginProcesses.get(pluginName);
    console.log("[PluginManager] executePluginEvent existing child process:", !!child);
    if (!child) {
      console.log("[PluginManager] executePluginEvent starting new plugin process for:", pluginName);
      child = await this.startPluginProcess(pluginName);
    }
    console.log("[PluginManager] executePluginEvent sending to plugin process:", { jsFile: eventRoute.jsFile, ...data });
    return this.sendToPluginProcess(child, { jsFile: eventRoute.jsFile, ...data });
  }
  async startPluginProcess(pluginName) {
    console.log("[PluginManager] startPluginProcess called with pluginName:", pluginName);
    const actualPluginName = this.getActualPluginName(pluginName);
    console.log("[PluginManager] startPluginProcess actualPluginName:", actualPluginName);
    const entry = pathManager.getPluginHostPath(actualPluginName);
    console.log("[PluginManager] startPluginProcess entry path:", entry);
    if (!fs$8.existsSync(entry)) {
      console.error("[PluginManager] startPluginProcess plugin_host.js not found at:", entry);
      throw new Error("No plugin_host.js found");
    }
    const env = { ...process.env };
    const ffmpegPath = pathManager.getFfmpegPath();
    if (ffmpegPath) {
      env.FFMPEG_PATH = ffmpegPath;
      console.log("[PluginManager] startPluginProcess Found FFmpeg at:", ffmpegPath);
    }
    const chromePath = pathManager.getChromePath();
    if (chromePath) {
      env.CHROME_PATH = chromePath;
      env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH = chromePath;
      console.log("[PluginManager] startPluginProcess Found Chrome at:", chromePath);
    }
    console.log("[PluginManager] startPluginProcess forking process with entry:", entry);
    const child = child_process.fork(entry, [], { env });
    this.pluginProcesses.set(pluginName, child);
    console.log("[PluginManager] startPluginProcess child process created, pid:", child.pid);
    child.on("message", (msg) => {
      console.log("[PluginManager] startPluginProcess received message from child:", msg);
      if (msg && msg.type === "stopped") {
        console.log("[PluginManager] startPluginProcess plugin stopped, notifying windows");
        const { BrowserWindow } = require("electron");
        for (const win of BrowserWindow.getAllWindows()) {
          win.webContents.send("business-stopped");
        }
      }
    });
    child.on("exit", (code) => {
      console.log("[PluginManager] startPluginProcess child process exited with code:", code);
      this.pluginProcesses.delete(pluginName);
    });
    child.on("error", (error2) => {
      console.error("[PluginManager] startPluginProcess child process error:", error2);
    });
    return child;
  }
  sendToPluginProcess(child, data) {
    console.log("[PluginManager] sendToPluginProcess called with data:", data);
    return new Promise((resolve2, reject2) => {
      const timeout2 = setTimeout(() => {
        console.error("[PluginManager] sendToPluginProcess timeout after 10 minutes");
        reject2(new Error("Plugin process timeout"));
      }, 12e5);
      child.once("message", (response) => {
        console.log("[PluginManager] sendToPluginProcess received response:", response);
        clearTimeout(timeout2);
        if (response && response.error) {
          console.error("[PluginManager] sendToPluginProcess response has error:", response.error);
          reject2(new Error(response.error));
        } else {
          console.log("[PluginManager] sendToPluginProcess resolving with response:", response);
          resolve2(response);
        }
      });
      console.log("[PluginManager] sendToPluginProcess sending data to child process");
      child.send(data);
    });
  }
  getAvailablePlugins() {
    const pluginDirs = pathManager.getAvailablePlugins();
    return pluginDirs.map((pluginName) => {
      let displayName = pluginName;
      try {
        const manifestPath = pathManager.getPluginManifestPath(pluginName);
        if (fs$8.existsSync(manifestPath)) {
          const manifestContent = fs$8.readFileSync(manifestPath, "utf-8");
          const manifest = JSON.parse(manifestContent);
          if (manifest.name && typeof manifest.name === "string") {
            displayName = manifest.name;
            this.setDisplayNameMapping(displayName, pluginName);
          }
        }
      } catch (error2) {
        console.warn(`Failed to read manifest for plugin ${pluginName}:`, error2);
      }
      return {
        name: displayName,
        status: "ready"
      };
    });
  }
  /**
   * 设置显示名称到文件夹名的映射
   * @param displayName 显示名称
   * @param folderName 实际文件夹名
   */
  setDisplayNameMapping(displayName, folderName) {
    console.log("[PluginManager] setDisplayNameMapping:", { displayName, folderName });
    this.displayNameToFolderMap.set(displayName, folderName);
  }
  /**
   * 根据显示名称获取实际的文件夹名
   * @param pluginName 显示名称或文件夹名
   * @returns 实际的文件夹名
   */
  getActualPluginName(pluginName) {
    const actualName = this.displayNameToFolderMap.get(pluginName) || pluginName;
    console.log("[PluginManager] getActualPluginName:", { pluginName, actualName });
    return actualName;
  }
  cleanup() {
    this.pluginProcesses.forEach((child, pluginName) => {
      child.kill();
      this.pluginProcesses.delete(pluginName);
    });
    this.manifestCache.clear();
    this.displayNameToFolderMap.clear();
  }
}
const pluginManager = new PluginManager();
var commonjsGlobal = typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : {};
function getDefaultExportFromCjs(x) {
  return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, "default") ? x["default"] : x;
}
function getAugmentedNamespace(n) {
  if (n.__esModule) return n;
  var f = n.default;
  if (typeof f == "function") {
    var a = function a2() {
      if (this instanceof a2) {
        return Reflect.construct(f, arguments, this.constructor);
      }
      return f.apply(this, arguments);
    };
    a.prototype = f.prototype;
  } else a = {};
  Object.defineProperty(a, "__esModule", { value: true });
  Object.keys(n).forEach(function(k) {
    var d = Object.getOwnPropertyDescriptor(n, k);
    Object.defineProperty(a, k, d.get ? d : {
      enumerable: true,
      get: function() {
        return n[k];
      }
    });
  });
  return a;
}
const isWindows$1 = typeof process === "object" && process && process.platform === "win32";
var path$5 = isWindows$1 ? { sep: "\\" } : { sep: "/" };
var balancedMatch = balanced$1;
function balanced$1(a, b, str) {
  if (a instanceof RegExp) a = maybeMatch(a, str);
  if (b instanceof RegExp) b = maybeMatch(b, str);
  var r = range$1(a, b, str);
  return r && {
    start: r[0],
    end: r[1],
    pre: str.slice(0, r[0]),
    body: str.slice(r[0] + a.length, r[1]),
    post: str.slice(r[1] + b.length)
  };
}
function maybeMatch(reg, str) {
  var m = str.match(reg);
  return m ? m[0] : null;
}
balanced$1.range = range$1;
function range$1(a, b, str) {
  var begs, beg, left, right, result;
  var ai = str.indexOf(a);
  var bi = str.indexOf(b, ai + 1);
  var i = ai;
  if (ai >= 0 && bi > 0) {
    if (a === b) {
      return [ai, bi];
    }
    begs = [];
    left = str.length;
    while (i >= 0 && !result) {
      if (i == ai) {
        begs.push(i);
        ai = str.indexOf(a, i + 1);
      } else if (begs.length == 1) {
        result = [begs.pop(), bi];
      } else {
        beg = begs.pop();
        if (beg < left) {
          left = beg;
          right = bi;
        }
        bi = str.indexOf(b, i + 1);
      }
      i = ai < bi && ai >= 0 ? ai : bi;
    }
    if (begs.length) {
      result = [left, right];
    }
  }
  return result;
}
var balanced = balancedMatch;
var braceExpansion = expandTop;
var escSlash = "\0SLASH" + Math.random() + "\0";
var escOpen = "\0OPEN" + Math.random() + "\0";
var escClose = "\0CLOSE" + Math.random() + "\0";
var escComma = "\0COMMA" + Math.random() + "\0";
var escPeriod = "\0PERIOD" + Math.random() + "\0";
function numeric(str) {
  return parseInt(str, 10) == str ? parseInt(str, 10) : str.charCodeAt(0);
}
function escapeBraces(str) {
  return str.split("\\\\").join(escSlash).split("\\{").join(escOpen).split("\\}").join(escClose).split("\\,").join(escComma).split("\\.").join(escPeriod);
}
function unescapeBraces(str) {
  return str.split(escSlash).join("\\").split(escOpen).join("{").split(escClose).join("}").split(escComma).join(",").split(escPeriod).join(".");
}
function parseCommaParts(str) {
  if (!str)
    return [""];
  var parts = [];
  var m = balanced("{", "}", str);
  if (!m)
    return str.split(",");
  var pre = m.pre;
  var body = m.body;
  var post = m.post;
  var p = pre.split(",");
  p[p.length - 1] += "{" + body + "}";
  var postParts = parseCommaParts(post);
  if (post.length) {
    p[p.length - 1] += postParts.shift();
    p.push.apply(p, postParts);
  }
  parts.push.apply(parts, p);
  return parts;
}
function expandTop(str) {
  if (!str)
    return [];
  if (str.substr(0, 2) === "{}") {
    str = "\\{\\}" + str.substr(2);
  }
  return expand$1(escapeBraces(str), true).map(unescapeBraces);
}
function embrace(str) {
  return "{" + str + "}";
}
function isPadded(el) {
  return /^-?0\d/.test(el);
}
function lte(i, y) {
  return i <= y;
}
function gte(i, y) {
  return i >= y;
}
function expand$1(str, isTop) {
  var expansions = [];
  var m = balanced("{", "}", str);
  if (!m) return [str];
  var pre = m.pre;
  var post = m.post.length ? expand$1(m.post, false) : [""];
  if (/\$$/.test(m.pre)) {
    for (var k = 0; k < post.length; k++) {
      var expansion = pre + "{" + m.body + "}" + post[k];
      expansions.push(expansion);
    }
  } else {
    var isNumericSequence = /^-?\d+\.\.-?\d+(?:\.\.-?\d+)?$/.test(m.body);
    var isAlphaSequence = /^[a-zA-Z]\.\.[a-zA-Z](?:\.\.-?\d+)?$/.test(m.body);
    var isSequence = isNumericSequence || isAlphaSequence;
    var isOptions = m.body.indexOf(",") >= 0;
    if (!isSequence && !isOptions) {
      if (m.post.match(/,(?!,).*\}/)) {
        str = m.pre + "{" + m.body + escClose + m.post;
        return expand$1(str);
      }
      return [str];
    }
    var n;
    if (isSequence) {
      n = m.body.split(/\.\./);
    } else {
      n = parseCommaParts(m.body);
      if (n.length === 1) {
        n = expand$1(n[0], false).map(embrace);
        if (n.length === 1) {
          return post.map(function(p) {
            return m.pre + n[0] + p;
          });
        }
      }
    }
    var N;
    if (isSequence) {
      var x = numeric(n[0]);
      var y = numeric(n[1]);
      var width = Math.max(n[0].length, n[1].length);
      var incr = n.length == 3 ? Math.abs(numeric(n[2])) : 1;
      var test = lte;
      var reverse = y < x;
      if (reverse) {
        incr *= -1;
        test = gte;
      }
      var pad = n.some(isPadded);
      N = [];
      for (var i = x; test(i, y); i += incr) {
        var c;
        if (isAlphaSequence) {
          c = String.fromCharCode(i);
          if (c === "\\")
            c = "";
        } else {
          c = String(i);
          if (pad) {
            var need = width - c.length;
            if (need > 0) {
              var z = new Array(need + 1).join("0");
              if (i < 0)
                c = "-" + z + c.slice(1);
              else
                c = z + c;
            }
          }
        }
        N.push(c);
      }
    } else {
      N = [];
      for (var j = 0; j < n.length; j++) {
        N.push.apply(N, expand$1(n[j], false));
      }
    }
    for (var j = 0; j < N.length; j++) {
      for (var k = 0; k < post.length; k++) {
        var expansion = pre + N[j] + post[k];
        if (!isTop || isSequence || expansion)
          expansions.push(expansion);
      }
    }
  }
  return expansions;
}
const minimatch$1 = minimatch_1 = (p, pattern, options = {}) => {
  assertValidPattern(pattern);
  if (!options.nocomment && pattern.charAt(0) === "#") {
    return false;
  }
  return new Minimatch$2(pattern, options).match(p);
};
var minimatch_1 = minimatch$1;
const path$4 = path$5;
minimatch$1.sep = path$4.sep;
const GLOBSTAR = Symbol("globstar **");
minimatch$1.GLOBSTAR = GLOBSTAR;
const expand = braceExpansion;
const plTypes = {
  "!": { open: "(?:(?!(?:", close: "))[^/]*?)" },
  "?": { open: "(?:", close: ")?" },
  "+": { open: "(?:", close: ")+" },
  "*": { open: "(?:", close: ")*" },
  "@": { open: "(?:", close: ")" }
};
const qmark = "[^/]";
const star = qmark + "*?";
const twoStarDot = "(?:(?!(?:\\/|^)(?:\\.{1,2})($|\\/)).)*?";
const twoStarNoDot = "(?:(?!(?:\\/|^)\\.).)*?";
const charSet = (s) => s.split("").reduce((set, c) => {
  set[c] = true;
  return set;
}, {});
const reSpecials = charSet("().*{}+?[]^$\\!");
const addPatternStartSet = charSet("[.(");
const slashSplit = /\/+/;
minimatch$1.filter = (pattern, options = {}) => (p, i, list) => minimatch$1(p, pattern, options);
const ext = (a, b = {}) => {
  const t = {};
  Object.keys(a).forEach((k) => t[k] = a[k]);
  Object.keys(b).forEach((k) => t[k] = b[k]);
  return t;
};
minimatch$1.defaults = (def) => {
  if (!def || typeof def !== "object" || !Object.keys(def).length) {
    return minimatch$1;
  }
  const orig = minimatch$1;
  const m = (p, pattern, options) => orig(p, pattern, ext(def, options));
  m.Minimatch = class Minimatch extends orig.Minimatch {
    constructor(pattern, options) {
      super(pattern, ext(def, options));
    }
  };
  m.Minimatch.defaults = (options) => orig.defaults(ext(def, options)).Minimatch;
  m.filter = (pattern, options) => orig.filter(pattern, ext(def, options));
  m.defaults = (options) => orig.defaults(ext(def, options));
  m.makeRe = (pattern, options) => orig.makeRe(pattern, ext(def, options));
  m.braceExpand = (pattern, options) => orig.braceExpand(pattern, ext(def, options));
  m.match = (list, pattern, options) => orig.match(list, pattern, ext(def, options));
  return m;
};
minimatch$1.braceExpand = (pattern, options) => braceExpand(pattern, options);
const braceExpand = (pattern, options = {}) => {
  assertValidPattern(pattern);
  if (options.nobrace || !/\{(?:(?!\{).)*\}/.test(pattern)) {
    return [pattern];
  }
  return expand(pattern);
};
const MAX_PATTERN_LENGTH = 1024 * 64;
const assertValidPattern = (pattern) => {
  if (typeof pattern !== "string") {
    throw new TypeError("invalid pattern");
  }
  if (pattern.length > MAX_PATTERN_LENGTH) {
    throw new TypeError("pattern is too long");
  }
};
const SUBPARSE = Symbol("subparse");
minimatch$1.makeRe = (pattern, options) => new Minimatch$2(pattern, options || {}).makeRe();
minimatch$1.match = (list, pattern, options = {}) => {
  const mm = new Minimatch$2(pattern, options);
  list = list.filter((f) => mm.match(f));
  if (mm.options.nonull && !list.length) {
    list.push(pattern);
  }
  return list;
};
const globUnescape = (s) => s.replace(/\\(.)/g, "$1");
const charUnescape = (s) => s.replace(/\\([^-\]])/g, "$1");
const regExpEscape = (s) => s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
const braExpEscape = (s) => s.replace(/[[\]\\]/g, "\\$&");
let Minimatch$2 = class Minimatch {
  constructor(pattern, options) {
    assertValidPattern(pattern);
    if (!options) options = {};
    this.options = options;
    this.set = [];
    this.pattern = pattern;
    this.windowsPathsNoEscape = !!options.windowsPathsNoEscape || options.allowWindowsEscape === false;
    if (this.windowsPathsNoEscape) {
      this.pattern = this.pattern.replace(/\\/g, "/");
    }
    this.regexp = null;
    this.negate = false;
    this.comment = false;
    this.empty = false;
    this.partial = !!options.partial;
    this.make();
  }
  debug() {
  }
  make() {
    const pattern = this.pattern;
    const options = this.options;
    if (!options.nocomment && pattern.charAt(0) === "#") {
      this.comment = true;
      return;
    }
    if (!pattern) {
      this.empty = true;
      return;
    }
    this.parseNegate();
    let set = this.globSet = this.braceExpand();
    if (options.debug) this.debug = (...args) => console.error(...args);
    this.debug(this.pattern, set);
    set = this.globParts = set.map((s) => s.split(slashSplit));
    this.debug(this.pattern, set);
    set = set.map((s, si, set2) => s.map(this.parse, this));
    this.debug(this.pattern, set);
    set = set.filter((s) => s.indexOf(false) === -1);
    this.debug(this.pattern, set);
    this.set = set;
  }
  parseNegate() {
    if (this.options.nonegate) return;
    const pattern = this.pattern;
    let negate = false;
    let negateOffset = 0;
    for (let i = 0; i < pattern.length && pattern.charAt(i) === "!"; i++) {
      negate = !negate;
      negateOffset++;
    }
    if (negateOffset) this.pattern = pattern.slice(negateOffset);
    this.negate = negate;
  }
  // set partial to true to test if, for example,
  // "/a/b" matches the start of "/*/b/*/d"
  // Partial means, if you run out of file before you run
  // out of pattern, then that's fine, as long as all
  // the parts match.
  matchOne(file2, pattern, partial) {
    var options = this.options;
    this.debug(
      "matchOne",
      { "this": this, file: file2, pattern }
    );
    this.debug("matchOne", file2.length, pattern.length);
    for (var fi = 0, pi = 0, fl = file2.length, pl = pattern.length; fi < fl && pi < pl; fi++, pi++) {
      this.debug("matchOne loop");
      var p = pattern[pi];
      var f = file2[fi];
      this.debug(pattern, p, f);
      if (p === false) return false;
      if (p === GLOBSTAR) {
        this.debug("GLOBSTAR", [pattern, p, f]);
        var fr = fi;
        var pr = pi + 1;
        if (pr === pl) {
          this.debug("** at the end");
          for (; fi < fl; fi++) {
            if (file2[fi] === "." || file2[fi] === ".." || !options.dot && file2[fi].charAt(0) === ".") return false;
          }
          return true;
        }
        while (fr < fl) {
          var swallowee = file2[fr];
          this.debug("\nglobstar while", file2, fr, pattern, pr, swallowee);
          if (this.matchOne(file2.slice(fr), pattern.slice(pr), partial)) {
            this.debug("globstar found match!", fr, fl, swallowee);
            return true;
          } else {
            if (swallowee === "." || swallowee === ".." || !options.dot && swallowee.charAt(0) === ".") {
              this.debug("dot detected!", file2, fr, pattern, pr);
              break;
            }
            this.debug("globstar swallow a segment, and continue");
            fr++;
          }
        }
        if (partial) {
          this.debug("\n>>> no match, partial?", file2, fr, pattern, pr);
          if (fr === fl) return true;
        }
        return false;
      }
      var hit;
      if (typeof p === "string") {
        hit = f === p;
        this.debug("string match", p, f, hit);
      } else {
        hit = f.match(p);
        this.debug("pattern match", p, f, hit);
      }
      if (!hit) return false;
    }
    if (fi === fl && pi === pl) {
      return true;
    } else if (fi === fl) {
      return partial;
    } else if (pi === pl) {
      return fi === fl - 1 && file2[fi] === "";
    }
    throw new Error("wtf?");
  }
  braceExpand() {
    return braceExpand(this.pattern, this.options);
  }
  parse(pattern, isSub) {
    assertValidPattern(pattern);
    const options = this.options;
    if (pattern === "**") {
      if (!options.noglobstar)
        return GLOBSTAR;
      else
        pattern = "*";
    }
    if (pattern === "") return "";
    let re = "";
    let hasMagic = false;
    let escaping = false;
    const patternListStack = [];
    const negativeLists = [];
    let stateChar;
    let inClass = false;
    let reClassStart = -1;
    let classStart = -1;
    let cs;
    let pl;
    let sp;
    let dotTravAllowed = pattern.charAt(0) === ".";
    let dotFileAllowed = options.dot || dotTravAllowed;
    const patternStart = () => dotTravAllowed ? "" : dotFileAllowed ? "(?!(?:^|\\/)\\.{1,2}(?:$|\\/))" : "(?!\\.)";
    const subPatternStart = (p) => p.charAt(0) === "." ? "" : options.dot ? "(?!(?:^|\\/)\\.{1,2}(?:$|\\/))" : "(?!\\.)";
    const clearStateChar = () => {
      if (stateChar) {
        switch (stateChar) {
          case "*":
            re += star;
            hasMagic = true;
            break;
          case "?":
            re += qmark;
            hasMagic = true;
            break;
          default:
            re += "\\" + stateChar;
            break;
        }
        this.debug("clearStateChar %j %j", stateChar, re);
        stateChar = false;
      }
    };
    for (let i = 0, c; i < pattern.length && (c = pattern.charAt(i)); i++) {
      this.debug("%s	%s %s %j", pattern, i, re, c);
      if (escaping) {
        if (c === "/") {
          return false;
        }
        if (reSpecials[c]) {
          re += "\\";
        }
        re += c;
        escaping = false;
        continue;
      }
      switch (c) {
        case "/": {
          return false;
        }
        case "\\":
          if (inClass && pattern.charAt(i + 1) === "-") {
            re += c;
            continue;
          }
          clearStateChar();
          escaping = true;
          continue;
        case "?":
        case "*":
        case "+":
        case "@":
        case "!":
          this.debug("%s	%s %s %j <-- stateChar", pattern, i, re, c);
          if (inClass) {
            this.debug("  in class");
            if (c === "!" && i === classStart + 1) c = "^";
            re += c;
            continue;
          }
          this.debug("call clearStateChar %j", stateChar);
          clearStateChar();
          stateChar = c;
          if (options.noext) clearStateChar();
          continue;
        case "(": {
          if (inClass) {
            re += "(";
            continue;
          }
          if (!stateChar) {
            re += "\\(";
            continue;
          }
          const plEntry = {
            type: stateChar,
            start: i - 1,
            reStart: re.length,
            open: plTypes[stateChar].open,
            close: plTypes[stateChar].close
          };
          this.debug(this.pattern, "	", plEntry);
          patternListStack.push(plEntry);
          re += plEntry.open;
          if (plEntry.start === 0 && plEntry.type !== "!") {
            dotTravAllowed = true;
            re += subPatternStart(pattern.slice(i + 1));
          }
          this.debug("plType %j %j", stateChar, re);
          stateChar = false;
          continue;
        }
        case ")": {
          const plEntry = patternListStack[patternListStack.length - 1];
          if (inClass || !plEntry) {
            re += "\\)";
            continue;
          }
          patternListStack.pop();
          clearStateChar();
          hasMagic = true;
          pl = plEntry;
          re += pl.close;
          if (pl.type === "!") {
            negativeLists.push(Object.assign(pl, { reEnd: re.length }));
          }
          continue;
        }
        case "|": {
          const plEntry = patternListStack[patternListStack.length - 1];
          if (inClass || !plEntry) {
            re += "\\|";
            continue;
          }
          clearStateChar();
          re += "|";
          if (plEntry.start === 0 && plEntry.type !== "!") {
            dotTravAllowed = true;
            re += subPatternStart(pattern.slice(i + 1));
          }
          continue;
        }
        case "[":
          clearStateChar();
          if (inClass) {
            re += "\\" + c;
            continue;
          }
          inClass = true;
          classStart = i;
          reClassStart = re.length;
          re += c;
          continue;
        case "]":
          if (i === classStart + 1 || !inClass) {
            re += "\\" + c;
            continue;
          }
          cs = pattern.substring(classStart + 1, i);
          try {
            RegExp("[" + braExpEscape(charUnescape(cs)) + "]");
            re += c;
          } catch (er) {
            re = re.substring(0, reClassStart) + "(?:$.)";
          }
          hasMagic = true;
          inClass = false;
          continue;
        default:
          clearStateChar();
          if (reSpecials[c] && !(c === "^" && inClass)) {
            re += "\\";
          }
          re += c;
          break;
      }
    }
    if (inClass) {
      cs = pattern.slice(classStart + 1);
      sp = this.parse(cs, SUBPARSE);
      re = re.substring(0, reClassStart) + "\\[" + sp[0];
      hasMagic = hasMagic || sp[1];
    }
    for (pl = patternListStack.pop(); pl; pl = patternListStack.pop()) {
      let tail;
      tail = re.slice(pl.reStart + pl.open.length);
      this.debug("setting tail", re, pl);
      tail = tail.replace(/((?:\\{2}){0,64})(\\?)\|/g, (_2, $1, $2) => {
        if (!$2) {
          $2 = "\\";
        }
        return $1 + $1 + $2 + "|";
      });
      this.debug("tail=%j\n   %s", tail, tail, pl, re);
      const t = pl.type === "*" ? star : pl.type === "?" ? qmark : "\\" + pl.type;
      hasMagic = true;
      re = re.slice(0, pl.reStart) + t + "\\(" + tail;
    }
    clearStateChar();
    if (escaping) {
      re += "\\\\";
    }
    const addPatternStart = addPatternStartSet[re.charAt(0)];
    for (let n = negativeLists.length - 1; n > -1; n--) {
      const nl = negativeLists[n];
      const nlBefore = re.slice(0, nl.reStart);
      const nlFirst = re.slice(nl.reStart, nl.reEnd - 8);
      let nlAfter = re.slice(nl.reEnd);
      const nlLast = re.slice(nl.reEnd - 8, nl.reEnd) + nlAfter;
      const closeParensBefore = nlBefore.split(")").length;
      const openParensBefore = nlBefore.split("(").length - closeParensBefore;
      let cleanAfter = nlAfter;
      for (let i = 0; i < openParensBefore; i++) {
        cleanAfter = cleanAfter.replace(/\)[+*?]?/, "");
      }
      nlAfter = cleanAfter;
      const dollar = nlAfter === "" && isSub !== SUBPARSE ? "(?:$|\\/)" : "";
      re = nlBefore + nlFirst + nlAfter + dollar + nlLast;
    }
    if (re !== "" && hasMagic) {
      re = "(?=.)" + re;
    }
    if (addPatternStart) {
      re = patternStart() + re;
    }
    if (isSub === SUBPARSE) {
      return [re, hasMagic];
    }
    if (options.nocase && !hasMagic) {
      hasMagic = pattern.toUpperCase() !== pattern.toLowerCase();
    }
    if (!hasMagic) {
      return globUnescape(pattern);
    }
    const flags = options.nocase ? "i" : "";
    try {
      return Object.assign(new RegExp("^" + re + "$", flags), {
        _glob: pattern,
        _src: re
      });
    } catch (er) {
      return new RegExp("$.");
    }
  }
  makeRe() {
    if (this.regexp || this.regexp === false) return this.regexp;
    const set = this.set;
    if (!set.length) {
      this.regexp = false;
      return this.regexp;
    }
    const options = this.options;
    const twoStar = options.noglobstar ? star : options.dot ? twoStarDot : twoStarNoDot;
    const flags = options.nocase ? "i" : "";
    let re = set.map((pattern) => {
      pattern = pattern.map(
        (p) => typeof p === "string" ? regExpEscape(p) : p === GLOBSTAR ? GLOBSTAR : p._src
      ).reduce((set2, p) => {
        if (!(set2[set2.length - 1] === GLOBSTAR && p === GLOBSTAR)) {
          set2.push(p);
        }
        return set2;
      }, []);
      pattern.forEach((p, i) => {
        if (p !== GLOBSTAR || pattern[i - 1] === GLOBSTAR) {
          return;
        }
        if (i === 0) {
          if (pattern.length > 1) {
            pattern[i + 1] = "(?:\\/|" + twoStar + "\\/)?" + pattern[i + 1];
          } else {
            pattern[i] = twoStar;
          }
        } else if (i === pattern.length - 1) {
          pattern[i - 1] += "(?:\\/|" + twoStar + ")?";
        } else {
          pattern[i - 1] += "(?:\\/|\\/" + twoStar + "\\/)" + pattern[i + 1];
          pattern[i + 1] = GLOBSTAR;
        }
      });
      return pattern.filter((p) => p !== GLOBSTAR).join("/");
    }).join("|");
    re = "^(?:" + re + ")$";
    if (this.negate) re = "^(?!" + re + ").*$";
    try {
      this.regexp = new RegExp(re, flags);
    } catch (ex) {
      this.regexp = false;
    }
    return this.regexp;
  }
  match(f, partial = this.partial) {
    this.debug("match", f, this.pattern);
    if (this.comment) return false;
    if (this.empty) return f === "";
    if (f === "/" && partial) return true;
    const options = this.options;
    if (path$4.sep !== "/") {
      f = f.split(path$4.sep).join("/");
    }
    f = f.split(slashSplit);
    this.debug(this.pattern, "split", f);
    const set = this.set;
    this.debug(this.pattern, "set", set);
    let filename;
    for (let i = f.length - 1; i >= 0; i--) {
      filename = f[i];
      if (filename) break;
    }
    for (let i = 0; i < set.length; i++) {
      const pattern = set[i];
      let file2 = f;
      if (options.matchBase && pattern.length === 1) {
        file2 = [filename];
      }
      const hit = this.matchOne(file2, pattern, partial);
      if (hit) {
        if (options.flipNegate) return true;
        return !this.negate;
      }
    }
    if (options.flipNegate) return false;
    return this.negate;
  }
  static defaults(def) {
    return minimatch$1.defaults(def).Minimatch;
  }
};
minimatch$1.Minimatch = Minimatch$2;
var readdirGlob_1 = readdirGlob;
const fs$7 = fs$8;
const { EventEmitter: EventEmitter$1 } = require$$0;
const { Minimatch: Minimatch$1 } = minimatch_1;
const { resolve } = path$6;
function readdir(dir2, strict) {
  return new Promise((resolve2, reject2) => {
    fs$7.readdir(dir2, { withFileTypes: true }, (err, files) => {
      if (err) {
        switch (err.code) {
          case "ENOTDIR":
            if (strict) {
              reject2(err);
            } else {
              resolve2([]);
            }
            break;
          case "ENOTSUP":
          case "ENOENT":
          case "ENAMETOOLONG":
          case "UNKNOWN":
            resolve2([]);
            break;
          case "ELOOP":
          default:
            reject2(err);
            break;
        }
      } else {
        resolve2(files);
      }
    });
  });
}
function stat(file2, followSymlinks) {
  return new Promise((resolve2, reject2) => {
    const statFunc = followSymlinks ? fs$7.stat : fs$7.lstat;
    statFunc(file2, (err, stats) => {
      if (err) {
        switch (err.code) {
          case "ENOENT":
            if (followSymlinks) {
              resolve2(stat(file2, false));
            } else {
              resolve2(null);
            }
            break;
          default:
            resolve2(null);
            break;
        }
      } else {
        resolve2(stats);
      }
    });
  });
}
async function* exploreWalkAsync(dir2, path2, followSymlinks, useStat, shouldSkip, strict) {
  let files = await readdir(path2 + dir2, strict);
  for (const file2 of files) {
    let name = file2.name;
    if (name === void 0) {
      name = file2;
      useStat = true;
    }
    const filename = dir2 + "/" + name;
    const relative = filename.slice(1);
    const absolute = path2 + "/" + relative;
    let stats = null;
    if (useStat || followSymlinks) {
      stats = await stat(absolute, followSymlinks);
    }
    if (!stats && file2.name !== void 0) {
      stats = file2;
    }
    if (stats === null) {
      stats = { isDirectory: () => false };
    }
    if (stats.isDirectory()) {
      if (!shouldSkip(relative)) {
        yield { relative, absolute, stats };
        yield* exploreWalkAsync(filename, path2, followSymlinks, useStat, shouldSkip, false);
      }
    } else {
      yield { relative, absolute, stats };
    }
  }
}
async function* explore(path2, followSymlinks, useStat, shouldSkip) {
  yield* exploreWalkAsync("", path2, followSymlinks, useStat, shouldSkip, true);
}
function readOptions(options) {
  return {
    pattern: options.pattern,
    dot: !!options.dot,
    noglobstar: !!options.noglobstar,
    matchBase: !!options.matchBase,
    nocase: !!options.nocase,
    ignore: options.ignore,
    skip: options.skip,
    follow: !!options.follow,
    stat: !!options.stat,
    nodir: !!options.nodir,
    mark: !!options.mark,
    silent: !!options.silent,
    absolute: !!options.absolute
  };
}
class ReaddirGlob extends EventEmitter$1 {
  constructor(cwd2, options, cb) {
    super();
    if (typeof options === "function") {
      cb = options;
      options = null;
    }
    this.options = readOptions(options || {});
    this.matchers = [];
    if (this.options.pattern) {
      const matchers = Array.isArray(this.options.pattern) ? this.options.pattern : [this.options.pattern];
      this.matchers = matchers.map(
        (m) => new Minimatch$1(m, {
          dot: this.options.dot,
          noglobstar: this.options.noglobstar,
          matchBase: this.options.matchBase,
          nocase: this.options.nocase
        })
      );
    }
    this.ignoreMatchers = [];
    if (this.options.ignore) {
      const ignorePatterns = Array.isArray(this.options.ignore) ? this.options.ignore : [this.options.ignore];
      this.ignoreMatchers = ignorePatterns.map(
        (ignore) => new Minimatch$1(ignore, { dot: true })
      );
    }
    this.skipMatchers = [];
    if (this.options.skip) {
      const skipPatterns = Array.isArray(this.options.skip) ? this.options.skip : [this.options.skip];
      this.skipMatchers = skipPatterns.map(
        (skip) => new Minimatch$1(skip, { dot: true })
      );
    }
    this.iterator = explore(resolve(cwd2 || "."), this.options.follow, this.options.stat, this._shouldSkipDirectory.bind(this));
    this.paused = false;
    this.inactive = false;
    this.aborted = false;
    if (cb) {
      this._matches = [];
      this.on("match", (match) => this._matches.push(this.options.absolute ? match.absolute : match.relative));
      this.on("error", (err) => cb(err));
      this.on("end", () => cb(null, this._matches));
    }
    setTimeout(() => this._next(), 0);
  }
  _shouldSkipDirectory(relative) {
    return this.skipMatchers.some((m) => m.match(relative));
  }
  _fileMatches(relative, isDirectory) {
    const file2 = relative + (isDirectory ? "/" : "");
    return (this.matchers.length === 0 || this.matchers.some((m) => m.match(file2))) && !this.ignoreMatchers.some((m) => m.match(file2)) && (!this.options.nodir || !isDirectory);
  }
  _next() {
    if (!this.paused && !this.aborted) {
      this.iterator.next().then((obj) => {
        if (!obj.done) {
          const isDirectory = obj.value.stats.isDirectory();
          if (this._fileMatches(obj.value.relative, isDirectory)) {
            let relative = obj.value.relative;
            let absolute = obj.value.absolute;
            if (this.options.mark && isDirectory) {
              relative += "/";
              absolute += "/";
            }
            if (this.options.stat) {
              this.emit("match", { relative, absolute, stat: obj.value.stats });
            } else {
              this.emit("match", { relative, absolute });
            }
          }
          this._next(this.iterator);
        } else {
          this.emit("end");
        }
      }).catch((err) => {
        this.abort();
        this.emit("error", err);
        if (!err.code && !this.options.silent) {
          console.error(err);
        }
      });
    } else {
      this.inactive = true;
    }
  }
  abort() {
    this.aborted = true;
  }
  pause() {
    this.paused = true;
  }
  resume() {
    this.paused = false;
    if (this.inactive) {
      this.inactive = false;
      this._next();
    }
  }
}
function readdirGlob(pattern, options, cb) {
  return new ReaddirGlob(pattern, options, cb);
}
readdirGlob.ReaddirGlob = ReaddirGlob;
function apply$2(fn, ...args) {
  return (...callArgs) => fn(...args, ...callArgs);
}
function initialParams(fn) {
  return function(...args) {
    var callback = args.pop();
    return fn.call(this, args, callback);
  };
}
var hasQueueMicrotask = typeof queueMicrotask === "function" && queueMicrotask;
var hasSetImmediate = typeof setImmediate === "function" && setImmediate;
var hasNextTick = typeof process === "object" && typeof process.nextTick === "function";
function fallback(fn) {
  setTimeout(fn, 0);
}
function wrap(defer) {
  return (fn, ...args) => defer(() => fn(...args));
}
var _defer$1;
if (hasQueueMicrotask) {
  _defer$1 = queueMicrotask;
} else if (hasSetImmediate) {
  _defer$1 = setImmediate;
} else if (hasNextTick) {
  _defer$1 = process.nextTick;
} else {
  _defer$1 = fallback;
}
var setImmediate$1 = wrap(_defer$1);
function asyncify(func) {
  if (isAsync(func)) {
    return function(...args) {
      const callback = args.pop();
      const promise = func.apply(this, args);
      return handlePromise(promise, callback);
    };
  }
  return initialParams(function(args, callback) {
    var result;
    try {
      result = func.apply(this, args);
    } catch (e) {
      return callback(e);
    }
    if (result && typeof result.then === "function") {
      return handlePromise(result, callback);
    } else {
      callback(null, result);
    }
  });
}
function handlePromise(promise, callback) {
  return promise.then((value) => {
    invokeCallback(callback, null, value);
  }, (err) => {
    invokeCallback(callback, err && (err instanceof Error || err.message) ? err : new Error(err));
  });
}
function invokeCallback(callback, error2, value) {
  try {
    callback(error2, value);
  } catch (err) {
    setImmediate$1((e) => {
      throw e;
    }, err);
  }
}
function isAsync(fn) {
  return fn[Symbol.toStringTag] === "AsyncFunction";
}
function isAsyncGenerator(fn) {
  return fn[Symbol.toStringTag] === "AsyncGenerator";
}
function isAsyncIterable(obj) {
  return typeof obj[Symbol.asyncIterator] === "function";
}
function wrapAsync(asyncFn) {
  if (typeof asyncFn !== "function") throw new Error("expected a function");
  return isAsync(asyncFn) ? asyncify(asyncFn) : asyncFn;
}
function awaitify(asyncFn, arity) {
  if (!arity) arity = asyncFn.length;
  if (!arity) throw new Error("arity is undefined");
  function awaitable(...args) {
    if (typeof args[arity - 1] === "function") {
      return asyncFn.apply(this, args);
    }
    return new Promise((resolve2, reject2) => {
      args[arity - 1] = (err, ...cbArgs) => {
        if (err) return reject2(err);
        resolve2(cbArgs.length > 1 ? cbArgs : cbArgs[0]);
      };
      asyncFn.apply(this, args);
    });
  }
  return awaitable;
}
function applyEach$1(eachfn) {
  return function applyEach2(fns, ...callArgs) {
    const go = awaitify(function(callback) {
      var that = this;
      return eachfn(fns, (fn, cb) => {
        wrapAsync(fn).apply(that, callArgs.concat(cb));
      }, callback);
    });
    return go;
  };
}
function _asyncMap(eachfn, arr, iteratee, callback) {
  arr = arr || [];
  var results = [];
  var counter = 0;
  var _iteratee = wrapAsync(iteratee);
  return eachfn(arr, (value, _2, iterCb) => {
    var index2 = counter++;
    _iteratee(value, (err, v) => {
      results[index2] = v;
      iterCb(err);
    });
  }, (err) => {
    callback(err, results);
  });
}
function isArrayLike$4(value) {
  return value && typeof value.length === "number" && value.length >= 0 && value.length % 1 === 0;
}
const breakLoop = {};
function once$3(fn) {
  function wrapper(...args) {
    if (fn === null) return;
    var callFn = fn;
    fn = null;
    callFn.apply(this, args);
  }
  Object.assign(wrapper, fn);
  return wrapper;
}
function getIterator(coll) {
  return coll[Symbol.iterator] && coll[Symbol.iterator]();
}
function createArrayIterator(coll) {
  var i = -1;
  var len = coll.length;
  return function next() {
    return ++i < len ? { value: coll[i], key: i } : null;
  };
}
function createES2015Iterator(iterator) {
  var i = -1;
  return function next() {
    var item = iterator.next();
    if (item.done)
      return null;
    i++;
    return { value: item.value, key: i };
  };
}
function createObjectIterator(obj) {
  var okeys = obj ? Object.keys(obj) : [];
  var i = -1;
  var len = okeys.length;
  return function next() {
    var key = okeys[++i];
    if (key === "__proto__") {
      return next();
    }
    return i < len ? { value: obj[key], key } : null;
  };
}
function createIterator(coll) {
  if (isArrayLike$4(coll)) {
    return createArrayIterator(coll);
  }
  var iterator = getIterator(coll);
  return iterator ? createES2015Iterator(iterator) : createObjectIterator(coll);
}
function onlyOnce(fn) {
  return function(...args) {
    if (fn === null) throw new Error("Callback was already called.");
    var callFn = fn;
    fn = null;
    callFn.apply(this, args);
  };
}
function asyncEachOfLimit(generator, limit, iteratee, callback) {
  let done = false;
  let canceled = false;
  let awaiting = false;
  let running = 0;
  let idx = 0;
  function replenish() {
    if (running >= limit || awaiting || done) return;
    awaiting = true;
    generator.next().then(({ value, done: iterDone }) => {
      if (canceled || done) return;
      awaiting = false;
      if (iterDone) {
        done = true;
        if (running <= 0) {
          callback(null);
        }
        return;
      }
      running++;
      iteratee(value, idx, iterateeCallback);
      idx++;
      replenish();
    }).catch(handleError);
  }
  function iterateeCallback(err, result) {
    running -= 1;
    if (canceled) return;
    if (err) return handleError(err);
    if (err === false) {
      done = true;
      canceled = true;
      return;
    }
    if (result === breakLoop || done && running <= 0) {
      done = true;
      return callback(null);
    }
    replenish();
  }
  function handleError(err) {
    if (canceled) return;
    awaiting = false;
    done = true;
    callback(err);
  }
  replenish();
}
var eachOfLimit$2 = (limit) => {
  return (obj, iteratee, callback) => {
    callback = once$3(callback);
    if (limit <= 0) {
      throw new RangeError("concurrency limit cannot be less than 1");
    }
    if (!obj) {
      return callback(null);
    }
    if (isAsyncGenerator(obj)) {
      return asyncEachOfLimit(obj, limit, iteratee, callback);
    }
    if (isAsyncIterable(obj)) {
      return asyncEachOfLimit(obj[Symbol.asyncIterator](), limit, iteratee, callback);
    }
    var nextElem = createIterator(obj);
    var done = false;
    var canceled = false;
    var running = 0;
    var looping = false;
    function iterateeCallback(err, value) {
      if (canceled) return;
      running -= 1;
      if (err) {
        done = true;
        callback(err);
      } else if (err === false) {
        done = true;
        canceled = true;
      } else if (value === breakLoop || done && running <= 0) {
        done = true;
        return callback(null);
      } else if (!looping) {
        replenish();
      }
    }
    function replenish() {
      looping = true;
      while (running < limit && !done) {
        var elem = nextElem();
        if (elem === null) {
          done = true;
          if (running <= 0) {
            callback(null);
          }
          return;
        }
        running += 1;
        iteratee(elem.value, elem.key, onlyOnce(iterateeCallback));
      }
      looping = false;
    }
    replenish();
  };
};
function eachOfLimit(coll, limit, iteratee, callback) {
  return eachOfLimit$2(limit)(coll, wrapAsync(iteratee), callback);
}
var eachOfLimit$1 = awaitify(eachOfLimit, 4);
function eachOfArrayLike(coll, iteratee, callback) {
  callback = once$3(callback);
  var index2 = 0, completed = 0, { length } = coll, canceled = false;
  if (length === 0) {
    callback(null);
  }
  function iteratorCallback(err, value) {
    if (err === false) {
      canceled = true;
    }
    if (canceled === true) return;
    if (err) {
      callback(err);
    } else if (++completed === length || value === breakLoop) {
      callback(null);
    }
  }
  for (; index2 < length; index2++) {
    iteratee(coll[index2], index2, onlyOnce(iteratorCallback));
  }
}
function eachOfGeneric(coll, iteratee, callback) {
  return eachOfLimit$1(coll, Infinity, iteratee, callback);
}
function eachOf(coll, iteratee, callback) {
  var eachOfImplementation = isArrayLike$4(coll) ? eachOfArrayLike : eachOfGeneric;
  return eachOfImplementation(coll, wrapAsync(iteratee), callback);
}
var eachOf$1 = awaitify(eachOf, 3);
function map(coll, iteratee, callback) {
  return _asyncMap(eachOf$1, coll, iteratee, callback);
}
var map$1 = awaitify(map, 3);
var applyEach = applyEach$1(map$1);
function eachOfSeries(coll, iteratee, callback) {
  return eachOfLimit$1(coll, 1, iteratee, callback);
}
var eachOfSeries$1 = awaitify(eachOfSeries, 3);
function mapSeries(coll, iteratee, callback) {
  return _asyncMap(eachOfSeries$1, coll, iteratee, callback);
}
var mapSeries$1 = awaitify(mapSeries, 3);
var applyEachSeries = applyEach$1(mapSeries$1);
const PROMISE_SYMBOL = Symbol("promiseCallback");
function promiseCallback() {
  let resolve2, reject2;
  function callback(err, ...args) {
    if (err) return reject2(err);
    resolve2(args.length > 1 ? args : args[0]);
  }
  callback[PROMISE_SYMBOL] = new Promise((res, rej) => {
    resolve2 = res, reject2 = rej;
  });
  return callback;
}
function auto(tasks, concurrency, callback) {
  if (typeof concurrency !== "number") {
    callback = concurrency;
    concurrency = null;
  }
  callback = once$3(callback || promiseCallback());
  var numTasks = Object.keys(tasks).length;
  if (!numTasks) {
    return callback(null);
  }
  if (!concurrency) {
    concurrency = numTasks;
  }
  var results = {};
  var runningTasks = 0;
  var canceled = false;
  var hasError = false;
  var listeners = /* @__PURE__ */ Object.create(null);
  var readyTasks = [];
  var readyToCheck = [];
  var uncheckedDependencies = {};
  Object.keys(tasks).forEach((key) => {
    var task = tasks[key];
    if (!Array.isArray(task)) {
      enqueueTask(key, [task]);
      readyToCheck.push(key);
      return;
    }
    var dependencies = task.slice(0, task.length - 1);
    var remainingDependencies = dependencies.length;
    if (remainingDependencies === 0) {
      enqueueTask(key, task);
      readyToCheck.push(key);
      return;
    }
    uncheckedDependencies[key] = remainingDependencies;
    dependencies.forEach((dependencyName) => {
      if (!tasks[dependencyName]) {
        throw new Error("async.auto task `" + key + "` has a non-existent dependency `" + dependencyName + "` in " + dependencies.join(", "));
      }
      addListener(dependencyName, () => {
        remainingDependencies--;
        if (remainingDependencies === 0) {
          enqueueTask(key, task);
        }
      });
    });
  });
  checkForDeadlocks();
  processQueue();
  function enqueueTask(key, task) {
    readyTasks.push(() => runTask(key, task));
  }
  function processQueue() {
    if (canceled) return;
    if (readyTasks.length === 0 && runningTasks === 0) {
      return callback(null, results);
    }
    while (readyTasks.length && runningTasks < concurrency) {
      var run = readyTasks.shift();
      run();
    }
  }
  function addListener(taskName, fn) {
    var taskListeners = listeners[taskName];
    if (!taskListeners) {
      taskListeners = listeners[taskName] = [];
    }
    taskListeners.push(fn);
  }
  function taskComplete(taskName) {
    var taskListeners = listeners[taskName] || [];
    taskListeners.forEach((fn) => fn());
    processQueue();
  }
  function runTask(key, task) {
    if (hasError) return;
    var taskCallback = onlyOnce((err, ...result) => {
      runningTasks--;
      if (err === false) {
        canceled = true;
        return;
      }
      if (result.length < 2) {
        [result] = result;
      }
      if (err) {
        var safeResults = {};
        Object.keys(results).forEach((rkey) => {
          safeResults[rkey] = results[rkey];
        });
        safeResults[key] = result;
        hasError = true;
        listeners = /* @__PURE__ */ Object.create(null);
        if (canceled) return;
        callback(err, safeResults);
      } else {
        results[key] = result;
        taskComplete(key);
      }
    });
    runningTasks++;
    var taskFn = wrapAsync(task[task.length - 1]);
    if (task.length > 1) {
      taskFn(results, taskCallback);
    } else {
      taskFn(taskCallback);
    }
  }
  function checkForDeadlocks() {
    var currentTask;
    var counter = 0;
    while (readyToCheck.length) {
      currentTask = readyToCheck.pop();
      counter++;
      getDependents(currentTask).forEach((dependent) => {
        if (--uncheckedDependencies[dependent] === 0) {
          readyToCheck.push(dependent);
        }
      });
    }
    if (counter !== numTasks) {
      throw new Error(
        "async.auto cannot execute tasks due to a recursive dependency"
      );
    }
  }
  function getDependents(taskName) {
    var result = [];
    Object.keys(tasks).forEach((key) => {
      const task = tasks[key];
      if (Array.isArray(task) && task.indexOf(taskName) >= 0) {
        result.push(key);
      }
    });
    return result;
  }
  return callback[PROMISE_SYMBOL];
}
var FN_ARGS = /^(?:async\s)?(?:function)?\s*(?:\w+\s*)?\(([^)]+)\)(?:\s*{)/;
var ARROW_FN_ARGS = /^(?:async\s)?\s*(?:\(\s*)?((?:[^)=\s]\s*)*)(?:\)\s*)?=>/;
var FN_ARG_SPLIT = /,/;
var FN_ARG = /(=.+)?(\s*)$/;
function stripComments(string) {
  let stripped = "";
  let index2 = 0;
  let endBlockComment = string.indexOf("*/");
  while (index2 < string.length) {
    if (string[index2] === "/" && string[index2 + 1] === "/") {
      let endIndex = string.indexOf("\n", index2);
      index2 = endIndex === -1 ? string.length : endIndex;
    } else if (endBlockComment !== -1 && string[index2] === "/" && string[index2 + 1] === "*") {
      let endIndex = string.indexOf("*/", index2);
      if (endIndex !== -1) {
        index2 = endIndex + 2;
        endBlockComment = string.indexOf("*/", index2);
      } else {
        stripped += string[index2];
        index2++;
      }
    } else {
      stripped += string[index2];
      index2++;
    }
  }
  return stripped;
}
function parseParams(func) {
  const src = stripComments(func.toString());
  let match = src.match(FN_ARGS);
  if (!match) {
    match = src.match(ARROW_FN_ARGS);
  }
  if (!match) throw new Error("could not parse args in autoInject\nSource:\n" + src);
  let [, args] = match;
  return args.replace(/\s/g, "").split(FN_ARG_SPLIT).map((arg) => arg.replace(FN_ARG, "").trim());
}
function autoInject(tasks, callback) {
  var newTasks = {};
  Object.keys(tasks).forEach((key) => {
    var taskFn = tasks[key];
    var params;
    var fnIsAsync = isAsync(taskFn);
    var hasNoDeps = !fnIsAsync && taskFn.length === 1 || fnIsAsync && taskFn.length === 0;
    if (Array.isArray(taskFn)) {
      params = [...taskFn];
      taskFn = params.pop();
      newTasks[key] = params.concat(params.length > 0 ? newTask : taskFn);
    } else if (hasNoDeps) {
      newTasks[key] = taskFn;
    } else {
      params = parseParams(taskFn);
      if (taskFn.length === 0 && !fnIsAsync && params.length === 0) {
        throw new Error("autoInject task functions require explicit parameters.");
      }
      if (!fnIsAsync) params.pop();
      newTasks[key] = params.concat(newTask);
    }
    function newTask(results, taskCb) {
      var newArgs = params.map((name) => results[name]);
      newArgs.push(taskCb);
      wrapAsync(taskFn)(...newArgs);
    }
  });
  return auto(newTasks, callback);
}
class DLL {
  constructor() {
    this.head = this.tail = null;
    this.length = 0;
  }
  removeLink(node2) {
    if (node2.prev) node2.prev.next = node2.next;
    else this.head = node2.next;
    if (node2.next) node2.next.prev = node2.prev;
    else this.tail = node2.prev;
    node2.prev = node2.next = null;
    this.length -= 1;
    return node2;
  }
  empty() {
    while (this.head) this.shift();
    return this;
  }
  insertAfter(node2, newNode) {
    newNode.prev = node2;
    newNode.next = node2.next;
    if (node2.next) node2.next.prev = newNode;
    else this.tail = newNode;
    node2.next = newNode;
    this.length += 1;
  }
  insertBefore(node2, newNode) {
    newNode.prev = node2.prev;
    newNode.next = node2;
    if (node2.prev) node2.prev.next = newNode;
    else this.head = newNode;
    node2.prev = newNode;
    this.length += 1;
  }
  unshift(node2) {
    if (this.head) this.insertBefore(this.head, node2);
    else setInitial(this, node2);
  }
  push(node2) {
    if (this.tail) this.insertAfter(this.tail, node2);
    else setInitial(this, node2);
  }
  shift() {
    return this.head && this.removeLink(this.head);
  }
  pop() {
    return this.tail && this.removeLink(this.tail);
  }
  toArray() {
    return [...this];
  }
  *[Symbol.iterator]() {
    var cur = this.head;
    while (cur) {
      yield cur.data;
      cur = cur.next;
    }
  }
  remove(testFn) {
    var curr = this.head;
    while (curr) {
      var { next } = curr;
      if (testFn(curr)) {
        this.removeLink(curr);
      }
      curr = next;
    }
    return this;
  }
}
function setInitial(dll, node2) {
  dll.length = 1;
  dll.head = dll.tail = node2;
}
function queue$1(worker, concurrency, payload) {
  if (concurrency == null) {
    concurrency = 1;
  } else if (concurrency === 0) {
    throw new RangeError("Concurrency must not be zero");
  }
  var _worker = wrapAsync(worker);
  var numRunning = 0;
  var workersList = [];
  const events = {
    error: [],
    drain: [],
    saturated: [],
    unsaturated: [],
    empty: []
  };
  function on(event, handler) {
    events[event].push(handler);
  }
  function once2(event, handler) {
    const handleAndRemove = (...args) => {
      off(event, handleAndRemove);
      handler(...args);
    };
    events[event].push(handleAndRemove);
  }
  function off(event, handler) {
    if (!event) return Object.keys(events).forEach((ev) => events[ev] = []);
    if (!handler) return events[event] = [];
    events[event] = events[event].filter((ev) => ev !== handler);
  }
  function trigger(event, ...args) {
    events[event].forEach((handler) => handler(...args));
  }
  var processingScheduled = false;
  function _insert(data, insertAtFront, rejectOnError, callback) {
    if (callback != null && typeof callback !== "function") {
      throw new Error("task callback must be a function");
    }
    q.started = true;
    var res, rej;
    function promiseCallback2(err, ...args) {
      if (err) return rejectOnError ? rej(err) : res();
      if (args.length <= 1) return res(args[0]);
      res(args);
    }
    var item = q._createTaskItem(
      data,
      rejectOnError ? promiseCallback2 : callback || promiseCallback2
    );
    if (insertAtFront) {
      q._tasks.unshift(item);
    } else {
      q._tasks.push(item);
    }
    if (!processingScheduled) {
      processingScheduled = true;
      setImmediate$1(() => {
        processingScheduled = false;
        q.process();
      });
    }
    if (rejectOnError || !callback) {
      return new Promise((resolve2, reject2) => {
        res = resolve2;
        rej = reject2;
      });
    }
  }
  function _createCB(tasks) {
    return function(err, ...args) {
      numRunning -= 1;
      for (var i = 0, l = tasks.length; i < l; i++) {
        var task = tasks[i];
        var index2 = workersList.indexOf(task);
        if (index2 === 0) {
          workersList.shift();
        } else if (index2 > 0) {
          workersList.splice(index2, 1);
        }
        task.callback(err, ...args);
        if (err != null) {
          trigger("error", err, task.data);
        }
      }
      if (numRunning <= q.concurrency - q.buffer) {
        trigger("unsaturated");
      }
      if (q.idle()) {
        trigger("drain");
      }
      q.process();
    };
  }
  function _maybeDrain(data) {
    if (data.length === 0 && q.idle()) {
      setImmediate$1(() => trigger("drain"));
      return true;
    }
    return false;
  }
  const eventMethod = (name) => (handler) => {
    if (!handler) {
      return new Promise((resolve2, reject2) => {
        once2(name, (err, data) => {
          if (err) return reject2(err);
          resolve2(data);
        });
      });
    }
    off(name);
    on(name, handler);
  };
  var isProcessing = false;
  var q = {
    _tasks: new DLL(),
    _createTaskItem(data, callback) {
      return {
        data,
        callback
      };
    },
    *[Symbol.iterator]() {
      yield* q._tasks[Symbol.iterator]();
    },
    concurrency,
    payload,
    buffer: concurrency / 4,
    started: false,
    paused: false,
    push(data, callback) {
      if (Array.isArray(data)) {
        if (_maybeDrain(data)) return;
        return data.map((datum) => _insert(datum, false, false, callback));
      }
      return _insert(data, false, false, callback);
    },
    pushAsync(data, callback) {
      if (Array.isArray(data)) {
        if (_maybeDrain(data)) return;
        return data.map((datum) => _insert(datum, false, true, callback));
      }
      return _insert(data, false, true, callback);
    },
    kill() {
      off();
      q._tasks.empty();
    },
    unshift(data, callback) {
      if (Array.isArray(data)) {
        if (_maybeDrain(data)) return;
        return data.map((datum) => _insert(datum, true, false, callback));
      }
      return _insert(data, true, false, callback);
    },
    unshiftAsync(data, callback) {
      if (Array.isArray(data)) {
        if (_maybeDrain(data)) return;
        return data.map((datum) => _insert(datum, true, true, callback));
      }
      return _insert(data, true, true, callback);
    },
    remove(testFn) {
      q._tasks.remove(testFn);
    },
    process() {
      if (isProcessing) {
        return;
      }
      isProcessing = true;
      while (!q.paused && numRunning < q.concurrency && q._tasks.length) {
        var tasks = [], data = [];
        var l = q._tasks.length;
        if (q.payload) l = Math.min(l, q.payload);
        for (var i = 0; i < l; i++) {
          var node2 = q._tasks.shift();
          tasks.push(node2);
          workersList.push(node2);
          data.push(node2.data);
        }
        numRunning += 1;
        if (q._tasks.length === 0) {
          trigger("empty");
        }
        if (numRunning === q.concurrency) {
          trigger("saturated");
        }
        var cb = onlyOnce(_createCB(tasks));
        _worker(data, cb);
      }
      isProcessing = false;
    },
    length() {
      return q._tasks.length;
    },
    running() {
      return numRunning;
    },
    workersList() {
      return workersList;
    },
    idle() {
      return q._tasks.length + numRunning === 0;
    },
    pause() {
      q.paused = true;
    },
    resume() {
      if (q.paused === false) {
        return;
      }
      q.paused = false;
      setImmediate$1(q.process);
    }
  };
  Object.defineProperties(q, {
    saturated: {
      writable: false,
      value: eventMethod("saturated")
    },
    unsaturated: {
      writable: false,
      value: eventMethod("unsaturated")
    },
    empty: {
      writable: false,
      value: eventMethod("empty")
    },
    drain: {
      writable: false,
      value: eventMethod("drain")
    },
    error: {
      writable: false,
      value: eventMethod("error")
    }
  });
  return q;
}
function cargo$1(worker, payload) {
  return queue$1(worker, 1, payload);
}
function cargo(worker, concurrency, payload) {
  return queue$1(worker, concurrency, payload);
}
function reduce(coll, memo, iteratee, callback) {
  callback = once$3(callback);
  var _iteratee = wrapAsync(iteratee);
  return eachOfSeries$1(coll, (x, i, iterCb) => {
    _iteratee(memo, x, (err, v) => {
      memo = v;
      iterCb(err);
    });
  }, (err) => callback(err, memo));
}
var reduce$1 = awaitify(reduce, 4);
function seq(...functions) {
  var _functions = functions.map(wrapAsync);
  return function(...args) {
    var that = this;
    var cb = args[args.length - 1];
    if (typeof cb == "function") {
      args.pop();
    } else {
      cb = promiseCallback();
    }
    reduce$1(
      _functions,
      args,
      (newargs, fn, iterCb) => {
        fn.apply(that, newargs.concat((err, ...nextargs) => {
          iterCb(err, nextargs);
        }));
      },
      (err, results) => cb(err, ...results)
    );
    return cb[PROMISE_SYMBOL];
  };
}
function compose(...args) {
  return seq(...args.reverse());
}
function mapLimit(coll, limit, iteratee, callback) {
  return _asyncMap(eachOfLimit$2(limit), coll, iteratee, callback);
}
var mapLimit$1 = awaitify(mapLimit, 4);
function concatLimit(coll, limit, iteratee, callback) {
  var _iteratee = wrapAsync(iteratee);
  return mapLimit$1(coll, limit, (val, iterCb) => {
    _iteratee(val, (err, ...args) => {
      if (err) return iterCb(err);
      return iterCb(err, args);
    });
  }, (err, mapResults) => {
    var result = [];
    for (var i = 0; i < mapResults.length; i++) {
      if (mapResults[i]) {
        result = result.concat(...mapResults[i]);
      }
    }
    return callback(err, result);
  });
}
var concatLimit$1 = awaitify(concatLimit, 4);
function concat$1(coll, iteratee, callback) {
  return concatLimit$1(coll, Infinity, iteratee, callback);
}
var concat$1$1 = awaitify(concat$1, 3);
function concatSeries(coll, iteratee, callback) {
  return concatLimit$1(coll, 1, iteratee, callback);
}
var concatSeries$1 = awaitify(concatSeries, 3);
function constant$1$1(...args) {
  return function(...ignoredArgs) {
    var callback = ignoredArgs.pop();
    return callback(null, ...args);
  };
}
function _createTester(check, getResult) {
  return (eachfn, arr, _iteratee, cb) => {
    var testPassed = false;
    var testResult;
    const iteratee = wrapAsync(_iteratee);
    eachfn(arr, (value, _2, callback) => {
      iteratee(value, (err, result) => {
        if (err || err === false) return callback(err);
        if (check(result) && !testResult) {
          testPassed = true;
          testResult = getResult(true, value);
          return callback(null, breakLoop);
        }
        callback();
      });
    }, (err) => {
      if (err) return cb(err);
      cb(null, testPassed ? testResult : getResult(false));
    });
  };
}
function detect(coll, iteratee, callback) {
  return _createTester((bool) => bool, (res, item) => item)(eachOf$1, coll, iteratee, callback);
}
var detect$1 = awaitify(detect, 3);
function detectLimit(coll, limit, iteratee, callback) {
  return _createTester((bool) => bool, (res, item) => item)(eachOfLimit$2(limit), coll, iteratee, callback);
}
var detectLimit$1 = awaitify(detectLimit, 4);
function detectSeries(coll, iteratee, callback) {
  return _createTester((bool) => bool, (res, item) => item)(eachOfLimit$2(1), coll, iteratee, callback);
}
var detectSeries$1 = awaitify(detectSeries, 3);
function consoleFunc(name) {
  return (fn, ...args) => wrapAsync(fn)(...args, (err, ...resultArgs) => {
    if (typeof console === "object") {
      if (err) {
        if (console.error) {
          console.error(err);
        }
      } else if (console[name]) {
        resultArgs.forEach((x) => console[name](x));
      }
    }
  });
}
var dir = consoleFunc("dir");
function doWhilst(iteratee, test, callback) {
  callback = onlyOnce(callback);
  var _fn = wrapAsync(iteratee);
  var _test = wrapAsync(test);
  var results;
  function next(err, ...args) {
    if (err) return callback(err);
    if (err === false) return;
    results = args;
    _test(...args, check);
  }
  function check(err, truth) {
    if (err) return callback(err);
    if (err === false) return;
    if (!truth) return callback(null, ...results);
    _fn(next);
  }
  return check(null, true);
}
var doWhilst$1 = awaitify(doWhilst, 3);
function doUntil(iteratee, test, callback) {
  const _test = wrapAsync(test);
  return doWhilst$1(iteratee, (...args) => {
    const cb = args.pop();
    _test(...args, (err, truth) => cb(err, !truth));
  }, callback);
}
function _withoutIndex(iteratee) {
  return (value, index2, callback) => iteratee(value, callback);
}
function eachLimit$2(coll, iteratee, callback) {
  return eachOf$1(coll, _withoutIndex(wrapAsync(iteratee)), callback);
}
var each = awaitify(eachLimit$2, 3);
function eachLimit(coll, limit, iteratee, callback) {
  return eachOfLimit$2(limit)(coll, _withoutIndex(wrapAsync(iteratee)), callback);
}
var eachLimit$1 = awaitify(eachLimit, 4);
function eachSeries(coll, iteratee, callback) {
  return eachLimit$1(coll, 1, iteratee, callback);
}
var eachSeries$1 = awaitify(eachSeries, 3);
function ensureAsync(fn) {
  if (isAsync(fn)) return fn;
  return function(...args) {
    var callback = args.pop();
    var sync2 = true;
    args.push((...innerArgs) => {
      if (sync2) {
        setImmediate$1(() => callback(...innerArgs));
      } else {
        callback(...innerArgs);
      }
    });
    fn.apply(this, args);
    sync2 = false;
  };
}
function every(coll, iteratee, callback) {
  return _createTester((bool) => !bool, (res) => !res)(eachOf$1, coll, iteratee, callback);
}
var every$1 = awaitify(every, 3);
function everyLimit(coll, limit, iteratee, callback) {
  return _createTester((bool) => !bool, (res) => !res)(eachOfLimit$2(limit), coll, iteratee, callback);
}
var everyLimit$1 = awaitify(everyLimit, 4);
function everySeries(coll, iteratee, callback) {
  return _createTester((bool) => !bool, (res) => !res)(eachOfSeries$1, coll, iteratee, callback);
}
var everySeries$1 = awaitify(everySeries, 3);
function filterArray(eachfn, arr, iteratee, callback) {
  var truthValues = new Array(arr.length);
  eachfn(arr, (x, index2, iterCb) => {
    iteratee(x, (err, v) => {
      truthValues[index2] = !!v;
      iterCb(err);
    });
  }, (err) => {
    if (err) return callback(err);
    var results = [];
    for (var i = 0; i < arr.length; i++) {
      if (truthValues[i]) results.push(arr[i]);
    }
    callback(null, results);
  });
}
function filterGeneric(eachfn, coll, iteratee, callback) {
  var results = [];
  eachfn(coll, (x, index2, iterCb) => {
    iteratee(x, (err, v) => {
      if (err) return iterCb(err);
      if (v) {
        results.push({ index: index2, value: x });
      }
      iterCb(err);
    });
  }, (err) => {
    if (err) return callback(err);
    callback(null, results.sort((a, b) => a.index - b.index).map((v) => v.value));
  });
}
function _filter(eachfn, coll, iteratee, callback) {
  var filter2 = isArrayLike$4(coll) ? filterArray : filterGeneric;
  return filter2(eachfn, coll, wrapAsync(iteratee), callback);
}
function filter(coll, iteratee, callback) {
  return _filter(eachOf$1, coll, iteratee, callback);
}
var filter$1 = awaitify(filter, 3);
function filterLimit(coll, limit, iteratee, callback) {
  return _filter(eachOfLimit$2(limit), coll, iteratee, callback);
}
var filterLimit$1 = awaitify(filterLimit, 4);
function filterSeries(coll, iteratee, callback) {
  return _filter(eachOfSeries$1, coll, iteratee, callback);
}
var filterSeries$1 = awaitify(filterSeries, 3);
function forever(fn, errback) {
  var done = onlyOnce(errback);
  var task = wrapAsync(ensureAsync(fn));
  function next(err) {
    if (err) return done(err);
    if (err === false) return;
    task(next);
  }
  return next();
}
var forever$1 = awaitify(forever, 2);
function groupByLimit(coll, limit, iteratee, callback) {
  var _iteratee = wrapAsync(iteratee);
  return mapLimit$1(coll, limit, (val, iterCb) => {
    _iteratee(val, (err, key) => {
      if (err) return iterCb(err);
      return iterCb(err, { key, val });
    });
  }, (err, mapResults) => {
    var result = {};
    var { hasOwnProperty: hasOwnProperty2 } = Object.prototype;
    for (var i = 0; i < mapResults.length; i++) {
      if (mapResults[i]) {
        var { key } = mapResults[i];
        var { val } = mapResults[i];
        if (hasOwnProperty2.call(result, key)) {
          result[key].push(val);
        } else {
          result[key] = [val];
        }
      }
    }
    return callback(err, result);
  });
}
var groupByLimit$1 = awaitify(groupByLimit, 4);
function groupBy(coll, iteratee, callback) {
  return groupByLimit$1(coll, Infinity, iteratee, callback);
}
function groupBySeries(coll, iteratee, callback) {
  return groupByLimit$1(coll, 1, iteratee, callback);
}
var log = consoleFunc("log");
function mapValuesLimit(obj, limit, iteratee, callback) {
  callback = once$3(callback);
  var newObj = {};
  var _iteratee = wrapAsync(iteratee);
  return eachOfLimit$2(limit)(obj, (val, key, next) => {
    _iteratee(val, key, (err, result) => {
      if (err) return next(err);
      newObj[key] = result;
      next(err);
    });
  }, (err) => callback(err, newObj));
}
var mapValuesLimit$1 = awaitify(mapValuesLimit, 4);
function mapValues(obj, iteratee, callback) {
  return mapValuesLimit$1(obj, Infinity, iteratee, callback);
}
function mapValuesSeries(obj, iteratee, callback) {
  return mapValuesLimit$1(obj, 1, iteratee, callback);
}
function memoize(fn, hasher = (v) => v) {
  var memo = /* @__PURE__ */ Object.create(null);
  var queues = /* @__PURE__ */ Object.create(null);
  var _fn = wrapAsync(fn);
  var memoized = initialParams((args, callback) => {
    var key = hasher(...args);
    if (key in memo) {
      setImmediate$1(() => callback(null, ...memo[key]));
    } else if (key in queues) {
      queues[key].push(callback);
    } else {
      queues[key] = [callback];
      _fn(...args, (err, ...resultArgs) => {
        if (!err) {
          memo[key] = resultArgs;
        }
        var q = queues[key];
        delete queues[key];
        for (var i = 0, l = q.length; i < l; i++) {
          q[i](err, ...resultArgs);
        }
      });
    }
  });
  memoized.memo = memo;
  memoized.unmemoized = fn;
  return memoized;
}
var _defer;
if (hasNextTick) {
  _defer = process.nextTick;
} else if (hasSetImmediate) {
  _defer = setImmediate;
} else {
  _defer = fallback;
}
var nextTick = wrap(_defer);
var _parallel = awaitify((eachfn, tasks, callback) => {
  var results = isArrayLike$4(tasks) ? [] : {};
  eachfn(tasks, (task, key, taskCb) => {
    wrapAsync(task)((err, ...result) => {
      if (result.length < 2) {
        [result] = result;
      }
      results[key] = result;
      taskCb(err);
    });
  }, (err) => callback(err, results));
}, 3);
function parallel(tasks, callback) {
  return _parallel(eachOf$1, tasks, callback);
}
function parallelLimit(tasks, limit, callback) {
  return _parallel(eachOfLimit$2(limit), tasks, callback);
}
function queue$2(worker, concurrency) {
  var _worker = wrapAsync(worker);
  return queue$1((items, cb) => {
    _worker(items[0], cb);
  }, concurrency, 1);
}
class Heap {
  constructor() {
    this.heap = [];
    this.pushCount = Number.MIN_SAFE_INTEGER;
  }
  get length() {
    return this.heap.length;
  }
  empty() {
    this.heap = [];
    return this;
  }
  percUp(index2) {
    let p;
    while (index2 > 0 && smaller(this.heap[index2], this.heap[p = parent(index2)])) {
      let t = this.heap[index2];
      this.heap[index2] = this.heap[p];
      this.heap[p] = t;
      index2 = p;
    }
  }
  percDown(index2) {
    let l;
    while ((l = leftChi(index2)) < this.heap.length) {
      if (l + 1 < this.heap.length && smaller(this.heap[l + 1], this.heap[l])) {
        l = l + 1;
      }
      if (smaller(this.heap[index2], this.heap[l])) {
        break;
      }
      let t = this.heap[index2];
      this.heap[index2] = this.heap[l];
      this.heap[l] = t;
      index2 = l;
    }
  }
  push(node2) {
    node2.pushCount = ++this.pushCount;
    this.heap.push(node2);
    this.percUp(this.heap.length - 1);
  }
  unshift(node2) {
    return this.heap.push(node2);
  }
  shift() {
    let [top] = this.heap;
    this.heap[0] = this.heap[this.heap.length - 1];
    this.heap.pop();
    this.percDown(0);
    return top;
  }
  toArray() {
    return [...this];
  }
  *[Symbol.iterator]() {
    for (let i = 0; i < this.heap.length; i++) {
      yield this.heap[i].data;
    }
  }
  remove(testFn) {
    let j = 0;
    for (let i = 0; i < this.heap.length; i++) {
      if (!testFn(this.heap[i])) {
        this.heap[j] = this.heap[i];
        j++;
      }
    }
    this.heap.splice(j);
    for (let i = parent(this.heap.length - 1); i >= 0; i--) {
      this.percDown(i);
    }
    return this;
  }
}
function leftChi(i) {
  return (i << 1) + 1;
}
function parent(i) {
  return (i + 1 >> 1) - 1;
}
function smaller(x, y) {
  if (x.priority !== y.priority) {
    return x.priority < y.priority;
  } else {
    return x.pushCount < y.pushCount;
  }
}
function priorityQueue(worker, concurrency) {
  var q = queue$2(worker, concurrency);
  var {
    push,
    pushAsync
  } = q;
  q._tasks = new Heap();
  q._createTaskItem = ({ data, priority }, callback) => {
    return {
      data,
      priority,
      callback
    };
  };
  function createDataItems(tasks, priority) {
    if (!Array.isArray(tasks)) {
      return { data: tasks, priority };
    }
    return tasks.map((data) => {
      return { data, priority };
    });
  }
  q.push = function(data, priority = 0, callback) {
    return push(createDataItems(data, priority), callback);
  };
  q.pushAsync = function(data, priority = 0, callback) {
    return pushAsync(createDataItems(data, priority), callback);
  };
  delete q.unshift;
  delete q.unshiftAsync;
  return q;
}
function race(tasks, callback) {
  callback = once$3(callback);
  if (!Array.isArray(tasks)) return callback(new TypeError("First argument to race must be an array of functions"));
  if (!tasks.length) return callback();
  for (var i = 0, l = tasks.length; i < l; i++) {
    wrapAsync(tasks[i])(callback);
  }
}
var race$1 = awaitify(race, 2);
function reduceRight(array, memo, iteratee, callback) {
  var reversed = [...array].reverse();
  return reduce$1(reversed, memo, iteratee, callback);
}
function reflect(fn) {
  var _fn = wrapAsync(fn);
  return initialParams(function reflectOn(args, reflectCallback) {
    args.push((error2, ...cbArgs) => {
      let retVal = {};
      if (error2) {
        retVal.error = error2;
      }
      if (cbArgs.length > 0) {
        var value = cbArgs;
        if (cbArgs.length <= 1) {
          [value] = cbArgs;
        }
        retVal.value = value;
      }
      reflectCallback(null, retVal);
    });
    return _fn.apply(this, args);
  });
}
function reflectAll(tasks) {
  var results;
  if (Array.isArray(tasks)) {
    results = tasks.map(reflect);
  } else {
    results = {};
    Object.keys(tasks).forEach((key) => {
      results[key] = reflect.call(this, tasks[key]);
    });
  }
  return results;
}
function reject$2(eachfn, arr, _iteratee, callback) {
  const iteratee = wrapAsync(_iteratee);
  return _filter(eachfn, arr, (value, cb) => {
    iteratee(value, (err, v) => {
      cb(err, !v);
    });
  }, callback);
}
function reject(coll, iteratee, callback) {
  return reject$2(eachOf$1, coll, iteratee, callback);
}
var reject$1 = awaitify(reject, 3);
function rejectLimit(coll, limit, iteratee, callback) {
  return reject$2(eachOfLimit$2(limit), coll, iteratee, callback);
}
var rejectLimit$1 = awaitify(rejectLimit, 4);
function rejectSeries(coll, iteratee, callback) {
  return reject$2(eachOfSeries$1, coll, iteratee, callback);
}
var rejectSeries$1 = awaitify(rejectSeries, 3);
function constant$2(value) {
  return function() {
    return value;
  };
}
const DEFAULT_TIMES = 5;
const DEFAULT_INTERVAL = 0;
function retry$1(opts, task, callback) {
  var options = {
    times: DEFAULT_TIMES,
    intervalFunc: constant$2(DEFAULT_INTERVAL)
  };
  if (arguments.length < 3 && typeof opts === "function") {
    callback = task || promiseCallback();
    task = opts;
  } else {
    parseTimes(options, opts);
    callback = callback || promiseCallback();
  }
  if (typeof task !== "function") {
    throw new Error("Invalid arguments for async.retry");
  }
  var _task = wrapAsync(task);
  var attempt = 1;
  function retryAttempt() {
    _task((err, ...args) => {
      if (err === false) return;
      if (err && attempt++ < options.times && (typeof options.errorFilter != "function" || options.errorFilter(err))) {
        setTimeout(retryAttempt, options.intervalFunc(attempt - 1));
      } else {
        callback(err, ...args);
      }
    });
  }
  retryAttempt();
  return callback[PROMISE_SYMBOL];
}
function parseTimes(acc, t) {
  if (typeof t === "object") {
    acc.times = +t.times || DEFAULT_TIMES;
    acc.intervalFunc = typeof t.interval === "function" ? t.interval : constant$2(+t.interval || DEFAULT_INTERVAL);
    acc.errorFilter = t.errorFilter;
  } else if (typeof t === "number" || typeof t === "string") {
    acc.times = +t || DEFAULT_TIMES;
  } else {
    throw new Error("Invalid arguments for async.retry");
  }
}
function retryable(opts, task) {
  if (!task) {
    task = opts;
    opts = null;
  }
  let arity = opts && opts.arity || task.length;
  if (isAsync(task)) {
    arity += 1;
  }
  var _task = wrapAsync(task);
  return initialParams((args, callback) => {
    if (args.length < arity - 1 || callback == null) {
      args.push(callback);
      callback = promiseCallback();
    }
    function taskFn(cb) {
      _task(...args, cb);
    }
    if (opts) retry$1(opts, taskFn, callback);
    else retry$1(taskFn, callback);
    return callback[PROMISE_SYMBOL];
  });
}
function series(tasks, callback) {
  return _parallel(eachOfSeries$1, tasks, callback);
}
function some(coll, iteratee, callback) {
  return _createTester(Boolean, (res) => res)(eachOf$1, coll, iteratee, callback);
}
var some$1 = awaitify(some, 3);
function someLimit(coll, limit, iteratee, callback) {
  return _createTester(Boolean, (res) => res)(eachOfLimit$2(limit), coll, iteratee, callback);
}
var someLimit$1 = awaitify(someLimit, 4);
function someSeries(coll, iteratee, callback) {
  return _createTester(Boolean, (res) => res)(eachOfSeries$1, coll, iteratee, callback);
}
var someSeries$1 = awaitify(someSeries, 3);
function sortBy(coll, iteratee, callback) {
  var _iteratee = wrapAsync(iteratee);
  return map$1(coll, (x, iterCb) => {
    _iteratee(x, (err, criteria) => {
      if (err) return iterCb(err);
      iterCb(err, { value: x, criteria });
    });
  }, (err, results) => {
    if (err) return callback(err);
    callback(null, results.sort(comparator).map((v) => v.value));
  });
  function comparator(left, right) {
    var a = left.criteria, b = right.criteria;
    return a < b ? -1 : a > b ? 1 : 0;
  }
}
var sortBy$1 = awaitify(sortBy, 3);
function timeout(asyncFn, milliseconds, info) {
  var fn = wrapAsync(asyncFn);
  return initialParams((args, callback) => {
    var timedOut = false;
    var timer;
    function timeoutCallback() {
      var name = asyncFn.name || "anonymous";
      var error2 = new Error('Callback function "' + name + '" timed out.');
      error2.code = "ETIMEDOUT";
      if (info) {
        error2.info = info;
      }
      timedOut = true;
      callback(error2);
    }
    args.push((...cbArgs) => {
      if (!timedOut) {
        callback(...cbArgs);
        clearTimeout(timer);
      }
    });
    timer = setTimeout(timeoutCallback, milliseconds);
    fn(...args);
  });
}
function range(size) {
  var result = Array(size);
  while (size--) {
    result[size] = size;
  }
  return result;
}
function timesLimit(count, limit, iteratee, callback) {
  var _iteratee = wrapAsync(iteratee);
  return mapLimit$1(range(count), limit, _iteratee, callback);
}
function times(n, iteratee, callback) {
  return timesLimit(n, Infinity, iteratee, callback);
}
function timesSeries(n, iteratee, callback) {
  return timesLimit(n, 1, iteratee, callback);
}
function transform(coll, accumulator, iteratee, callback) {
  if (arguments.length <= 3 && typeof accumulator === "function") {
    callback = iteratee;
    iteratee = accumulator;
    accumulator = Array.isArray(coll) ? [] : {};
  }
  callback = once$3(callback || promiseCallback());
  var _iteratee = wrapAsync(iteratee);
  eachOf$1(coll, (v, k, cb) => {
    _iteratee(accumulator, v, k, cb);
  }, (err) => callback(err, accumulator));
  return callback[PROMISE_SYMBOL];
}
function tryEach(tasks, callback) {
  var error2 = null;
  var result;
  return eachSeries$1(tasks, (task, taskCb) => {
    wrapAsync(task)((err, ...args) => {
      if (err === false) return taskCb(err);
      if (args.length < 2) {
        [result] = args;
      } else {
        result = args;
      }
      error2 = err;
      taskCb(err ? null : {});
    });
  }, () => callback(error2, result));
}
var tryEach$1 = awaitify(tryEach);
function unmemoize(fn) {
  return (...args) => {
    return (fn.unmemoized || fn)(...args);
  };
}
function whilst(test, iteratee, callback) {
  callback = onlyOnce(callback);
  var _fn = wrapAsync(iteratee);
  var _test = wrapAsync(test);
  var results = [];
  function next(err, ...rest) {
    if (err) return callback(err);
    results = rest;
    if (err === false) return;
    _test(check);
  }
  function check(err, truth) {
    if (err) return callback(err);
    if (err === false) return;
    if (!truth) return callback(null, ...results);
    _fn(next);
  }
  return _test(check);
}
var whilst$1 = awaitify(whilst, 3);
function until(test, iteratee, callback) {
  const _test = wrapAsync(test);
  return whilst$1((cb) => _test((err, truth) => cb(err, !truth)), iteratee, callback);
}
function waterfall(tasks, callback) {
  callback = once$3(callback);
  if (!Array.isArray(tasks)) return callback(new Error("First argument to waterfall must be an array of functions"));
  if (!tasks.length) return callback();
  var taskIndex = 0;
  function nextTask(args) {
    var task = wrapAsync(tasks[taskIndex++]);
    task(...args, onlyOnce(next));
  }
  function next(err, ...args) {
    if (err === false) return;
    if (err || taskIndex === tasks.length) {
      return callback(err, ...args);
    }
    nextTask(args);
  }
  nextTask([]);
}
var waterfall$1 = awaitify(waterfall);
var index = {
  apply: apply$2,
  applyEach,
  applyEachSeries,
  asyncify,
  auto,
  autoInject,
  cargo: cargo$1,
  cargoQueue: cargo,
  compose,
  concat: concat$1$1,
  concatLimit: concatLimit$1,
  concatSeries: concatSeries$1,
  constant: constant$1$1,
  detect: detect$1,
  detectLimit: detectLimit$1,
  detectSeries: detectSeries$1,
  dir,
  doUntil,
  doWhilst: doWhilst$1,
  each,
  eachLimit: eachLimit$1,
  eachOf: eachOf$1,
  eachOfLimit: eachOfLimit$1,
  eachOfSeries: eachOfSeries$1,
  eachSeries: eachSeries$1,
  ensureAsync,
  every: every$1,
  everyLimit: everyLimit$1,
  everySeries: everySeries$1,
  filter: filter$1,
  filterLimit: filterLimit$1,
  filterSeries: filterSeries$1,
  forever: forever$1,
  groupBy,
  groupByLimit: groupByLimit$1,
  groupBySeries,
  log,
  map: map$1,
  mapLimit: mapLimit$1,
  mapSeries: mapSeries$1,
  mapValues,
  mapValuesLimit: mapValuesLimit$1,
  mapValuesSeries,
  memoize,
  nextTick,
  parallel,
  parallelLimit,
  priorityQueue,
  queue: queue$2,
  race: race$1,
  reduce: reduce$1,
  reduceRight,
  reflect,
  reflectAll,
  reject: reject$1,
  rejectLimit: rejectLimit$1,
  rejectSeries: rejectSeries$1,
  retry: retry$1,
  retryable,
  seq,
  series,
  setImmediate: setImmediate$1,
  some: some$1,
  someLimit: someLimit$1,
  someSeries: someSeries$1,
  sortBy: sortBy$1,
  timeout,
  times,
  timesLimit,
  timesSeries,
  transform,
  tryEach: tryEach$1,
  unmemoize,
  until,
  waterfall: waterfall$1,
  whilst: whilst$1,
  // aliases
  all: every$1,
  allLimit: everyLimit$1,
  allSeries: everySeries$1,
  any: some$1,
  anyLimit: someLimit$1,
  anySeries: someSeries$1,
  find: detect$1,
  findLimit: detectLimit$1,
  findSeries: detectSeries$1,
  flatMap: concat$1$1,
  flatMapLimit: concatLimit$1,
  flatMapSeries: concatSeries$1,
  forEach: each,
  forEachSeries: eachSeries$1,
  forEachLimit: eachLimit$1,
  forEachOf: eachOf$1,
  forEachOfSeries: eachOfSeries$1,
  forEachOfLimit: eachOfLimit$1,
  inject: reduce$1,
  foldl: reduce$1,
  foldr: reduceRight,
  select: filter$1,
  selectLimit: filterLimit$1,
  selectSeries: filterSeries$1,
  wrapSync: asyncify,
  during: whilst$1,
  doDuring: doWhilst$1
};
const async$1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  all: every$1,
  allLimit: everyLimit$1,
  allSeries: everySeries$1,
  any: some$1,
  anyLimit: someLimit$1,
  anySeries: someSeries$1,
  apply: apply$2,
  applyEach,
  applyEachSeries,
  asyncify,
  auto,
  autoInject,
  cargo: cargo$1,
  cargoQueue: cargo,
  compose,
  concat: concat$1$1,
  concatLimit: concatLimit$1,
  concatSeries: concatSeries$1,
  constant: constant$1$1,
  default: index,
  detect: detect$1,
  detectLimit: detectLimit$1,
  detectSeries: detectSeries$1,
  dir,
  doDuring: doWhilst$1,
  doUntil,
  doWhilst: doWhilst$1,
  during: whilst$1,
  each,
  eachLimit: eachLimit$1,
  eachOf: eachOf$1,
  eachOfLimit: eachOfLimit$1,
  eachOfSeries: eachOfSeries$1,
  eachSeries: eachSeries$1,
  ensureAsync,
  every: every$1,
  everyLimit: everyLimit$1,
  everySeries: everySeries$1,
  filter: filter$1,
  filterLimit: filterLimit$1,
  filterSeries: filterSeries$1,
  find: detect$1,
  findLimit: detectLimit$1,
  findSeries: detectSeries$1,
  flatMap: concat$1$1,
  flatMapLimit: concatLimit$1,
  flatMapSeries: concatSeries$1,
  foldl: reduce$1,
  foldr: reduceRight,
  forEach: each,
  forEachLimit: eachLimit$1,
  forEachOf: eachOf$1,
  forEachOfLimit: eachOfLimit$1,
  forEachOfSeries: eachOfSeries$1,
  forEachSeries: eachSeries$1,
  forever: forever$1,
  groupBy,
  groupByLimit: groupByLimit$1,
  groupBySeries,
  inject: reduce$1,
  log,
  map: map$1,
  mapLimit: mapLimit$1,
  mapSeries: mapSeries$1,
  mapValues,
  mapValuesLimit: mapValuesLimit$1,
  mapValuesSeries,
  memoize,
  nextTick,
  parallel,
  parallelLimit,
  priorityQueue,
  queue: queue$2,
  race: race$1,
  reduce: reduce$1,
  reduceRight,
  reflect,
  reflectAll,
  reject: reject$1,
  rejectLimit: rejectLimit$1,
  rejectSeries: rejectSeries$1,
  retry: retry$1,
  retryable,
  select: filter$1,
  selectLimit: filterLimit$1,
  selectSeries: filterSeries$1,
  seq,
  series,
  setImmediate: setImmediate$1,
  some: some$1,
  someLimit: someLimit$1,
  someSeries: someSeries$1,
  sortBy: sortBy$1,
  timeout,
  times,
  timesLimit,
  timesSeries,
  transform,
  tryEach: tryEach$1,
  unmemoize,
  until,
  waterfall: waterfall$1,
  whilst: whilst$1,
  wrapSync: asyncify
}, Symbol.toStringTag, { value: "Module" }));
const require$$2 = /* @__PURE__ */ getAugmentedNamespace(async$1);
var archiverUtils = { exports: {} };
var constants$6 = require$$0$1;
var origCwd = process.cwd;
var cwd = null;
var platform = process.env.GRACEFUL_FS_PLATFORM || process.platform;
process.cwd = function() {
  if (!cwd)
    cwd = origCwd.call(process);
  return cwd;
};
try {
  process.cwd();
} catch (er) {
}
if (typeof process.chdir === "function") {
  var chdir = process.chdir;
  process.chdir = function(d) {
    cwd = null;
    chdir.call(process, d);
  };
  if (Object.setPrototypeOf) Object.setPrototypeOf(process.chdir, chdir);
}
var polyfills$1 = patch$1;
function patch$1(fs2) {
  if (constants$6.hasOwnProperty("O_SYMLINK") && process.version.match(/^v0\.6\.[0-2]|^v0\.5\./)) {
    patchLchmod(fs2);
  }
  if (!fs2.lutimes) {
    patchLutimes(fs2);
  }
  fs2.chown = chownFix(fs2.chown);
  fs2.fchown = chownFix(fs2.fchown);
  fs2.lchown = chownFix(fs2.lchown);
  fs2.chmod = chmodFix(fs2.chmod);
  fs2.fchmod = chmodFix(fs2.fchmod);
  fs2.lchmod = chmodFix(fs2.lchmod);
  fs2.chownSync = chownFixSync(fs2.chownSync);
  fs2.fchownSync = chownFixSync(fs2.fchownSync);
  fs2.lchownSync = chownFixSync(fs2.lchownSync);
  fs2.chmodSync = chmodFixSync(fs2.chmodSync);
  fs2.fchmodSync = chmodFixSync(fs2.fchmodSync);
  fs2.lchmodSync = chmodFixSync(fs2.lchmodSync);
  fs2.stat = statFix(fs2.stat);
  fs2.fstat = statFix(fs2.fstat);
  fs2.lstat = statFix(fs2.lstat);
  fs2.statSync = statFixSync(fs2.statSync);
  fs2.fstatSync = statFixSync(fs2.fstatSync);
  fs2.lstatSync = statFixSync(fs2.lstatSync);
  if (fs2.chmod && !fs2.lchmod) {
    fs2.lchmod = function(path2, mode, cb) {
      if (cb) process.nextTick(cb);
    };
    fs2.lchmodSync = function() {
    };
  }
  if (fs2.chown && !fs2.lchown) {
    fs2.lchown = function(path2, uid, gid, cb) {
      if (cb) process.nextTick(cb);
    };
    fs2.lchownSync = function() {
    };
  }
  if (platform === "win32") {
    fs2.rename = typeof fs2.rename !== "function" ? fs2.rename : function(fs$rename) {
      function rename(from2, to, cb) {
        var start = Date.now();
        var backoff = 0;
        fs$rename(from2, to, function CB(er) {
          if (er && (er.code === "EACCES" || er.code === "EPERM" || er.code === "EBUSY") && Date.now() - start < 6e4) {
            setTimeout(function() {
              fs2.stat(to, function(stater, st) {
                if (stater && stater.code === "ENOENT")
                  fs$rename(from2, to, CB);
                else
                  cb(er);
              });
            }, backoff);
            if (backoff < 100)
              backoff += 10;
            return;
          }
          if (cb) cb(er);
        });
      }
      if (Object.setPrototypeOf) Object.setPrototypeOf(rename, fs$rename);
      return rename;
    }(fs2.rename);
  }
  fs2.read = typeof fs2.read !== "function" ? fs2.read : function(fs$read) {
    function read(fd, buffer, offset, length, position, callback_) {
      var callback;
      if (callback_ && typeof callback_ === "function") {
        var eagCounter = 0;
        callback = function(er, _2, __) {
          if (er && er.code === "EAGAIN" && eagCounter < 10) {
            eagCounter++;
            return fs$read.call(fs2, fd, buffer, offset, length, position, callback);
          }
          callback_.apply(this, arguments);
        };
      }
      return fs$read.call(fs2, fd, buffer, offset, length, position, callback);
    }
    if (Object.setPrototypeOf) Object.setPrototypeOf(read, fs$read);
    return read;
  }(fs2.read);
  fs2.readSync = typeof fs2.readSync !== "function" ? fs2.readSync : /* @__PURE__ */ function(fs$readSync) {
    return function(fd, buffer, offset, length, position) {
      var eagCounter = 0;
      while (true) {
        try {
          return fs$readSync.call(fs2, fd, buffer, offset, length, position);
        } catch (er) {
          if (er.code === "EAGAIN" && eagCounter < 10) {
            eagCounter++;
            continue;
          }
          throw er;
        }
      }
    };
  }(fs2.readSync);
  function patchLchmod(fs3) {
    fs3.lchmod = function(path2, mode, callback) {
      fs3.open(
        path2,
        constants$6.O_WRONLY | constants$6.O_SYMLINK,
        mode,
        function(err, fd) {
          if (err) {
            if (callback) callback(err);
            return;
          }
          fs3.fchmod(fd, mode, function(err2) {
            fs3.close(fd, function(err22) {
              if (callback) callback(err2 || err22);
            });
          });
        }
      );
    };
    fs3.lchmodSync = function(path2, mode) {
      var fd = fs3.openSync(path2, constants$6.O_WRONLY | constants$6.O_SYMLINK, mode);
      var threw = true;
      var ret;
      try {
        ret = fs3.fchmodSync(fd, mode);
        threw = false;
      } finally {
        if (threw) {
          try {
            fs3.closeSync(fd);
          } catch (er) {
          }
        } else {
          fs3.closeSync(fd);
        }
      }
      return ret;
    };
  }
  function patchLutimes(fs3) {
    if (constants$6.hasOwnProperty("O_SYMLINK") && fs3.futimes) {
      fs3.lutimes = function(path2, at, mt, cb) {
        fs3.open(path2, constants$6.O_SYMLINK, function(er, fd) {
          if (er) {
            if (cb) cb(er);
            return;
          }
          fs3.futimes(fd, at, mt, function(er2) {
            fs3.close(fd, function(er22) {
              if (cb) cb(er2 || er22);
            });
          });
        });
      };
      fs3.lutimesSync = function(path2, at, mt) {
        var fd = fs3.openSync(path2, constants$6.O_SYMLINK);
        var ret;
        var threw = true;
        try {
          ret = fs3.futimesSync(fd, at, mt);
          threw = false;
        } finally {
          if (threw) {
            try {
              fs3.closeSync(fd);
            } catch (er) {
            }
          } else {
            fs3.closeSync(fd);
          }
        }
        return ret;
      };
    } else if (fs3.futimes) {
      fs3.lutimes = function(_a, _b, _c, cb) {
        if (cb) process.nextTick(cb);
      };
      fs3.lutimesSync = function() {
      };
    }
  }
  function chmodFix(orig) {
    if (!orig) return orig;
    return function(target, mode, cb) {
      return orig.call(fs2, target, mode, function(er) {
        if (chownErOk(er)) er = null;
        if (cb) cb.apply(this, arguments);
      });
    };
  }
  function chmodFixSync(orig) {
    if (!orig) return orig;
    return function(target, mode) {
      try {
        return orig.call(fs2, target, mode);
      } catch (er) {
        if (!chownErOk(er)) throw er;
      }
    };
  }
  function chownFix(orig) {
    if (!orig) return orig;
    return function(target, uid, gid, cb) {
      return orig.call(fs2, target, uid, gid, function(er) {
        if (chownErOk(er)) er = null;
        if (cb) cb.apply(this, arguments);
      });
    };
  }
  function chownFixSync(orig) {
    if (!orig) return orig;
    return function(target, uid, gid) {
      try {
        return orig.call(fs2, target, uid, gid);
      } catch (er) {
        if (!chownErOk(er)) throw er;
      }
    };
  }
  function statFix(orig) {
    if (!orig) return orig;
    return function(target, options, cb) {
      if (typeof options === "function") {
        cb = options;
        options = null;
      }
      function callback(er, stats) {
        if (stats) {
          if (stats.uid < 0) stats.uid += 4294967296;
          if (stats.gid < 0) stats.gid += 4294967296;
        }
        if (cb) cb.apply(this, arguments);
      }
      return options ? orig.call(fs2, target, options, callback) : orig.call(fs2, target, callback);
    };
  }
  function statFixSync(orig) {
    if (!orig) return orig;
    return function(target, options) {
      var stats = options ? orig.call(fs2, target, options) : orig.call(fs2, target);
      if (stats) {
        if (stats.uid < 0) stats.uid += 4294967296;
        if (stats.gid < 0) stats.gid += 4294967296;
      }
      return stats;
    };
  }
  function chownErOk(er) {
    if (!er)
      return true;
    if (er.code === "ENOSYS")
      return true;
    var nonroot = !process.getuid || process.getuid() !== 0;
    if (nonroot) {
      if (er.code === "EINVAL" || er.code === "EPERM")
        return true;
    }
    return false;
  }
}
var Stream$3 = require$$0$2.Stream;
var legacyStreams = legacy$1;
function legacy$1(fs2) {
  return {
    ReadStream,
    WriteStream
  };
  function ReadStream(path2, options) {
    if (!(this instanceof ReadStream)) return new ReadStream(path2, options);
    Stream$3.call(this);
    var self2 = this;
    this.path = path2;
    this.fd = null;
    this.readable = true;
    this.paused = false;
    this.flags = "r";
    this.mode = 438;
    this.bufferSize = 64 * 1024;
    options = options || {};
    var keys = Object.keys(options);
    for (var index2 = 0, length = keys.length; index2 < length; index2++) {
      var key = keys[index2];
      this[key] = options[key];
    }
    if (this.encoding) this.setEncoding(this.encoding);
    if (this.start !== void 0) {
      if ("number" !== typeof this.start) {
        throw TypeError("start must be a Number");
      }
      if (this.end === void 0) {
        this.end = Infinity;
      } else if ("number" !== typeof this.end) {
        throw TypeError("end must be a Number");
      }
      if (this.start > this.end) {
        throw new Error("start must be <= end");
      }
      this.pos = this.start;
    }
    if (this.fd !== null) {
      process.nextTick(function() {
        self2._read();
      });
      return;
    }
    fs2.open(this.path, this.flags, this.mode, function(err, fd) {
      if (err) {
        self2.emit("error", err);
        self2.readable = false;
        return;
      }
      self2.fd = fd;
      self2.emit("open", fd);
      self2._read();
    });
  }
  function WriteStream(path2, options) {
    if (!(this instanceof WriteStream)) return new WriteStream(path2, options);
    Stream$3.call(this);
    this.path = path2;
    this.fd = null;
    this.writable = true;
    this.flags = "w";
    this.encoding = "binary";
    this.mode = 438;
    this.bytesWritten = 0;
    options = options || {};
    var keys = Object.keys(options);
    for (var index2 = 0, length = keys.length; index2 < length; index2++) {
      var key = keys[index2];
      this[key] = options[key];
    }
    if (this.start !== void 0) {
      if ("number" !== typeof this.start) {
        throw TypeError("start must be a Number");
      }
      if (this.start < 0) {
        throw new Error("start must be >= zero");
      }
      this.pos = this.start;
    }
    this.busy = false;
    this._queue = [];
    if (this.fd === null) {
      this._open = fs2.open;
      this._queue.push([this._open, this.path, this.flags, this.mode, void 0]);
      this.flush();
    }
  }
}
var clone_1 = clone$1;
var getPrototypeOf = Object.getPrototypeOf || function(obj) {
  return obj.__proto__;
};
function clone$1(obj) {
  if (obj === null || typeof obj !== "object")
    return obj;
  if (obj instanceof Object)
    var copy2 = { __proto__: getPrototypeOf(obj) };
  else
    var copy2 = /* @__PURE__ */ Object.create(null);
  Object.getOwnPropertyNames(obj).forEach(function(key) {
    Object.defineProperty(copy2, key, Object.getOwnPropertyDescriptor(obj, key));
  });
  return copy2;
}
var fs$6 = fs$8;
var polyfills = polyfills$1;
var legacy = legacyStreams;
var clone = clone_1;
var util$d = require$$0$3;
var gracefulQueue;
var previousSymbol;
if (typeof Symbol === "function" && typeof Symbol.for === "function") {
  gracefulQueue = Symbol.for("graceful-fs.queue");
  previousSymbol = Symbol.for("graceful-fs.previous");
} else {
  gracefulQueue = "___graceful-fs.queue";
  previousSymbol = "___graceful-fs.previous";
}
function noop$5() {
}
function publishQueue(context, queue) {
  Object.defineProperty(context, gracefulQueue, {
    get: function() {
      return queue;
    }
  });
}
var debug = noop$5;
if (util$d.debuglog)
  debug = util$d.debuglog("gfs4");
else if (/\bgfs4\b/i.test(process.env.NODE_DEBUG || ""))
  debug = function() {
    var m = util$d.format.apply(util$d, arguments);
    m = "GFS4: " + m.split(/\n/).join("\nGFS4: ");
    console.error(m);
  };
if (!fs$6[gracefulQueue]) {
  var queue = commonjsGlobal[gracefulQueue] || [];
  publishQueue(fs$6, queue);
  fs$6.close = function(fs$close) {
    function close(fd, cb) {
      return fs$close.call(fs$6, fd, function(err) {
        if (!err) {
          resetQueue();
        }
        if (typeof cb === "function")
          cb.apply(this, arguments);
      });
    }
    Object.defineProperty(close, previousSymbol, {
      value: fs$close
    });
    return close;
  }(fs$6.close);
  fs$6.closeSync = function(fs$closeSync) {
    function closeSync(fd) {
      fs$closeSync.apply(fs$6, arguments);
      resetQueue();
    }
    Object.defineProperty(closeSync, previousSymbol, {
      value: fs$closeSync
    });
    return closeSync;
  }(fs$6.closeSync);
  if (/\bgfs4\b/i.test(process.env.NODE_DEBUG || "")) {
    process.on("exit", function() {
      debug(fs$6[gracefulQueue]);
      require$$5.equal(fs$6[gracefulQueue].length, 0);
    });
  }
}
if (!commonjsGlobal[gracefulQueue]) {
  publishQueue(commonjsGlobal, fs$6[gracefulQueue]);
}
var gracefulFs = patch(clone(fs$6));
if (process.env.TEST_GRACEFUL_FS_GLOBAL_PATCH && !fs$6.__patched) {
  gracefulFs = patch(fs$6);
  fs$6.__patched = true;
}
function patch(fs2) {
  polyfills(fs2);
  fs2.gracefulify = patch;
  fs2.createReadStream = createReadStream;
  fs2.createWriteStream = createWriteStream;
  var fs$readFile = fs2.readFile;
  fs2.readFile = readFile;
  function readFile(path2, options, cb) {
    if (typeof options === "function")
      cb = options, options = null;
    return go$readFile(path2, options, cb);
    function go$readFile(path3, options2, cb2, startTime) {
      return fs$readFile(path3, options2, function(err) {
        if (err && (err.code === "EMFILE" || err.code === "ENFILE"))
          enqueue([go$readFile, [path3, options2, cb2], err, startTime || Date.now(), Date.now()]);
        else {
          if (typeof cb2 === "function")
            cb2.apply(this, arguments);
        }
      });
    }
  }
  var fs$writeFile = fs2.writeFile;
  fs2.writeFile = writeFile;
  function writeFile(path2, data, options, cb) {
    if (typeof options === "function")
      cb = options, options = null;
    return go$writeFile(path2, data, options, cb);
    function go$writeFile(path3, data2, options2, cb2, startTime) {
      return fs$writeFile(path3, data2, options2, function(err) {
        if (err && (err.code === "EMFILE" || err.code === "ENFILE"))
          enqueue([go$writeFile, [path3, data2, options2, cb2], err, startTime || Date.now(), Date.now()]);
        else {
          if (typeof cb2 === "function")
            cb2.apply(this, arguments);
        }
      });
    }
  }
  var fs$appendFile = fs2.appendFile;
  if (fs$appendFile)
    fs2.appendFile = appendFile;
  function appendFile(path2, data, options, cb) {
    if (typeof options === "function")
      cb = options, options = null;
    return go$appendFile(path2, data, options, cb);
    function go$appendFile(path3, data2, options2, cb2, startTime) {
      return fs$appendFile(path3, data2, options2, function(err) {
        if (err && (err.code === "EMFILE" || err.code === "ENFILE"))
          enqueue([go$appendFile, [path3, data2, options2, cb2], err, startTime || Date.now(), Date.now()]);
        else {
          if (typeof cb2 === "function")
            cb2.apply(this, arguments);
        }
      });
    }
  }
  var fs$copyFile = fs2.copyFile;
  if (fs$copyFile)
    fs2.copyFile = copyFile;
  function copyFile(src, dest, flags, cb) {
    if (typeof flags === "function") {
      cb = flags;
      flags = 0;
    }
    return go$copyFile(src, dest, flags, cb);
    function go$copyFile(src2, dest2, flags2, cb2, startTime) {
      return fs$copyFile(src2, dest2, flags2, function(err) {
        if (err && (err.code === "EMFILE" || err.code === "ENFILE"))
          enqueue([go$copyFile, [src2, dest2, flags2, cb2], err, startTime || Date.now(), Date.now()]);
        else {
          if (typeof cb2 === "function")
            cb2.apply(this, arguments);
        }
      });
    }
  }
  var fs$readdir = fs2.readdir;
  fs2.readdir = readdir2;
  var noReaddirOptionVersions = /^v[0-5]\./;
  function readdir2(path2, options, cb) {
    if (typeof options === "function")
      cb = options, options = null;
    var go$readdir = noReaddirOptionVersions.test(process.version) ? function go$readdir2(path3, options2, cb2, startTime) {
      return fs$readdir(path3, fs$readdirCallback(
        path3,
        options2,
        cb2,
        startTime
      ));
    } : function go$readdir2(path3, options2, cb2, startTime) {
      return fs$readdir(path3, options2, fs$readdirCallback(
        path3,
        options2,
        cb2,
        startTime
      ));
    };
    return go$readdir(path2, options, cb);
    function fs$readdirCallback(path3, options2, cb2, startTime) {
      return function(err, files) {
        if (err && (err.code === "EMFILE" || err.code === "ENFILE"))
          enqueue([
            go$readdir,
            [path3, options2, cb2],
            err,
            startTime || Date.now(),
            Date.now()
          ]);
        else {
          if (files && files.sort)
            files.sort();
          if (typeof cb2 === "function")
            cb2.call(this, err, files);
        }
      };
    }
  }
  if (process.version.substr(0, 4) === "v0.8") {
    var legStreams = legacy(fs2);
    ReadStream = legStreams.ReadStream;
    WriteStream = legStreams.WriteStream;
  }
  var fs$ReadStream = fs2.ReadStream;
  if (fs$ReadStream) {
    ReadStream.prototype = Object.create(fs$ReadStream.prototype);
    ReadStream.prototype.open = ReadStream$open;
  }
  var fs$WriteStream = fs2.WriteStream;
  if (fs$WriteStream) {
    WriteStream.prototype = Object.create(fs$WriteStream.prototype);
    WriteStream.prototype.open = WriteStream$open;
  }
  Object.defineProperty(fs2, "ReadStream", {
    get: function() {
      return ReadStream;
    },
    set: function(val) {
      ReadStream = val;
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(fs2, "WriteStream", {
    get: function() {
      return WriteStream;
    },
    set: function(val) {
      WriteStream = val;
    },
    enumerable: true,
    configurable: true
  });
  var FileReadStream = ReadStream;
  Object.defineProperty(fs2, "FileReadStream", {
    get: function() {
      return FileReadStream;
    },
    set: function(val) {
      FileReadStream = val;
    },
    enumerable: true,
    configurable: true
  });
  var FileWriteStream = WriteStream;
  Object.defineProperty(fs2, "FileWriteStream", {
    get: function() {
      return FileWriteStream;
    },
    set: function(val) {
      FileWriteStream = val;
    },
    enumerable: true,
    configurable: true
  });
  function ReadStream(path2, options) {
    if (this instanceof ReadStream)
      return fs$ReadStream.apply(this, arguments), this;
    else
      return ReadStream.apply(Object.create(ReadStream.prototype), arguments);
  }
  function ReadStream$open() {
    var that = this;
    open(that.path, that.flags, that.mode, function(err, fd) {
      if (err) {
        if (that.autoClose)
          that.destroy();
        that.emit("error", err);
      } else {
        that.fd = fd;
        that.emit("open", fd);
        that.read();
      }
    });
  }
  function WriteStream(path2, options) {
    if (this instanceof WriteStream)
      return fs$WriteStream.apply(this, arguments), this;
    else
      return WriteStream.apply(Object.create(WriteStream.prototype), arguments);
  }
  function WriteStream$open() {
    var that = this;
    open(that.path, that.flags, that.mode, function(err, fd) {
      if (err) {
        that.destroy();
        that.emit("error", err);
      } else {
        that.fd = fd;
        that.emit("open", fd);
      }
    });
  }
  function createReadStream(path2, options) {
    return new fs2.ReadStream(path2, options);
  }
  function createWriteStream(path2, options) {
    return new fs2.WriteStream(path2, options);
  }
  var fs$open = fs2.open;
  fs2.open = open;
  function open(path2, flags, mode, cb) {
    if (typeof mode === "function")
      cb = mode, mode = null;
    return go$open(path2, flags, mode, cb);
    function go$open(path3, flags2, mode2, cb2, startTime) {
      return fs$open(path3, flags2, mode2, function(err, fd) {
        if (err && (err.code === "EMFILE" || err.code === "ENFILE"))
          enqueue([go$open, [path3, flags2, mode2, cb2], err, startTime || Date.now(), Date.now()]);
        else {
          if (typeof cb2 === "function")
            cb2.apply(this, arguments);
        }
      });
    }
  }
  return fs2;
}
function enqueue(elem) {
  debug("ENQUEUE", elem[0].name, elem[1]);
  fs$6[gracefulQueue].push(elem);
  retry();
}
var retryTimer;
function resetQueue() {
  var now = Date.now();
  for (var i = 0; i < fs$6[gracefulQueue].length; ++i) {
    if (fs$6[gracefulQueue][i].length > 2) {
      fs$6[gracefulQueue][i][3] = now;
      fs$6[gracefulQueue][i][4] = now;
    }
  }
  retry();
}
function retry() {
  clearTimeout(retryTimer);
  retryTimer = void 0;
  if (fs$6[gracefulQueue].length === 0)
    return;
  var elem = fs$6[gracefulQueue].shift();
  var fn = elem[0];
  var args = elem[1];
  var err = elem[2];
  var startTime = elem[3];
  var lastTime = elem[4];
  if (startTime === void 0) {
    debug("RETRY", fn.name, args);
    fn.apply(null, args);
  } else if (Date.now() - startTime >= 6e4) {
    debug("TIMEOUT", fn.name, args);
    var cb = args.pop();
    if (typeof cb === "function")
      cb.call(null, err);
  } else {
    var sinceAttempt = Date.now() - lastTime;
    var sinceStart = Math.max(lastTime - startTime, 1);
    var desiredDelay = Math.min(sinceStart * 1.2, 100);
    if (sinceAttempt >= desiredDelay) {
      debug("RETRY", fn.name, args);
      fn.apply(null, args.concat([startTime]));
    } else {
      fs$6[gracefulQueue].push(elem);
    }
  }
  if (retryTimer === void 0) {
    retryTimer = setTimeout(retry, 0);
  }
}
var readable$1 = { exports: {} };
var processNextickArgs = { exports: {} };
var hasRequiredProcessNextickArgs;
function requireProcessNextickArgs() {
  if (hasRequiredProcessNextickArgs) return processNextickArgs.exports;
  hasRequiredProcessNextickArgs = 1;
  if (typeof process === "undefined" || !process.version || process.version.indexOf("v0.") === 0 || process.version.indexOf("v1.") === 0 && process.version.indexOf("v1.8.") !== 0) {
    processNextickArgs.exports = { nextTick: nextTick2 };
  } else {
    processNextickArgs.exports = process;
  }
  function nextTick2(fn, arg1, arg2, arg3) {
    if (typeof fn !== "function") {
      throw new TypeError('"callback" argument must be a function');
    }
    var len = arguments.length;
    var args, i;
    switch (len) {
      case 0:
      case 1:
        return process.nextTick(fn);
      case 2:
        return process.nextTick(function afterTickOne() {
          fn.call(null, arg1);
        });
      case 3:
        return process.nextTick(function afterTickTwo() {
          fn.call(null, arg1, arg2);
        });
      case 4:
        return process.nextTick(function afterTickThree() {
          fn.call(null, arg1, arg2, arg3);
        });
      default:
        args = new Array(len - 1);
        i = 0;
        while (i < args.length) {
          args[i++] = arguments[i];
        }
        return process.nextTick(function afterTick() {
          fn.apply(null, args);
        });
    }
  }
  return processNextickArgs.exports;
}
var isarray;
var hasRequiredIsarray;
function requireIsarray() {
  if (hasRequiredIsarray) return isarray;
  hasRequiredIsarray = 1;
  var toString2 = {}.toString;
  isarray = Array.isArray || function(arr) {
    return toString2.call(arr) == "[object Array]";
  };
  return isarray;
}
var stream$1;
var hasRequiredStream$1;
function requireStream$1() {
  if (hasRequiredStream$1) return stream$1;
  hasRequiredStream$1 = 1;
  stream$1 = require$$0$2;
  return stream$1;
}
var safeBuffer$1 = { exports: {} };
var hasRequiredSafeBuffer$1;
function requireSafeBuffer$1() {
  if (hasRequiredSafeBuffer$1) return safeBuffer$1.exports;
  hasRequiredSafeBuffer$1 = 1;
  (function(module2, exports) {
    var buffer = require$$0$4;
    var Buffer2 = buffer.Buffer;
    function copyProps(src, dst) {
      for (var key in src) {
        dst[key] = src[key];
      }
    }
    if (Buffer2.from && Buffer2.alloc && Buffer2.allocUnsafe && Buffer2.allocUnsafeSlow) {
      module2.exports = buffer;
    } else {
      copyProps(buffer, exports);
      exports.Buffer = SafeBuffer;
    }
    function SafeBuffer(arg, encodingOrOffset, length) {
      return Buffer2(arg, encodingOrOffset, length);
    }
    copyProps(Buffer2, SafeBuffer);
    SafeBuffer.from = function(arg, encodingOrOffset, length) {
      if (typeof arg === "number") {
        throw new TypeError("Argument must not be a number");
      }
      return Buffer2(arg, encodingOrOffset, length);
    };
    SafeBuffer.alloc = function(size, fill2, encoding) {
      if (typeof size !== "number") {
        throw new TypeError("Argument must be a number");
      }
      var buf = Buffer2(size);
      if (fill2 !== void 0) {
        if (typeof encoding === "string") {
          buf.fill(fill2, encoding);
        } else {
          buf.fill(fill2);
        }
      } else {
        buf.fill(0);
      }
      return buf;
    };
    SafeBuffer.allocUnsafe = function(size) {
      if (typeof size !== "number") {
        throw new TypeError("Argument must be a number");
      }
      return Buffer2(size);
    };
    SafeBuffer.allocUnsafeSlow = function(size) {
      if (typeof size !== "number") {
        throw new TypeError("Argument must be a number");
      }
      return buffer.SlowBuffer(size);
    };
  })(safeBuffer$1, safeBuffer$1.exports);
  return safeBuffer$1.exports;
}
var util$c = {};
var hasRequiredUtil;
function requireUtil() {
  if (hasRequiredUtil) return util$c;
  hasRequiredUtil = 1;
  function isArray2(arg) {
    if (Array.isArray) {
      return Array.isArray(arg);
    }
    return objectToString2(arg) === "[object Array]";
  }
  util$c.isArray = isArray2;
  function isBoolean(arg) {
    return typeof arg === "boolean";
  }
  util$c.isBoolean = isBoolean;
  function isNull(arg) {
    return arg === null;
  }
  util$c.isNull = isNull;
  function isNullOrUndefined(arg) {
    return arg == null;
  }
  util$c.isNullOrUndefined = isNullOrUndefined;
  function isNumber(arg) {
    return typeof arg === "number";
  }
  util$c.isNumber = isNumber;
  function isString(arg) {
    return typeof arg === "string";
  }
  util$c.isString = isString;
  function isSymbol(arg) {
    return typeof arg === "symbol";
  }
  util$c.isSymbol = isSymbol;
  function isUndefined(arg) {
    return arg === void 0;
  }
  util$c.isUndefined = isUndefined;
  function isRegExp(re) {
    return objectToString2(re) === "[object RegExp]";
  }
  util$c.isRegExp = isRegExp;
  function isObject2(arg) {
    return typeof arg === "object" && arg !== null;
  }
  util$c.isObject = isObject2;
  function isDate(d) {
    return objectToString2(d) === "[object Date]";
  }
  util$c.isDate = isDate;
  function isError(e) {
    return objectToString2(e) === "[object Error]" || e instanceof Error;
  }
  util$c.isError = isError;
  function isFunction2(arg) {
    return typeof arg === "function";
  }
  util$c.isFunction = isFunction2;
  function isPrimitive(arg) {
    return arg === null || typeof arg === "boolean" || typeof arg === "number" || typeof arg === "string" || typeof arg === "symbol" || // ES6 symbol
    typeof arg === "undefined";
  }
  util$c.isPrimitive = isPrimitive;
  util$c.isBuffer = require$$0$4.Buffer.isBuffer;
  function objectToString2(o) {
    return Object.prototype.toString.call(o);
  }
  return util$c;
}
var inherits$6 = { exports: {} };
var inherits_browser = { exports: {} };
var hasRequiredInherits_browser;
function requireInherits_browser() {
  if (hasRequiredInherits_browser) return inherits_browser.exports;
  hasRequiredInherits_browser = 1;
  if (typeof Object.create === "function") {
    inherits_browser.exports = function inherits2(ctor, superCtor) {
      if (superCtor) {
        ctor.super_ = superCtor;
        ctor.prototype = Object.create(superCtor.prototype, {
          constructor: {
            value: ctor,
            enumerable: false,
            writable: true,
            configurable: true
          }
        });
      }
    };
  } else {
    inherits_browser.exports = function inherits2(ctor, superCtor) {
      if (superCtor) {
        ctor.super_ = superCtor;
        var TempCtor = function() {
        };
        TempCtor.prototype = superCtor.prototype;
        ctor.prototype = new TempCtor();
        ctor.prototype.constructor = ctor;
      }
    };
  }
  return inherits_browser.exports;
}
try {
  var util$b = require("util");
  if (typeof util$b.inherits !== "function") throw "";
  inherits$6.exports = util$b.inherits;
} catch (e) {
  inherits$6.exports = requireInherits_browser();
}
var inheritsExports = inherits$6.exports;
var BufferList$1 = { exports: {} };
var hasRequiredBufferList;
function requireBufferList() {
  if (hasRequiredBufferList) return BufferList$1.exports;
  hasRequiredBufferList = 1;
  (function(module2) {
    function _classCallCheck(instance, Constructor) {
      if (!(instance instanceof Constructor)) {
        throw new TypeError("Cannot call a class as a function");
      }
    }
    var Buffer2 = requireSafeBuffer$1().Buffer;
    var util2 = require$$0$3;
    function copyBuffer(src, target, offset) {
      src.copy(target, offset);
    }
    module2.exports = function() {
      function BufferList2() {
        _classCallCheck(this, BufferList2);
        this.head = null;
        this.tail = null;
        this.length = 0;
      }
      BufferList2.prototype.push = function push(v) {
        var entry = { data: v, next: null };
        if (this.length > 0) this.tail.next = entry;
        else this.head = entry;
        this.tail = entry;
        ++this.length;
      };
      BufferList2.prototype.unshift = function unshift(v) {
        var entry = { data: v, next: this.head };
        if (this.length === 0) this.tail = entry;
        this.head = entry;
        ++this.length;
      };
      BufferList2.prototype.shift = function shift() {
        if (this.length === 0) return;
        var ret = this.head.data;
        if (this.length === 1) this.head = this.tail = null;
        else this.head = this.head.next;
        --this.length;
        return ret;
      };
      BufferList2.prototype.clear = function clear() {
        this.head = this.tail = null;
        this.length = 0;
      };
      BufferList2.prototype.join = function join(s) {
        if (this.length === 0) return "";
        var p = this.head;
        var ret = "" + p.data;
        while (p = p.next) {
          ret += s + p.data;
        }
        return ret;
      };
      BufferList2.prototype.concat = function concat2(n) {
        if (this.length === 0) return Buffer2.alloc(0);
        var ret = Buffer2.allocUnsafe(n >>> 0);
        var p = this.head;
        var i = 0;
        while (p) {
          copyBuffer(p.data, ret, i);
          i += p.data.length;
          p = p.next;
        }
        return ret;
      };
      return BufferList2;
    }();
    if (util2 && util2.inspect && util2.inspect.custom) {
      module2.exports.prototype[util2.inspect.custom] = function() {
        var obj = util2.inspect({ length: this.length });
        return this.constructor.name + " " + obj;
      };
    }
  })(BufferList$1);
  return BufferList$1.exports;
}
var destroy_1$1;
var hasRequiredDestroy$1;
function requireDestroy$1() {
  if (hasRequiredDestroy$1) return destroy_1$1;
  hasRequiredDestroy$1 = 1;
  var pna = requireProcessNextickArgs();
  function destroy(err, cb) {
    var _this = this;
    var readableDestroyed = this._readableState && this._readableState.destroyed;
    var writableDestroyed = this._writableState && this._writableState.destroyed;
    if (readableDestroyed || writableDestroyed) {
      if (cb) {
        cb(err);
      } else if (err) {
        if (!this._writableState) {
          pna.nextTick(emitErrorNT, this, err);
        } else if (!this._writableState.errorEmitted) {
          this._writableState.errorEmitted = true;
          pna.nextTick(emitErrorNT, this, err);
        }
      }
      return this;
    }
    if (this._readableState) {
      this._readableState.destroyed = true;
    }
    if (this._writableState) {
      this._writableState.destroyed = true;
    }
    this._destroy(err || null, function(err2) {
      if (!cb && err2) {
        if (!_this._writableState) {
          pna.nextTick(emitErrorNT, _this, err2);
        } else if (!_this._writableState.errorEmitted) {
          _this._writableState.errorEmitted = true;
          pna.nextTick(emitErrorNT, _this, err2);
        }
      } else if (cb) {
        cb(err2);
      }
    });
    return this;
  }
  function undestroy() {
    if (this._readableState) {
      this._readableState.destroyed = false;
      this._readableState.reading = false;
      this._readableState.ended = false;
      this._readableState.endEmitted = false;
    }
    if (this._writableState) {
      this._writableState.destroyed = false;
      this._writableState.ended = false;
      this._writableState.ending = false;
      this._writableState.finalCalled = false;
      this._writableState.prefinished = false;
      this._writableState.finished = false;
      this._writableState.errorEmitted = false;
    }
  }
  function emitErrorNT(self2, err) {
    self2.emit("error", err);
  }
  destroy_1$1 = {
    destroy,
    undestroy
  };
  return destroy_1$1;
}
var node;
var hasRequiredNode;
function requireNode() {
  if (hasRequiredNode) return node;
  hasRequiredNode = 1;
  node = require$$0$3.deprecate;
  return node;
}
var _stream_writable$1;
var hasRequired_stream_writable$1;
function require_stream_writable$1() {
  if (hasRequired_stream_writable$1) return _stream_writable$1;
  hasRequired_stream_writable$1 = 1;
  var pna = requireProcessNextickArgs();
  _stream_writable$1 = Writable3;
  function CorkedRequest(state2) {
    var _this = this;
    this.next = null;
    this.entry = null;
    this.finish = function() {
      onCorkedFinish(_this, state2);
    };
  }
  var asyncWrite = !process.browser && ["v0.10", "v0.9."].indexOf(process.version.slice(0, 5)) > -1 ? setImmediate : pna.nextTick;
  var Duplex2;
  Writable3.WritableState = WritableState2;
  var util2 = Object.create(requireUtil());
  util2.inherits = inheritsExports;
  var internalUtil = {
    deprecate: requireNode()
  };
  var Stream2 = requireStream$1();
  var Buffer2 = requireSafeBuffer$1().Buffer;
  var OurUint8Array = (typeof commonjsGlobal !== "undefined" ? commonjsGlobal : typeof window !== "undefined" ? window : typeof self !== "undefined" ? self : {}).Uint8Array || function() {
  };
  function _uint8ArrayToBuffer(chunk) {
    return Buffer2.from(chunk);
  }
  function _isUint8Array(obj) {
    return Buffer2.isBuffer(obj) || obj instanceof OurUint8Array;
  }
  var destroyImpl = requireDestroy$1();
  util2.inherits(Writable3, Stream2);
  function nop() {
  }
  function WritableState2(options, stream2) {
    Duplex2 = Duplex2 || require_stream_duplex$1();
    options = options || {};
    var isDuplex = stream2 instanceof Duplex2;
    this.objectMode = !!options.objectMode;
    if (isDuplex) this.objectMode = this.objectMode || !!options.writableObjectMode;
    var hwm = options.highWaterMark;
    var writableHwm = options.writableHighWaterMark;
    var defaultHwm = this.objectMode ? 16 : 16 * 1024;
    if (hwm || hwm === 0) this.highWaterMark = hwm;
    else if (isDuplex && (writableHwm || writableHwm === 0)) this.highWaterMark = writableHwm;
    else this.highWaterMark = defaultHwm;
    this.highWaterMark = Math.floor(this.highWaterMark);
    this.finalCalled = false;
    this.needDrain = false;
    this.ending = false;
    this.ended = false;
    this.finished = false;
    this.destroyed = false;
    var noDecode = options.decodeStrings === false;
    this.decodeStrings = !noDecode;
    this.defaultEncoding = options.defaultEncoding || "utf8";
    this.length = 0;
    this.writing = false;
    this.corked = 0;
    this.sync = true;
    this.bufferProcessing = false;
    this.onwrite = function(er) {
      onwrite(stream2, er);
    };
    this.writecb = null;
    this.writelen = 0;
    this.bufferedRequest = null;
    this.lastBufferedRequest = null;
    this.pendingcb = 0;
    this.prefinished = false;
    this.errorEmitted = false;
    this.bufferedRequestCount = 0;
    this.corkedRequestsFree = new CorkedRequest(this);
  }
  WritableState2.prototype.getBuffer = function getBuffer() {
    var current = this.bufferedRequest;
    var out = [];
    while (current) {
      out.push(current);
      current = current.next;
    }
    return out;
  };
  (function() {
    try {
      Object.defineProperty(WritableState2.prototype, "buffer", {
        get: internalUtil.deprecate(function() {
          return this.getBuffer();
        }, "_writableState.buffer is deprecated. Use _writableState.getBuffer instead.", "DEP0003")
      });
    } catch (_2) {
    }
  })();
  var realHasInstance;
  if (typeof Symbol === "function" && Symbol.hasInstance && typeof Function.prototype[Symbol.hasInstance] === "function") {
    realHasInstance = Function.prototype[Symbol.hasInstance];
    Object.defineProperty(Writable3, Symbol.hasInstance, {
      value: function(object) {
        if (realHasInstance.call(this, object)) return true;
        if (this !== Writable3) return false;
        return object && object._writableState instanceof WritableState2;
      }
    });
  } else {
    realHasInstance = function(object) {
      return object instanceof this;
    };
  }
  function Writable3(options) {
    Duplex2 = Duplex2 || require_stream_duplex$1();
    if (!realHasInstance.call(Writable3, this) && !(this instanceof Duplex2)) {
      return new Writable3(options);
    }
    this._writableState = new WritableState2(options, this);
    this.writable = true;
    if (options) {
      if (typeof options.write === "function") this._write = options.write;
      if (typeof options.writev === "function") this._writev = options.writev;
      if (typeof options.destroy === "function") this._destroy = options.destroy;
      if (typeof options.final === "function") this._final = options.final;
    }
    Stream2.call(this);
  }
  Writable3.prototype.pipe = function() {
    this.emit("error", new Error("Cannot pipe, not readable"));
  };
  function writeAfterEnd(stream2, cb) {
    var er = new Error("write after end");
    stream2.emit("error", er);
    pna.nextTick(cb, er);
  }
  function validChunk(stream2, state2, chunk, cb) {
    var valid = true;
    var er = false;
    if (chunk === null) {
      er = new TypeError("May not write null values to stream");
    } else if (typeof chunk !== "string" && chunk !== void 0 && !state2.objectMode) {
      er = new TypeError("Invalid non-string/buffer chunk");
    }
    if (er) {
      stream2.emit("error", er);
      pna.nextTick(cb, er);
      valid = false;
    }
    return valid;
  }
  Writable3.prototype.write = function(chunk, encoding, cb) {
    var state2 = this._writableState;
    var ret = false;
    var isBuf = !state2.objectMode && _isUint8Array(chunk);
    if (isBuf && !Buffer2.isBuffer(chunk)) {
      chunk = _uint8ArrayToBuffer(chunk);
    }
    if (typeof encoding === "function") {
      cb = encoding;
      encoding = null;
    }
    if (isBuf) encoding = "buffer";
    else if (!encoding) encoding = state2.defaultEncoding;
    if (typeof cb !== "function") cb = nop;
    if (state2.ended) writeAfterEnd(this, cb);
    else if (isBuf || validChunk(this, state2, chunk, cb)) {
      state2.pendingcb++;
      ret = writeOrBuffer(this, state2, isBuf, chunk, encoding, cb);
    }
    return ret;
  };
  Writable3.prototype.cork = function() {
    var state2 = this._writableState;
    state2.corked++;
  };
  Writable3.prototype.uncork = function() {
    var state2 = this._writableState;
    if (state2.corked) {
      state2.corked--;
      if (!state2.writing && !state2.corked && !state2.bufferProcessing && state2.bufferedRequest) clearBuffer(this, state2);
    }
  };
  Writable3.prototype.setDefaultEncoding = function setDefaultEncoding(encoding) {
    if (typeof encoding === "string") encoding = encoding.toLowerCase();
    if (!(["hex", "utf8", "utf-8", "ascii", "binary", "base64", "ucs2", "ucs-2", "utf16le", "utf-16le", "raw"].indexOf((encoding + "").toLowerCase()) > -1)) throw new TypeError("Unknown encoding: " + encoding);
    this._writableState.defaultEncoding = encoding;
    return this;
  };
  function decodeChunk(state2, chunk, encoding) {
    if (!state2.objectMode && state2.decodeStrings !== false && typeof chunk === "string") {
      chunk = Buffer2.from(chunk, encoding);
    }
    return chunk;
  }
  Object.defineProperty(Writable3.prototype, "writableHighWaterMark", {
    // making it explicit this property is not enumerable
    // because otherwise some prototype manipulation in
    // userland will fail
    enumerable: false,
    get: function() {
      return this._writableState.highWaterMark;
    }
  });
  function writeOrBuffer(stream2, state2, isBuf, chunk, encoding, cb) {
    if (!isBuf) {
      var newChunk = decodeChunk(state2, chunk, encoding);
      if (chunk !== newChunk) {
        isBuf = true;
        encoding = "buffer";
        chunk = newChunk;
      }
    }
    var len = state2.objectMode ? 1 : chunk.length;
    state2.length += len;
    var ret = state2.length < state2.highWaterMark;
    if (!ret) state2.needDrain = true;
    if (state2.writing || state2.corked) {
      var last = state2.lastBufferedRequest;
      state2.lastBufferedRequest = {
        chunk,
        encoding,
        isBuf,
        callback: cb,
        next: null
      };
      if (last) {
        last.next = state2.lastBufferedRequest;
      } else {
        state2.bufferedRequest = state2.lastBufferedRequest;
      }
      state2.bufferedRequestCount += 1;
    } else {
      doWrite(stream2, state2, false, len, chunk, encoding, cb);
    }
    return ret;
  }
  function doWrite(stream2, state2, writev, len, chunk, encoding, cb) {
    state2.writelen = len;
    state2.writecb = cb;
    state2.writing = true;
    state2.sync = true;
    if (writev) stream2._writev(chunk, state2.onwrite);
    else stream2._write(chunk, encoding, state2.onwrite);
    state2.sync = false;
  }
  function onwriteError(stream2, state2, sync2, er, cb) {
    --state2.pendingcb;
    if (sync2) {
      pna.nextTick(cb, er);
      pna.nextTick(finishMaybe, stream2, state2);
      stream2._writableState.errorEmitted = true;
      stream2.emit("error", er);
    } else {
      cb(er);
      stream2._writableState.errorEmitted = true;
      stream2.emit("error", er);
      finishMaybe(stream2, state2);
    }
  }
  function onwriteStateUpdate(state2) {
    state2.writing = false;
    state2.writecb = null;
    state2.length -= state2.writelen;
    state2.writelen = 0;
  }
  function onwrite(stream2, er) {
    var state2 = stream2._writableState;
    var sync2 = state2.sync;
    var cb = state2.writecb;
    onwriteStateUpdate(state2);
    if (er) onwriteError(stream2, state2, sync2, er, cb);
    else {
      var finished = needFinish(state2);
      if (!finished && !state2.corked && !state2.bufferProcessing && state2.bufferedRequest) {
        clearBuffer(stream2, state2);
      }
      if (sync2) {
        asyncWrite(afterWrite2, stream2, state2, finished, cb);
      } else {
        afterWrite2(stream2, state2, finished, cb);
      }
    }
  }
  function afterWrite2(stream2, state2, finished, cb) {
    if (!finished) onwriteDrain(stream2, state2);
    state2.pendingcb--;
    cb();
    finishMaybe(stream2, state2);
  }
  function onwriteDrain(stream2, state2) {
    if (state2.length === 0 && state2.needDrain) {
      state2.needDrain = false;
      stream2.emit("drain");
    }
  }
  function clearBuffer(stream2, state2) {
    state2.bufferProcessing = true;
    var entry = state2.bufferedRequest;
    if (stream2._writev && entry && entry.next) {
      var l = state2.bufferedRequestCount;
      var buffer = new Array(l);
      var holder = state2.corkedRequestsFree;
      holder.entry = entry;
      var count = 0;
      var allBuffers = true;
      while (entry) {
        buffer[count] = entry;
        if (!entry.isBuf) allBuffers = false;
        entry = entry.next;
        count += 1;
      }
      buffer.allBuffers = allBuffers;
      doWrite(stream2, state2, true, state2.length, buffer, "", holder.finish);
      state2.pendingcb++;
      state2.lastBufferedRequest = null;
      if (holder.next) {
        state2.corkedRequestsFree = holder.next;
        holder.next = null;
      } else {
        state2.corkedRequestsFree = new CorkedRequest(state2);
      }
      state2.bufferedRequestCount = 0;
    } else {
      while (entry) {
        var chunk = entry.chunk;
        var encoding = entry.encoding;
        var cb = entry.callback;
        var len = state2.objectMode ? 1 : chunk.length;
        doWrite(stream2, state2, false, len, chunk, encoding, cb);
        entry = entry.next;
        state2.bufferedRequestCount--;
        if (state2.writing) {
          break;
        }
      }
      if (entry === null) state2.lastBufferedRequest = null;
    }
    state2.bufferedRequest = entry;
    state2.bufferProcessing = false;
  }
  Writable3.prototype._write = function(chunk, encoding, cb) {
    cb(new Error("_write() is not implemented"));
  };
  Writable3.prototype._writev = null;
  Writable3.prototype.end = function(chunk, encoding, cb) {
    var state2 = this._writableState;
    if (typeof chunk === "function") {
      cb = chunk;
      chunk = null;
      encoding = null;
    } else if (typeof encoding === "function") {
      cb = encoding;
      encoding = null;
    }
    if (chunk !== null && chunk !== void 0) this.write(chunk, encoding);
    if (state2.corked) {
      state2.corked = 1;
      this.uncork();
    }
    if (!state2.ending) endWritable(this, state2, cb);
  };
  function needFinish(state2) {
    return state2.ending && state2.length === 0 && state2.bufferedRequest === null && !state2.finished && !state2.writing;
  }
  function callFinal(stream2, state2) {
    stream2._final(function(err) {
      state2.pendingcb--;
      if (err) {
        stream2.emit("error", err);
      }
      state2.prefinished = true;
      stream2.emit("prefinish");
      finishMaybe(stream2, state2);
    });
  }
  function prefinish(stream2, state2) {
    if (!state2.prefinished && !state2.finalCalled) {
      if (typeof stream2._final === "function") {
        state2.pendingcb++;
        state2.finalCalled = true;
        pna.nextTick(callFinal, stream2, state2);
      } else {
        state2.prefinished = true;
        stream2.emit("prefinish");
      }
    }
  }
  function finishMaybe(stream2, state2) {
    var need = needFinish(state2);
    if (need) {
      prefinish(stream2, state2);
      if (state2.pendingcb === 0) {
        state2.finished = true;
        stream2.emit("finish");
      }
    }
    return need;
  }
  function endWritable(stream2, state2, cb) {
    state2.ending = true;
    finishMaybe(stream2, state2);
    if (cb) {
      if (state2.finished) pna.nextTick(cb);
      else stream2.once("finish", cb);
    }
    state2.ended = true;
    stream2.writable = false;
  }
  function onCorkedFinish(corkReq, state2, err) {
    var entry = corkReq.entry;
    corkReq.entry = null;
    while (entry) {
      var cb = entry.callback;
      state2.pendingcb--;
      cb(err);
      entry = entry.next;
    }
    state2.corkedRequestsFree.next = corkReq;
  }
  Object.defineProperty(Writable3.prototype, "destroyed", {
    get: function() {
      if (this._writableState === void 0) {
        return false;
      }
      return this._writableState.destroyed;
    },
    set: function(value) {
      if (!this._writableState) {
        return;
      }
      this._writableState.destroyed = value;
    }
  });
  Writable3.prototype.destroy = destroyImpl.destroy;
  Writable3.prototype._undestroy = destroyImpl.undestroy;
  Writable3.prototype._destroy = function(err, cb) {
    this.end();
    cb(err);
  };
  return _stream_writable$1;
}
var _stream_duplex$1;
var hasRequired_stream_duplex$1;
function require_stream_duplex$1() {
  if (hasRequired_stream_duplex$1) return _stream_duplex$1;
  hasRequired_stream_duplex$1 = 1;
  var pna = requireProcessNextickArgs();
  var objectKeys = Object.keys || function(obj) {
    var keys2 = [];
    for (var key in obj) {
      keys2.push(key);
    }
    return keys2;
  };
  _stream_duplex$1 = Duplex2;
  var util2 = Object.create(requireUtil());
  util2.inherits = inheritsExports;
  var Readable3 = require_stream_readable$1();
  var Writable3 = require_stream_writable$1();
  util2.inherits(Duplex2, Readable3);
  {
    var keys = objectKeys(Writable3.prototype);
    for (var v = 0; v < keys.length; v++) {
      var method = keys[v];
      if (!Duplex2.prototype[method]) Duplex2.prototype[method] = Writable3.prototype[method];
    }
  }
  function Duplex2(options) {
    if (!(this instanceof Duplex2)) return new Duplex2(options);
    Readable3.call(this, options);
    Writable3.call(this, options);
    if (options && options.readable === false) this.readable = false;
    if (options && options.writable === false) this.writable = false;
    this.allowHalfOpen = true;
    if (options && options.allowHalfOpen === false) this.allowHalfOpen = false;
    this.once("end", onend);
  }
  Object.defineProperty(Duplex2.prototype, "writableHighWaterMark", {
    // making it explicit this property is not enumerable
    // because otherwise some prototype manipulation in
    // userland will fail
    enumerable: false,
    get: function() {
      return this._writableState.highWaterMark;
    }
  });
  function onend() {
    if (this.allowHalfOpen || this._writableState.ended) return;
    pna.nextTick(onEndNT, this);
  }
  function onEndNT(self2) {
    self2.end();
  }
  Object.defineProperty(Duplex2.prototype, "destroyed", {
    get: function() {
      if (this._readableState === void 0 || this._writableState === void 0) {
        return false;
      }
      return this._readableState.destroyed && this._writableState.destroyed;
    },
    set: function(value) {
      if (this._readableState === void 0 || this._writableState === void 0) {
        return;
      }
      this._readableState.destroyed = value;
      this._writableState.destroyed = value;
    }
  });
  Duplex2.prototype._destroy = function(err, cb) {
    this.push(null);
    this.end();
    pna.nextTick(cb, err);
  };
  return _stream_duplex$1;
}
var string_decoder$1 = {};
var hasRequiredString_decoder$1;
function requireString_decoder$1() {
  if (hasRequiredString_decoder$1) return string_decoder$1;
  hasRequiredString_decoder$1 = 1;
  var Buffer2 = requireSafeBuffer$1().Buffer;
  var isEncoding2 = Buffer2.isEncoding || function(encoding) {
    encoding = "" + encoding;
    switch (encoding && encoding.toLowerCase()) {
      case "hex":
      case "utf8":
      case "utf-8":
      case "ascii":
      case "binary":
      case "base64":
      case "ucs2":
      case "ucs-2":
      case "utf16le":
      case "utf-16le":
      case "raw":
        return true;
      default:
        return false;
    }
  };
  function _normalizeEncoding(enc) {
    if (!enc) return "utf8";
    var retried;
    while (true) {
      switch (enc) {
        case "utf8":
        case "utf-8":
          return "utf8";
        case "ucs2":
        case "ucs-2":
        case "utf16le":
        case "utf-16le":
          return "utf16le";
        case "latin1":
        case "binary":
          return "latin1";
        case "base64":
        case "ascii":
        case "hex":
          return enc;
        default:
          if (retried) return;
          enc = ("" + enc).toLowerCase();
          retried = true;
      }
    }
  }
  function normalizeEncoding2(enc) {
    var nenc = _normalizeEncoding(enc);
    if (typeof nenc !== "string" && (Buffer2.isEncoding === isEncoding2 || !isEncoding2(enc))) throw new Error("Unknown encoding: " + enc);
    return nenc || enc;
  }
  string_decoder$1.StringDecoder = StringDecoder;
  function StringDecoder(encoding) {
    this.encoding = normalizeEncoding2(encoding);
    var nb;
    switch (this.encoding) {
      case "utf16le":
        this.text = utf16Text;
        this.end = utf16End;
        nb = 4;
        break;
      case "utf8":
        this.fillLast = utf8FillLast;
        nb = 4;
        break;
      case "base64":
        this.text = base64Text;
        this.end = base64End;
        nb = 3;
        break;
      default:
        this.write = simpleWrite;
        this.end = simpleEnd;
        return;
    }
    this.lastNeed = 0;
    this.lastTotal = 0;
    this.lastChar = Buffer2.allocUnsafe(nb);
  }
  StringDecoder.prototype.write = function(buf) {
    if (buf.length === 0) return "";
    var r;
    var i;
    if (this.lastNeed) {
      r = this.fillLast(buf);
      if (r === void 0) return "";
      i = this.lastNeed;
      this.lastNeed = 0;
    } else {
      i = 0;
    }
    if (i < buf.length) return r ? r + this.text(buf, i) : this.text(buf, i);
    return r || "";
  };
  StringDecoder.prototype.end = utf8End;
  StringDecoder.prototype.text = utf8Text;
  StringDecoder.prototype.fillLast = function(buf) {
    if (this.lastNeed <= buf.length) {
      buf.copy(this.lastChar, this.lastTotal - this.lastNeed, 0, this.lastNeed);
      return this.lastChar.toString(this.encoding, 0, this.lastTotal);
    }
    buf.copy(this.lastChar, this.lastTotal - this.lastNeed, 0, buf.length);
    this.lastNeed -= buf.length;
  };
  function utf8CheckByte(byte) {
    if (byte <= 127) return 0;
    else if (byte >> 5 === 6) return 2;
    else if (byte >> 4 === 14) return 3;
    else if (byte >> 3 === 30) return 4;
    return byte >> 6 === 2 ? -1 : -2;
  }
  function utf8CheckIncomplete(self2, buf, i) {
    var j = buf.length - 1;
    if (j < i) return 0;
    var nb = utf8CheckByte(buf[j]);
    if (nb >= 0) {
      if (nb > 0) self2.lastNeed = nb - 1;
      return nb;
    }
    if (--j < i || nb === -2) return 0;
    nb = utf8CheckByte(buf[j]);
    if (nb >= 0) {
      if (nb > 0) self2.lastNeed = nb - 2;
      return nb;
    }
    if (--j < i || nb === -2) return 0;
    nb = utf8CheckByte(buf[j]);
    if (nb >= 0) {
      if (nb > 0) {
        if (nb === 2) nb = 0;
        else self2.lastNeed = nb - 3;
      }
      return nb;
    }
    return 0;
  }
  function utf8CheckExtraBytes(self2, buf, p) {
    if ((buf[0] & 192) !== 128) {
      self2.lastNeed = 0;
      return "�";
    }
    if (self2.lastNeed > 1 && buf.length > 1) {
      if ((buf[1] & 192) !== 128) {
        self2.lastNeed = 1;
        return "�";
      }
      if (self2.lastNeed > 2 && buf.length > 2) {
        if ((buf[2] & 192) !== 128) {
          self2.lastNeed = 2;
          return "�";
        }
      }
    }
  }
  function utf8FillLast(buf) {
    var p = this.lastTotal - this.lastNeed;
    var r = utf8CheckExtraBytes(this, buf);
    if (r !== void 0) return r;
    if (this.lastNeed <= buf.length) {
      buf.copy(this.lastChar, p, 0, this.lastNeed);
      return this.lastChar.toString(this.encoding, 0, this.lastTotal);
    }
    buf.copy(this.lastChar, p, 0, buf.length);
    this.lastNeed -= buf.length;
  }
  function utf8Text(buf, i) {
    var total = utf8CheckIncomplete(this, buf, i);
    if (!this.lastNeed) return buf.toString("utf8", i);
    this.lastTotal = total;
    var end = buf.length - (total - this.lastNeed);
    buf.copy(this.lastChar, 0, end);
    return buf.toString("utf8", i, end);
  }
  function utf8End(buf) {
    var r = buf && buf.length ? this.write(buf) : "";
    if (this.lastNeed) return r + "�";
    return r;
  }
  function utf16Text(buf, i) {
    if ((buf.length - i) % 2 === 0) {
      var r = buf.toString("utf16le", i);
      if (r) {
        var c = r.charCodeAt(r.length - 1);
        if (c >= 55296 && c <= 56319) {
          this.lastNeed = 2;
          this.lastTotal = 4;
          this.lastChar[0] = buf[buf.length - 2];
          this.lastChar[1] = buf[buf.length - 1];
          return r.slice(0, -1);
        }
      }
      return r;
    }
    this.lastNeed = 1;
    this.lastTotal = 2;
    this.lastChar[0] = buf[buf.length - 1];
    return buf.toString("utf16le", i, buf.length - 1);
  }
  function utf16End(buf) {
    var r = buf && buf.length ? this.write(buf) : "";
    if (this.lastNeed) {
      var end = this.lastTotal - this.lastNeed;
      return r + this.lastChar.toString("utf16le", 0, end);
    }
    return r;
  }
  function base64Text(buf, i) {
    var n = (buf.length - i) % 3;
    if (n === 0) return buf.toString("base64", i);
    this.lastNeed = 3 - n;
    this.lastTotal = 3;
    if (n === 1) {
      this.lastChar[0] = buf[buf.length - 1];
    } else {
      this.lastChar[0] = buf[buf.length - 2];
      this.lastChar[1] = buf[buf.length - 1];
    }
    return buf.toString("base64", i, buf.length - n);
  }
  function base64End(buf) {
    var r = buf && buf.length ? this.write(buf) : "";
    if (this.lastNeed) return r + this.lastChar.toString("base64", 0, 3 - this.lastNeed);
    return r;
  }
  function simpleWrite(buf) {
    return buf.toString(this.encoding);
  }
  function simpleEnd(buf) {
    return buf && buf.length ? this.write(buf) : "";
  }
  return string_decoder$1;
}
var _stream_readable$1;
var hasRequired_stream_readable$1;
function require_stream_readable$1() {
  if (hasRequired_stream_readable$1) return _stream_readable$1;
  hasRequired_stream_readable$1 = 1;
  var pna = requireProcessNextickArgs();
  _stream_readable$1 = Readable3;
  var isArray2 = requireIsarray();
  var Duplex2;
  Readable3.ReadableState = ReadableState2;
  require$$0.EventEmitter;
  var EElistenerCount = function(emitter, type) {
    return emitter.listeners(type).length;
  };
  var Stream2 = requireStream$1();
  var Buffer2 = requireSafeBuffer$1().Buffer;
  var OurUint8Array = (typeof commonjsGlobal !== "undefined" ? commonjsGlobal : typeof window !== "undefined" ? window : typeof self !== "undefined" ? self : {}).Uint8Array || function() {
  };
  function _uint8ArrayToBuffer(chunk) {
    return Buffer2.from(chunk);
  }
  function _isUint8Array(obj) {
    return Buffer2.isBuffer(obj) || obj instanceof OurUint8Array;
  }
  var util2 = Object.create(requireUtil());
  util2.inherits = inheritsExports;
  var debugUtil = require$$0$3;
  var debug2 = void 0;
  if (debugUtil && debugUtil.debuglog) {
    debug2 = debugUtil.debuglog("stream");
  } else {
    debug2 = function() {
    };
  }
  var BufferList2 = requireBufferList();
  var destroyImpl = requireDestroy$1();
  var StringDecoder;
  util2.inherits(Readable3, Stream2);
  var kProxyEvents = ["error", "close", "destroy", "pause", "resume"];
  function prependListener(emitter, event, fn) {
    if (typeof emitter.prependListener === "function") return emitter.prependListener(event, fn);
    if (!emitter._events || !emitter._events[event]) emitter.on(event, fn);
    else if (isArray2(emitter._events[event])) emitter._events[event].unshift(fn);
    else emitter._events[event] = [fn, emitter._events[event]];
  }
  function ReadableState2(options, stream2) {
    Duplex2 = Duplex2 || require_stream_duplex$1();
    options = options || {};
    var isDuplex = stream2 instanceof Duplex2;
    this.objectMode = !!options.objectMode;
    if (isDuplex) this.objectMode = this.objectMode || !!options.readableObjectMode;
    var hwm = options.highWaterMark;
    var readableHwm = options.readableHighWaterMark;
    var defaultHwm = this.objectMode ? 16 : 16 * 1024;
    if (hwm || hwm === 0) this.highWaterMark = hwm;
    else if (isDuplex && (readableHwm || readableHwm === 0)) this.highWaterMark = readableHwm;
    else this.highWaterMark = defaultHwm;
    this.highWaterMark = Math.floor(this.highWaterMark);
    this.buffer = new BufferList2();
    this.length = 0;
    this.pipes = null;
    this.pipesCount = 0;
    this.flowing = null;
    this.ended = false;
    this.endEmitted = false;
    this.reading = false;
    this.sync = true;
    this.needReadable = false;
    this.emittedReadable = false;
    this.readableListening = false;
    this.resumeScheduled = false;
    this.destroyed = false;
    this.defaultEncoding = options.defaultEncoding || "utf8";
    this.awaitDrain = 0;
    this.readingMore = false;
    this.decoder = null;
    this.encoding = null;
    if (options.encoding) {
      if (!StringDecoder) StringDecoder = requireString_decoder$1().StringDecoder;
      this.decoder = new StringDecoder(options.encoding);
      this.encoding = options.encoding;
    }
  }
  function Readable3(options) {
    Duplex2 = Duplex2 || require_stream_duplex$1();
    if (!(this instanceof Readable3)) return new Readable3(options);
    this._readableState = new ReadableState2(options, this);
    this.readable = true;
    if (options) {
      if (typeof options.read === "function") this._read = options.read;
      if (typeof options.destroy === "function") this._destroy = options.destroy;
    }
    Stream2.call(this);
  }
  Object.defineProperty(Readable3.prototype, "destroyed", {
    get: function() {
      if (this._readableState === void 0) {
        return false;
      }
      return this._readableState.destroyed;
    },
    set: function(value) {
      if (!this._readableState) {
        return;
      }
      this._readableState.destroyed = value;
    }
  });
  Readable3.prototype.destroy = destroyImpl.destroy;
  Readable3.prototype._undestroy = destroyImpl.undestroy;
  Readable3.prototype._destroy = function(err, cb) {
    this.push(null);
    cb(err);
  };
  Readable3.prototype.push = function(chunk, encoding) {
    var state2 = this._readableState;
    var skipChunkCheck;
    if (!state2.objectMode) {
      if (typeof chunk === "string") {
        encoding = encoding || state2.defaultEncoding;
        if (encoding !== state2.encoding) {
          chunk = Buffer2.from(chunk, encoding);
          encoding = "";
        }
        skipChunkCheck = true;
      }
    } else {
      skipChunkCheck = true;
    }
    return readableAddChunk(this, chunk, encoding, false, skipChunkCheck);
  };
  Readable3.prototype.unshift = function(chunk) {
    return readableAddChunk(this, chunk, null, true, false);
  };
  function readableAddChunk(stream2, chunk, encoding, addToFront, skipChunkCheck) {
    var state2 = stream2._readableState;
    if (chunk === null) {
      state2.reading = false;
      onEofChunk(stream2, state2);
    } else {
      var er;
      if (!skipChunkCheck) er = chunkInvalid(state2, chunk);
      if (er) {
        stream2.emit("error", er);
      } else if (state2.objectMode || chunk && chunk.length > 0) {
        if (typeof chunk !== "string" && !state2.objectMode && Object.getPrototypeOf(chunk) !== Buffer2.prototype) {
          chunk = _uint8ArrayToBuffer(chunk);
        }
        if (addToFront) {
          if (state2.endEmitted) stream2.emit("error", new Error("stream.unshift() after end event"));
          else addChunk(stream2, state2, chunk, true);
        } else if (state2.ended) {
          stream2.emit("error", new Error("stream.push() after EOF"));
        } else {
          state2.reading = false;
          if (state2.decoder && !encoding) {
            chunk = state2.decoder.write(chunk);
            if (state2.objectMode || chunk.length !== 0) addChunk(stream2, state2, chunk, false);
            else maybeReadMore(stream2, state2);
          } else {
            addChunk(stream2, state2, chunk, false);
          }
        }
      } else if (!addToFront) {
        state2.reading = false;
      }
    }
    return needMoreData(state2);
  }
  function addChunk(stream2, state2, chunk, addToFront) {
    if (state2.flowing && state2.length === 0 && !state2.sync) {
      stream2.emit("data", chunk);
      stream2.read(0);
    } else {
      state2.length += state2.objectMode ? 1 : chunk.length;
      if (addToFront) state2.buffer.unshift(chunk);
      else state2.buffer.push(chunk);
      if (state2.needReadable) emitReadable(stream2);
    }
    maybeReadMore(stream2, state2);
  }
  function chunkInvalid(state2, chunk) {
    var er;
    if (!_isUint8Array(chunk) && typeof chunk !== "string" && chunk !== void 0 && !state2.objectMode) {
      er = new TypeError("Invalid non-string/buffer chunk");
    }
    return er;
  }
  function needMoreData(state2) {
    return !state2.ended && (state2.needReadable || state2.length < state2.highWaterMark || state2.length === 0);
  }
  Readable3.prototype.isPaused = function() {
    return this._readableState.flowing === false;
  };
  Readable3.prototype.setEncoding = function(enc) {
    if (!StringDecoder) StringDecoder = requireString_decoder$1().StringDecoder;
    this._readableState.decoder = new StringDecoder(enc);
    this._readableState.encoding = enc;
    return this;
  };
  var MAX_HWM = 8388608;
  function computeNewHighWaterMark(n) {
    if (n >= MAX_HWM) {
      n = MAX_HWM;
    } else {
      n--;
      n |= n >>> 1;
      n |= n >>> 2;
      n |= n >>> 4;
      n |= n >>> 8;
      n |= n >>> 16;
      n++;
    }
    return n;
  }
  function howMuchToRead(n, state2) {
    if (n <= 0 || state2.length === 0 && state2.ended) return 0;
    if (state2.objectMode) return 1;
    if (n !== n) {
      if (state2.flowing && state2.length) return state2.buffer.head.data.length;
      else return state2.length;
    }
    if (n > state2.highWaterMark) state2.highWaterMark = computeNewHighWaterMark(n);
    if (n <= state2.length) return n;
    if (!state2.ended) {
      state2.needReadable = true;
      return 0;
    }
    return state2.length;
  }
  Readable3.prototype.read = function(n) {
    debug2("read", n);
    n = parseInt(n, 10);
    var state2 = this._readableState;
    var nOrig = n;
    if (n !== 0) state2.emittedReadable = false;
    if (n === 0 && state2.needReadable && (state2.length >= state2.highWaterMark || state2.ended)) {
      debug2("read: emitReadable", state2.length, state2.ended);
      if (state2.length === 0 && state2.ended) endReadable(this);
      else emitReadable(this);
      return null;
    }
    n = howMuchToRead(n, state2);
    if (n === 0 && state2.ended) {
      if (state2.length === 0) endReadable(this);
      return null;
    }
    var doRead = state2.needReadable;
    debug2("need readable", doRead);
    if (state2.length === 0 || state2.length - n < state2.highWaterMark) {
      doRead = true;
      debug2("length less than watermark", doRead);
    }
    if (state2.ended || state2.reading) {
      doRead = false;
      debug2("reading or ended", doRead);
    } else if (doRead) {
      debug2("do read");
      state2.reading = true;
      state2.sync = true;
      if (state2.length === 0) state2.needReadable = true;
      this._read(state2.highWaterMark);
      state2.sync = false;
      if (!state2.reading) n = howMuchToRead(nOrig, state2);
    }
    var ret;
    if (n > 0) ret = fromList(n, state2);
    else ret = null;
    if (ret === null) {
      state2.needReadable = true;
      n = 0;
    } else {
      state2.length -= n;
    }
    if (state2.length === 0) {
      if (!state2.ended) state2.needReadable = true;
      if (nOrig !== n && state2.ended) endReadable(this);
    }
    if (ret !== null) this.emit("data", ret);
    return ret;
  };
  function onEofChunk(stream2, state2) {
    if (state2.ended) return;
    if (state2.decoder) {
      var chunk = state2.decoder.end();
      if (chunk && chunk.length) {
        state2.buffer.push(chunk);
        state2.length += state2.objectMode ? 1 : chunk.length;
      }
    }
    state2.ended = true;
    emitReadable(stream2);
  }
  function emitReadable(stream2) {
    var state2 = stream2._readableState;
    state2.needReadable = false;
    if (!state2.emittedReadable) {
      debug2("emitReadable", state2.flowing);
      state2.emittedReadable = true;
      if (state2.sync) pna.nextTick(emitReadable_, stream2);
      else emitReadable_(stream2);
    }
  }
  function emitReadable_(stream2) {
    debug2("emit readable");
    stream2.emit("readable");
    flow(stream2);
  }
  function maybeReadMore(stream2, state2) {
    if (!state2.readingMore) {
      state2.readingMore = true;
      pna.nextTick(maybeReadMore_, stream2, state2);
    }
  }
  function maybeReadMore_(stream2, state2) {
    var len = state2.length;
    while (!state2.reading && !state2.flowing && !state2.ended && state2.length < state2.highWaterMark) {
      debug2("maybeReadMore read 0");
      stream2.read(0);
      if (len === state2.length)
        break;
      else len = state2.length;
    }
    state2.readingMore = false;
  }
  Readable3.prototype._read = function(n) {
    this.emit("error", new Error("_read() is not implemented"));
  };
  Readable3.prototype.pipe = function(dest, pipeOpts) {
    var src = this;
    var state2 = this._readableState;
    switch (state2.pipesCount) {
      case 0:
        state2.pipes = dest;
        break;
      case 1:
        state2.pipes = [state2.pipes, dest];
        break;
      default:
        state2.pipes.push(dest);
        break;
    }
    state2.pipesCount += 1;
    debug2("pipe count=%d opts=%j", state2.pipesCount, pipeOpts);
    var doEnd = (!pipeOpts || pipeOpts.end !== false) && dest !== process.stdout && dest !== process.stderr;
    var endFn = doEnd ? onend : unpipe;
    if (state2.endEmitted) pna.nextTick(endFn);
    else src.once("end", endFn);
    dest.on("unpipe", onunpipe);
    function onunpipe(readable2, unpipeInfo) {
      debug2("onunpipe");
      if (readable2 === src) {
        if (unpipeInfo && unpipeInfo.hasUnpiped === false) {
          unpipeInfo.hasUnpiped = true;
          cleanup();
        }
      }
    }
    function onend() {
      debug2("onend");
      dest.end();
    }
    var ondrain = pipeOnDrain(src);
    dest.on("drain", ondrain);
    var cleanedUp = false;
    function cleanup() {
      debug2("cleanup");
      dest.removeListener("close", onclose);
      dest.removeListener("finish", onfinish);
      dest.removeListener("drain", ondrain);
      dest.removeListener("error", onerror);
      dest.removeListener("unpipe", onunpipe);
      src.removeListener("end", onend);
      src.removeListener("end", unpipe);
      src.removeListener("data", ondata);
      cleanedUp = true;
      if (state2.awaitDrain && (!dest._writableState || dest._writableState.needDrain)) ondrain();
    }
    var increasedAwaitDrain = false;
    src.on("data", ondata);
    function ondata(chunk) {
      debug2("ondata");
      increasedAwaitDrain = false;
      var ret = dest.write(chunk);
      if (false === ret && !increasedAwaitDrain) {
        if ((state2.pipesCount === 1 && state2.pipes === dest || state2.pipesCount > 1 && indexOf2(state2.pipes, dest) !== -1) && !cleanedUp) {
          debug2("false write response, pause", state2.awaitDrain);
          state2.awaitDrain++;
          increasedAwaitDrain = true;
        }
        src.pause();
      }
    }
    function onerror(er) {
      debug2("onerror", er);
      unpipe();
      dest.removeListener("error", onerror);
      if (EElistenerCount(dest, "error") === 0) dest.emit("error", er);
    }
    prependListener(dest, "error", onerror);
    function onclose() {
      dest.removeListener("finish", onfinish);
      unpipe();
    }
    dest.once("close", onclose);
    function onfinish() {
      debug2("onfinish");
      dest.removeListener("close", onclose);
      unpipe();
    }
    dest.once("finish", onfinish);
    function unpipe() {
      debug2("unpipe");
      src.unpipe(dest);
    }
    dest.emit("pipe", src);
    if (!state2.flowing) {
      debug2("pipe resume");
      src.resume();
    }
    return dest;
  };
  function pipeOnDrain(src) {
    return function() {
      var state2 = src._readableState;
      debug2("pipeOnDrain", state2.awaitDrain);
      if (state2.awaitDrain) state2.awaitDrain--;
      if (state2.awaitDrain === 0 && EElistenerCount(src, "data")) {
        state2.flowing = true;
        flow(src);
      }
    };
  }
  Readable3.prototype.unpipe = function(dest) {
    var state2 = this._readableState;
    var unpipeInfo = { hasUnpiped: false };
    if (state2.pipesCount === 0) return this;
    if (state2.pipesCount === 1) {
      if (dest && dest !== state2.pipes) return this;
      if (!dest) dest = state2.pipes;
      state2.pipes = null;
      state2.pipesCount = 0;
      state2.flowing = false;
      if (dest) dest.emit("unpipe", this, unpipeInfo);
      return this;
    }
    if (!dest) {
      var dests = state2.pipes;
      var len = state2.pipesCount;
      state2.pipes = null;
      state2.pipesCount = 0;
      state2.flowing = false;
      for (var i = 0; i < len; i++) {
        dests[i].emit("unpipe", this, { hasUnpiped: false });
      }
      return this;
    }
    var index2 = indexOf2(state2.pipes, dest);
    if (index2 === -1) return this;
    state2.pipes.splice(index2, 1);
    state2.pipesCount -= 1;
    if (state2.pipesCount === 1) state2.pipes = state2.pipes[0];
    dest.emit("unpipe", this, unpipeInfo);
    return this;
  };
  Readable3.prototype.on = function(ev, fn) {
    var res = Stream2.prototype.on.call(this, ev, fn);
    if (ev === "data") {
      if (this._readableState.flowing !== false) this.resume();
    } else if (ev === "readable") {
      var state2 = this._readableState;
      if (!state2.endEmitted && !state2.readableListening) {
        state2.readableListening = state2.needReadable = true;
        state2.emittedReadable = false;
        if (!state2.reading) {
          pna.nextTick(nReadingNextTick, this);
        } else if (state2.length) {
          emitReadable(this);
        }
      }
    }
    return res;
  };
  Readable3.prototype.addListener = Readable3.prototype.on;
  function nReadingNextTick(self2) {
    debug2("readable nexttick read 0");
    self2.read(0);
  }
  Readable3.prototype.resume = function() {
    var state2 = this._readableState;
    if (!state2.flowing) {
      debug2("resume");
      state2.flowing = true;
      resume(this, state2);
    }
    return this;
  };
  function resume(stream2, state2) {
    if (!state2.resumeScheduled) {
      state2.resumeScheduled = true;
      pna.nextTick(resume_, stream2, state2);
    }
  }
  function resume_(stream2, state2) {
    if (!state2.reading) {
      debug2("resume read 0");
      stream2.read(0);
    }
    state2.resumeScheduled = false;
    state2.awaitDrain = 0;
    stream2.emit("resume");
    flow(stream2);
    if (state2.flowing && !state2.reading) stream2.read(0);
  }
  Readable3.prototype.pause = function() {
    debug2("call pause flowing=%j", this._readableState.flowing);
    if (false !== this._readableState.flowing) {
      debug2("pause");
      this._readableState.flowing = false;
      this.emit("pause");
    }
    return this;
  };
  function flow(stream2) {
    var state2 = stream2._readableState;
    debug2("flow", state2.flowing);
    while (state2.flowing && stream2.read() !== null) {
    }
  }
  Readable3.prototype.wrap = function(stream2) {
    var _this = this;
    var state2 = this._readableState;
    var paused = false;
    stream2.on("end", function() {
      debug2("wrapped end");
      if (state2.decoder && !state2.ended) {
        var chunk = state2.decoder.end();
        if (chunk && chunk.length) _this.push(chunk);
      }
      _this.push(null);
    });
    stream2.on("data", function(chunk) {
      debug2("wrapped data");
      if (state2.decoder) chunk = state2.decoder.write(chunk);
      if (state2.objectMode && (chunk === null || chunk === void 0)) return;
      else if (!state2.objectMode && (!chunk || !chunk.length)) return;
      var ret = _this.push(chunk);
      if (!ret) {
        paused = true;
        stream2.pause();
      }
    });
    for (var i in stream2) {
      if (this[i] === void 0 && typeof stream2[i] === "function") {
        this[i] = /* @__PURE__ */ function(method) {
          return function() {
            return stream2[method].apply(stream2, arguments);
          };
        }(i);
      }
    }
    for (var n = 0; n < kProxyEvents.length; n++) {
      stream2.on(kProxyEvents[n], this.emit.bind(this, kProxyEvents[n]));
    }
    this._read = function(n2) {
      debug2("wrapped _read", n2);
      if (paused) {
        paused = false;
        stream2.resume();
      }
    };
    return this;
  };
  Object.defineProperty(Readable3.prototype, "readableHighWaterMark", {
    // making it explicit this property is not enumerable
    // because otherwise some prototype manipulation in
    // userland will fail
    enumerable: false,
    get: function() {
      return this._readableState.highWaterMark;
    }
  });
  Readable3._fromList = fromList;
  function fromList(n, state2) {
    if (state2.length === 0) return null;
    var ret;
    if (state2.objectMode) ret = state2.buffer.shift();
    else if (!n || n >= state2.length) {
      if (state2.decoder) ret = state2.buffer.join("");
      else if (state2.buffer.length === 1) ret = state2.buffer.head.data;
      else ret = state2.buffer.concat(state2.length);
      state2.buffer.clear();
    } else {
      ret = fromListPartial(n, state2.buffer, state2.decoder);
    }
    return ret;
  }
  function fromListPartial(n, list, hasStrings) {
    var ret;
    if (n < list.head.data.length) {
      ret = list.head.data.slice(0, n);
      list.head.data = list.head.data.slice(n);
    } else if (n === list.head.data.length) {
      ret = list.shift();
    } else {
      ret = hasStrings ? copyFromBufferString(n, list) : copyFromBuffer(n, list);
    }
    return ret;
  }
  function copyFromBufferString(n, list) {
    var p = list.head;
    var c = 1;
    var ret = p.data;
    n -= ret.length;
    while (p = p.next) {
      var str = p.data;
      var nb = n > str.length ? str.length : n;
      if (nb === str.length) ret += str;
      else ret += str.slice(0, n);
      n -= nb;
      if (n === 0) {
        if (nb === str.length) {
          ++c;
          if (p.next) list.head = p.next;
          else list.head = list.tail = null;
        } else {
          list.head = p;
          p.data = str.slice(nb);
        }
        break;
      }
      ++c;
    }
    list.length -= c;
    return ret;
  }
  function copyFromBuffer(n, list) {
    var ret = Buffer2.allocUnsafe(n);
    var p = list.head;
    var c = 1;
    p.data.copy(ret);
    n -= p.data.length;
    while (p = p.next) {
      var buf = p.data;
      var nb = n > buf.length ? buf.length : n;
      buf.copy(ret, ret.length - n, 0, nb);
      n -= nb;
      if (n === 0) {
        if (nb === buf.length) {
          ++c;
          if (p.next) list.head = p.next;
          else list.head = list.tail = null;
        } else {
          list.head = p;
          p.data = buf.slice(nb);
        }
        break;
      }
      ++c;
    }
    list.length -= c;
    return ret;
  }
  function endReadable(stream2) {
    var state2 = stream2._readableState;
    if (state2.length > 0) throw new Error('"endReadable()" called on non-empty stream');
    if (!state2.endEmitted) {
      state2.ended = true;
      pna.nextTick(endReadableNT, state2, stream2);
    }
  }
  function endReadableNT(state2, stream2) {
    if (!state2.endEmitted && state2.length === 0) {
      state2.endEmitted = true;
      stream2.readable = false;
      stream2.emit("end");
    }
  }
  function indexOf2(xs, x) {
    for (var i = 0, l = xs.length; i < l; i++) {
      if (xs[i] === x) return i;
    }
    return -1;
  }
  return _stream_readable$1;
}
var _stream_transform$1;
var hasRequired_stream_transform$1;
function require_stream_transform$1() {
  if (hasRequired_stream_transform$1) return _stream_transform$1;
  hasRequired_stream_transform$1 = 1;
  _stream_transform$1 = Transform2;
  var Duplex2 = require_stream_duplex$1();
  var util2 = Object.create(requireUtil());
  util2.inherits = inheritsExports;
  util2.inherits(Transform2, Duplex2);
  function afterTransform(er, data) {
    var ts = this._transformState;
    ts.transforming = false;
    var cb = ts.writecb;
    if (!cb) {
      return this.emit("error", new Error("write callback called multiple times"));
    }
    ts.writechunk = null;
    ts.writecb = null;
    if (data != null)
      this.push(data);
    cb(er);
    var rs = this._readableState;
    rs.reading = false;
    if (rs.needReadable || rs.length < rs.highWaterMark) {
      this._read(rs.highWaterMark);
    }
  }
  function Transform2(options) {
    if (!(this instanceof Transform2)) return new Transform2(options);
    Duplex2.call(this, options);
    this._transformState = {
      afterTransform: afterTransform.bind(this),
      needTransform: false,
      transforming: false,
      writecb: null,
      writechunk: null,
      writeencoding: null
    };
    this._readableState.needReadable = true;
    this._readableState.sync = false;
    if (options) {
      if (typeof options.transform === "function") this._transform = options.transform;
      if (typeof options.flush === "function") this._flush = options.flush;
    }
    this.on("prefinish", prefinish);
  }
  function prefinish() {
    var _this = this;
    if (typeof this._flush === "function") {
      this._flush(function(er, data) {
        done(_this, er, data);
      });
    } else {
      done(this, null, null);
    }
  }
  Transform2.prototype.push = function(chunk, encoding) {
    this._transformState.needTransform = false;
    return Duplex2.prototype.push.call(this, chunk, encoding);
  };
  Transform2.prototype._transform = function(chunk, encoding, cb) {
    throw new Error("_transform() is not implemented");
  };
  Transform2.prototype._write = function(chunk, encoding, cb) {
    var ts = this._transformState;
    ts.writecb = cb;
    ts.writechunk = chunk;
    ts.writeencoding = encoding;
    if (!ts.transforming) {
      var rs = this._readableState;
      if (ts.needTransform || rs.needReadable || rs.length < rs.highWaterMark) this._read(rs.highWaterMark);
    }
  };
  Transform2.prototype._read = function(n) {
    var ts = this._transformState;
    if (ts.writechunk !== null && ts.writecb && !ts.transforming) {
      ts.transforming = true;
      this._transform(ts.writechunk, ts.writeencoding, ts.afterTransform);
    } else {
      ts.needTransform = true;
    }
  };
  Transform2.prototype._destroy = function(err, cb) {
    var _this2 = this;
    Duplex2.prototype._destroy.call(this, err, function(err2) {
      cb(err2);
      _this2.emit("close");
    });
  };
  function done(stream2, er, data) {
    if (er) return stream2.emit("error", er);
    if (data != null)
      stream2.push(data);
    if (stream2._writableState.length) throw new Error("Calling transform done when ws.length != 0");
    if (stream2._transformState.transforming) throw new Error("Calling transform done when still transforming");
    return stream2.push(null);
  }
  return _stream_transform$1;
}
var _stream_passthrough$1;
var hasRequired_stream_passthrough$1;
function require_stream_passthrough$1() {
  if (hasRequired_stream_passthrough$1) return _stream_passthrough$1;
  hasRequired_stream_passthrough$1 = 1;
  _stream_passthrough$1 = PassThrough2;
  var Transform2 = require_stream_transform$1();
  var util2 = Object.create(requireUtil());
  util2.inherits = inheritsExports;
  util2.inherits(PassThrough2, Transform2);
  function PassThrough2(options) {
    if (!(this instanceof PassThrough2)) return new PassThrough2(options);
    Transform2.call(this, options);
  }
  PassThrough2.prototype._transform = function(chunk, encoding, cb) {
    cb(null, chunk);
  };
  return _stream_passthrough$1;
}
(function(module2, exports) {
  var Stream2 = require$$0$2;
  if (process.env.READABLE_STREAM === "disable" && Stream2) {
    module2.exports = Stream2;
    exports = module2.exports = Stream2.Readable;
    exports.Readable = Stream2.Readable;
    exports.Writable = Stream2.Writable;
    exports.Duplex = Stream2.Duplex;
    exports.Transform = Stream2.Transform;
    exports.PassThrough = Stream2.PassThrough;
    exports.Stream = Stream2;
  } else {
    exports = module2.exports = require_stream_readable$1();
    exports.Stream = Stream2 || exports;
    exports.Readable = exports;
    exports.Writable = require_stream_writable$1();
    exports.Duplex = require_stream_duplex$1();
    exports.Transform = require_stream_transform$1();
    exports.PassThrough = require_stream_passthrough$1();
  }
})(readable$1, readable$1.exports);
var readableExports$1 = readable$1.exports;
var passthrough = readableExports$1.PassThrough;
var util$a = require$$0$3;
var PassThrough$2 = passthrough;
var lazystream$1 = {
  Readable: Readable$3
};
util$a.inherits(Readable$3, PassThrough$2);
util$a.inherits(Writable$3, PassThrough$2);
function beforeFirstCall(instance, method, callback) {
  instance[method] = function() {
    delete instance[method];
    callback.apply(this, arguments);
    return this[method].apply(this, arguments);
  };
}
function Readable$3(fn, options) {
  if (!(this instanceof Readable$3))
    return new Readable$3(fn, options);
  PassThrough$2.call(this, options);
  beforeFirstCall(this, "_read", function() {
    var source = fn.call(this, options);
    var emit = this.emit.bind(this, "error");
    source.on("error", emit);
    source.pipe(this);
  });
  this.emit("readable");
}
function Writable$3(fn, options) {
  if (!(this instanceof Writable$3))
    return new Writable$3(fn, options);
  PassThrough$2.call(this, options);
  beforeFirstCall(this, "_write", function() {
    var destination = fn.call(this, options);
    var emit = this.emit.bind(this, "error");
    destination.on("error", emit);
    this.pipe(destination);
  });
  this.emit("writable");
}
/*!
 * normalize-path <https://github.com/jonschlinkert/normalize-path>
 *
 * Copyright (c) 2014-2018, Jon Schlinkert.
 * Released under the MIT License.
 */
var normalizePath$2 = function(path2, stripTrailing) {
  if (typeof path2 !== "string") {
    throw new TypeError("expected path to be a string");
  }
  if (path2 === "\\" || path2 === "/") return "/";
  var len = path2.length;
  if (len <= 1) return path2;
  var prefix = "";
  if (len > 4 && path2[3] === "\\") {
    var ch = path2[2];
    if ((ch === "?" || ch === ".") && path2.slice(0, 2) === "\\\\") {
      path2 = path2.slice(2);
      prefix = "//";
    }
  }
  var segs = path2.split(/[/\\]+/);
  if (stripTrailing !== false && segs[segs.length - 1] === "") {
    segs.pop();
  }
  return prefix + segs.join("/");
};
function identity$2(value) {
  return value;
}
var identity_1 = identity$2;
function apply$1(func, thisArg, args) {
  switch (args.length) {
    case 0:
      return func.call(thisArg);
    case 1:
      return func.call(thisArg, args[0]);
    case 2:
      return func.call(thisArg, args[0], args[1]);
    case 3:
      return func.call(thisArg, args[0], args[1], args[2]);
  }
  return func.apply(thisArg, args);
}
var _apply = apply$1;
var apply = _apply;
var nativeMax = Math.max;
function overRest$1(func, start, transform2) {
  start = nativeMax(start === void 0 ? func.length - 1 : start, 0);
  return function() {
    var args = arguments, index2 = -1, length = nativeMax(args.length - start, 0), array = Array(length);
    while (++index2 < length) {
      array[index2] = args[start + index2];
    }
    index2 = -1;
    var otherArgs = Array(start + 1);
    while (++index2 < start) {
      otherArgs[index2] = args[index2];
    }
    otherArgs[start] = transform2(array);
    return apply(func, this, otherArgs);
  };
}
var _overRest = overRest$1;
function constant$1(value) {
  return function() {
    return value;
  };
}
var constant_1 = constant$1;
var freeGlobal$1 = typeof commonjsGlobal == "object" && commonjsGlobal && commonjsGlobal.Object === Object && commonjsGlobal;
var _freeGlobal = freeGlobal$1;
var freeGlobal = _freeGlobal;
var freeSelf = typeof self == "object" && self && self.Object === Object && self;
var root$4 = freeGlobal || freeSelf || Function("return this")();
var _root = root$4;
var root$3 = _root;
var Symbol$4 = root$3.Symbol;
var _Symbol = Symbol$4;
var Symbol$3 = _Symbol;
var objectProto$a = Object.prototype;
var hasOwnProperty$8 = objectProto$a.hasOwnProperty;
var nativeObjectToString$1 = objectProto$a.toString;
var symToStringTag$1 = Symbol$3 ? Symbol$3.toStringTag : void 0;
function getRawTag$1(value) {
  var isOwn = hasOwnProperty$8.call(value, symToStringTag$1), tag = value[symToStringTag$1];
  try {
    value[symToStringTag$1] = void 0;
    var unmasked = true;
  } catch (e) {
  }
  var result = nativeObjectToString$1.call(value);
  if (unmasked) {
    if (isOwn) {
      value[symToStringTag$1] = tag;
    } else {
      delete value[symToStringTag$1];
    }
  }
  return result;
}
var _getRawTag = getRawTag$1;
var objectProto$9 = Object.prototype;
var nativeObjectToString = objectProto$9.toString;
function objectToString$1(value) {
  return nativeObjectToString.call(value);
}
var _objectToString = objectToString$1;
var Symbol$2 = _Symbol, getRawTag = _getRawTag, objectToString = _objectToString;
var nullTag = "[object Null]", undefinedTag = "[object Undefined]";
var symToStringTag = Symbol$2 ? Symbol$2.toStringTag : void 0;
function baseGetTag$4(value) {
  if (value == null) {
    return value === void 0 ? undefinedTag : nullTag;
  }
  return symToStringTag && symToStringTag in Object(value) ? getRawTag(value) : objectToString(value);
}
var _baseGetTag = baseGetTag$4;
function isObject$4(value) {
  var type = typeof value;
  return value != null && (type == "object" || type == "function");
}
var isObject_1 = isObject$4;
var baseGetTag$3 = _baseGetTag, isObject$3 = isObject_1;
var asyncTag = "[object AsyncFunction]", funcTag$1 = "[object Function]", genTag = "[object GeneratorFunction]", proxyTag = "[object Proxy]";
function isFunction$2(value) {
  if (!isObject$3(value)) {
    return false;
  }
  var tag = baseGetTag$3(value);
  return tag == funcTag$1 || tag == genTag || tag == asyncTag || tag == proxyTag;
}
var isFunction_1 = isFunction$2;
var root$2 = _root;
var coreJsData$1 = root$2["__core-js_shared__"];
var _coreJsData = coreJsData$1;
var coreJsData = _coreJsData;
var maskSrcKey = function() {
  var uid = /[^.]+$/.exec(coreJsData && coreJsData.keys && coreJsData.keys.IE_PROTO || "");
  return uid ? "Symbol(src)_1." + uid : "";
}();
function isMasked$1(func) {
  return !!maskSrcKey && maskSrcKey in func;
}
var _isMasked = isMasked$1;
var funcProto$2 = Function.prototype;
var funcToString$2 = funcProto$2.toString;
function toSource$1(func) {
  if (func != null) {
    try {
      return funcToString$2.call(func);
    } catch (e) {
    }
    try {
      return func + "";
    } catch (e) {
    }
  }
  return "";
}
var _toSource = toSource$1;
var isFunction$1 = isFunction_1, isMasked = _isMasked, isObject$2 = isObject_1, toSource = _toSource;
var reRegExpChar = /[\\^$.*+?()[\]{}|]/g;
var reIsHostCtor = /^\[object .+?Constructor\]$/;
var funcProto$1 = Function.prototype, objectProto$8 = Object.prototype;
var funcToString$1 = funcProto$1.toString;
var hasOwnProperty$7 = objectProto$8.hasOwnProperty;
var reIsNative = RegExp(
  "^" + funcToString$1.call(hasOwnProperty$7).replace(reRegExpChar, "\\$&").replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, "$1.*?") + "$"
);
function baseIsNative$1(value) {
  if (!isObject$2(value) || isMasked(value)) {
    return false;
  }
  var pattern = isFunction$1(value) ? reIsNative : reIsHostCtor;
  return pattern.test(toSource(value));
}
var _baseIsNative = baseIsNative$1;
function getValue$1(object, key) {
  return object == null ? void 0 : object[key];
}
var _getValue = getValue$1;
var baseIsNative = _baseIsNative, getValue = _getValue;
function getNative$4(object, key) {
  var value = getValue(object, key);
  return baseIsNative(value) ? value : void 0;
}
var _getNative = getNative$4;
var getNative$3 = _getNative;
var defineProperty$1 = function() {
  try {
    var func = getNative$3(Object, "defineProperty");
    func({}, "", {});
    return func;
  } catch (e) {
  }
}();
var _defineProperty = defineProperty$1;
var constant = constant_1, defineProperty = _defineProperty, identity$1 = identity_1;
var baseSetToString$1 = !defineProperty ? identity$1 : function(func, string) {
  return defineProperty(func, "toString", {
    "configurable": true,
    "enumerable": false,
    "value": constant(string),
    "writable": true
  });
};
var _baseSetToString = baseSetToString$1;
var HOT_COUNT = 800, HOT_SPAN = 16;
var nativeNow = Date.now;
function shortOut$1(func) {
  var count = 0, lastCalled = 0;
  return function() {
    var stamp = nativeNow(), remaining = HOT_SPAN - (stamp - lastCalled);
    lastCalled = stamp;
    if (remaining > 0) {
      if (++count >= HOT_COUNT) {
        return arguments[0];
      }
    } else {
      count = 0;
    }
    return func.apply(void 0, arguments);
  };
}
var _shortOut = shortOut$1;
var baseSetToString = _baseSetToString, shortOut = _shortOut;
var setToString$1 = shortOut(baseSetToString);
var _setToString = setToString$1;
var identity = identity_1, overRest = _overRest, setToString = _setToString;
function baseRest$3(func, start) {
  return setToString(overRest(func, start, identity), func + "");
}
var _baseRest = baseRest$3;
function eq$3(value, other) {
  return value === other || value !== value && other !== other;
}
var eq_1 = eq$3;
var MAX_SAFE_INTEGER$1 = 9007199254740991;
function isLength$2(value) {
  return typeof value == "number" && value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER$1;
}
var isLength_1 = isLength$2;
var isFunction = isFunction_1, isLength$1 = isLength_1;
function isArrayLike$3(value) {
  return value != null && isLength$1(value.length) && !isFunction(value);
}
var isArrayLike_1 = isArrayLike$3;
var MAX_SAFE_INTEGER = 9007199254740991;
var reIsUint = /^(?:0|[1-9]\d*)$/;
function isIndex$2(value, length) {
  var type = typeof value;
  length = length == null ? MAX_SAFE_INTEGER : length;
  return !!length && (type == "number" || type != "symbol" && reIsUint.test(value)) && (value > -1 && value % 1 == 0 && value < length);
}
var _isIndex = isIndex$2;
var eq$2 = eq_1, isArrayLike$2 = isArrayLike_1, isIndex$1 = _isIndex, isObject$1 = isObject_1;
function isIterateeCall$1(value, index2, object) {
  if (!isObject$1(object)) {
    return false;
  }
  var type = typeof index2;
  if (type == "number" ? isArrayLike$2(object) && isIndex$1(index2, object.length) : type == "string" && index2 in object) {
    return eq$2(object[index2], value);
  }
  return false;
}
var _isIterateeCall = isIterateeCall$1;
function baseTimes$1(n, iteratee) {
  var index2 = -1, result = Array(n);
  while (++index2 < n) {
    result[index2] = iteratee(index2);
  }
  return result;
}
var _baseTimes = baseTimes$1;
function isObjectLike$5(value) {
  return value != null && typeof value == "object";
}
var isObjectLike_1 = isObjectLike$5;
var baseGetTag$2 = _baseGetTag, isObjectLike$4 = isObjectLike_1;
var argsTag$1 = "[object Arguments]";
function baseIsArguments$1(value) {
  return isObjectLike$4(value) && baseGetTag$2(value) == argsTag$1;
}
var _baseIsArguments = baseIsArguments$1;
var baseIsArguments = _baseIsArguments, isObjectLike$3 = isObjectLike_1;
var objectProto$7 = Object.prototype;
var hasOwnProperty$6 = objectProto$7.hasOwnProperty;
var propertyIsEnumerable = objectProto$7.propertyIsEnumerable;
var isArguments$2 = baseIsArguments(/* @__PURE__ */ function() {
  return arguments;
}()) ? baseIsArguments : function(value) {
  return isObjectLike$3(value) && hasOwnProperty$6.call(value, "callee") && !propertyIsEnumerable.call(value, "callee");
};
var isArguments_1 = isArguments$2;
var isArray$2 = Array.isArray;
var isArray_1 = isArray$2;
var isBuffer$2 = { exports: {} };
function stubFalse() {
  return false;
}
var stubFalse_1 = stubFalse;
isBuffer$2.exports;
(function(module2, exports) {
  var root2 = _root, stubFalse2 = stubFalse_1;
  var freeExports = exports && !exports.nodeType && exports;
  var freeModule = freeExports && true && module2 && !module2.nodeType && module2;
  var moduleExports = freeModule && freeModule.exports === freeExports;
  var Buffer2 = moduleExports ? root2.Buffer : void 0;
  var nativeIsBuffer = Buffer2 ? Buffer2.isBuffer : void 0;
  var isBuffer2 = nativeIsBuffer || stubFalse2;
  module2.exports = isBuffer2;
})(isBuffer$2, isBuffer$2.exports);
var isBufferExports = isBuffer$2.exports;
var baseGetTag$1 = _baseGetTag, isLength = isLength_1, isObjectLike$2 = isObjectLike_1;
var argsTag = "[object Arguments]", arrayTag = "[object Array]", boolTag = "[object Boolean]", dateTag = "[object Date]", errorTag = "[object Error]", funcTag = "[object Function]", mapTag = "[object Map]", numberTag = "[object Number]", objectTag$1 = "[object Object]", regexpTag = "[object RegExp]", setTag = "[object Set]", stringTag = "[object String]", weakMapTag = "[object WeakMap]";
var arrayBufferTag = "[object ArrayBuffer]", dataViewTag = "[object DataView]", float32Tag = "[object Float32Array]", float64Tag = "[object Float64Array]", int8Tag = "[object Int8Array]", int16Tag = "[object Int16Array]", int32Tag = "[object Int32Array]", uint8Tag = "[object Uint8Array]", uint8ClampedTag = "[object Uint8ClampedArray]", uint16Tag = "[object Uint16Array]", uint32Tag = "[object Uint32Array]";
var typedArrayTags = {};
typedArrayTags[float32Tag] = typedArrayTags[float64Tag] = typedArrayTags[int8Tag] = typedArrayTags[int16Tag] = typedArrayTags[int32Tag] = typedArrayTags[uint8Tag] = typedArrayTags[uint8ClampedTag] = typedArrayTags[uint16Tag] = typedArrayTags[uint32Tag] = true;
typedArrayTags[argsTag] = typedArrayTags[arrayTag] = typedArrayTags[arrayBufferTag] = typedArrayTags[boolTag] = typedArrayTags[dataViewTag] = typedArrayTags[dateTag] = typedArrayTags[errorTag] = typedArrayTags[funcTag] = typedArrayTags[mapTag] = typedArrayTags[numberTag] = typedArrayTags[objectTag$1] = typedArrayTags[regexpTag] = typedArrayTags[setTag] = typedArrayTags[stringTag] = typedArrayTags[weakMapTag] = false;
function baseIsTypedArray$1(value) {
  return isObjectLike$2(value) && isLength(value.length) && !!typedArrayTags[baseGetTag$1(value)];
}
var _baseIsTypedArray = baseIsTypedArray$1;
function baseUnary$2(func) {
  return function(value) {
    return func(value);
  };
}
var _baseUnary = baseUnary$2;
var _nodeUtil = { exports: {} };
_nodeUtil.exports;
(function(module2, exports) {
  var freeGlobal2 = _freeGlobal;
  var freeExports = exports && !exports.nodeType && exports;
  var freeModule = freeExports && true && module2 && !module2.nodeType && module2;
  var moduleExports = freeModule && freeModule.exports === freeExports;
  var freeProcess = moduleExports && freeGlobal2.process;
  var nodeUtil2 = function() {
    try {
      var types = freeModule && freeModule.require && freeModule.require("util").types;
      if (types) {
        return types;
      }
      return freeProcess && freeProcess.binding && freeProcess.binding("util");
    } catch (e) {
    }
  }();
  module2.exports = nodeUtil2;
})(_nodeUtil, _nodeUtil.exports);
var _nodeUtilExports = _nodeUtil.exports;
var baseIsTypedArray = _baseIsTypedArray, baseUnary$1 = _baseUnary, nodeUtil = _nodeUtilExports;
var nodeIsTypedArray = nodeUtil && nodeUtil.isTypedArray;
var isTypedArray$2 = nodeIsTypedArray ? baseUnary$1(nodeIsTypedArray) : baseIsTypedArray;
var isTypedArray_1 = isTypedArray$2;
var baseTimes = _baseTimes, isArguments$1 = isArguments_1, isArray$1 = isArray_1, isBuffer$1 = isBufferExports, isIndex = _isIndex, isTypedArray$1 = isTypedArray_1;
var objectProto$6 = Object.prototype;
var hasOwnProperty$5 = objectProto$6.hasOwnProperty;
function arrayLikeKeys$1(value, inherited) {
  var isArr = isArray$1(value), isArg = !isArr && isArguments$1(value), isBuff = !isArr && !isArg && isBuffer$1(value), isType = !isArr && !isArg && !isBuff && isTypedArray$1(value), skipIndexes = isArr || isArg || isBuff || isType, result = skipIndexes ? baseTimes(value.length, String) : [], length = result.length;
  for (var key in value) {
    if ((inherited || hasOwnProperty$5.call(value, key)) && !(skipIndexes && // Safari 9 has enumerable `arguments.length` in strict mode.
    (key == "length" || // Node.js 0.10 has enumerable non-index properties on buffers.
    isBuff && (key == "offset" || key == "parent") || // PhantomJS 2 has enumerable non-index properties on typed arrays.
    isType && (key == "buffer" || key == "byteLength" || key == "byteOffset") || // Skip index properties.
    isIndex(key, length)))) {
      result.push(key);
    }
  }
  return result;
}
var _arrayLikeKeys = arrayLikeKeys$1;
var objectProto$5 = Object.prototype;
function isPrototype$1(value) {
  var Ctor = value && value.constructor, proto = typeof Ctor == "function" && Ctor.prototype || objectProto$5;
  return value === proto;
}
var _isPrototype = isPrototype$1;
function nativeKeysIn$1(object) {
  var result = [];
  if (object != null) {
    for (var key in Object(object)) {
      result.push(key);
    }
  }
  return result;
}
var _nativeKeysIn = nativeKeysIn$1;
var isObject = isObject_1, isPrototype = _isPrototype, nativeKeysIn = _nativeKeysIn;
var objectProto$4 = Object.prototype;
var hasOwnProperty$4 = objectProto$4.hasOwnProperty;
function baseKeysIn$1(object) {
  if (!isObject(object)) {
    return nativeKeysIn(object);
  }
  var isProto = isPrototype(object), result = [];
  for (var key in object) {
    if (!(key == "constructor" && (isProto || !hasOwnProperty$4.call(object, key)))) {
      result.push(key);
    }
  }
  return result;
}
var _baseKeysIn = baseKeysIn$1;
var arrayLikeKeys = _arrayLikeKeys, baseKeysIn = _baseKeysIn, isArrayLike$1 = isArrayLike_1;
function keysIn$1(object) {
  return isArrayLike$1(object) ? arrayLikeKeys(object, true) : baseKeysIn(object);
}
var keysIn_1 = keysIn$1;
var baseRest$2 = _baseRest, eq$1 = eq_1, isIterateeCall = _isIterateeCall, keysIn = keysIn_1;
var objectProto$3 = Object.prototype;
var hasOwnProperty$3 = objectProto$3.hasOwnProperty;
var defaults$1 = baseRest$2(function(object, sources) {
  object = Object(object);
  var index2 = -1;
  var length = sources.length;
  var guard = length > 2 ? sources[2] : void 0;
  if (guard && isIterateeCall(sources[0], sources[1], guard)) {
    length = 1;
  }
  while (++index2 < length) {
    var source = sources[index2];
    var props = keysIn(source);
    var propsIndex = -1;
    var propsLength = props.length;
    while (++propsIndex < propsLength) {
      var key = props[propsIndex];
      var value = object[key];
      if (value === void 0 || eq$1(value, objectProto$3[key]) && !hasOwnProperty$3.call(object, key)) {
        object[key] = source[key];
      }
    }
  }
  return object;
});
var defaults_1 = defaults$1;
var readable = { exports: {} };
var stream;
var hasRequiredStream;
function requireStream() {
  if (hasRequiredStream) return stream;
  hasRequiredStream = 1;
  stream = require$$0$2;
  return stream;
}
var buffer_list;
var hasRequiredBuffer_list;
function requireBuffer_list() {
  if (hasRequiredBuffer_list) return buffer_list;
  hasRequiredBuffer_list = 1;
  function ownKeys(object, enumerableOnly) {
    var keys = Object.keys(object);
    if (Object.getOwnPropertySymbols) {
      var symbols = Object.getOwnPropertySymbols(object);
      enumerableOnly && (symbols = symbols.filter(function(sym) {
        return Object.getOwnPropertyDescriptor(object, sym).enumerable;
      })), keys.push.apply(keys, symbols);
    }
    return keys;
  }
  function _objectSpread(target) {
    for (var i = 1; i < arguments.length; i++) {
      var source = null != arguments[i] ? arguments[i] : {};
      i % 2 ? ownKeys(Object(source), true).forEach(function(key) {
        _defineProperty2(target, key, source[key]);
      }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function(key) {
        Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
      });
    }
    return target;
  }
  function _defineProperty2(obj, key, value) {
    key = _toPropertyKey(key);
    if (key in obj) {
      Object.defineProperty(obj, key, { value, enumerable: true, configurable: true, writable: true });
    } else {
      obj[key] = value;
    }
    return obj;
  }
  function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }
  function _defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, _toPropertyKey(descriptor.key), descriptor);
    }
  }
  function _createClass(Constructor, protoProps, staticProps) {
    if (protoProps) _defineProperties(Constructor.prototype, protoProps);
    Object.defineProperty(Constructor, "prototype", { writable: false });
    return Constructor;
  }
  function _toPropertyKey(arg) {
    var key = _toPrimitive(arg, "string");
    return typeof key === "symbol" ? key : String(key);
  }
  function _toPrimitive(input, hint) {
    if (typeof input !== "object" || input === null) return input;
    var prim = input[Symbol.toPrimitive];
    if (prim !== void 0) {
      var res = prim.call(input, hint);
      if (typeof res !== "object") return res;
      throw new TypeError("@@toPrimitive must return a primitive value.");
    }
    return String(input);
  }
  var _require = require$$0$4, Buffer2 = _require.Buffer;
  var _require2 = require$$0$3, inspect = _require2.inspect;
  var custom = inspect && inspect.custom || "inspect";
  function copyBuffer(src, target, offset) {
    Buffer2.prototype.copy.call(src, target, offset);
  }
  buffer_list = /* @__PURE__ */ function() {
    function BufferList2() {
      _classCallCheck(this, BufferList2);
      this.head = null;
      this.tail = null;
      this.length = 0;
    }
    _createClass(BufferList2, [{
      key: "push",
      value: function push(v) {
        var entry = {
          data: v,
          next: null
        };
        if (this.length > 0) this.tail.next = entry;
        else this.head = entry;
        this.tail = entry;
        ++this.length;
      }
    }, {
      key: "unshift",
      value: function unshift(v) {
        var entry = {
          data: v,
          next: this.head
        };
        if (this.length === 0) this.tail = entry;
        this.head = entry;
        ++this.length;
      }
    }, {
      key: "shift",
      value: function shift() {
        if (this.length === 0) return;
        var ret = this.head.data;
        if (this.length === 1) this.head = this.tail = null;
        else this.head = this.head.next;
        --this.length;
        return ret;
      }
    }, {
      key: "clear",
      value: function clear() {
        this.head = this.tail = null;
        this.length = 0;
      }
    }, {
      key: "join",
      value: function join(s) {
        if (this.length === 0) return "";
        var p = this.head;
        var ret = "" + p.data;
        while (p = p.next) ret += s + p.data;
        return ret;
      }
    }, {
      key: "concat",
      value: function concat2(n) {
        if (this.length === 0) return Buffer2.alloc(0);
        var ret = Buffer2.allocUnsafe(n >>> 0);
        var p = this.head;
        var i = 0;
        while (p) {
          copyBuffer(p.data, ret, i);
          i += p.data.length;
          p = p.next;
        }
        return ret;
      }
      // Consumes a specified amount of bytes or characters from the buffered data.
    }, {
      key: "consume",
      value: function consume(n, hasStrings) {
        var ret;
        if (n < this.head.data.length) {
          ret = this.head.data.slice(0, n);
          this.head.data = this.head.data.slice(n);
        } else if (n === this.head.data.length) {
          ret = this.shift();
        } else {
          ret = hasStrings ? this._getString(n) : this._getBuffer(n);
        }
        return ret;
      }
    }, {
      key: "first",
      value: function first() {
        return this.head.data;
      }
      // Consumes a specified amount of characters from the buffered data.
    }, {
      key: "_getString",
      value: function _getString(n) {
        var p = this.head;
        var c = 1;
        var ret = p.data;
        n -= ret.length;
        while (p = p.next) {
          var str = p.data;
          var nb = n > str.length ? str.length : n;
          if (nb === str.length) ret += str;
          else ret += str.slice(0, n);
          n -= nb;
          if (n === 0) {
            if (nb === str.length) {
              ++c;
              if (p.next) this.head = p.next;
              else this.head = this.tail = null;
            } else {
              this.head = p;
              p.data = str.slice(nb);
            }
            break;
          }
          ++c;
        }
        this.length -= c;
        return ret;
      }
      // Consumes a specified amount of bytes from the buffered data.
    }, {
      key: "_getBuffer",
      value: function _getBuffer(n) {
        var ret = Buffer2.allocUnsafe(n);
        var p = this.head;
        var c = 1;
        p.data.copy(ret);
        n -= p.data.length;
        while (p = p.next) {
          var buf = p.data;
          var nb = n > buf.length ? buf.length : n;
          buf.copy(ret, ret.length - n, 0, nb);
          n -= nb;
          if (n === 0) {
            if (nb === buf.length) {
              ++c;
              if (p.next) this.head = p.next;
              else this.head = this.tail = null;
            } else {
              this.head = p;
              p.data = buf.slice(nb);
            }
            break;
          }
          ++c;
        }
        this.length -= c;
        return ret;
      }
      // Make sure the linked list only shows the minimal necessary information.
    }, {
      key: custom,
      value: function value(_2, options) {
        return inspect(this, _objectSpread(_objectSpread({}, options), {}, {
          // Only inspect one level.
          depth: 0,
          // It should not recurse.
          customInspect: false
        }));
      }
    }]);
    return BufferList2;
  }();
  return buffer_list;
}
var destroy_1;
var hasRequiredDestroy;
function requireDestroy() {
  if (hasRequiredDestroy) return destroy_1;
  hasRequiredDestroy = 1;
  function destroy(err, cb) {
    var _this = this;
    var readableDestroyed = this._readableState && this._readableState.destroyed;
    var writableDestroyed = this._writableState && this._writableState.destroyed;
    if (readableDestroyed || writableDestroyed) {
      if (cb) {
        cb(err);
      } else if (err) {
        if (!this._writableState) {
          process.nextTick(emitErrorNT, this, err);
        } else if (!this._writableState.errorEmitted) {
          this._writableState.errorEmitted = true;
          process.nextTick(emitErrorNT, this, err);
        }
      }
      return this;
    }
    if (this._readableState) {
      this._readableState.destroyed = true;
    }
    if (this._writableState) {
      this._writableState.destroyed = true;
    }
    this._destroy(err || null, function(err2) {
      if (!cb && err2) {
        if (!_this._writableState) {
          process.nextTick(emitErrorAndCloseNT, _this, err2);
        } else if (!_this._writableState.errorEmitted) {
          _this._writableState.errorEmitted = true;
          process.nextTick(emitErrorAndCloseNT, _this, err2);
        } else {
          process.nextTick(emitCloseNT, _this);
        }
      } else if (cb) {
        process.nextTick(emitCloseNT, _this);
        cb(err2);
      } else {
        process.nextTick(emitCloseNT, _this);
      }
    });
    return this;
  }
  function emitErrorAndCloseNT(self2, err) {
    emitErrorNT(self2, err);
    emitCloseNT(self2);
  }
  function emitCloseNT(self2) {
    if (self2._writableState && !self2._writableState.emitClose) return;
    if (self2._readableState && !self2._readableState.emitClose) return;
    self2.emit("close");
  }
  function undestroy() {
    if (this._readableState) {
      this._readableState.destroyed = false;
      this._readableState.reading = false;
      this._readableState.ended = false;
      this._readableState.endEmitted = false;
    }
    if (this._writableState) {
      this._writableState.destroyed = false;
      this._writableState.ended = false;
      this._writableState.ending = false;
      this._writableState.finalCalled = false;
      this._writableState.prefinished = false;
      this._writableState.finished = false;
      this._writableState.errorEmitted = false;
    }
  }
  function emitErrorNT(self2, err) {
    self2.emit("error", err);
  }
  function errorOrDestroy(stream2, err) {
    var rState = stream2._readableState;
    var wState = stream2._writableState;
    if (rState && rState.autoDestroy || wState && wState.autoDestroy) stream2.destroy(err);
    else stream2.emit("error", err);
  }
  destroy_1 = {
    destroy,
    undestroy,
    errorOrDestroy
  };
  return destroy_1;
}
var errors = {};
var hasRequiredErrors;
function requireErrors() {
  if (hasRequiredErrors) return errors;
  hasRequiredErrors = 1;
  const codes = {};
  function createErrorType(code, message, Base) {
    if (!Base) {
      Base = Error;
    }
    function getMessage(arg1, arg2, arg3) {
      if (typeof message === "string") {
        return message;
      } else {
        return message(arg1, arg2, arg3);
      }
    }
    class NodeError extends Base {
      constructor(arg1, arg2, arg3) {
        super(getMessage(arg1, arg2, arg3));
      }
    }
    NodeError.prototype.name = Base.name;
    NodeError.prototype.code = code;
    codes[code] = NodeError;
  }
  function oneOf(expected, thing) {
    if (Array.isArray(expected)) {
      const len = expected.length;
      expected = expected.map((i) => String(i));
      if (len > 2) {
        return `one of ${thing} ${expected.slice(0, len - 1).join(", ")}, or ` + expected[len - 1];
      } else if (len === 2) {
        return `one of ${thing} ${expected[0]} or ${expected[1]}`;
      } else {
        return `of ${thing} ${expected[0]}`;
      }
    } else {
      return `of ${thing} ${String(expected)}`;
    }
  }
  function startsWith(str, search, pos) {
    return str.substr(0, search.length) === search;
  }
  function endsWith(str, search, this_len) {
    if (this_len === void 0 || this_len > str.length) {
      this_len = str.length;
    }
    return str.substring(this_len - search.length, this_len) === search;
  }
  function includes2(str, search, start) {
    if (typeof start !== "number") {
      start = 0;
    }
    if (start + search.length > str.length) {
      return false;
    } else {
      return str.indexOf(search, start) !== -1;
    }
  }
  createErrorType("ERR_INVALID_OPT_VALUE", function(name, value) {
    return 'The value "' + value + '" is invalid for option "' + name + '"';
  }, TypeError);
  createErrorType("ERR_INVALID_ARG_TYPE", function(name, expected, actual) {
    let determiner;
    if (typeof expected === "string" && startsWith(expected, "not ")) {
      determiner = "must not be";
      expected = expected.replace(/^not /, "");
    } else {
      determiner = "must be";
    }
    let msg;
    if (endsWith(name, " argument")) {
      msg = `The ${name} ${determiner} ${oneOf(expected, "type")}`;
    } else {
      const type = includes2(name, ".") ? "property" : "argument";
      msg = `The "${name}" ${type} ${determiner} ${oneOf(expected, "type")}`;
    }
    msg += `. Received type ${typeof actual}`;
    return msg;
  }, TypeError);
  createErrorType("ERR_STREAM_PUSH_AFTER_EOF", "stream.push() after EOF");
  createErrorType("ERR_METHOD_NOT_IMPLEMENTED", function(name) {
    return "The " + name + " method is not implemented";
  });
  createErrorType("ERR_STREAM_PREMATURE_CLOSE", "Premature close");
  createErrorType("ERR_STREAM_DESTROYED", function(name) {
    return "Cannot call " + name + " after a stream was destroyed";
  });
  createErrorType("ERR_MULTIPLE_CALLBACK", "Callback called multiple times");
  createErrorType("ERR_STREAM_CANNOT_PIPE", "Cannot pipe, not readable");
  createErrorType("ERR_STREAM_WRITE_AFTER_END", "write after end");
  createErrorType("ERR_STREAM_NULL_VALUES", "May not write null values to stream", TypeError);
  createErrorType("ERR_UNKNOWN_ENCODING", function(arg) {
    return "Unknown encoding: " + arg;
  }, TypeError);
  createErrorType("ERR_STREAM_UNSHIFT_AFTER_END_EVENT", "stream.unshift() after end event");
  errors.codes = codes;
  return errors;
}
var state;
var hasRequiredState;
function requireState() {
  if (hasRequiredState) return state;
  hasRequiredState = 1;
  var ERR_INVALID_OPT_VALUE = requireErrors().codes.ERR_INVALID_OPT_VALUE;
  function highWaterMarkFrom(options, isDuplex, duplexKey) {
    return options.highWaterMark != null ? options.highWaterMark : isDuplex ? options[duplexKey] : null;
  }
  function getHighWaterMark(state2, options, duplexKey, isDuplex) {
    var hwm = highWaterMarkFrom(options, isDuplex, duplexKey);
    if (hwm != null) {
      if (!(isFinite(hwm) && Math.floor(hwm) === hwm) || hwm < 0) {
        var name = isDuplex ? duplexKey : "highWaterMark";
        throw new ERR_INVALID_OPT_VALUE(name, hwm);
      }
      return Math.floor(hwm);
    }
    return state2.objectMode ? 16 : 16 * 1024;
  }
  state = {
    getHighWaterMark
  };
  return state;
}
var _stream_writable;
var hasRequired_stream_writable;
function require_stream_writable() {
  if (hasRequired_stream_writable) return _stream_writable;
  hasRequired_stream_writable = 1;
  _stream_writable = Writable3;
  function CorkedRequest(state2) {
    var _this = this;
    this.next = null;
    this.entry = null;
    this.finish = function() {
      onCorkedFinish(_this, state2);
    };
  }
  var Duplex2;
  Writable3.WritableState = WritableState2;
  var internalUtil = {
    deprecate: requireNode()
  };
  var Stream2 = requireStream();
  var Buffer2 = require$$0$4.Buffer;
  var OurUint8Array = (typeof commonjsGlobal !== "undefined" ? commonjsGlobal : typeof window !== "undefined" ? window : typeof self !== "undefined" ? self : {}).Uint8Array || function() {
  };
  function _uint8ArrayToBuffer(chunk) {
    return Buffer2.from(chunk);
  }
  function _isUint8Array(obj) {
    return Buffer2.isBuffer(obj) || obj instanceof OurUint8Array;
  }
  var destroyImpl = requireDestroy();
  var _require = requireState(), getHighWaterMark = _require.getHighWaterMark;
  var _require$codes = requireErrors().codes, ERR_INVALID_ARG_TYPE = _require$codes.ERR_INVALID_ARG_TYPE, ERR_METHOD_NOT_IMPLEMENTED = _require$codes.ERR_METHOD_NOT_IMPLEMENTED, ERR_MULTIPLE_CALLBACK = _require$codes.ERR_MULTIPLE_CALLBACK, ERR_STREAM_CANNOT_PIPE = _require$codes.ERR_STREAM_CANNOT_PIPE, ERR_STREAM_DESTROYED = _require$codes.ERR_STREAM_DESTROYED, ERR_STREAM_NULL_VALUES = _require$codes.ERR_STREAM_NULL_VALUES, ERR_STREAM_WRITE_AFTER_END = _require$codes.ERR_STREAM_WRITE_AFTER_END, ERR_UNKNOWN_ENCODING = _require$codes.ERR_UNKNOWN_ENCODING;
  var errorOrDestroy = destroyImpl.errorOrDestroy;
  inheritsExports(Writable3, Stream2);
  function nop() {
  }
  function WritableState2(options, stream2, isDuplex) {
    Duplex2 = Duplex2 || require_stream_duplex();
    options = options || {};
    if (typeof isDuplex !== "boolean") isDuplex = stream2 instanceof Duplex2;
    this.objectMode = !!options.objectMode;
    if (isDuplex) this.objectMode = this.objectMode || !!options.writableObjectMode;
    this.highWaterMark = getHighWaterMark(this, options, "writableHighWaterMark", isDuplex);
    this.finalCalled = false;
    this.needDrain = false;
    this.ending = false;
    this.ended = false;
    this.finished = false;
    this.destroyed = false;
    var noDecode = options.decodeStrings === false;
    this.decodeStrings = !noDecode;
    this.defaultEncoding = options.defaultEncoding || "utf8";
    this.length = 0;
    this.writing = false;
    this.corked = 0;
    this.sync = true;
    this.bufferProcessing = false;
    this.onwrite = function(er) {
      onwrite(stream2, er);
    };
    this.writecb = null;
    this.writelen = 0;
    this.bufferedRequest = null;
    this.lastBufferedRequest = null;
    this.pendingcb = 0;
    this.prefinished = false;
    this.errorEmitted = false;
    this.emitClose = options.emitClose !== false;
    this.autoDestroy = !!options.autoDestroy;
    this.bufferedRequestCount = 0;
    this.corkedRequestsFree = new CorkedRequest(this);
  }
  WritableState2.prototype.getBuffer = function getBuffer() {
    var current = this.bufferedRequest;
    var out = [];
    while (current) {
      out.push(current);
      current = current.next;
    }
    return out;
  };
  (function() {
    try {
      Object.defineProperty(WritableState2.prototype, "buffer", {
        get: internalUtil.deprecate(function writableStateBufferGetter() {
          return this.getBuffer();
        }, "_writableState.buffer is deprecated. Use _writableState.getBuffer instead.", "DEP0003")
      });
    } catch (_2) {
    }
  })();
  var realHasInstance;
  if (typeof Symbol === "function" && Symbol.hasInstance && typeof Function.prototype[Symbol.hasInstance] === "function") {
    realHasInstance = Function.prototype[Symbol.hasInstance];
    Object.defineProperty(Writable3, Symbol.hasInstance, {
      value: function value(object) {
        if (realHasInstance.call(this, object)) return true;
        if (this !== Writable3) return false;
        return object && object._writableState instanceof WritableState2;
      }
    });
  } else {
    realHasInstance = function realHasInstance2(object) {
      return object instanceof this;
    };
  }
  function Writable3(options) {
    Duplex2 = Duplex2 || require_stream_duplex();
    var isDuplex = this instanceof Duplex2;
    if (!isDuplex && !realHasInstance.call(Writable3, this)) return new Writable3(options);
    this._writableState = new WritableState2(options, this, isDuplex);
    this.writable = true;
    if (options) {
      if (typeof options.write === "function") this._write = options.write;
      if (typeof options.writev === "function") this._writev = options.writev;
      if (typeof options.destroy === "function") this._destroy = options.destroy;
      if (typeof options.final === "function") this._final = options.final;
    }
    Stream2.call(this);
  }
  Writable3.prototype.pipe = function() {
    errorOrDestroy(this, new ERR_STREAM_CANNOT_PIPE());
  };
  function writeAfterEnd(stream2, cb) {
    var er = new ERR_STREAM_WRITE_AFTER_END();
    errorOrDestroy(stream2, er);
    process.nextTick(cb, er);
  }
  function validChunk(stream2, state2, chunk, cb) {
    var er;
    if (chunk === null) {
      er = new ERR_STREAM_NULL_VALUES();
    } else if (typeof chunk !== "string" && !state2.objectMode) {
      er = new ERR_INVALID_ARG_TYPE("chunk", ["string", "Buffer"], chunk);
    }
    if (er) {
      errorOrDestroy(stream2, er);
      process.nextTick(cb, er);
      return false;
    }
    return true;
  }
  Writable3.prototype.write = function(chunk, encoding, cb) {
    var state2 = this._writableState;
    var ret = false;
    var isBuf = !state2.objectMode && _isUint8Array(chunk);
    if (isBuf && !Buffer2.isBuffer(chunk)) {
      chunk = _uint8ArrayToBuffer(chunk);
    }
    if (typeof encoding === "function") {
      cb = encoding;
      encoding = null;
    }
    if (isBuf) encoding = "buffer";
    else if (!encoding) encoding = state2.defaultEncoding;
    if (typeof cb !== "function") cb = nop;
    if (state2.ending) writeAfterEnd(this, cb);
    else if (isBuf || validChunk(this, state2, chunk, cb)) {
      state2.pendingcb++;
      ret = writeOrBuffer(this, state2, isBuf, chunk, encoding, cb);
    }
    return ret;
  };
  Writable3.prototype.cork = function() {
    this._writableState.corked++;
  };
  Writable3.prototype.uncork = function() {
    var state2 = this._writableState;
    if (state2.corked) {
      state2.corked--;
      if (!state2.writing && !state2.corked && !state2.bufferProcessing && state2.bufferedRequest) clearBuffer(this, state2);
    }
  };
  Writable3.prototype.setDefaultEncoding = function setDefaultEncoding(encoding) {
    if (typeof encoding === "string") encoding = encoding.toLowerCase();
    if (!(["hex", "utf8", "utf-8", "ascii", "binary", "base64", "ucs2", "ucs-2", "utf16le", "utf-16le", "raw"].indexOf((encoding + "").toLowerCase()) > -1)) throw new ERR_UNKNOWN_ENCODING(encoding);
    this._writableState.defaultEncoding = encoding;
    return this;
  };
  Object.defineProperty(Writable3.prototype, "writableBuffer", {
    // making it explicit this property is not enumerable
    // because otherwise some prototype manipulation in
    // userland will fail
    enumerable: false,
    get: function get() {
      return this._writableState && this._writableState.getBuffer();
    }
  });
  function decodeChunk(state2, chunk, encoding) {
    if (!state2.objectMode && state2.decodeStrings !== false && typeof chunk === "string") {
      chunk = Buffer2.from(chunk, encoding);
    }
    return chunk;
  }
  Object.defineProperty(Writable3.prototype, "writableHighWaterMark", {
    // making it explicit this property is not enumerable
    // because otherwise some prototype manipulation in
    // userland will fail
    enumerable: false,
    get: function get() {
      return this._writableState.highWaterMark;
    }
  });
  function writeOrBuffer(stream2, state2, isBuf, chunk, encoding, cb) {
    if (!isBuf) {
      var newChunk = decodeChunk(state2, chunk, encoding);
      if (chunk !== newChunk) {
        isBuf = true;
        encoding = "buffer";
        chunk = newChunk;
      }
    }
    var len = state2.objectMode ? 1 : chunk.length;
    state2.length += len;
    var ret = state2.length < state2.highWaterMark;
    if (!ret) state2.needDrain = true;
    if (state2.writing || state2.corked) {
      var last = state2.lastBufferedRequest;
      state2.lastBufferedRequest = {
        chunk,
        encoding,
        isBuf,
        callback: cb,
        next: null
      };
      if (last) {
        last.next = state2.lastBufferedRequest;
      } else {
        state2.bufferedRequest = state2.lastBufferedRequest;
      }
      state2.bufferedRequestCount += 1;
    } else {
      doWrite(stream2, state2, false, len, chunk, encoding, cb);
    }
    return ret;
  }
  function doWrite(stream2, state2, writev, len, chunk, encoding, cb) {
    state2.writelen = len;
    state2.writecb = cb;
    state2.writing = true;
    state2.sync = true;
    if (state2.destroyed) state2.onwrite(new ERR_STREAM_DESTROYED("write"));
    else if (writev) stream2._writev(chunk, state2.onwrite);
    else stream2._write(chunk, encoding, state2.onwrite);
    state2.sync = false;
  }
  function onwriteError(stream2, state2, sync2, er, cb) {
    --state2.pendingcb;
    if (sync2) {
      process.nextTick(cb, er);
      process.nextTick(finishMaybe, stream2, state2);
      stream2._writableState.errorEmitted = true;
      errorOrDestroy(stream2, er);
    } else {
      cb(er);
      stream2._writableState.errorEmitted = true;
      errorOrDestroy(stream2, er);
      finishMaybe(stream2, state2);
    }
  }
  function onwriteStateUpdate(state2) {
    state2.writing = false;
    state2.writecb = null;
    state2.length -= state2.writelen;
    state2.writelen = 0;
  }
  function onwrite(stream2, er) {
    var state2 = stream2._writableState;
    var sync2 = state2.sync;
    var cb = state2.writecb;
    if (typeof cb !== "function") throw new ERR_MULTIPLE_CALLBACK();
    onwriteStateUpdate(state2);
    if (er) onwriteError(stream2, state2, sync2, er, cb);
    else {
      var finished = needFinish(state2) || stream2.destroyed;
      if (!finished && !state2.corked && !state2.bufferProcessing && state2.bufferedRequest) {
        clearBuffer(stream2, state2);
      }
      if (sync2) {
        process.nextTick(afterWrite2, stream2, state2, finished, cb);
      } else {
        afterWrite2(stream2, state2, finished, cb);
      }
    }
  }
  function afterWrite2(stream2, state2, finished, cb) {
    if (!finished) onwriteDrain(stream2, state2);
    state2.pendingcb--;
    cb();
    finishMaybe(stream2, state2);
  }
  function onwriteDrain(stream2, state2) {
    if (state2.length === 0 && state2.needDrain) {
      state2.needDrain = false;
      stream2.emit("drain");
    }
  }
  function clearBuffer(stream2, state2) {
    state2.bufferProcessing = true;
    var entry = state2.bufferedRequest;
    if (stream2._writev && entry && entry.next) {
      var l = state2.bufferedRequestCount;
      var buffer = new Array(l);
      var holder = state2.corkedRequestsFree;
      holder.entry = entry;
      var count = 0;
      var allBuffers = true;
      while (entry) {
        buffer[count] = entry;
        if (!entry.isBuf) allBuffers = false;
        entry = entry.next;
        count += 1;
      }
      buffer.allBuffers = allBuffers;
      doWrite(stream2, state2, true, state2.length, buffer, "", holder.finish);
      state2.pendingcb++;
      state2.lastBufferedRequest = null;
      if (holder.next) {
        state2.corkedRequestsFree = holder.next;
        holder.next = null;
      } else {
        state2.corkedRequestsFree = new CorkedRequest(state2);
      }
      state2.bufferedRequestCount = 0;
    } else {
      while (entry) {
        var chunk = entry.chunk;
        var encoding = entry.encoding;
        var cb = entry.callback;
        var len = state2.objectMode ? 1 : chunk.length;
        doWrite(stream2, state2, false, len, chunk, encoding, cb);
        entry = entry.next;
        state2.bufferedRequestCount--;
        if (state2.writing) {
          break;
        }
      }
      if (entry === null) state2.lastBufferedRequest = null;
    }
    state2.bufferedRequest = entry;
    state2.bufferProcessing = false;
  }
  Writable3.prototype._write = function(chunk, encoding, cb) {
    cb(new ERR_METHOD_NOT_IMPLEMENTED("_write()"));
  };
  Writable3.prototype._writev = null;
  Writable3.prototype.end = function(chunk, encoding, cb) {
    var state2 = this._writableState;
    if (typeof chunk === "function") {
      cb = chunk;
      chunk = null;
      encoding = null;
    } else if (typeof encoding === "function") {
      cb = encoding;
      encoding = null;
    }
    if (chunk !== null && chunk !== void 0) this.write(chunk, encoding);
    if (state2.corked) {
      state2.corked = 1;
      this.uncork();
    }
    if (!state2.ending) endWritable(this, state2, cb);
    return this;
  };
  Object.defineProperty(Writable3.prototype, "writableLength", {
    // making it explicit this property is not enumerable
    // because otherwise some prototype manipulation in
    // userland will fail
    enumerable: false,
    get: function get() {
      return this._writableState.length;
    }
  });
  function needFinish(state2) {
    return state2.ending && state2.length === 0 && state2.bufferedRequest === null && !state2.finished && !state2.writing;
  }
  function callFinal(stream2, state2) {
    stream2._final(function(err) {
      state2.pendingcb--;
      if (err) {
        errorOrDestroy(stream2, err);
      }
      state2.prefinished = true;
      stream2.emit("prefinish");
      finishMaybe(stream2, state2);
    });
  }
  function prefinish(stream2, state2) {
    if (!state2.prefinished && !state2.finalCalled) {
      if (typeof stream2._final === "function" && !state2.destroyed) {
        state2.pendingcb++;
        state2.finalCalled = true;
        process.nextTick(callFinal, stream2, state2);
      } else {
        state2.prefinished = true;
        stream2.emit("prefinish");
      }
    }
  }
  function finishMaybe(stream2, state2) {
    var need = needFinish(state2);
    if (need) {
      prefinish(stream2, state2);
      if (state2.pendingcb === 0) {
        state2.finished = true;
        stream2.emit("finish");
        if (state2.autoDestroy) {
          var rState = stream2._readableState;
          if (!rState || rState.autoDestroy && rState.endEmitted) {
            stream2.destroy();
          }
        }
      }
    }
    return need;
  }
  function endWritable(stream2, state2, cb) {
    state2.ending = true;
    finishMaybe(stream2, state2);
    if (cb) {
      if (state2.finished) process.nextTick(cb);
      else stream2.once("finish", cb);
    }
    state2.ended = true;
    stream2.writable = false;
  }
  function onCorkedFinish(corkReq, state2, err) {
    var entry = corkReq.entry;
    corkReq.entry = null;
    while (entry) {
      var cb = entry.callback;
      state2.pendingcb--;
      cb(err);
      entry = entry.next;
    }
    state2.corkedRequestsFree.next = corkReq;
  }
  Object.defineProperty(Writable3.prototype, "destroyed", {
    // making it explicit this property is not enumerable
    // because otherwise some prototype manipulation in
    // userland will fail
    enumerable: false,
    get: function get() {
      if (this._writableState === void 0) {
        return false;
      }
      return this._writableState.destroyed;
    },
    set: function set(value) {
      if (!this._writableState) {
        return;
      }
      this._writableState.destroyed = value;
    }
  });
  Writable3.prototype.destroy = destroyImpl.destroy;
  Writable3.prototype._undestroy = destroyImpl.undestroy;
  Writable3.prototype._destroy = function(err, cb) {
    cb(err);
  };
  return _stream_writable;
}
var _stream_duplex;
var hasRequired_stream_duplex;
function require_stream_duplex() {
  if (hasRequired_stream_duplex) return _stream_duplex;
  hasRequired_stream_duplex = 1;
  var objectKeys = Object.keys || function(obj) {
    var keys2 = [];
    for (var key in obj) keys2.push(key);
    return keys2;
  };
  _stream_duplex = Duplex2;
  var Readable3 = require_stream_readable();
  var Writable3 = require_stream_writable();
  inheritsExports(Duplex2, Readable3);
  {
    var keys = objectKeys(Writable3.prototype);
    for (var v = 0; v < keys.length; v++) {
      var method = keys[v];
      if (!Duplex2.prototype[method]) Duplex2.prototype[method] = Writable3.prototype[method];
    }
  }
  function Duplex2(options) {
    if (!(this instanceof Duplex2)) return new Duplex2(options);
    Readable3.call(this, options);
    Writable3.call(this, options);
    this.allowHalfOpen = true;
    if (options) {
      if (options.readable === false) this.readable = false;
      if (options.writable === false) this.writable = false;
      if (options.allowHalfOpen === false) {
        this.allowHalfOpen = false;
        this.once("end", onend);
      }
    }
  }
  Object.defineProperty(Duplex2.prototype, "writableHighWaterMark", {
    // making it explicit this property is not enumerable
    // because otherwise some prototype manipulation in
    // userland will fail
    enumerable: false,
    get: function get() {
      return this._writableState.highWaterMark;
    }
  });
  Object.defineProperty(Duplex2.prototype, "writableBuffer", {
    // making it explicit this property is not enumerable
    // because otherwise some prototype manipulation in
    // userland will fail
    enumerable: false,
    get: function get() {
      return this._writableState && this._writableState.getBuffer();
    }
  });
  Object.defineProperty(Duplex2.prototype, "writableLength", {
    // making it explicit this property is not enumerable
    // because otherwise some prototype manipulation in
    // userland will fail
    enumerable: false,
    get: function get() {
      return this._writableState.length;
    }
  });
  function onend() {
    if (this._writableState.ended) return;
    process.nextTick(onEndNT, this);
  }
  function onEndNT(self2) {
    self2.end();
  }
  Object.defineProperty(Duplex2.prototype, "destroyed", {
    // making it explicit this property is not enumerable
    // because otherwise some prototype manipulation in
    // userland will fail
    enumerable: false,
    get: function get() {
      if (this._readableState === void 0 || this._writableState === void 0) {
        return false;
      }
      return this._readableState.destroyed && this._writableState.destroyed;
    },
    set: function set(value) {
      if (this._readableState === void 0 || this._writableState === void 0) {
        return;
      }
      this._readableState.destroyed = value;
      this._writableState.destroyed = value;
    }
  });
  return _stream_duplex;
}
var string_decoder = {};
var safeBuffer = { exports: {} };
/*! safe-buffer. MIT License. Feross Aboukhadijeh <https://feross.org/opensource> */
var hasRequiredSafeBuffer;
function requireSafeBuffer() {
  if (hasRequiredSafeBuffer) return safeBuffer.exports;
  hasRequiredSafeBuffer = 1;
  (function(module2, exports) {
    var buffer = require$$0$4;
    var Buffer2 = buffer.Buffer;
    function copyProps(src, dst) {
      for (var key in src) {
        dst[key] = src[key];
      }
    }
    if (Buffer2.from && Buffer2.alloc && Buffer2.allocUnsafe && Buffer2.allocUnsafeSlow) {
      module2.exports = buffer;
    } else {
      copyProps(buffer, exports);
      exports.Buffer = SafeBuffer;
    }
    function SafeBuffer(arg, encodingOrOffset, length) {
      return Buffer2(arg, encodingOrOffset, length);
    }
    SafeBuffer.prototype = Object.create(Buffer2.prototype);
    copyProps(Buffer2, SafeBuffer);
    SafeBuffer.from = function(arg, encodingOrOffset, length) {
      if (typeof arg === "number") {
        throw new TypeError("Argument must not be a number");
      }
      return Buffer2(arg, encodingOrOffset, length);
    };
    SafeBuffer.alloc = function(size, fill2, encoding) {
      if (typeof size !== "number") {
        throw new TypeError("Argument must be a number");
      }
      var buf = Buffer2(size);
      if (fill2 !== void 0) {
        if (typeof encoding === "string") {
          buf.fill(fill2, encoding);
        } else {
          buf.fill(fill2);
        }
      } else {
        buf.fill(0);
      }
      return buf;
    };
    SafeBuffer.allocUnsafe = function(size) {
      if (typeof size !== "number") {
        throw new TypeError("Argument must be a number");
      }
      return Buffer2(size);
    };
    SafeBuffer.allocUnsafeSlow = function(size) {
      if (typeof size !== "number") {
        throw new TypeError("Argument must be a number");
      }
      return buffer.SlowBuffer(size);
    };
  })(safeBuffer, safeBuffer.exports);
  return safeBuffer.exports;
}
var hasRequiredString_decoder;
function requireString_decoder() {
  if (hasRequiredString_decoder) return string_decoder;
  hasRequiredString_decoder = 1;
  var Buffer2 = requireSafeBuffer().Buffer;
  var isEncoding2 = Buffer2.isEncoding || function(encoding) {
    encoding = "" + encoding;
    switch (encoding && encoding.toLowerCase()) {
      case "hex":
      case "utf8":
      case "utf-8":
      case "ascii":
      case "binary":
      case "base64":
      case "ucs2":
      case "ucs-2":
      case "utf16le":
      case "utf-16le":
      case "raw":
        return true;
      default:
        return false;
    }
  };
  function _normalizeEncoding(enc) {
    if (!enc) return "utf8";
    var retried;
    while (true) {
      switch (enc) {
        case "utf8":
        case "utf-8":
          return "utf8";
        case "ucs2":
        case "ucs-2":
        case "utf16le":
        case "utf-16le":
          return "utf16le";
        case "latin1":
        case "binary":
          return "latin1";
        case "base64":
        case "ascii":
        case "hex":
          return enc;
        default:
          if (retried) return;
          enc = ("" + enc).toLowerCase();
          retried = true;
      }
    }
  }
  function normalizeEncoding2(enc) {
    var nenc = _normalizeEncoding(enc);
    if (typeof nenc !== "string" && (Buffer2.isEncoding === isEncoding2 || !isEncoding2(enc))) throw new Error("Unknown encoding: " + enc);
    return nenc || enc;
  }
  string_decoder.StringDecoder = StringDecoder;
  function StringDecoder(encoding) {
    this.encoding = normalizeEncoding2(encoding);
    var nb;
    switch (this.encoding) {
      case "utf16le":
        this.text = utf16Text;
        this.end = utf16End;
        nb = 4;
        break;
      case "utf8":
        this.fillLast = utf8FillLast;
        nb = 4;
        break;
      case "base64":
        this.text = base64Text;
        this.end = base64End;
        nb = 3;
        break;
      default:
        this.write = simpleWrite;
        this.end = simpleEnd;
        return;
    }
    this.lastNeed = 0;
    this.lastTotal = 0;
    this.lastChar = Buffer2.allocUnsafe(nb);
  }
  StringDecoder.prototype.write = function(buf) {
    if (buf.length === 0) return "";
    var r;
    var i;
    if (this.lastNeed) {
      r = this.fillLast(buf);
      if (r === void 0) return "";
      i = this.lastNeed;
      this.lastNeed = 0;
    } else {
      i = 0;
    }
    if (i < buf.length) return r ? r + this.text(buf, i) : this.text(buf, i);
    return r || "";
  };
  StringDecoder.prototype.end = utf8End;
  StringDecoder.prototype.text = utf8Text;
  StringDecoder.prototype.fillLast = function(buf) {
    if (this.lastNeed <= buf.length) {
      buf.copy(this.lastChar, this.lastTotal - this.lastNeed, 0, this.lastNeed);
      return this.lastChar.toString(this.encoding, 0, this.lastTotal);
    }
    buf.copy(this.lastChar, this.lastTotal - this.lastNeed, 0, buf.length);
    this.lastNeed -= buf.length;
  };
  function utf8CheckByte(byte) {
    if (byte <= 127) return 0;
    else if (byte >> 5 === 6) return 2;
    else if (byte >> 4 === 14) return 3;
    else if (byte >> 3 === 30) return 4;
    return byte >> 6 === 2 ? -1 : -2;
  }
  function utf8CheckIncomplete(self2, buf, i) {
    var j = buf.length - 1;
    if (j < i) return 0;
    var nb = utf8CheckByte(buf[j]);
    if (nb >= 0) {
      if (nb > 0) self2.lastNeed = nb - 1;
      return nb;
    }
    if (--j < i || nb === -2) return 0;
    nb = utf8CheckByte(buf[j]);
    if (nb >= 0) {
      if (nb > 0) self2.lastNeed = nb - 2;
      return nb;
    }
    if (--j < i || nb === -2) return 0;
    nb = utf8CheckByte(buf[j]);
    if (nb >= 0) {
      if (nb > 0) {
        if (nb === 2) nb = 0;
        else self2.lastNeed = nb - 3;
      }
      return nb;
    }
    return 0;
  }
  function utf8CheckExtraBytes(self2, buf, p) {
    if ((buf[0] & 192) !== 128) {
      self2.lastNeed = 0;
      return "�";
    }
    if (self2.lastNeed > 1 && buf.length > 1) {
      if ((buf[1] & 192) !== 128) {
        self2.lastNeed = 1;
        return "�";
      }
      if (self2.lastNeed > 2 && buf.length > 2) {
        if ((buf[2] & 192) !== 128) {
          self2.lastNeed = 2;
          return "�";
        }
      }
    }
  }
  function utf8FillLast(buf) {
    var p = this.lastTotal - this.lastNeed;
    var r = utf8CheckExtraBytes(this, buf);
    if (r !== void 0) return r;
    if (this.lastNeed <= buf.length) {
      buf.copy(this.lastChar, p, 0, this.lastNeed);
      return this.lastChar.toString(this.encoding, 0, this.lastTotal);
    }
    buf.copy(this.lastChar, p, 0, buf.length);
    this.lastNeed -= buf.length;
  }
  function utf8Text(buf, i) {
    var total = utf8CheckIncomplete(this, buf, i);
    if (!this.lastNeed) return buf.toString("utf8", i);
    this.lastTotal = total;
    var end = buf.length - (total - this.lastNeed);
    buf.copy(this.lastChar, 0, end);
    return buf.toString("utf8", i, end);
  }
  function utf8End(buf) {
    var r = buf && buf.length ? this.write(buf) : "";
    if (this.lastNeed) return r + "�";
    return r;
  }
  function utf16Text(buf, i) {
    if ((buf.length - i) % 2 === 0) {
      var r = buf.toString("utf16le", i);
      if (r) {
        var c = r.charCodeAt(r.length - 1);
        if (c >= 55296 && c <= 56319) {
          this.lastNeed = 2;
          this.lastTotal = 4;
          this.lastChar[0] = buf[buf.length - 2];
          this.lastChar[1] = buf[buf.length - 1];
          return r.slice(0, -1);
        }
      }
      return r;
    }
    this.lastNeed = 1;
    this.lastTotal = 2;
    this.lastChar[0] = buf[buf.length - 1];
    return buf.toString("utf16le", i, buf.length - 1);
  }
  function utf16End(buf) {
    var r = buf && buf.length ? this.write(buf) : "";
    if (this.lastNeed) {
      var end = this.lastTotal - this.lastNeed;
      return r + this.lastChar.toString("utf16le", 0, end);
    }
    return r;
  }
  function base64Text(buf, i) {
    var n = (buf.length - i) % 3;
    if (n === 0) return buf.toString("base64", i);
    this.lastNeed = 3 - n;
    this.lastTotal = 3;
    if (n === 1) {
      this.lastChar[0] = buf[buf.length - 1];
    } else {
      this.lastChar[0] = buf[buf.length - 2];
      this.lastChar[1] = buf[buf.length - 1];
    }
    return buf.toString("base64", i, buf.length - n);
  }
  function base64End(buf) {
    var r = buf && buf.length ? this.write(buf) : "";
    if (this.lastNeed) return r + this.lastChar.toString("base64", 0, 3 - this.lastNeed);
    return r;
  }
  function simpleWrite(buf) {
    return buf.toString(this.encoding);
  }
  function simpleEnd(buf) {
    return buf && buf.length ? this.write(buf) : "";
  }
  return string_decoder;
}
var endOfStream;
var hasRequiredEndOfStream;
function requireEndOfStream() {
  if (hasRequiredEndOfStream) return endOfStream;
  hasRequiredEndOfStream = 1;
  var ERR_STREAM_PREMATURE_CLOSE = requireErrors().codes.ERR_STREAM_PREMATURE_CLOSE;
  function once2(callback) {
    var called = false;
    return function() {
      if (called) return;
      called = true;
      for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
        args[_key] = arguments[_key];
      }
      callback.apply(this, args);
    };
  }
  function noop2() {
  }
  function isRequest(stream2) {
    return stream2.setHeader && typeof stream2.abort === "function";
  }
  function eos(stream2, opts, callback) {
    if (typeof opts === "function") return eos(stream2, null, opts);
    if (!opts) opts = {};
    callback = once2(callback || noop2);
    var readable2 = opts.readable || opts.readable !== false && stream2.readable;
    var writable = opts.writable || opts.writable !== false && stream2.writable;
    var onlegacyfinish = function onlegacyfinish2() {
      if (!stream2.writable) onfinish();
    };
    var writableEnded = stream2._writableState && stream2._writableState.finished;
    var onfinish = function onfinish2() {
      writable = false;
      writableEnded = true;
      if (!readable2) callback.call(stream2);
    };
    var readableEnded = stream2._readableState && stream2._readableState.endEmitted;
    var onend = function onend2() {
      readable2 = false;
      readableEnded = true;
      if (!writable) callback.call(stream2);
    };
    var onerror = function onerror2(err) {
      callback.call(stream2, err);
    };
    var onclose = function onclose2() {
      var err;
      if (readable2 && !readableEnded) {
        if (!stream2._readableState || !stream2._readableState.ended) err = new ERR_STREAM_PREMATURE_CLOSE();
        return callback.call(stream2, err);
      }
      if (writable && !writableEnded) {
        if (!stream2._writableState || !stream2._writableState.ended) err = new ERR_STREAM_PREMATURE_CLOSE();
        return callback.call(stream2, err);
      }
    };
    var onrequest = function onrequest2() {
      stream2.req.on("finish", onfinish);
    };
    if (isRequest(stream2)) {
      stream2.on("complete", onfinish);
      stream2.on("abort", onclose);
      if (stream2.req) onrequest();
      else stream2.on("request", onrequest);
    } else if (writable && !stream2._writableState) {
      stream2.on("end", onlegacyfinish);
      stream2.on("close", onlegacyfinish);
    }
    stream2.on("end", onend);
    stream2.on("finish", onfinish);
    if (opts.error !== false) stream2.on("error", onerror);
    stream2.on("close", onclose);
    return function() {
      stream2.removeListener("complete", onfinish);
      stream2.removeListener("abort", onclose);
      stream2.removeListener("request", onrequest);
      if (stream2.req) stream2.req.removeListener("finish", onfinish);
      stream2.removeListener("end", onlegacyfinish);
      stream2.removeListener("close", onlegacyfinish);
      stream2.removeListener("finish", onfinish);
      stream2.removeListener("end", onend);
      stream2.removeListener("error", onerror);
      stream2.removeListener("close", onclose);
    };
  }
  endOfStream = eos;
  return endOfStream;
}
var async_iterator;
var hasRequiredAsync_iterator;
function requireAsync_iterator() {
  if (hasRequiredAsync_iterator) return async_iterator;
  hasRequiredAsync_iterator = 1;
  var _Object$setPrototypeO;
  function _defineProperty2(obj, key, value) {
    key = _toPropertyKey(key);
    if (key in obj) {
      Object.defineProperty(obj, key, { value, enumerable: true, configurable: true, writable: true });
    } else {
      obj[key] = value;
    }
    return obj;
  }
  function _toPropertyKey(arg) {
    var key = _toPrimitive(arg, "string");
    return typeof key === "symbol" ? key : String(key);
  }
  function _toPrimitive(input, hint) {
    if (typeof input !== "object" || input === null) return input;
    var prim = input[Symbol.toPrimitive];
    if (prim !== void 0) {
      var res = prim.call(input, hint);
      if (typeof res !== "object") return res;
      throw new TypeError("@@toPrimitive must return a primitive value.");
    }
    return (hint === "string" ? String : Number)(input);
  }
  var finished = requireEndOfStream();
  var kLastResolve = Symbol("lastResolve");
  var kLastReject = Symbol("lastReject");
  var kError = Symbol("error");
  var kEnded = Symbol("ended");
  var kLastPromise = Symbol("lastPromise");
  var kHandlePromise = Symbol("handlePromise");
  var kStream = Symbol("stream");
  function createIterResult(value, done) {
    return {
      value,
      done
    };
  }
  function readAndResolve(iter) {
    var resolve2 = iter[kLastResolve];
    if (resolve2 !== null) {
      var data = iter[kStream].read();
      if (data !== null) {
        iter[kLastPromise] = null;
        iter[kLastResolve] = null;
        iter[kLastReject] = null;
        resolve2(createIterResult(data, false));
      }
    }
  }
  function onReadable(iter) {
    process.nextTick(readAndResolve, iter);
  }
  function wrapForNext(lastPromise, iter) {
    return function(resolve2, reject2) {
      lastPromise.then(function() {
        if (iter[kEnded]) {
          resolve2(createIterResult(void 0, true));
          return;
        }
        iter[kHandlePromise](resolve2, reject2);
      }, reject2);
    };
  }
  var AsyncIteratorPrototype = Object.getPrototypeOf(function() {
  });
  var ReadableStreamAsyncIteratorPrototype = Object.setPrototypeOf((_Object$setPrototypeO = {
    get stream() {
      return this[kStream];
    },
    next: function next() {
      var _this = this;
      var error2 = this[kError];
      if (error2 !== null) {
        return Promise.reject(error2);
      }
      if (this[kEnded]) {
        return Promise.resolve(createIterResult(void 0, true));
      }
      if (this[kStream].destroyed) {
        return new Promise(function(resolve2, reject2) {
          process.nextTick(function() {
            if (_this[kError]) {
              reject2(_this[kError]);
            } else {
              resolve2(createIterResult(void 0, true));
            }
          });
        });
      }
      var lastPromise = this[kLastPromise];
      var promise;
      if (lastPromise) {
        promise = new Promise(wrapForNext(lastPromise, this));
      } else {
        var data = this[kStream].read();
        if (data !== null) {
          return Promise.resolve(createIterResult(data, false));
        }
        promise = new Promise(this[kHandlePromise]);
      }
      this[kLastPromise] = promise;
      return promise;
    }
  }, _defineProperty2(_Object$setPrototypeO, Symbol.asyncIterator, function() {
    return this;
  }), _defineProperty2(_Object$setPrototypeO, "return", function _return() {
    var _this2 = this;
    return new Promise(function(resolve2, reject2) {
      _this2[kStream].destroy(null, function(err) {
        if (err) {
          reject2(err);
          return;
        }
        resolve2(createIterResult(void 0, true));
      });
    });
  }), _Object$setPrototypeO), AsyncIteratorPrototype);
  var createReadableStreamAsyncIterator = function createReadableStreamAsyncIterator2(stream2) {
    var _Object$create;
    var iterator = Object.create(ReadableStreamAsyncIteratorPrototype, (_Object$create = {}, _defineProperty2(_Object$create, kStream, {
      value: stream2,
      writable: true
    }), _defineProperty2(_Object$create, kLastResolve, {
      value: null,
      writable: true
    }), _defineProperty2(_Object$create, kLastReject, {
      value: null,
      writable: true
    }), _defineProperty2(_Object$create, kError, {
      value: null,
      writable: true
    }), _defineProperty2(_Object$create, kEnded, {
      value: stream2._readableState.endEmitted,
      writable: true
    }), _defineProperty2(_Object$create, kHandlePromise, {
      value: function value(resolve2, reject2) {
        var data = iterator[kStream].read();
        if (data) {
          iterator[kLastPromise] = null;
          iterator[kLastResolve] = null;
          iterator[kLastReject] = null;
          resolve2(createIterResult(data, false));
        } else {
          iterator[kLastResolve] = resolve2;
          iterator[kLastReject] = reject2;
        }
      },
      writable: true
    }), _Object$create));
    iterator[kLastPromise] = null;
    finished(stream2, function(err) {
      if (err && err.code !== "ERR_STREAM_PREMATURE_CLOSE") {
        var reject2 = iterator[kLastReject];
        if (reject2 !== null) {
          iterator[kLastPromise] = null;
          iterator[kLastResolve] = null;
          iterator[kLastReject] = null;
          reject2(err);
        }
        iterator[kError] = err;
        return;
      }
      var resolve2 = iterator[kLastResolve];
      if (resolve2 !== null) {
        iterator[kLastPromise] = null;
        iterator[kLastResolve] = null;
        iterator[kLastReject] = null;
        resolve2(createIterResult(void 0, true));
      }
      iterator[kEnded] = true;
    });
    stream2.on("readable", onReadable.bind(null, iterator));
    return iterator;
  };
  async_iterator = createReadableStreamAsyncIterator;
  return async_iterator;
}
var from_1;
var hasRequiredFrom;
function requireFrom() {
  if (hasRequiredFrom) return from_1;
  hasRequiredFrom = 1;
  function asyncGeneratorStep(gen, resolve2, reject2, _next, _throw, key, arg) {
    try {
      var info = gen[key](arg);
      var value = info.value;
    } catch (error2) {
      reject2(error2);
      return;
    }
    if (info.done) {
      resolve2(value);
    } else {
      Promise.resolve(value).then(_next, _throw);
    }
  }
  function _asyncToGenerator(fn) {
    return function() {
      var self2 = this, args = arguments;
      return new Promise(function(resolve2, reject2) {
        var gen = fn.apply(self2, args);
        function _next(value) {
          asyncGeneratorStep(gen, resolve2, reject2, _next, _throw, "next", value);
        }
        function _throw(err) {
          asyncGeneratorStep(gen, resolve2, reject2, _next, _throw, "throw", err);
        }
        _next(void 0);
      });
    };
  }
  function ownKeys(object, enumerableOnly) {
    var keys = Object.keys(object);
    if (Object.getOwnPropertySymbols) {
      var symbols = Object.getOwnPropertySymbols(object);
      enumerableOnly && (symbols = symbols.filter(function(sym) {
        return Object.getOwnPropertyDescriptor(object, sym).enumerable;
      })), keys.push.apply(keys, symbols);
    }
    return keys;
  }
  function _objectSpread(target) {
    for (var i = 1; i < arguments.length; i++) {
      var source = null != arguments[i] ? arguments[i] : {};
      i % 2 ? ownKeys(Object(source), true).forEach(function(key) {
        _defineProperty2(target, key, source[key]);
      }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function(key) {
        Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
      });
    }
    return target;
  }
  function _defineProperty2(obj, key, value) {
    key = _toPropertyKey(key);
    if (key in obj) {
      Object.defineProperty(obj, key, { value, enumerable: true, configurable: true, writable: true });
    } else {
      obj[key] = value;
    }
    return obj;
  }
  function _toPropertyKey(arg) {
    var key = _toPrimitive(arg, "string");
    return typeof key === "symbol" ? key : String(key);
  }
  function _toPrimitive(input, hint) {
    if (typeof input !== "object" || input === null) return input;
    var prim = input[Symbol.toPrimitive];
    if (prim !== void 0) {
      var res = prim.call(input, hint);
      if (typeof res !== "object") return res;
      throw new TypeError("@@toPrimitive must return a primitive value.");
    }
    return (hint === "string" ? String : Number)(input);
  }
  var ERR_INVALID_ARG_TYPE = requireErrors().codes.ERR_INVALID_ARG_TYPE;
  function from2(Readable3, iterable, opts) {
    var iterator;
    if (iterable && typeof iterable.next === "function") {
      iterator = iterable;
    } else if (iterable && iterable[Symbol.asyncIterator]) iterator = iterable[Symbol.asyncIterator]();
    else if (iterable && iterable[Symbol.iterator]) iterator = iterable[Symbol.iterator]();
    else throw new ERR_INVALID_ARG_TYPE("iterable", ["Iterable"], iterable);
    var readable2 = new Readable3(_objectSpread({
      objectMode: true
    }, opts));
    var reading = false;
    readable2._read = function() {
      if (!reading) {
        reading = true;
        next();
      }
    };
    function next() {
      return _next2.apply(this, arguments);
    }
    function _next2() {
      _next2 = _asyncToGenerator(function* () {
        try {
          var _yield$iterator$next = yield iterator.next(), value = _yield$iterator$next.value, done = _yield$iterator$next.done;
          if (done) {
            readable2.push(null);
          } else if (readable2.push(yield value)) {
            next();
          } else {
            reading = false;
          }
        } catch (err) {
          readable2.destroy(err);
        }
      });
      return _next2.apply(this, arguments);
    }
    return readable2;
  }
  from_1 = from2;
  return from_1;
}
var _stream_readable;
var hasRequired_stream_readable;
function require_stream_readable() {
  if (hasRequired_stream_readable) return _stream_readable;
  hasRequired_stream_readable = 1;
  _stream_readable = Readable3;
  var Duplex2;
  Readable3.ReadableState = ReadableState2;
  require$$0.EventEmitter;
  var EElistenerCount = function EElistenerCount2(emitter, type) {
    return emitter.listeners(type).length;
  };
  var Stream2 = requireStream();
  var Buffer2 = require$$0$4.Buffer;
  var OurUint8Array = (typeof commonjsGlobal !== "undefined" ? commonjsGlobal : typeof window !== "undefined" ? window : typeof self !== "undefined" ? self : {}).Uint8Array || function() {
  };
  function _uint8ArrayToBuffer(chunk) {
    return Buffer2.from(chunk);
  }
  function _isUint8Array(obj) {
    return Buffer2.isBuffer(obj) || obj instanceof OurUint8Array;
  }
  var debugUtil = require$$0$3;
  var debug2;
  if (debugUtil && debugUtil.debuglog) {
    debug2 = debugUtil.debuglog("stream");
  } else {
    debug2 = function debug3() {
    };
  }
  var BufferList2 = requireBuffer_list();
  var destroyImpl = requireDestroy();
  var _require = requireState(), getHighWaterMark = _require.getHighWaterMark;
  var _require$codes = requireErrors().codes, ERR_INVALID_ARG_TYPE = _require$codes.ERR_INVALID_ARG_TYPE, ERR_STREAM_PUSH_AFTER_EOF = _require$codes.ERR_STREAM_PUSH_AFTER_EOF, ERR_METHOD_NOT_IMPLEMENTED = _require$codes.ERR_METHOD_NOT_IMPLEMENTED, ERR_STREAM_UNSHIFT_AFTER_END_EVENT = _require$codes.ERR_STREAM_UNSHIFT_AFTER_END_EVENT;
  var StringDecoder;
  var createReadableStreamAsyncIterator;
  var from2;
  inheritsExports(Readable3, Stream2);
  var errorOrDestroy = destroyImpl.errorOrDestroy;
  var kProxyEvents = ["error", "close", "destroy", "pause", "resume"];
  function prependListener(emitter, event, fn) {
    if (typeof emitter.prependListener === "function") return emitter.prependListener(event, fn);
    if (!emitter._events || !emitter._events[event]) emitter.on(event, fn);
    else if (Array.isArray(emitter._events[event])) emitter._events[event].unshift(fn);
    else emitter._events[event] = [fn, emitter._events[event]];
  }
  function ReadableState2(options, stream2, isDuplex) {
    Duplex2 = Duplex2 || require_stream_duplex();
    options = options || {};
    if (typeof isDuplex !== "boolean") isDuplex = stream2 instanceof Duplex2;
    this.objectMode = !!options.objectMode;
    if (isDuplex) this.objectMode = this.objectMode || !!options.readableObjectMode;
    this.highWaterMark = getHighWaterMark(this, options, "readableHighWaterMark", isDuplex);
    this.buffer = new BufferList2();
    this.length = 0;
    this.pipes = null;
    this.pipesCount = 0;
    this.flowing = null;
    this.ended = false;
    this.endEmitted = false;
    this.reading = false;
    this.sync = true;
    this.needReadable = false;
    this.emittedReadable = false;
    this.readableListening = false;
    this.resumeScheduled = false;
    this.paused = true;
    this.emitClose = options.emitClose !== false;
    this.autoDestroy = !!options.autoDestroy;
    this.destroyed = false;
    this.defaultEncoding = options.defaultEncoding || "utf8";
    this.awaitDrain = 0;
    this.readingMore = false;
    this.decoder = null;
    this.encoding = null;
    if (options.encoding) {
      if (!StringDecoder) StringDecoder = requireString_decoder().StringDecoder;
      this.decoder = new StringDecoder(options.encoding);
      this.encoding = options.encoding;
    }
  }
  function Readable3(options) {
    Duplex2 = Duplex2 || require_stream_duplex();
    if (!(this instanceof Readable3)) return new Readable3(options);
    var isDuplex = this instanceof Duplex2;
    this._readableState = new ReadableState2(options, this, isDuplex);
    this.readable = true;
    if (options) {
      if (typeof options.read === "function") this._read = options.read;
      if (typeof options.destroy === "function") this._destroy = options.destroy;
    }
    Stream2.call(this);
  }
  Object.defineProperty(Readable3.prototype, "destroyed", {
    // making it explicit this property is not enumerable
    // because otherwise some prototype manipulation in
    // userland will fail
    enumerable: false,
    get: function get() {
      if (this._readableState === void 0) {
        return false;
      }
      return this._readableState.destroyed;
    },
    set: function set(value) {
      if (!this._readableState) {
        return;
      }
      this._readableState.destroyed = value;
    }
  });
  Readable3.prototype.destroy = destroyImpl.destroy;
  Readable3.prototype._undestroy = destroyImpl.undestroy;
  Readable3.prototype._destroy = function(err, cb) {
    cb(err);
  };
  Readable3.prototype.push = function(chunk, encoding) {
    var state2 = this._readableState;
    var skipChunkCheck;
    if (!state2.objectMode) {
      if (typeof chunk === "string") {
        encoding = encoding || state2.defaultEncoding;
        if (encoding !== state2.encoding) {
          chunk = Buffer2.from(chunk, encoding);
          encoding = "";
        }
        skipChunkCheck = true;
      }
    } else {
      skipChunkCheck = true;
    }
    return readableAddChunk(this, chunk, encoding, false, skipChunkCheck);
  };
  Readable3.prototype.unshift = function(chunk) {
    return readableAddChunk(this, chunk, null, true, false);
  };
  function readableAddChunk(stream2, chunk, encoding, addToFront, skipChunkCheck) {
    debug2("readableAddChunk", chunk);
    var state2 = stream2._readableState;
    if (chunk === null) {
      state2.reading = false;
      onEofChunk(stream2, state2);
    } else {
      var er;
      if (!skipChunkCheck) er = chunkInvalid(state2, chunk);
      if (er) {
        errorOrDestroy(stream2, er);
      } else if (state2.objectMode || chunk && chunk.length > 0) {
        if (typeof chunk !== "string" && !state2.objectMode && Object.getPrototypeOf(chunk) !== Buffer2.prototype) {
          chunk = _uint8ArrayToBuffer(chunk);
        }
        if (addToFront) {
          if (state2.endEmitted) errorOrDestroy(stream2, new ERR_STREAM_UNSHIFT_AFTER_END_EVENT());
          else addChunk(stream2, state2, chunk, true);
        } else if (state2.ended) {
          errorOrDestroy(stream2, new ERR_STREAM_PUSH_AFTER_EOF());
        } else if (state2.destroyed) {
          return false;
        } else {
          state2.reading = false;
          if (state2.decoder && !encoding) {
            chunk = state2.decoder.write(chunk);
            if (state2.objectMode || chunk.length !== 0) addChunk(stream2, state2, chunk, false);
            else maybeReadMore(stream2, state2);
          } else {
            addChunk(stream2, state2, chunk, false);
          }
        }
      } else if (!addToFront) {
        state2.reading = false;
        maybeReadMore(stream2, state2);
      }
    }
    return !state2.ended && (state2.length < state2.highWaterMark || state2.length === 0);
  }
  function addChunk(stream2, state2, chunk, addToFront) {
    if (state2.flowing && state2.length === 0 && !state2.sync) {
      state2.awaitDrain = 0;
      stream2.emit("data", chunk);
    } else {
      state2.length += state2.objectMode ? 1 : chunk.length;
      if (addToFront) state2.buffer.unshift(chunk);
      else state2.buffer.push(chunk);
      if (state2.needReadable) emitReadable(stream2);
    }
    maybeReadMore(stream2, state2);
  }
  function chunkInvalid(state2, chunk) {
    var er;
    if (!_isUint8Array(chunk) && typeof chunk !== "string" && chunk !== void 0 && !state2.objectMode) {
      er = new ERR_INVALID_ARG_TYPE("chunk", ["string", "Buffer", "Uint8Array"], chunk);
    }
    return er;
  }
  Readable3.prototype.isPaused = function() {
    return this._readableState.flowing === false;
  };
  Readable3.prototype.setEncoding = function(enc) {
    if (!StringDecoder) StringDecoder = requireString_decoder().StringDecoder;
    var decoder = new StringDecoder(enc);
    this._readableState.decoder = decoder;
    this._readableState.encoding = this._readableState.decoder.encoding;
    var p = this._readableState.buffer.head;
    var content = "";
    while (p !== null) {
      content += decoder.write(p.data);
      p = p.next;
    }
    this._readableState.buffer.clear();
    if (content !== "") this._readableState.buffer.push(content);
    this._readableState.length = content.length;
    return this;
  };
  var MAX_HWM = 1073741824;
  function computeNewHighWaterMark(n) {
    if (n >= MAX_HWM) {
      n = MAX_HWM;
    } else {
      n--;
      n |= n >>> 1;
      n |= n >>> 2;
      n |= n >>> 4;
      n |= n >>> 8;
      n |= n >>> 16;
      n++;
    }
    return n;
  }
  function howMuchToRead(n, state2) {
    if (n <= 0 || state2.length === 0 && state2.ended) return 0;
    if (state2.objectMode) return 1;
    if (n !== n) {
      if (state2.flowing && state2.length) return state2.buffer.head.data.length;
      else return state2.length;
    }
    if (n > state2.highWaterMark) state2.highWaterMark = computeNewHighWaterMark(n);
    if (n <= state2.length) return n;
    if (!state2.ended) {
      state2.needReadable = true;
      return 0;
    }
    return state2.length;
  }
  Readable3.prototype.read = function(n) {
    debug2("read", n);
    n = parseInt(n, 10);
    var state2 = this._readableState;
    var nOrig = n;
    if (n !== 0) state2.emittedReadable = false;
    if (n === 0 && state2.needReadable && ((state2.highWaterMark !== 0 ? state2.length >= state2.highWaterMark : state2.length > 0) || state2.ended)) {
      debug2("read: emitReadable", state2.length, state2.ended);
      if (state2.length === 0 && state2.ended) endReadable(this);
      else emitReadable(this);
      return null;
    }
    n = howMuchToRead(n, state2);
    if (n === 0 && state2.ended) {
      if (state2.length === 0) endReadable(this);
      return null;
    }
    var doRead = state2.needReadable;
    debug2("need readable", doRead);
    if (state2.length === 0 || state2.length - n < state2.highWaterMark) {
      doRead = true;
      debug2("length less than watermark", doRead);
    }
    if (state2.ended || state2.reading) {
      doRead = false;
      debug2("reading or ended", doRead);
    } else if (doRead) {
      debug2("do read");
      state2.reading = true;
      state2.sync = true;
      if (state2.length === 0) state2.needReadable = true;
      this._read(state2.highWaterMark);
      state2.sync = false;
      if (!state2.reading) n = howMuchToRead(nOrig, state2);
    }
    var ret;
    if (n > 0) ret = fromList(n, state2);
    else ret = null;
    if (ret === null) {
      state2.needReadable = state2.length <= state2.highWaterMark;
      n = 0;
    } else {
      state2.length -= n;
      state2.awaitDrain = 0;
    }
    if (state2.length === 0) {
      if (!state2.ended) state2.needReadable = true;
      if (nOrig !== n && state2.ended) endReadable(this);
    }
    if (ret !== null) this.emit("data", ret);
    return ret;
  };
  function onEofChunk(stream2, state2) {
    debug2("onEofChunk");
    if (state2.ended) return;
    if (state2.decoder) {
      var chunk = state2.decoder.end();
      if (chunk && chunk.length) {
        state2.buffer.push(chunk);
        state2.length += state2.objectMode ? 1 : chunk.length;
      }
    }
    state2.ended = true;
    if (state2.sync) {
      emitReadable(stream2);
    } else {
      state2.needReadable = false;
      if (!state2.emittedReadable) {
        state2.emittedReadable = true;
        emitReadable_(stream2);
      }
    }
  }
  function emitReadable(stream2) {
    var state2 = stream2._readableState;
    debug2("emitReadable", state2.needReadable, state2.emittedReadable);
    state2.needReadable = false;
    if (!state2.emittedReadable) {
      debug2("emitReadable", state2.flowing);
      state2.emittedReadable = true;
      process.nextTick(emitReadable_, stream2);
    }
  }
  function emitReadable_(stream2) {
    var state2 = stream2._readableState;
    debug2("emitReadable_", state2.destroyed, state2.length, state2.ended);
    if (!state2.destroyed && (state2.length || state2.ended)) {
      stream2.emit("readable");
      state2.emittedReadable = false;
    }
    state2.needReadable = !state2.flowing && !state2.ended && state2.length <= state2.highWaterMark;
    flow(stream2);
  }
  function maybeReadMore(stream2, state2) {
    if (!state2.readingMore) {
      state2.readingMore = true;
      process.nextTick(maybeReadMore_, stream2, state2);
    }
  }
  function maybeReadMore_(stream2, state2) {
    while (!state2.reading && !state2.ended && (state2.length < state2.highWaterMark || state2.flowing && state2.length === 0)) {
      var len = state2.length;
      debug2("maybeReadMore read 0");
      stream2.read(0);
      if (len === state2.length)
        break;
    }
    state2.readingMore = false;
  }
  Readable3.prototype._read = function(n) {
    errorOrDestroy(this, new ERR_METHOD_NOT_IMPLEMENTED("_read()"));
  };
  Readable3.prototype.pipe = function(dest, pipeOpts) {
    var src = this;
    var state2 = this._readableState;
    switch (state2.pipesCount) {
      case 0:
        state2.pipes = dest;
        break;
      case 1:
        state2.pipes = [state2.pipes, dest];
        break;
      default:
        state2.pipes.push(dest);
        break;
    }
    state2.pipesCount += 1;
    debug2("pipe count=%d opts=%j", state2.pipesCount, pipeOpts);
    var doEnd = (!pipeOpts || pipeOpts.end !== false) && dest !== process.stdout && dest !== process.stderr;
    var endFn = doEnd ? onend : unpipe;
    if (state2.endEmitted) process.nextTick(endFn);
    else src.once("end", endFn);
    dest.on("unpipe", onunpipe);
    function onunpipe(readable2, unpipeInfo) {
      debug2("onunpipe");
      if (readable2 === src) {
        if (unpipeInfo && unpipeInfo.hasUnpiped === false) {
          unpipeInfo.hasUnpiped = true;
          cleanup();
        }
      }
    }
    function onend() {
      debug2("onend");
      dest.end();
    }
    var ondrain = pipeOnDrain(src);
    dest.on("drain", ondrain);
    var cleanedUp = false;
    function cleanup() {
      debug2("cleanup");
      dest.removeListener("close", onclose);
      dest.removeListener("finish", onfinish);
      dest.removeListener("drain", ondrain);
      dest.removeListener("error", onerror);
      dest.removeListener("unpipe", onunpipe);
      src.removeListener("end", onend);
      src.removeListener("end", unpipe);
      src.removeListener("data", ondata);
      cleanedUp = true;
      if (state2.awaitDrain && (!dest._writableState || dest._writableState.needDrain)) ondrain();
    }
    src.on("data", ondata);
    function ondata(chunk) {
      debug2("ondata");
      var ret = dest.write(chunk);
      debug2("dest.write", ret);
      if (ret === false) {
        if ((state2.pipesCount === 1 && state2.pipes === dest || state2.pipesCount > 1 && indexOf2(state2.pipes, dest) !== -1) && !cleanedUp) {
          debug2("false write response, pause", state2.awaitDrain);
          state2.awaitDrain++;
        }
        src.pause();
      }
    }
    function onerror(er) {
      debug2("onerror", er);
      unpipe();
      dest.removeListener("error", onerror);
      if (EElistenerCount(dest, "error") === 0) errorOrDestroy(dest, er);
    }
    prependListener(dest, "error", onerror);
    function onclose() {
      dest.removeListener("finish", onfinish);
      unpipe();
    }
    dest.once("close", onclose);
    function onfinish() {
      debug2("onfinish");
      dest.removeListener("close", onclose);
      unpipe();
    }
    dest.once("finish", onfinish);
    function unpipe() {
      debug2("unpipe");
      src.unpipe(dest);
    }
    dest.emit("pipe", src);
    if (!state2.flowing) {
      debug2("pipe resume");
      src.resume();
    }
    return dest;
  };
  function pipeOnDrain(src) {
    return function pipeOnDrainFunctionResult() {
      var state2 = src._readableState;
      debug2("pipeOnDrain", state2.awaitDrain);
      if (state2.awaitDrain) state2.awaitDrain--;
      if (state2.awaitDrain === 0 && EElistenerCount(src, "data")) {
        state2.flowing = true;
        flow(src);
      }
    };
  }
  Readable3.prototype.unpipe = function(dest) {
    var state2 = this._readableState;
    var unpipeInfo = {
      hasUnpiped: false
    };
    if (state2.pipesCount === 0) return this;
    if (state2.pipesCount === 1) {
      if (dest && dest !== state2.pipes) return this;
      if (!dest) dest = state2.pipes;
      state2.pipes = null;
      state2.pipesCount = 0;
      state2.flowing = false;
      if (dest) dest.emit("unpipe", this, unpipeInfo);
      return this;
    }
    if (!dest) {
      var dests = state2.pipes;
      var len = state2.pipesCount;
      state2.pipes = null;
      state2.pipesCount = 0;
      state2.flowing = false;
      for (var i = 0; i < len; i++) dests[i].emit("unpipe", this, {
        hasUnpiped: false
      });
      return this;
    }
    var index2 = indexOf2(state2.pipes, dest);
    if (index2 === -1) return this;
    state2.pipes.splice(index2, 1);
    state2.pipesCount -= 1;
    if (state2.pipesCount === 1) state2.pipes = state2.pipes[0];
    dest.emit("unpipe", this, unpipeInfo);
    return this;
  };
  Readable3.prototype.on = function(ev, fn) {
    var res = Stream2.prototype.on.call(this, ev, fn);
    var state2 = this._readableState;
    if (ev === "data") {
      state2.readableListening = this.listenerCount("readable") > 0;
      if (state2.flowing !== false) this.resume();
    } else if (ev === "readable") {
      if (!state2.endEmitted && !state2.readableListening) {
        state2.readableListening = state2.needReadable = true;
        state2.flowing = false;
        state2.emittedReadable = false;
        debug2("on readable", state2.length, state2.reading);
        if (state2.length) {
          emitReadable(this);
        } else if (!state2.reading) {
          process.nextTick(nReadingNextTick, this);
        }
      }
    }
    return res;
  };
  Readable3.prototype.addListener = Readable3.prototype.on;
  Readable3.prototype.removeListener = function(ev, fn) {
    var res = Stream2.prototype.removeListener.call(this, ev, fn);
    if (ev === "readable") {
      process.nextTick(updateReadableListening, this);
    }
    return res;
  };
  Readable3.prototype.removeAllListeners = function(ev) {
    var res = Stream2.prototype.removeAllListeners.apply(this, arguments);
    if (ev === "readable" || ev === void 0) {
      process.nextTick(updateReadableListening, this);
    }
    return res;
  };
  function updateReadableListening(self2) {
    var state2 = self2._readableState;
    state2.readableListening = self2.listenerCount("readable") > 0;
    if (state2.resumeScheduled && !state2.paused) {
      state2.flowing = true;
    } else if (self2.listenerCount("data") > 0) {
      self2.resume();
    }
  }
  function nReadingNextTick(self2) {
    debug2("readable nexttick read 0");
    self2.read(0);
  }
  Readable3.prototype.resume = function() {
    var state2 = this._readableState;
    if (!state2.flowing) {
      debug2("resume");
      state2.flowing = !state2.readableListening;
      resume(this, state2);
    }
    state2.paused = false;
    return this;
  };
  function resume(stream2, state2) {
    if (!state2.resumeScheduled) {
      state2.resumeScheduled = true;
      process.nextTick(resume_, stream2, state2);
    }
  }
  function resume_(stream2, state2) {
    debug2("resume", state2.reading);
    if (!state2.reading) {
      stream2.read(0);
    }
    state2.resumeScheduled = false;
    stream2.emit("resume");
    flow(stream2);
    if (state2.flowing && !state2.reading) stream2.read(0);
  }
  Readable3.prototype.pause = function() {
    debug2("call pause flowing=%j", this._readableState.flowing);
    if (this._readableState.flowing !== false) {
      debug2("pause");
      this._readableState.flowing = false;
      this.emit("pause");
    }
    this._readableState.paused = true;
    return this;
  };
  function flow(stream2) {
    var state2 = stream2._readableState;
    debug2("flow", state2.flowing);
    while (state2.flowing && stream2.read() !== null) ;
  }
  Readable3.prototype.wrap = function(stream2) {
    var _this = this;
    var state2 = this._readableState;
    var paused = false;
    stream2.on("end", function() {
      debug2("wrapped end");
      if (state2.decoder && !state2.ended) {
        var chunk = state2.decoder.end();
        if (chunk && chunk.length) _this.push(chunk);
      }
      _this.push(null);
    });
    stream2.on("data", function(chunk) {
      debug2("wrapped data");
      if (state2.decoder) chunk = state2.decoder.write(chunk);
      if (state2.objectMode && (chunk === null || chunk === void 0)) return;
      else if (!state2.objectMode && (!chunk || !chunk.length)) return;
      var ret = _this.push(chunk);
      if (!ret) {
        paused = true;
        stream2.pause();
      }
    });
    for (var i in stream2) {
      if (this[i] === void 0 && typeof stream2[i] === "function") {
        this[i] = /* @__PURE__ */ function methodWrap(method) {
          return function methodWrapReturnFunction() {
            return stream2[method].apply(stream2, arguments);
          };
        }(i);
      }
    }
    for (var n = 0; n < kProxyEvents.length; n++) {
      stream2.on(kProxyEvents[n], this.emit.bind(this, kProxyEvents[n]));
    }
    this._read = function(n2) {
      debug2("wrapped _read", n2);
      if (paused) {
        paused = false;
        stream2.resume();
      }
    };
    return this;
  };
  if (typeof Symbol === "function") {
    Readable3.prototype[Symbol.asyncIterator] = function() {
      if (createReadableStreamAsyncIterator === void 0) {
        createReadableStreamAsyncIterator = requireAsync_iterator();
      }
      return createReadableStreamAsyncIterator(this);
    };
  }
  Object.defineProperty(Readable3.prototype, "readableHighWaterMark", {
    // making it explicit this property is not enumerable
    // because otherwise some prototype manipulation in
    // userland will fail
    enumerable: false,
    get: function get() {
      return this._readableState.highWaterMark;
    }
  });
  Object.defineProperty(Readable3.prototype, "readableBuffer", {
    // making it explicit this property is not enumerable
    // because otherwise some prototype manipulation in
    // userland will fail
    enumerable: false,
    get: function get() {
      return this._readableState && this._readableState.buffer;
    }
  });
  Object.defineProperty(Readable3.prototype, "readableFlowing", {
    // making it explicit this property is not enumerable
    // because otherwise some prototype manipulation in
    // userland will fail
    enumerable: false,
    get: function get() {
      return this._readableState.flowing;
    },
    set: function set(state2) {
      if (this._readableState) {
        this._readableState.flowing = state2;
      }
    }
  });
  Readable3._fromList = fromList;
  Object.defineProperty(Readable3.prototype, "readableLength", {
    // making it explicit this property is not enumerable
    // because otherwise some prototype manipulation in
    // userland will fail
    enumerable: false,
    get: function get() {
      return this._readableState.length;
    }
  });
  function fromList(n, state2) {
    if (state2.length === 0) return null;
    var ret;
    if (state2.objectMode) ret = state2.buffer.shift();
    else if (!n || n >= state2.length) {
      if (state2.decoder) ret = state2.buffer.join("");
      else if (state2.buffer.length === 1) ret = state2.buffer.first();
      else ret = state2.buffer.concat(state2.length);
      state2.buffer.clear();
    } else {
      ret = state2.buffer.consume(n, state2.decoder);
    }
    return ret;
  }
  function endReadable(stream2) {
    var state2 = stream2._readableState;
    debug2("endReadable", state2.endEmitted);
    if (!state2.endEmitted) {
      state2.ended = true;
      process.nextTick(endReadableNT, state2, stream2);
    }
  }
  function endReadableNT(state2, stream2) {
    debug2("endReadableNT", state2.endEmitted, state2.length);
    if (!state2.endEmitted && state2.length === 0) {
      state2.endEmitted = true;
      stream2.readable = false;
      stream2.emit("end");
      if (state2.autoDestroy) {
        var wState = stream2._writableState;
        if (!wState || wState.autoDestroy && wState.finished) {
          stream2.destroy();
        }
      }
    }
  }
  if (typeof Symbol === "function") {
    Readable3.from = function(iterable, opts) {
      if (from2 === void 0) {
        from2 = requireFrom();
      }
      return from2(Readable3, iterable, opts);
    };
  }
  function indexOf2(xs, x) {
    for (var i = 0, l = xs.length; i < l; i++) {
      if (xs[i] === x) return i;
    }
    return -1;
  }
  return _stream_readable;
}
var _stream_transform;
var hasRequired_stream_transform;
function require_stream_transform() {
  if (hasRequired_stream_transform) return _stream_transform;
  hasRequired_stream_transform = 1;
  _stream_transform = Transform2;
  var _require$codes = requireErrors().codes, ERR_METHOD_NOT_IMPLEMENTED = _require$codes.ERR_METHOD_NOT_IMPLEMENTED, ERR_MULTIPLE_CALLBACK = _require$codes.ERR_MULTIPLE_CALLBACK, ERR_TRANSFORM_ALREADY_TRANSFORMING = _require$codes.ERR_TRANSFORM_ALREADY_TRANSFORMING, ERR_TRANSFORM_WITH_LENGTH_0 = _require$codes.ERR_TRANSFORM_WITH_LENGTH_0;
  var Duplex2 = require_stream_duplex();
  inheritsExports(Transform2, Duplex2);
  function afterTransform(er, data) {
    var ts = this._transformState;
    ts.transforming = false;
    var cb = ts.writecb;
    if (cb === null) {
      return this.emit("error", new ERR_MULTIPLE_CALLBACK());
    }
    ts.writechunk = null;
    ts.writecb = null;
    if (data != null)
      this.push(data);
    cb(er);
    var rs = this._readableState;
    rs.reading = false;
    if (rs.needReadable || rs.length < rs.highWaterMark) {
      this._read(rs.highWaterMark);
    }
  }
  function Transform2(options) {
    if (!(this instanceof Transform2)) return new Transform2(options);
    Duplex2.call(this, options);
    this._transformState = {
      afterTransform: afterTransform.bind(this),
      needTransform: false,
      transforming: false,
      writecb: null,
      writechunk: null,
      writeencoding: null
    };
    this._readableState.needReadable = true;
    this._readableState.sync = false;
    if (options) {
      if (typeof options.transform === "function") this._transform = options.transform;
      if (typeof options.flush === "function") this._flush = options.flush;
    }
    this.on("prefinish", prefinish);
  }
  function prefinish() {
    var _this = this;
    if (typeof this._flush === "function" && !this._readableState.destroyed) {
      this._flush(function(er, data) {
        done(_this, er, data);
      });
    } else {
      done(this, null, null);
    }
  }
  Transform2.prototype.push = function(chunk, encoding) {
    this._transformState.needTransform = false;
    return Duplex2.prototype.push.call(this, chunk, encoding);
  };
  Transform2.prototype._transform = function(chunk, encoding, cb) {
    cb(new ERR_METHOD_NOT_IMPLEMENTED("_transform()"));
  };
  Transform2.prototype._write = function(chunk, encoding, cb) {
    var ts = this._transformState;
    ts.writecb = cb;
    ts.writechunk = chunk;
    ts.writeencoding = encoding;
    if (!ts.transforming) {
      var rs = this._readableState;
      if (ts.needTransform || rs.needReadable || rs.length < rs.highWaterMark) this._read(rs.highWaterMark);
    }
  };
  Transform2.prototype._read = function(n) {
    var ts = this._transformState;
    if (ts.writechunk !== null && !ts.transforming) {
      ts.transforming = true;
      this._transform(ts.writechunk, ts.writeencoding, ts.afterTransform);
    } else {
      ts.needTransform = true;
    }
  };
  Transform2.prototype._destroy = function(err, cb) {
    Duplex2.prototype._destroy.call(this, err, function(err2) {
      cb(err2);
    });
  };
  function done(stream2, er, data) {
    if (er) return stream2.emit("error", er);
    if (data != null)
      stream2.push(data);
    if (stream2._writableState.length) throw new ERR_TRANSFORM_WITH_LENGTH_0();
    if (stream2._transformState.transforming) throw new ERR_TRANSFORM_ALREADY_TRANSFORMING();
    return stream2.push(null);
  }
  return _stream_transform;
}
var _stream_passthrough;
var hasRequired_stream_passthrough;
function require_stream_passthrough() {
  if (hasRequired_stream_passthrough) return _stream_passthrough;
  hasRequired_stream_passthrough = 1;
  _stream_passthrough = PassThrough2;
  var Transform2 = require_stream_transform();
  inheritsExports(PassThrough2, Transform2);
  function PassThrough2(options) {
    if (!(this instanceof PassThrough2)) return new PassThrough2(options);
    Transform2.call(this, options);
  }
  PassThrough2.prototype._transform = function(chunk, encoding, cb) {
    cb(null, chunk);
  };
  return _stream_passthrough;
}
var pipeline_1;
var hasRequiredPipeline;
function requirePipeline() {
  if (hasRequiredPipeline) return pipeline_1;
  hasRequiredPipeline = 1;
  var eos;
  function once2(callback) {
    var called = false;
    return function() {
      if (called) return;
      called = true;
      callback.apply(void 0, arguments);
    };
  }
  var _require$codes = requireErrors().codes, ERR_MISSING_ARGS = _require$codes.ERR_MISSING_ARGS, ERR_STREAM_DESTROYED = _require$codes.ERR_STREAM_DESTROYED;
  function noop2(err) {
    if (err) throw err;
  }
  function isRequest(stream2) {
    return stream2.setHeader && typeof stream2.abort === "function";
  }
  function destroyer(stream2, reading, writing, callback) {
    callback = once2(callback);
    var closed = false;
    stream2.on("close", function() {
      closed = true;
    });
    if (eos === void 0) eos = requireEndOfStream();
    eos(stream2, {
      readable: reading,
      writable: writing
    }, function(err) {
      if (err) return callback(err);
      closed = true;
      callback();
    });
    var destroyed = false;
    return function(err) {
      if (closed) return;
      if (destroyed) return;
      destroyed = true;
      if (isRequest(stream2)) return stream2.abort();
      if (typeof stream2.destroy === "function") return stream2.destroy();
      callback(err || new ERR_STREAM_DESTROYED("pipe"));
    };
  }
  function call(fn) {
    fn();
  }
  function pipe(from2, to) {
    return from2.pipe(to);
  }
  function popCallback(streams) {
    if (!streams.length) return noop2;
    if (typeof streams[streams.length - 1] !== "function") return noop2;
    return streams.pop();
  }
  function pipeline() {
    for (var _len = arguments.length, streams = new Array(_len), _key = 0; _key < _len; _key++) {
      streams[_key] = arguments[_key];
    }
    var callback = popCallback(streams);
    if (Array.isArray(streams[0])) streams = streams[0];
    if (streams.length < 2) {
      throw new ERR_MISSING_ARGS("streams");
    }
    var error2;
    var destroys = streams.map(function(stream2, i) {
      var reading = i < streams.length - 1;
      var writing = i > 0;
      return destroyer(stream2, reading, writing, function(err) {
        if (!error2) error2 = err;
        if (err) destroys.forEach(call);
        if (reading) return;
        destroys.forEach(call);
        callback(error2);
      });
    });
    return streams.reduce(pipe);
  }
  pipeline_1 = pipeline;
  return pipeline_1;
}
(function(module2, exports) {
  var Stream2 = require$$0$2;
  if (process.env.READABLE_STREAM === "disable" && Stream2) {
    module2.exports = Stream2.Readable;
    Object.assign(module2.exports, Stream2);
    module2.exports.Stream = Stream2;
  } else {
    exports = module2.exports = require_stream_readable();
    exports.Stream = Stream2 || exports;
    exports.Readable = exports;
    exports.Writable = require_stream_writable();
    exports.Duplex = require_stream_duplex();
    exports.Transform = require_stream_transform();
    exports.PassThrough = require_stream_passthrough();
    exports.finished = requireEndOfStream();
    exports.pipeline = requirePipeline();
  }
})(readable, readable.exports);
var readableExports = readable.exports;
var file$1 = { exports: {} };
function arrayPush$1(array, values) {
  var index2 = -1, length = values.length, offset = array.length;
  while (++index2 < length) {
    array[offset + index2] = values[index2];
  }
  return array;
}
var _arrayPush = arrayPush$1;
var Symbol$1 = _Symbol, isArguments = isArguments_1, isArray = isArray_1;
var spreadableSymbol = Symbol$1 ? Symbol$1.isConcatSpreadable : void 0;
function isFlattenable$1(value) {
  return isArray(value) || isArguments(value) || !!(spreadableSymbol && value && value[spreadableSymbol]);
}
var _isFlattenable = isFlattenable$1;
var arrayPush = _arrayPush, isFlattenable = _isFlattenable;
function baseFlatten$3(array, depth, predicate, isStrict, result) {
  var index2 = -1, length = array.length;
  predicate || (predicate = isFlattenable);
  result || (result = []);
  while (++index2 < length) {
    var value = array[index2];
    if (depth > 0 && predicate(value)) {
      if (depth > 1) {
        baseFlatten$3(value, depth - 1, predicate, isStrict, result);
      } else {
        arrayPush(result, value);
      }
    } else if (!isStrict) {
      result[result.length] = value;
    }
  }
  return result;
}
var _baseFlatten = baseFlatten$3;
var baseFlatten$2 = _baseFlatten;
function flatten$1(array) {
  var length = array == null ? 0 : array.length;
  return length ? baseFlatten$2(array, 1) : [];
}
var flatten_1 = flatten$1;
var getNative$2 = _getNative;
var nativeCreate$4 = getNative$2(Object, "create");
var _nativeCreate = nativeCreate$4;
var nativeCreate$3 = _nativeCreate;
function hashClear$1() {
  this.__data__ = nativeCreate$3 ? nativeCreate$3(null) : {};
  this.size = 0;
}
var _hashClear = hashClear$1;
function hashDelete$1(key) {
  var result = this.has(key) && delete this.__data__[key];
  this.size -= result ? 1 : 0;
  return result;
}
var _hashDelete = hashDelete$1;
var nativeCreate$2 = _nativeCreate;
var HASH_UNDEFINED$2 = "__lodash_hash_undefined__";
var objectProto$2 = Object.prototype;
var hasOwnProperty$2 = objectProto$2.hasOwnProperty;
function hashGet$1(key) {
  var data = this.__data__;
  if (nativeCreate$2) {
    var result = data[key];
    return result === HASH_UNDEFINED$2 ? void 0 : result;
  }
  return hasOwnProperty$2.call(data, key) ? data[key] : void 0;
}
var _hashGet = hashGet$1;
var nativeCreate$1 = _nativeCreate;
var objectProto$1 = Object.prototype;
var hasOwnProperty$1 = objectProto$1.hasOwnProperty;
function hashHas$1(key) {
  var data = this.__data__;
  return nativeCreate$1 ? data[key] !== void 0 : hasOwnProperty$1.call(data, key);
}
var _hashHas = hashHas$1;
var nativeCreate = _nativeCreate;
var HASH_UNDEFINED$1 = "__lodash_hash_undefined__";
function hashSet$1(key, value) {
  var data = this.__data__;
  this.size += this.has(key) ? 0 : 1;
  data[key] = nativeCreate && value === void 0 ? HASH_UNDEFINED$1 : value;
  return this;
}
var _hashSet = hashSet$1;
var hashClear = _hashClear, hashDelete = _hashDelete, hashGet = _hashGet, hashHas = _hashHas, hashSet = _hashSet;
function Hash$1(entries) {
  var index2 = -1, length = entries == null ? 0 : entries.length;
  this.clear();
  while (++index2 < length) {
    var entry = entries[index2];
    this.set(entry[0], entry[1]);
  }
}
Hash$1.prototype.clear = hashClear;
Hash$1.prototype["delete"] = hashDelete;
Hash$1.prototype.get = hashGet;
Hash$1.prototype.has = hashHas;
Hash$1.prototype.set = hashSet;
var _Hash = Hash$1;
function listCacheClear$1() {
  this.__data__ = [];
  this.size = 0;
}
var _listCacheClear = listCacheClear$1;
var eq = eq_1;
function assocIndexOf$4(array, key) {
  var length = array.length;
  while (length--) {
    if (eq(array[length][0], key)) {
      return length;
    }
  }
  return -1;
}
var _assocIndexOf = assocIndexOf$4;
var assocIndexOf$3 = _assocIndexOf;
var arrayProto = Array.prototype;
var splice = arrayProto.splice;
function listCacheDelete$1(key) {
  var data = this.__data__, index2 = assocIndexOf$3(data, key);
  if (index2 < 0) {
    return false;
  }
  var lastIndex = data.length - 1;
  if (index2 == lastIndex) {
    data.pop();
  } else {
    splice.call(data, index2, 1);
  }
  --this.size;
  return true;
}
var _listCacheDelete = listCacheDelete$1;
var assocIndexOf$2 = _assocIndexOf;
function listCacheGet$1(key) {
  var data = this.__data__, index2 = assocIndexOf$2(data, key);
  return index2 < 0 ? void 0 : data[index2][1];
}
var _listCacheGet = listCacheGet$1;
var assocIndexOf$1 = _assocIndexOf;
function listCacheHas$1(key) {
  return assocIndexOf$1(this.__data__, key) > -1;
}
var _listCacheHas = listCacheHas$1;
var assocIndexOf = _assocIndexOf;
function listCacheSet$1(key, value) {
  var data = this.__data__, index2 = assocIndexOf(data, key);
  if (index2 < 0) {
    ++this.size;
    data.push([key, value]);
  } else {
    data[index2][1] = value;
  }
  return this;
}
var _listCacheSet = listCacheSet$1;
var listCacheClear = _listCacheClear, listCacheDelete = _listCacheDelete, listCacheGet = _listCacheGet, listCacheHas = _listCacheHas, listCacheSet = _listCacheSet;
function ListCache$1(entries) {
  var index2 = -1, length = entries == null ? 0 : entries.length;
  this.clear();
  while (++index2 < length) {
    var entry = entries[index2];
    this.set(entry[0], entry[1]);
  }
}
ListCache$1.prototype.clear = listCacheClear;
ListCache$1.prototype["delete"] = listCacheDelete;
ListCache$1.prototype.get = listCacheGet;
ListCache$1.prototype.has = listCacheHas;
ListCache$1.prototype.set = listCacheSet;
var _ListCache = ListCache$1;
var getNative$1 = _getNative, root$1 = _root;
var Map$2 = getNative$1(root$1, "Map");
var _Map = Map$2;
var Hash = _Hash, ListCache = _ListCache, Map$1 = _Map;
function mapCacheClear$1() {
  this.size = 0;
  this.__data__ = {
    "hash": new Hash(),
    "map": new (Map$1 || ListCache)(),
    "string": new Hash()
  };
}
var _mapCacheClear = mapCacheClear$1;
function isKeyable$1(value) {
  var type = typeof value;
  return type == "string" || type == "number" || type == "symbol" || type == "boolean" ? value !== "__proto__" : value === null;
}
var _isKeyable = isKeyable$1;
var isKeyable = _isKeyable;
function getMapData$4(map2, key) {
  var data = map2.__data__;
  return isKeyable(key) ? data[typeof key == "string" ? "string" : "hash"] : data.map;
}
var _getMapData = getMapData$4;
var getMapData$3 = _getMapData;
function mapCacheDelete$1(key) {
  var result = getMapData$3(this, key)["delete"](key);
  this.size -= result ? 1 : 0;
  return result;
}
var _mapCacheDelete = mapCacheDelete$1;
var getMapData$2 = _getMapData;
function mapCacheGet$1(key) {
  return getMapData$2(this, key).get(key);
}
var _mapCacheGet = mapCacheGet$1;
var getMapData$1 = _getMapData;
function mapCacheHas$1(key) {
  return getMapData$1(this, key).has(key);
}
var _mapCacheHas = mapCacheHas$1;
var getMapData = _getMapData;
function mapCacheSet$1(key, value) {
  var data = getMapData(this, key), size = data.size;
  data.set(key, value);
  this.size += data.size == size ? 0 : 1;
  return this;
}
var _mapCacheSet = mapCacheSet$1;
var mapCacheClear = _mapCacheClear, mapCacheDelete = _mapCacheDelete, mapCacheGet = _mapCacheGet, mapCacheHas = _mapCacheHas, mapCacheSet = _mapCacheSet;
function MapCache$1(entries) {
  var index2 = -1, length = entries == null ? 0 : entries.length;
  this.clear();
  while (++index2 < length) {
    var entry = entries[index2];
    this.set(entry[0], entry[1]);
  }
}
MapCache$1.prototype.clear = mapCacheClear;
MapCache$1.prototype["delete"] = mapCacheDelete;
MapCache$1.prototype.get = mapCacheGet;
MapCache$1.prototype.has = mapCacheHas;
MapCache$1.prototype.set = mapCacheSet;
var _MapCache = MapCache$1;
var HASH_UNDEFINED = "__lodash_hash_undefined__";
function setCacheAdd$1(value) {
  this.__data__.set(value, HASH_UNDEFINED);
  return this;
}
var _setCacheAdd = setCacheAdd$1;
function setCacheHas$1(value) {
  return this.__data__.has(value);
}
var _setCacheHas = setCacheHas$1;
var MapCache = _MapCache, setCacheAdd = _setCacheAdd, setCacheHas = _setCacheHas;
function SetCache$2(values) {
  var index2 = -1, length = values == null ? 0 : values.length;
  this.__data__ = new MapCache();
  while (++index2 < length) {
    this.add(values[index2]);
  }
}
SetCache$2.prototype.add = SetCache$2.prototype.push = setCacheAdd;
SetCache$2.prototype.has = setCacheHas;
var _SetCache = SetCache$2;
function baseFindIndex$1(array, predicate, fromIndex, fromRight) {
  var length = array.length, index2 = fromIndex + (fromRight ? 1 : -1);
  while (fromRight ? index2-- : ++index2 < length) {
    if (predicate(array[index2], index2, array)) {
      return index2;
    }
  }
  return -1;
}
var _baseFindIndex = baseFindIndex$1;
function baseIsNaN$1(value) {
  return value !== value;
}
var _baseIsNaN = baseIsNaN$1;
function strictIndexOf$1(array, value, fromIndex) {
  var index2 = fromIndex - 1, length = array.length;
  while (++index2 < length) {
    if (array[index2] === value) {
      return index2;
    }
  }
  return -1;
}
var _strictIndexOf = strictIndexOf$1;
var baseFindIndex = _baseFindIndex, baseIsNaN = _baseIsNaN, strictIndexOf = _strictIndexOf;
function baseIndexOf$1(array, value, fromIndex) {
  return value === value ? strictIndexOf(array, value, fromIndex) : baseFindIndex(array, baseIsNaN, fromIndex);
}
var _baseIndexOf = baseIndexOf$1;
var baseIndexOf = _baseIndexOf;
function arrayIncludes$2(array, value) {
  var length = array == null ? 0 : array.length;
  return !!length && baseIndexOf(array, value, 0) > -1;
}
var _arrayIncludes = arrayIncludes$2;
function arrayIncludesWith$2(array, value, comparator) {
  var index2 = -1, length = array == null ? 0 : array.length;
  while (++index2 < length) {
    if (comparator(value, array[index2])) {
      return true;
    }
  }
  return false;
}
var _arrayIncludesWith = arrayIncludesWith$2;
function arrayMap$1(array, iteratee) {
  var index2 = -1, length = array == null ? 0 : array.length, result = Array(length);
  while (++index2 < length) {
    result[index2] = iteratee(array[index2], index2, array);
  }
  return result;
}
var _arrayMap = arrayMap$1;
function cacheHas$2(cache, key) {
  return cache.has(key);
}
var _cacheHas = cacheHas$2;
var SetCache$1 = _SetCache, arrayIncludes$1 = _arrayIncludes, arrayIncludesWith$1 = _arrayIncludesWith, arrayMap = _arrayMap, baseUnary = _baseUnary, cacheHas$1 = _cacheHas;
var LARGE_ARRAY_SIZE$1 = 200;
function baseDifference$1(array, values, iteratee, comparator) {
  var index2 = -1, includes2 = arrayIncludes$1, isCommon = true, length = array.length, result = [], valuesLength = values.length;
  if (!length) {
    return result;
  }
  if (iteratee) {
    values = arrayMap(values, baseUnary(iteratee));
  }
  if (comparator) {
    includes2 = arrayIncludesWith$1;
    isCommon = false;
  } else if (values.length >= LARGE_ARRAY_SIZE$1) {
    includes2 = cacheHas$1;
    isCommon = false;
    values = new SetCache$1(values);
  }
  outer:
    while (++index2 < length) {
      var value = array[index2], computed = iteratee == null ? value : iteratee(value);
      value = comparator || value !== 0 ? value : 0;
      if (isCommon && computed === computed) {
        var valuesIndex = valuesLength;
        while (valuesIndex--) {
          if (values[valuesIndex] === computed) {
            continue outer;
          }
        }
        result.push(value);
      } else if (!includes2(values, computed, comparator)) {
        result.push(value);
      }
    }
  return result;
}
var _baseDifference = baseDifference$1;
var isArrayLike = isArrayLike_1, isObjectLike$1 = isObjectLike_1;
function isArrayLikeObject$2(value) {
  return isObjectLike$1(value) && isArrayLike(value);
}
var isArrayLikeObject_1 = isArrayLikeObject$2;
var baseDifference = _baseDifference, baseFlatten$1 = _baseFlatten, baseRest$1 = _baseRest, isArrayLikeObject$1 = isArrayLikeObject_1;
var difference$1 = baseRest$1(function(array, values) {
  return isArrayLikeObject$1(array) ? baseDifference(array, baseFlatten$1(values, 1, isArrayLikeObject$1, true)) : [];
});
var difference_1 = difference$1;
var getNative = _getNative, root = _root;
var Set$2 = getNative(root, "Set");
var _Set = Set$2;
function noop$4() {
}
var noop_1 = noop$4;
function setToArray$2(set) {
  var index2 = -1, result = Array(set.size);
  set.forEach(function(value) {
    result[++index2] = value;
  });
  return result;
}
var _setToArray = setToArray$2;
var Set$1 = _Set, noop$3 = noop_1, setToArray$1 = _setToArray;
var INFINITY = 1 / 0;
var createSet$1 = !(Set$1 && 1 / setToArray$1(new Set$1([, -0]))[1] == INFINITY) ? noop$3 : function(values) {
  return new Set$1(values);
};
var _createSet = createSet$1;
var SetCache = _SetCache, arrayIncludes = _arrayIncludes, arrayIncludesWith = _arrayIncludesWith, cacheHas = _cacheHas, createSet = _createSet, setToArray = _setToArray;
var LARGE_ARRAY_SIZE = 200;
function baseUniq$1(array, iteratee, comparator) {
  var index2 = -1, includes2 = arrayIncludes, length = array.length, isCommon = true, result = [], seen = result;
  if (comparator) {
    isCommon = false;
    includes2 = arrayIncludesWith;
  } else if (length >= LARGE_ARRAY_SIZE) {
    var set = iteratee ? null : createSet(array);
    if (set) {
      return setToArray(set);
    }
    isCommon = false;
    includes2 = cacheHas;
    seen = new SetCache();
  } else {
    seen = iteratee ? [] : result;
  }
  outer:
    while (++index2 < length) {
      var value = array[index2], computed = iteratee ? iteratee(value) : value;
      value = comparator || value !== 0 ? value : 0;
      if (isCommon && computed === computed) {
        var seenIndex = seen.length;
        while (seenIndex--) {
          if (seen[seenIndex] === computed) {
            continue outer;
          }
        }
        if (iteratee) {
          seen.push(computed);
        }
        result.push(value);
      } else if (!includes2(seen, computed, comparator)) {
        if (seen !== result) {
          seen.push(computed);
        }
        result.push(value);
      }
    }
  return result;
}
var _baseUniq = baseUniq$1;
var baseFlatten = _baseFlatten, baseRest = _baseRest, baseUniq = _baseUniq, isArrayLikeObject = isArrayLikeObject_1;
var union$1 = baseRest(function(arrays) {
  return baseUniq(baseFlatten(arrays, 1, isArrayLikeObject, true));
});
var union_1 = union$1;
function overArg$1(func, transform2) {
  return function(arg) {
    return func(transform2(arg));
  };
}
var _overArg = overArg$1;
var overArg = _overArg;
var getPrototype$1 = overArg(Object.getPrototypeOf, Object);
var _getPrototype = getPrototype$1;
var baseGetTag = _baseGetTag, getPrototype = _getPrototype, isObjectLike = isObjectLike_1;
var objectTag = "[object Object]";
var funcProto = Function.prototype, objectProto = Object.prototype;
var funcToString = funcProto.toString;
var hasOwnProperty = objectProto.hasOwnProperty;
var objectCtorString = funcToString.call(Object);
function isPlainObject$1(value) {
  if (!isObjectLike(value) || baseGetTag(value) != objectTag) {
    return false;
  }
  var proto = getPrototype(value);
  if (proto === null) {
    return true;
  }
  var Ctor = hasOwnProperty.call(proto, "constructor") && proto.constructor;
  return typeof Ctor == "function" && Ctor instanceof Ctor && funcToString.call(Ctor) == objectCtorString;
}
var isPlainObject_1 = isPlainObject$1;
var old$1 = {};
var pathModule = path$6;
var isWindows = process.platform === "win32";
var fs$5 = fs$8;
var DEBUG = process.env.NODE_DEBUG && /fs/.test(process.env.NODE_DEBUG);
function rethrow() {
  var callback;
  if (DEBUG) {
    var backtrace = new Error();
    callback = debugCallback;
  } else
    callback = missingCallback;
  return callback;
  function debugCallback(err) {
    if (err) {
      backtrace.message = err.message;
      err = backtrace;
      missingCallback(err);
    }
  }
  function missingCallback(err) {
    if (err) {
      if (process.throwDeprecation)
        throw err;
      else if (!process.noDeprecation) {
        var msg = "fs: missing callback " + (err.stack || err.message);
        if (process.traceDeprecation)
          console.trace(msg);
        else
          console.error(msg);
      }
    }
  }
}
function maybeCallback(cb) {
  return typeof cb === "function" ? cb : rethrow();
}
pathModule.normalize;
if (isWindows) {
  var nextPartRe = /(.*?)(?:[\/\\]+|$)/g;
} else {
  var nextPartRe = /(.*?)(?:[\/]+|$)/g;
}
if (isWindows) {
  var splitRootRe = /^(?:[a-zA-Z]:|[\\\/]{2}[^\\\/]+[\\\/][^\\\/]+)?[\\\/]*/;
} else {
  var splitRootRe = /^[\/]*/;
}
old$1.realpathSync = function realpathSync(p, cache) {
  p = pathModule.resolve(p);
  if (cache && Object.prototype.hasOwnProperty.call(cache, p)) {
    return cache[p];
  }
  var original = p, seenLinks = {}, knownHard = {};
  var pos;
  var current;
  var base;
  var previous;
  start();
  function start() {
    var m = splitRootRe.exec(p);
    pos = m[0].length;
    current = m[0];
    base = m[0];
    previous = "";
    if (isWindows && !knownHard[base]) {
      fs$5.lstatSync(base);
      knownHard[base] = true;
    }
  }
  while (pos < p.length) {
    nextPartRe.lastIndex = pos;
    var result = nextPartRe.exec(p);
    previous = current;
    current += result[0];
    base = previous + result[1];
    pos = nextPartRe.lastIndex;
    if (knownHard[base] || cache && cache[base] === base) {
      continue;
    }
    var resolvedLink;
    if (cache && Object.prototype.hasOwnProperty.call(cache, base)) {
      resolvedLink = cache[base];
    } else {
      var stat2 = fs$5.lstatSync(base);
      if (!stat2.isSymbolicLink()) {
        knownHard[base] = true;
        if (cache) cache[base] = base;
        continue;
      }
      var linkTarget = null;
      if (!isWindows) {
        var id = stat2.dev.toString(32) + ":" + stat2.ino.toString(32);
        if (seenLinks.hasOwnProperty(id)) {
          linkTarget = seenLinks[id];
        }
      }
      if (linkTarget === null) {
        fs$5.statSync(base);
        linkTarget = fs$5.readlinkSync(base);
      }
      resolvedLink = pathModule.resolve(previous, linkTarget);
      if (cache) cache[base] = resolvedLink;
      if (!isWindows) seenLinks[id] = linkTarget;
    }
    p = pathModule.resolve(resolvedLink, p.slice(pos));
    start();
  }
  if (cache) cache[original] = p;
  return p;
};
old$1.realpath = function realpath(p, cache, cb) {
  if (typeof cb !== "function") {
    cb = maybeCallback(cache);
    cache = null;
  }
  p = pathModule.resolve(p);
  if (cache && Object.prototype.hasOwnProperty.call(cache, p)) {
    return process.nextTick(cb.bind(null, null, cache[p]));
  }
  var original = p, seenLinks = {}, knownHard = {};
  var pos;
  var current;
  var base;
  var previous;
  start();
  function start() {
    var m = splitRootRe.exec(p);
    pos = m[0].length;
    current = m[0];
    base = m[0];
    previous = "";
    if (isWindows && !knownHard[base]) {
      fs$5.lstat(base, function(err) {
        if (err) return cb(err);
        knownHard[base] = true;
        LOOP();
      });
    } else {
      process.nextTick(LOOP);
    }
  }
  function LOOP() {
    if (pos >= p.length) {
      if (cache) cache[original] = p;
      return cb(null, p);
    }
    nextPartRe.lastIndex = pos;
    var result = nextPartRe.exec(p);
    previous = current;
    current += result[0];
    base = previous + result[1];
    pos = nextPartRe.lastIndex;
    if (knownHard[base] || cache && cache[base] === base) {
      return process.nextTick(LOOP);
    }
    if (cache && Object.prototype.hasOwnProperty.call(cache, base)) {
      return gotResolvedLink(cache[base]);
    }
    return fs$5.lstat(base, gotStat);
  }
  function gotStat(err, stat2) {
    if (err) return cb(err);
    if (!stat2.isSymbolicLink()) {
      knownHard[base] = true;
      if (cache) cache[base] = base;
      return process.nextTick(LOOP);
    }
    if (!isWindows) {
      var id = stat2.dev.toString(32) + ":" + stat2.ino.toString(32);
      if (seenLinks.hasOwnProperty(id)) {
        return gotTarget(null, seenLinks[id], base);
      }
    }
    fs$5.stat(base, function(err2) {
      if (err2) return cb(err2);
      fs$5.readlink(base, function(err3, target) {
        if (!isWindows) seenLinks[id] = target;
        gotTarget(err3, target);
      });
    });
  }
  function gotTarget(err, target, base2) {
    if (err) return cb(err);
    var resolvedLink = pathModule.resolve(previous, target);
    if (cache) cache[base2] = resolvedLink;
    gotResolvedLink(resolvedLink);
  }
  function gotResolvedLink(resolvedLink) {
    p = pathModule.resolve(resolvedLink, p.slice(pos));
    start();
  }
};
var fs_realpath = realpath2;
realpath2.realpath = realpath2;
realpath2.sync = realpathSync2;
realpath2.realpathSync = realpathSync2;
realpath2.monkeypatch = monkeypatch;
realpath2.unmonkeypatch = unmonkeypatch;
var fs$4 = fs$8;
var origRealpath = fs$4.realpath;
var origRealpathSync = fs$4.realpathSync;
var version = process.version;
var ok = /^v[0-5]\./.test(version);
var old = old$1;
function newError(er) {
  return er && er.syscall === "realpath" && (er.code === "ELOOP" || er.code === "ENOMEM" || er.code === "ENAMETOOLONG");
}
function realpath2(p, cache, cb) {
  if (ok) {
    return origRealpath(p, cache, cb);
  }
  if (typeof cache === "function") {
    cb = cache;
    cache = null;
  }
  origRealpath(p, cache, function(er, result) {
    if (newError(er)) {
      old.realpath(p, cache, cb);
    } else {
      cb(er, result);
    }
  });
}
function realpathSync2(p, cache) {
  if (ok) {
    return origRealpathSync(p, cache);
  }
  try {
    return origRealpathSync(p, cache);
  } catch (er) {
    if (newError(er)) {
      return old.realpathSync(p, cache);
    } else {
      throw er;
    }
  }
}
function monkeypatch() {
  fs$4.realpath = realpath2;
  fs$4.realpathSync = realpathSync2;
}
function unmonkeypatch() {
  fs$4.realpath = origRealpath;
  fs$4.realpathSync = origRealpathSync;
}
var common = {};
common.setopts = setopts;
common.ownProp = ownProp;
common.makeAbs = makeAbs;
common.finish = finish;
common.mark = mark;
common.isIgnored = isIgnored;
common.childrenIgnored = childrenIgnored;
function ownProp(obj, field) {
  return Object.prototype.hasOwnProperty.call(obj, field);
}
var fs$3 = fs$8;
var path$3 = path$6;
var minimatch = minimatch_1;
var isAbsolute = path$6.isAbsolute;
var Minimatch2 = minimatch.Minimatch;
function alphasort(a, b) {
  return a.localeCompare(b, "en");
}
function setupIgnores(self2, options) {
  self2.ignore = options.ignore || [];
  if (!Array.isArray(self2.ignore))
    self2.ignore = [self2.ignore];
  if (self2.ignore.length) {
    self2.ignore = self2.ignore.map(ignoreMap);
  }
}
function ignoreMap(pattern) {
  var gmatcher = null;
  if (pattern.slice(-3) === "/**") {
    var gpattern = pattern.replace(/(\/\*\*)+$/, "");
    gmatcher = new Minimatch2(gpattern, { dot: true });
  }
  return {
    matcher: new Minimatch2(pattern, { dot: true }),
    gmatcher
  };
}
function setopts(self2, pattern, options) {
  if (!options)
    options = {};
  if (options.matchBase && -1 === pattern.indexOf("/")) {
    if (options.noglobstar) {
      throw new Error("base matching requires globstar");
    }
    pattern = "**/" + pattern;
  }
  self2.windowsPathsNoEscape = !!options.windowsPathsNoEscape || options.allowWindowsEscape === false;
  if (self2.windowsPathsNoEscape) {
    pattern = pattern.replace(/\\/g, "/");
  }
  self2.silent = !!options.silent;
  self2.pattern = pattern;
  self2.strict = options.strict !== false;
  self2.realpath = !!options.realpath;
  self2.realpathCache = options.realpathCache || /* @__PURE__ */ Object.create(null);
  self2.follow = !!options.follow;
  self2.dot = !!options.dot;
  self2.mark = !!options.mark;
  self2.nodir = !!options.nodir;
  if (self2.nodir)
    self2.mark = true;
  self2.sync = !!options.sync;
  self2.nounique = !!options.nounique;
  self2.nonull = !!options.nonull;
  self2.nosort = !!options.nosort;
  self2.nocase = !!options.nocase;
  self2.stat = !!options.stat;
  self2.noprocess = !!options.noprocess;
  self2.absolute = !!options.absolute;
  self2.fs = options.fs || fs$3;
  self2.maxLength = options.maxLength || Infinity;
  self2.cache = options.cache || /* @__PURE__ */ Object.create(null);
  self2.statCache = options.statCache || /* @__PURE__ */ Object.create(null);
  self2.symlinks = options.symlinks || /* @__PURE__ */ Object.create(null);
  setupIgnores(self2, options);
  self2.changedCwd = false;
  var cwd2 = process.cwd();
  if (!ownProp(options, "cwd"))
    self2.cwd = path$3.resolve(cwd2);
  else {
    self2.cwd = path$3.resolve(options.cwd);
    self2.changedCwd = self2.cwd !== cwd2;
  }
  self2.root = options.root || path$3.resolve(self2.cwd, "/");
  self2.root = path$3.resolve(self2.root);
  self2.cwdAbs = isAbsolute(self2.cwd) ? self2.cwd : makeAbs(self2, self2.cwd);
  self2.nomount = !!options.nomount;
  if (process.platform === "win32") {
    self2.root = self2.root.replace(/\\/g, "/");
    self2.cwd = self2.cwd.replace(/\\/g, "/");
    self2.cwdAbs = self2.cwdAbs.replace(/\\/g, "/");
  }
  options.nonegate = true;
  options.nocomment = true;
  self2.minimatch = new Minimatch2(pattern, options);
  self2.options = self2.minimatch.options;
}
function finish(self2) {
  var nou = self2.nounique;
  var all = nou ? [] : /* @__PURE__ */ Object.create(null);
  for (var i = 0, l = self2.matches.length; i < l; i++) {
    var matches = self2.matches[i];
    if (!matches || Object.keys(matches).length === 0) {
      if (self2.nonull) {
        var literal = self2.minimatch.globSet[i];
        if (nou)
          all.push(literal);
        else
          all[literal] = true;
      }
    } else {
      var m = Object.keys(matches);
      if (nou)
        all.push.apply(all, m);
      else
        m.forEach(function(m2) {
          all[m2] = true;
        });
    }
  }
  if (!nou)
    all = Object.keys(all);
  if (!self2.nosort)
    all = all.sort(alphasort);
  if (self2.mark) {
    for (var i = 0; i < all.length; i++) {
      all[i] = self2._mark(all[i]);
    }
    if (self2.nodir) {
      all = all.filter(function(e) {
        var notDir = !/\/$/.test(e);
        var c = self2.cache[e] || self2.cache[makeAbs(self2, e)];
        if (notDir && c)
          notDir = c !== "DIR" && !Array.isArray(c);
        return notDir;
      });
    }
  }
  if (self2.ignore.length)
    all = all.filter(function(m2) {
      return !isIgnored(self2, m2);
    });
  self2.found = all;
}
function mark(self2, p) {
  var abs = makeAbs(self2, p);
  var c = self2.cache[abs];
  var m = p;
  if (c) {
    var isDir = c === "DIR" || Array.isArray(c);
    var slash = p.slice(-1) === "/";
    if (isDir && !slash)
      m += "/";
    else if (!isDir && slash)
      m = m.slice(0, -1);
    if (m !== p) {
      var mabs = makeAbs(self2, m);
      self2.statCache[mabs] = self2.statCache[abs];
      self2.cache[mabs] = self2.cache[abs];
    }
  }
  return m;
}
function makeAbs(self2, f) {
  var abs = f;
  if (f.charAt(0) === "/") {
    abs = path$3.join(self2.root, f);
  } else if (isAbsolute(f) || f === "") {
    abs = f;
  } else if (self2.changedCwd) {
    abs = path$3.resolve(self2.cwd, f);
  } else {
    abs = path$3.resolve(f);
  }
  if (process.platform === "win32")
    abs = abs.replace(/\\/g, "/");
  return abs;
}
function isIgnored(self2, path2) {
  if (!self2.ignore.length)
    return false;
  return self2.ignore.some(function(item) {
    return item.matcher.match(path2) || !!(item.gmatcher && item.gmatcher.match(path2));
  });
}
function childrenIgnored(self2, path2) {
  if (!self2.ignore.length)
    return false;
  return self2.ignore.some(function(item) {
    return !!(item.gmatcher && item.gmatcher.match(path2));
  });
}
var sync;
var hasRequiredSync;
function requireSync() {
  if (hasRequiredSync) return sync;
  hasRequiredSync = 1;
  sync = globSync;
  globSync.GlobSync = GlobSync;
  var rp = fs_realpath;
  var minimatch2 = minimatch_1;
  minimatch2.Minimatch;
  requireGlob().Glob;
  var path2 = path$6;
  var assert = require$$5;
  var isAbsolute2 = path$6.isAbsolute;
  var common$1 = common;
  var setopts2 = common$1.setopts;
  var ownProp2 = common$1.ownProp;
  var childrenIgnored2 = common$1.childrenIgnored;
  var isIgnored2 = common$1.isIgnored;
  function globSync(pattern, options) {
    if (typeof options === "function" || arguments.length === 3)
      throw new TypeError("callback provided to sync glob\nSee: https://github.com/isaacs/node-glob/issues/167");
    return new GlobSync(pattern, options).found;
  }
  function GlobSync(pattern, options) {
    if (!pattern)
      throw new Error("must provide pattern");
    if (typeof options === "function" || arguments.length === 3)
      throw new TypeError("callback provided to sync glob\nSee: https://github.com/isaacs/node-glob/issues/167");
    if (!(this instanceof GlobSync))
      return new GlobSync(pattern, options);
    setopts2(this, pattern, options);
    if (this.noprocess)
      return this;
    var n = this.minimatch.set.length;
    this.matches = new Array(n);
    for (var i = 0; i < n; i++) {
      this._process(this.minimatch.set[i], i, false);
    }
    this._finish();
  }
  GlobSync.prototype._finish = function() {
    assert.ok(this instanceof GlobSync);
    if (this.realpath) {
      var self2 = this;
      this.matches.forEach(function(matchset, index2) {
        var set = self2.matches[index2] = /* @__PURE__ */ Object.create(null);
        for (var p in matchset) {
          try {
            p = self2._makeAbs(p);
            var real = rp.realpathSync(p, self2.realpathCache);
            set[real] = true;
          } catch (er) {
            if (er.syscall === "stat")
              set[self2._makeAbs(p)] = true;
            else
              throw er;
          }
        }
      });
    }
    common$1.finish(this);
  };
  GlobSync.prototype._process = function(pattern, index2, inGlobStar) {
    assert.ok(this instanceof GlobSync);
    var n = 0;
    while (typeof pattern[n] === "string") {
      n++;
    }
    var prefix;
    switch (n) {
      case pattern.length:
        this._processSimple(pattern.join("/"), index2);
        return;
      case 0:
        prefix = null;
        break;
      default:
        prefix = pattern.slice(0, n).join("/");
        break;
    }
    var remain = pattern.slice(n);
    var read;
    if (prefix === null)
      read = ".";
    else if (isAbsolute2(prefix) || isAbsolute2(pattern.map(function(p) {
      return typeof p === "string" ? p : "[*]";
    }).join("/"))) {
      if (!prefix || !isAbsolute2(prefix))
        prefix = "/" + prefix;
      read = prefix;
    } else
      read = prefix;
    var abs = this._makeAbs(read);
    if (childrenIgnored2(this, read))
      return;
    var isGlobStar = remain[0] === minimatch2.GLOBSTAR;
    if (isGlobStar)
      this._processGlobStar(prefix, read, abs, remain, index2, inGlobStar);
    else
      this._processReaddir(prefix, read, abs, remain, index2, inGlobStar);
  };
  GlobSync.prototype._processReaddir = function(prefix, read, abs, remain, index2, inGlobStar) {
    var entries = this._readdir(abs, inGlobStar);
    if (!entries)
      return;
    var pn = remain[0];
    var negate = !!this.minimatch.negate;
    var rawGlob = pn._glob;
    var dotOk = this.dot || rawGlob.charAt(0) === ".";
    var matchedEntries = [];
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      if (e.charAt(0) !== "." || dotOk) {
        var m;
        if (negate && !prefix) {
          m = !e.match(pn);
        } else {
          m = e.match(pn);
        }
        if (m)
          matchedEntries.push(e);
      }
    }
    var len = matchedEntries.length;
    if (len === 0)
      return;
    if (remain.length === 1 && !this.mark && !this.stat) {
      if (!this.matches[index2])
        this.matches[index2] = /* @__PURE__ */ Object.create(null);
      for (var i = 0; i < len; i++) {
        var e = matchedEntries[i];
        if (prefix) {
          if (prefix.slice(-1) !== "/")
            e = prefix + "/" + e;
          else
            e = prefix + e;
        }
        if (e.charAt(0) === "/" && !this.nomount) {
          e = path2.join(this.root, e);
        }
        this._emitMatch(index2, e);
      }
      return;
    }
    remain.shift();
    for (var i = 0; i < len; i++) {
      var e = matchedEntries[i];
      var newPattern;
      if (prefix)
        newPattern = [prefix, e];
      else
        newPattern = [e];
      this._process(newPattern.concat(remain), index2, inGlobStar);
    }
  };
  GlobSync.prototype._emitMatch = function(index2, e) {
    if (isIgnored2(this, e))
      return;
    var abs = this._makeAbs(e);
    if (this.mark)
      e = this._mark(e);
    if (this.absolute) {
      e = abs;
    }
    if (this.matches[index2][e])
      return;
    if (this.nodir) {
      var c = this.cache[abs];
      if (c === "DIR" || Array.isArray(c))
        return;
    }
    this.matches[index2][e] = true;
    if (this.stat)
      this._stat(e);
  };
  GlobSync.prototype._readdirInGlobStar = function(abs) {
    if (this.follow)
      return this._readdir(abs, false);
    var entries;
    var lstat;
    try {
      lstat = this.fs.lstatSync(abs);
    } catch (er) {
      if (er.code === "ENOENT") {
        return null;
      }
    }
    var isSym = lstat && lstat.isSymbolicLink();
    this.symlinks[abs] = isSym;
    if (!isSym && lstat && !lstat.isDirectory())
      this.cache[abs] = "FILE";
    else
      entries = this._readdir(abs, false);
    return entries;
  };
  GlobSync.prototype._readdir = function(abs, inGlobStar) {
    if (inGlobStar && !ownProp2(this.symlinks, abs))
      return this._readdirInGlobStar(abs);
    if (ownProp2(this.cache, abs)) {
      var c = this.cache[abs];
      if (!c || c === "FILE")
        return null;
      if (Array.isArray(c))
        return c;
    }
    try {
      return this._readdirEntries(abs, this.fs.readdirSync(abs));
    } catch (er) {
      this._readdirError(abs, er);
      return null;
    }
  };
  GlobSync.prototype._readdirEntries = function(abs, entries) {
    if (!this.mark && !this.stat) {
      for (var i = 0; i < entries.length; i++) {
        var e = entries[i];
        if (abs === "/")
          e = abs + e;
        else
          e = abs + "/" + e;
        this.cache[e] = true;
      }
    }
    this.cache[abs] = entries;
    return entries;
  };
  GlobSync.prototype._readdirError = function(f, er) {
    switch (er.code) {
      case "ENOTSUP":
      case "ENOTDIR":
        var abs = this._makeAbs(f);
        this.cache[abs] = "FILE";
        if (abs === this.cwdAbs) {
          var error2 = new Error(er.code + " invalid cwd " + this.cwd);
          error2.path = this.cwd;
          error2.code = er.code;
          throw error2;
        }
        break;
      case "ENOENT":
      case "ELOOP":
      case "ENAMETOOLONG":
      case "UNKNOWN":
        this.cache[this._makeAbs(f)] = false;
        break;
      default:
        this.cache[this._makeAbs(f)] = false;
        if (this.strict)
          throw er;
        if (!this.silent)
          console.error("glob error", er);
        break;
    }
  };
  GlobSync.prototype._processGlobStar = function(prefix, read, abs, remain, index2, inGlobStar) {
    var entries = this._readdir(abs, inGlobStar);
    if (!entries)
      return;
    var remainWithoutGlobStar = remain.slice(1);
    var gspref = prefix ? [prefix] : [];
    var noGlobStar = gspref.concat(remainWithoutGlobStar);
    this._process(noGlobStar, index2, false);
    var len = entries.length;
    var isSym = this.symlinks[abs];
    if (isSym && inGlobStar)
      return;
    for (var i = 0; i < len; i++) {
      var e = entries[i];
      if (e.charAt(0) === "." && !this.dot)
        continue;
      var instead = gspref.concat(entries[i], remainWithoutGlobStar);
      this._process(instead, index2, true);
      var below = gspref.concat(entries[i], remain);
      this._process(below, index2, true);
    }
  };
  GlobSync.prototype._processSimple = function(prefix, index2) {
    var exists = this._stat(prefix);
    if (!this.matches[index2])
      this.matches[index2] = /* @__PURE__ */ Object.create(null);
    if (!exists)
      return;
    if (prefix && isAbsolute2(prefix) && !this.nomount) {
      var trail = /[\/\\]$/.test(prefix);
      if (prefix.charAt(0) === "/") {
        prefix = path2.join(this.root, prefix);
      } else {
        prefix = path2.resolve(this.root, prefix);
        if (trail)
          prefix += "/";
      }
    }
    if (process.platform === "win32")
      prefix = prefix.replace(/\\/g, "/");
    this._emitMatch(index2, prefix);
  };
  GlobSync.prototype._stat = function(f) {
    var abs = this._makeAbs(f);
    var needDir = f.slice(-1) === "/";
    if (f.length > this.maxLength)
      return false;
    if (!this.stat && ownProp2(this.cache, abs)) {
      var c = this.cache[abs];
      if (Array.isArray(c))
        c = "DIR";
      if (!needDir || c === "DIR")
        return c;
      if (needDir && c === "FILE")
        return false;
    }
    var stat2 = this.statCache[abs];
    if (!stat2) {
      var lstat;
      try {
        lstat = this.fs.lstatSync(abs);
      } catch (er) {
        if (er && (er.code === "ENOENT" || er.code === "ENOTDIR")) {
          this.statCache[abs] = false;
          return false;
        }
      }
      if (lstat && lstat.isSymbolicLink()) {
        try {
          stat2 = this.fs.statSync(abs);
        } catch (er) {
          stat2 = lstat;
        }
      } else {
        stat2 = lstat;
      }
    }
    this.statCache[abs] = stat2;
    var c = true;
    if (stat2)
      c = stat2.isDirectory() ? "DIR" : "FILE";
    this.cache[abs] = this.cache[abs] || c;
    if (needDir && c === "FILE")
      return false;
    return c;
  };
  GlobSync.prototype._mark = function(p) {
    return common$1.mark(this, p);
  };
  GlobSync.prototype._makeAbs = function(f) {
    return common$1.makeAbs(this, f);
  };
  return sync;
}
var wrappy_1 = wrappy$2;
function wrappy$2(fn, cb) {
  if (fn && cb) return wrappy$2(fn)(cb);
  if (typeof fn !== "function")
    throw new TypeError("need wrapper function");
  Object.keys(fn).forEach(function(k) {
    wrapper[k] = fn[k];
  });
  return wrapper;
  function wrapper() {
    var args = new Array(arguments.length);
    for (var i = 0; i < args.length; i++) {
      args[i] = arguments[i];
    }
    var ret = fn.apply(this, args);
    var cb2 = args[args.length - 1];
    if (typeof ret === "function" && ret !== cb2) {
      Object.keys(cb2).forEach(function(k) {
        ret[k] = cb2[k];
      });
    }
    return ret;
  }
}
var once$2 = { exports: {} };
var wrappy$1 = wrappy_1;
once$2.exports = wrappy$1(once$1);
once$2.exports.strict = wrappy$1(onceStrict);
once$1.proto = once$1(function() {
  Object.defineProperty(Function.prototype, "once", {
    value: function() {
      return once$1(this);
    },
    configurable: true
  });
  Object.defineProperty(Function.prototype, "onceStrict", {
    value: function() {
      return onceStrict(this);
    },
    configurable: true
  });
});
function once$1(fn) {
  var f = function() {
    if (f.called) return f.value;
    f.called = true;
    return f.value = fn.apply(this, arguments);
  };
  f.called = false;
  return f;
}
function onceStrict(fn) {
  var f = function() {
    if (f.called)
      throw new Error(f.onceError);
    f.called = true;
    return f.value = fn.apply(this, arguments);
  };
  var name = fn.name || "Function wrapped with `once`";
  f.onceError = name + " shouldn't be called more than once";
  f.called = false;
  return f;
}
var onceExports = once$2.exports;
var wrappy = wrappy_1;
var reqs = /* @__PURE__ */ Object.create(null);
var once = onceExports;
var inflight_1 = wrappy(inflight);
function inflight(key, cb) {
  if (reqs[key]) {
    reqs[key].push(cb);
    return null;
  } else {
    reqs[key] = [cb];
    return makeres(key);
  }
}
function makeres(key) {
  return once(function RES() {
    var cbs = reqs[key];
    var len = cbs.length;
    var args = slice(arguments);
    try {
      for (var i = 0; i < len; i++) {
        cbs[i].apply(null, args);
      }
    } finally {
      if (cbs.length > len) {
        cbs.splice(0, len);
        process.nextTick(function() {
          RES.apply(null, args);
        });
      } else {
        delete reqs[key];
      }
    }
  });
}
function slice(args) {
  var length = args.length;
  var array = [];
  for (var i = 0; i < length; i++) array[i] = args[i];
  return array;
}
var glob_1;
var hasRequiredGlob;
function requireGlob() {
  if (hasRequiredGlob) return glob_1;
  hasRequiredGlob = 1;
  glob_1 = glob2;
  var rp = fs_realpath;
  var minimatch2 = minimatch_1;
  minimatch2.Minimatch;
  var inherits2 = inheritsExports;
  var EE = require$$0.EventEmitter;
  var path2 = path$6;
  var assert = require$$5;
  var isAbsolute2 = path$6.isAbsolute;
  var globSync = requireSync();
  var common$1 = common;
  var setopts2 = common$1.setopts;
  var ownProp2 = common$1.ownProp;
  var inflight2 = inflight_1;
  var childrenIgnored2 = common$1.childrenIgnored;
  var isIgnored2 = common$1.isIgnored;
  var once2 = onceExports;
  function glob2(pattern, options, cb) {
    if (typeof options === "function") cb = options, options = {};
    if (!options) options = {};
    if (options.sync) {
      if (cb)
        throw new TypeError("callback provided to sync glob");
      return globSync(pattern, options);
    }
    return new Glob(pattern, options, cb);
  }
  glob2.sync = globSync;
  var GlobSync = glob2.GlobSync = globSync.GlobSync;
  glob2.glob = glob2;
  function extend(origin, add) {
    if (add === null || typeof add !== "object") {
      return origin;
    }
    var keys = Object.keys(add);
    var i = keys.length;
    while (i--) {
      origin[keys[i]] = add[keys[i]];
    }
    return origin;
  }
  glob2.hasMagic = function(pattern, options_) {
    var options = extend({}, options_);
    options.noprocess = true;
    var g = new Glob(pattern, options);
    var set = g.minimatch.set;
    if (!pattern)
      return false;
    if (set.length > 1)
      return true;
    for (var j = 0; j < set[0].length; j++) {
      if (typeof set[0][j] !== "string")
        return true;
    }
    return false;
  };
  glob2.Glob = Glob;
  inherits2(Glob, EE);
  function Glob(pattern, options, cb) {
    if (typeof options === "function") {
      cb = options;
      options = null;
    }
    if (options && options.sync) {
      if (cb)
        throw new TypeError("callback provided to sync glob");
      return new GlobSync(pattern, options);
    }
    if (!(this instanceof Glob))
      return new Glob(pattern, options, cb);
    setopts2(this, pattern, options);
    this._didRealPath = false;
    var n = this.minimatch.set.length;
    this.matches = new Array(n);
    if (typeof cb === "function") {
      cb = once2(cb);
      this.on("error", cb);
      this.on("end", function(matches) {
        cb(null, matches);
      });
    }
    var self2 = this;
    this._processing = 0;
    this._emitQueue = [];
    this._processQueue = [];
    this.paused = false;
    if (this.noprocess)
      return this;
    if (n === 0)
      return done();
    var sync2 = true;
    for (var i = 0; i < n; i++) {
      this._process(this.minimatch.set[i], i, false, done);
    }
    sync2 = false;
    function done() {
      --self2._processing;
      if (self2._processing <= 0) {
        if (sync2) {
          process.nextTick(function() {
            self2._finish();
          });
        } else {
          self2._finish();
        }
      }
    }
  }
  Glob.prototype._finish = function() {
    assert(this instanceof Glob);
    if (this.aborted)
      return;
    if (this.realpath && !this._didRealpath)
      return this._realpath();
    common$1.finish(this);
    this.emit("end", this.found);
  };
  Glob.prototype._realpath = function() {
    if (this._didRealpath)
      return;
    this._didRealpath = true;
    var n = this.matches.length;
    if (n === 0)
      return this._finish();
    var self2 = this;
    for (var i = 0; i < this.matches.length; i++)
      this._realpathSet(i, next);
    function next() {
      if (--n === 0)
        self2._finish();
    }
  };
  Glob.prototype._realpathSet = function(index2, cb) {
    var matchset = this.matches[index2];
    if (!matchset)
      return cb();
    var found = Object.keys(matchset);
    var self2 = this;
    var n = found.length;
    if (n === 0)
      return cb();
    var set = this.matches[index2] = /* @__PURE__ */ Object.create(null);
    found.forEach(function(p, i) {
      p = self2._makeAbs(p);
      rp.realpath(p, self2.realpathCache, function(er, real) {
        if (!er)
          set[real] = true;
        else if (er.syscall === "stat")
          set[p] = true;
        else
          self2.emit("error", er);
        if (--n === 0) {
          self2.matches[index2] = set;
          cb();
        }
      });
    });
  };
  Glob.prototype._mark = function(p) {
    return common$1.mark(this, p);
  };
  Glob.prototype._makeAbs = function(f) {
    return common$1.makeAbs(this, f);
  };
  Glob.prototype.abort = function() {
    this.aborted = true;
    this.emit("abort");
  };
  Glob.prototype.pause = function() {
    if (!this.paused) {
      this.paused = true;
      this.emit("pause");
    }
  };
  Glob.prototype.resume = function() {
    if (this.paused) {
      this.emit("resume");
      this.paused = false;
      if (this._emitQueue.length) {
        var eq2 = this._emitQueue.slice(0);
        this._emitQueue.length = 0;
        for (var i = 0; i < eq2.length; i++) {
          var e = eq2[i];
          this._emitMatch(e[0], e[1]);
        }
      }
      if (this._processQueue.length) {
        var pq = this._processQueue.slice(0);
        this._processQueue.length = 0;
        for (var i = 0; i < pq.length; i++) {
          var p = pq[i];
          this._processing--;
          this._process(p[0], p[1], p[2], p[3]);
        }
      }
    }
  };
  Glob.prototype._process = function(pattern, index2, inGlobStar, cb) {
    assert(this instanceof Glob);
    assert(typeof cb === "function");
    if (this.aborted)
      return;
    this._processing++;
    if (this.paused) {
      this._processQueue.push([pattern, index2, inGlobStar, cb]);
      return;
    }
    var n = 0;
    while (typeof pattern[n] === "string") {
      n++;
    }
    var prefix;
    switch (n) {
      case pattern.length:
        this._processSimple(pattern.join("/"), index2, cb);
        return;
      case 0:
        prefix = null;
        break;
      default:
        prefix = pattern.slice(0, n).join("/");
        break;
    }
    var remain = pattern.slice(n);
    var read;
    if (prefix === null)
      read = ".";
    else if (isAbsolute2(prefix) || isAbsolute2(pattern.map(function(p) {
      return typeof p === "string" ? p : "[*]";
    }).join("/"))) {
      if (!prefix || !isAbsolute2(prefix))
        prefix = "/" + prefix;
      read = prefix;
    } else
      read = prefix;
    var abs = this._makeAbs(read);
    if (childrenIgnored2(this, read))
      return cb();
    var isGlobStar = remain[0] === minimatch2.GLOBSTAR;
    if (isGlobStar)
      this._processGlobStar(prefix, read, abs, remain, index2, inGlobStar, cb);
    else
      this._processReaddir(prefix, read, abs, remain, index2, inGlobStar, cb);
  };
  Glob.prototype._processReaddir = function(prefix, read, abs, remain, index2, inGlobStar, cb) {
    var self2 = this;
    this._readdir(abs, inGlobStar, function(er, entries) {
      return self2._processReaddir2(prefix, read, abs, remain, index2, inGlobStar, entries, cb);
    });
  };
  Glob.prototype._processReaddir2 = function(prefix, read, abs, remain, index2, inGlobStar, entries, cb) {
    if (!entries)
      return cb();
    var pn = remain[0];
    var negate = !!this.minimatch.negate;
    var rawGlob = pn._glob;
    var dotOk = this.dot || rawGlob.charAt(0) === ".";
    var matchedEntries = [];
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      if (e.charAt(0) !== "." || dotOk) {
        var m;
        if (negate && !prefix) {
          m = !e.match(pn);
        } else {
          m = e.match(pn);
        }
        if (m)
          matchedEntries.push(e);
      }
    }
    var len = matchedEntries.length;
    if (len === 0)
      return cb();
    if (remain.length === 1 && !this.mark && !this.stat) {
      if (!this.matches[index2])
        this.matches[index2] = /* @__PURE__ */ Object.create(null);
      for (var i = 0; i < len; i++) {
        var e = matchedEntries[i];
        if (prefix) {
          if (prefix !== "/")
            e = prefix + "/" + e;
          else
            e = prefix + e;
        }
        if (e.charAt(0) === "/" && !this.nomount) {
          e = path2.join(this.root, e);
        }
        this._emitMatch(index2, e);
      }
      return cb();
    }
    remain.shift();
    for (var i = 0; i < len; i++) {
      var e = matchedEntries[i];
      if (prefix) {
        if (prefix !== "/")
          e = prefix + "/" + e;
        else
          e = prefix + e;
      }
      this._process([e].concat(remain), index2, inGlobStar, cb);
    }
    cb();
  };
  Glob.prototype._emitMatch = function(index2, e) {
    if (this.aborted)
      return;
    if (isIgnored2(this, e))
      return;
    if (this.paused) {
      this._emitQueue.push([index2, e]);
      return;
    }
    var abs = isAbsolute2(e) ? e : this._makeAbs(e);
    if (this.mark)
      e = this._mark(e);
    if (this.absolute)
      e = abs;
    if (this.matches[index2][e])
      return;
    if (this.nodir) {
      var c = this.cache[abs];
      if (c === "DIR" || Array.isArray(c))
        return;
    }
    this.matches[index2][e] = true;
    var st = this.statCache[abs];
    if (st)
      this.emit("stat", e, st);
    this.emit("match", e);
  };
  Glob.prototype._readdirInGlobStar = function(abs, cb) {
    if (this.aborted)
      return;
    if (this.follow)
      return this._readdir(abs, false, cb);
    var lstatkey = "lstat\0" + abs;
    var self2 = this;
    var lstatcb = inflight2(lstatkey, lstatcb_);
    if (lstatcb)
      self2.fs.lstat(abs, lstatcb);
    function lstatcb_(er, lstat) {
      if (er && er.code === "ENOENT")
        return cb();
      var isSym = lstat && lstat.isSymbolicLink();
      self2.symlinks[abs] = isSym;
      if (!isSym && lstat && !lstat.isDirectory()) {
        self2.cache[abs] = "FILE";
        cb();
      } else
        self2._readdir(abs, false, cb);
    }
  };
  Glob.prototype._readdir = function(abs, inGlobStar, cb) {
    if (this.aborted)
      return;
    cb = inflight2("readdir\0" + abs + "\0" + inGlobStar, cb);
    if (!cb)
      return;
    if (inGlobStar && !ownProp2(this.symlinks, abs))
      return this._readdirInGlobStar(abs, cb);
    if (ownProp2(this.cache, abs)) {
      var c = this.cache[abs];
      if (!c || c === "FILE")
        return cb();
      if (Array.isArray(c))
        return cb(null, c);
    }
    var self2 = this;
    self2.fs.readdir(abs, readdirCb(this, abs, cb));
  };
  function readdirCb(self2, abs, cb) {
    return function(er, entries) {
      if (er)
        self2._readdirError(abs, er, cb);
      else
        self2._readdirEntries(abs, entries, cb);
    };
  }
  Glob.prototype._readdirEntries = function(abs, entries, cb) {
    if (this.aborted)
      return;
    if (!this.mark && !this.stat) {
      for (var i = 0; i < entries.length; i++) {
        var e = entries[i];
        if (abs === "/")
          e = abs + e;
        else
          e = abs + "/" + e;
        this.cache[e] = true;
      }
    }
    this.cache[abs] = entries;
    return cb(null, entries);
  };
  Glob.prototype._readdirError = function(f, er, cb) {
    if (this.aborted)
      return;
    switch (er.code) {
      case "ENOTSUP":
      case "ENOTDIR":
        var abs = this._makeAbs(f);
        this.cache[abs] = "FILE";
        if (abs === this.cwdAbs) {
          var error2 = new Error(er.code + " invalid cwd " + this.cwd);
          error2.path = this.cwd;
          error2.code = er.code;
          this.emit("error", error2);
          this.abort();
        }
        break;
      case "ENOENT":
      case "ELOOP":
      case "ENAMETOOLONG":
      case "UNKNOWN":
        this.cache[this._makeAbs(f)] = false;
        break;
      default:
        this.cache[this._makeAbs(f)] = false;
        if (this.strict) {
          this.emit("error", er);
          this.abort();
        }
        if (!this.silent)
          console.error("glob error", er);
        break;
    }
    return cb();
  };
  Glob.prototype._processGlobStar = function(prefix, read, abs, remain, index2, inGlobStar, cb) {
    var self2 = this;
    this._readdir(abs, inGlobStar, function(er, entries) {
      self2._processGlobStar2(prefix, read, abs, remain, index2, inGlobStar, entries, cb);
    });
  };
  Glob.prototype._processGlobStar2 = function(prefix, read, abs, remain, index2, inGlobStar, entries, cb) {
    if (!entries)
      return cb();
    var remainWithoutGlobStar = remain.slice(1);
    var gspref = prefix ? [prefix] : [];
    var noGlobStar = gspref.concat(remainWithoutGlobStar);
    this._process(noGlobStar, index2, false, cb);
    var isSym = this.symlinks[abs];
    var len = entries.length;
    if (isSym && inGlobStar)
      return cb();
    for (var i = 0; i < len; i++) {
      var e = entries[i];
      if (e.charAt(0) === "." && !this.dot)
        continue;
      var instead = gspref.concat(entries[i], remainWithoutGlobStar);
      this._process(instead, index2, true, cb);
      var below = gspref.concat(entries[i], remain);
      this._process(below, index2, true, cb);
    }
    cb();
  };
  Glob.prototype._processSimple = function(prefix, index2, cb) {
    var self2 = this;
    this._stat(prefix, function(er, exists) {
      self2._processSimple2(prefix, index2, er, exists, cb);
    });
  };
  Glob.prototype._processSimple2 = function(prefix, index2, er, exists, cb) {
    if (!this.matches[index2])
      this.matches[index2] = /* @__PURE__ */ Object.create(null);
    if (!exists)
      return cb();
    if (prefix && isAbsolute2(prefix) && !this.nomount) {
      var trail = /[\/\\]$/.test(prefix);
      if (prefix.charAt(0) === "/") {
        prefix = path2.join(this.root, prefix);
      } else {
        prefix = path2.resolve(this.root, prefix);
        if (trail)
          prefix += "/";
      }
    }
    if (process.platform === "win32")
      prefix = prefix.replace(/\\/g, "/");
    this._emitMatch(index2, prefix);
    cb();
  };
  Glob.prototype._stat = function(f, cb) {
    var abs = this._makeAbs(f);
    var needDir = f.slice(-1) === "/";
    if (f.length > this.maxLength)
      return cb();
    if (!this.stat && ownProp2(this.cache, abs)) {
      var c = this.cache[abs];
      if (Array.isArray(c))
        c = "DIR";
      if (!needDir || c === "DIR")
        return cb(null, c);
      if (needDir && c === "FILE")
        return cb();
    }
    var stat2 = this.statCache[abs];
    if (stat2 !== void 0) {
      if (stat2 === false)
        return cb(null, stat2);
      else {
        var type = stat2.isDirectory() ? "DIR" : "FILE";
        if (needDir && type === "FILE")
          return cb();
        else
          return cb(null, type, stat2);
      }
    }
    var self2 = this;
    var statcb = inflight2("stat\0" + abs, lstatcb_);
    if (statcb)
      self2.fs.lstat(abs, statcb);
    function lstatcb_(er, lstat) {
      if (lstat && lstat.isSymbolicLink()) {
        return self2.fs.stat(abs, function(er2, stat3) {
          if (er2)
            self2._stat2(f, abs, null, lstat, cb);
          else
            self2._stat2(f, abs, er2, stat3, cb);
        });
      } else {
        self2._stat2(f, abs, er, lstat, cb);
      }
    }
  };
  Glob.prototype._stat2 = function(f, abs, er, stat2, cb) {
    if (er && (er.code === "ENOENT" || er.code === "ENOTDIR")) {
      this.statCache[abs] = false;
      return cb();
    }
    var needDir = f.slice(-1) === "/";
    this.statCache[abs] = stat2;
    if (abs.slice(-1) === "/" && stat2 && !stat2.isDirectory())
      return cb(null, false, stat2);
    var c = true;
    if (stat2)
      c = stat2.isDirectory() ? "DIR" : "FILE";
    this.cache[abs] = this.cache[abs] || c;
    if (needDir && c === "FILE")
      return cb();
    return cb(null, c, stat2);
  };
  return glob_1;
}
var fs$2 = gracefulFs;
var path$2 = path$6;
var flatten = flatten_1;
var difference = difference_1;
var union = union_1;
var isPlainObject = isPlainObject_1;
var glob$1 = requireGlob();
var file = file$1.exports = {};
var pathSeparatorRe = /[\/\\]/g;
var processPatterns = function(patterns, fn) {
  var result = [];
  flatten(patterns).forEach(function(pattern) {
    var exclusion = pattern.indexOf("!") === 0;
    if (exclusion) {
      pattern = pattern.slice(1);
    }
    var matches = fn(pattern);
    if (exclusion) {
      result = difference(result, matches);
    } else {
      result = union(result, matches);
    }
  });
  return result;
};
file.exists = function() {
  var filepath = path$2.join.apply(path$2, arguments);
  return fs$2.existsSync(filepath);
};
file.expand = function(...args) {
  var options = isPlainObject(args[0]) ? args.shift() : {};
  var patterns = Array.isArray(args[0]) ? args[0] : args;
  if (patterns.length === 0) {
    return [];
  }
  var matches = processPatterns(patterns, function(pattern) {
    return glob$1.sync(pattern, options);
  });
  if (options.filter) {
    matches = matches.filter(function(filepath) {
      filepath = path$2.join(options.cwd || "", filepath);
      try {
        if (typeof options.filter === "function") {
          return options.filter(filepath);
        } else {
          return fs$2.statSync(filepath)[options.filter]();
        }
      } catch (e) {
        return false;
      }
    });
  }
  return matches;
};
file.expandMapping = function(patterns, destBase, options) {
  options = Object.assign({
    rename: function(destBase2, destPath) {
      return path$2.join(destBase2 || "", destPath);
    }
  }, options);
  var files = [];
  var fileByDest = {};
  file.expand(options, patterns).forEach(function(src) {
    var destPath = src;
    if (options.flatten) {
      destPath = path$2.basename(destPath);
    }
    if (options.ext) {
      destPath = destPath.replace(/(\.[^\/]*)?$/, options.ext);
    }
    var dest = options.rename(destBase, destPath, options);
    if (options.cwd) {
      src = path$2.join(options.cwd, src);
    }
    dest = dest.replace(pathSeparatorRe, "/");
    src = src.replace(pathSeparatorRe, "/");
    if (fileByDest[dest]) {
      fileByDest[dest].src.push(src);
    } else {
      files.push({
        src: [src],
        dest
      });
      fileByDest[dest] = files[files.length - 1];
    }
  });
  return files;
};
file.normalizeFilesArray = function(data) {
  var files = [];
  data.forEach(function(obj) {
    if ("src" in obj || "dest" in obj) {
      files.push(obj);
    }
  });
  if (files.length === 0) {
    return [];
  }
  files = _(files).chain().forEach(function(obj) {
    if (!("src" in obj) || !obj.src) {
      return;
    }
    if (Array.isArray(obj.src)) {
      obj.src = flatten(obj.src);
    } else {
      obj.src = [obj.src];
    }
  }).map(function(obj) {
    var expandOptions = Object.assign({}, obj);
    delete expandOptions.src;
    delete expandOptions.dest;
    if (obj.expand) {
      return file.expandMapping(obj.src, obj.dest, expandOptions).map(function(mapObj) {
        var result2 = Object.assign({}, obj);
        result2.orig = Object.assign({}, obj);
        result2.src = mapObj.src;
        result2.dest = mapObj.dest;
        ["expand", "cwd", "flatten", "rename", "ext"].forEach(function(prop) {
          delete result2[prop];
        });
        return result2;
      });
    }
    var result = Object.assign({}, obj);
    result.orig = Object.assign({}, obj);
    if ("src" in result) {
      Object.defineProperty(result, "src", {
        enumerable: true,
        get: function fn() {
          var src;
          if (!("result" in fn)) {
            src = obj.src;
            src = Array.isArray(src) ? flatten(src) : [src];
            fn.result = file.expand(expandOptions, src);
          }
          return fn.result;
        }
      });
    }
    if ("dest" in result) {
      result.dest = obj.dest;
    }
    return result;
  }).flatten().value();
  return files;
};
var fileExports = file$1.exports;
var fs$1 = gracefulFs;
var path$1 = path$6;
var lazystream = lazystream$1;
var normalizePath$1 = normalizePath$2;
var defaults = defaults_1;
var Stream$2 = require$$0$2.Stream;
var PassThrough$1 = readableExports.PassThrough;
var utils = archiverUtils.exports = {};
utils.file = fileExports;
utils.collectStream = function(source, callback) {
  var collection = [];
  var size = 0;
  source.on("error", callback);
  source.on("data", function(chunk) {
    collection.push(chunk);
    size += chunk.length;
  });
  source.on("end", function() {
    var buf = Buffer.alloc(size);
    var offset = 0;
    collection.forEach(function(data) {
      data.copy(buf, offset);
      offset += data.length;
    });
    callback(null, buf);
  });
};
utils.dateify = function(dateish) {
  dateish = dateish || /* @__PURE__ */ new Date();
  if (dateish instanceof Date) {
    dateish = dateish;
  } else if (typeof dateish === "string") {
    dateish = new Date(dateish);
  } else {
    dateish = /* @__PURE__ */ new Date();
  }
  return dateish;
};
utils.defaults = function(object, source, guard) {
  var args = arguments;
  args[0] = args[0] || {};
  return defaults(...args);
};
utils.isStream = function(source) {
  return source instanceof Stream$2;
};
utils.lazyReadStream = function(filepath) {
  return new lazystream.Readable(function() {
    return fs$1.createReadStream(filepath);
  });
};
utils.normalizeInputSource = function(source) {
  if (source === null) {
    return Buffer.alloc(0);
  } else if (typeof source === "string") {
    return Buffer.from(source);
  } else if (utils.isStream(source)) {
    return source.pipe(new PassThrough$1());
  }
  return source;
};
utils.sanitizePath = function(filepath) {
  return normalizePath$1(filepath, false).replace(/^\w+:/, "").replace(/^(\.\.\/|\/)+/, "");
};
utils.trailingSlashIt = function(str) {
  return str.slice(-1) !== "/" ? str + "/" : str;
};
utils.unixifyPath = function(filepath) {
  return normalizePath$1(filepath, false).replace(/^\w+:/, "");
};
utils.walkdir = function(dirpath, base, callback) {
  var results = [];
  if (typeof base === "function") {
    callback = base;
    base = dirpath;
  }
  fs$1.readdir(dirpath, function(err, list) {
    var i = 0;
    var file2;
    var filepath;
    if (err) {
      return callback(err);
    }
    (function next() {
      file2 = list[i++];
      if (!file2) {
        return callback(null, results);
      }
      filepath = path$1.join(dirpath, file2);
      fs$1.stat(filepath, function(err2, stats) {
        results.push({
          path: filepath,
          relative: path$1.relative(base, filepath).replace(/\\/g, "/"),
          stats
        });
        if (stats && stats.isDirectory()) {
          utils.walkdir(filepath, base, function(err3, res) {
            if (err3) {
              return callback(err3);
            }
            res.forEach(function(dirEntry) {
              results.push(dirEntry);
            });
            next();
          });
        } else {
          next();
        }
      });
    })();
  });
};
var archiverUtilsExports = archiverUtils.exports;
var error = { exports: {} };
/**
 * Archiver Core
 *
 * @ignore
 * @license [MIT]{@link https://github.com/archiverjs/node-archiver/blob/master/LICENSE}
 * @copyright (c) 2012-2014 Chris Talkington, contributors.
 */
(function(module2, exports) {
  var util2 = require$$0$3;
  const ERROR_CODES = {
    "ABORTED": "archive was aborted",
    "DIRECTORYDIRPATHREQUIRED": "diretory dirpath argument must be a non-empty string value",
    "DIRECTORYFUNCTIONINVALIDDATA": "invalid data returned by directory custom data function",
    "ENTRYNAMEREQUIRED": "entry name must be a non-empty string value",
    "FILEFILEPATHREQUIRED": "file filepath argument must be a non-empty string value",
    "FINALIZING": "archive already finalizing",
    "QUEUECLOSED": "queue closed",
    "NOENDMETHOD": "no suitable finalize/end method defined by module",
    "DIRECTORYNOTSUPPORTED": "support for directory entries not defined by module",
    "FORMATSET": "archive format already set",
    "INPUTSTEAMBUFFERREQUIRED": "input source must be valid Stream or Buffer instance",
    "MODULESET": "module already set",
    "SYMLINKNOTSUPPORTED": "support for symlink entries not defined by module",
    "SYMLINKFILEPATHREQUIRED": "symlink filepath argument must be a non-empty string value",
    "SYMLINKTARGETREQUIRED": "symlink target argument must be a non-empty string value",
    "ENTRYNOTSUPPORTED": "entry not supported"
  };
  function ArchiverError2(code, data) {
    Error.captureStackTrace(this, this.constructor);
    this.message = ERROR_CODES[code] || code;
    this.code = code;
    this.data = data;
  }
  util2.inherits(ArchiverError2, Error);
  module2.exports = ArchiverError2;
})(error);
var errorExports = error.exports;
/**
 * Archiver Core
 *
 * @ignore
 * @license [MIT]{@link https://github.com/archiverjs/node-archiver/blob/master/LICENSE}
 * @copyright (c) 2012-2014 Chris Talkington, contributors.
 */
var fs = fs$8;
var glob = readdirGlob_1;
var async = require$$2;
var path = path$6;
var util$9 = archiverUtilsExports;
var inherits$5 = require$$0$3.inherits;
var ArchiverError = errorExports;
var Transform$3 = readableExports.Transform;
var win32 = process.platform === "win32";
var Archiver$1 = function(format, options) {
  if (!(this instanceof Archiver$1)) {
    return new Archiver$1(format, options);
  }
  if (typeof format !== "string") {
    options = format;
    format = "zip";
  }
  options = this.options = util$9.defaults(options, {
    highWaterMark: 1024 * 1024,
    statConcurrency: 4
  });
  Transform$3.call(this, options);
  this._format = false;
  this._module = false;
  this._pending = 0;
  this._pointer = 0;
  this._entriesCount = 0;
  this._entriesProcessedCount = 0;
  this._fsEntriesTotalBytes = 0;
  this._fsEntriesProcessedBytes = 0;
  this._queue = async.queue(this._onQueueTask.bind(this), 1);
  this._queue.drain(this._onQueueDrain.bind(this));
  this._statQueue = async.queue(this._onStatQueueTask.bind(this), options.statConcurrency);
  this._statQueue.drain(this._onQueueDrain.bind(this));
  this._state = {
    aborted: false,
    finalize: false,
    finalizing: false,
    finalized: false,
    modulePiped: false
  };
  this._streams = [];
};
inherits$5(Archiver$1, Transform$3);
Archiver$1.prototype._abort = function() {
  this._state.aborted = true;
  this._queue.kill();
  this._statQueue.kill();
  if (this._queue.idle()) {
    this._shutdown();
  }
};
Archiver$1.prototype._append = function(filepath, data) {
  data = data || {};
  var task = {
    source: null,
    filepath
  };
  if (!data.name) {
    data.name = filepath;
  }
  data.sourcePath = filepath;
  task.data = data;
  this._entriesCount++;
  if (data.stats && data.stats instanceof fs.Stats) {
    task = this._updateQueueTaskWithStats(task, data.stats);
    if (task) {
      if (data.stats.size) {
        this._fsEntriesTotalBytes += data.stats.size;
      }
      this._queue.push(task);
    }
  } else {
    this._statQueue.push(task);
  }
};
Archiver$1.prototype._finalize = function() {
  if (this._state.finalizing || this._state.finalized || this._state.aborted) {
    return;
  }
  this._state.finalizing = true;
  this._moduleFinalize();
  this._state.finalizing = false;
  this._state.finalized = true;
};
Archiver$1.prototype._maybeFinalize = function() {
  if (this._state.finalizing || this._state.finalized || this._state.aborted) {
    return false;
  }
  if (this._state.finalize && this._pending === 0 && this._queue.idle() && this._statQueue.idle()) {
    this._finalize();
    return true;
  }
  return false;
};
Archiver$1.prototype._moduleAppend = function(source, data, callback) {
  if (this._state.aborted) {
    callback();
    return;
  }
  this._module.append(source, data, (function(err) {
    this._task = null;
    if (this._state.aborted) {
      this._shutdown();
      return;
    }
    if (err) {
      this.emit("error", err);
      setImmediate(callback);
      return;
    }
    this.emit("entry", data);
    this._entriesProcessedCount++;
    if (data.stats && data.stats.size) {
      this._fsEntriesProcessedBytes += data.stats.size;
    }
    this.emit("progress", {
      entries: {
        total: this._entriesCount,
        processed: this._entriesProcessedCount
      },
      fs: {
        totalBytes: this._fsEntriesTotalBytes,
        processedBytes: this._fsEntriesProcessedBytes
      }
    });
    setImmediate(callback);
  }).bind(this));
};
Archiver$1.prototype._moduleFinalize = function() {
  if (typeof this._module.finalize === "function") {
    this._module.finalize();
  } else if (typeof this._module.end === "function") {
    this._module.end();
  } else {
    this.emit("error", new ArchiverError("NOENDMETHOD"));
  }
};
Archiver$1.prototype._modulePipe = function() {
  this._module.on("error", this._onModuleError.bind(this));
  this._module.pipe(this);
  this._state.modulePiped = true;
};
Archiver$1.prototype._moduleSupports = function(key) {
  if (!this._module.supports || !this._module.supports[key]) {
    return false;
  }
  return this._module.supports[key];
};
Archiver$1.prototype._moduleUnpipe = function() {
  this._module.unpipe(this);
  this._state.modulePiped = false;
};
Archiver$1.prototype._normalizeEntryData = function(data, stats) {
  data = util$9.defaults(data, {
    type: "file",
    name: null,
    date: null,
    mode: null,
    prefix: null,
    sourcePath: null,
    stats: false
  });
  if (stats && data.stats === false) {
    data.stats = stats;
  }
  var isDir = data.type === "directory";
  if (data.name) {
    if (typeof data.prefix === "string" && "" !== data.prefix) {
      data.name = data.prefix + "/" + data.name;
      data.prefix = null;
    }
    data.name = util$9.sanitizePath(data.name);
    if (data.type !== "symlink" && data.name.slice(-1) === "/") {
      isDir = true;
      data.type = "directory";
    } else if (isDir) {
      data.name += "/";
    }
  }
  if (typeof data.mode === "number") {
    if (win32) {
      data.mode &= 511;
    } else {
      data.mode &= 4095;
    }
  } else if (data.stats && data.mode === null) {
    if (win32) {
      data.mode = data.stats.mode & 511;
    } else {
      data.mode = data.stats.mode & 4095;
    }
    if (win32 && isDir) {
      data.mode = 493;
    }
  } else if (data.mode === null) {
    data.mode = isDir ? 493 : 420;
  }
  if (data.stats && data.date === null) {
    data.date = data.stats.mtime;
  } else {
    data.date = util$9.dateify(data.date);
  }
  return data;
};
Archiver$1.prototype._onModuleError = function(err) {
  this.emit("error", err);
};
Archiver$1.prototype._onQueueDrain = function() {
  if (this._state.finalizing || this._state.finalized || this._state.aborted) {
    return;
  }
  if (this._state.finalize && this._pending === 0 && this._queue.idle() && this._statQueue.idle()) {
    this._finalize();
  }
};
Archiver$1.prototype._onQueueTask = function(task, callback) {
  var fullCallback = () => {
    if (task.data.callback) {
      task.data.callback();
    }
    callback();
  };
  if (this._state.finalizing || this._state.finalized || this._state.aborted) {
    fullCallback();
    return;
  }
  this._task = task;
  this._moduleAppend(task.source, task.data, fullCallback);
};
Archiver$1.prototype._onStatQueueTask = function(task, callback) {
  if (this._state.finalizing || this._state.finalized || this._state.aborted) {
    callback();
    return;
  }
  fs.lstat(task.filepath, (function(err, stats) {
    if (this._state.aborted) {
      setImmediate(callback);
      return;
    }
    if (err) {
      this._entriesCount--;
      this.emit("warning", err);
      setImmediate(callback);
      return;
    }
    task = this._updateQueueTaskWithStats(task, stats);
    if (task) {
      if (stats.size) {
        this._fsEntriesTotalBytes += stats.size;
      }
      this._queue.push(task);
    }
    setImmediate(callback);
  }).bind(this));
};
Archiver$1.prototype._shutdown = function() {
  this._moduleUnpipe();
  this.end();
};
Archiver$1.prototype._transform = function(chunk, encoding, callback) {
  if (chunk) {
    this._pointer += chunk.length;
  }
  callback(null, chunk);
};
Archiver$1.prototype._updateQueueTaskWithStats = function(task, stats) {
  if (stats.isFile()) {
    task.data.type = "file";
    task.data.sourceType = "stream";
    task.source = util$9.lazyReadStream(task.filepath);
  } else if (stats.isDirectory() && this._moduleSupports("directory")) {
    task.data.name = util$9.trailingSlashIt(task.data.name);
    task.data.type = "directory";
    task.data.sourcePath = util$9.trailingSlashIt(task.filepath);
    task.data.sourceType = "buffer";
    task.source = Buffer.concat([]);
  } else if (stats.isSymbolicLink() && this._moduleSupports("symlink")) {
    var linkPath = fs.readlinkSync(task.filepath);
    var dirName = path.dirname(task.filepath);
    task.data.type = "symlink";
    task.data.linkname = path.relative(dirName, path.resolve(dirName, linkPath));
    task.data.sourceType = "buffer";
    task.source = Buffer.concat([]);
  } else {
    if (stats.isDirectory()) {
      this.emit("warning", new ArchiverError("DIRECTORYNOTSUPPORTED", task.data));
    } else if (stats.isSymbolicLink()) {
      this.emit("warning", new ArchiverError("SYMLINKNOTSUPPORTED", task.data));
    } else {
      this.emit("warning", new ArchiverError("ENTRYNOTSUPPORTED", task.data));
    }
    return null;
  }
  task.data = this._normalizeEntryData(task.data, stats);
  return task;
};
Archiver$1.prototype.abort = function() {
  if (this._state.aborted || this._state.finalized) {
    return this;
  }
  this._abort();
  return this;
};
Archiver$1.prototype.append = function(source, data) {
  if (this._state.finalize || this._state.aborted) {
    this.emit("error", new ArchiverError("QUEUECLOSED"));
    return this;
  }
  data = this._normalizeEntryData(data);
  if (typeof data.name !== "string" || data.name.length === 0) {
    this.emit("error", new ArchiverError("ENTRYNAMEREQUIRED"));
    return this;
  }
  if (data.type === "directory" && !this._moduleSupports("directory")) {
    this.emit("error", new ArchiverError("DIRECTORYNOTSUPPORTED", { name: data.name }));
    return this;
  }
  source = util$9.normalizeInputSource(source);
  if (Buffer.isBuffer(source)) {
    data.sourceType = "buffer";
  } else if (util$9.isStream(source)) {
    data.sourceType = "stream";
  } else {
    this.emit("error", new ArchiverError("INPUTSTEAMBUFFERREQUIRED", { name: data.name }));
    return this;
  }
  this._entriesCount++;
  this._queue.push({
    data,
    source
  });
  return this;
};
Archiver$1.prototype.directory = function(dirpath, destpath, data) {
  if (this._state.finalize || this._state.aborted) {
    this.emit("error", new ArchiverError("QUEUECLOSED"));
    return this;
  }
  if (typeof dirpath !== "string" || dirpath.length === 0) {
    this.emit("error", new ArchiverError("DIRECTORYDIRPATHREQUIRED"));
    return this;
  }
  this._pending++;
  if (destpath === false) {
    destpath = "";
  } else if (typeof destpath !== "string") {
    destpath = dirpath;
  }
  var dataFunction = false;
  if (typeof data === "function") {
    dataFunction = data;
    data = {};
  } else if (typeof data !== "object") {
    data = {};
  }
  var globOptions = {
    stat: true,
    dot: true
  };
  function onGlobEnd() {
    this._pending--;
    this._maybeFinalize();
  }
  function onGlobError(err) {
    this.emit("error", err);
  }
  function onGlobMatch(match) {
    globber.pause();
    var ignoreMatch = false;
    var entryData = Object.assign({}, data);
    entryData.name = match.relative;
    entryData.prefix = destpath;
    entryData.stats = match.stat;
    entryData.callback = globber.resume.bind(globber);
    try {
      if (dataFunction) {
        entryData = dataFunction(entryData);
        if (entryData === false) {
          ignoreMatch = true;
        } else if (typeof entryData !== "object") {
          throw new ArchiverError("DIRECTORYFUNCTIONINVALIDDATA", { dirpath });
        }
      }
    } catch (e) {
      this.emit("error", e);
      return;
    }
    if (ignoreMatch) {
      globber.resume();
      return;
    }
    this._append(match.absolute, entryData);
  }
  var globber = glob(dirpath, globOptions);
  globber.on("error", onGlobError.bind(this));
  globber.on("match", onGlobMatch.bind(this));
  globber.on("end", onGlobEnd.bind(this));
  return this;
};
Archiver$1.prototype.file = function(filepath, data) {
  if (this._state.finalize || this._state.aborted) {
    this.emit("error", new ArchiverError("QUEUECLOSED"));
    return this;
  }
  if (typeof filepath !== "string" || filepath.length === 0) {
    this.emit("error", new ArchiverError("FILEFILEPATHREQUIRED"));
    return this;
  }
  this._append(filepath, data);
  return this;
};
Archiver$1.prototype.glob = function(pattern, options, data) {
  this._pending++;
  options = util$9.defaults(options, {
    stat: true,
    pattern
  });
  function onGlobEnd() {
    this._pending--;
    this._maybeFinalize();
  }
  function onGlobError(err) {
    this.emit("error", err);
  }
  function onGlobMatch(match) {
    globber.pause();
    var entryData = Object.assign({}, data);
    entryData.callback = globber.resume.bind(globber);
    entryData.stats = match.stat;
    entryData.name = match.relative;
    this._append(match.absolute, entryData);
  }
  var globber = glob(options.cwd || ".", options);
  globber.on("error", onGlobError.bind(this));
  globber.on("match", onGlobMatch.bind(this));
  globber.on("end", onGlobEnd.bind(this));
  return this;
};
Archiver$1.prototype.finalize = function() {
  if (this._state.aborted) {
    var abortedError = new ArchiverError("ABORTED");
    this.emit("error", abortedError);
    return Promise.reject(abortedError);
  }
  if (this._state.finalize) {
    var finalizingError = new ArchiverError("FINALIZING");
    this.emit("error", finalizingError);
    return Promise.reject(finalizingError);
  }
  this._state.finalize = true;
  if (this._pending === 0 && this._queue.idle() && this._statQueue.idle()) {
    this._finalize();
  }
  var self2 = this;
  return new Promise(function(resolve2, reject2) {
    var errored;
    self2._module.on("end", function() {
      if (!errored) {
        resolve2();
      }
    });
    self2._module.on("error", function(err) {
      errored = true;
      reject2(err);
    });
  });
};
Archiver$1.prototype.setFormat = function(format) {
  if (this._format) {
    this.emit("error", new ArchiverError("FORMATSET"));
    return this;
  }
  this._format = format;
  return this;
};
Archiver$1.prototype.setModule = function(module2) {
  if (this._state.aborted) {
    this.emit("error", new ArchiverError("ABORTED"));
    return this;
  }
  if (this._state.module) {
    this.emit("error", new ArchiverError("MODULESET"));
    return this;
  }
  this._module = module2;
  this._modulePipe();
  return this;
};
Archiver$1.prototype.symlink = function(filepath, target, mode) {
  if (this._state.finalize || this._state.aborted) {
    this.emit("error", new ArchiverError("QUEUECLOSED"));
    return this;
  }
  if (typeof filepath !== "string" || filepath.length === 0) {
    this.emit("error", new ArchiverError("SYMLINKFILEPATHREQUIRED"));
    return this;
  }
  if (typeof target !== "string" || target.length === 0) {
    this.emit("error", new ArchiverError("SYMLINKTARGETREQUIRED", { filepath }));
    return this;
  }
  if (!this._moduleSupports("symlink")) {
    this.emit("error", new ArchiverError("SYMLINKNOTSUPPORTED", { filepath }));
    return this;
  }
  var data = {};
  data.type = "symlink";
  data.name = filepath.replace(/\\/g, "/");
  data.linkname = target.replace(/\\/g, "/");
  data.sourceType = "buffer";
  if (typeof mode === "number") {
    data.mode = mode;
  }
  this._entriesCount++;
  this._queue.push({
    data,
    source: Buffer.concat([])
  });
  return this;
};
Archiver$1.prototype.pointer = function() {
  return this._pointer;
};
Archiver$1.prototype.use = function(plugin) {
  this._streams.push(plugin);
  return this;
};
var core = Archiver$1;
var zipStream = { exports: {} };
var archiveEntry = { exports: {} };
var ArchiveEntry$2 = archiveEntry.exports = function() {
};
ArchiveEntry$2.prototype.getName = function() {
};
ArchiveEntry$2.prototype.getSize = function() {
};
ArchiveEntry$2.prototype.getLastModifiedDate = function() {
};
ArchiveEntry$2.prototype.isDirectory = function() {
};
var archiveEntryExports = archiveEntry.exports;
var zipArchiveEntry = { exports: {} };
var generalPurposeBit = { exports: {} };
var util$8 = { exports: {} };
var util$7 = util$8.exports = {};
util$7.dateToDos = function(d, forceLocalTime) {
  forceLocalTime = forceLocalTime || false;
  var year = forceLocalTime ? d.getFullYear() : d.getUTCFullYear();
  if (year < 1980) {
    return 2162688;
  } else if (year >= 2044) {
    return 2141175677;
  }
  var val = {
    year,
    month: forceLocalTime ? d.getMonth() : d.getUTCMonth(),
    date: forceLocalTime ? d.getDate() : d.getUTCDate(),
    hours: forceLocalTime ? d.getHours() : d.getUTCHours(),
    minutes: forceLocalTime ? d.getMinutes() : d.getUTCMinutes(),
    seconds: forceLocalTime ? d.getSeconds() : d.getUTCSeconds()
  };
  return val.year - 1980 << 25 | val.month + 1 << 21 | val.date << 16 | val.hours << 11 | val.minutes << 5 | val.seconds / 2;
};
util$7.dosToDate = function(dos) {
  return new Date((dos >> 25 & 127) + 1980, (dos >> 21 & 15) - 1, dos >> 16 & 31, dos >> 11 & 31, dos >> 5 & 63, (dos & 31) << 1);
};
util$7.fromDosTime = function(buf) {
  return util$7.dosToDate(buf.readUInt32LE(0));
};
util$7.getEightBytes = function(v) {
  var buf = Buffer.alloc(8);
  buf.writeUInt32LE(v % 4294967296, 0);
  buf.writeUInt32LE(v / 4294967296 | 0, 4);
  return buf;
};
util$7.getShortBytes = function(v) {
  var buf = Buffer.alloc(2);
  buf.writeUInt16LE((v & 65535) >>> 0, 0);
  return buf;
};
util$7.getShortBytesValue = function(buf, offset) {
  return buf.readUInt16LE(offset);
};
util$7.getLongBytes = function(v) {
  var buf = Buffer.alloc(4);
  buf.writeUInt32LE((v & 4294967295) >>> 0, 0);
  return buf;
};
util$7.getLongBytesValue = function(buf, offset) {
  return buf.readUInt32LE(offset);
};
util$7.toDosTime = function(d) {
  return util$7.getLongBytes(util$7.dateToDos(d));
};
var utilExports$1 = util$8.exports;
var zipUtil$2 = utilExports$1;
var DATA_DESCRIPTOR_FLAG = 1 << 3;
var ENCRYPTION_FLAG = 1 << 0;
var NUMBER_OF_SHANNON_FANO_TREES_FLAG = 1 << 2;
var SLIDING_DICTIONARY_SIZE_FLAG = 1 << 1;
var STRONG_ENCRYPTION_FLAG = 1 << 6;
var UFT8_NAMES_FLAG = 1 << 11;
var GeneralPurposeBit$1 = generalPurposeBit.exports = function() {
  if (!(this instanceof GeneralPurposeBit$1)) {
    return new GeneralPurposeBit$1();
  }
  this.descriptor = false;
  this.encryption = false;
  this.utf8 = false;
  this.numberOfShannonFanoTrees = 0;
  this.strongEncryption = false;
  this.slidingDictionarySize = 0;
  return this;
};
GeneralPurposeBit$1.prototype.encode = function() {
  return zipUtil$2.getShortBytes(
    (this.descriptor ? DATA_DESCRIPTOR_FLAG : 0) | (this.utf8 ? UFT8_NAMES_FLAG : 0) | (this.encryption ? ENCRYPTION_FLAG : 0) | (this.strongEncryption ? STRONG_ENCRYPTION_FLAG : 0)
  );
};
GeneralPurposeBit$1.prototype.parse = function(buf, offset) {
  var flag = zipUtil$2.getShortBytesValue(buf, offset);
  var gbp = new GeneralPurposeBit$1();
  gbp.useDataDescriptor((flag & DATA_DESCRIPTOR_FLAG) !== 0);
  gbp.useUTF8ForNames((flag & UFT8_NAMES_FLAG) !== 0);
  gbp.useStrongEncryption((flag & STRONG_ENCRYPTION_FLAG) !== 0);
  gbp.useEncryption((flag & ENCRYPTION_FLAG) !== 0);
  gbp.setSlidingDictionarySize((flag & SLIDING_DICTIONARY_SIZE_FLAG) !== 0 ? 8192 : 4096);
  gbp.setNumberOfShannonFanoTrees((flag & NUMBER_OF_SHANNON_FANO_TREES_FLAG) !== 0 ? 3 : 2);
  return gbp;
};
GeneralPurposeBit$1.prototype.setNumberOfShannonFanoTrees = function(n) {
  this.numberOfShannonFanoTrees = n;
};
GeneralPurposeBit$1.prototype.getNumberOfShannonFanoTrees = function() {
  return this.numberOfShannonFanoTrees;
};
GeneralPurposeBit$1.prototype.setSlidingDictionarySize = function(n) {
  this.slidingDictionarySize = n;
};
GeneralPurposeBit$1.prototype.getSlidingDictionarySize = function() {
  return this.slidingDictionarySize;
};
GeneralPurposeBit$1.prototype.useDataDescriptor = function(b) {
  this.descriptor = b;
};
GeneralPurposeBit$1.prototype.usesDataDescriptor = function() {
  return this.descriptor;
};
GeneralPurposeBit$1.prototype.useEncryption = function(b) {
  this.encryption = b;
};
GeneralPurposeBit$1.prototype.usesEncryption = function() {
  return this.encryption;
};
GeneralPurposeBit$1.prototype.useStrongEncryption = function(b) {
  this.strongEncryption = b;
};
GeneralPurposeBit$1.prototype.usesStrongEncryption = function() {
  return this.strongEncryption;
};
GeneralPurposeBit$1.prototype.useUTF8ForNames = function(b) {
  this.utf8 = b;
};
GeneralPurposeBit$1.prototype.usesUTF8ForNames = function() {
  return this.utf8;
};
var generalPurposeBitExports = generalPurposeBit.exports;
var unixStat = {
  /**
   * Bits used to indicate the filesystem object type.
   */
  FILE_TYPE_FLAG: 61440,
  // 0170000
  /**
   * Indicates symbolic links.
   */
  LINK_FLAG: 40960
};
var constants$5 = {
  EMPTY: Buffer.alloc(0),
  SHORT_MASK: 65535,
  SHORT_SHIFT: 16,
  SHORT_ZERO: Buffer.from(Array(2)),
  LONG_ZERO: Buffer.from(Array(4)),
  MIN_VERSION_INITIAL: 10,
  MIN_VERSION_DATA_DESCRIPTOR: 20,
  MIN_VERSION_ZIP64: 45,
  VERSION_MADEBY: 45,
  METHOD_STORED: 0,
  METHOD_DEFLATED: 8,
  PLATFORM_UNIX: 3,
  PLATFORM_FAT: 0,
  SIG_LFH: 67324752,
  SIG_DD: 134695760,
  SIG_CFH: 33639248,
  SIG_EOCD: 101010256,
  SIG_ZIP64_EOCD: 101075792,
  SIG_ZIP64_EOCD_LOC: 117853008,
  ZIP64_MAGIC_SHORT: 65535,
  ZIP64_MAGIC: 4294967295,
  ZIP64_EXTRA_ID: 1,
  ZLIB_BEST_SPEED: 1,
  MODE_MASK: 4095,
  S_IFDIR: 16384,
  // 040000 directory
  S_IFREG: 32768,
  // 0100000 regular
  // DOS file type flags
  S_DOS_A: 32,
  // 040 Archive
  S_DOS_D: 16
};
var inherits$4 = require$$0$3.inherits;
var normalizePath = normalizePath$2;
var ArchiveEntry$1 = archiveEntryExports;
var GeneralPurposeBit = generalPurposeBitExports;
var UnixStat = unixStat;
var constants$4 = constants$5;
var zipUtil$1 = utilExports$1;
var ZipArchiveEntry$1 = zipArchiveEntry.exports = function(name) {
  if (!(this instanceof ZipArchiveEntry$1)) {
    return new ZipArchiveEntry$1(name);
  }
  ArchiveEntry$1.call(this);
  this.platform = constants$4.PLATFORM_FAT;
  this.method = -1;
  this.name = null;
  this.size = 0;
  this.csize = 0;
  this.gpb = new GeneralPurposeBit();
  this.crc = 0;
  this.time = -1;
  this.minver = constants$4.MIN_VERSION_INITIAL;
  this.mode = -1;
  this.extra = null;
  this.exattr = 0;
  this.inattr = 0;
  this.comment = null;
  if (name) {
    this.setName(name);
  }
};
inherits$4(ZipArchiveEntry$1, ArchiveEntry$1);
ZipArchiveEntry$1.prototype.getCentralDirectoryExtra = function() {
  return this.getExtra();
};
ZipArchiveEntry$1.prototype.getComment = function() {
  return this.comment !== null ? this.comment : "";
};
ZipArchiveEntry$1.prototype.getCompressedSize = function() {
  return this.csize;
};
ZipArchiveEntry$1.prototype.getCrc = function() {
  return this.crc;
};
ZipArchiveEntry$1.prototype.getExternalAttributes = function() {
  return this.exattr;
};
ZipArchiveEntry$1.prototype.getExtra = function() {
  return this.extra !== null ? this.extra : constants$4.EMPTY;
};
ZipArchiveEntry$1.prototype.getGeneralPurposeBit = function() {
  return this.gpb;
};
ZipArchiveEntry$1.prototype.getInternalAttributes = function() {
  return this.inattr;
};
ZipArchiveEntry$1.prototype.getLastModifiedDate = function() {
  return this.getTime();
};
ZipArchiveEntry$1.prototype.getLocalFileDataExtra = function() {
  return this.getExtra();
};
ZipArchiveEntry$1.prototype.getMethod = function() {
  return this.method;
};
ZipArchiveEntry$1.prototype.getName = function() {
  return this.name;
};
ZipArchiveEntry$1.prototype.getPlatform = function() {
  return this.platform;
};
ZipArchiveEntry$1.prototype.getSize = function() {
  return this.size;
};
ZipArchiveEntry$1.prototype.getTime = function() {
  return this.time !== -1 ? zipUtil$1.dosToDate(this.time) : -1;
};
ZipArchiveEntry$1.prototype.getTimeDos = function() {
  return this.time !== -1 ? this.time : 0;
};
ZipArchiveEntry$1.prototype.getUnixMode = function() {
  return this.platform !== constants$4.PLATFORM_UNIX ? 0 : this.getExternalAttributes() >> constants$4.SHORT_SHIFT & constants$4.SHORT_MASK;
};
ZipArchiveEntry$1.prototype.getVersionNeededToExtract = function() {
  return this.minver;
};
ZipArchiveEntry$1.prototype.setComment = function(comment) {
  if (Buffer.byteLength(comment) !== comment.length) {
    this.getGeneralPurposeBit().useUTF8ForNames(true);
  }
  this.comment = comment;
};
ZipArchiveEntry$1.prototype.setCompressedSize = function(size) {
  if (size < 0) {
    throw new Error("invalid entry compressed size");
  }
  this.csize = size;
};
ZipArchiveEntry$1.prototype.setCrc = function(crc) {
  if (crc < 0) {
    throw new Error("invalid entry crc32");
  }
  this.crc = crc;
};
ZipArchiveEntry$1.prototype.setExternalAttributes = function(attr) {
  this.exattr = attr >>> 0;
};
ZipArchiveEntry$1.prototype.setExtra = function(extra) {
  this.extra = extra;
};
ZipArchiveEntry$1.prototype.setGeneralPurposeBit = function(gpb) {
  if (!(gpb instanceof GeneralPurposeBit)) {
    throw new Error("invalid entry GeneralPurposeBit");
  }
  this.gpb = gpb;
};
ZipArchiveEntry$1.prototype.setInternalAttributes = function(attr) {
  this.inattr = attr;
};
ZipArchiveEntry$1.prototype.setMethod = function(method) {
  if (method < 0) {
    throw new Error("invalid entry compression method");
  }
  this.method = method;
};
ZipArchiveEntry$1.prototype.setName = function(name, prependSlash = false) {
  name = normalizePath(name, false).replace(/^\w+:/, "").replace(/^(\.\.\/|\/)+/, "");
  if (prependSlash) {
    name = `/${name}`;
  }
  if (Buffer.byteLength(name) !== name.length) {
    this.getGeneralPurposeBit().useUTF8ForNames(true);
  }
  this.name = name;
};
ZipArchiveEntry$1.prototype.setPlatform = function(platform2) {
  this.platform = platform2;
};
ZipArchiveEntry$1.prototype.setSize = function(size) {
  if (size < 0) {
    throw new Error("invalid entry size");
  }
  this.size = size;
};
ZipArchiveEntry$1.prototype.setTime = function(time, forceLocalTime) {
  if (!(time instanceof Date)) {
    throw new Error("invalid entry time");
  }
  this.time = zipUtil$1.dateToDos(time, forceLocalTime);
};
ZipArchiveEntry$1.prototype.setUnixMode = function(mode) {
  mode |= this.isDirectory() ? constants$4.S_IFDIR : constants$4.S_IFREG;
  var extattr = 0;
  extattr |= mode << constants$4.SHORT_SHIFT | (this.isDirectory() ? constants$4.S_DOS_D : constants$4.S_DOS_A);
  this.setExternalAttributes(extattr);
  this.mode = mode & constants$4.MODE_MASK;
  this.platform = constants$4.PLATFORM_UNIX;
};
ZipArchiveEntry$1.prototype.setVersionNeededToExtract = function(minver) {
  this.minver = minver;
};
ZipArchiveEntry$1.prototype.isDirectory = function() {
  return this.getName().slice(-1) === "/";
};
ZipArchiveEntry$1.prototype.isUnixSymlink = function() {
  return (this.getUnixMode() & UnixStat.FILE_TYPE_FLAG) === UnixStat.LINK_FLAG;
};
ZipArchiveEntry$1.prototype.isZip64 = function() {
  return this.csize > constants$4.ZIP64_MAGIC || this.size > constants$4.ZIP64_MAGIC;
};
var zipArchiveEntryExports = zipArchiveEntry.exports;
var archiveOutputStream = { exports: {} };
var util$6 = { exports: {} };
var Stream$1 = require$$0$2.Stream;
var PassThrough = readableExports.PassThrough;
var util$5 = util$6.exports = {};
util$5.isStream = function(source) {
  return source instanceof Stream$1;
};
util$5.normalizeInputSource = function(source) {
  if (source === null) {
    return Buffer.alloc(0);
  } else if (typeof source === "string") {
    return Buffer.from(source);
  } else if (util$5.isStream(source) && !source._readableState) {
    var normalized = new PassThrough();
    source.pipe(normalized);
    return normalized;
  }
  return source;
};
var utilExports = util$6.exports;
var inherits$3 = require$$0$3.inherits;
var Transform$2 = readableExports.Transform;
var ArchiveEntry = archiveEntryExports;
var util$4 = utilExports;
var ArchiveOutputStream$1 = archiveOutputStream.exports = function(options) {
  if (!(this instanceof ArchiveOutputStream$1)) {
    return new ArchiveOutputStream$1(options);
  }
  Transform$2.call(this, options);
  this.offset = 0;
  this._archive = {
    finish: false,
    finished: false,
    processing: false
  };
};
inherits$3(ArchiveOutputStream$1, Transform$2);
ArchiveOutputStream$1.prototype._appendBuffer = function(zae, source, callback) {
};
ArchiveOutputStream$1.prototype._appendStream = function(zae, source, callback) {
};
ArchiveOutputStream$1.prototype._emitErrorCallback = function(err) {
  if (err) {
    this.emit("error", err);
  }
};
ArchiveOutputStream$1.prototype._finish = function(ae) {
};
ArchiveOutputStream$1.prototype._normalizeEntry = function(ae) {
};
ArchiveOutputStream$1.prototype._transform = function(chunk, encoding, callback) {
  callback(null, chunk);
};
ArchiveOutputStream$1.prototype.entry = function(ae, source, callback) {
  source = source || null;
  if (typeof callback !== "function") {
    callback = this._emitErrorCallback.bind(this);
  }
  if (!(ae instanceof ArchiveEntry)) {
    callback(new Error("not a valid instance of ArchiveEntry"));
    return;
  }
  if (this._archive.finish || this._archive.finished) {
    callback(new Error("unacceptable entry after finish"));
    return;
  }
  if (this._archive.processing) {
    callback(new Error("already processing an entry"));
    return;
  }
  this._archive.processing = true;
  this._normalizeEntry(ae);
  this._entry = ae;
  source = util$4.normalizeInputSource(source);
  if (Buffer.isBuffer(source)) {
    this._appendBuffer(ae, source, callback);
  } else if (util$4.isStream(source)) {
    this._appendStream(ae, source, callback);
  } else {
    this._archive.processing = false;
    callback(new Error("input source must be valid Stream or Buffer instance"));
    return;
  }
  return this;
};
ArchiveOutputStream$1.prototype.finish = function() {
  if (this._archive.processing) {
    this._archive.finish = true;
    return;
  }
  this._finish();
};
ArchiveOutputStream$1.prototype.getBytesWritten = function() {
  return this.offset;
};
ArchiveOutputStream$1.prototype.write = function(chunk, cb) {
  if (chunk) {
    this.offset += chunk.length;
  }
  return Transform$2.prototype.write.call(this, chunk, cb);
};
var archiveOutputStreamExports = archiveOutputStream.exports;
var zipArchiveOutputStream = { exports: {} };
var crc32$5 = {};
/*! crc32.js (C) 2014-present SheetJS -- http://sheetjs.com */
(function(exports) {
  (function(factory) {
    if (typeof DO_NOT_EXPORT_CRC === "undefined") {
      {
        factory(exports);
      }
    } else {
      factory({});
    }
  })(function(CRC32) {
    CRC32.version = "1.2.2";
    function signed_crc_table() {
      var c = 0, table = new Array(256);
      for (var n = 0; n != 256; ++n) {
        c = n;
        c = c & 1 ? -306674912 ^ c >>> 1 : c >>> 1;
        c = c & 1 ? -306674912 ^ c >>> 1 : c >>> 1;
        c = c & 1 ? -306674912 ^ c >>> 1 : c >>> 1;
        c = c & 1 ? -306674912 ^ c >>> 1 : c >>> 1;
        c = c & 1 ? -306674912 ^ c >>> 1 : c >>> 1;
        c = c & 1 ? -306674912 ^ c >>> 1 : c >>> 1;
        c = c & 1 ? -306674912 ^ c >>> 1 : c >>> 1;
        c = c & 1 ? -306674912 ^ c >>> 1 : c >>> 1;
        table[n] = c;
      }
      return typeof Int32Array !== "undefined" ? new Int32Array(table) : table;
    }
    var T0 = signed_crc_table();
    function slice_by_16_tables(T) {
      var c = 0, v = 0, n = 0, table = typeof Int32Array !== "undefined" ? new Int32Array(4096) : new Array(4096);
      for (n = 0; n != 256; ++n) table[n] = T[n];
      for (n = 0; n != 256; ++n) {
        v = T[n];
        for (c = 256 + n; c < 4096; c += 256) v = table[c] = v >>> 8 ^ T[v & 255];
      }
      var out = [];
      for (n = 1; n != 16; ++n) out[n - 1] = typeof Int32Array !== "undefined" ? table.subarray(n * 256, n * 256 + 256) : table.slice(n * 256, n * 256 + 256);
      return out;
    }
    var TT = slice_by_16_tables(T0);
    var T1 = TT[0], T2 = TT[1], T3 = TT[2], T4 = TT[3], T5 = TT[4];
    var T6 = TT[5], T7 = TT[6], T8 = TT[7], T9 = TT[8], Ta = TT[9];
    var Tb = TT[10], Tc = TT[11], Td = TT[12], Te = TT[13], Tf = TT[14];
    function crc32_bstr(bstr, seed) {
      var C = seed ^ -1;
      for (var i = 0, L = bstr.length; i < L; ) C = C >>> 8 ^ T0[(C ^ bstr.charCodeAt(i++)) & 255];
      return ~C;
    }
    function crc32_buf(B, seed) {
      var C = seed ^ -1, L = B.length - 15, i = 0;
      for (; i < L; ) C = Tf[B[i++] ^ C & 255] ^ Te[B[i++] ^ C >> 8 & 255] ^ Td[B[i++] ^ C >> 16 & 255] ^ Tc[B[i++] ^ C >>> 24] ^ Tb[B[i++]] ^ Ta[B[i++]] ^ T9[B[i++]] ^ T8[B[i++]] ^ T7[B[i++]] ^ T6[B[i++]] ^ T5[B[i++]] ^ T4[B[i++]] ^ T3[B[i++]] ^ T2[B[i++]] ^ T1[B[i++]] ^ T0[B[i++]];
      L += 15;
      while (i < L) C = C >>> 8 ^ T0[(C ^ B[i++]) & 255];
      return ~C;
    }
    function crc32_str(str, seed) {
      var C = seed ^ -1;
      for (var i = 0, L = str.length, c = 0, d = 0; i < L; ) {
        c = str.charCodeAt(i++);
        if (c < 128) {
          C = C >>> 8 ^ T0[(C ^ c) & 255];
        } else if (c < 2048) {
          C = C >>> 8 ^ T0[(C ^ (192 | c >> 6 & 31)) & 255];
          C = C >>> 8 ^ T0[(C ^ (128 | c & 63)) & 255];
        } else if (c >= 55296 && c < 57344) {
          c = (c & 1023) + 64;
          d = str.charCodeAt(i++) & 1023;
          C = C >>> 8 ^ T0[(C ^ (240 | c >> 8 & 7)) & 255];
          C = C >>> 8 ^ T0[(C ^ (128 | c >> 2 & 63)) & 255];
          C = C >>> 8 ^ T0[(C ^ (128 | d >> 6 & 15 | (c & 3) << 4)) & 255];
          C = C >>> 8 ^ T0[(C ^ (128 | d & 63)) & 255];
        } else {
          C = C >>> 8 ^ T0[(C ^ (224 | c >> 12 & 15)) & 255];
          C = C >>> 8 ^ T0[(C ^ (128 | c >> 6 & 63)) & 255];
          C = C >>> 8 ^ T0[(C ^ (128 | c & 63)) & 255];
        }
      }
      return ~C;
    }
    CRC32.table = T0;
    CRC32.bstr = crc32_bstr;
    CRC32.buf = crc32_buf;
    CRC32.str = crc32_str;
  });
})(crc32$5);
const { Transform: Transform$1 } = readableExports;
const crc32$4 = crc32$5;
let CRC32Stream$1 = class CRC32Stream extends Transform$1 {
  constructor(options) {
    super(options);
    this.checksum = Buffer.allocUnsafe(4);
    this.checksum.writeInt32BE(0, 0);
    this.rawSize = 0;
  }
  _transform(chunk, encoding, callback) {
    if (chunk) {
      this.checksum = crc32$4.buf(chunk, this.checksum) >>> 0;
      this.rawSize += chunk.length;
    }
    callback(null, chunk);
  }
  digest(encoding) {
    const checksum = Buffer.allocUnsafe(4);
    checksum.writeUInt32BE(this.checksum >>> 0, 0);
    return encoding ? checksum.toString(encoding) : checksum;
  }
  hex() {
    return this.digest("hex").toUpperCase();
  }
  size() {
    return this.rawSize;
  }
};
var crc32Stream = CRC32Stream$1;
const { DeflateRaw } = require$$0$5;
const crc32$3 = crc32$5;
let DeflateCRC32Stream$1 = class DeflateCRC32Stream extends DeflateRaw {
  constructor(options) {
    super(options);
    this.checksum = Buffer.allocUnsafe(4);
    this.checksum.writeInt32BE(0, 0);
    this.rawSize = 0;
    this.compressedSize = 0;
  }
  push(chunk, encoding) {
    if (chunk) {
      this.compressedSize += chunk.length;
    }
    return super.push(chunk, encoding);
  }
  _transform(chunk, encoding, callback) {
    if (chunk) {
      this.checksum = crc32$3.buf(chunk, this.checksum) >>> 0;
      this.rawSize += chunk.length;
    }
    super._transform(chunk, encoding, callback);
  }
  digest(encoding) {
    const checksum = Buffer.allocUnsafe(4);
    checksum.writeUInt32BE(this.checksum >>> 0, 0);
    return encoding ? checksum.toString(encoding) : checksum;
  }
  hex() {
    return this.digest("hex").toUpperCase();
  }
  size(compressed = false) {
    if (compressed) {
      return this.compressedSize;
    } else {
      return this.rawSize;
    }
  }
};
var deflateCrc32Stream = DeflateCRC32Stream$1;
var lib = {
  CRC32Stream: crc32Stream,
  DeflateCRC32Stream: deflateCrc32Stream
};
var inherits$2 = require$$0$3.inherits;
var crc32$2 = crc32$5;
var { CRC32Stream: CRC32Stream2 } = lib;
var { DeflateCRC32Stream: DeflateCRC32Stream2 } = lib;
var ArchiveOutputStream = archiveOutputStreamExports;
var constants$3 = constants$5;
var zipUtil = utilExports$1;
var ZipArchiveOutputStream$1 = zipArchiveOutputStream.exports = function(options) {
  if (!(this instanceof ZipArchiveOutputStream$1)) {
    return new ZipArchiveOutputStream$1(options);
  }
  options = this.options = this._defaults(options);
  ArchiveOutputStream.call(this, options);
  this._entry = null;
  this._entries = [];
  this._archive = {
    centralLength: 0,
    centralOffset: 0,
    comment: "",
    finish: false,
    finished: false,
    processing: false,
    forceZip64: options.forceZip64,
    forceLocalTime: options.forceLocalTime
  };
};
inherits$2(ZipArchiveOutputStream$1, ArchiveOutputStream);
ZipArchiveOutputStream$1.prototype._afterAppend = function(ae) {
  this._entries.push(ae);
  if (ae.getGeneralPurposeBit().usesDataDescriptor()) {
    this._writeDataDescriptor(ae);
  }
  this._archive.processing = false;
  this._entry = null;
  if (this._archive.finish && !this._archive.finished) {
    this._finish();
  }
};
ZipArchiveOutputStream$1.prototype._appendBuffer = function(ae, source, callback) {
  if (source.length === 0) {
    ae.setMethod(constants$3.METHOD_STORED);
  }
  var method = ae.getMethod();
  if (method === constants$3.METHOD_STORED) {
    ae.setSize(source.length);
    ae.setCompressedSize(source.length);
    ae.setCrc(crc32$2.buf(source) >>> 0);
  }
  this._writeLocalFileHeader(ae);
  if (method === constants$3.METHOD_STORED) {
    this.write(source);
    this._afterAppend(ae);
    callback(null, ae);
    return;
  } else if (method === constants$3.METHOD_DEFLATED) {
    this._smartStream(ae, callback).end(source);
    return;
  } else {
    callback(new Error("compression method " + method + " not implemented"));
    return;
  }
};
ZipArchiveOutputStream$1.prototype._appendStream = function(ae, source, callback) {
  ae.getGeneralPurposeBit().useDataDescriptor(true);
  ae.setVersionNeededToExtract(constants$3.MIN_VERSION_DATA_DESCRIPTOR);
  this._writeLocalFileHeader(ae);
  var smart = this._smartStream(ae, callback);
  source.once("error", function(err) {
    smart.emit("error", err);
    smart.end();
  });
  source.pipe(smart);
};
ZipArchiveOutputStream$1.prototype._defaults = function(o) {
  if (typeof o !== "object") {
    o = {};
  }
  if (typeof o.zlib !== "object") {
    o.zlib = {};
  }
  if (typeof o.zlib.level !== "number") {
    o.zlib.level = constants$3.ZLIB_BEST_SPEED;
  }
  o.forceZip64 = !!o.forceZip64;
  o.forceLocalTime = !!o.forceLocalTime;
  return o;
};
ZipArchiveOutputStream$1.prototype._finish = function() {
  this._archive.centralOffset = this.offset;
  this._entries.forEach((function(ae) {
    this._writeCentralFileHeader(ae);
  }).bind(this));
  this._archive.centralLength = this.offset - this._archive.centralOffset;
  if (this.isZip64()) {
    this._writeCentralDirectoryZip64();
  }
  this._writeCentralDirectoryEnd();
  this._archive.processing = false;
  this._archive.finish = true;
  this._archive.finished = true;
  this.end();
};
ZipArchiveOutputStream$1.prototype._normalizeEntry = function(ae) {
  if (ae.getMethod() === -1) {
    ae.setMethod(constants$3.METHOD_DEFLATED);
  }
  if (ae.getMethod() === constants$3.METHOD_DEFLATED) {
    ae.getGeneralPurposeBit().useDataDescriptor(true);
    ae.setVersionNeededToExtract(constants$3.MIN_VERSION_DATA_DESCRIPTOR);
  }
  if (ae.getTime() === -1) {
    ae.setTime(/* @__PURE__ */ new Date(), this._archive.forceLocalTime);
  }
  ae._offsets = {
    file: 0,
    data: 0,
    contents: 0
  };
};
ZipArchiveOutputStream$1.prototype._smartStream = function(ae, callback) {
  var deflate = ae.getMethod() === constants$3.METHOD_DEFLATED;
  var process2 = deflate ? new DeflateCRC32Stream2(this.options.zlib) : new CRC32Stream2();
  var error2 = null;
  function handleStuff() {
    var digest = process2.digest().readUInt32BE(0);
    ae.setCrc(digest);
    ae.setSize(process2.size());
    ae.setCompressedSize(process2.size(true));
    this._afterAppend(ae);
    callback(error2, ae);
  }
  process2.once("end", handleStuff.bind(this));
  process2.once("error", function(err) {
    error2 = err;
  });
  process2.pipe(this, { end: false });
  return process2;
};
ZipArchiveOutputStream$1.prototype._writeCentralDirectoryEnd = function() {
  var records = this._entries.length;
  var size = this._archive.centralLength;
  var offset = this._archive.centralOffset;
  if (this.isZip64()) {
    records = constants$3.ZIP64_MAGIC_SHORT;
    size = constants$3.ZIP64_MAGIC;
    offset = constants$3.ZIP64_MAGIC;
  }
  this.write(zipUtil.getLongBytes(constants$3.SIG_EOCD));
  this.write(constants$3.SHORT_ZERO);
  this.write(constants$3.SHORT_ZERO);
  this.write(zipUtil.getShortBytes(records));
  this.write(zipUtil.getShortBytes(records));
  this.write(zipUtil.getLongBytes(size));
  this.write(zipUtil.getLongBytes(offset));
  var comment = this.getComment();
  var commentLength = Buffer.byteLength(comment);
  this.write(zipUtil.getShortBytes(commentLength));
  this.write(comment);
};
ZipArchiveOutputStream$1.prototype._writeCentralDirectoryZip64 = function() {
  this.write(zipUtil.getLongBytes(constants$3.SIG_ZIP64_EOCD));
  this.write(zipUtil.getEightBytes(44));
  this.write(zipUtil.getShortBytes(constants$3.MIN_VERSION_ZIP64));
  this.write(zipUtil.getShortBytes(constants$3.MIN_VERSION_ZIP64));
  this.write(constants$3.LONG_ZERO);
  this.write(constants$3.LONG_ZERO);
  this.write(zipUtil.getEightBytes(this._entries.length));
  this.write(zipUtil.getEightBytes(this._entries.length));
  this.write(zipUtil.getEightBytes(this._archive.centralLength));
  this.write(zipUtil.getEightBytes(this._archive.centralOffset));
  this.write(zipUtil.getLongBytes(constants$3.SIG_ZIP64_EOCD_LOC));
  this.write(constants$3.LONG_ZERO);
  this.write(zipUtil.getEightBytes(this._archive.centralOffset + this._archive.centralLength));
  this.write(zipUtil.getLongBytes(1));
};
ZipArchiveOutputStream$1.prototype._writeCentralFileHeader = function(ae) {
  var gpb = ae.getGeneralPurposeBit();
  var method = ae.getMethod();
  var fileOffset = ae._offsets.file;
  var size = ae.getSize();
  var compressedSize = ae.getCompressedSize();
  if (ae.isZip64() || fileOffset > constants$3.ZIP64_MAGIC) {
    size = constants$3.ZIP64_MAGIC;
    compressedSize = constants$3.ZIP64_MAGIC;
    fileOffset = constants$3.ZIP64_MAGIC;
    ae.setVersionNeededToExtract(constants$3.MIN_VERSION_ZIP64);
    var extraBuf = Buffer.concat([
      zipUtil.getShortBytes(constants$3.ZIP64_EXTRA_ID),
      zipUtil.getShortBytes(24),
      zipUtil.getEightBytes(ae.getSize()),
      zipUtil.getEightBytes(ae.getCompressedSize()),
      zipUtil.getEightBytes(ae._offsets.file)
    ], 28);
    ae.setExtra(extraBuf);
  }
  this.write(zipUtil.getLongBytes(constants$3.SIG_CFH));
  this.write(zipUtil.getShortBytes(ae.getPlatform() << 8 | constants$3.VERSION_MADEBY));
  this.write(zipUtil.getShortBytes(ae.getVersionNeededToExtract()));
  this.write(gpb.encode());
  this.write(zipUtil.getShortBytes(method));
  this.write(zipUtil.getLongBytes(ae.getTimeDos()));
  this.write(zipUtil.getLongBytes(ae.getCrc()));
  this.write(zipUtil.getLongBytes(compressedSize));
  this.write(zipUtil.getLongBytes(size));
  var name = ae.getName();
  var comment = ae.getComment();
  var extra = ae.getCentralDirectoryExtra();
  if (gpb.usesUTF8ForNames()) {
    name = Buffer.from(name);
    comment = Buffer.from(comment);
  }
  this.write(zipUtil.getShortBytes(name.length));
  this.write(zipUtil.getShortBytes(extra.length));
  this.write(zipUtil.getShortBytes(comment.length));
  this.write(constants$3.SHORT_ZERO);
  this.write(zipUtil.getShortBytes(ae.getInternalAttributes()));
  this.write(zipUtil.getLongBytes(ae.getExternalAttributes()));
  this.write(zipUtil.getLongBytes(fileOffset));
  this.write(name);
  this.write(extra);
  this.write(comment);
};
ZipArchiveOutputStream$1.prototype._writeDataDescriptor = function(ae) {
  this.write(zipUtil.getLongBytes(constants$3.SIG_DD));
  this.write(zipUtil.getLongBytes(ae.getCrc()));
  if (ae.isZip64()) {
    this.write(zipUtil.getEightBytes(ae.getCompressedSize()));
    this.write(zipUtil.getEightBytes(ae.getSize()));
  } else {
    this.write(zipUtil.getLongBytes(ae.getCompressedSize()));
    this.write(zipUtil.getLongBytes(ae.getSize()));
  }
};
ZipArchiveOutputStream$1.prototype._writeLocalFileHeader = function(ae) {
  var gpb = ae.getGeneralPurposeBit();
  var method = ae.getMethod();
  var name = ae.getName();
  var extra = ae.getLocalFileDataExtra();
  if (ae.isZip64()) {
    gpb.useDataDescriptor(true);
    ae.setVersionNeededToExtract(constants$3.MIN_VERSION_ZIP64);
  }
  if (gpb.usesUTF8ForNames()) {
    name = Buffer.from(name);
  }
  ae._offsets.file = this.offset;
  this.write(zipUtil.getLongBytes(constants$3.SIG_LFH));
  this.write(zipUtil.getShortBytes(ae.getVersionNeededToExtract()));
  this.write(gpb.encode());
  this.write(zipUtil.getShortBytes(method));
  this.write(zipUtil.getLongBytes(ae.getTimeDos()));
  ae._offsets.data = this.offset;
  if (gpb.usesDataDescriptor()) {
    this.write(constants$3.LONG_ZERO);
    this.write(constants$3.LONG_ZERO);
    this.write(constants$3.LONG_ZERO);
  } else {
    this.write(zipUtil.getLongBytes(ae.getCrc()));
    this.write(zipUtil.getLongBytes(ae.getCompressedSize()));
    this.write(zipUtil.getLongBytes(ae.getSize()));
  }
  this.write(zipUtil.getShortBytes(name.length));
  this.write(zipUtil.getShortBytes(extra.length));
  this.write(name);
  this.write(extra);
  ae._offsets.contents = this.offset;
};
ZipArchiveOutputStream$1.prototype.getComment = function(comment) {
  return this._archive.comment !== null ? this._archive.comment : "";
};
ZipArchiveOutputStream$1.prototype.isZip64 = function() {
  return this._archive.forceZip64 || this._entries.length > constants$3.ZIP64_MAGIC_SHORT || this._archive.centralLength > constants$3.ZIP64_MAGIC || this._archive.centralOffset > constants$3.ZIP64_MAGIC;
};
ZipArchiveOutputStream$1.prototype.setComment = function(comment) {
  this._archive.comment = comment;
};
var zipArchiveOutputStreamExports = zipArchiveOutputStream.exports;
var compressCommons = {
  ZipArchiveEntry: zipArchiveEntryExports,
  ZipArchiveOutputStream: zipArchiveOutputStreamExports
};
/**
 * ZipStream
 *
 * @ignore
 * @license [MIT]{@link https://github.com/archiverjs/node-zip-stream/blob/master/LICENSE}
 * @copyright (c) 2014 Chris Talkington, contributors.
 */
var inherits$1 = require$$0$3.inherits;
var ZipArchiveOutputStream = compressCommons.ZipArchiveOutputStream;
var ZipArchiveEntry = compressCommons.ZipArchiveEntry;
var util$3 = archiverUtilsExports;
var ZipStream = zipStream.exports = function(options) {
  if (!(this instanceof ZipStream)) {
    return new ZipStream(options);
  }
  options = this.options = options || {};
  options.zlib = options.zlib || {};
  ZipArchiveOutputStream.call(this, options);
  if (typeof options.level === "number" && options.level >= 0) {
    options.zlib.level = options.level;
    delete options.level;
  }
  if (!options.forceZip64 && typeof options.zlib.level === "number" && options.zlib.level === 0) {
    options.store = true;
  }
  options.namePrependSlash = options.namePrependSlash || false;
  if (options.comment && options.comment.length > 0) {
    this.setComment(options.comment);
  }
};
inherits$1(ZipStream, ZipArchiveOutputStream);
ZipStream.prototype._normalizeFileData = function(data) {
  data = util$3.defaults(data, {
    type: "file",
    name: null,
    namePrependSlash: this.options.namePrependSlash,
    linkname: null,
    date: null,
    mode: null,
    store: this.options.store,
    comment: ""
  });
  var isDir = data.type === "directory";
  var isSymlink = data.type === "symlink";
  if (data.name) {
    data.name = util$3.sanitizePath(data.name);
    if (!isSymlink && data.name.slice(-1) === "/") {
      isDir = true;
      data.type = "directory";
    } else if (isDir) {
      data.name += "/";
    }
  }
  if (isDir || isSymlink) {
    data.store = true;
  }
  data.date = util$3.dateify(data.date);
  return data;
};
ZipStream.prototype.entry = function(source, data, callback) {
  if (typeof callback !== "function") {
    callback = this._emitErrorCallback.bind(this);
  }
  data = this._normalizeFileData(data);
  if (data.type !== "file" && data.type !== "directory" && data.type !== "symlink") {
    callback(new Error(data.type + " entries not currently supported"));
    return;
  }
  if (typeof data.name !== "string" || data.name.length === 0) {
    callback(new Error("entry name must be a non-empty string value"));
    return;
  }
  if (data.type === "symlink" && typeof data.linkname !== "string") {
    callback(new Error("entry linkname must be a non-empty string value when type equals symlink"));
    return;
  }
  var entry = new ZipArchiveEntry(data.name);
  entry.setTime(data.date, this.options.forceLocalTime);
  if (data.namePrependSlash) {
    entry.setName(data.name, true);
  }
  if (data.store) {
    entry.setMethod(0);
  }
  if (data.comment.length > 0) {
    entry.setComment(data.comment);
  }
  if (data.type === "symlink" && typeof data.mode !== "number") {
    data.mode = 40960;
  }
  if (typeof data.mode === "number") {
    if (data.type === "symlink") {
      data.mode |= 40960;
    }
    entry.setUnixMode(data.mode);
  }
  if (data.type === "symlink" && typeof data.linkname === "string") {
    source = Buffer.from(data.linkname);
  }
  return ZipArchiveOutputStream.prototype.entry.call(this, entry, source, callback);
};
ZipStream.prototype.finalize = function() {
  this.finish();
};
var zipStreamExports = zipStream.exports;
/**
 * ZIP Format Plugin
 *
 * @module plugins/zip
 * @license [MIT]{@link https://github.com/archiverjs/node-archiver/blob/master/LICENSE}
 * @copyright (c) 2012-2014 Chris Talkington, contributors.
 */
var engine$1 = zipStreamExports;
var util$2 = archiverUtilsExports;
var Zip = function(options) {
  if (!(this instanceof Zip)) {
    return new Zip(options);
  }
  options = this.options = util$2.defaults(options, {
    comment: "",
    forceUTC: false,
    namePrependSlash: false,
    store: false
  });
  this.supports = {
    directory: true,
    symlink: true
  };
  this.engine = new engine$1(options);
};
Zip.prototype.append = function(source, data, callback) {
  this.engine.entry(source, data, callback);
};
Zip.prototype.finalize = function() {
  this.engine.finalize();
};
Zip.prototype.on = function() {
  return this.engine.on.apply(this.engine, arguments);
};
Zip.prototype.pipe = function() {
  return this.engine.pipe.apply(this.engine, arguments);
};
Zip.prototype.unpipe = function() {
  return this.engine.unpipe.apply(this.engine, arguments);
};
var zip = Zip;
var tarStream = {};
var fixedSize = class FixedFIFO {
  constructor(hwm) {
    if (!(hwm > 0) || (hwm - 1 & hwm) !== 0) throw new Error("Max size for a FixedFIFO should be a power of two");
    this.buffer = new Array(hwm);
    this.mask = hwm - 1;
    this.top = 0;
    this.btm = 0;
    this.next = null;
  }
  clear() {
    this.top = this.btm = 0;
    this.next = null;
    this.buffer.fill(void 0);
  }
  push(data) {
    if (this.buffer[this.top] !== void 0) return false;
    this.buffer[this.top] = data;
    this.top = this.top + 1 & this.mask;
    return true;
  }
  shift() {
    const last = this.buffer[this.btm];
    if (last === void 0) return void 0;
    this.buffer[this.btm] = void 0;
    this.btm = this.btm + 1 & this.mask;
    return last;
  }
  peek() {
    return this.buffer[this.btm];
  }
  isEmpty() {
    return this.buffer[this.btm] === void 0;
  }
};
const FixedFIFO2 = fixedSize;
var fastFifo = class FastFIFO {
  constructor(hwm) {
    this.hwm = hwm || 16;
    this.head = new FixedFIFO2(this.hwm);
    this.tail = this.head;
    this.length = 0;
  }
  clear() {
    this.head = this.tail;
    this.head.clear();
    this.length = 0;
  }
  push(val) {
    this.length++;
    if (!this.head.push(val)) {
      const prev = this.head;
      this.head = prev.next = new FixedFIFO2(2 * this.head.buffer.length);
      this.head.push(val);
    }
  }
  shift() {
    if (this.length !== 0) this.length--;
    const val = this.tail.shift();
    if (val === void 0 && this.tail.next) {
      const next = this.tail.next;
      this.tail.next = null;
      this.tail = next;
      return this.tail.shift();
    }
    return val;
  }
  peek() {
    const val = this.tail.peek();
    if (val === void 0 && this.tail.next) return this.tail.next.peek();
    return val;
  }
  isEmpty() {
    return this.length === 0;
  }
};
function isBuffer(value) {
  return Buffer.isBuffer(value) || value instanceof Uint8Array;
}
function isEncoding(encoding) {
  return Buffer.isEncoding(encoding);
}
function alloc(size, fill2, encoding) {
  return Buffer.alloc(size, fill2, encoding);
}
function allocUnsafe(size) {
  return Buffer.allocUnsafe(size);
}
function allocUnsafeSlow(size) {
  return Buffer.allocUnsafeSlow(size);
}
function byteLength(string, encoding) {
  return Buffer.byteLength(string, encoding);
}
function compare(a, b) {
  return Buffer.compare(a, b);
}
function concat(buffers, totalLength) {
  return Buffer.concat(buffers, totalLength);
}
function copy(source, target, targetStart, start, end) {
  return toBuffer(source).copy(target, targetStart, start, end);
}
function equals(a, b) {
  return toBuffer(a).equals(b);
}
function fill(buffer, value, offset, end, encoding) {
  return toBuffer(buffer).fill(value, offset, end, encoding);
}
function from(value, encodingOrOffset, length) {
  return Buffer.from(value, encodingOrOffset, length);
}
function includes(buffer, value, byteOffset, encoding) {
  return toBuffer(buffer).includes(value, byteOffset, encoding);
}
function indexOf$1(buffer, value, byfeOffset, encoding) {
  return toBuffer(buffer).indexOf(value, byfeOffset, encoding);
}
function lastIndexOf(buffer, value, byteOffset, encoding) {
  return toBuffer(buffer).lastIndexOf(value, byteOffset, encoding);
}
function swap16(buffer) {
  return toBuffer(buffer).swap16();
}
function swap32(buffer) {
  return toBuffer(buffer).swap32();
}
function swap64(buffer) {
  return toBuffer(buffer).swap64();
}
function toBuffer(buffer) {
  if (Buffer.isBuffer(buffer)) return buffer;
  return Buffer.from(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}
function toString(buffer, encoding, start, end) {
  return toBuffer(buffer).toString(encoding, start, end);
}
function write(buffer, string, offset, length, encoding) {
  return toBuffer(buffer).write(string, offset, length, encoding);
}
function writeDoubleLE(buffer, value, offset) {
  return toBuffer(buffer).writeDoubleLE(value, offset);
}
function writeFloatLE(buffer, value, offset) {
  return toBuffer(buffer).writeFloatLE(value, offset);
}
function writeUInt32LE(buffer, value, offset) {
  return toBuffer(buffer).writeUInt32LE(value, offset);
}
function writeInt32LE(buffer, value, offset) {
  return toBuffer(buffer).writeInt32LE(value, offset);
}
function readDoubleLE(buffer, offset) {
  return toBuffer(buffer).readDoubleLE(offset);
}
function readFloatLE(buffer, offset) {
  return toBuffer(buffer).readFloatLE(offset);
}
function readUInt32LE(buffer, offset) {
  return toBuffer(buffer).readUInt32LE(offset);
}
function readInt32LE(buffer, offset) {
  return toBuffer(buffer).readInt32LE(offset);
}
function writeDoubleBE(buffer, value, offset) {
  return toBuffer(buffer).writeDoubleBE(value, offset);
}
function writeFloatBE(buffer, value, offset) {
  return toBuffer(buffer).writeFloatBE(value, offset);
}
function writeUInt32BE(buffer, value, offset) {
  return toBuffer(buffer).writeUInt32BE(value, offset);
}
function writeInt32BE(buffer, value, offset) {
  return toBuffer(buffer).writeInt32BE(value, offset);
}
function readDoubleBE(buffer, offset) {
  return toBuffer(buffer).readDoubleBE(offset);
}
function readFloatBE(buffer, offset) {
  return toBuffer(buffer).readFloatBE(offset);
}
function readUInt32BE(buffer, offset) {
  return toBuffer(buffer).readUInt32BE(offset);
}
function readInt32BE(buffer, offset) {
  return toBuffer(buffer).readInt32BE(offset);
}
var b4a$5 = {
  isBuffer,
  isEncoding,
  alloc,
  allocUnsafe,
  allocUnsafeSlow,
  byteLength,
  compare,
  concat,
  copy,
  equals,
  fill,
  from,
  includes,
  indexOf: indexOf$1,
  lastIndexOf,
  swap16,
  swap32,
  swap64,
  toBuffer,
  toString,
  write,
  writeDoubleLE,
  writeFloatLE,
  writeUInt32LE,
  writeInt32LE,
  readDoubleLE,
  readFloatLE,
  readUInt32LE,
  readInt32LE,
  writeDoubleBE,
  writeFloatBE,
  writeUInt32BE,
  writeInt32BE,
  readDoubleBE,
  readFloatBE,
  readUInt32BE,
  readInt32BE
};
const b4a$4 = b4a$5;
var passThroughDecoder = class PassThroughDecoder {
  constructor(encoding) {
    this.encoding = encoding;
  }
  get remaining() {
    return 0;
  }
  decode(tail) {
    return b4a$4.toString(tail, this.encoding);
  }
  flush() {
    return "";
  }
};
const b4a$3 = b4a$5;
var utf8Decoder = class UTF8Decoder {
  constructor() {
    this.codePoint = 0;
    this.bytesSeen = 0;
    this.bytesNeeded = 0;
    this.lowerBoundary = 128;
    this.upperBoundary = 191;
  }
  get remaining() {
    return this.bytesSeen;
  }
  decode(data) {
    if (this.bytesNeeded === 0) {
      let isBoundary = true;
      for (let i = Math.max(0, data.byteLength - 4), n = data.byteLength; i < n && isBoundary; i++) {
        isBoundary = data[i] <= 127;
      }
      if (isBoundary) return b4a$3.toString(data, "utf8");
    }
    let result = "";
    for (let i = 0, n = data.byteLength; i < n; i++) {
      const byte = data[i];
      if (this.bytesNeeded === 0) {
        if (byte <= 127) {
          result += String.fromCharCode(byte);
        } else {
          this.bytesSeen = 1;
          if (byte >= 194 && byte <= 223) {
            this.bytesNeeded = 2;
            this.codePoint = byte & 31;
          } else if (byte >= 224 && byte <= 239) {
            if (byte === 224) this.lowerBoundary = 160;
            else if (byte === 237) this.upperBoundary = 159;
            this.bytesNeeded = 3;
            this.codePoint = byte & 15;
          } else if (byte >= 240 && byte <= 244) {
            if (byte === 240) this.lowerBoundary = 144;
            if (byte === 244) this.upperBoundary = 143;
            this.bytesNeeded = 4;
            this.codePoint = byte & 7;
          } else {
            result += "�";
          }
        }
        continue;
      }
      if (byte < this.lowerBoundary || byte > this.upperBoundary) {
        this.codePoint = 0;
        this.bytesNeeded = 0;
        this.bytesSeen = 0;
        this.lowerBoundary = 128;
        this.upperBoundary = 191;
        result += "�";
        continue;
      }
      this.lowerBoundary = 128;
      this.upperBoundary = 191;
      this.codePoint = this.codePoint << 6 | byte & 63;
      this.bytesSeen++;
      if (this.bytesSeen !== this.bytesNeeded) continue;
      result += String.fromCodePoint(this.codePoint);
      this.codePoint = 0;
      this.bytesNeeded = 0;
      this.bytesSeen = 0;
    }
    return result;
  }
  flush() {
    const result = this.bytesNeeded > 0 ? "�" : "";
    this.codePoint = 0;
    this.bytesNeeded = 0;
    this.bytesSeen = 0;
    this.lowerBoundary = 128;
    this.upperBoundary = 191;
    return result;
  }
};
const PassThroughDecoder2 = passThroughDecoder;
const UTF8Decoder2 = utf8Decoder;
var textDecoder = class TextDecoder {
  constructor(encoding = "utf8") {
    this.encoding = normalizeEncoding(encoding);
    switch (this.encoding) {
      case "utf8":
        this.decoder = new UTF8Decoder2();
        break;
      case "utf16le":
      case "base64":
        throw new Error("Unsupported encoding: " + this.encoding);
      default:
        this.decoder = new PassThroughDecoder2(this.encoding);
    }
  }
  get remaining() {
    return this.decoder.remaining;
  }
  push(data) {
    if (typeof data === "string") return data;
    return this.decoder.decode(data);
  }
  // For Node.js compatibility
  write(data) {
    return this.push(data);
  }
  end(data) {
    let result = "";
    if (data) result = this.push(data);
    result += this.decoder.flush();
    return result;
  }
};
function normalizeEncoding(encoding) {
  encoding = encoding.toLowerCase();
  switch (encoding) {
    case "utf8":
    case "utf-8":
      return "utf8";
    case "ucs2":
    case "ucs-2":
    case "utf16le":
    case "utf-16le":
      return "utf16le";
    case "latin1":
    case "binary":
      return "latin1";
    case "base64":
    case "ascii":
    case "hex":
      return encoding;
    default:
      throw new Error("Unknown encoding: " + encoding);
  }
}
const { EventEmitter } = require$$0;
const STREAM_DESTROYED = new Error("Stream was destroyed");
const FIFO$1 = fastFifo;
const TextDecoder2 = textDecoder;
const qmt = typeof queueMicrotask === "undefined" ? (fn) => commonjsGlobal.process.nextTick(fn) : queueMicrotask;
const MAX = (1 << 29) - 1;
const OPENING = 1;
const PREDESTROYING = 2;
const DESTROYING = 4;
const DESTROYED = 8;
const NOT_OPENING = MAX ^ OPENING;
const NOT_PREDESTROYING = MAX ^ PREDESTROYING;
const READ_ACTIVE = 1 << 4;
const READ_UPDATING = 2 << 4;
const READ_PRIMARY = 4 << 4;
const READ_QUEUED = 8 << 4;
const READ_RESUMED = 16 << 4;
const READ_PIPE_DRAINED = 32 << 4;
const READ_ENDING = 64 << 4;
const READ_EMIT_DATA = 128 << 4;
const READ_EMIT_READABLE = 256 << 4;
const READ_EMITTED_READABLE = 512 << 4;
const READ_DONE = 1024 << 4;
const READ_NEXT_TICK = 2048 << 4;
const READ_NEEDS_PUSH = 4096 << 4;
const READ_READ_AHEAD = 8192 << 4;
const READ_FLOWING = READ_RESUMED | READ_PIPE_DRAINED;
const READ_ACTIVE_AND_NEEDS_PUSH = READ_ACTIVE | READ_NEEDS_PUSH;
const READ_PRIMARY_AND_ACTIVE = READ_PRIMARY | READ_ACTIVE;
const READ_EMIT_READABLE_AND_QUEUED = READ_EMIT_READABLE | READ_QUEUED;
const READ_RESUMED_READ_AHEAD = READ_RESUMED | READ_READ_AHEAD;
const READ_NOT_ACTIVE = MAX ^ READ_ACTIVE;
const READ_NON_PRIMARY = MAX ^ READ_PRIMARY;
const READ_NON_PRIMARY_AND_PUSHED = MAX ^ (READ_PRIMARY | READ_NEEDS_PUSH);
const READ_PUSHED = MAX ^ READ_NEEDS_PUSH;
const READ_PAUSED = MAX ^ READ_RESUMED;
const READ_NOT_QUEUED = MAX ^ (READ_QUEUED | READ_EMITTED_READABLE);
const READ_NOT_ENDING = MAX ^ READ_ENDING;
const READ_PIPE_NOT_DRAINED = MAX ^ READ_FLOWING;
const READ_NOT_NEXT_TICK = MAX ^ READ_NEXT_TICK;
const READ_NOT_UPDATING = MAX ^ READ_UPDATING;
const READ_NO_READ_AHEAD = MAX ^ READ_READ_AHEAD;
const READ_PAUSED_NO_READ_AHEAD = MAX ^ READ_RESUMED_READ_AHEAD;
const WRITE_ACTIVE = 1 << 18;
const WRITE_UPDATING = 2 << 18;
const WRITE_PRIMARY = 4 << 18;
const WRITE_QUEUED = 8 << 18;
const WRITE_UNDRAINED = 16 << 18;
const WRITE_DONE = 32 << 18;
const WRITE_EMIT_DRAIN = 64 << 18;
const WRITE_NEXT_TICK = 128 << 18;
const WRITE_WRITING = 256 << 18;
const WRITE_FINISHING = 512 << 18;
const WRITE_CORKED = 1024 << 18;
const WRITE_NOT_ACTIVE = MAX ^ (WRITE_ACTIVE | WRITE_WRITING);
const WRITE_NON_PRIMARY = MAX ^ WRITE_PRIMARY;
const WRITE_NOT_FINISHING = MAX ^ (WRITE_ACTIVE | WRITE_FINISHING);
const WRITE_DRAINED = MAX ^ WRITE_UNDRAINED;
const WRITE_NOT_QUEUED = MAX ^ WRITE_QUEUED;
const WRITE_NOT_NEXT_TICK = MAX ^ WRITE_NEXT_TICK;
const WRITE_NOT_UPDATING = MAX ^ WRITE_UPDATING;
const WRITE_NOT_CORKED = MAX ^ WRITE_CORKED;
const ACTIVE = READ_ACTIVE | WRITE_ACTIVE;
const NOT_ACTIVE = MAX ^ ACTIVE;
const DONE = READ_DONE | WRITE_DONE;
const DESTROY_STATUS = DESTROYING | DESTROYED | PREDESTROYING;
const OPEN_STATUS = DESTROY_STATUS | OPENING;
const AUTO_DESTROY = DESTROY_STATUS | DONE;
const NON_PRIMARY = WRITE_NON_PRIMARY & READ_NON_PRIMARY;
const ACTIVE_OR_TICKING = WRITE_NEXT_TICK | READ_NEXT_TICK;
const TICKING = ACTIVE_OR_TICKING & NOT_ACTIVE;
const IS_OPENING = OPEN_STATUS | TICKING;
const READ_PRIMARY_STATUS = OPEN_STATUS | READ_ENDING | READ_DONE;
const READ_STATUS = OPEN_STATUS | READ_DONE | READ_QUEUED;
const READ_ENDING_STATUS = OPEN_STATUS | READ_ENDING | READ_QUEUED;
const READ_READABLE_STATUS = OPEN_STATUS | READ_EMIT_READABLE | READ_QUEUED | READ_EMITTED_READABLE;
const SHOULD_NOT_READ = OPEN_STATUS | READ_ACTIVE | READ_ENDING | READ_DONE | READ_NEEDS_PUSH | READ_READ_AHEAD;
const READ_BACKPRESSURE_STATUS = DESTROY_STATUS | READ_ENDING | READ_DONE;
const READ_UPDATE_SYNC_STATUS = READ_UPDATING | OPEN_STATUS | READ_NEXT_TICK | READ_PRIMARY;
const READ_NEXT_TICK_OR_OPENING = READ_NEXT_TICK | OPENING;
const WRITE_PRIMARY_STATUS = OPEN_STATUS | WRITE_FINISHING | WRITE_DONE;
const WRITE_QUEUED_AND_UNDRAINED = WRITE_QUEUED | WRITE_UNDRAINED;
const WRITE_QUEUED_AND_ACTIVE = WRITE_QUEUED | WRITE_ACTIVE;
const WRITE_DRAIN_STATUS = WRITE_QUEUED | WRITE_UNDRAINED | OPEN_STATUS | WRITE_ACTIVE;
const WRITE_STATUS = OPEN_STATUS | WRITE_ACTIVE | WRITE_QUEUED | WRITE_CORKED;
const WRITE_PRIMARY_AND_ACTIVE = WRITE_PRIMARY | WRITE_ACTIVE;
const WRITE_ACTIVE_AND_WRITING = WRITE_ACTIVE | WRITE_WRITING;
const WRITE_FINISHING_STATUS = OPEN_STATUS | WRITE_FINISHING | WRITE_QUEUED_AND_ACTIVE | WRITE_DONE;
const WRITE_BACKPRESSURE_STATUS = WRITE_UNDRAINED | DESTROY_STATUS | WRITE_FINISHING | WRITE_DONE;
const WRITE_UPDATE_SYNC_STATUS = WRITE_UPDATING | OPEN_STATUS | WRITE_NEXT_TICK | WRITE_PRIMARY;
const WRITE_DROP_DATA = WRITE_FINISHING | WRITE_DONE | DESTROY_STATUS;
const asyncIterator = Symbol.asyncIterator || Symbol("asyncIterator");
class WritableState {
  constructor(stream2, { highWaterMark = 16384, map: map2 = null, mapWritable: mapWritable2, byteLength: byteLength2, byteLengthWritable } = {}) {
    this.stream = stream2;
    this.queue = new FIFO$1();
    this.highWaterMark = highWaterMark;
    this.buffered = 0;
    this.error = null;
    this.pipeline = null;
    this.drains = null;
    this.byteLength = byteLengthWritable || byteLength2 || defaultByteLength;
    this.map = mapWritable2 || map2;
    this.afterWrite = afterWrite.bind(this);
    this.afterUpdateNextTick = updateWriteNT.bind(this);
  }
  get ended() {
    return (this.stream._duplexState & WRITE_DONE) !== 0;
  }
  push(data) {
    if ((this.stream._duplexState & WRITE_DROP_DATA) !== 0) return false;
    if (this.map !== null) data = this.map(data);
    this.buffered += this.byteLength(data);
    this.queue.push(data);
    if (this.buffered < this.highWaterMark) {
      this.stream._duplexState |= WRITE_QUEUED;
      return true;
    }
    this.stream._duplexState |= WRITE_QUEUED_AND_UNDRAINED;
    return false;
  }
  shift() {
    const data = this.queue.shift();
    this.buffered -= this.byteLength(data);
    if (this.buffered === 0) this.stream._duplexState &= WRITE_NOT_QUEUED;
    return data;
  }
  end(data) {
    if (typeof data === "function") this.stream.once("finish", data);
    else if (data !== void 0 && data !== null) this.push(data);
    this.stream._duplexState = (this.stream._duplexState | WRITE_FINISHING) & WRITE_NON_PRIMARY;
  }
  autoBatch(data, cb) {
    const buffer = [];
    const stream2 = this.stream;
    buffer.push(data);
    while ((stream2._duplexState & WRITE_STATUS) === WRITE_QUEUED_AND_ACTIVE) {
      buffer.push(stream2._writableState.shift());
    }
    if ((stream2._duplexState & OPEN_STATUS) !== 0) return cb(null);
    stream2._writev(buffer, cb);
  }
  update() {
    const stream2 = this.stream;
    stream2._duplexState |= WRITE_UPDATING;
    do {
      while ((stream2._duplexState & WRITE_STATUS) === WRITE_QUEUED) {
        const data = this.shift();
        stream2._duplexState |= WRITE_ACTIVE_AND_WRITING;
        stream2._write(data, this.afterWrite);
      }
      if ((stream2._duplexState & WRITE_PRIMARY_AND_ACTIVE) === 0) this.updateNonPrimary();
    } while (this.continueUpdate() === true);
    stream2._duplexState &= WRITE_NOT_UPDATING;
  }
  updateNonPrimary() {
    const stream2 = this.stream;
    if ((stream2._duplexState & WRITE_FINISHING_STATUS) === WRITE_FINISHING) {
      stream2._duplexState = stream2._duplexState | WRITE_ACTIVE;
      stream2._final(afterFinal.bind(this));
      return;
    }
    if ((stream2._duplexState & DESTROY_STATUS) === DESTROYING) {
      if ((stream2._duplexState & ACTIVE_OR_TICKING) === 0) {
        stream2._duplexState |= ACTIVE;
        stream2._destroy(afterDestroy.bind(this));
      }
      return;
    }
    if ((stream2._duplexState & IS_OPENING) === OPENING) {
      stream2._duplexState = (stream2._duplexState | ACTIVE) & NOT_OPENING;
      stream2._open(afterOpen.bind(this));
    }
  }
  continueUpdate() {
    if ((this.stream._duplexState & WRITE_NEXT_TICK) === 0) return false;
    this.stream._duplexState &= WRITE_NOT_NEXT_TICK;
    return true;
  }
  updateCallback() {
    if ((this.stream._duplexState & WRITE_UPDATE_SYNC_STATUS) === WRITE_PRIMARY) this.update();
    else this.updateNextTick();
  }
  updateNextTick() {
    if ((this.stream._duplexState & WRITE_NEXT_TICK) !== 0) return;
    this.stream._duplexState |= WRITE_NEXT_TICK;
    if ((this.stream._duplexState & WRITE_UPDATING) === 0) qmt(this.afterUpdateNextTick);
  }
}
class ReadableState {
  constructor(stream2, { highWaterMark = 16384, map: map2 = null, mapReadable, byteLength: byteLength2, byteLengthReadable } = {}) {
    this.stream = stream2;
    this.queue = new FIFO$1();
    this.highWaterMark = highWaterMark === 0 ? 1 : highWaterMark;
    this.buffered = 0;
    this.readAhead = highWaterMark > 0;
    this.error = null;
    this.pipeline = null;
    this.byteLength = byteLengthReadable || byteLength2 || defaultByteLength;
    this.map = mapReadable || map2;
    this.pipeTo = null;
    this.afterRead = afterRead.bind(this);
    this.afterUpdateNextTick = updateReadNT.bind(this);
  }
  get ended() {
    return (this.stream._duplexState & READ_DONE) !== 0;
  }
  pipe(pipeTo, cb) {
    if (this.pipeTo !== null) throw new Error("Can only pipe to one destination");
    if (typeof cb !== "function") cb = null;
    this.stream._duplexState |= READ_PIPE_DRAINED;
    this.pipeTo = pipeTo;
    this.pipeline = new Pipeline(this.stream, pipeTo, cb);
    if (cb) this.stream.on("error", noop$2);
    if (isStreamx(pipeTo)) {
      pipeTo._writableState.pipeline = this.pipeline;
      if (cb) pipeTo.on("error", noop$2);
      pipeTo.on("finish", this.pipeline.finished.bind(this.pipeline));
    } else {
      const onerror = this.pipeline.done.bind(this.pipeline, pipeTo);
      const onclose = this.pipeline.done.bind(this.pipeline, pipeTo, null);
      pipeTo.on("error", onerror);
      pipeTo.on("close", onclose);
      pipeTo.on("finish", this.pipeline.finished.bind(this.pipeline));
    }
    pipeTo.on("drain", afterDrain.bind(this));
    this.stream.emit("piping", pipeTo);
    pipeTo.emit("pipe", this.stream);
  }
  push(data) {
    const stream2 = this.stream;
    if (data === null) {
      this.highWaterMark = 0;
      stream2._duplexState = (stream2._duplexState | READ_ENDING) & READ_NON_PRIMARY_AND_PUSHED;
      return false;
    }
    if (this.map !== null) {
      data = this.map(data);
      if (data === null) {
        stream2._duplexState &= READ_PUSHED;
        return this.buffered < this.highWaterMark;
      }
    }
    this.buffered += this.byteLength(data);
    this.queue.push(data);
    stream2._duplexState = (stream2._duplexState | READ_QUEUED) & READ_PUSHED;
    return this.buffered < this.highWaterMark;
  }
  shift() {
    const data = this.queue.shift();
    this.buffered -= this.byteLength(data);
    if (this.buffered === 0) this.stream._duplexState &= READ_NOT_QUEUED;
    return data;
  }
  unshift(data) {
    const pending = [this.map !== null ? this.map(data) : data];
    while (this.buffered > 0) pending.push(this.shift());
    for (let i = 0; i < pending.length - 1; i++) {
      const data2 = pending[i];
      this.buffered += this.byteLength(data2);
      this.queue.push(data2);
    }
    this.push(pending[pending.length - 1]);
  }
  read() {
    const stream2 = this.stream;
    if ((stream2._duplexState & READ_STATUS) === READ_QUEUED) {
      const data = this.shift();
      if (this.pipeTo !== null && this.pipeTo.write(data) === false) stream2._duplexState &= READ_PIPE_NOT_DRAINED;
      if ((stream2._duplexState & READ_EMIT_DATA) !== 0) stream2.emit("data", data);
      return data;
    }
    if (this.readAhead === false) {
      stream2._duplexState |= READ_READ_AHEAD;
      this.updateNextTick();
    }
    return null;
  }
  drain() {
    const stream2 = this.stream;
    while ((stream2._duplexState & READ_STATUS) === READ_QUEUED && (stream2._duplexState & READ_FLOWING) !== 0) {
      const data = this.shift();
      if (this.pipeTo !== null && this.pipeTo.write(data) === false) stream2._duplexState &= READ_PIPE_NOT_DRAINED;
      if ((stream2._duplexState & READ_EMIT_DATA) !== 0) stream2.emit("data", data);
    }
  }
  update() {
    const stream2 = this.stream;
    stream2._duplexState |= READ_UPDATING;
    do {
      this.drain();
      while (this.buffered < this.highWaterMark && (stream2._duplexState & SHOULD_NOT_READ) === READ_READ_AHEAD) {
        stream2._duplexState |= READ_ACTIVE_AND_NEEDS_PUSH;
        stream2._read(this.afterRead);
        this.drain();
      }
      if ((stream2._duplexState & READ_READABLE_STATUS) === READ_EMIT_READABLE_AND_QUEUED) {
        stream2._duplexState |= READ_EMITTED_READABLE;
        stream2.emit("readable");
      }
      if ((stream2._duplexState & READ_PRIMARY_AND_ACTIVE) === 0) this.updateNonPrimary();
    } while (this.continueUpdate() === true);
    stream2._duplexState &= READ_NOT_UPDATING;
  }
  updateNonPrimary() {
    const stream2 = this.stream;
    if ((stream2._duplexState & READ_ENDING_STATUS) === READ_ENDING) {
      stream2._duplexState = (stream2._duplexState | READ_DONE) & READ_NOT_ENDING;
      stream2.emit("end");
      if ((stream2._duplexState & AUTO_DESTROY) === DONE) stream2._duplexState |= DESTROYING;
      if (this.pipeTo !== null) this.pipeTo.end();
    }
    if ((stream2._duplexState & DESTROY_STATUS) === DESTROYING) {
      if ((stream2._duplexState & ACTIVE_OR_TICKING) === 0) {
        stream2._duplexState |= ACTIVE;
        stream2._destroy(afterDestroy.bind(this));
      }
      return;
    }
    if ((stream2._duplexState & IS_OPENING) === OPENING) {
      stream2._duplexState = (stream2._duplexState | ACTIVE) & NOT_OPENING;
      stream2._open(afterOpen.bind(this));
    }
  }
  continueUpdate() {
    if ((this.stream._duplexState & READ_NEXT_TICK) === 0) return false;
    this.stream._duplexState &= READ_NOT_NEXT_TICK;
    return true;
  }
  updateCallback() {
    if ((this.stream._duplexState & READ_UPDATE_SYNC_STATUS) === READ_PRIMARY) this.update();
    else this.updateNextTick();
  }
  updateNextTickIfOpen() {
    if ((this.stream._duplexState & READ_NEXT_TICK_OR_OPENING) !== 0) return;
    this.stream._duplexState |= READ_NEXT_TICK;
    if ((this.stream._duplexState & READ_UPDATING) === 0) qmt(this.afterUpdateNextTick);
  }
  updateNextTick() {
    if ((this.stream._duplexState & READ_NEXT_TICK) !== 0) return;
    this.stream._duplexState |= READ_NEXT_TICK;
    if ((this.stream._duplexState & READ_UPDATING) === 0) qmt(this.afterUpdateNextTick);
  }
}
class Pipeline {
  constructor(src, dst, cb) {
    this.from = src;
    this.to = dst;
    this.afterPipe = cb;
    this.error = null;
    this.pipeToFinished = false;
  }
  finished() {
    this.pipeToFinished = true;
  }
  done(stream2, err) {
    if (err) this.error = err;
    if (stream2 === this.to) {
      this.to = null;
      if (this.from !== null) {
        if ((this.from._duplexState & READ_DONE) === 0 || !this.pipeToFinished) {
          this.from.destroy(this.error || new Error("Writable stream closed prematurely"));
        }
        return;
      }
    }
    if (stream2 === this.from) {
      this.from = null;
      if (this.to !== null) {
        if ((stream2._duplexState & READ_DONE) === 0) {
          this.to.destroy(this.error || new Error("Readable stream closed before ending"));
        }
        return;
      }
    }
    if (this.afterPipe !== null) this.afterPipe(this.error);
    this.to = this.from = this.afterPipe = null;
  }
}
function afterDrain() {
  this.stream._duplexState |= READ_PIPE_DRAINED;
  this.updateCallback();
}
function afterFinal(err) {
  const stream2 = this.stream;
  if (err) stream2.destroy(err);
  if ((stream2._duplexState & DESTROY_STATUS) === 0) {
    stream2._duplexState |= WRITE_DONE;
    stream2.emit("finish");
  }
  if ((stream2._duplexState & AUTO_DESTROY) === DONE) {
    stream2._duplexState |= DESTROYING;
  }
  stream2._duplexState &= WRITE_NOT_FINISHING;
  if ((stream2._duplexState & WRITE_UPDATING) === 0) this.update();
  else this.updateNextTick();
}
function afterDestroy(err) {
  const stream2 = this.stream;
  if (!err && this.error !== STREAM_DESTROYED) err = this.error;
  if (err) stream2.emit("error", err);
  stream2._duplexState |= DESTROYED;
  stream2.emit("close");
  const rs = stream2._readableState;
  const ws = stream2._writableState;
  if (rs !== null && rs.pipeline !== null) rs.pipeline.done(stream2, err);
  if (ws !== null) {
    while (ws.drains !== null && ws.drains.length > 0) ws.drains.shift().resolve(false);
    if (ws.pipeline !== null) ws.pipeline.done(stream2, err);
  }
}
function afterWrite(err) {
  const stream2 = this.stream;
  if (err) stream2.destroy(err);
  stream2._duplexState &= WRITE_NOT_ACTIVE;
  if (this.drains !== null) tickDrains(this.drains);
  if ((stream2._duplexState & WRITE_DRAIN_STATUS) === WRITE_UNDRAINED) {
    stream2._duplexState &= WRITE_DRAINED;
    if ((stream2._duplexState & WRITE_EMIT_DRAIN) === WRITE_EMIT_DRAIN) {
      stream2.emit("drain");
    }
  }
  this.updateCallback();
}
function afterRead(err) {
  if (err) this.stream.destroy(err);
  this.stream._duplexState &= READ_NOT_ACTIVE;
  if (this.readAhead === false && (this.stream._duplexState & READ_RESUMED) === 0) this.stream._duplexState &= READ_NO_READ_AHEAD;
  this.updateCallback();
}
function updateReadNT() {
  if ((this.stream._duplexState & READ_UPDATING) === 0) {
    this.stream._duplexState &= READ_NOT_NEXT_TICK;
    this.update();
  }
}
function updateWriteNT() {
  if ((this.stream._duplexState & WRITE_UPDATING) === 0) {
    this.stream._duplexState &= WRITE_NOT_NEXT_TICK;
    this.update();
  }
}
function tickDrains(drains) {
  for (let i = 0; i < drains.length; i++) {
    if (--drains[i].writes === 0) {
      drains.shift().resolve(true);
      i--;
    }
  }
}
function afterOpen(err) {
  const stream2 = this.stream;
  if (err) stream2.destroy(err);
  if ((stream2._duplexState & DESTROYING) === 0) {
    if ((stream2._duplexState & READ_PRIMARY_STATUS) === 0) stream2._duplexState |= READ_PRIMARY;
    if ((stream2._duplexState & WRITE_PRIMARY_STATUS) === 0) stream2._duplexState |= WRITE_PRIMARY;
    stream2.emit("open");
  }
  stream2._duplexState &= NOT_ACTIVE;
  if (stream2._writableState !== null) {
    stream2._writableState.updateCallback();
  }
  if (stream2._readableState !== null) {
    stream2._readableState.updateCallback();
  }
}
function newListener(name) {
  if (this._readableState !== null) {
    if (name === "data") {
      this._duplexState |= READ_EMIT_DATA | READ_RESUMED_READ_AHEAD;
      this._readableState.updateNextTick();
    }
    if (name === "readable") {
      this._duplexState |= READ_EMIT_READABLE;
      this._readableState.updateNextTick();
    }
  }
  if (this._writableState !== null) {
    if (name === "drain") {
      this._duplexState |= WRITE_EMIT_DRAIN;
      this._writableState.updateNextTick();
    }
  }
}
class Stream extends EventEmitter {
  constructor(opts) {
    super();
    this._duplexState = 0;
    this._readableState = null;
    this._writableState = null;
    if (opts) {
      if (opts.open) this._open = opts.open;
      if (opts.destroy) this._destroy = opts.destroy;
      if (opts.predestroy) this._predestroy = opts.predestroy;
      if (opts.signal) {
        opts.signal.addEventListener("abort", abort.bind(this));
      }
    }
    this.on("newListener", newListener);
  }
  _open(cb) {
    cb(null);
  }
  _destroy(cb) {
    cb(null);
  }
  _predestroy() {
  }
  get readable() {
    return this._readableState !== null ? true : void 0;
  }
  get writable() {
    return this._writableState !== null ? true : void 0;
  }
  get destroyed() {
    return (this._duplexState & DESTROYED) !== 0;
  }
  get destroying() {
    return (this._duplexState & DESTROY_STATUS) !== 0;
  }
  destroy(err) {
    if ((this._duplexState & DESTROY_STATUS) === 0) {
      if (!err) err = STREAM_DESTROYED;
      this._duplexState = (this._duplexState | DESTROYING) & NON_PRIMARY;
      if (this._readableState !== null) {
        this._readableState.highWaterMark = 0;
        this._readableState.error = err;
      }
      if (this._writableState !== null) {
        this._writableState.highWaterMark = 0;
        this._writableState.error = err;
      }
      this._duplexState |= PREDESTROYING;
      this._predestroy();
      this._duplexState &= NOT_PREDESTROYING;
      if (this._readableState !== null) this._readableState.updateNextTick();
      if (this._writableState !== null) this._writableState.updateNextTick();
    }
  }
}
let Readable$2 = class Readable extends Stream {
  constructor(opts) {
    super(opts);
    this._duplexState |= OPENING | WRITE_DONE | READ_READ_AHEAD;
    this._readableState = new ReadableState(this, opts);
    if (opts) {
      if (this._readableState.readAhead === false) this._duplexState &= READ_NO_READ_AHEAD;
      if (opts.read) this._read = opts.read;
      if (opts.eagerOpen) this._readableState.updateNextTick();
      if (opts.encoding) this.setEncoding(opts.encoding);
    }
  }
  setEncoding(encoding) {
    const dec = new TextDecoder2(encoding);
    const map2 = this._readableState.map || echo;
    this._readableState.map = mapOrSkip;
    return this;
    function mapOrSkip(data) {
      const next = dec.push(data);
      return next === "" && (data.byteLength !== 0 || dec.remaining > 0) ? null : map2(next);
    }
  }
  _read(cb) {
    cb(null);
  }
  pipe(dest, cb) {
    this._readableState.updateNextTick();
    this._readableState.pipe(dest, cb);
    return dest;
  }
  read() {
    this._readableState.updateNextTick();
    return this._readableState.read();
  }
  push(data) {
    this._readableState.updateNextTickIfOpen();
    return this._readableState.push(data);
  }
  unshift(data) {
    this._readableState.updateNextTickIfOpen();
    return this._readableState.unshift(data);
  }
  resume() {
    this._duplexState |= READ_RESUMED_READ_AHEAD;
    this._readableState.updateNextTick();
    return this;
  }
  pause() {
    this._duplexState &= this._readableState.readAhead === false ? READ_PAUSED_NO_READ_AHEAD : READ_PAUSED;
    return this;
  }
  static _fromAsyncIterator(ite, opts) {
    let destroy;
    const rs = new Readable({
      ...opts,
      read(cb) {
        ite.next().then(push).then(cb.bind(null, null)).catch(cb);
      },
      predestroy() {
        destroy = ite.return();
      },
      destroy(cb) {
        if (!destroy) return cb(null);
        destroy.then(cb.bind(null, null)).catch(cb);
      }
    });
    return rs;
    function push(data) {
      if (data.done) rs.push(null);
      else rs.push(data.value);
    }
  }
  static from(data, opts) {
    if (isReadStreamx(data)) return data;
    if (data[asyncIterator]) return this._fromAsyncIterator(data[asyncIterator](), opts);
    if (!Array.isArray(data)) data = data === void 0 ? [] : [data];
    let i = 0;
    return new Readable({
      ...opts,
      read(cb) {
        this.push(i === data.length ? null : data[i++]);
        cb(null);
      }
    });
  }
  static isBackpressured(rs) {
    return (rs._duplexState & READ_BACKPRESSURE_STATUS) !== 0 || rs._readableState.buffered >= rs._readableState.highWaterMark;
  }
  static isPaused(rs) {
    return (rs._duplexState & READ_RESUMED) === 0;
  }
  [asyncIterator]() {
    const stream2 = this;
    let error2 = null;
    let promiseResolve = null;
    let promiseReject = null;
    this.on("error", (err) => {
      error2 = err;
    });
    this.on("readable", onreadable);
    this.on("close", onclose);
    return {
      [asyncIterator]() {
        return this;
      },
      next() {
        return new Promise(function(resolve2, reject2) {
          promiseResolve = resolve2;
          promiseReject = reject2;
          const data = stream2.read();
          if (data !== null) ondata(data);
          else if ((stream2._duplexState & DESTROYED) !== 0) ondata(null);
        });
      },
      return() {
        return destroy(null);
      },
      throw(err) {
        return destroy(err);
      }
    };
    function onreadable() {
      if (promiseResolve !== null) ondata(stream2.read());
    }
    function onclose() {
      if (promiseResolve !== null) ondata(null);
    }
    function ondata(data) {
      if (promiseReject === null) return;
      if (error2) promiseReject(error2);
      else if (data === null && (stream2._duplexState & READ_DONE) === 0) promiseReject(STREAM_DESTROYED);
      else promiseResolve({ value: data, done: data === null });
      promiseReject = promiseResolve = null;
    }
    function destroy(err) {
      stream2.destroy(err);
      return new Promise((resolve2, reject2) => {
        if (stream2._duplexState & DESTROYED) return resolve2({ value: void 0, done: true });
        stream2.once("close", function() {
          if (err) reject2(err);
          else resolve2({ value: void 0, done: true });
        });
      });
    }
  }
};
let Writable$2 = class Writable extends Stream {
  constructor(opts) {
    super(opts);
    this._duplexState |= OPENING | READ_DONE;
    this._writableState = new WritableState(this, opts);
    if (opts) {
      if (opts.writev) this._writev = opts.writev;
      if (opts.write) this._write = opts.write;
      if (opts.final) this._final = opts.final;
      if (opts.eagerOpen) this._writableState.updateNextTick();
    }
  }
  cork() {
    this._duplexState |= WRITE_CORKED;
  }
  uncork() {
    this._duplexState &= WRITE_NOT_CORKED;
    this._writableState.updateNextTick();
  }
  _writev(batch, cb) {
    cb(null);
  }
  _write(data, cb) {
    this._writableState.autoBatch(data, cb);
  }
  _final(cb) {
    cb(null);
  }
  static isBackpressured(ws) {
    return (ws._duplexState & WRITE_BACKPRESSURE_STATUS) !== 0;
  }
  static drained(ws) {
    if (ws.destroyed) return Promise.resolve(false);
    const state2 = ws._writableState;
    const pending = isWritev(ws) ? Math.min(1, state2.queue.length) : state2.queue.length;
    const writes = pending + (ws._duplexState & WRITE_WRITING ? 1 : 0);
    if (writes === 0) return Promise.resolve(true);
    if (state2.drains === null) state2.drains = [];
    return new Promise((resolve2) => {
      state2.drains.push({ writes, resolve: resolve2 });
    });
  }
  write(data) {
    this._writableState.updateNextTick();
    return this._writableState.push(data);
  }
  end(data) {
    this._writableState.updateNextTick();
    this._writableState.end(data);
    return this;
  }
};
class Duplex extends Readable$2 {
  // and Writable
  constructor(opts) {
    super(opts);
    this._duplexState = OPENING | this._duplexState & READ_READ_AHEAD;
    this._writableState = new WritableState(this, opts);
    if (opts) {
      if (opts.writev) this._writev = opts.writev;
      if (opts.write) this._write = opts.write;
      if (opts.final) this._final = opts.final;
    }
  }
  cork() {
    this._duplexState |= WRITE_CORKED;
  }
  uncork() {
    this._duplexState &= WRITE_NOT_CORKED;
    this._writableState.updateNextTick();
  }
  _writev(batch, cb) {
    cb(null);
  }
  _write(data, cb) {
    this._writableState.autoBatch(data, cb);
  }
  _final(cb) {
    cb(null);
  }
  write(data) {
    this._writableState.updateNextTick();
    return this._writableState.push(data);
  }
  end(data) {
    this._writableState.updateNextTick();
    this._writableState.end(data);
    return this;
  }
}
function echo(s) {
  return s;
}
function isStream(stream2) {
  return !!stream2._readableState || !!stream2._writableState;
}
function isStreamx(stream2) {
  return typeof stream2._duplexState === "number" && isStream(stream2);
}
function getStreamError$2(stream2, opts = {}) {
  const err = stream2._readableState && stream2._readableState.error || stream2._writableState && stream2._writableState.error;
  return !opts.all && err === STREAM_DESTROYED ? null : err;
}
function isReadStreamx(stream2) {
  return isStreamx(stream2) && stream2.readable;
}
function isTypedArray(data) {
  return typeof data === "object" && data !== null && typeof data.byteLength === "number";
}
function defaultByteLength(data) {
  return isTypedArray(data) ? data.byteLength : 1024;
}
function noop$2() {
}
function abort() {
  this.destroy(new Error("Stream aborted."));
}
function isWritev(s) {
  return s._writev !== Writable$2.prototype._writev && s._writev !== Duplex.prototype._writev;
}
var streamx = {
  getStreamError: getStreamError$2,
  Writable: Writable$2,
  Readable: Readable$2
};
var headers$2 = {};
const b4a$2 = b4a$5;
const ZEROS = "0000000000000000000";
const SEVENS = "7777777777777777777";
const ZERO_OFFSET = "0".charCodeAt(0);
const USTAR_MAGIC = b4a$2.from([117, 115, 116, 97, 114, 0]);
const USTAR_VER = b4a$2.from([ZERO_OFFSET, ZERO_OFFSET]);
const GNU_MAGIC = b4a$2.from([117, 115, 116, 97, 114, 32]);
const GNU_VER = b4a$2.from([32, 0]);
const MASK = 4095;
const MAGIC_OFFSET = 257;
const VERSION_OFFSET = 263;
headers$2.decodeLongPath = function decodeLongPath(buf, encoding) {
  return decodeStr(buf, 0, buf.length, encoding);
};
headers$2.encodePax = function encodePax(opts) {
  let result = "";
  if (opts.name) result += addLength(" path=" + opts.name + "\n");
  if (opts.linkname) result += addLength(" linkpath=" + opts.linkname + "\n");
  const pax = opts.pax;
  if (pax) {
    for (const key in pax) {
      result += addLength(" " + key + "=" + pax[key] + "\n");
    }
  }
  return b4a$2.from(result);
};
headers$2.decodePax = function decodePax(buf) {
  const result = {};
  while (buf.length) {
    let i = 0;
    while (i < buf.length && buf[i] !== 32) i++;
    const len = parseInt(b4a$2.toString(buf.subarray(0, i)), 10);
    if (!len) return result;
    const b = b4a$2.toString(buf.subarray(i + 1, len - 1));
    const keyIndex = b.indexOf("=");
    if (keyIndex === -1) return result;
    result[b.slice(0, keyIndex)] = b.slice(keyIndex + 1);
    buf = buf.subarray(len);
  }
  return result;
};
headers$2.encode = function encode(opts) {
  const buf = b4a$2.alloc(512);
  let name = opts.name;
  let prefix = "";
  if (opts.typeflag === 5 && name[name.length - 1] !== "/") name += "/";
  if (b4a$2.byteLength(name) !== name.length) return null;
  while (b4a$2.byteLength(name) > 100) {
    const i = name.indexOf("/");
    if (i === -1) return null;
    prefix += prefix ? "/" + name.slice(0, i) : name.slice(0, i);
    name = name.slice(i + 1);
  }
  if (b4a$2.byteLength(name) > 100 || b4a$2.byteLength(prefix) > 155) return null;
  if (opts.linkname && b4a$2.byteLength(opts.linkname) > 100) return null;
  b4a$2.write(buf, name);
  b4a$2.write(buf, encodeOct(opts.mode & MASK, 6), 100);
  b4a$2.write(buf, encodeOct(opts.uid, 6), 108);
  b4a$2.write(buf, encodeOct(opts.gid, 6), 116);
  encodeSize(opts.size, buf, 124);
  b4a$2.write(buf, encodeOct(opts.mtime.getTime() / 1e3 | 0, 11), 136);
  buf[156] = ZERO_OFFSET + toTypeflag(opts.type);
  if (opts.linkname) b4a$2.write(buf, opts.linkname, 157);
  b4a$2.copy(USTAR_MAGIC, buf, MAGIC_OFFSET);
  b4a$2.copy(USTAR_VER, buf, VERSION_OFFSET);
  if (opts.uname) b4a$2.write(buf, opts.uname, 265);
  if (opts.gname) b4a$2.write(buf, opts.gname, 297);
  b4a$2.write(buf, encodeOct(opts.devmajor || 0, 6), 329);
  b4a$2.write(buf, encodeOct(opts.devminor || 0, 6), 337);
  if (prefix) b4a$2.write(buf, prefix, 345);
  b4a$2.write(buf, encodeOct(cksum(buf), 6), 148);
  return buf;
};
headers$2.decode = function decode(buf, filenameEncoding, allowUnknownFormat) {
  let typeflag = buf[156] === 0 ? 0 : buf[156] - ZERO_OFFSET;
  let name = decodeStr(buf, 0, 100, filenameEncoding);
  const mode = decodeOct(buf, 100, 8);
  const uid = decodeOct(buf, 108, 8);
  const gid = decodeOct(buf, 116, 8);
  const size = decodeOct(buf, 124, 12);
  const mtime = decodeOct(buf, 136, 12);
  const type = toType(typeflag);
  const linkname = buf[157] === 0 ? null : decodeStr(buf, 157, 100, filenameEncoding);
  const uname = decodeStr(buf, 265, 32);
  const gname = decodeStr(buf, 297, 32);
  const devmajor = decodeOct(buf, 329, 8);
  const devminor = decodeOct(buf, 337, 8);
  const c = cksum(buf);
  if (c === 8 * 32) return null;
  if (c !== decodeOct(buf, 148, 8)) throw new Error("Invalid tar header. Maybe the tar is corrupted or it needs to be gunzipped?");
  if (isUSTAR(buf)) {
    if (buf[345]) name = decodeStr(buf, 345, 155, filenameEncoding) + "/" + name;
  } else if (isGNU(buf)) ;
  else {
    if (!allowUnknownFormat) {
      throw new Error("Invalid tar header: unknown format.");
    }
  }
  if (typeflag === 0 && name && name[name.length - 1] === "/") typeflag = 5;
  return {
    name,
    mode,
    uid,
    gid,
    size,
    mtime: new Date(1e3 * mtime),
    type,
    linkname,
    uname,
    gname,
    devmajor,
    devminor,
    pax: null
  };
};
function isUSTAR(buf) {
  return b4a$2.equals(USTAR_MAGIC, buf.subarray(MAGIC_OFFSET, MAGIC_OFFSET + 6));
}
function isGNU(buf) {
  return b4a$2.equals(GNU_MAGIC, buf.subarray(MAGIC_OFFSET, MAGIC_OFFSET + 6)) && b4a$2.equals(GNU_VER, buf.subarray(VERSION_OFFSET, VERSION_OFFSET + 2));
}
function clamp(index2, len, defaultValue) {
  if (typeof index2 !== "number") return defaultValue;
  index2 = ~~index2;
  if (index2 >= len) return len;
  if (index2 >= 0) return index2;
  index2 += len;
  if (index2 >= 0) return index2;
  return 0;
}
function toType(flag) {
  switch (flag) {
    case 0:
      return "file";
    case 1:
      return "link";
    case 2:
      return "symlink";
    case 3:
      return "character-device";
    case 4:
      return "block-device";
    case 5:
      return "directory";
    case 6:
      return "fifo";
    case 7:
      return "contiguous-file";
    case 72:
      return "pax-header";
    case 55:
      return "pax-global-header";
    case 27:
      return "gnu-long-link-path";
    case 28:
    case 30:
      return "gnu-long-path";
  }
  return null;
}
function toTypeflag(flag) {
  switch (flag) {
    case "file":
      return 0;
    case "link":
      return 1;
    case "symlink":
      return 2;
    case "character-device":
      return 3;
    case "block-device":
      return 4;
    case "directory":
      return 5;
    case "fifo":
      return 6;
    case "contiguous-file":
      return 7;
    case "pax-header":
      return 72;
  }
  return 0;
}
function indexOf(block, num, offset, end) {
  for (; offset < end; offset++) {
    if (block[offset] === num) return offset;
  }
  return end;
}
function cksum(block) {
  let sum = 8 * 32;
  for (let i = 0; i < 148; i++) sum += block[i];
  for (let j = 156; j < 512; j++) sum += block[j];
  return sum;
}
function encodeOct(val, n) {
  val = val.toString(8);
  if (val.length > n) return SEVENS.slice(0, n) + " ";
  return ZEROS.slice(0, n - val.length) + val + " ";
}
function encodeSizeBin(num, buf, off) {
  buf[off] = 128;
  for (let i = 11; i > 0; i--) {
    buf[off + i] = num & 255;
    num = Math.floor(num / 256);
  }
}
function encodeSize(num, buf, off) {
  if (num.toString(8).length > 11) {
    encodeSizeBin(num, buf, off);
  } else {
    b4a$2.write(buf, encodeOct(num, 11), off);
  }
}
function parse256(buf) {
  let positive;
  if (buf[0] === 128) positive = true;
  else if (buf[0] === 255) positive = false;
  else return null;
  const tuple = [];
  let i;
  for (i = buf.length - 1; i > 0; i--) {
    const byte = buf[i];
    if (positive) tuple.push(byte);
    else tuple.push(255 - byte);
  }
  let sum = 0;
  const l = tuple.length;
  for (i = 0; i < l; i++) {
    sum += tuple[i] * Math.pow(256, i);
  }
  return positive ? sum : -1 * sum;
}
function decodeOct(val, offset, length) {
  val = val.subarray(offset, offset + length);
  offset = 0;
  if (val[offset] & 128) {
    return parse256(val);
  } else {
    while (offset < val.length && val[offset] === 32) offset++;
    const end = clamp(indexOf(val, 32, offset, val.length), val.length, val.length);
    while (offset < end && val[offset] === 0) offset++;
    if (end === offset) return 0;
    return parseInt(b4a$2.toString(val.subarray(offset, end)), 8);
  }
}
function decodeStr(val, offset, length, encoding) {
  return b4a$2.toString(val.subarray(offset, indexOf(val, 0, offset, offset + length)), encoding);
}
function addLength(str) {
  const len = b4a$2.byteLength(str);
  let digits = Math.floor(Math.log(len) / Math.log(10)) + 1;
  if (len + digits >= Math.pow(10, digits)) digits++;
  return len + digits + str;
}
const { Writable: Writable$1, Readable: Readable$1, getStreamError: getStreamError$1 } = streamx;
const FIFO = fastFifo;
const b4a$1 = b4a$5;
const headers$1 = headers$2;
const EMPTY = b4a$1.alloc(0);
class BufferList {
  constructor() {
    this.buffered = 0;
    this.shifted = 0;
    this.queue = new FIFO();
    this._offset = 0;
  }
  push(buffer) {
    this.buffered += buffer.byteLength;
    this.queue.push(buffer);
  }
  shiftFirst(size) {
    return this._buffered === 0 ? null : this._next(size);
  }
  shift(size) {
    if (size > this.buffered) return null;
    if (size === 0) return EMPTY;
    let chunk = this._next(size);
    if (size === chunk.byteLength) return chunk;
    const chunks = [chunk];
    while ((size -= chunk.byteLength) > 0) {
      chunk = this._next(size);
      chunks.push(chunk);
    }
    return b4a$1.concat(chunks);
  }
  _next(size) {
    const buf = this.queue.peek();
    const rem = buf.byteLength - this._offset;
    if (size >= rem) {
      const sub = this._offset ? buf.subarray(this._offset, buf.byteLength) : buf;
      this.queue.shift();
      this._offset = 0;
      this.buffered -= rem;
      this.shifted += rem;
      return sub;
    }
    this.buffered -= size;
    this.shifted += size;
    return buf.subarray(this._offset, this._offset += size);
  }
}
class Source extends Readable$1 {
  constructor(self2, header, offset) {
    super();
    this.header = header;
    this.offset = offset;
    this._parent = self2;
  }
  _read(cb) {
    if (this.header.size === 0) {
      this.push(null);
    }
    if (this._parent._stream === this) {
      this._parent._update();
    }
    cb(null);
  }
  _predestroy() {
    this._parent.destroy(getStreamError$1(this));
  }
  _detach() {
    if (this._parent._stream === this) {
      this._parent._stream = null;
      this._parent._missing = overflow$1(this.header.size);
      this._parent._update();
    }
  }
  _destroy(cb) {
    this._detach();
    cb(null);
  }
}
class Extract extends Writable$1 {
  constructor(opts) {
    super(opts);
    if (!opts) opts = {};
    this._buffer = new BufferList();
    this._offset = 0;
    this._header = null;
    this._stream = null;
    this._missing = 0;
    this._longHeader = false;
    this._callback = noop$1;
    this._locked = false;
    this._finished = false;
    this._pax = null;
    this._paxGlobal = null;
    this._gnuLongPath = null;
    this._gnuLongLinkPath = null;
    this._filenameEncoding = opts.filenameEncoding || "utf-8";
    this._allowUnknownFormat = !!opts.allowUnknownFormat;
    this._unlockBound = this._unlock.bind(this);
  }
  _unlock(err) {
    this._locked = false;
    if (err) {
      this.destroy(err);
      this._continueWrite(err);
      return;
    }
    this._update();
  }
  _consumeHeader() {
    if (this._locked) return false;
    this._offset = this._buffer.shifted;
    try {
      this._header = headers$1.decode(this._buffer.shift(512), this._filenameEncoding, this._allowUnknownFormat);
    } catch (err) {
      this._continueWrite(err);
      return false;
    }
    if (!this._header) return true;
    switch (this._header.type) {
      case "gnu-long-path":
      case "gnu-long-link-path":
      case "pax-global-header":
      case "pax-header":
        this._longHeader = true;
        this._missing = this._header.size;
        return true;
    }
    this._locked = true;
    this._applyLongHeaders();
    if (this._header.size === 0 || this._header.type === "directory") {
      this.emit("entry", this._header, this._createStream(), this._unlockBound);
      return true;
    }
    this._stream = this._createStream();
    this._missing = this._header.size;
    this.emit("entry", this._header, this._stream, this._unlockBound);
    return true;
  }
  _applyLongHeaders() {
    if (this._gnuLongPath) {
      this._header.name = this._gnuLongPath;
      this._gnuLongPath = null;
    }
    if (this._gnuLongLinkPath) {
      this._header.linkname = this._gnuLongLinkPath;
      this._gnuLongLinkPath = null;
    }
    if (this._pax) {
      if (this._pax.path) this._header.name = this._pax.path;
      if (this._pax.linkpath) this._header.linkname = this._pax.linkpath;
      if (this._pax.size) this._header.size = parseInt(this._pax.size, 10);
      this._header.pax = this._pax;
      this._pax = null;
    }
  }
  _decodeLongHeader(buf) {
    switch (this._header.type) {
      case "gnu-long-path":
        this._gnuLongPath = headers$1.decodeLongPath(buf, this._filenameEncoding);
        break;
      case "gnu-long-link-path":
        this._gnuLongLinkPath = headers$1.decodeLongPath(buf, this._filenameEncoding);
        break;
      case "pax-global-header":
        this._paxGlobal = headers$1.decodePax(buf);
        break;
      case "pax-header":
        this._pax = this._paxGlobal === null ? headers$1.decodePax(buf) : Object.assign({}, this._paxGlobal, headers$1.decodePax(buf));
        break;
    }
  }
  _consumeLongHeader() {
    this._longHeader = false;
    this._missing = overflow$1(this._header.size);
    const buf = this._buffer.shift(this._header.size);
    try {
      this._decodeLongHeader(buf);
    } catch (err) {
      this._continueWrite(err);
      return false;
    }
    return true;
  }
  _consumeStream() {
    const buf = this._buffer.shiftFirst(this._missing);
    if (buf === null) return false;
    this._missing -= buf.byteLength;
    const drained = this._stream.push(buf);
    if (this._missing === 0) {
      this._stream.push(null);
      if (drained) this._stream._detach();
      return drained && this._locked === false;
    }
    return drained;
  }
  _createStream() {
    return new Source(this, this._header, this._offset);
  }
  _update() {
    while (this._buffer.buffered > 0 && !this.destroying) {
      if (this._missing > 0) {
        if (this._stream !== null) {
          if (this._consumeStream() === false) return;
          continue;
        }
        if (this._longHeader === true) {
          if (this._missing > this._buffer.buffered) break;
          if (this._consumeLongHeader() === false) return false;
          continue;
        }
        const ignore = this._buffer.shiftFirst(this._missing);
        if (ignore !== null) this._missing -= ignore.byteLength;
        continue;
      }
      if (this._buffer.buffered < 512) break;
      if (this._stream !== null || this._consumeHeader() === false) return;
    }
    this._continueWrite(null);
  }
  _continueWrite(err) {
    const cb = this._callback;
    this._callback = noop$1;
    cb(err);
  }
  _write(data, cb) {
    this._callback = cb;
    this._buffer.push(data);
    this._update();
  }
  _final(cb) {
    this._finished = this._missing === 0 && this._buffer.buffered === 0;
    cb(this._finished ? null : new Error("Unexpected end of data"));
  }
  _predestroy() {
    this._continueWrite(null);
  }
  _destroy(cb) {
    if (this._stream) this._stream.destroy(getStreamError$1(this));
    cb(null);
  }
  [Symbol.asyncIterator]() {
    let error2 = null;
    let promiseResolve = null;
    let promiseReject = null;
    let entryStream = null;
    let entryCallback = null;
    const extract3 = this;
    this.on("entry", onentry);
    this.on("error", (err) => {
      error2 = err;
    });
    this.on("close", onclose);
    return {
      [Symbol.asyncIterator]() {
        return this;
      },
      next() {
        return new Promise(onnext);
      },
      return() {
        return destroy(null);
      },
      throw(err) {
        return destroy(err);
      }
    };
    function consumeCallback(err) {
      if (!entryCallback) return;
      const cb = entryCallback;
      entryCallback = null;
      cb(err);
    }
    function onnext(resolve2, reject2) {
      if (error2) {
        return reject2(error2);
      }
      if (entryStream) {
        resolve2({ value: entryStream, done: false });
        entryStream = null;
        return;
      }
      promiseResolve = resolve2;
      promiseReject = reject2;
      consumeCallback(null);
      if (extract3._finished && promiseResolve) {
        promiseResolve({ value: void 0, done: true });
        promiseResolve = promiseReject = null;
      }
    }
    function onentry(header, stream2, callback) {
      entryCallback = callback;
      stream2.on("error", noop$1);
      if (promiseResolve) {
        promiseResolve({ value: stream2, done: false });
        promiseResolve = promiseReject = null;
      } else {
        entryStream = stream2;
      }
    }
    function onclose() {
      consumeCallback(error2);
      if (!promiseResolve) return;
      if (error2) promiseReject(error2);
      else promiseResolve({ value: void 0, done: true });
      promiseResolve = promiseReject = null;
    }
    function destroy(err) {
      extract3.destroy(err);
      consumeCallback(err);
      return new Promise((resolve2, reject2) => {
        if (extract3.destroyed) return resolve2({ value: void 0, done: true });
        extract3.once("close", function() {
          if (err) reject2(err);
          else resolve2({ value: void 0, done: true });
        });
      });
    }
  }
}
var extract = function extract2(opts) {
  return new Extract(opts);
};
function noop$1() {
}
function overflow$1(size) {
  size &= 511;
  return size && 512 - size;
}
var constants$2 = { exports: {} };
const constants$1 = {
  // just for envs without fs
  S_IFMT: 61440,
  S_IFDIR: 16384,
  S_IFCHR: 8192,
  S_IFBLK: 24576,
  S_IFIFO: 4096,
  S_IFLNK: 40960
};
try {
  constants$2.exports = require("fs").constants || constants$1;
} catch {
  constants$2.exports = constants$1;
}
var constantsExports = constants$2.exports;
const { Readable: Readable2, Writable: Writable2, getStreamError } = streamx;
const b4a = b4a$5;
const constants = constantsExports;
const headers = headers$2;
const DMODE = 493;
const FMODE = 420;
const END_OF_TAR = b4a.alloc(1024);
class Sink extends Writable2 {
  constructor(pack3, header, callback) {
    super({ mapWritable, eagerOpen: true });
    this.written = 0;
    this.header = header;
    this._callback = callback;
    this._linkname = null;
    this._isLinkname = header.type === "symlink" && !header.linkname;
    this._isVoid = header.type !== "file" && header.type !== "contiguous-file";
    this._finished = false;
    this._pack = pack3;
    this._openCallback = null;
    if (this._pack._stream === null) this._pack._stream = this;
    else this._pack._pending.push(this);
  }
  _open(cb) {
    this._openCallback = cb;
    if (this._pack._stream === this) this._continueOpen();
  }
  _continuePack(err) {
    if (this._callback === null) return;
    const callback = this._callback;
    this._callback = null;
    callback(err);
  }
  _continueOpen() {
    if (this._pack._stream === null) this._pack._stream = this;
    const cb = this._openCallback;
    this._openCallback = null;
    if (cb === null) return;
    if (this._pack.destroying) return cb(new Error("pack stream destroyed"));
    if (this._pack._finalized) return cb(new Error("pack stream is already finalized"));
    this._pack._stream = this;
    if (!this._isLinkname) {
      this._pack._encode(this.header);
    }
    if (this._isVoid) {
      this._finish();
      this._continuePack(null);
    }
    cb(null);
  }
  _write(data, cb) {
    if (this._isLinkname) {
      this._linkname = this._linkname ? b4a.concat([this._linkname, data]) : data;
      return cb(null);
    }
    if (this._isVoid) {
      if (data.byteLength > 0) {
        return cb(new Error("No body allowed for this entry"));
      }
      return cb();
    }
    this.written += data.byteLength;
    if (this._pack.push(data)) return cb();
    this._pack._drain = cb;
  }
  _finish() {
    if (this._finished) return;
    this._finished = true;
    if (this._isLinkname) {
      this.header.linkname = this._linkname ? b4a.toString(this._linkname, "utf-8") : "";
      this._pack._encode(this.header);
    }
    overflow(this._pack, this.header.size);
    this._pack._done(this);
  }
  _final(cb) {
    if (this.written !== this.header.size) {
      return cb(new Error("Size mismatch"));
    }
    this._finish();
    cb(null);
  }
  _getError() {
    return getStreamError(this) || new Error("tar entry destroyed");
  }
  _predestroy() {
    this._pack.destroy(this._getError());
  }
  _destroy(cb) {
    this._pack._done(this);
    this._continuePack(this._finished ? null : this._getError());
    cb();
  }
}
class Pack extends Readable2 {
  constructor(opts) {
    super(opts);
    this._drain = noop;
    this._finalized = false;
    this._finalizing = false;
    this._pending = [];
    this._stream = null;
  }
  entry(header, buffer, callback) {
    if (this._finalized || this.destroying) throw new Error("already finalized or destroyed");
    if (typeof buffer === "function") {
      callback = buffer;
      buffer = null;
    }
    if (!callback) callback = noop;
    if (!header.size || header.type === "symlink") header.size = 0;
    if (!header.type) header.type = modeToType(header.mode);
    if (!header.mode) header.mode = header.type === "directory" ? DMODE : FMODE;
    if (!header.uid) header.uid = 0;
    if (!header.gid) header.gid = 0;
    if (!header.mtime) header.mtime = /* @__PURE__ */ new Date();
    if (typeof buffer === "string") buffer = b4a.from(buffer);
    const sink = new Sink(this, header, callback);
    if (b4a.isBuffer(buffer)) {
      header.size = buffer.byteLength;
      sink.write(buffer);
      sink.end();
      return sink;
    }
    if (sink._isVoid) {
      return sink;
    }
    return sink;
  }
  finalize() {
    if (this._stream || this._pending.length > 0) {
      this._finalizing = true;
      return;
    }
    if (this._finalized) return;
    this._finalized = true;
    this.push(END_OF_TAR);
    this.push(null);
  }
  _done(stream2) {
    if (stream2 !== this._stream) return;
    this._stream = null;
    if (this._finalizing) this.finalize();
    if (this._pending.length) this._pending.shift()._continueOpen();
  }
  _encode(header) {
    if (!header.pax) {
      const buf = headers.encode(header);
      if (buf) {
        this.push(buf);
        return;
      }
    }
    this._encodePax(header);
  }
  _encodePax(header) {
    const paxHeader = headers.encodePax({
      name: header.name,
      linkname: header.linkname,
      pax: header.pax
    });
    const newHeader = {
      name: "PaxHeader",
      mode: header.mode,
      uid: header.uid,
      gid: header.gid,
      size: paxHeader.byteLength,
      mtime: header.mtime,
      type: "pax-header",
      linkname: header.linkname && "PaxHeader",
      uname: header.uname,
      gname: header.gname,
      devmajor: header.devmajor,
      devminor: header.devminor
    };
    this.push(headers.encode(newHeader));
    this.push(paxHeader);
    overflow(this, paxHeader.byteLength);
    newHeader.size = header.size;
    newHeader.type = header.type;
    this.push(headers.encode(newHeader));
  }
  _doDrain() {
    const drain = this._drain;
    this._drain = noop;
    drain();
  }
  _predestroy() {
    const err = getStreamError(this);
    if (this._stream) this._stream.destroy(err);
    while (this._pending.length) {
      const stream2 = this._pending.shift();
      stream2.destroy(err);
      stream2._continueOpen();
    }
    this._doDrain();
  }
  _read(cb) {
    this._doDrain();
    cb();
  }
}
var pack = function pack2(opts) {
  return new Pack(opts);
};
function modeToType(mode) {
  switch (mode & constants.S_IFMT) {
    case constants.S_IFBLK:
      return "block-device";
    case constants.S_IFCHR:
      return "character-device";
    case constants.S_IFDIR:
      return "directory";
    case constants.S_IFIFO:
      return "fifo";
    case constants.S_IFLNK:
      return "symlink";
  }
  return "file";
}
function noop() {
}
function overflow(self2, size) {
  size &= 511;
  if (size) self2.push(END_OF_TAR.subarray(0, 512 - size));
}
function mapWritable(buf) {
  return b4a.isBuffer(buf) ? buf : b4a.from(buf);
}
tarStream.extract = extract;
tarStream.pack = pack;
/**
 * TAR Format Plugin
 *
 * @module plugins/tar
 * @license [MIT]{@link https://github.com/archiverjs/node-archiver/blob/master/LICENSE}
 * @copyright (c) 2012-2014 Chris Talkington, contributors.
 */
var zlib = require$$0$5;
var engine = tarStream;
var util$1 = archiverUtilsExports;
var Tar = function(options) {
  if (!(this instanceof Tar)) {
    return new Tar(options);
  }
  options = this.options = util$1.defaults(options, {
    gzip: false
  });
  if (typeof options.gzipOptions !== "object") {
    options.gzipOptions = {};
  }
  this.supports = {
    directory: true,
    symlink: true
  };
  this.engine = engine.pack(options);
  this.compressor = false;
  if (options.gzip) {
    this.compressor = zlib.createGzip(options.gzipOptions);
    this.compressor.on("error", this._onCompressorError.bind(this));
  }
};
Tar.prototype._onCompressorError = function(err) {
  this.engine.emit("error", err);
};
Tar.prototype.append = function(source, data, callback) {
  var self2 = this;
  data.mtime = data.date;
  function append(err, sourceBuffer) {
    if (err) {
      callback(err);
      return;
    }
    self2.engine.entry(data, sourceBuffer, function(err2) {
      callback(err2, data);
    });
  }
  if (data.sourceType === "buffer") {
    append(null, source);
  } else if (data.sourceType === "stream" && data.stats) {
    data.size = data.stats.size;
    var entry = self2.engine.entry(data, function(err) {
      callback(err, data);
    });
    source.pipe(entry);
  } else if (data.sourceType === "stream") {
    util$1.collectStream(source, append);
  }
};
Tar.prototype.finalize = function() {
  this.engine.finalize();
};
Tar.prototype.on = function() {
  return this.engine.on.apply(this.engine, arguments);
};
Tar.prototype.pipe = function(destination, options) {
  if (this.compressor) {
    return this.engine.pipe.apply(this.engine, [this.compressor]).pipe(destination, options);
  } else {
    return this.engine.pipe.apply(this.engine, arguments);
  }
};
Tar.prototype.unpipe = function() {
  if (this.compressor) {
    return this.compressor.unpipe.apply(this.compressor, arguments);
  } else {
    return this.engine.unpipe.apply(this.engine, arguments);
  }
};
var tar = Tar;
var Buffer$1 = require$$0$4.Buffer;
var CRC_TABLE = [
  0,
  1996959894,
  3993919788,
  2567524794,
  124634137,
  1886057615,
  3915621685,
  2657392035,
  249268274,
  2044508324,
  3772115230,
  2547177864,
  162941995,
  2125561021,
  3887607047,
  2428444049,
  498536548,
  1789927666,
  4089016648,
  2227061214,
  450548861,
  1843258603,
  4107580753,
  2211677639,
  325883990,
  1684777152,
  4251122042,
  2321926636,
  335633487,
  1661365465,
  4195302755,
  2366115317,
  997073096,
  1281953886,
  3579855332,
  2724688242,
  1006888145,
  1258607687,
  3524101629,
  2768942443,
  901097722,
  1119000684,
  3686517206,
  2898065728,
  853044451,
  1172266101,
  3705015759,
  2882616665,
  651767980,
  1373503546,
  3369554304,
  3218104598,
  565507253,
  1454621731,
  3485111705,
  3099436303,
  671266974,
  1594198024,
  3322730930,
  2970347812,
  795835527,
  1483230225,
  3244367275,
  3060149565,
  1994146192,
  31158534,
  2563907772,
  4023717930,
  1907459465,
  112637215,
  2680153253,
  3904427059,
  2013776290,
  251722036,
  2517215374,
  3775830040,
  2137656763,
  141376813,
  2439277719,
  3865271297,
  1802195444,
  476864866,
  2238001368,
  4066508878,
  1812370925,
  453092731,
  2181625025,
  4111451223,
  1706088902,
  314042704,
  2344532202,
  4240017532,
  1658658271,
  366619977,
  2362670323,
  4224994405,
  1303535960,
  984961486,
  2747007092,
  3569037538,
  1256170817,
  1037604311,
  2765210733,
  3554079995,
  1131014506,
  879679996,
  2909243462,
  3663771856,
  1141124467,
  855842277,
  2852801631,
  3708648649,
  1342533948,
  654459306,
  3188396048,
  3373015174,
  1466479909,
  544179635,
  3110523913,
  3462522015,
  1591671054,
  702138776,
  2966460450,
  3352799412,
  1504918807,
  783551873,
  3082640443,
  3233442989,
  3988292384,
  2596254646,
  62317068,
  1957810842,
  3939845945,
  2647816111,
  81470997,
  1943803523,
  3814918930,
  2489596804,
  225274430,
  2053790376,
  3826175755,
  2466906013,
  167816743,
  2097651377,
  4027552580,
  2265490386,
  503444072,
  1762050814,
  4150417245,
  2154129355,
  426522225,
  1852507879,
  4275313526,
  2312317920,
  282753626,
  1742555852,
  4189708143,
  2394877945,
  397917763,
  1622183637,
  3604390888,
  2714866558,
  953729732,
  1340076626,
  3518719985,
  2797360999,
  1068828381,
  1219638859,
  3624741850,
  2936675148,
  906185462,
  1090812512,
  3747672003,
  2825379669,
  829329135,
  1181335161,
  3412177804,
  3160834842,
  628085408,
  1382605366,
  3423369109,
  3138078467,
  570562233,
  1426400815,
  3317316542,
  2998733608,
  733239954,
  1555261956,
  3268935591,
  3050360625,
  752459403,
  1541320221,
  2607071920,
  3965973030,
  1969922972,
  40735498,
  2617837225,
  3943577151,
  1913087877,
  83908371,
  2512341634,
  3803740692,
  2075208622,
  213261112,
  2463272603,
  3855990285,
  2094854071,
  198958881,
  2262029012,
  4057260610,
  1759359992,
  534414190,
  2176718541,
  4139329115,
  1873836001,
  414664567,
  2282248934,
  4279200368,
  1711684554,
  285281116,
  2405801727,
  4167216745,
  1634467795,
  376229701,
  2685067896,
  3608007406,
  1308918612,
  956543938,
  2808555105,
  3495958263,
  1231636301,
  1047427035,
  2932959818,
  3654703836,
  1088359270,
  936918e3,
  2847714899,
  3736837829,
  1202900863,
  817233897,
  3183342108,
  3401237130,
  1404277552,
  615818150,
  3134207493,
  3453421203,
  1423857449,
  601450431,
  3009837614,
  3294710456,
  1567103746,
  711928724,
  3020668471,
  3272380065,
  1510334235,
  755167117
];
if (typeof Int32Array !== "undefined") {
  CRC_TABLE = new Int32Array(CRC_TABLE);
}
function ensureBuffer(input) {
  if (Buffer$1.isBuffer(input)) {
    return input;
  }
  var hasNewBufferAPI = typeof Buffer$1.alloc === "function" && typeof Buffer$1.from === "function";
  if (typeof input === "number") {
    return hasNewBufferAPI ? Buffer$1.alloc(input) : new Buffer$1(input);
  } else if (typeof input === "string") {
    return hasNewBufferAPI ? Buffer$1.from(input) : new Buffer$1(input);
  } else {
    throw new Error("input must be buffer, number, or string, received " + typeof input);
  }
}
function bufferizeInt(num) {
  var tmp = ensureBuffer(4);
  tmp.writeInt32BE(num, 0);
  return tmp;
}
function _crc32(buf, previous) {
  buf = ensureBuffer(buf);
  if (Buffer$1.isBuffer(previous)) {
    previous = previous.readUInt32BE(0);
  }
  var crc = ~~previous ^ -1;
  for (var n = 0; n < buf.length; n++) {
    crc = CRC_TABLE[(crc ^ buf[n]) & 255] ^ crc >>> 8;
  }
  return crc ^ -1;
}
function crc32$1() {
  return bufferizeInt(_crc32.apply(null, arguments));
}
crc32$1.signed = function() {
  return _crc32.apply(null, arguments);
};
crc32$1.unsigned = function() {
  return _crc32.apply(null, arguments) >>> 0;
};
var bufferCrc32 = crc32$1;
/**
 * JSON Format Plugin
 *
 * @module plugins/json
 * @license [MIT]{@link https://github.com/archiverjs/node-archiver/blob/master/LICENSE}
 * @copyright (c) 2012-2014 Chris Talkington, contributors.
 */
var inherits = require$$0$3.inherits;
var Transform = readableExports.Transform;
var crc32 = bufferCrc32;
var util = archiverUtilsExports;
var Json = function(options) {
  if (!(this instanceof Json)) {
    return new Json(options);
  }
  options = this.options = util.defaults(options, {});
  Transform.call(this, options);
  this.supports = {
    directory: true,
    symlink: true
  };
  this.files = [];
};
inherits(Json, Transform);
Json.prototype._transform = function(chunk, encoding, callback) {
  callback(null, chunk);
};
Json.prototype._writeStringified = function() {
  var fileString = JSON.stringify(this.files);
  this.write(fileString);
};
Json.prototype.append = function(source, data, callback) {
  var self2 = this;
  data.crc32 = 0;
  function onend(err, sourceBuffer) {
    if (err) {
      callback(err);
      return;
    }
    data.size = sourceBuffer.length || 0;
    data.crc32 = crc32.unsigned(sourceBuffer);
    self2.files.push(data);
    callback(null, data);
  }
  if (data.sourceType === "buffer") {
    onend(null, source);
  } else if (data.sourceType === "stream") {
    util.collectStream(source, onend);
  }
};
Json.prototype.finalize = function() {
  this._writeStringified();
  this.end();
};
var json = Json;
/**
 * Archiver Vending
 *
 * @ignore
 * @license [MIT]{@link https://github.com/archiverjs/node-archiver/blob/master/LICENSE}
 * @copyright (c) 2012-2014 Chris Talkington, contributors.
 */
var Archiver = core;
var formats = {};
var vending = function(format, options) {
  return vending.create(format, options);
};
vending.create = function(format, options) {
  if (formats[format]) {
    var instance = new Archiver(format, options);
    instance.setFormat(format);
    instance.setModule(new formats[format](options));
    return instance;
  } else {
    throw new Error("create(" + format + "): format not registered");
  }
};
vending.registerFormat = function(format, module2) {
  if (formats[format]) {
    throw new Error("register(" + format + "): format already registered");
  }
  if (typeof module2 !== "function") {
    throw new Error("register(" + format + "): format module invalid");
  }
  if (typeof module2.prototype.append !== "function" || typeof module2.prototype.finalize !== "function") {
    throw new Error("register(" + format + "): format module missing methods");
  }
  formats[format] = module2;
};
vending.isRegisteredFormat = function(format) {
  if (formats[format]) {
    return true;
  }
  return false;
};
vending.registerFormat("zip", zip);
vending.registerFormat("tar", tar);
vending.registerFormat("json", json);
var archiver = vending;
const archiver$1 = /* @__PURE__ */ getDefaultExportFromCjs(archiver);
class StaticServer {
  constructor() {
    __publicField(this, "server", null);
    __publicField(this, "port", 0);
  }
  start() {
    if (this.server) return;
    const pluginsRoot = pathManager.getPluginsDir();
    this.server = http.createServer((req, res) => {
      try {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
        res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
        if (req.method === "OPTIONS") {
          res.statusCode = 204;
          res.end();
          return;
        }
        const parsed = url.parse(req.url || "/");
        let pathname = decodeURIComponent(parsed.pathname || "/");
        if (!pathname || pathname === "/") {
          res.statusCode = 404;
          res.end("Not Found");
          return;
        }
        const safePath = path$6.normalize(path$6.join(pluginsRoot, pathname));
        if (!safePath.startsWith(pluginsRoot)) {
          res.statusCode = 403;
          res.end("Forbidden");
          return;
        }
        let filePath = safePath;
        if (fs$8.existsSync(filePath) && fs$8.statSync(filePath).isDirectory()) {
          filePath = path$6.join(filePath, "index.html");
        }
        if (!fs$8.existsSync(filePath) || fs$8.statSync(filePath).isDirectory()) {
          res.statusCode = 404;
          res.end("Not Found");
          return;
        }
        const ext2 = path$6.extname(filePath).toLowerCase();
        const mime = this.getMime(ext2);
        res.setHeader("Content-Type", mime);
        res.setHeader("Cache-Control", "no-cache");
        fs$8.createReadStream(filePath).pipe(res);
      } catch (e) {
        res.statusCode = 500;
        res.end("Internal Server Error");
      }
    });
    this.server.listen(0, "127.0.0.1", () => {
      var _a;
      const addr = (_a = this.server) == null ? void 0 : _a.address();
      if (typeof addr === "object" && addr) {
        this.port = addr.port;
        console.log("[StaticServer] started on", this.getBaseUrl());
      }
    });
  }
  getMime(ext2) {
    switch (ext2) {
      case ".html":
        return "text/html; charset=utf-8";
      case ".js":
        return "application/javascript; charset=utf-8";
      case ".css":
        return "text/css; charset=utf-8";
      case ".json":
        return "application/json; charset=utf-8";
      case ".png":
        return "image/png";
      case ".jpg":
      case ".jpeg":
        return "image/jpeg";
      case ".svg":
        return "image/svg+xml";
      case ".ico":
        return "image/x-icon";
      case ".woff":
        return "font/woff";
      case ".woff2":
        return "font/woff2";
      case ".ttf":
        return "font/ttf";
      default:
        return "application/octet-stream";
    }
  }
  getBaseUrl() {
    return `http://127.0.0.1:${this.port}`;
  }
}
const staticServer = new StaticServer();
class ConfigManager {
  constructor() {
    __publicField(this, "configPath");
    __publicField(this, "config", null);
    this.configPath = path$6.join(__dirname, "../config.json");
  }
  getConfig() {
    if (this.config) {
      return this.config;
    }
    if (!fs$8.existsSync(this.configPath)) {
      throw new Error(`配置文件不存在: ${this.configPath}`);
    }
    try {
      const configData = JSON.parse(fs$8.readFileSync(this.configPath, "utf-8"));
      this.config = {
        key: configData.key || "",
        title: configData.title || "优创客户端体验版",
        version: configData.version || "0.3.0",
        description: configData.description || "插件化客户端应用",
        tracker: configData.tracker || {
          enabled: true,
          baseUrl: "https://scriptv2.qfei.cn/",
          clientType: "VideoConverter",
          clientId: 2
        },
        ipcAllowlist: Array.isArray(configData.ipcAllowlist) ? configData.ipcAllowlist : []
      };
      if (!this.config.ipcAllowlist || this.config.ipcAllowlist.length === 0) {
        throw new Error("config.json 缺少必填字段 ipcAllowlist 或为空");
      }
      return this.config;
    } catch (e) {
      throw new Error(`读取配置文件失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  getKey() {
    return this.getConfig().key;
  }
  getIpcAllowlist() {
    return this.getConfig().ipcAllowlist;
  }
}
const configManager = new ConfigManager();
const dynamicAllowlist = /* @__PURE__ */ new Set();
function setupIpcHandlers() {
  console.log("[ipcHandlers] Setting up IPC handlers");
  const allowlist = configManager.getIpcAllowlist();
  allowlist.forEach((c) => dynamicAllowlist.add(c));
  console.log("[ipcHandlers] IPC allowlist initialized:", Array.from(dynamicAllowlist));
  electron.ipcMain.handle("get-ipc-allowlist", async () => {
    return Array.from(dynamicAllowlist);
  });
  electron.ipcMain.handle("select-file", async () => {
    console.log("[ipcHandlers] select-file called");
    const result = await electron.dialog.showOpenDialog({ properties: ["openFile"] });
    if (!result.canceled && result.filePaths.length > 0) {
      console.log("[ipcHandlers] select-file result:", result.filePaths[0]);
      return result.filePaths[0];
    }
    return "";
  });
  electron.ipcMain.handle("select-folder", async () => {
    console.log("[ipcHandlers] select-folder called");
    const result = await electron.dialog.showOpenDialog({ properties: ["openDirectory"] });
    if (!result.canceled && result.filePaths.length > 0) {
      console.log("[ipcHandlers] select-folder result:", result.filePaths[0]);
      return result.filePaths[0];
    }
    return "";
  });
  electron.ipcMain.handle("get-plugin-dirs", async () => {
    console.log("[ipcHandlers] get-plugin-dirs called");
    const result = pathManager.getAvailablePlugins();
    console.log("[ipcHandlers] get-plugin-dirs result:", result);
    return result;
  });
  electron.ipcMain.handle("start-plugin-process", async (event, pluginName) => {
    console.log("[ipcHandlers] start-plugin-process called with pluginName:", pluginName);
    try {
      const manifest = await pluginManager.getManifest(pluginName);
      console.log("[ipcHandlers] start-plugin-process success, manifest:", manifest);
      return { success: true, manifest };
    } catch (error2) {
      console.error("[ipcHandlers] start-plugin-process error:", error2);
      return { success: false, error: error2 instanceof Error ? error2.message : "Unknown error" };
    }
  });
  electron.ipcMain.handle("trigger-event", async (event, pluginName, eventType, params = {}) => {
    console.log("[ipcHandlers] trigger-event called with:", { pluginName, eventType, params });
    try {
      const result = await pluginManager.triggerEvent(pluginName, eventType, params);
      console.log("[ipcHandlers] trigger-event success, result:", result);
      return result;
    } catch (error2) {
      console.error("[ipcHandlers] trigger-event error:", error2);
      return { success: false, error: error2 instanceof Error ? error2.message : "Unknown error" };
    }
  });
  electron.ipcMain.handle("get-plugin-resource-path", async (event, pluginName) => {
    console.log("[ipcHandlers] get-plugin-resource-path called with pluginName:", pluginName);
    const resourcePath = pathManager.getPluginResourcePath(pluginName);
    console.log("[ipcHandlers] get-plugin-resource-path success, resourcePath:", resourcePath);
    return resourcePath;
  });
  electron.ipcMain.handle("get-plugin-http-url", async (event, pluginName, subPath = "dist/index.html") => {
    console.log("[ipcHandlers] get-plugin-http-url called with:", { pluginName, subPath });
    const actualPluginName = pluginManager.getActualPluginName(pluginName);
    console.log("[ipcHandlers] get-plugin-http-url actualPluginName:", actualPluginName);
    const base = staticServer.getBaseUrl();
    const url2 = `${base}/${actualPluginName}/${subPath}`;
    console.log("[ipcHandlers] get-plugin-http-url result:", url2);
    return url2;
  });
  electron.ipcMain.handle("check-file-exists", async (event, filePath) => {
    console.log("[ipcHandlers] check-file-exists called with filePath:", filePath);
    try {
      const localPath = filePath.replace(/^file:\/\//, "");
      const exists = fs$8.existsSync(localPath);
      console.log("[ipcHandlers] check-file-exists result:", exists);
      return exists;
    } catch (error2) {
      console.error("[ipcHandlers] check-file-exists error:", error2);
      return false;
    }
  });
  electron.ipcMain.handle("download-images-as-zip", async (event, images) => {
    console.log("[ipcHandlers] download-images-as-zip called with images count:", images.length);
    console.log("[ipcHandlers] download-images-as-zip images data:", images);
    try {
      const result = await electron.dialog.showSaveDialog({
        title: "保存ZIP文件",
        defaultPath: `淘宝好评图片_${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.zip`,
        filters: [
          { name: "ZIP文件", extensions: ["zip"] }
        ]
      });
      if (result.canceled || !result.filePath) {
        console.log("[ipcHandlers] download-images-as-zip canceled by user");
        return { success: false, error: "用户取消了保存" };
      }
      const zipPath = result.filePath;
      console.log("[ipcHandlers] download-images-as-zip saving to:", zipPath);
      const output = fs$8.createWriteStream(zipPath);
      const archive = archiver$1("zip", {
        zlib: { level: 9 }
        // 设置压缩级别
      });
      const zipPromise = new Promise((resolve2, reject2) => {
        output.on("close", () => {
          console.log("[ipcHandlers] download-images-as-zip completed, total bytes:", archive.pointer());
          resolve2({ success: true, filePath: zipPath });
        });
        archive.on("error", (err) => {
          console.error("[ipcHandlers] download-images-as-zip archive error:", err);
          reject2(err);
        });
      });
      archive.pipe(output);
      let processed = 0;
      const total = images.length;
      for (let i = 0; i < images.length; i++) {
        const image = images[i];
        try {
          console.log("[ipcHandlers] download-images-as-zip processing image:", image.url);
          console.log("[ipcHandlers] download-images-as-zip image data:", image);
          const imageBuffer = await downloadImage(image.url);
          const platform2 = (image.platform || "").toString().trim() || "未知平台";
          const rawTitle = (image.productTitle || "").toString().trim() || "未命名商品";
          const sanitizedTitle = rawTitle.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").slice(0, 40).trim();
          const seq2 = String(i + 1).padStart(Math.max(2, String(images.length).length), "0");
          const fileName = `${platform2}-${sanitizedTitle}-${seq2}.jpg`;
          archive.append(imageBuffer, { name: fileName });
          processed++;
          console.log("[ipcHandlers] download-images-as-zip progress:", processed, "/", total, "filename:", fileName);
        } catch (error2) {
          console.error("[ipcHandlers] download-images-as-zip image download error:", error2);
          processed++;
        }
      }
      await archive.finalize();
      const zipResult = await zipPromise;
      console.log("[ipcHandlers] download-images-as-zip success:", zipResult);
      return zipResult;
    } catch (error2) {
      console.error("[ipcHandlers] download-images-as-zip error:", error2);
      return { success: false, error: error2 instanceof Error ? error2.message : "未知错误" };
    }
  });
}
async function downloadImage(url2) {
  return new Promise((resolve2, reject2) => {
    const protocol = url2.startsWith("https:") ? https : http;
    const request = protocol.get(url2, (response) => {
      if (response.statusCode !== 200) {
        reject2(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }
      const chunks = [];
      response.on("data", (chunk) => {
        chunks.push(chunk);
      });
      response.on("end", () => {
        const buffer = Buffer.concat(chunks);
        resolve2(buffer);
      });
    });
    request.on("error", (error2) => {
      reject2(error2);
    });
    request.setTimeout(3e4, () => {
      request.destroy();
      reject2(new Error("下载超时"));
    });
  });
}
class WindowManager {
  constructor() {
    __publicField(this, "mainWindow", null);
  }
  createMainWindow() {
    this.mainWindow = new electron.BrowserWindow({
      width: 1200,
      height: 800,
      show: false,
      webPreferences: {
        preload: path$6.join(__dirname, "preload.js"),
        contextIsolation: true,
        nodeIntegration: false
      }
    });
    if (process.env.NODE_ENV === "development") {
      this.mainWindow.webContents.openDevTools();
    }
    this.mainWindow.once("ready-to-show", () => {
      var _a;
      (_a = this.mainWindow) == null ? void 0 : _a.show();
    });
    this.mainWindow.on("closed", () => {
      this.mainWindow = null;
    });
    return this.mainWindow;
  }
  loadContent() {
    if (!this.mainWindow) return;
    const indexPath = path$6.join(__dirname, "../dist/index.html");
    if (fs$8.existsSync(indexPath)) {
      this.mainWindow.loadFile(indexPath);
    } else {
      const rootIndexPath = path$6.join(__dirname, "../index.html");
      if (fs$8.existsSync(rootIndexPath)) {
        this.mainWindow.loadFile(rootIndexPath);
      } else {
        this.mainWindow.loadURL("data:text/html,<h1>找不到index.html文件</h1>");
      }
    }
  }
  getMainWindow() {
    return this.mainWindow;
  }
  closeMainWindow() {
    if (this.mainWindow) {
      this.mainWindow.close();
      this.mainWindow = null;
    }
  }
}
const windowManager = new WindowManager();
class InvalidRegistryKeyError extends Error {
  constructor(message) {
    super(message);
    this.name = "InvalidRegistryKeyError";
  }
}
class TrackerUtil {
  constructor() {
    __publicField(this, "config");
    __publicField(this, "key", null);
    __publicField(this, "openId", null);
    __publicField(this, "clientType");
    __publicField(this, "clientId");
    this.config = this.loadConfig();
    this.clientType = this.config.tracker.clientType || "VideoConverter";
    this.clientId = this.config.tracker.clientId || 2;
  }
  // 加载配置文件
  loadConfig() {
    try {
      const configPath = path__namespace.join(process.cwd(), "config.json");
      const configData = fs__namespace.readFileSync(configPath, "utf8");
      return JSON.parse(configData);
    } catch (error2) {
      console.error("Failed to load config.json:", error2);
      return {
        key: "your-actual-key-here",
        title: "优创客户端体验版",
        version: "0.3.0",
        description: "插件化客户端应用",
        tracker: {
          enabled: true,
          baseUrl: "https://scriptv2.qfei.cn",
          clientType: "VideoConverter",
          clientId: 2
        }
      };
    }
  }
  // 检查Tracker是否启用
  isEnabled() {
    return this.config.tracker.enabled;
  }
  // 获取配置的key
  getKey() {
    return this.config.key;
  }
  // 发送 POST 请求的通用方法
  async sendRequest(path2, data) {
    const url2 = new URL(this.config.tracker.baseUrl);
    const options = {
      hostname: url2.hostname,
      path: `/api${path2}`,
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      }
    };
    if (this.openId) {
      options.headers["Cookie"] = `open_id=${this.openId}`;
    }
    return new Promise((resolve2, reject2) => {
      const https2 = require("https");
      const req = https2.request(options, (res) => {
        let responseData = "";
        res.on("data", (chunk) => {
          responseData += chunk;
        });
        res.on("end", () => {
          if (res.statusCode >= 400) {
            console.log("服务器响应内容:", responseData);
            reject2(new Error(`HTTP Error: ${res.statusCode}`));
            return;
          }
          try {
            const parsedData = JSON.parse(responseData);
            resolve2(parsedData);
          } catch (error2) {
            console.log("响应内容:", responseData);
            reject2(error2);
          }
        });
      });
      req.on("error", (error2) => {
        reject2(error2);
      });
      req.write(JSON.stringify(data));
      req.end();
    });
  }
  async login(key) {
    this.key = key || this.config.key;
    if (!this.isEnabled()) {
      console.log("Tracker is disabled in config");
      return { success: false, message: "Tracker is disabled" };
    }
    try {
      console.log("Tracker login attempt to:", this.config.tracker.baseUrl);
      const data = {
        key: this.key,
        client_id: this.clientId
      };
      const response = await this.sendRequest("/client/login", data);
      if (response.code === 0 && response.data) {
        this.openId = response.data;
        console.log("Tracker login success:", response);
        return response;
      } else if (response.code === 10001) {
        throw new InvalidRegistryKeyError(response.message);
      } else {
        throw new Error(response.message || "登录失败");
      }
    } catch (error2) {
      console.error("Tracker login failed:", error2);
      throw error2;
    }
  }
  // 事件追踪 - 与原始版本兼容
  async trackEvent({
    event_type,
    event_name,
    event_time = 0,
    page_name = "",
    customized_id = "",
    customized_type = ""
  }) {
    if (!this.isEnabled()) {
      console.log("Tracker is disabled, skipping event:", event_name);
      return { success: false, message: "Tracker is disabled" };
    }
    if (!this.openId) {
      throw new Error("请先登录系统");
    }
    const data = {
      uuid: crypto.randomUUID(),
      os: `${os__namespace.platform()} ${os__namespace.release()}`,
      client_type: this.clientType,
      customized_id,
      customized_type,
      event_type,
      event_time,
      event_name,
      page_name,
      client_time: Date.now()
      // 毫秒级时间戳
    };
    try {
      console.log(`Tracker trackEvent: ${event_name}`, data);
      const result = await this.sendRequest("/client/event_tracking", data);
      console.log("Tracker trackEvent success:", result);
      return result;
    } catch (error2) {
      console.error("Tracker trackEvent failed:", error2);
      throw error2;
    }
  }
  // 兼容旧版本的report方法
  async report(event, data = {}) {
    if (!this.isEnabled()) {
      console.log("Tracker is disabled, skipping report:", event);
      return;
    }
    if (!this.openId) {
      console.warn("Tracker report skipped - not logged in");
      return;
    }
    try {
      await this.trackEvent({
        event_type: "user_action",
        event_name: event,
        event_time: Date.now(),
        page_name: "main",
        customized_id: data.customized_id || "",
        customized_type: data.customized_type || ""
      });
    } catch (error2) {
      console.error("Tracker report failed:", error2);
    }
  }
  // 获取当前配置信息
  getConfig() {
    return {
      baseUrl: this.config.tracker.baseUrl,
      hasKey: !!this.key,
      hasOpenId: !!this.openId,
      enabled: this.isEnabled(),
      clientType: this.clientType,
      clientId: this.clientId
    };
  }
  // 获取openId
  getOpenId() {
    return this.openId;
  }
  // 检查是否已登录
  isLoggedIn() {
    return !!this.openId;
  }
  // 重新加载配置
  reloadConfig() {
    this.config = this.loadConfig();
    this.clientType = this.config.tracker.clientType || "VideoConverter";
    this.clientId = this.config.tracker.clientId || 2;
    console.log("Tracker config reloaded");
  }
}
class Logger {
  constructor() {
    __publicField(this, "logFile");
    __publicField(this, "isInitialized", false);
    const userDataPath = electron.app.getPath("userData");
    this.logFile = path$6.join(userDataPath, "app-debug.log");
    this.initialize();
  }
  initialize() {
    try {
      const logDir = path$6.dirname(this.logFile);
      if (!fs$8.existsSync(logDir)) {
        fs$8.mkdirSync(logDir, { recursive: true });
      }
      fs$8.writeFileSync(this.logFile, "");
      this.isInitialized = true;
      this.log("Logger initialized", { logFile: this.logFile });
    } catch (error2) {
      console.error("Failed to initialize logger:", error2);
    }
  }
  formatMessage(level, message, data) {
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    const dataStr = data ? ` | Data: ${JSON.stringify(data)}` : "";
    return `[${timestamp}] [${level}] ${message}${dataStr}
`;
  }
  writeToFile(message) {
    if (!this.isInitialized) return;
    try {
      fs$8.appendFileSync(this.logFile, message);
    } catch (error2) {
      console.error("Failed to write to log file:", error2);
    }
  }
  log(message, data) {
    const formattedMessage = this.formatMessage("INFO", message, data);
    console.log(message, data || "");
    this.writeToFile(formattedMessage);
  }
  error(message, data) {
    const formattedMessage = this.formatMessage("ERROR", message, data);
    console.error(message, data || "");
    this.writeToFile(formattedMessage);
  }
  warn(message, data) {
    const formattedMessage = this.formatMessage("WARN", message, data);
    console.warn(message, data || "");
    this.writeToFile(formattedMessage);
  }
  debug(message, data) {
    const formattedMessage = this.formatMessage("DEBUG", message, data);
    console.log(`[DEBUG] ${message}`, data || "");
    this.writeToFile(formattedMessage);
  }
  getLogFilePath() {
    return this.logFile;
  }
}
const logger = new Logger();
let tracker = null;
logger.log("=== 应用启动开始 ===");
logger.log("CWD:", process.cwd());
logger.log("NODE_ENV:", process.env.NODE_ENV);
logger.log("isPackaged:", electron.app.isPackaged);
logger.log("app.getAppPath():", electron.app.getAppPath());
logger.log("app.getPath(userData):", electron.app.getPath("userData"));
logger.log("process.resourcesPath:", process.resourcesPath);
logger.log("__dirname:", __dirname);
async function startApp() {
  var _a;
  logger.log("[startApp] 开始启动应用");
  try {
    logger.log("[startApp] 等待应用准备就绪...");
    await electron.app.whenReady();
    logger.log("[startApp] 应用已准备就绪");
    logger.log("[startApp] 启动插件静态服务器...");
    staticServer.start();
    logger.log("[startApp] 插件静态服务器已启动");
    logger.log("[startApp] 读取配置文件...");
    const config = configManager.getConfig();
    logger.log("[startApp] 配置文件内容:", config);
    if ((_a = config.tracker) == null ? void 0 : _a.enabled) {
      logger.log("[startApp] 初始化 Tracker...");
      tracker = new TrackerUtil();
      global.tracker = tracker;
      try {
        logger.log("[startApp] Tracker 配置:", tracker.getConfig());
        const loginResult = await tracker.login();
        logger.log("[startApp] Tracker 登录成功:", loginResult);
      } catch (e) {
        logger.warn("[startApp] Tracker 登录失败:", e);
      }
    } else {
      logger.warn("[startApp] Tracker 未启用，跳过 Tracker 登录");
    }
    logger.log("[startApp] 设置 IPC 处理器...");
    setupIpcHandlers();
    logger.log("[startApp] IPC 处理器已设置");
    logger.log("[startApp] 创建主窗口...");
    windowManager.createMainWindow();
    logger.log("[startApp] 主窗口已创建");
    logger.log("[startApp] 加载窗口内容...");
    windowManager.loadContent();
    logger.log("[startApp] 窗口内容加载完成");
    logger.log("[startApp] 应用启动完成");
  } catch (error2) {
    logger.error("[startApp] 应用启动失败:", error2);
    throw error2;
  }
}
electron.app.on("window-all-closed", () => {
  logger.log("[app] window-all-closed 事件触发");
  if (process.platform !== "darwin") {
    logger.log("[app] 退出应用");
    electron.app.quit();
  }
});
electron.app.on("activate", () => {
  logger.log("[app] activate 事件触发");
  if (windowManager.getMainWindow() === null) {
    logger.log("[app] 重新创建窗口");
    windowManager.createMainWindow();
    windowManager.loadContent();
  }
});
electron.app.on("before-quit", () => {
  logger.log("[app] before-quit 事件触发");
  pluginManager.cleanup();
  logger.log("[app] 插件管理器已清理");
});
process.on("uncaughtException", (error2) => {
  logger.error("[process] 未捕获的异常:", error2);
});
process.on("unhandledRejection", (reason, promise) => {
  logger.error("[process] 未处理的 Promise 拒绝:", { reason, promise });
});
electron.ipcMain.handle("get-plugins-status", async () => {
  logger.log("[ipc] get-plugins-status 被调用");
  try {
    const result = pluginManager.getAvailablePlugins();
    logger.log("[ipc] get-plugins-status 返回结果:", result);
    return result;
  } catch (error2) {
    logger.error("[ipc] get-plugins-status 出错:", error2);
    throw error2;
  }
});
logger.log("开始启动应用...");
startApp().catch((error2) => {
  logger.error("应用启动失败:", error2);
  electron.app.quit();
});

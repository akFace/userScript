// ==UserScript==
// @name         Universal Video Sniffer
// @name:zh-CN   通用视频嗅探器
// @namespace    http://tampermonkey.net/
// @version      22.3
// @description  Sniff video (m3u8/mp4), optimized for mobile memory usage.
// @description:zh-CN  专为手机浏览器优化：内存占用减半、支持M3U8自动解密、MP4原生下载模式。支持中英双语界面。
// @author       jw23 (Optimized)
// @license      MIT
// @match        *://*/*
// @connect      *
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        unsafeWindow
// @require      https://cdn.jsdelivr.net/npm/mux.js@6.3.0/dist/mux.min.js
// @run-at       document-start
// @downloadURL https://update.greasyfork.org/scripts/557721/Universal%20Video%20Sniffer.user.js
// @updateURL https://update.greasyfork.org/scripts/557721/Universal%20Video%20Sniffer.meta.js
// ==/UserScript==

(function () {
  "use strict";

  // ==========================================
  // 0. 多语言配置 (Localization)
  // ==========================================
  const Lang = navigator.language.startsWith("zh") ? "zh" : "en";
  const Locales = {
    zh: {
      title: "嗅探器",
      copy: "复制",
      copied: "已复制",
      download: "下载",
      downloading: "下载中...",
      saving: "保存中...",
      done: "完成",
      error: "错误",
      native_down: "已调原生",
      menu_set_start: "🔍 开始嗅探资源",
      menu_set_threads: "⚙️ 设置并发下载数",
      prompt_threads: "请输入并发下载线程数 (手机建议 2-4，过高会导致闪退):",
      alert_threads_saved: "设置成功，刷新页面生效。当前线程数: ",
      confirm_mobile_mp4:
        "检测到 MP4 单文件。\n是否调用浏览器自带下载器？\n(省流量、不闪退、速度快)",
      alert_0_size: "下载失败：文件大小为 0B。",
      alert_mp4_fallback: "MP4 转码失败，回退到原始 TS",
      alert_fail_general:
        "下载失败：数据量过小或内存优化导致无法回退到 TS 格式。",
      progress_parsing: "解析中...",
      progress_key: "获取密钥...",
      video_found_tips: "未检测到视频资源，请刷新页面后再尝试。",
    },
    en: {
      title: "Sniffer",
      copy: "Copy",
      copied: "Copied",
      download: "Download",
      downloading: "D/Ling...",
      saving: "Saving...",
      done: "Done",
      error: "Error",
      native_down: "Native DL",
      menu_set_start: "🔍 Start Sniffing",
      menu_set_threads: "⚙️ Set Concurrent Threads",
      prompt_threads: "Enter max threads (Mobile: 2-4 recommended):",
      alert_threads_saved: "Saved. Refresh to apply. Current threads: ",
      confirm_mobile_mp4:
        "MP4 detected.\nUse browser native downloader?\n(Saves memory, faster)",
      alert_0_size: "Download failed: File size is 0B.",
      alert_mp4_fallback: "MP4 mux failed, fallback to raw TS.",
      alert_fail_general:
        "Download failed: Data too small or memory optimization prevented fallback.",
      progress_parsing: "Parsing...",
      progress_key: "GetKey...",
      video_found_tips: "No video found. Please refresh and try again.",
    },
  };
  const T = Locales[Lang];
  let MySniffer = null;
  let MyUI = null;

  // ==========================================
  // 1. 全局配置 (Configuration)
  // ==========================================
  const Config = {
    scanInterval: 2000,
    uiId: "gm-sniffer-v22-opt",

    // 移动端检测
    isMobile:
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      ),

    // [优化] 手机端默认线程改为 2，PC端保持 4
    get maxThreads() {
      const defaultThreads = this.isMobile ? 2 : 4;
      return GM_getValue("max_threads", defaultThreads);
    },

    maxRetries: 3,
    retryDelay: 1000,

    colors: {
      primary: window.self === window.top ? "#4caf50" : "#e91e63",
      background: "rgba(0, 0, 0, 0.9)",
      text: "#ffffff",
    },
  };

  GM_registerMenuCommand(`${T.menu_set_start}`, () => {
    setTimeout(() => {
      MyUI?.root?.classList.add("d-js-show");
    }, 2000);
  });
  GM_registerMenuCommand(`${T.menu_set_threads} (${Config.maxThreads})`, () => {
    const input = prompt(T.prompt_threads, Config.maxThreads);
    const val = parseInt(input);
    if (val && val > 0 && val <= 32) {
      GM_setValue("max_threads", val);
      alert(`${T.alert_threads_saved} ${val}`);
    }
  });

  // ==========================================
  // 2. 工具函数库 (Utilities)
  // ==========================================
  const Utils = {
    request: (url, isBinary = false) => {
      return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: "GET",
          url: url,
          responseType: isBinary ? "arraybuffer" : "text",
          headers: { Referer: location.href, Origin: location.origin },
          timeout: 60000,
          onload: (res) => {
            if (res.status >= 200 && res.status < 300) resolve(res.response);
            else reject(new Error(`HTTP Error ${res.status}`));
          },
          onerror: (err) => reject(err),
          ontimeout: () => reject(new Error("Timeout")),
        });
      });
    },

    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),

    createElement: (tag, attrs = {}, children = []) => {
      const element = document.createElement(tag);
      for (const [key, value] of Object.entries(attrs)) {
        if (key === "style" && typeof value === "object")
          Object.assign(element.style, value);
        else if (key.startsWith("on") && typeof value === "function")
          element.addEventListener(key.substring(2).toLowerCase(), value);
        else element.setAttribute(key, value);
      }
      const childList = Array.isArray(children) ? children : [children];
      childList.forEach((child) => {
        if (child instanceof Node) element.appendChild(child);
        else if (child !== null && child !== undefined)
          element.appendChild(document.createTextNode(String(child)));
      });
      return element;
    },

    downloadBlob: (blob, filename) => {
      if (blob.size === 0) {
        alert(T.alert_0_size);
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();

      setTimeout(() => {
        a.remove();
        URL.revokeObjectURL(url);
      }, 30000);
    },

    getFilename: (url) => {
      const cleanUrl = url.split("?")[0];
      let name = cleanUrl.split("/").pop();
      if (!name || name.trim() === "" || name === "/")
        name = `video_${Date.now()}.mp4`;
      return decodeURIComponent(name);
    },

    resolveUrl: (baseUrl, relativeUrl) => {
      if (relativeUrl.startsWith("http")) return relativeUrl;
      if (relativeUrl.startsWith("/")) {
        const u = new URL(baseUrl);
        return u.origin + relativeUrl;
      }
      const path = baseUrl.substring(0, baseUrl.lastIndexOf("/") + 1);
      return path + relativeUrl;
    },
  };

  // ==========================================
  // 3. 加密解密模块 (Crypto)
  // ==========================================
  const AESCrypto = {
    hexToBytes: (hex) => {
      if (!hex) return null;
      const cleanHex = hex.replace(/^0x/i, "");
      const bytes = new Uint8Array(cleanHex.length / 2);
      for (let i = 0; i < cleanHex.length; i += 2) {
        bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
      }
      return bytes;
    },
    sequenceToIV: (sequenceNumber) => {
      const buffer = new ArrayBuffer(16);
      const view = new DataView(buffer);
      view.setUint32(12, sequenceNumber, false);
      return new Uint8Array(buffer);
    },
    decrypt: async (data, key, iv) => {
      try {
        const algorithm = { name: "AES-CBC", iv: iv };
        const cryptoKey = await window.crypto.subtle.importKey(
          "raw",
          key,
          algorithm,
          false,
          ["decrypt"]
        );
        return new Uint8Array(
          await window.crypto.subtle.decrypt(algorithm, cryptoKey, data)
        );
      } catch (error) {
        console.error("[Crypto] Decrypt Error:", error);
        return null;
      }
    },
  };

  // ==========================================
  // 4. 事件总线
  // ==========================================
  const Bus = {
    events: {},
    on(event, callback) {
      if (!this.events[event]) this.events[event] = [];
      this.events[event].push(callback);
    },
    emit(event, data) {
      if (this.events[event]) this.events[event].forEach((cb) => cb(data));
    },
  };

  // ==========================================
  // 5. 网络嗅探器
  // ==========================================
  class Sniffer {
    constructor() {
      this.seenUrls = new Set();
      this.rules = {
        m3u8: /\.m3u8($|\?)|application\/.*mpegurl/i,
        mp4: /\.mp4($|\?)|video\/mp4/i,
        mov: /\.mov($|\?)|video\/quicktime/i,
      };
    }

    start() {
      this.hookFetch();
      this.hookXHR();
      setInterval(() => this.scanPerformance(), Config.scanInterval);
    }

    detect(url, contentType = "") {
      if (!url) return;
      if (
        url.match(/^data:|^blob:|\.(png|jpg|jpeg|gif|css|js|woff|svg)($|\?)/i)
      )
        return;

      const cleanKey = url.split("?")[0];
      if (this.seenUrls.has(cleanKey)) return;

      const typeStr = contentType ? contentType.toLowerCase() : "";

      for (const [type, regex] of Object.entries(this.rules)) {
        if (regex.test(url) || regex.test(typeStr)) {
          this.seenUrls.add(cleanKey);
          console.log(`[Sniffer] Found ${type}: ${url}`);
          Bus.emit("video-found", { url, type });
          return;
        }
      }
    }

    hookFetch() {
      const originalFetch = unsafeWindow.fetch;
      unsafeWindow.fetch = async (...args) => {
        const url = args[0] instanceof Request ? args[0].url : args[0];
        const response = await originalFetch.apply(unsafeWindow, args);
        try {
          const clone = response.clone();
          clone.headers.forEach((val, key) => {
            if (key.toLowerCase() === "content-type") this.detect(url, val);
          });
        } catch (e) {}
        return response;
      };
    }

    hookXHR() {
      const originalXHR = unsafeWindow.XMLHttpRequest;
      const self = this;
      class HijackedXHR extends originalXHR {
        open(method, url, ...args) {
          this._requestUrl = url;
          super.open(method, url, ...args);
        }
        send(...args) {
          this.addEventListener("readystatechange", () => {
            if (this.readyState === 4) {
              try {
                const contentType = this.getResponseHeader("content-type");
                self.detect(this.responseURL || this._requestUrl, contentType);
              } catch (e) {}
            }
          });
          super.send(...args);
        }
      }
      unsafeWindow.XMLHttpRequest = HijackedXHR;
    }

    scanPerformance() {
      if (!window.performance) return;
      performance
        .getEntriesByType("resource")
        .forEach((entry) => this.detect(entry.name));
    }
  }

  // ==========================================
  // 6. 下载管理器
  // ==========================================
  class VideoWriter {
    constructor() {
      this.mode = "memory";
      this.fileHandle = null;
      this.writable = null;

      this.chunks = [];
      this.rawChunks = [];
      this.totalSize = 0;
    }

    async init(filename) {
      if (Config.isMobile) {
        this.mode = "memory";
        return;
      }
      if (window.showSaveFilePicker) {
        try {
          this.fileHandle = await window.showSaveFilePicker({
            suggestedName: filename,
          });
          this.writable = await this.fileHandle.createWritable();
          this.mode = "stream";
          return;
        } catch (error) {
          console.warn("[Writer] Stream cancelled, use memory");
        }
      }
      this.mode = "memory";
    }

    async write(data, rawData) {
      if (this.mode === "stream") {
        if (data && data.length > 0) {
          await this.writable.write(data);
          this.totalSize += data.length;
        }
      } else {
        if (data && data.length > 0) {
          this.chunks.push(data);
          this.totalSize += data.length;
        }
        if (!Config.isMobile && rawData) {
          this.rawChunks.push(rawData);
        }
      }
    }

    async close(filename) {
      if (this.mode === "stream") {
        await this.writable.close();
      } else {
        let finalBlob = null;

        if (this.totalSize > 1024) {
          finalBlob = new Blob(this.chunks, { type: "video/mp4" });
        } else if (this.rawChunks && this.rawChunks.length > 0) {
          console.warn(T.alert_mp4_fallback);
          finalBlob = new Blob(this.rawChunks, { type: "video/mp2t" });
          if (!filename.endsWith(".ts"))
            filename = filename.replace(/\.mp4$/i, ".ts");
        } else {
          alert(T.alert_fail_general);
          this.chunks = null;
          return;
        }

        Utils.downloadBlob(finalBlob, filename);
        this.chunks = null;
        this.rawChunks = null;
        finalBlob = null;
      }
    }
  }

  const downloadM3u8 = async (url, onProgress, writer) => {
    onProgress(0, T.progress_parsing);
    let content = await Utils.request(url);

    if (content.includes("#EXT-X-STREAM-INF")) {
      const lines = content.split("\n");
      let bestBandwidth = 0;
      let bestUrl = null;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith("#EXT-X-STREAM-INF")) {
          const bandwidth = parseInt(
            (lines[i].match(/BANDWIDTH=(\d+)/) || [0, 0])[1]
          );
          const nextLine = lines[i + 1]?.trim();
          if (
            nextLine &&
            !nextLine.startsWith("#") &&
            bandwidth > bestBandwidth
          ) {
            bestBandwidth = bandwidth;
            bestUrl = Utils.resolveUrl(url, nextLine);
          }
        }
      }
      if (bestUrl) {
        url = bestUrl;
        content = await Utils.request(url);
      }
    }

    const lines = content.split("\n");
    const segments = [];
    let currentKey = null,
      currentIV = null,
      sequence = 0;

    for (const line of lines) {
      const l = line.trim();
      if (!l) continue;
      if (l.startsWith("#EXT-X-KEY")) {
        const method = (l.match(/METHOD=([^,]+)/) || [])[1];
        const uri = (l.match(/URI="([^"]+)"/) || [])[1];
        const ivHex = (l.match(/IV=(0x[\da-f]+)/i) || [])[1];
        if (method === "AES-128" && uri) {
          currentKey = Utils.resolveUrl(url, uri);
          currentIV = ivHex ? AESCrypto.hexToBytes(ivHex) : null;
        }
      } else if (l.startsWith("#EXT-X-MEDIA-SEQUENCE")) {
        sequence = parseInt(l.split(":")[1]);
      } else if (!l.startsWith("#")) {
        segments.push({
          url: Utils.resolveUrl(url, l),
          key: currentKey,
          iv: currentIV,
          seq: sequence++,
        });
      }
    }

    if (segments.length === 0) throw new Error("No segments found");

    const keyCache = new Map();
    const uniqueKeys = [
      ...new Set(segments.filter((s) => s.key).map((s) => s.key)),
    ];
    if (uniqueKeys.length > 0) {
      onProgress(0, T.progress_key);
      for (const keyUrl of uniqueKeys) {
        const keyData = await Utils.request(keyUrl, true);
        keyCache.set(keyUrl, new Uint8Array(keyData));
      }
    }

    const transmuxer = new muxjs.mp4.Transmuxer();
    let currentTransmuxedData = [];
    transmuxer.on("data", (segment) => {
      const data = new Uint8Array(
        segment.initSegment.byteLength + segment.data.byteLength
      );
      data.set(segment.initSegment, 0);
      data.set(segment.data, segment.initSegment.byteLength);
      currentTransmuxedData.push(data);
    });

    let nextIndex = 0;
    let completedCount = 0;
    let writeIndex = 0;
    const downloadBuffer = new Map();

    const worker = async () => {
      while (nextIndex < segments.length) {
        const index = nextIndex++;
        const segment = segments[index];
        let rawData = null;
        let retries = Config.maxRetries;

        while (!rawData && retries >= 0) {
          try {
            let data = await Utils.request(segment.url, true);
            if (segment.key) {
              const key = keyCache.get(segment.key);
              const iv = segment.iv || AESCrypto.sequenceToIV(segment.seq);
              data = (await AESCrypto.decrypt(data, key, iv)).buffer;
            }
            rawData = data;
          } catch (e) {
            retries--;
            await Utils.sleep(Config.retryDelay);
          }
        }

        downloadBuffer.set(
          index,
          rawData ? new Uint8Array(rawData) : new Uint8Array(0)
        );

        while (downloadBuffer.has(writeIndex)) {
          const chunk = downloadBuffer.get(writeIndex);
          downloadBuffer.delete(writeIndex);

          currentTransmuxedData = [];
          if (chunk.length > 0) {
            try {
              transmuxer.push(chunk);
              transmuxer.flush();
            } catch (e) {
              console.warn("Mux Error", e);
            }
          }

          if (currentTransmuxedData.length > 0) {
            for (const d of currentTransmuxedData) await writer.write(d, null);
          } else {
            await writer.write(null, chunk);
          }
          writeIndex++;
        }

        completedCount++;
        const percent = ((completedCount / segments.length) * 100).toFixed(0);
        onProgress(percent, `${percent}%`);
      }
    };

    const threads = Array(Math.min(Config.maxThreads, segments.length))
      .fill(null)
      .map(() => worker());
    await Promise.all(threads);
  };

  const downloadMp4 = async (url, onProgress, writer) => {
    // [优化] 针对 MP4 直链，优先尝试浏览器原生下载
    if (Config.isMobile) {
      try {
        if (confirm(`${Utils.getFilename(url)}\n${T.confirm_mobile_mp4}`)) {
          const a = document.createElement("a");
          a.href = url;
          a.download = Utils.getFilename(url);
          a.target = "_blank"; // 注意：这里会打开新标签页以触发下载
          document.body.appendChild(a);
          a.click();
          setTimeout(() => a.remove(), 1000);
          onProgress(100, T.native_down);
          return;
        }
      } catch (e) {}
    }

    onProgress(0, T.downloading);
    const data = await Utils.request(url, true);
    await writer.write(new Uint8Array(data), null);
    onProgress(100);
  };

  const TaskRunner = async (url, type, btn) => {
    const originalText = btn.textContent;
    let filename = Utils.getFilename(url);
    if (type === "m3u8" && !filename.endsWith(".mp4")) filename += ".mp4";

    const writer = new VideoWriter();

    try {
      await writer.init(filename);

      if (type === "m3u8") {
        await downloadM3u8(
          url,
          (pct, txt) => (btn.textContent = txt || pct + "%"),
          writer
        );
      } else {
        await downloadMp4(
          url,
          (pct, txt) => (btn.textContent = txt || pct + "%"),
          writer
        );
      }

      if (btn.textContent !== T.native_down) {
        btn.textContent = T.saving;
        await writer.close(filename);
        btn.textContent = T.done;
      }
    } catch (error) {
      console.error(error);
      btn.textContent = T.error;
      alert(`Error: ${error.message || error}`);
    } finally {
      setTimeout(() => (btn.textContent = originalText), 3000);
    }
  };

  // ==========================================
  // 7. UI 界面
  // ==========================================
  class UI {
    constructor() {
      this.root = null;
      this.list = null;
      Bus.on("video-found", (data) => this.addItem(data));
    }

    init() {
      if (document.getElementById(Config.uiId)) return;
      const host = Utils.createElement("div", {
        id: Config.uiId,
        style: { position: "fixed", top: "15%", right: "2%", zIndex: 999999 },
      });
      const shadow = host.attachShadow({ mode: "open" });

      const style = Utils.createElement("style");
      style.textContent = `
                :host { font-family: sans-serif; font-size: 12px; }
                .box {
                    width: 220px; background: ${Config.colors.background}; color: ${Config.colors.text};
                    border: 1px solid ${Config.colors.primary}; border-radius: 6px;
                    backdrop-filter: blur(5px); display: flex; flex-direction: column;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.5);
                    display: none;
                }
                .head { padding: 8px; background: rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center; cursor: move; }
                .title { font-weight: bold; color: ${Config.colors.primary}; }
                .list { max-height: 200px; overflow-y: auto; }
                .item { padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.1); }
                .row { display: flex; gap: 5px; align-items: center; margin-bottom: 5px; }
                .tag { background: ${Config.colors.primary}; color: #000; padding: 1px 3px; border-radius: 3px; font-weight: bold; font-size: 10px; }
                .name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer; }
                .actions { display: flex; gap: 5px; }
                button { flex: 1; border: none; padding: 6px; border-radius: 3px; cursor: pointer; font-size: 12px; }
                .btn-copy { background: #555; color: white; }
                .btn-down { background: ${Config.colors.primary}; color: #000; font-weight: bold; }
                .box.min { width: 40px; height: 40px; border-radius: 50%; justify-content: center; align-items: center; overflow: hidden; }
                .box.min .list, .box.min .title { display: none; }
                .toggle { font-size: 16px; padding: 0 5px; cursor: pointer; }
                .box.d-js-show { display: flex; }
            `;

      const toggleBtn = Utils.createElement("span", { class: "toggle" }, "－");
      const titleEl = Utils.createElement(
        "span",
        { class: "title" },
        `${T.title} (${Config.maxThreads})`
      );
      const head = Utils.createElement("div", { class: "head" }, [
        titleEl,
        toggleBtn,
      ]);
      this.list = Utils.createElement("div", { class: "list" });
      this.root = Utils.createElement("div", { class: "box" }, [
        head,
        this.list,
      ]);

      shadow.appendChild(style);
      shadow.appendChild(this.root);
      (document.body || document.documentElement).appendChild(host);

      toggleBtn.onclick = (e) => {
        e.stopPropagation();
        this.root.classList.toggle("min");
        toggleBtn.textContent = this.root.classList.contains("min")
          ? "🎬"
          : "－";
      };

      // Drag support
      let isDrag = false,
        startX,
        startY,
        initRight,
        initTop;
      const onDown = (e) => {
        if (e.target === toggleBtn) return;
        isDrag = true;
        const touch = e.touches ? e.touches[0] : e;
        startX = touch.clientX;
        startY = touch.clientY;
        const rect = host.getBoundingClientRect();
        initRight = window.innerWidth - rect.right;
        initTop = rect.top;
      };
      const onMove = (e) => {
        if (!isDrag) return;
        if (e.preventDefault) e.preventDefault();
        const touch = e.touches ? e.touches[0] : e;
        host.style.right = initRight + (startX - touch.clientX) + "px";
        host.style.top = initTop + (touch.clientY - startY) + "px";
      };
      const onUp = () => (isDrag = false);

      head.addEventListener("touchstart", onDown);
      document.addEventListener("touchmove", onMove, { passive: false });
      document.addEventListener("touchend", onUp);
      head.addEventListener("mousedown", onDown);
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    }

    addItem({ url, type }) {
      this.init();
      if (
        this.root.classList.contains("min") &&
        this.list.children.length === 0
      ) {
        this.root.querySelector(".toggle").click();
      }

      const item = Utils.createElement("div", { class: "item" }, [
        Utils.createElement("div", { class: "row" }, [
          Utils.createElement("span", { class: "tag" }, type),
          Utils.createElement(
            "span",
            {
              class: "name",
              title: url,
              onclick: () => {
                navigator.clipboard.writeText(url);
                alert(T.copied);
              },
            },
            Utils.getFilename(url)
          ),
        ]),
        Utils.createElement("div", { class: "actions" }, [
          Utils.createElement(
            "button",
            {
              class: "btn-copy",
              onclick: (e) => {
                navigator.clipboard.writeText(url);
                e.target.textContent = T.copied;
                setTimeout(() => (e.target.textContent = T.copy), 1000);
              },
            },
            T.copy
          ),
          Utils.createElement(
            "button",
            {
              class: "btn-down",
              onclick: (e) => TaskRunner(url, type, e.target),
            },
            T.download
          ),
        ]),
      ]);

      if (this.list.firstChild)
        this.list.insertBefore(item, this.list.firstChild);
      else this.list.appendChild(item);
    }
  }
  MySniffer = new Sniffer();
  MySniffer.start();
  MyUI = new UI();
})();

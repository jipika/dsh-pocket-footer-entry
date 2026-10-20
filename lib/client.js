/**
 * dsh-pocket-footer-entry — client half.
 *
 * 侧边栏底部的「手机访问」快捷入口：点开一个弹窗，直接展示
 * dsh-pocket 的局域网 / 公网二维码与地址，并提供公网开关。
 *
 * 依赖 dsh-pocket 的 host 半边提供 RPC 通道 "/dsh-pocket"。
 */
window.__ModuleLoader__.load({
  id: "dsh-pocket-footer-entry",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    const React = require("react");
    const h = React.createElement;
    const { useCallback, useEffect, useState } = React;

    const SLOT = "sidebar.footer.action";
    const ENTRY_ID = "pocket-entry";
    const RPC_CHANNEL = "/dsh-pocket";
    const LOCALE_NS = "pocketFooterEntry";
    const STYLE_ID = "dsh-pocket-footer-entry-style";
    const POLL_MS = 2500;

    // ── 文案 ────────────────────────────────────────────────────────────────
    const zh = {
      "entry.label": "手机访问",
      "entry.title": "手机访问（dsh-pocket）",
      "dialog.title": "手机访问",
      "dialog.close": "关闭",
      "dialog.loading": "正在读取状态…",
      "lan.title": "局域网直连",
      "lan.hint": "手机和电脑连同一个 Wi-Fi，扫码即可打开，自定义界面完整保留。",
      "lan.missing": "局域网服务未就绪：DSH 的 web 服务没跑起来，或 dsh-pocket 未加载。",
      "lan.unreachable": "局域网地址可能是回环地址，手机连不上。可在插件设置页手动指定本机 IP。",
      "tunnel.title": "公网访问",
      "tunnel.hint": "不在同一网络时用公网地址扫码；关掉再开会换一个新地址。",
      "tunnel.off": "未开启",
      "tunnel.on": "已开启",
      "tunnel.start": "开启公网访问",
      "tunnel.stop": "关闭公网",
      "tunnel.retry": "重新开启",
      "tunnel.busy.start": "正在开启公网…",
      "tunnel.busy.stop": "正在关闭公网…",
      "disclaimer.title": "开启公网前请确认",
      "disclaimer.body":
        "开启公网 = 把本机 DSH（能执行代码）暴露到互联网。任何人拿到公网链接和密码，都能访问甚至操作你的电脑。请确认：① 使用自定义强密码或妥善保管自动密码；② 用完立即「关闭公网」；③ 公司/涉密网络请先确认合规。",
      "disclaimer.accept": "我已了解风险，开启",
      "disclaimer.cancel": "取消",
      "common.copy": "复制",
      "common.copied": "已复制",
      "common.copyFailed": "复制失败，请手动选中",
      "meta.ports": "DSH 端口",
      "meta.proxy": "代理端口",
      "meta.noPort": "未读到端口",
    };
    const en = {
      "entry.label": "Mobile access",
      "entry.title": "Mobile access (dsh-pocket)",
      "dialog.title": "Mobile access",
      "dialog.close": "Close",
      "dialog.loading": "Loading status…",
      "lan.title": "Local network",
      "lan.hint": "Same Wi-Fi: scan to open the full UI, custom panels included.",
      "lan.missing": "Local service unavailable: the DSH web server or dsh-pocket is not running.",
      "lan.unreachable": "The LAN address may be a loopback address the phone cannot reach — set an explicit LAN IP in the plugin settings.",
      "tunnel.title": "Public access",
      "tunnel.hint": "Use the public URL when not on the same network; each restart mints a new one.",
      "tunnel.off": "Off",
      "tunnel.on": "On",
      "tunnel.start": "Enable public access",
      "tunnel.stop": "Disable",
      "tunnel.retry": "Retry",
      "tunnel.busy.start": "Enabling public access…",
      "tunnel.busy.stop": "Disabling…",
      "disclaimer.title": "Confirm before enabling public access",
      "disclaimer.body":
        "Enabling public access exposes this machine's DSH (which can execute code) to the internet. Anyone with the link and password can access — and act on — your computer. Please confirm: (1) set a strong custom password or keep the generated one safe; (2) disable public access as soon as you are done; (3) check compliance before exposing a corporate or sensitive network.",
      "disclaimer.accept": "I understand, enable",
      "disclaimer.cancel": "Cancel",
      "common.copy": "Copy",
      "common.copied": "Copied",
      "common.copyFailed": "Copy failed — select manually",
      "meta.ports": "DSH port",
      "meta.proxy": "proxy port",
      "meta.noPort": "no port",
    };

    // ── 样式 ────────────────────────────────────────────────────────────────
    const CSS = `
.dspfe-entry {
  width: 100%;
  height: 42px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 10px 0 8px;
  font-size: 14px;
  line-height: 22px;
  font-family: inherit;
  border: none;
  background: transparent;
  color: var(--dsw-alias-label-primary, inherit);
  cursor: pointer;
  text-align: left;
}
.dspfe-entry:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, 0.12)); }
.dspfe-entry:focus-visible {
  outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, currentColor);
  outline-offset: 1px;
}
.dspfe-entry > svg { flex: none; }
.dspfe-icon { flex: none; display: inline-flex; align-items: center; justify-content: center; }
.dspfe-entry-label { flex: auto; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }

/* footer 入口行的排布 —— 2026-10-16 用 ego 连真实页面实测的 DOM：
 *   _footerActions 自身就是 flex 容器（官方默认 flex-direction:column）；
 *   它只有 1 个子元素 —— 一层无 class 的 wrapper，而那层 wrapper 是
 *   display: contents（不生成盒子），所以两个 entry button 实际就是
 *   _footerActions 的 flex 项，真正的布局容器是 _footerActions 自己。
 *   这一行当前没有别的 entry（qoder 配额卡不在其中）。
 * 原 @agents-anywhere/dsh-bridge-next 在装时注入过 flex+wrap+gap 并给 entry 标
 * pair/wide，它卸载后规则随之消失 → 两个入口塌成上下两行。这里把那件事接过来：
 * 容器回 row+wrap，默认每个入口独占一行（别人的观感不变），只让本插件与
 * dsh-context-footer-entry 的入口并排各占一半。
 * 注：若将来官方把那层 wrapper 换成会生成盒子的元素，下面这些 flex 会落在
 * wrapper 上而不生效 —— 那时需要再补一条给「> div」自身开 flex 的规则。
 * 类名一律后缀匹配（$=）：宿主 CSS module 的 hash 在前缀，后缀是稳定部分。 */
div[class$="_footArea"] div[class$="_footerActions"] {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}
div[class$="_footArea"] div[class$="_footerActions"] > div > * {
  flex: 0 0 100%;
  min-width: 0;
}
div[class$="_footArea"] div[class$="_footerActions"] > div > .dcfe-entry,
div[class$="_footArea"] div[class$="_footerActions"] > div > .dspfe-entry {
  flex: 1 1 max-content;
}

.dspfe-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.dspfe-mask { position: absolute; inset: 0; background: rgba(0, 0, 0, 0.42); }
.dspfe-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  width: min(470px, 100%);
  max-height: min(82vh, 780px);
  border-radius: 14px;
  background: var(--dsw-alias-bg-layer-1, #ffffff);
  color: var(--dsw-alias-label-primary, #111111);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.28), 0 0 0 1px var(--dsw-alias-border-l1, rgba(127, 127, 127, 0.2));
  overflow: hidden;
  font-size: 13px;
  line-height: 20px;
  font-family: inherit;
}
.dspfe-head { display: flex; align-items: center; gap: 8px; padding: 14px 14px 8px; }
.dspfe-title { flex: auto; font-size: 15px; font-weight: 600; }
.dspfe-close {
  width: 28px; height: 28px; border-radius: 8px; border: none; background: transparent;
  color: var(--dsw-alias-label-secondary, inherit); cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
}
.dspfe-close:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, 0.12)); }
.dspfe-body { padding: 0 14px 4px; overflow: auto; }
.dspfe-section { padding: 12px 0; border-top: 1px solid var(--dsw-alias-border-l1, rgba(127, 127, 127, 0.16)); }
.dspfe-section:first-child { border-top: none; padding-top: 4px; }
.dspfe-sec-head { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.dspfe-sec-title { flex: auto; font-weight: 600; }
.dspfe-badge {
  font-size: 11px; line-height: 18px; padding: 0 7px; border-radius: 999px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.3));
  color: var(--dsw-alias-label-secondary, inherit);
}
.dspfe-badge.on { color: var(--dsw-alias-state-business-primary, #1677ff); border-color: currentColor; }
.dspfe-badge.warn { color: var(--dsw-alias-state-warn-primary, #d48806); border-color: currentColor; }
.dspfe-qr-row { display: flex; gap: 12px; align-items: flex-start; }
.dspfe-qr {
  flex: none; width: 168px; height: 168px; padding: 6px; border-radius: 10px; background: #ffffff;
  box-shadow: 0 0 0 1px var(--dsw-alias-border-l1, rgba(127, 127, 127, 0.2));
}
.dspfe-qr img { display: block; width: 100%; height: 100%; object-fit: contain; }
.dspfe-qr-side { flex: auto; min-width: 0; display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
.dspfe-url {
  display: block; width: 100%;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px; line-height: 18px; word-break: break-all;
  padding: 8px; border-radius: 8px;
  background: var(--dsw-alias-bg-layer-2, rgba(127, 127, 127, 0.1));
  color: var(--dsw-alias-label-secondary, inherit);
}
.dspfe-hint { margin: 0; color: var(--dsw-alias-label-tertiary, inherit); font-size: 12px; line-height: 18px; }
.dspfe-btn {
  height: 30px; padding: 0 12px; border-radius: 8px; font-family: inherit; font-size: 13px; cursor: pointer;
  border: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.3));
  background: transparent; color: var(--dsw-alias-label-primary, inherit);
}
.dspfe-btn:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, 0.12)); }
.dspfe-btn.primary {
  background: var(--dsw-alias-button-primary-fill, #1677ff);
  color: var(--dsw-alias-label-primary-foreground, #ffffff);
  border-color: transparent;
}
.dspfe-btn.danger { color: var(--dsw-alias-state-error-primary, #cf1322); border-color: currentColor; }
.dspfe-btn.ghost { border-color: transparent; }
.dspfe-btn:disabled { opacity: 0.5; cursor: default; }
.dspfe-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
.dspfe-error {
  margin: 8px 0 0; padding: 8px 10px; border-radius: 8px;
  background: rgba(207, 19, 34, 0.1);
  color: var(--dsw-alias-state-error-primary, #cf1322);
  font-size: 12px; line-height: 18px; word-break: break-word;
}
.dspfe-progress { display: flex; align-items: center; gap: 8px; color: var(--dsw-alias-label-secondary, inherit); font-size: 12px; line-height: 18px; }
.dspfe-spin {
  flex: none; width: 14px; height: 14px; border-radius: 50%;
  border: 2px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.3));
  border-top-color: var(--dsw-alias-brand-primary, #1677ff);
  animation: dspfe-spin 0.8s linear infinite;
}
@keyframes dspfe-spin { to { transform: rotate(360deg); } }
.dspfe-notice {
  padding: 10px; border-radius: 10px;
  background: var(--dsw-alias-bg-layer-2, rgba(127, 127, 127, 0.1));
  color: var(--dsw-alias-label-secondary, inherit);
  font-size: 12px; line-height: 19px;
}
.dspfe-foot {
  padding: 10px 14px; font-size: 11px; line-height: 16px;
  border-top: 1px solid var(--dsw-alias-border-l1, rgba(127, 127, 127, 0.16));
  color: var(--dsw-alias-label-dimmed, var(--dsw-alias-label-tertiary, inherit));
  display: flex; align-items: center; gap: 8px;
}
.dspfe-foot .dspfe-spacer { flex: auto; }
/* 收起态（官方 AppFrame 折叠侧栏时给祖先挂 data-sidebar-collapsed）才切成图标；
   抽屉展开（无该属性）保持整行文字按钮。原 @media(max-width:768px) 无条件
   强制图标化，会把「抽屉展开但视口窄」也压成孤立图标 —— 已删。 */
[data-sidebar-collapsed] .dspfe-entry-label{display:none}
[data-sidebar-collapsed] .dspfe-entry{justify-content:center;padding:0;gap:0;width:44px;height:44px;margin:0 auto}
@media(max-width:640px){.dspfe-panel{width:100%;max-width:100%;max-height:72dvh;border-radius:16px 16px 0 0}}
@media(max-width:640px){.dspfe-qr-row{flex-direction:column;align-items:center}}
@media(max-width:640px){.dspfe-qr{width:min(200px,60vw);height:min(200px,60vw)}}
`;

    function injectStyle() {
      const existing = document.getElementById(STYLE_ID);
      if (existing && existing.textContent === CSS) return;
      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.dataset.pluginCss = "dsh-pocket-footer-entry";
      style.textContent = CSS;
      // 热重载后旧标签可能还在，先清掉再挂新的
      if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
      document.head.appendChild(style);
    }

    // ── 图标 ────────────────────────────────────────────────────────────────
    function svgProps(size) {
      return {
        width: size,
        height: size,
        viewBox: "0 0 20 20",
        fill: "none",
        xmlns: "http://www.w3.org/2000/svg",
        "aria-hidden": "true",
        focusable: "false",
      };
    }

    function PhoneIcon({ size = 20 } = {}) {
      return h(
        "svg",
        svgProps(size),
        h("rect", {
          key: "b",
          x: "5.75",
          y: "2.75",
          width: "8.5",
          height: "14.5",
          rx: "2.25",
          stroke: "currentColor",
          strokeWidth: "1.5",
        }),
        h("path", { key: "l", d: "M8.5 15.25h3", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" }),
        h("path", {
          key: "w",
          d: "M14.75 5.5a5.5 5.5 0 0 1 0 7",
          stroke: "currentColor",
          strokeWidth: "1.5",
          strokeLinecap: "round",
          opacity: "0.55",
        }),
        h("path", {
          key: "w2",
          d: "M16.75 3.5a8.5 8.5 0 0 1 0 11",
          stroke: "currentColor",
          strokeWidth: "1.5",
          strokeLinecap: "round",
          opacity: "0.3",
        })
      );
    }

    function CloseIcon({ size = 16 } = {}) {
      return h(
        "svg",
        svgProps(size),
        h("path", {
          d: "M5.5 5.5l9 9M14.5 5.5l-9 9",
          stroke: "currentColor",
          strokeWidth: "1.5",
          strokeLinecap: "round",
        })
      );
    }

    // ── RPC ────────────────────────────────────────────────────────────────
    function callRpc(ctx, endpoint, payload) {
      return Promise.resolve(ctx.connection.rpc.call(RPC_CHANNEL, endpoint, payload)).then((res) => {
        if (!res || res.ok !== true) {
          const message = (res && res.error && res.error.message) || "RPC failed";
          throw new Error(message);
        }
        return res.value;
      });
    }

    function errText(error) {
      if (!error) return "";
      return error.message ? error.message : String(error);
    }

    const BUSY_PHASES = { downloading: 1, starting: 1, registering: 1 };

    // ── 二维码 + 地址 ──────────────────────────────────────────────────────
    function QrRow(props) {
      const { qr, url, t, copied, onCopy } = props;
      return h(
        "div",
        { className: "dspfe-qr-row" },
        h("div", { className: "dspfe-qr" }, qr ? h("img", { src: qr, alt: "", width: 168, height: 168 }) : null),
        h(
          "div",
          { className: "dspfe-qr-side" },
          h("code", { className: "dspfe-url" }, url),
          h(
            "button",
            { type: "button", className: "dspfe-btn ghost", onClick: () => onCopy(url) },
            copied ? t("common.copied") : t("common.copy")
          )
        )
      );
    }

    // ── 弹窗 ────────────────────────────────────────────────────────────────
    function PocketDialog(props) {
      const { ctx, t, onClose } = props;
      const [status, setStatus] = useState(null);
      const [error, setError] = useState("");
      const [busy, setBusy] = useState(null); // "start" | "stop" | null
      const [disclaimer, setDisclaimer] = useState(false);
      const [copiedKey, setCopiedKey] = useState("");

      const load = useCallback(() => {
        return callRpc(ctx, "pocket.status", {})
          .then((value) => {
            setStatus(value);
            setError("");
            return value;
          })
          .catch((err) => {
            setError(errText(err));
            return null;
          });
      }, [ctx]);

      useEffect(() => {
        let alive = true;
        const tick = () => {
          if (alive) load();
        };
        tick();
        const timer = setInterval(tick, POLL_MS);
        const onKey = (event) => {
          if (event.key === "Escape") onClose();
        };
        document.addEventListener("keydown", onKey);
        return () => {
          alive = false;
          clearInterval(timer);
          document.removeEventListener("keydown", onKey);
        };
      }, [load, onClose]);

      const copy = useCallback((text) => {
        const done = () =>
          Promise.resolve(navigator.clipboard.writeText(text)).then(
            () => {
              setCopiedKey(text);
              setTimeout(() => setCopiedKey((current) => (current === text ? "" : current)), 1600);
            },
            () => setError(t("common.copyFailed"))
          );
        done();
      }, [t]);

      const startTunnel = useCallback(() => {
        setBusy("start");
        setError("");
        return callRpc(ctx, "tunnel.start", { disclaimer: true })
          .then(() => {
            setDisclaimer(false);
            return load();
          })
          .catch((err) => setError(errText(err)))
          .then(() => setBusy(null));
      }, [ctx, load]);

      const stopTunnel = useCallback(() => {
        setBusy("stop");
        setError("");
        return callRpc(ctx, "tunnel.stop", {})
          .then(() => load())
          .catch((err) => setError(errText(err)))
          .then(() => setBusy(null));
      }, [ctx, load]);

      const blocks = [];

      if (!status && !error) {
        blocks.push(h("p", { key: "loading", className: "dspfe-hint" }, t("dialog.loading")));
      }

      if (status) {
        // 局域网
        const lanChild = status.lanUrl
          ? h(QrRow, { qr: status.lanQr, url: status.lanUrl, t, copied: copiedKey === status.lanUrl, onCopy: copy })
          : h("p", { className: "dspfe-hint" }, t("lan.missing"));
        blocks.push(
          h(
            "section",
            { key: "lan", className: "dspfe-section" },
            h(
              "div",
              { className: "dspfe-sec-head" },
              h("span", { className: "dspfe-sec-title" }, t("lan.title")),
              h(
                "span",
                { className: "dspfe-badge" + (status.lanUrl ? " on" : "") },
                status.lanUrl ? t("tunnel.on") : t("tunnel.off")
              )
            ),
            lanChild,
            status.lanUrl ? h("p", { className: "dspfe-hint", style: { marginTop: "8px" } }, t("lan.hint")) : null
          )
        );

        // 公网
        const phase = status.tunnelState && status.tunnelState.phase;
        const starting = busy === "start" || BUSY_PHASES[phase] === 1;
        const failed = phase === "error";
        const live = Boolean(status.tunnelRunning && status.tunnelUrl);

        let badgeClass = "dspfe-badge";
        let badgeText = t("tunnel.off");
        if (live) {
          badgeClass += " on";
          badgeText = t("tunnel.on");
        } else if (starting) {
          badgeClass += " warn";
          badgeText = t("tunnel.busy.start");
        } else if (failed) {
          badgeClass += " warn";
          badgeText = phase || t("tunnel.off");
        }

        const tunnelBody = [];
        if (starting) {
          tunnelBody.push(
            h(
              "div",
              { key: "spin", className: "dspfe-progress" },
              h("span", { className: "dspfe-spin" }),
              h("span", null, (status.tunnelState && status.tunnelState.detail) || t("tunnel.busy.start"))
            )
          );
        } else if (live) {
          tunnelBody.push(
            h(QrRow, {
              key: "qr",
              qr: status.tunnelQr,
              url: status.tunnelUrl,
              t,
              copied: copiedKey === status.tunnelUrl,
              onCopy: copy,
            }),
            h("p", { key: "hint", className: "dspfe-hint", style: { marginTop: "8px" } }, t("tunnel.hint")),
            h(
              "div",
              { key: "actions", className: "dspfe-actions" },
              h(
                "button",
                { type: "button", className: "dspfe-btn danger", disabled: busy !== null, onClick: stopTunnel },
                busy === "stop" ? t("tunnel.busy.stop") : t("tunnel.stop")
              )
            )
          );
        } else {
          if (failed) {
            tunnelBody.push(
              h(
                "p",
                { key: "detail", className: "dspfe-hint", style: { marginBottom: "10px" } },
                (status.tunnelState && status.tunnelState.detail) || ""
              )
            );
          } else {
            tunnelBody.push(h("p", { key: "hint", className: "dspfe-hint" }, t("tunnel.hint")));
          }
          tunnelBody.push(
            h(
              "div",
              { key: "actions", className: "dspfe-actions" },
              h(
                "button",
                { type: "button", className: "dspfe-btn primary", disabled: busy !== null, onClick: () => setDisclaimer(true) },
                failed ? t("tunnel.retry") : t("tunnel.start")
              )
            )
          );
        }

        blocks.push(
          h(
            "section",
            { key: "tunnel", className: "dspfe-section" },
            h(
              "div",
              { className: "dspfe-sec-head" },
              h("span", { className: "dspfe-sec-title" }, t("tunnel.title")),
              h("span", { className: badgeClass }, badgeText)
            ),
            tunnelBody
          )
        );
      }

      if (disclaimer) {
        blocks.push(
          h(
            "section",
            { key: "disclaimer", className: "dspfe-section" },
            h("div", { className: "dspfe-sec-head" }, h("span", { className: "dspfe-sec-title" }, t("disclaimer.title"))),
            h("div", { className: "dspfe-notice" }, t("disclaimer.body")),
            h(
              "div",
              { className: "dspfe-actions" },
              h(
                "button",
                { type: "button", className: "dspfe-btn primary", disabled: busy !== null, onClick: startTunnel },
                t("disclaimer.accept")
              ),
              h(
                "button",
                { type: "button", className: "dspfe-btn", disabled: busy !== null, onClick: () => setDisclaimer(false) },
                t("disclaimer.cancel")
              )
            )
          )
        );
      }

      if (error) {
        blocks.push(h("div", { key: "error", className: "dspfe-error" }, error));
      }

      const footText = status
        ? status.dshPort
          ? `${t("meta.ports")} :${status.dshPort} · ${t("meta.proxy")} :${status.proxyPort || "-"}`
          : t("meta.noPort")
        : "";

      return h(
        "div",
        {
          className: "dspfe-overlay",
          role: "presentation",
          onClick: (event) => {
            if (event.target === event.currentTarget) onClose();
          },
        },
        h("div", { className: "dspfe-mask" }),
        h(
          "div",
          {
            className: "dspfe-panel",
            role: "dialog",
            "aria-modal": "true",
            "aria-label": t("dialog.title"),
          },
          h(
            "header",
            { className: "dspfe-head" },
            h("div", { className: "dspfe-title" }, t("dialog.title")),
            h(
              "button",
              { type: "button", className: "dspfe-close", onClick: onClose, "aria-label": t("dialog.close") },
              h(CloseIcon, { size: 16 })
            )
          ),
          h("div", { className: "dspfe-body" }, blocks),
          h("footer", { className: "dspfe-foot" }, h("span", null, footText))
        )
      );
    }

    // ── 入口按钮 ────────────────────────────────────────────────────────────
    function makeEntry(ctx, tDefault) {
      return function PocketFooterEntry(props) {
        const [open, setOpen] = useState(false);
        const t = props && typeof props.t === "function" ? props.t : tDefault;
        const label = t("entry.label");
        return h(
          React.Fragment,
          null,
          h(
            "button",
            {
              type: "button",
              className: "dspfe-entry",
              title: t("entry.title"),
              "aria-label": label,
              onClick: () => setOpen(true),
            },
            h("span", { className: "dspfe-icon" }, h(PhoneIcon, { size: 20 })),
            h("span", { className: "dspfe-entry-label" }, label)
          ),
          open ? h(PocketDialog, { ctx, t, onClose: () => setOpen(false) }) : null
        );
      };
    }

    // ── apply ───────────────────────────────────────────────────────────────
    function apply(ctx) {
      injectStyle();

      ctx.effect(
        () => ctx.locale.register(LOCALE_NS, { zh, en }),
        "dsh-pocket-footer-entry: dictionaries"
      );

      const t = ctx.locale.bind(LOCALE_NS);

      ctx.effect(
        () =>
          ctx.slots.inject(SLOT, () =>
            ctx.slots.register(
              {
                name: SLOT,
                id: ENTRY_ID,
                order: 26,
                locale: LOCALE_NS,
                label: () => t("entry.label"),
              },
              makeEntry(ctx, t)
            )
          ),
        "dsh-pocket-footer-entry: " + SLOT
      );

      console.log("[dsh-pocket-footer-entry] mounted");
    }

    exports.apply = apply;
    exports.inject = ["slots", "locale", "connection"];
    return module.exports;
  },
});

/**
 * dsh-pocket-footer-entry 离线冒烟测试
 * ---------------------------------------------------------------------------
 * 为什么需要它：本插件的 client 半边是**新增**（动过 package.json 的 dsh.client），
 * 宿主的 client 模块清单在启动时读一次 —— 不重启就永远不进 boot 清单，
 * 页面里连脚本都不会被 serve（实测 `/plugins/events` 的 graph 里 0 命中）。
 * 所以重启前只能用这套最小 stub 在 Node 里真跑一遍：
 *   factory → apply(ctx) → slot 注册 → 组件渲染 → RPC 调用路径。
 *
 * 断言（任一失败 = 不做重启后的盲测）：
 *   ① factory 返回 cordis 插件形状，且导出 inject 非空
 *   ② apply() 全程没抛错（硬失败 —— 抛错点之前的样式照样注入，最容易漏）
 *   ③ 注册到 sidebar.footer.action，id / order / locale 正确
 *   ④ zh/en 两个字典的 key 集合一致
 *   ⑤ 入口按钮渲染出来，className 与 aria-label 正确
 *   ⑥ 点开弹窗后真的用 ctx.connection.rpc.call 打了 /dsh-pocket + pocket.status
 *   ⑦ status 到位后局域网二维码 <img> 与地址文本都在
 *   ⑧ 公网关闭时给「开启公网访问」按钮；已开启时给「关闭公网」按钮
 *
 * 跑法：node tests/smoke-test.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const HERE = dirname(fileURLToPath(import.meta.url));
const CLIENT = process.env.POCKET_ENTRY_CLIENT || join(HERE, "..", "lib", "client.js");
const SLOT = "sidebar.footer.action";

/* ─────────────────────────── React stub ───────────────────────────
 * 真跑函数组件：createElement 遇到函数类型就地展开（保存/恢复 hook 归属），
 * useState 用每个组件自己的槽位数组，useEffect 立即执行一次（方便观察副作用），
 * useCallback 直返。足够覆盖本插件的组件路径。 */
const hookStore = new Map();
let owner = null;

const React = {
  Fragment: { $$fragment: true },
  createElement(type, props, ...children) {
    const merged = children.length === 0 ? undefined : children.length === 1 ? children[0] : children;
    if (typeof type === "function") {
      const prev = owner;
      let arr = hookStore.get(type);
      if (!arr) {
        arr = [];
        hookStore.set(type, arr);
      }
      owner = { arr, idx: 0 };
      try {
        return type({ ...(props || {}), children: merged });
      } finally {
        owner = prev;
      }
    }
    return { type, props: { ...(props || {}), children: merged } };
  },
  useState(init) {
    const index = owner.idx++;
    if (!(index in owner.arr)) owner.arr[index] = typeof init === "function" ? init() : init;
    const slot = owner.arr;
    const setter = (value) => {
      slot[index] = typeof value === "function" ? value(slot[index]) : value;
    };
    setter.$$slot = `${owner.arr.length}:${index}`;
    SETTERS.push(setter);
    return [owner.arr[index], setter];
  },
  useEffect(fn) {
    const cleanup = fn();
    if (typeof cleanup === "function") CLEANUPS.push(cleanup);
  },
  useCallback(fn) {
    return fn;
  },
  useRef(value) {
    return { current: value };
  },
  useMemo(fn) {
    return fn();
  },
};
const SETTERS = [];
const CLEANUPS = [];

/* ─────────────────────────── 宿主环境 stub ─────────────────────────── */
const rpcCalls = [];
const slotOps = [];
const localeRegs = [];
const effectNames = [];
let styleInjected = null;

const BASE_STATUS = {
  proxyRunning: true,
  proxyPort: 19400,
  lanUrl: "http://192.168.1.20:19387/?pocket=T_LAN",
  lanQr: "data:image/png;base64,LANQR",
  lanCandidates: ["192.168.1.20"],
  lanIpOverride: null,
  tunnelRunning: false,
  tunnelUrl: null,
  tunnelQr: null,
  tunnelState: { phase: "idle", detail: "", startedAt: null },
  tunnelConfig: { mode: "quick", hostname: null, tokenSet: false },
  dshPort: 19387,
};

function loadPlugin({ status = BASE_STATUS, rpcError = null } = {}) {
  hookStore.clear();
  SETTERS.length = 0;
  CLEANUPS.length = 0;
  rpcCalls.length = 0;
  slotOps.length = 0;
  localeRegs.length = 0;
  effectNames.length = 0;
  styleInjected = null;

  let def = null;

  const document = {
    head: { appendChild: (el) => { styleInjected = el; } },
    getElementById: () => null,
    createElement: () => ({ textContent: "", dataset: {}, setAttribute() {}, style: {} }),
    addEventListener() {},
    removeEventListener() {},
    body: null,
  };
  const window = {
    document,
    __ModuleLoader__: { load: (d) => { def = d; } },
  };
  window.window = window;

  const sandbox = {
    window,
    document,
    self: window,
    console,
    setTimeout,
    clearTimeout,
    setInterval: () => 1,
    clearInterval() {},
    queueMicrotask,
    navigator: { clipboard: { writeText: () => Promise.resolve() } },
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(CLIENT, "utf8"), sandbox, { filename: CLIENT });

  const ctx = {
    effect(fn, name) {
      effectNames.push(name);
      return fn();
    },
    locale: {
      register(ns, dicts) {
        localeRegs.push({ ns, dicts });
        return () => {};
      },
      bind(ns) {
        return (key, ...args) => {
          const reg = localeRegs.filter((r) => r.ns === ns).pop();
          const table = reg ? reg.dicts.zh || {} : {};
          const value = table[key];
          if (typeof value === "function") {
            throw new Error(`t(${JSON.stringify(key)}) 在字典里是函数 —— 宿主 locale 的 t 是单层调用，不能写成 t(k)(...)`);
          }
          return value === undefined ? key : value;
        };
      },
    },
    slots: {
      inject(slot, cb) {
        slotOps.push({ kind: "inject", slot });
        return cb();
      },
      register(options, Component) {
        slotOps.push({ kind: "register", options, Component });
        return () => {};
      },
    },
    connection: {
      rpc: {
        call(channel, endpoint, payload) {
          rpcCalls.push({ channel, endpoint, payload });
          if (rpcError) return Promise.resolve({ ok: false, error: { message: rpcError } });
          return Promise.resolve({ ok: true, value: status });
        },
      },
    },
  };

  let applyError = null;
  let mod = null;
  if (def === null) throw new Error(`${CLIENT}: 没有捕获到 __ModuleLoader__.load 定义`);
  try {
    mod = def.factory((name) => {
      if (name === "react") return React;
      throw new Error(`unexpected require(${JSON.stringify(name)})`);
    });
  } catch (err) {
    applyError = err;
  }

  let applyError2 = null;
  if (mod && typeof mod.apply === "function") {
    try {
      mod.apply(ctx);
    } catch (err) {
      applyError2 = err;
    }
  }

  return { id: def.id, mod, ctx, applyError: applyError || applyError2, css: styleInjected ? styleInjected.textContent : "" };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ─────────────────────────── 断言骨架 ─────────────────────────── */
const results = [];
function check(name, actual, expected) {
  results.push({ ok: actual === expected, name, actual, expected });
}
function checkTrue(name, cond, detail) {
  results.push({ ok: !!cond, name, actual: detail === undefined ? !!cond : detail, expected: true });
}

function nodeText(node) {
  if (node === null || node === undefined || node === false) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join("");
  if (node.props) return nodeText(node.props.children);
  return "";
}
function findAll(node, pred, out = []) {
  if (node === null || node === undefined || typeof node === "boolean") return out;
  if (Array.isArray(node)) {
    for (const child of node) findAll(child, pred, out);
    return out;
  }
  if (typeof node !== "object") return out;
  if (pred(node)) out.push(node);
  findAll(node.props && node.props.children, pred, out);
  return out;
}
// 精确 token 匹配：`dspfe-entry` 不应命中 `dspfe-entry-label`
const byClass = (cls) => (node) => typeof (node.props || {}).className === "string"
  && node.props.className.split(/\s+/).includes(cls);

/* ═══════════════════════════ ① 加载 + apply ═══════════════════════════ */
const first = loadPlugin();
check("① 捕获到的模块 id", first.id, "dsh-pocket-footer-entry");
checkTrue("① factory 返回 {apply, inject} 形状", !!(first.mod && typeof first.mod.apply === "function"), typeof first.mod);
checkTrue("① 导出 inject 非空（漏了 apply 会永不执行且零报错）",
  Array.isArray(first.mod.inject) && first.mod.inject.length > 0, JSON.stringify(first.mod && first.mod.inject));
checkTrue("① apply() 全程没抛错（硬失败）", first.applyError === null, first.applyError && first.applyError.stack);
checkTrue("① 注入的 CSS 非空", first.css.length > 2000, first.css.length);

/* ═══════════════════════════ ② slot 注册 ═══════════════════════════ */
const injectOp = slotOps.find((op) => op.kind === "inject");
const registerOp = slotOps.find((op) => op.kind === "register");
check("② 走的是 slots.inject", injectOp && injectOp.slot, SLOT);
checkTrue("② 注册了且只注册了一个 entry", !!registerOp && slotOps.filter((o) => o.kind === "register").length === 1);
check("② register.name", registerOp.options.name, SLOT);
check("② register.id", registerOp.options.id, "pocket-entry");
check("② register.order（接替原远程控制按钮的位置）", registerOp.options.order, 26);
check("② register.locale", registerOp.options.locale, "pocketFooterEntry");
check("② register.label() 返回中文标签", registerOp.options.label(), "手机访问");
checkTrue("② 组件是函数", typeof registerOp.Component === "function");

/* ═══════════════════════════ ③ 字典完整性 ═══════════════════════════ */
const reg = localeRegs.find((r) => r.ns === "pocketFooterEntry");
checkTrue("③ 注册了 pocketFooterEntry 字典", !!reg && !!reg.dicts.zh && !!reg.dicts.en);
if (reg) {
  const zhKeys = Object.keys(reg.dicts.zh).sort();
  const enKeys = Object.keys(reg.dicts.en).sort();
  const missingEn = zhKeys.filter((k) => !enKeys.includes(k));
  const missingZh = enKeys.filter((k) => !zhKeys.includes(k));
  checkTrue(`③ zh/en key 集合一致（zh 独有: ${missingZh.join(",") || "无"}；en 独有: ${missingEn.join(",") || "无"}）`,
    missingEn.length === 0 && missingZh.length === 0);
}

/* ═══════════════════════════ ④ 入口按钮渲染 ═══════════════════════════ */
const Component = registerOp.Component;
const treeClosed = React.createElement(Component, { t: registerOp.options.label ? undefined : undefined });
const buttons = findAll(treeClosed, byClass("dspfe-entry"));
check("④ 渲染出 1 个入口按钮", buttons.length, 1);
check("④ 按钮 aria-label", buttons[0] && buttons[0].props["aria-label"], "手机访问");
check("④ 按钮 title", buttons[0] && buttons[0].props.title, "手机访问（dsh-pocket）");
checkTrue("④ 按钮里有 label 文本", nodeText(buttons[0]).includes("手机访问"), nodeText(buttons[0]));
checkTrue("④ 初始不渲染弹窗", findAll(treeClosed, byClass("dspfe-overlay")).length === 0);
check("④ 图标包在 span.dspfe-icon 里（裸 svg 会被 flex 拉伸 —— 2026-10-16 截图翻车点）",
  findAll(buttons[0], byClass("dspfe-icon")).length, 1);
checkTrue("④ CSS 给图标钉了 flex:none",
  first.css.includes(".dspfe-icon { flex: none;") && first.css.includes(".dspfe-entry > svg { flex: none; }"),
  "缺 flex:none");
checkTrue("④ CSS 接管了 footer 入口行的并排（bridge-next 卸载后要补回来）",
  first.css.includes('div[class$="_footArea"]') && first.css.includes("flex: 1 1 max-content;"),
  "缺并排规则");
const svgNode = findAll(buttons[0], (n) => n.type === "svg")[0];
checkTrue("④ 图标 svg 的 width/height 必须是数字（React createElement 第二参传原始值 → props 恒为空对象 → width=\"[object Object]\" → SVG 回落 300×150；2026-10-16 实测翻车点）",
  !!svgNode && Number.isFinite(Number(svgNode.props.width)) && Number.isFinite(Number(svgNode.props.height)),
  svgNode ? `width=${JSON.stringify(svgNode.props.width)} height=${JSON.stringify(svgNode.props.height)}` : "按钮里找不到 svg");

/* ═══════════════════════════ ⑤ 打开弹窗 → RPC + 渲染 ═══════════════════════════ */
const openSetter = SETTERS.find((s) => s.$$slot.endsWith(":0")) || SETTERS[0];
checkTrue("⑤ 拿到入口的 open setter", typeof openSetter === "function");
openSetter(true);
const treeOpen = React.createElement(Component, {});
const overlay = findAll(treeOpen, byClass("dspfe-overlay"));
check("⑤ 打开后渲染出弹窗", overlay.length, 1);

await sleep(20);
const treeReady = React.createElement(Component, {});
const overlay2 = findAll(treeReady, byClass("dspfe-overlay"));
checkTrue("⑤ 弹窗仍在（status 到位后没崩）", overlay2.length === 1);

check("⑤ RPC 通道", rpcCalls[0] && rpcCalls[0].channel, "/dsh-pocket");
check("⑤ RPC endpoint", rpcCalls[0] && rpcCalls[0].endpoint, "pocket.status");

const imgs = findAll(treeReady, (n) => n.type === "img");
checkTrue("⑤ 局域网二维码 <img> 渲染出来了", imgs.some((n) => String(n.props.src).startsWith("data:image/png;base64,LANQR")),
  imgs.map((n) => String(n.props.src).slice(0, 40)).join(" | "));
checkTrue("⑤ 局域网地址文本在", nodeText(treeReady).includes("http://192.168.1.20:19387/?pocket=T_LAN"));
checkTrue("⑤ 状态行含端口", nodeText(treeReady).includes("19387") && nodeText(treeReady).includes("19400"), nodeText(treeReady));

/* ═══════════════════════════ ⑥ 公网按钮两种形态 ═══════════════════════════ */
const startBtn = findAll(treeReady, (n) => n.type === "button" && nodeText(n).includes("开启公网访问"));
checkTrue("⑥ 公网关闭时给「开启公网访问」", startBtn.length === 1);
const stopBtn = findAll(treeReady, (n) => n.type === "button" && nodeText(n).includes("关闭公网"));
checkTrue("⑥ 公网关闭时没有「关闭公网」", stopBtn.length === 0);

const live = loadPlugin({
  status: { ...BASE_STATUS, tunnelRunning: true, tunnelUrl: "https://t-tunnel.trycloudflare.com/?pocket=T_TUN", tunnelQr: "data:image/png;base64,TUNQR" },
});
checkTrue("⑥ 已开启时 apply 仍不抛错", live.applyError === null, live.applyError && live.applyError.stack);
const liveReg = slotOps.find((op) => op.kind === "register");
React.createElement(liveReg.Component, {});
const liveSetter = SETTERS.find((s) => s.$$slot.endsWith(":0")) || SETTERS[0];
liveSetter(true);
React.createElement(liveReg.Component, {}); // 打开 → 弹窗首渲染 → 发起 RPC
await sleep(20);
const treeLive = React.createElement(liveReg.Component, {});
const liveStop = findAll(treeLive, (n) => n.type === "button" && nodeText(n).includes("关闭公网"));
checkTrue("⑥ 已开启时给「关闭公网」", liveStop.length === 1, nodeText(treeLive).slice(0, 120));
const liveStart = findAll(treeLive, (n) => n.type === "button" && nodeText(n).includes("开启公网访问"));
checkTrue("⑥ 已开启时没有「开启公网访问」", liveStart.length === 0);
checkTrue("⑥ 公网二维码也渲染出来了", findAll(treeLive, (n) => n.type === "img" && String(n.props.src).includes("TUNQR")).length === 1);

/* ═══════════════════════════ ⑦ RPC 失败不白屏 ═══════════════════════════ */
const bad = loadPlugin({ rpcError: "dsh-pocket 未加载 | dsh-pocket not loaded" });
checkTrue("⑦ RPC 失败时 apply 不抛错", bad.applyError === null, bad.applyError && bad.applyError.stack);
const badReg = slotOps.find((op) => op.kind === "register");
React.createElement(badReg.Component, {});
const badSetter = SETTERS.find((s) => s.$$slot.endsWith(":0")) || SETTERS[0];
badSetter(true);
React.createElement(badReg.Component, {}); // 打开 → 弹窗首渲染 → 发起 RPC
await sleep(20);
const treeBad = React.createElement(badReg.Component, {});
checkTrue("⑦ 错误信息渲染到弹窗里（不是白屏）", nodeText(treeBad).includes("dsh-pocket 未加载"), nodeText(treeBad).slice(0, 200));

/* ═══════════════════════════ 汇总 ═══════════════════════════ */
const failed = results.filter((r) => !r.ok);
for (const r of results) {
  console.log(`${r.ok ? "  ok  " : "  FAIL"}  ${r.name}${r.ok ? "" : `\n          实际=${JSON.stringify(r.actual)} 期望=${JSON.stringify(r.expected)}`}`);
}
console.log("");
console.log(`${results.length - failed.length}/${results.length} 通过`);
if (failed.length) {
  console.log(`❌ ${failed.length} 项失败 —— 修完再重启，别把白屏带到运行时`);
  process.exit(1);
}
console.log("✅ 全部通过 —— 可以重启宿主了");

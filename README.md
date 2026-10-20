# dsh-pocket-footer-entry

把 [dsh-pocket](https://github.com/shaobeichen/dsh-pocket) 的手机访问入口做成**侧边栏底部的快捷按钮**，和「上下文洞察」并排一行。

## 它做什么

侧边栏底部多一个「手机访问」按钮，点开是一个弹窗：

- **局域网**：dsh-pocket 的局域网二维码 + 地址，带一键复制（手机同 Wi-Fi 扫码即开，自定义界面完整保留）
- **公网**：显示隧道状态；未开启时可直接开启（会先弹安全免责声明，与服务端强制校验一致），已开启时显示公网二维码与地址，并可一键关闭
- **状态行**：DSH 端口 / 代理端口

公网开关直接走 dsh-pocket 的 RPC 通道 `/dsh-pocket`（`pocket.status` / `tunnel.start` / `tunnel.stop`），
`tunnel.start` 按要求带 `{ disclaimer: true }`，免责声明文案在弹窗内先给用户看过。

## 依赖

必须同时安装 `dsh-pocket`（它提供 host 侧的 RPC 通道与二维码生成）。
本插件是纯客户端插件，host 半边只打一行日志。

`package.json` 里 `dsh.client.inject` 声明了三个模块依赖：

```
@deepseek-ai/dsh-client-connection    # ctx.connection.rpc.call
@deepseek-ai/dsh-client-ui-slots      # ctx.slots.inject / ctx.slots.register
@deepseek-ai/dsh-client-locale        # ctx.locale.register / bind
```

## 安装（desktop profile）

在 `~/.dsh/profiles/desktop/package.json` 里加两处：

```jsonc
"dependencies": {
  "dsh-pocket": "^2.11.0",
  "dsh-pocket-footer-entry": "link:../../local-plugins/dsh-pocket-footer-entry"
},
"dsh": {
  "profile": {
    "bundles": [
      // …
      "dsh-pocket",
      "dsh-pocket-footer-entry"
    ]
  }
}
```

然后 `pnpm install`（用 DSH 自带的 pnpm10：`~/.dsh/bin/pnpm10 install`），再**完全重启** DSH。
client 半边是新增模块，刷新页面不够——boot 模块清单元数据在启动时读一次。

## 卸载

从 `dependencies` 和 `dsh.profile.bundles` 里各删一行，`pnpm install`，重启。

## 卸载不掉的残留

无。本插件只在 `document.head` 里挂一个 `<style id="dsh-pocket-footer-entry-style">`，
热重载时会自动替换，进程退出即消失。

---

## ☕ 赞赏支持

如果 dsh-pocket-footer-entry 对你的研究与测试有所帮助，欢迎请作者喝杯咖啡 ☕

<p align="center">
  <img src="assets/sponsor.jpg" width="260" alt="微信赞赏码" />
  <img src="assets/afdian_reward.jpg" width="200" alt="爱发电赞助码" />
</p>

<p align="center">
  <b>给项目点个 Star ⭐</b> 同样是对开发者最大的鼓励！
</p>

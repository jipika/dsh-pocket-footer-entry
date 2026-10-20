/**
 * dsh-pocket-footer-entry — host half.
 *
 * 这是一个纯客户端（UI 层）插件：真正的手机访问服务由 dsh-pocket 提供，
 * 本插件只负责在 sidebar.footer.action 里放一个快捷按钮 + 弹窗。
 * host 半边不注册任何东西，只是让 profile 加载链路上有一个合法 entry。
 */

export const name = 'dsh-pocket-footer-entry';

export const inject = [];

export function apply() {
  console.log('[dsh-pocket-footer-entry] host half mounted');
}

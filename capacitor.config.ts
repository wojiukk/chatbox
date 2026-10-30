import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Capacitor 配置 —— 只为自建 Android 工程服务。
 *
 * 上游开源仓库（chatboxai/chatbox）既没有 android/ 原生工程，也没有这份配置：
 * 官方安卓包用的是他们自己维护、未开源的原生项目。这里补一份最小配置，
 * 让 CI 能现场 `cap add android` 生成工程再打 APK。
 * 桌面端（electron-vite / electron-builder）完全不读这个文件。
 *
 * 三个约束，改了会直接构建失败或平台识别错误：
 * 1. webDir 必须与 electron.vite.config.ts 里 renderer 的 outDir 一致，
 *    即 `release/app/dist/renderer`。
 * 2. 编译 renderer 时必须带上
 *    `CHATBOX_BUILD_TARGET=mobile_app` + `CHATBOX_BUILD_PLATFORM=android`，
 *    否则 src/renderer/utils/feature-flags.ts、platform 选择器会按桌面处理。
 * 3. appId 用 `xyz.chatboxapp.ce`：与桌面版 package name 一致，同时避开官方
 *    Chatbox 安卓端的 `xyz.chatboxapp.app`，两个 App 可以同时装在手机上。
 */
const config: CapacitorConfig = {
  appId: 'xyz.chatboxapp.ce',
  appName: 'Chatbox',
  webDir: 'release/app/dist/renderer',

  android: {
    // 自用包不加载 http:// 明文资源，保持默认的安全策略
    allowMixedContent: false,
  },

  plugins: {
    // @capacitor-community/sqlite：项目里统一用 no-encryption 连接，
    // 所以两端都不开加密库。
    CapacitorSQLite: {
      iosDatabaseLocation: 'Library/CapacitorDatabase',
      iosIsEncryption: false,
      androidIsEncryption: false,
    },
  },
}

export default config

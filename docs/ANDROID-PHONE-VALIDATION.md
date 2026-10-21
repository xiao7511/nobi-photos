# Android 真机版面联调与本机运行环境

2026-10-21 完成 0.4.1（versionCode 5）的真机更新及联调。应用代码提交 `a5b3954522f04be8b7a3a52c54ff410d152f4ecd`，包名 `app.nobi.photos`。验收设备为用户连接的中兴 ZTE 7551N，Android 13 / API 33，物理分辨率 720×1612，WebView `101.0.4951.61`。

## 问题与修复

旧版构建将 CSS 媒体查询压缩为 `(width<=680px)` 等范围语法，设备 WebView 101 无法识别，导致桌面侧栏保留、底部导航隐藏、内容被挤压。改版前实际读取到页面布局宽度 543px，移动导航不可见。旧 APK 的原生 SQLite 与照片桥接存在，问题发生在页面兼容与布局。

Vite 现明确设置 JS/CSS 目标为 Chromium 100 / Safari 15，生成兼容的 `min-width`、`max-width` 查询；`cap:check` 同时检查构建产物，阻止宽高范围媒体查询回归。此构建目标不代表所有对应系统均已实测。

原生容器启用专用界面：60dp 紧凑顶栏、固定五栏底部导航、三列照片网格、照片页的本机状态与管理入口、精简搜索/清理/个人页。原生首页移除网页宣传大图，空图库保留主动授权/扫描入口；扫描设置集中在隐私中心，默认关闭策略不变。浏览器仍提供完整的网页预览。

Android 返回键按顺序处理顶层弹窗、照片选择状态、隐私页返回“我的”、其他主页面返回照片页，根页面返回则最小化应用。弹窗返回沿用取消逻辑，不提交未保存内容；保存忙碌期间不会退出选择。输入法采用 `adjustResize`；系统栏图标随外观设置切换。

## 手机上的独立运行环境

| 组件         | 部署及验证                                                                 |
| ------------ | -------------------------------------------------------------------------- |
| Android 容器 | 手机实际安装 0.4.1 / build 5，`App.getInfo()` 已确认                       |
| 页面与资源   | 内置 APK，37 个 `dist/` 文件逐一校验 SHA-256 一致                          |
| 原生 SQLite  | 设备应用私有目录内 `nobi_photos`，实际 PRAGMA 查询迁移版本 2               |
| 照片读取     | 自有 NobiPhotoLibrary / MediaStore 只读插件，原有授权保留                  |
| 生命周期     | 原生 App 插件；返回后台、恢复、进程冷启动均已测试                          |
| 电脑依赖     | 无远程 `server.url`、无 ADB reverse 映射，不需要运行 Vite/preview 网页服务 |
| 网络与账号   | 实际 APK 无 INTERNET 权限，无账号要求、上传、遥测或云端 AI                 |
| 云端业务     | 本轮未接入云端 API，也未连接腾讯云数据库；按用户确认范围完成手机独立环境   |

`https://localhost` 是 Capacitor 对 APK 内页面的本机映射。SQLite、照片桥接和 App 生命周期均在手机原生进程中执行。应用仍是 Capacitor 容器内的 Vue 界面，页面依赖手机的系统 WebView。拔掉 USB 后可从手机桌面启动；ADB 与 Debug WebView 只用于开发联调。

本地元数据未启用应用层加密；禁用备份和设备迁移。最低 API 24、目标 API 36，四种 ABI 已打包，不能据此宣称所有 Android 版本运行验证完成。

## 安装与数据保留

中兴系统对流式及普通 ADB 安装均返回 `reject adb install`。未关闭系统校验、伪造安装来源或卸载旧版。新版 APK 已传入手机 Download 目录，由用户通过系统安装器手动确认更新；随后实际核对手机版本为 0.4.1。

覆盖更新未执行 `pm clear`、卸载、撤权、相册扫描或照片整理操作。用户在联调期间手动收藏了照片，并已确认该操作；未自动回滚。最后一轮以用户当前数据为基线，比较照片索引、相册、标签、成员关系与收藏的汇总数量，全部保持一致。汇总数量只保存在本机忽略目录，报告不包含私人文件名、相册名或照片内容。

## 验证结果

| 检查                                             | 本轮结果                                                               |
| ------------------------------------------------ | ---------------------------------------------------------------------- |
| ESLint / TypeScript / 格式                       | 通过                                                                   |
| Vitest                                           | 13 个文件、70 项通过，包含返回导航测试                                 |
| 桌面与移动网页回归                               | 14 项通过                                                              |
| Vite build / Capacitor sync / 隐私与兼容配置检查 | 通过                                                                   |
| Android assembleDebug / app lint / 自有插件 lint | 构建通过；应用 0 错误、14 现有警告；插件无问题                         |
| APK v2 Debug 签名、权限、备份及内置资源          | 通过                                                                   |
| 真机五个页面                                     | 360×769 CSS 像素，页面宽度与视口相等，底部导航可见，顶栏 60dp          |
| 真机主题、返回键与弹窗                           | 浅色/深色切换、隐私返回、主页面返回、关闭未保存相册编辑弹窗均通过      |
| 真机软键盘                                       | 搜索框调起键盘后视口缩小，返回关闭键盘后尺寸恢复，页面保持在搜索页     |
| 真机冷启动与恢复                                 | 强停后启动、本机 SQLite 可用、根页面返回后台、照片隐藏和恢复应用均通过 |
| 真机本地记录                                     | 最后一轮 UI 测试前后汇总数量一致                                       |
| 专用 Android 14 模拟器                           | 同一 APK 的 101 张合成图片完整流程通过                                 |

模拟器实际测试系统拒绝/完整授权、跨 100 条分页的索引、JPEG 缩略图、收藏持久化、相册与标签、本地相似建议、批量标签搜索、后台隐藏/恢复、飞行模式且关闭 Wi-Fi 后的进程冷启动，以及撤权后的索引和标签清空。只对专用 AVD 重置测试数据，不对真机执行这些写入/撤权操作。

真机截图：[搜索页](screenshots/android-phone/search.png)、[隐私中心](screenshots/android-phone/privacy.png)。截图前在测试页面隐藏图库、相册、私人统计及扫描时间区域，不导出私人照片。详细记录见 [android-phone-result.json](validation/android-phone-result.json)。

## 安装包与复验

本地 APK：`artifacts/android-0.4.1/NOBI-Photos-0.4.1-debug.apk`，13,297,926 字节。SHA-256：

```text
56e0b6952d5efece6db79ed9d5e6db408000d6cad144a7b5f753451c28d09a74
```

同目录有 `.sha256`、签名/清单/资源核验记录及本轮模拟器与真机结果。APK 使用本机 Android Debug 证书，不作为商店发布包；二进制不提交 Git。

开发机已配置 Node.js 24、npm 11、JDK 21、Android SDK 36 和 Gradle 8.14.3。构建步骤：

```powershell
npm ci
npm run build
npx cap sync android
npm run cap:check
cd android
.\gradlew.bat :app:assembleDebug :app:lintDebug :nobi-photo-library:lintDebug --no-daemon --max-workers=1 '-Dorg.gradle.jvmargs=-Xmx768m -Dfile.encoding=UTF-8'
```

真机版面测试需显式指定设备，手机解锁且已安装 Debug APK：

```powershell
$env:NOBI_PHONE_SERIAL='<adb devices 显示的手机序列号>'
$env:NOBI_PHONE_COLD_START='1'
npm run test:phone
```

脚本不安装/卸载、不清除数据、不申请或撤销照片权限、不扫描或保存照片整理，不切换手机网络。会导航页面、切换并恢复原主题、打开后取消空白相册编辑、调起/关闭键盘、最小化/恢复应用；冷启动选项会强停本应用后重启。不要在测试同时编辑相册，否则前后数据校验会失败。`NOBI_PHONE_BASELINE=1` 仅用于旧版诊断。

设备 WebView 101 缺少当前 Playwright 使用的 `checkVisibility` 与 Popover API。测试工具仅为自己的可见性判断补兼容方法，截图用测试页 CSS 隐藏私人区域；未给产品代码加入这些测试补丁。真机实测与现代桌面浏览器模拟分别记录。

尚未执行真机飞行模式（避免改变用户手机网络）、有限选择及范围缩减、完整大图库中断矩阵、其他 Android 设备、iOS 或正式发布签名。本次飞行模式运行证据来自专用 Android 14 AVD。

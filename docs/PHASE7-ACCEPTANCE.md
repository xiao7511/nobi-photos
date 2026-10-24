# NOBI Photos 0.7.0 · 全屏、相册与播放验收

日期：2026-10-24（Asia/Shanghai）。版本 0.7.0 / Android versionCode 8 / iOS build 8。应用源码：`6621b0d5630fa4ca45ab5937c9c99db1c8ae07ea`。

本轮修复用户反馈的照片未满屏、分类相册看似打不开，并增加自动轮播与分类背景音乐。仅修改 `D:\project\nobi-photos`，没有连接生产数据库、修改其他 NOBI 项目或访问真实手机照片。执行时 ADB 未检测到真实手机，因此本轮交付安装包，未声称已在用户手机更新。

## 修复与使用

### 照片满屏

上一版使用 `100dvh`，旧版 WebView 不支持时高度会退回内容尺寸；`contain` 和占据布局空间的工具栏也会留下黑边。现在使用实际视口像素尺寸并保留 `vh` 回退，图片覆盖整个查看器，工具栏悬浮在图上；原生看图隐藏系统栏，关闭恢复。

默认铺满保持图片比例，会裁剪屏幕之外的边缘；点击“完整显示照片”可切换到完整构图，再点击“铺满屏幕”返回。两种方式都不改动原始照片。放大改为相对屏幕的两倍显示，支持滚动看细节。点照片可隐藏/显示工具栏。

Android 专用模拟器实际测得视口 **412×915 CSS 像素**，照片区域 **412×915.048**，覆盖整个视口；已视觉复核 [原生全屏截图](validation/android-phase7-fullscreen.png)，系统状态栏和底部导航栏均未占用看图区域。原图解码为公开测试图的 512×929，非 256 像素缩略图放大。

### 相册可见与返回

上一版点击分类或 AI 相册只在长页面底部增加一个区域，屏幕没有跳转，容易表现为无法打开。现在进入独立相册详情，标题、照片和“播放相册”立即显示；URL 的 `album` 参数记录位置，刷新保留详情。返回键先回相册列表，再回照片主页。分类、收藏、自建和 AI 相册共用流程；空相册、已移除或暂不可访问有明确提示。

AI 相册改名继续保留成员及稳定 ID。另修复保存标签刷新时会卸载整个照片查看器的问题，避免保存后突然退出。

### 自动轮播

相册详情点击“播放相册”，或看图时点击“开始自动轮播”。每张原图成功解码后等待 5 秒，末张回到首张。支持暂停；放大、编辑标签时暂停，原图失败停下并显示提示。关闭、离页、切后台取消计时，不在后台扫描或切图。

### 分类配乐

配乐默认关闭。看图时点击“开启分类配乐”，再次点击关闭。内置原创乐谱由本机 Web Audio 生成器乐，不下载音频、不使用麦克风或云端服务。

| 分类 | 配乐 |
| --- | --- |
| 自然与风景 | 山林微风 |
| 交通与出行 / 旅行 | 向远方 |
| 城市与建筑 | 城市漫步 |
| 生活 / 未分类 | 日常小确幸 |
| 宠物与动物 | 小小伙伴 |
| 美食与饮品 | 午后咖啡 |
| 文档 | 纸上时光 |

AI 相册按稳定主题 ID 匹配，用户改名不影响配乐；普通自建相册按照片主要分类匹配。关闭查看器、切后台或音频会话中断时停止，释放振荡器、定时器和 AudioContext，不自动恢复播放。音量由设备媒体音量控制。

## 验证结果

- `lint`、`typecheck`、`build`、`cap:check` 通过；**88 项单元测试 / 18 文件**。
- GitHub verify 作业：**22 项桌面/移动端 Playwright 测试全部通过**。覆盖相册点击后进入可见详情、刷新、改名、标签保存后继续看图、满屏像素占比、完整显示切换、轮播全部循环、暂停、离线真实音频采样、关闭音乐和退出时 AudioContext 释放。
- Android `assembleDebug`、应用与原生插件 lint 通过；应用 0 错误、12 项已有资源/工具警告，原生照片插件无问题。
- 最终 APK 在专用 Android 14 / API 34 AVD 实际验证：AI 与分类相册详情、原生返回列表、满屏原图、完整显示切换、5 秒轮播和暂停、默认无音频上下文、离线音乐实际非零采样、主题切换、后台停止音频和清理原图缓存。
- 浏览器与原生音频测试通过分析器读取实际音频波形，非只判断按钮状态。Android 音频 RMS **大于 0.0001**；测试全程飞行模式且 Wi-Fi 关闭。只使用 101 张合成图片、1 张公开鹦鹉图片、1 张已核对哈希的旧 12MP 合成测试图，无私人照片。

记录：[Android 播放验证](validation/android-phase7-playback-result.json)、[最终 APK 包体核验](validation/android-phase7-packaging-result.json)。原图读取接口沿用 Phase 6 的只读本机资源流程与 64 百万像素 / 80 MiB 上限，没有上传或删除原图功能。

## Android 安装包

`artifacts/android-0.7.0/NOBI-Photos-0.7.0-debug.apk`，**37,065,349 bytes**。

```text
SHA-256 b8bb1fa03276b55e8d099eb4c2433f77cfc41a6faca047d5efb22d1c6b1c4db0
```

已核对包名 `app.nobi.photos`、版本码 8、Android Debug v2 签名、min SDK 24 / target SDK 36、四种 ABI、37 个内置网页文件与最终 `dist` 哈希全部一致。没有 INTERNET、麦克风、位置、相机或写相册权限；禁止备份/设备迁移，没有远程网页服务。

请覆盖安装 0.7.0 后体验；无需先卸载旧版。仍离线运行，不强制注册，照片、收藏、相册和标签继续在设备本地。

## iOS 与复现

[Actions 40050185162](https://github.com/xiao7511/nobi-photos/actions/runs/40050185162) 使用同一应用源码，verify、Android、iOS 三作业全部成功。Xcode 26.6 在 GitHub macOS runner 实际执行两项原生 UI 测试，日志为 `Executed 2 tests, with 0 failures`、`TEST EXECUTE SUCCEEDED` 和 `ARCHIVE SUCCEEDED`。新增分类相册打开、配乐开关、真实等待轮播前进和暂停检查，并保留 PhotoKit / SQLite / Vision、原图、主题、隐私和键盘验证；索引 107 张合成/预置图片。

[iOS 验证记录](validation/ios-phase7-result.json)。[模拟器应用、无签名设备归档与日志](https://github.com/xiao7511/nobi-photos/actions/runs/40050185162/artifacts/12543875244) 共 16,559,125 bytes；GitHub Actions 提供的 SHA-256 为 `9585ed5e772997b7fd1844782440e58b8f7251bd5959932a3f14b525e91635aa`，保留至 2027-01-22。本轮未下载该完整归档到本机，已核读原始构建和测试日志及 artifact 元数据。

没有真机 iPhone、签名团队或 TestFlight 发布；无签名归档不是可安装 IPA。实际扬声器听感、设备静音开关和更多机型需真机验收。

复现：网页执行 `npm run lint`、`npm run typecheck`、`npm run test`、`npm run build`、`npm run test:e2e`。专用 `nobi_photos_test` / `emulator-5580` 准备合成图库并完成此前离线 AI 相册保存后，安装新包并执行 `node scripts/native-playback-smoke.mjs`。脚本拒绝其他设备及未知图库，确认旧 HD 合成图哈希后才运行，临时切换测试 AVD 网络并在结束恢复；不用于真实手机。

API 参考：[Capacitor 系统栏](https://capacitorjs.com/docs/apis/system-bars)、[Web Audio 用户操作与播放](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices)。原始测试结果与截图是本项目验收依据。

本轮完成后等待用户验收，不自动开展新阶段或云端照片功能。

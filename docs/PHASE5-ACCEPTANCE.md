# NOBI Photos · Phase 5 验收报告

日期：2026-10-22（Asia/Shanghai）。版本：0.5.0 / build 6。基线 `584dca7`，最终应用源码 `99533e0`，含 iOS 授权时序修复与连接用途说明生命周期修复。

本轮范围为用户要求的图标统一、AI 智能整理相册与 iOS 开发。用户确认暂无 Mac，采用 GitHub macOS 构建验证。只修改 `D:\project\nobi-photos`，没有连接生产数据库或修改其他 NOBI 项目。

## 功能结果

| 项目            | 交付                                                                                                                         |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 统一图标        | 以现有 `public/favicon.svg` 为唯一来源，生成 Android 各密度、圆形、自适应和单色图标，以及 iOS 1024×1024 无 Alpha 图标        |
| Android 离线 AI | 随包 MobileNet V2 UINT8 模型，独立 LiteRT 1.4.2 CPU 推理；首次校验模型 SHA-256 和张量结构，不依赖 Play Services 或运行时下载 |
| iOS 离线 AI     | PhotoKit 本地预览与 Apple Vision `VNClassifyImageRequest`；禁止 PhotoKit 网络读取                                            |
| 整理流程        | 分类页主动分析 → 六主题白名单与 0.55 阈值 → 默认不勾选的建议 → 预览名称/数量 → 确认后保存本地相册                            |
| 合并策略        | 创建或合并 `user:smart:<topic>`，保留已有成员和改名、收藏及手动标签；原生整批 SQLite 事务写入                                |
| 生命周期        | 最新 500 张上限，取消与进度；后台、离页、扫描、权限/索引变化清空内存建议；保存前复查可访问范围                               |
| 首次连接稳定性  | iOS 等待恢复前台后返回授权结果；空图库刷新期间保留已打开的用途说明，加载中禁止重复连接/扫描；DOM 回归测试覆盖                |
| iOS 容器        | 内置页面、原生照片桥接、SQLite、离线 AI、安全区、隐私清单、共享构建/测试 scheme 与 CI                                        |

六主题：宠物与动物、美食与饮品、自然与风景、城市与建筑、交通与出行、文档与屏幕。每张最多分配一个最强匹配主题；不匹配或低评分跳过。评分不是准确率保证，Apple Vision 和 MobileNet 输出可能不同。浏览器仅提供明确标记的预设流程演示。

未增加账号、照片上传、云端 AI、模型联网下载、后台扫描服务或原图删除。只保存本应用相册关系；SQLite schema 保持 v2。自然语言语义搜索、OCR、人脸身份识别不属于本轮实现。

## 检查与原生回归

| 检查                                   | 实际结果                                                                                                                        |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| ESLint / TypeScript                    | 通过                                                                                                                            |
| Vitest                                 | 16 文件、81 项全部通过；以 `--maxWorkers=1` 完整重跑，包含用途说明在空图库刷新期间保持打开的回归测试                            |
| Playwright                             | 桌面/移动 16 项全部通过，含建议勾选、预览与确认保存                                                                             |
| Web build / Capacitor sync / cap:check | 通过，两平台同步                                                                                                                |
| Android Gradle                         | Debug 构建成功；照片插件 lint 无问题，app lint 为 0 errors / 12 warnings                                                        |
| Android 基础回归                       | 系统拒绝/完整授权、101 张合成图分页、原生 SQLite/JPEG 缩略图、收藏、相册、标签、相似建议                                        |
| Android Phase 4 回归                   | 两张批量标签与组合搜索、后台隐藏/返回恢复、飞行模式断网冷启动、撤销权限清除索引及标签                                           |
| Android AI 实测                        | 飞行模式且 Wi-Fi 关闭，公开鹦鹉图模型输出 `macaw: 0.99609375`；UI 确认相册后 SQLite 成员存在，进程冷启动后相册与 102 张索引恢复 |
| iOS CI                                 | macOS 模拟器编译、2 项真实 XCUITest（0 failures）、arm64 无签名归档全部通过；最终 Web / Android / iOS 三作业均成功              |

Android AI 图库只有 101 张生成图片与 1 张公开 Google Coral 参考图，不读取私人照片。结果见 [AI JSON](validation/android-api34-phase5-ai-result.json)、[基础与 Phase 4 回归 JSON](validation/android-api34-phase5-regression-result.json)、[相册截图](screenshots/native-phase5-ai-albums.png)。现有物理 Android 手机本轮未连接，没有声称已安装 0.5.0。

本机并行测试曾发生 worker 启动超时，串行重跑后完整通过；模拟器启动曾弹出系统 UI 无响应，选择等待后从头重跑完整原生回归成功。浏览器复验使用独立 4397 端口，未停止占用 4173 的服务；本地网络沙箱拒绝回环访问后，在允许本地网络的环境重跑同一套测试。未跳过断言、未降低识别阈值。这些结果不作为设备性能/能耗证明。Android lint 剩余警告为工具版本提示、旧启动图资源、未使用资源等，未声称零警告。

## Android 交付包

- `artifacts/android-0.5.0/NOBI-Photos-0.5.0-debug.apk`，36,998,362 bytes。
- SHA-256：`d79b32a152bca99559ec3d1d3eab257586460c7751cd12c4d6dcd79539766c49`。
- app ID `app.nobi.photos`；versionName 0.5.0 / versionCode 6；minSdk 24 / targetSdk 36；四种 ABI。
- Android Debug 签名验证通过；非商店发布签名。
- 包内 37 项 Web 资源与 dist 哈希一致；没有远程 `server.url`，桥接日志关闭，禁止备份/迁移。
- 合并清单无 INTERNET、相机、位置、视频、写入照片权限。只含照片读取权限和应用内部 receiver 权限。

包验证记录见 [packaging-result.json](validation/android-phase5-packaging-result.json)。APK 和构建运行目录被 Git 忽略，不上传二进制安装包到源码仓库。

## iOS 构建与交付

最终源码 `99533e0` 的 [Actions 39706558042](https://github.com/xiao7511/nobi-photos/actions/runs/39706558042) 三作业全部成功。Xcode 26.6 / iPhone 17 Pro Simulator 实际执行两项 XCUITest，日志为 `Executed 2 tests, with 0 failures`、`TEST EXECUTE SUCCEEDED` 和 `ARCHIVE SUCCEEDED`。验证系统“Allow Full Access”、107 张照片跨页索引、真实 Vision 调用、SQLite 进程重启后数量一致，以及五页导航、主题开关状态、隐私页与键盘。107 张由 101 张生成图片与 6 张模拟器预置图组成，没有私人照片参与 CI。

结果见 [ios-phase5-result.json](validation/ios-phase5-result.json)。下载 [iOS 模拟器应用、无签名设备归档与日志](https://github.com/xiao7511/nobi-photos/actions/runs/39706558042/artifacts/12395384588)，artifact 15,618,205 bytes，SHA-256 `cfba99e46a484534bca2c0655d7184707bb539a1d76b221478b90b8286da1603`，当前保留至 2027-01-20。

本机另保存于 `artifacts/ios-0.5.0/`，含完整下载 ZIP、`NOBI-Photos-ios-simulator.zip`、`NOBI-Photos-ios-unsigned-archive.zip`、构建/测试日志与 xcresult，下载 SHA-256 已核对一致。[模拟器桌面实拍图标](screenshots/ios-phase5-launcher.png) 已视觉复核；旁边的 NobiUITests Runner 属于 CI 测试工具，不是发布应用的一部分。

联调修复了两项产品生命周期问题：PhotoKit 授权回调早于应用恢复前台时会漏掉首次扫描，空图库刷新又会卸载连接组件、关闭用途说明。最终等待前台后返回授权、保持用途说明挂载并禁用加载期间的重复操作，保留后台扫描保护，新增 DOM 回归测试。测试按 WebKit 的 Switch 语义查询主题、处理延迟的系统授权提示，并使用最新可用 iOS runtime；首次总量不写死为 101，而在读取超过 100 条后严格比较冷启动总量。早期日志管道曾掩盖测试退出码，已加 `set -euo pipefail` 并核读原始日志；早期假绿和失败运行均未作为本次通过证据。

构建方式、artifact 内容和签名步骤见 [iOS 构建说明](IOS-BUILD.md)。无签名 `.xcarchive` 不是可安装 IPA；模拟器 `.app` 不能安装到 iPhone。当前没有 Mac 或 Apple 开发者签名团队，没有进行真机 iPhone 安装、TestFlight 或 App Store 发布。

iOS 测试使用合成图片与系统完整授权，验证实际 PhotoKit / SQLite / Vision 和界面；拒绝、有限照片范围缩减及用户真实照片分类准确率尚未验收。真机性能、能耗、大图库与更多系统版本仍需后续验证。

## 资源与复现

- [模型来源、哈希与许可证](../plugins/photo-library/android/src/main/assets/nobi-ai/MODEL.md)，[固定版本官方模型仓库](https://github.com/google-coral/test_data/tree/104342d2d3480b3e66203073dac24f4e2dbb4c41)。
- Android：先构建 APK，在专用 `nobi_photos_test` / `emulator-5580` 上执行 `NOBI_TEST_PHASE4=1 npm run test:native`，再 `node scripts/native-ai-smoke.mjs`。详情见 README；脚本会清除测试应用数据并临时调整测试 AVD 网络/权限，不用于日常设备。
- iOS：GitHub push 触发 macOS CI，专用临时模拟器只有合成图片；日志与 xcresult 随 artifact 提供。
- 图标：`node scripts/generate-icons.mjs`，无需外部图片生成服务。

照片、相册、收藏、标签继续留在设备，无强制注册。元数据仍未启用应用层加密；本轮不变更已验收的存储边界。完成本轮后等待验收，再推进新阶段。

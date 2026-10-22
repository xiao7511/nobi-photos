# NOBI Photos · Nobi 相册

本地优先、无需注册的移动相册。当前版本 **0.5.0 / Phase 5**：原生照片读取、本地 SQLite 索引、自建相册、手动标签、本地相似照片建议、批量整理、组合搜索，以及主动运行的离线 AI 相册建议。Android、iOS 与网页共用四叶标志。

浏览器保留 12 张随包 SVG 示例；真实照片功能需 Android / iOS 原生应用。二者的数据仓库独立，不混合示例和真实照片。

## 开发与检查

需要 Node.js 24.19+（24.x）、npm 11。Android 使用 Java 21、Android SDK 36；iOS 使用 macOS/Xcode 与 Swift Package Manager。

```sh
npm ci
npm run dev
npm run lint
npm run typecheck
npm run test
npm run build
npm run cap:check
```

开发服务仅监听 `127.0.0.1`。生产预览用 `npm run preview`，浏览器首次完成预缓存后支持离线刷新；原生端不注册 Service Worker，直接使用安装包内资源。

```sh
npx playwright install chromium
npm run test:e2e
```

Windows 已安装 Edge 时可先设置 `$env:NOBI_BROWSER_CHANNEL='msedge'`。浏览器测试需要先构建。

## 原生工程

```sh
npm run build
npm run cap:sync
```

Android（Windows PowerShell，先设置本机 `JAVA_HOME`、`ANDROID_HOME`）：

```powershell
cd android
.\gradlew.bat assembleDebug :nobi-photo-library:lintDebug
```

macOS/Linux 使用 `bash gradlew ...`。Debug APK 位于 `android/app/build/outputs/apk/debug/app-debug.apk`；仅用于开发验收，未制作发布签名。

iOS（macOS）：

```sh
npx cap open ios
xcodebuild -project ios/App/App.xcodeproj -scheme Nobi -configuration Debug -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build
```

原生工程源码随 Git 保存。`cap sync` 重新生成平台依赖配置和 Web 资源，不要直接修改生成的依赖清单。`android/local.properties`、构建目录、凭据、签名和运行数据不入库。GitHub push / pull request 触发 Web 检查、Android 构建及 macOS iOS 构建、原生 UI 测试与无签名设备归档，详见 [iOS 构建说明](docs/IOS-BUILD.md)。

## Phase 2 使用流程

1. 原生端初次启动不请求照片权限，也不扫描；选择“连接并读取照片”。
2. 阅读用途说明，再进入系统授权。支持拒绝、完整或有限照片访问。
3. 授权后扫描本机可访问照片，显示进度，可随时取消。取消时保留上次完整索引。
4. 自动扫描默认关闭；单独开启后，仅在应用打开/返回前台时运行。进入后台会取消扫描并移除界面中的照片与缩略图。
5. 每次加载索引都会核对授权及可访问标识；无权限时清除本地设备索引，有限范围缩小时移除不可访问记录。
6. 收藏、相册关系和手动标签保存在本地 SQLite，不改动系统相册。隐私中心可清除这些元数据与扫描设置，系统原图不受影响。

## Phase 3 使用流程

1. 分类页选择“新建相册”，输入名称并选择照片；支持改名、调整成员与移除相册。移除相册只删除整理关系。
2. 打开照片详情编辑手动标签，以逗号分隔；保存后可在搜索页离线检索。每张照片最多 20 个标签，每个最多 24 个字符。
3. 清理页主动选择“开始本地分析”。每次最多分析最新 500 张可访问照片，可取消；不自动开始。
4. 建议使用缩略图的 dHash、色彩与宽高比比较，可能误判或漏判，不是语义 AI 或重复文件证明。结果与“保留此组”状态仅存在本次内存会话，不提供原图删除功能。

最多 200 个自建相册，名称 1–40 字符；单个相册最多 10,000 个成员。编辑器每次显示前 200 个匹配照片，可搜索缩小范围。浏览器整理示例图片，原生端整理实际授权照片；两者数据独立。

## Phase 4 使用流程

1. 在照片页或搜索结果点击“选择照片”，逐张选择或全选当前结果，每次最多 500 张；筛选范围变化时，自动移除不再可见的选择。
2. 点击“整理所选照片”，批量加入/取消本地收藏、添加/移除指定手动标签，或加入/移出已有自建相册。新相册仍在分类页创建。
3. 查看所选数量与操作，确认后一次性保存。先校验所有照片和标签上限，再以单个 SQLite 事务（浏览器为单次 localStorage 写入）保存；失败不会部分更新。不修改系统相册或原图。
4. 搜索页展开“组合筛选”，组合关键词、日期范围、自建相册、精确手动标签、收藏与横/竖/方图条件。所有条件同时满足；日期包含首尾两天，使用索引日期。多个精确标签用逗号分隔，忽略大小写。
5. 修改筛选后点击“搜索”；结果随当前图库与整理数据更新。条件与选择只在页面内存中，不写入历史记录、网址或数据库，可用“重置搜索”清空。

## Phase 5：离线 AI 智能整理

1. 分类页主动选择“开始智能整理”，每次分析最新 500 张可访问照片，可取消。Android 使用随包 MobileNet V2 / LiteRT，iOS 使用 Apple Vision；不上传照片，不下载运行模型，iCloud 照片预览也不发起网络读取。
2. 仅接收评分至少 0.55 且匹配白名单的主题：宠物与动物、美食与饮品、自然与风景、城市与建筑、交通与出行、文档与屏幕。评分不是正确率保证，两端结果可能不同；不可靠或无法读取的照片会跳过。
3. 勾选建议后预览相册名称与照片数量，再确认保存。默认不勾选、不自动保存；只创建或合并本应用的“智能 · 主题”相册关系，保留已有成员、改名及手动标签，不改动系统相册或原图。
4. 建议仅保留在当前内存中，进入后台、离开页面、扫描或权限范围变化会清理。浏览器提供明确标记的预设演示，不运行图像模型。

模型、标签与许可证说明见 [MODEL.md](plugins/photo-library/android/src/main/assets/nobi-ai/MODEL.md)。本功能是图片分类；自然语言语义搜索、OCR、人脸身份识别尚未接入。SQLite 仍为 v2。

## 功能与边界

- 照片：日期分组、排序、密度切换、缩略预览、本地收藏；原生照片默认“未分类”。
- 分类：自建相册、主动运行的离线 AI 相册建议、浏览器示例分类及原生未分类/收藏集合。
- AI 搜索：本地标题、日期、分类、地点和标签关键词；多个词与组合筛选条件取交集。未接入语义 AI。
- 清理：主动运行本地缩略图相似度分析、进度与取消、逐组保留建议；浏览器另有明确标记的预设示例组。没有原图删除接口。
- 我的与隐私中心：免注册、浅色/深色/跟随系统、照片权限、扫描控制、本地数据管理。
- 仅支持图片索引，不导入视频。iOS 不读取原图文件大小；云端未下载缩略图可能不可用。

## 数据与扫描架构

```text
plugins/photo-library/       自有只读 Capacitor 插件（Java / Swift）
android/                    Android 容器与权限/备份策略
ios/                        iOS 容器与照片用途声明、SPM
src/native/                 平台识别、类型化原生桥接协议
src/db/                     SQLite v1、v2 迁移、原生连接、索引仓库
src/services/scanEngine.ts   快照分页、进度、取消、提交/丢弃状态机
src/services/similarity.ts   本地视觉指纹与非传递式建议分组
src/domain/organization.ts  相册与标签约束、仓库接口
src/domain/batchEdit.ts     批量整理计划、全量校验与事务适配
src/domain/smartOrganization.ts  AI 主题白名单、阈值与相册合并计划
src/stores/smartOrganization.ts  主动分析、取消、权限复查与内存建议
src/composables/            页面内照片选择、筛选与权限变动时清理
src/stores/                 Pinia、权限/前台状态、索引访问校验
src/components/             授权说明、扫描控制、按需缩略图
```

原生 SQLite 使用 `@capacitor-community/sqlite` 8，数据库名固定为 `nobi_photos`，迁移版本 2；不接受外部数据库地址。v1 已包含相册、成员关系和标签表，Phase 3 直接使用，不增加迁移版本。v2 增加修改时间、文件大小是否已知、扫描会话/暂存和本地设置。

扫描先在原生端取得照片标识快照，每批最多 100 条元数据写入暂存表。完整扫描经最终权限核对后，在单个事务中 upsert、保留存续照片的收藏、相册关系和标签，并移除不再存在的索引。取消/失败不提交；重启会清理中断暂存。这里的删除仅针对 SQLite 元数据。

缩略图按可见区域请求，最大约 256 像素预览，JPEG data URL 只在组件内存中使用，不入库、不写缩略图磁盘缓存。iOS PhotoKit 明确设置 `isNetworkAccessAllowed=false`，不请求云端原图数据；Android 仅查询 MediaStore 图片，不读取 EXIF/GPS。

## 隐私与安全

无账号、遥测、广告、云端 AI、上传、云同步、自动原图删除或后台扫描服务。照片权限仅由用户主动触发；没有相机、位置、视频或写入照片权限。Android 合并清单移除 INTERNET 及无关生物识别权限，禁止应用备份/设备迁移；iOS SQLite 放在排除备份的 `Library/NoCloud`。

本地元数据**未启用应用层加密**，不是加密保险箱；应使用系统锁屏。原生索引清除不会撤销系统照片授权或清除外观偏好；可在系统设置中撤销权限。浏览器数据清理见隐私中心。

Capacitor 桥接日志关闭，避免调试日志输出照片元数据或 SQL 参数。相似度分析只读取本地预览，视觉指纹不持久化；进入后台时取消分析并清空结果。

安装依赖和构建工具可能需要联网；应用照片流程不依赖网络。没有连接生产数据库，也没有操作其他 NOBI 项目。

## 验收

代码已同步到 [GitHub](https://github.com/xiao7511/nobi-photos)。用户另外授权的云端新增业务基础库部署见 [腾讯云部署报告](docs/CLOUD-DEPLOYMENT.md) 与 [独立 Supabase Postgres 运维说明](deploy/supabase/README.md)。设备照片元数据仍在本地，尚未接入云端业务 API。

- [Android APK 打包与联调验证](docs/ANDROID-PACKAGING-VALIDATION.md)
- [Phase 5 图标、离线 AI 与 iOS 验收报告](docs/PHASE5-ACCEPTANCE.md)
- [iOS 构建、模拟器测试与签名说明](docs/IOS-BUILD.md)
- [Android 真机版面与独立运行环境（0.4.1）](docs/ANDROID-PHONE-VALIDATION.md)
- [Phase 4 验收报告](docs/PHASE4-ACCEPTANCE.md)
- [Phase 3 历史报告](docs/PHASE3-ACCEPTANCE.md)
- [Phase 2 历史报告](docs/PHASE2-ACCEPTANCE.md)
- [原生真机验证清单](docs/NATIVE-TEST-MATRIX.md)
- [Phase 1 历史报告](docs/PHASE1-ACCEPTANCE.md)

当前 Windows 环境已在专用 Android 14 AOSP 模拟器上实际验证系统拒绝/完整授权、101 张合成图片分页读取、SQLite、缩略图、收藏、相册、标签和相似建议；0.5.0 另以公开鹦鹉图片验证飞行模式下的真实模型识别、确认保存相册与冷启动恢复。iOS 已使用 GitHub macOS runner 构建并运行原生 UI 测试。验证范围与剩余限制见最新验收报告。每个阶段交付后停止，等待验收。

### 重跑原生冒烟验证

先构建 APK，再启动名为 `nobi_photos_test` 的专用 Android 14 / API 34 AOSP AVD（默认 serial 为 `emulator-5580`），执行 `npm run test:native`。可通过 `NOBI_TEST_SERIAL`、`NOBI_TEST_APK` 指定该测试模拟器和 APK。脚本会核对模拟器名称，拒绝其他设备；向其写入 101 张合成图片，安装应用并清除该模拟器中的 `app.nobi.photos` 测试数据，然后实际操作系统权限弹窗。不要在该 AVD 存放私人数据。结果与截图写入被 Git 忽略的 `artifacts/native-test/`。

此脚本使用 ADB、Debug WebView 与本机 9225 端口，需要 Android SDK 和专用模拟器；不用于物理设备，也不替代完整原生测试矩阵。

Phase 4 扩展场景：设置 `$env:NOBI_TEST_PHASE4='1'` 后运行 `npm run test:native`，额外执行原生批量标签、组合搜索、切后台/返回、飞行模式下进程冷启动，以及撤销照片权限后的索引清理。脚本在专用模拟器中临时切换飞行模式、撤销本应用的照片权限，结束时恢复飞行模式关闭；不能用于日常设备。

资源受限主机建议将专用 AVD 渲染设为 540×1200 / density 210 并关闭动画；该配置保持相同逻辑宽度。原生冷启动等待上限 90 秒，不代表产品启动性能验收标准。当前已实际通过的原生子集与未执行场景见最新报告和矩阵。

Vitest 默认最多两个 worker，以便与原生模拟器共存；没有跳过测试或降低校验规则。

Phase 5 AI 原生验证：先在同一专用 AVD 完成基础脚本，再运行 `node scripts/native-ai-smoke.mjs`。脚本增加一张公开 Google Coral 鹦鹉测试图，实际运行断网模型、确认保存与 SQLite 重启恢复；仅允许 `emulator-5580` / `nobi_photos_test`。测试图库不能存放私人数据。图标可用 `node scripts/generate-icons.mjs` 从 `public/favicon.svg` 重新生成。

参考：[Capacitor Android 插件](https://capacitorjs.com/docs/plugins/android)、[iOS 插件](https://capacitorjs.com/docs/plugins/ios)、[Android 有限照片访问](https://developer.android.com/about/versions/14/changes/partial-photo-video-access)、[SQLite 插件](https://github.com/capacitor-community/sqlite)。

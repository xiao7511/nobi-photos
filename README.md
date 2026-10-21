# NOBI Photos · Nobi 相册

本地优先、无需注册的移动相册。当前版本 **0.2.0 / Phase 2**：原生照片读取、本地 SQLite 索引与可选前台自动扫描。

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
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build
```

原生工程源码随 Git 保存。`cap sync` 重新生成平台依赖配置和 Web 资源，不要直接修改生成的依赖清单。`android/local.properties`、构建目录、凭据、签名和运行数据不入库。CI 已配置 Web 检查、Android 构建和 macOS iOS 编译作业；本地提交不会自动触发远程 CI。

## Phase 2 使用流程

1. 原生端初次启动不请求照片权限，也不扫描；选择“连接并读取照片”。
2. 阅读用途说明，再进入系统授权。支持拒绝、完整或有限照片访问。
3. 授权后扫描本机可访问照片，显示进度，可随时取消。取消时保留上次完整索引。
4. 自动扫描默认关闭；单独开启后，仅在应用打开/返回前台时运行。进入后台会取消扫描并移除界面中的照片与缩略图。
5. 每次加载索引都会核对授权及可访问标识；无权限时清除本地设备索引，有限范围缩小时移除不可访问记录。
6. 收藏保存在本地 SQLite，不改动系统相册收藏。隐私中心可清除本地索引、收藏和扫描设置，系统原图不受影响。

## 功能与边界

- 照片：日期分组、排序、密度切换、缩略预览、本地收藏；原生照片默认“未分类”。
- 分类：浏览器示例分类及原生未分类/收藏集合。
- AI 搜索：本地标题、日期、分类、地点和标签关键词；多个词取交集。未接入语义 AI。
- 清理：浏览器预设示例组；原生端尚无相似度算法。没有原图删除接口。
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
src/stores/                 Pinia、权限/前台状态、索引访问校验
src/components/             授权说明、扫描控制、按需缩略图
```

原生 SQLite 使用 `@capacitor-community/sqlite` 8，数据库名固定为 `nobi_photos`，迁移版本 2；不接受外部数据库地址。v1 模型保留，v2 增加修改时间、文件大小是否已知、扫描会话/暂存和本地设置。

扫描先在原生端取得照片标识快照，每批最多 100 条元数据写入暂存表。完整扫描经最终权限核对后，在单个事务中 upsert、保留已有收藏并移除不再存在的索引。取消/失败不提交；重启会清理中断暂存。这里的删除仅针对 SQLite 元数据。

缩略图按可见区域请求，最大约 256 像素预览，JPEG data URL 只在组件内存中使用，不入库、不写缩略图磁盘缓存。iOS PhotoKit 明确设置 `isNetworkAccessAllowed=false`，不请求云端原图数据；Android 仅查询 MediaStore 图片，不读取 EXIF/GPS。

## 隐私与安全

无账号、遥测、广告、云端 AI、上传、云同步、自动原图删除或后台扫描服务。照片权限仅由用户主动触发；没有相机、位置、视频或写入照片权限。Android 合并清单移除 INTERNET 及无关生物识别权限，禁止应用备份/设备迁移；iOS SQLite 放在排除备份的 `Library/NoCloud`。

本地元数据**未启用应用层加密**，不是加密保险箱；应使用系统锁屏。原生索引清除不会撤销系统照片授权或清除外观偏好；可在系统设置中撤销权限。浏览器数据清理见隐私中心。

安装依赖和构建工具可能需要联网；应用照片流程不依赖网络。没有连接生产数据库，也没有操作其他 NOBI 项目。

## 验收

- [Phase 2 验收报告](docs/PHASE2-ACCEPTANCE.md)
- [原生真机验证清单](docs/NATIVE-TEST-MATRIX.md)
- [Phase 1 历史报告](docs/PHASE1-ACCEPTANCE.md)

当前 Windows 环境已完成 Android 编译验证；iOS 编译及真实设备权限/缩略图流程需按报告补验。Phase 2 交付后停止，等待验收，不自动推进下一阶段。

参考：[Capacitor Android 插件](https://capacitorjs.com/docs/plugins/android)、[iOS 插件](https://capacitorjs.com/docs/plugins/ios)、[Android 有限照片访问](https://developer.android.com/about/versions/14/changes/partial-photo-video-access)、[SQLite 插件](https://github.com/capacitor-community/sqlite)。

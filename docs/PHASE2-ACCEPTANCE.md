# NOBI Photos · Phase 2 交付与验收报告

日期：2026-10-21（Asia/Shanghai）。版本：0.2.0。基线：Phase 1 提交 `c6c7892`，开始开发时工作区干净。

后续补验：Phase 3 已在专用 Android 14 模拟器完成系统拒绝/完整授权与原生读取流程。以下保留 Phase 2 交付当时的记录；最新结果与剩余限制见 [Phase 3 报告](PHASE3-ACCEPTANCE.md)。

**交付状态：Phase 2 代码、Android Debug APK 与自动化检查已完成；iOS 编译和真实设备运行验收待执行。** 不把桥接 mock 或浏览器测试视为系统照片权限真机验证。未推进下一阶段。

## 实现范围

| 项目         | 实现                                                                                                      |
| ------------ | --------------------------------------------------------------------------------------------------------- |
| 原生容器     | Android / iOS 工程，Capacitor 8，iOS SPM                                                                  |
| 只读照片插件 | 自有 `@nobi/photo-library`，Android Java + MediaStore，iOS Swift + PhotoKit                               |
| 权限流程     | 初次启动不请求；用途说明后二次操作触发系统授权；完整/有限/拒绝状态；系统设置入口                          |
| 本地数据库   | Capacitor Community SQLite 8；数据库 `nobi_photos`；v1→v2 迁移                                            |
| 照片扫描     | 原生标识快照；每批 100 条；进度、取消、错误与完成状态                                                     |
| 原子索引     | 暂存表；完整扫描后单事务提交；保留收藏；取消/失败保留上次索引；重启清理中断暂存                           |
| 自动扫描     | 默认关闭，单独开启；仅启动/返回前台时扫描；进入后台取消并清空界面照片                                     |
| 权限变化     | 每次显示索引前复查；按 200 个标识核对当前可访问照片；移除失效元数据；拒绝时清空设备索引                   |
| 缩略图       | 可见区域按需获取，JPEG data URL 仅保存在组件内存；iOS 禁止 PhotoKit 网络下载                              |
| UI 接入      | 连接说明、扫描进度/取消、自动扫描开关、隐私中心索引清理；原生照片与浏览器示例分离                         |
| 隐私边界     | 无上传、云 AI、原图删除、后台服务、账号、GPS/EXIF/相机权限；Android 无网络权限、禁止备份；iOS DB 排除备份 |

本阶段只读图片，不读取视频。原生照片默认未分类，未接入语义 AI、相似度算法或真实空间清理。iOS 文件大小标记为未知，不下载原图以获取大小。

## 实际执行的验证

| 验证                   | 结果                                                                                      |
| ---------------------- | ----------------------------------------------------------------------------------------- |
| `npm run lint`         | 通过，0 错误、0 警告                                                                      |
| `npm run typecheck`    | 通过                                                                                      |
| `npm run test`         | 6 文件、37 项通过                                                                         |
| `npm run build`        | 通过；浏览器 PWA 预缓存 45 项，约 256 KiB                                                 |
| `npm run cap:sync`     | Android / iOS 识别并同步 SQLite、App 生命周期、自有照片插件                               |
| `npm run cap:check`    | 本地目录、备份与只读照片配置检查通过                                                      |
| 浏览器端到端           | 通过；桌面/手机完整流程、离线刷新和 Phase 2 浏览器权限边界，共 6 项                       |
| Android 构建           | Java 21 + SDK 36，`:app:assembleDebug` 成功，版本 0.2.0                                   |
| Android 插件 lint      | `:nobi-photo-library:lintDebug` 成功，报告 `No issues found.`                             |
| 合并 Manifest 人工检查 | 仅图片读取与应用自身签名权限；无 INTERNET、生物识别、相机、位置、视频、写入权限；备份关闭 |
| 依赖审计               | `npm audit` 通过，0 个已报告漏洞                                                          |

37 项测试包含：本地数据与隐私边界、真实内存 SQLite 迁移/约束/事务、提交中途失败回滚、收藏跨扫描保留、空相册、取消、读取/写入/提交失败、权限改变、重复扫描防护、失效游标、有限授权范围校验、401 个标识分批校验、自动扫描设置失败、后台后的迟到加载结果丢弃。

Web 端到端测试检查：无外部主机请求、无页面脚本错误、收藏与主题刷新恢复、离线导航、浏览器不显示原生授权按钮或自动扫描开关。它们不覆盖设备系统弹窗。

Gradle 输出了模板 flatDir、弃用特性、SDK 元数据版本与权限移除声明的提示；不影响构建。已修复首次 Android 编译中的 AppCompat 依赖缺失，并避免旧系统不支持的日期 API。

## 交付物

应用级 `:app:lintDebug` 也已通过，0 错误、14 个模板资源/工具版本提示（启动图密度、未使用资源、单色图标和 Gradle 小版本更新）；照片插件 lint 无问题。未通过关闭检查隐藏这些提示。

- 源码：`android/`、`ios/`、`plugins/photo-library/`、`src/native/`、`src/db/`、扫描状态机与 UI。
- Debug APK：`android/app/build/outputs/apk/debug/app-debug.apk`；便利副本位于 `artifacts/NOBI-Photos-0.2.0-debug.apk`。构建物不纳入 Git。
- 设备验收步骤：[NATIVE-TEST-MATRIX.md](NATIVE-TEST-MATRIX.md)。
- CI 增加 Android 构建和 macOS iOS 编译作业；本次仅本地提交，未推送或触发远程 CI。

## 尚未验证与限制

1. `adb devices` 没有连接设备，且没有现成 AVD，因此没有安装到 Android 设备/模拟器验证系统授权、真实 MediaStore、WebView 缩略图或原生 SQLite 驱动的运行行为。
2. 当前主机为 Windows，无 Xcode；iOS Swift/PhotoKit 代码与工程已交付，但未编译、未签名、未跑模拟器/真机。
3. JS mock 校验了扫描和权限状态机；内存 SQLite 验证了 SQL 与事务；均不能代替上述平台集成验收。
4. 自动扫描是可选前台扫描，不包含持续后台扫描服务、定时后台任务或完整媒体变更监听。
5. 本地元数据未启用应用层加密。所有真实照片流程需在专用测试相册上按矩阵补验后，再认定原生功能正式验收通过。
6. Debug APK 使用开发签名，不能作为商店发布包；未提供发布签名、商店发布或生产连接。

## 项目与隐私范围

全部源码和工程改动位于 `D:\project\nobi-photos`。只下载了开发/构建依赖，未读取用户私人照片，未修改其他 NOBI 项目，未连接生产数据库。系统照片的修改/删除 API 未实现；清除与失效清理只操作本应用的 SQLite 元数据。

参考：[Android 有限照片访问](https://developer.android.com/about/versions/14/changes/partial-photo-video-access)、[Capacitor Android 插件](https://capacitorjs.com/docs/plugins/android)、[Capacitor iOS 插件](https://capacitorjs.com/docs/plugins/ios)、[SQLite 插件](https://github.com/capacitor-community/sqlite)。

**本次停在 Phase 2 交付与原生设备验收边界，等待验收，不自动启动后续阶段。**

# NOBI Photos · Phase 6 验收报告

日期：2026-10-22（Asia/Shanghai）。版本：0.6.0 / build 7。基线 `3bc1851`，应用源码 `b7e49ebb1532eb0671bf3d7f7b5f6223bf6e874d`。

本轮只修改 `D:\project\nobi-photos`，实现用户要求的照片大图界面、整理相册原图浏览与 AI 相册标题修改。未连接生产数据库，未操作其他 NOBI 项目，也未安装到或改动用户真实手机的照片、收藏与标签。

## 功能验收

| 用户要求 | 结果 |
| --- | --- |
| 点击照片后的页面突出照片 | 全屏暗色画布，完整显示照片；移除默认展示的标题、地点、日期、英文装饰和隐私说明。默认只显示关闭、收藏、标签入口、页码、清晰度与浏览操作，标签表单按需展开 |
| 整理后的相册高清原图浏览 | 所有照片列表、分类、收藏、自建与 AI 相册共用查看器。按需读取本机原始资源，支持放大、滚动查看细节、双击、上一张/下一张、左右滑动、方向键与系统返回退出 |
| AI 自建相册修改标题 | 打开相册后点击“修改名称”，独立对话框保存 1–40 字名称；只更新名称，不替换相册成员。稳定 ID 保持不变，再次智能整理保留用户名称 |

查看器照片区域在 Android 纵向测试中占弹出界面高度约 **86.3%**；浏览器桌面和移动尺寸均检查超过 76%、宽度超过 95%。横竖照片保持比例完整显示，黑边取决于照片与屏幕比例，不裁掉内容。按钮触控区域为 44×44 CSS 像素。

浏览器继续展示随包示例插画，明确标记“示例插画”；不会将示例或缩略图宣称为真实原图。原生端只有原图成功解码后才显示“原图”，读取/格式失败保留可用预览并提示重试。

## 原图与隐私边界

- Android 只读 MediaStore 输入流，iOS 使用 PhotoKit 原始照片资源，明确设置 `isNetworkAccessAllowed=false`。不主动下载 iCloud 照片，不上传，不调用云端 AI。
- 不重新压缩或写回照片。Android 系统可能在未申请位置权限时处理 EXIF，因此“原始资源”指当前系统授权可读取的原图；不会为了取得位置元数据扩大权限。
- 每次浏览仅保留当前照片的私有临时文件，路径与图片字节不进入 SQLite/localStorage。关闭、切换或进入后台时释放，取消后晚到的结果也会释放；异常退出的残留下次启动清理。iOS 临时文件排除备份并启用完整文件保护。
- 64 百万像素、80 MiB 上限；超限、未下载到本机的云端资源、RAW 或设备不支持的格式会提示，不回退成伪原图。动态照片的视频部分不在本轮范围内。
- 相册改名使用独立的本地名称更新，SQLite 不删除或重建成员关系；原有收藏、标签与系统相册不变。无需注册，仍支持离线使用。

实现参考：[Apple 本地资源读取选项](https://developer.apple.com/documentation/photos/phassetresourcerequestoptions/isnetworkaccessallowed)、[Capacitor 本地文件 URL 转换](https://capacitorjs.com/docs/basics/utilities)。这些链接说明底层 API；以下测试记录才是本项目的实际验证证据。

## 已完成验证

| 检查 | 结果 |
| --- | --- |
| ESLint / TypeScript / Vitest / Vite build / cap:check | 通过；85 项单元测试、17 个文件 |
| Playwright | 桌面与手机尺寸共 18 项通过；含全屏占比、按需标签、放大、连续浏览、焦点恢复、改名持久化与再次智能合并保留名称 |
| Android assembleDebug / app lint / plugin lint | 通过；应用 lint 0 错误、12 项已有资源/工具警告，自定义照片插件无问题 |
| Android 本轮原生回归 | 系统拒绝/完整授权、101 张合成照片跨页索引、SQLite、收藏、相册、标签、相似建议、批量整理、组合搜索、后台/返回、断网冷启动和撤权索引清理通过 |
| 最终 APK 的公开图片验证 | 飞行模式且 Wi-Fi 关闭，真实 MobileNet 识别，AI 相册改名后成员数量不变，重启后名称保留；512×929 原图完整像素与公开源图一致 |
| 最终 APK 的 12 MP 验证 | 4032×3024 合成 PNG 显示尺寸与原文件 SHA-256 完全一致；放大滚动、连续切换、关闭与正在读取时释放的缓存清理通过 |

原生回归在本轮功能实现后执行；最终包另执行原图与 AI 改名测试，并核对所有内置网页资源与最终 `dist` 哈希一致。没有使用私人照片。证据：

- [原图、离线 AI 与改名结果](validation/android-phase6-original-and-ai-result.json)
- [4032×3024 原图验证](validation/android-phase6-hd-result.json)
- [最终 APK 包体核验](validation/android-phase6-packaging-result.json)
- [原图查看器截图（公开鹦鹉图）](validation/android-phase6-original.png)
- [12 MP 查看器截图（合成图）](validation/android-phase6-hd.png)

公开 JPEG 的系统可读文件哈希与测试源文件不同，但 **512×929 全部解码像素 SHA-256 相同**；12 MP PNG 则文件字节哈希也相同。两种检查共同排除了只放大 256 像素缩略图的实现。来源沿用 [公开测试图说明](../tests/fixtures/ai/README.md)。

## Android 安装包

`artifacts/android-0.6.0/NOBI-Photos-0.6.0-debug.apk`，37,060,632 bytes，SHA-256：

```text
ec1da4b61bb6287599f5638fd092e073ccf7eb48fdeb1646fe85f4f106793d74
```

包名 `app.nobi.photos`，版本码 7，min SDK 24 / target SDK 36，四种 ABI，Android Debug v2 签名。已核对无 INTERNET/位置/相机/写相册权限、禁止备份/设备迁移、无远程网页服务、桥接日志关闭，37 个内置网页文件全部与最终构建一致。可用于后续手机更新联调；本轮没有声称已更新用户手机。

## iOS 验证与交付

源码 `b7e49eb` 对应 [GitHub Actions 39797854518](https://github.com/xiao7511/nobi-photos/actions/runs/39797854518)。verify 与 Android 作业成功，iOS 原生编译、两项 XCUITest、无签名 arm64 设备归档和上传步骤均返回 success。原始日志确认 `Executed 2 tests, with 0 failures`、`TEST EXECUTE SUCCEEDED` 与 `ARCHIVE SUCCEEDED`，Xcode 26.6 / iOS 26.5 / iPhone 17 Pro Simulator。

iOS 测试图库为 101 张 768×512 合成 PNG 及 runner 预置图片；测试实际打开 PhotoKit 本机原图、缩放与前后切换，再执行 Vision、SQLite 冷启动和五页/主题/隐私/键盘测试。保留此前跨 100 条分页与重启数量一致的断言。

实际索引 107 张，含 6 张模拟器预置图片。详见 [iOS 本轮记录](validation/ios-phase6-result.json)。[iOS 产物与日志](https://github.com/xiao7511/nobi-photos/actions/runs/39797854518/artifacts/12435601456) 为 15,813,612 bytes，SHA-256 `2b8b9d2fb78885b6f2bc296582587cceae0cc9b55f314bd80e91cb187d39c1a9`，当前保留至 2027-01-20。内容包括模拟器应用、无签名设备归档、xcresult 与构建/测试日志。

已下载至 `artifacts/ios-0.6.0/NOBI-Photos-0.6.0-ios-validation.zip`，本地 SHA-256 与 Actions artifact 一致，并解压核对模拟器应用包、设备归档和两份原始构建日志、测试日志及 xcresult 均存在。

暂无 Mac、Apple 开发者签名团队及真机 iPhone；无签名归档和模拟器应用不等于可安装 IPA。更多照片格式、超大图库、真机性能与 iOS 有限授权范围缩减仍需后续验证。

## 复现与阶段边界

网页：`npm run lint`、`npm run typecheck`、`npm run test`、`npm run build`、`npm run test:e2e`。原生构建：`npx cap sync` 后执行 Android Gradle 检查；iOS 由 macOS CI 执行真实编译、XCUITest 与无签名设备归档。

专用 Android `nobi_photos_test` / `emulator-5580`：先运行 `NOBI_TEST_PHASE4=1 npm run test:native`，再 `node scripts/native-ai-smoke.mjs`。脚本仅允许测试 AVD，使用合成/公开图片；会修改该测试应用的数据和测试权限。AI 脚本已将扫描入口固定到隐私页，以便已有索引时也能重跑，避免等待会自动收起的空图库连接栏。

本轮完成后等待验收，不自动开展新阶段、照片上传或原图删除。

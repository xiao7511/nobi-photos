# iOS 开发、构建与验证

版本 0.9.0 / build 10，bundle ID `app.nobi.photos`。iOS 原生工程使用 Capacitor 8、Swift Package Manager、本地 PhotoKit / SQLite 与 Apple Vision，无需注册或云端业务 API。

## 当前交付

- 完整原生容器与内置 Web 资源；不依赖电脑上的 Vite 服务。
- 只读 PhotoKit 桥接：授权、分页索引、本地缩略图、可访问范围复核，`isNetworkAccessAllowed=false`。
- 本地原图资源流式读取：64 百万像素/80 MiB 上限，临时缓存排除备份，关闭、切换或后台清理；全屏适应、缩放、连续浏览。不下载 iCloud 资源。
- SQLite 使用 `Library/NoCloud`，本地收藏、标签、相册与成员关系复用 schema v2。
- 主动使用 `VNClassifyImageRequest` 做离线分类，建议经选择与确认后保存；不做人脸身份识别。
- 与网页一致的 1024×1024、无 Alpha AppIcon，安全区布局及隐私清单。
- 共享 scheme `Nobi` 包含应用和 `NobiUITests`。CI 在临时 iPhone 模拟器中写入 101 张合成图片（另外可能有系统自带图片），验证 PhotoKit 跨 100 条分页、SQLite 冷启动数量一致、真实 Vision 调用、五页导航、主题、隐私页与键盘。

## 无 Mac 时的构建

推送源码后打开 [GitHub Actions](https://github.com/xiao7511/nobi-photos/actions/workflows/ci.yml)，查看 `ios` 作业。执行步骤在 [ci.yml](../.github/workflows/ci.yml)：构建模拟器应用与测试、运行两项 XCUITest、归档无签名 arm64 设备应用。

成功后下载 `ios-simulator-and-validation` artifact：

| 文件                                                    | 用途                                                  |
| ------------------------------------------------------- | ----------------------------------------------------- |
| `NOBI-Photos-ios-simulator.zip`                         | 解压后为模拟器 `App.app`，不能安装到 iPhone           |
| `NOBI-Photos-ios-unsigned-archive.zip`                  | 无签名 `.xcarchive`，用于后续签名导出；不是可安装 IPA |
| `ios-build.log`、`ios-test.log`、`ios-device-build.log` | 构建、测试和归档日志                                  |
| `ios-ui.xcresult`                                       | Xcode 测试结果和合成图库截图                          |

Artifact 下载通常需要登录 GitHub，并受 Actions 保留期限限制。源码与 CI 配置长期保留，过期后可重新推送触发构建。

## macOS 本地重跑

安装支持项目部署目标的 Xcode 和 iPhone Simulator、Node.js 24.x / npm 11，然后：

```sh
npm ci
npm run build
npx cap sync ios
npx cap open ios
```

选择共享 `Nobi` scheme 与模拟器。普通编译无需照片测试图库：

```sh
xcodebuild -project ios/App/App.xcodeproj -scheme Nobi -configuration Debug -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build
```

重跑 UI 测试请按 CI 步骤使用专用空白模拟器、写入 101 张合成图片，并为 `app.nobi.photos` 预授予照片权限。XCTest 重新安装目标时可能重置授权，测试会通过应用用途说明和系统“允许完全访问”流程重新连接；拒绝与有限授权缩减仍需补验。不能把现有私人图库当作测试夹具。

## iPhone 安装与发布

当前没有可用 Mac 或 Apple 开发者团队，本轮不制作签名 IPA、不安装物理 iPhone、不上传 TestFlight / App Store。后续在有 Xcode 的 Mac 中设置自己的开发者 Team、唯一 bundle ID 与 provisioning profile，对 Release archive 签名导出，再按团队分发渠道安装。不要将证书私钥、账户密码、签名文件或 provisioning profile 提交到仓库。

模拟器验证不能覆盖真机性能、能耗、真实相机图库规模、有限照片授权缩减或所有 iOS 版本。签名前还应补齐这些验收，并按实际发布功能填写 App Store 隐私信息。

0.8.0 的照片仍离线处理；仅在主动开启分类配乐后播放官方 HTTPS 录音。原图轮播最多同时保留两个受保护、排除备份的临时文件，滑动结束后释放上一张。

0.9.0 增加扇形相册、可选在线曲目和系统文件选择器的本机音频入口。本机音频为当前会话选择，不读取 Apple Music 的受保护曲库。原生 UI 回归增加从列表选择曲目后播放的验证。

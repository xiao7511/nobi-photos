# Phase 9：扇形相册与可选背景音乐

版本 **0.9.0**，Android versionCode **10**，iOS build **10**。2026-10-24 完成开发、安卓手机覆盖更新与复核。

## 交付行为

- 整理后的自建相册与分类相册使用扇形封面；进入相册默认展示扇形照片卡片，支持左右滑动、前后按钮和键盘切换。一次最多渲染五张缩略图，点击中间照片打开高清原图，仍可切换回网格。原有平滑全屏轮播、缩放、相册改名和批量整理继续可用。
- 相册页和原图浏览页提供“选择背景音乐”。支持按分类推荐、手动选择四首在线曲目，以及通过系统文件选择器选择单首本机音频。选曲仅在当前应用会话保留，默认不播放；返回照片后主动开启配乐。
- 在线列表为 Dream Culture、Life of Riley、Carefree、Long Stroll，均来自 Kevin MacLeod 官方 Incompetech 录音，显示作者和 CC BY 4.0。曲库、来源及许可见 [MUSIC-LICENSES.md](MUSIC-LICENSES.md)。
- 本机支持 mp3、m4a、aac、wav、ogg、flac，单首最多 100MiB，实际解码能力依设备而定；拒绝空文件、超限文件和非音频类型。选取失败保留之前的选择；更换或移除后撤销旧 blob URL。关闭照片、进入后台会停止播放并释放照片原图缓存。

本机音乐通过系统授权选择文件，不读取其他播放器的私有曲库、会员缓存或 DRM 内容，也不支持任意播放器链接直连。用户可选择系统文件管理可访问的音频，或使用提供的在线曲目列表。此版本没有后台音乐播放服务。

## 隐私与实现边界

照片、原图、相册、标签及收藏继续留在设备；选取的音频文件、路径和文件名不写入 SQLite 或 localStorage，不上传。仅在内存保存本次授权的 File/blob；不扫描音乐目录，不新增 READ_MEDIA_AUDIO、麦克风、位置或写入图库权限。CSP 只新增本地音频所需的 `media-src blob:`，在线音频仍限制在原官方 HTTPS MP3 路径。

选择曲目不会下载或自动播放；主动开启在线音乐才请求固定公开曲目 URL，请求不含私人照片、相册名、查询参数、正文或 Referer。在线服务可能接收到 IP 与设备信息，界面说明流量及网络行为。断网仍可浏览本地照片，并播放当前会话中选择且可解码的本机音频。未连接生产数据库、未改动其他 NOBI 项目。

Android 原生文件选择器存在实际取消事件兼容问题：文件 input 的可信 `cancel` 事件会触发祖先 dialog 的默认关闭行为。最终将 input 通过 Vue Teleport 放在 dialog 外部，同时隔离面板取消状态；真机系统选择器“取消后重试”已在专用模拟器实测，非通过事件替代验证。选曲前关闭原图弹窗，避免系统选择器引发前后台切换时卸载文件 input。

## 验证结果

| 检查                                              | 结果                                                                                                                                                                 |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ESLint / TypeScript / Vite build / Capacitor 检查 | 全部通过                                                                                                                                                             |
| Vitest                                            | 20 文件、97 项通过                                                                                                                                                   |
| 桌面与移动浏览器 E2E                              | 30 项通过；包含扇形五卡上限、键盘焦点、网格切换、原图打开、曲目选择无自动播放、本机 WAV 离线解码和 blob 撤销                                                         |
| Android 构建与 Lint                               | assembleDebug、应用和原生插件 lintDebug 通过                                                                                                                         |
| Android 14 / API 34 原生选曲                      | 实际系统文件选择器取消、再次打开、Downloads 选择测试 WAV、10 秒音频离线解码、后台停止、原图释放、移除后 blob 撤销全部通过；无外部请求                                |
| Android 原生照片回归                              | 103 张公开/合成夹具；高清原图、AI/分类相册、硬件返回、连续轮播/暂停、两张原图租约上限、实际在线录音及关闭/后台清理通过                                               |
| 实际在线曲目                                      | 四首官方 MP3 均收到实际媒体响应，readyState=4 且播放时间前进，关闭后释放解码器；取消下载产生的 ERR_ABORTED 属于预期清理                                              |
| ZTE 7551N / Android 13                            | 用户手动覆盖安装后，确认 0.9.0 / build 10；五页宽度 360px 无溢出，主题、返回键、弹窗、键盘、后台/恢复全部通过                                                        |
| 升级数据保留                                      | 与升级前本机基线比较，照片及整理记录的汇总数量一致，UI 测试自身未修改记录；不发布实际数量或私人照片                                                                  |
| GitHub CI                                         | [运行 40062663773](https://github.com/xiao7511/nobi-photos/actions/runs/40062663773) 的 verify、android、ios 三项全部成功                                            |
| iOS 原生                                          | Xcode 26.6 / iPhone 17 Pro / iOS 26.5 模拟器，两项原生 UI 测试通过，0 失败、99.002 秒；PhotoKit、SQLite、Vision、原图与手动曲目选择通过；unsigned arm64 设备归档成功 |

原生选曲使用生成的 `nobi_audio_reference.wav`，SHA-256 `a669cfbcfc3e91529ef352a0c7616cca61082070ecb8e3bc253147b8bebff452`，不是用户音乐。原生截图仅使用公开图片或合成夹具。手机复核没有打开私人照片或启动私人音乐选择器；不将模拟器选曲测试描述为读取了用户音乐。

四首实际在线录音时长分别为 214.29、235.29、205.08、254.72 秒。确定性浏览器测试另使用受控 WAV 测试错误与离线边界，不将受控响应当作真实曲库播放证据。

证据：

- [扇形界面截图](validation/android-phase9-fan.png) / [本机选曲截图](validation/android-phase9-local-music.png)
- [系统文件选择器及离线音频](validation/android-phase9-music-picker-result.json)
- [原生原图、轮播与清理](validation/android-phase9-playback-result.json)
- [实际在线音乐](validation/online-phase9-music-result.json)
- [Android 包核验](validation/android-phase9-package-result.json)
- [手机 UI 与升级数据保留](validation/android-phase9-phone-result.json)
- [iOS 与完整 CI 结果](validation/ios-phase9-result.json)

## 安装包与来源

最终安卓应用源码为 `cbb3d918cf102a2977cabd5da60277729687a77f`。完整 CI 验证提交为 `18724ab6e2a1adce7a335e09480496378751c447`，后者只调整 E2E 文件 input 定位器，没有修改应用代码；后续验收文档提交不改变已安装应用。

APK：`artifacts/android-0.9.0/NOBI-Photos-0.9.0-debug.apk`，**37,004,523 字节**；SHA-256：`1a73a2c84f712d27f17d21411462590a94e499ade646507387f78698cb398f43`。

Android Debug v2 签名已核验，minSdk 24 / targetSdk 36，四种 ABI；37 个内置网页文件逐个哈希一致，不依赖电脑网页服务器。备份与迁移禁用，权限仍为五项，未增加音乐媒体读取权限。手机系统拒绝 ADB 安装后，用户通过 Download 中的 `NOBI-Photos-0.9.0-cbb3d91.apk` 手动覆盖更新，随后实际核对版本和记录保留。

iOS 产物见 [ios-simulator-and-validation](https://github.com/xiao7511/nobi-photos/actions/runs/40062663773/artifacts/12547724460)：artifact ID `12547724460`，16,572,888 字节，SHA-256 `5c644004b95338b471efa9082325b9642a0a8c80730c2b9cda3f5724737e7afd`，有效期至 2027-01-22。本次检查任务日志与 GitHub artifact 元信息，未下载 ZIP。

iOS 尚未使用实际 File Provider 选取本机音乐；该链路的真实文件选择和离线解码已在 Android 验证。iOS 真机安装仍需 Apple 开发者团队和正式签名，现有产物为模拟器应用与未签名归档，不是可安装 IPA。在线曲目可用性依第三方服务，连接失败会提示并保留离线照片浏览。

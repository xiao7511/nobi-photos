# Phase 8：平滑轮播与在线分类配乐

版本 **0.8.0**，Android versionCode **9**，iOS build **9**。应用源码提交 `09e56b59b0eb53c648c0f4d630c919c319e23204`。

## 交付行为

- 相册以横向滑动连续轮播：下一张原图读取并完成解码后才进入，当前图片始终保留。680ms 滑动，完成后切换当前图片并释放上一张。无先清空画面、缩略图反复替换或淡入淡出。手动前后切换、左右滑动、5 秒自动轮播和末张循环共用同一流程；读取失败保留当前照片并暂停轮播。系统减少动态效果开启时取消滑动动画。
- Android 与 iOS 临时缓存最多同时保留两张原图，第三个租约明确拒绝。原图仍受 64MP / 80MiB 单张上限保护，仅保存于应用私有缓存，不进入 SQLite。上一张在滑动完成后释放，退出或进入后台清空，异常退出残留在下次启动清理。iOS 文件完全保护、排除备份，读取失败只清理本次文件。
- 旧合成音已替换为 Kevin MacLeod 官方 Incompetech 原版录音，按本机 AI 稳定主题或多数照片分类自动匹配四首曲目、七类风格：自然/文档 Dream Culture；旅行 Life of Riley；城市/美食 Long Stroll；生活/动物/未分类 Carefree。分类与选曲均在设备内完成。
- 配乐默认关闭，主动开启后联网播放；支持录音循环、加载状态、20 秒连接超时、失败提示与重新开启。关闭配乐、退出看图、进入后台或播放中断会取消媒体请求并释放解码器。音乐断网时照片浏览与轮播继续可用。
- 播放器显示曲名、作者和 CC BY 4.0，提供原曲、许可与未改编说明。详见 [配乐来源与授权](MUSIC-LICENSES.md)。

## 隐私与网络

只请求固定的官方 HTTPS MP3，不带查询参数、请求体、Referer 或照片信息。照片、文件名、标签、照片标识、自建相册名均不参与网络请求，没有云端图像识别或上传 API。音乐提供方可收到 IP 与设备请求信息，界面已明确说明可能消耗移动流量。

Android 新增 INTERNET 用于在线音乐；禁止明文 HTTP，仍无相机、麦克风、位置或写入图库权限。CSP 仅为 `https://incompetech.com/music/royalty-free/mp3-royaltyfree/` 开放媒体播放，远程图片、脚本、接口连接、表单及 frame 仍被禁止。未开启配乐时五页基础流程无外部请求。未连接生产数据库或修改其他项目。

## 验证记录

| 检查 | 结果 |
| --- | --- |
| ESLint / TypeScript | 通过 |
| Vitest | 19 文件、92 项通过 |
| Vite build / Capacitor sync / cap:check | 通过 |
| 桌面与移动浏览器 E2E | 24 项通过，包括逐帧检查轮播覆盖，无空隙、无未加载图片 |
| 实际互联网音乐 | 标准 Edge/Chromium 浏览器连续播放四首官方 MP3，readyState=4，真实时间前进；仅四次固定音乐 GET，请求无正文与 Referer，关闭后解码器释放 |
| Android 构建与 Lint | assembleDebug、应用和原生插件 lintDebug 均通过 |
| Android 14 专用模拟器 | 103 张公开/合成夹具；离线原图浏览、AI/分类详情、硬件返回、自动轮播/暂停、两个租约保留与第三个拒绝、真实在线录音、关闭/后台清理均通过 |
| 手机覆盖更新 | 用户通过系统安装器更新至 0.8.0 / build 9，五页布局、主题、键盘、硬件返回、弹窗返回、后台/恢复全部通过，更新前后本地记录数量一致；未打开私人照片 |
| GitHub CI | [运行 40054573104](https://github.com/xiao7511/nobi-photos/actions/runs/40054573104) 的 verify、android、ios 三项全部成功 |
| iOS 原生 | macOS / Xcode 构建通过，PhotoKit、SQLite、Vision 与页面原生 UI 两项测试通过，0 失败、186.961 秒；unsigned arm64 设备归档成功 |

真机为 ZTE 7551N，界面宽度 360px，页面宽度与视口一致，顶栏 60px，底部导航贴合可视区域；记录保留仅公布一致性结论，不发布照片、收藏、相册等实际数量。

浏览器实际录音时长：Dream Culture 214.29 秒，Life of Riley 235.29 秒，Carefree 205.08 秒，Long Stroll 254.72 秒。使用真实媒体解码与播放进度验证，不以曲名或按钮状态代替播放证据；确定性 E2E 另使用受控 WAV 响应测试断网、取消与隐私边界，不将受控音频计作真实曲库验证。

原生看图 CSS 视口 412×915，图片显示 412×915.05；夹具原图 512×929，原图尺寸由解码结果确认。验证只使用公开鹦鹉图片和合成图片，未获取私人照片。截图见 [Android 原图界面](validation/android-phase8-fullscreen.png)。

可追溯证据：

- [原生播放与缓存清理](validation/android-phase8-playback-result.json)
- [四首实际在线录音](validation/online-phase8-music-result.json)
- [Android 打包核验](validation/android-phase8-package-result.json)
- [真机版面与记录保留核验](validation/android-phase8-phone-result.json)
- [iOS 构建、原生测试与归档](validation/ios-phase8-result.json)

iOS 归档与模拟器证据已保存在 GitHub [ios-simulator-and-validation](https://github.com/xiao7511/nobi-photos/actions/runs/40054573104/artifacts/12545122951)，artifact ID `12545122951`，16,624,580 字节，SHA-256 `88c59b2aae86879d16b7dddcf72db4952f44fe96a3dadea8830f8a74f044b2ff`，有效期至 2027-01-22。本次核对原始任务日志与 GitHub artifact 元信息，未将 ZIP 下载到本机，也未将未签名归档称为可安装 IPA。

## 安装包

`artifacts/android-0.8.0/NOBI-Photos-0.8.0-debug.apk`，36,997,305 字节，Android Debug 签名，minSdk 24 / targetSdk 36，含四种 ABI。

SHA-256：`9fc846d8889df797b91c7a196714ed5af1fd8a8dffc974af192c3e36e4a03e56`。

37 个内置网页文件逐个比对哈希一致；不依赖电脑网页服务器。备份与设备迁移禁用，SQLite 与原生照片插件已内置。APK 仅用于本轮开发验收，正式商店发行仍需正式签名。

第三方网络与官方文件可用性不能保证永久稳定；不可用时提示并保持离线看图。iOS 真机安装仍需要 Apple 团队与签名，不将模拟器构建等同于已签名 IPA。

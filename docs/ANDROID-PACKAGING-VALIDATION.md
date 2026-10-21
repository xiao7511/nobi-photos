# Android APK 打包与联调验证

2026-10-21 22:31（上海时间）完成当前代码的 Android Debug 打包验证及专用模拟器联调。应用代码基线为 `21ae1f9d8d9bf4e20f42deaa442854da5fe2cf59`，本次不增加产品功能、不变更版本或数据库结构。

## 交付安装包

- 文件：`artifacts/android-21ae1f9/NOBI-Photos-0.4.0-debug.apk`，13,298,707 字节（约 12.68 MiB）。
- 包名：`app.nobi.photos`；版本：`0.4.0` / versionCode `4`。
- 最低 API 24（Android 7），compile/target API 36；仅 API 34 已实际运行本轮测试。
- 包含 `arm64-v8a`、`armeabi-v7a`、`x86`、`x86_64` 的 SQLite 原生库；其他 ABI 真机尚未测试。
- SHA-256：`25249411069bc039d2593f7631285a69b3db52bd0a24cdfb4d494992e6925f70`。
- 使用本机 Android Debug 证书，APK v2 签名验证通过。适合安装联调，尚未进行正式发布签名、商店审核或分发。

本轮重新运行构建、同步和检查；Gradle 对未变化的任务使用增量缓存，产物与已验收的 Phase 4 APK 字节一致。交付包单独保存，没有覆盖历史 APK。APK、校验文件、原始 aapt/apksigner 输出及模拟器日志在上述本地目录，二进制不提交 Git。

## 本轮构建检查

| 检查                                                   | 结果                     |
| ------------------------------------------------------ | ------------------------ |
| ESLint / TypeScript                                    | 通过                     |
| Vitest                                                 | 12 个文件、63 项全部通过 |
| Vite build                                             | 通过                     |
| Capacitor Android sync / 隐私配置检查                  | 通过                     |
| `:app:assembleDebug`                                   | 通过                     |
| `:app:lintDebug`                                       | 0 错误，14 警告          |
| `:nobi-photo-library:lintDebug`                        | 无问题                   |
| APK 签名与实际清单检查                                 | 通过                     |
| APK 内 37 个网页文件与当前 `dist/` 逐文件 SHA-256 比较 | 全部一致                 |
| APK 内插件配置及四种 ABI 的 SQLite 库                  | 完整                     |

构建环境：Windows、JDK 21.0.12、Android SDK/build-tools 36.0.0、Gradle 8.14.3。构建命令：

```powershell
npm run lint
npm run typecheck
npm run test
npm run build
npx cap sync android
npm run cap:check
cd android
.\gradlew.bat :app:assembleDebug :app:lintDebug :nobi-photo-library:lintDebug --no-daemon --max-workers=1 '-Dorg.gradle.jvmargs=-Xmx768m -Dfile.encoding=UTF-8'
```

14 项应用 lint 警告分别为工具版本提示 1 项、图标尺寸/重复/位置 3 项、单色启动图标 2 项、旧 SDK 判断 1 项、未使用资源 7 项。另有 flatDir、SDK XML 工具元数据版本和 Gradle 弃用提示；这些均未阻止构建，不表述为零警告通过。

## 安装包隐私检查

检查对象是实际 APK 的合并清单与打包资源。权限仅含旧版只读图片存储（截至 API 32）、`READ_MEDIA_IMAGES`、`READ_MEDIA_VISUAL_USER_SELECTED` 和 AndroidX 应用内动态接收器签名权限。无 INTERNET、相机、位置、视频、照片写入权限。

`allowBackup=false`、`fullBackupContent=false`，打包的 extraction rules 对云备份和设备迁移各排除五类数据目录。内置 Capacitor 配置无远程 `server.url`、无明文网络开关，使用本地 HTTPS scheme，桥接日志为 `none`。SQLite、App、NobiPhotoLibrary 三个插件均已打包。SQLite 库文件名为 `libsqlcipher.so` 不代表本应用已启用数据库加密；当前本地元数据仍未启用应用层加密。

## 实际原生联调

环境为本项目专用 `nobi_photos_test` AVD，Android 14 AOSP / API 34 / x86_64，serial `emulator-5580`。使用 WHPX、540×1200 / density 210、关闭动画，不作为真机性能数据。只生成并读取 101 张合成图片；脚本核对模拟器名称后才安装 APK、清除本应用测试数据。

本轮重新运行 `NOBI_TEST_PHASE4=1` 的 `npm run test:native`，22:31:13 生成新的成功结果，实际通过：

1. 首次未授权无照片；通过真实 Android 权限弹窗拒绝，再请求并允许全部。
2. MediaStore 跨 100 条分页读取 101 张图片，原生 SQLite 索引数为 101，生成本地 JPEG 缩略图，收藏刷新后保留。
3. 创建相册、保存手动标签，刷新后持久化；完成 101 张图片的本地相似建议分析。
4. 两张照片批量添加标签，SQLite 查询为两条；精确标签搜索返回两张。
5. Home 切后台后页面照片隐藏，回前台恢复搜索结果。
6. 系统飞行模式开启且 Wi-Fi 关闭后强停进程并冷启动，101 条索引和两条批量标签仍可用。
7. 撤销图片读取权限并重启，页面零照片、SQLite 照片索引和手动标签均清空。

截图：[索引完成](screenshots/android-packaging/indexed.png)、[撤权后](screenshots/android-packaging/revoked.png)。完整原始结果、权限弹窗 XML 和其他截图保留于 `artifacts/android-21ae1f9/`；带时间、源提交与 APK 校验值的汇总记录提交于 [android-packaging-result.json](validation/android-packaging-result.json)。

测试结束恢复飞行模式关闭并关闭本任务启动的模拟器。没有连接物理手机，没有读取私人相册，没有上传照片、调用云 AI、删除原图或连接云端数据库；没有修改其他 NOBI 项目。

## 复验与后续边界

启动专用 AVD 后，在仓库根目录执行：

```powershell
$env:NOBI_TEST_APK='artifacts/android-21ae1f9/NOBI-Photos-0.4.0-debug.apk'
$env:NOBI_TEST_PHASE4='1'
npm run test:native
```

安装到另行准备的测试手机可使用 `adb -s <设备序列号> install -r <APK绝对路径>`；安装后由用户主动授予照片权限，不自动开始读取。自动冒烟脚本只支持上述专用 AVD，不对真机清除数据。如果手机上已有不同签名的同包名应用，安装可能因签名不匹配被拒绝；应先确认原安装和本地整理数据的保留方式，不自动卸载。

尚未执行物理 Android 手机验证、API 24–33 / 35–36 运行测试、Android 14 有限选择及缩减范围、扫描中断/大图库完整矩阵、正式签名及 iOS 编译。最低/目标 SDK 声明和四 ABI 打包不等同于上述系统已通过运行验收。后续设备矩阵见 [原生验证清单](NATIVE-TEST-MATRIX.md)。

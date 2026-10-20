# NOBI Photos · Nobi 相册

本地优先、无需注册的移动相册。Phase 1 为 Vue 界面与本地服务基础，当前展示随应用打包的 12 张原创 SVG 示例插画。

## 本地开发

需要 Node.js **24.19+** 和 npm 11。SQLite 测试使用 Node 内置 `node:sqlite`，不连接任何外部数据库。

```sh
npm ci
npm run dev
```

开发服务仅监听 `127.0.0.1:5173`。生产构建和本地预览：

```sh
npm run lint
npm run typecheck
npm run test
npm run build
npm run preview
```

浏览器验收：

```sh
npx playwright install chromium
npm run test:e2e
```

`test:e2e` 需要先构建，自动启动 `127.0.0.1:4173` 的生产预览。首次开发依赖安装需要访问 npm；应用运行无需远程 API、CDN、字体或图片。

已安装 Microsoft Edge 的 Windows 也可在 PowerShell 设置 `$env:NOBI_BROWSER_CHANNEL='msedge'` 后执行浏览器验收，避免另行下载 Chromium。该选择仅作用于测试进程。

## Phase 1 功能

- 照片：日期分组、分类/收藏筛选、排序、两种密度、详情、收藏持久化。
- 分类：四类示例相册、收藏入口、分类内浏览。
- AI 搜索：本地标题、地点、分类与标签匹配；空格连接多个关键词取交集。**没有接入语义 AI**。
- 清理：预设的示例相似组、会话内标记保留；不扫描、不删除、不声称可释放真实空间。
- 我的：本地访客、统计、浅色/深色/跟随系统偏好。
- 隐私中心：权限及数据说明、二次确认清除示例记录、恢复示例、明确说明数据未加密。
- 手机底部导航、桌面侧边导航、键盘操作、对话框焦点管理、离线状态反馈。

## 架构

```text
src/views/           五大页面与隐私中心
src/components/      照片网格与详情对话框
src/stores/          Pinia 相册和主题状态
src/domain/          数据模型、服务接口、只读隐私策略
src/services/        本地元数据仓库、照片服务、本地关键词过滤
src/db/              SQLite v1 SQL、平台无关连接接口、参数化元数据操作
public/art/          随包交付的原创示例插画
scripts/             确定性的插画生成脚本
tests/e2e/           手机和桌面浏览器验收
```

当前运行时采用 `LocalPhotoRepository`，只写入 `nobi.photos.demo.v1`（示例收藏 ID 与隐藏状态）及 `nobi.photos.theme.v1`（主题）。服务接口不暴露上传或云端调用。原生相册授权和原图删除方法均抛出明确错误，隐私策略值不可变。

SQLite v1 包含照片元数据、相册、多对多关系、标签、清理候选和迁移记录。SQL 使用事务、外键、检查约束与索引，可幂等执行；SQLite 元数据更新使用绑定参数。测试只在内存数据库执行。**尚未安装或实例化原生 SQLite 驱动**，也没有把浏览器存储冒充 SQLite。

## 离线与隐私边界

生产构建用 Service Worker 预缓存应用代码、全部路由代码与本地 SVG；首次需要成功打开并完成缓存，之后支持离线刷新。开发服务器不启用离线缓存。离线缓存本身不代表已加密。

无登录、遥测、广告、云端 AI、照片上传、云同步、自动扫描、自动删除或后台照片任务。CSP 限制运行时资源来源；开发热更新允许回环地址 WebSocket。系统相册、相机、文件系统权限均未请求。没有连接生产数据库，也没有配置凭据。

浏览器元数据**未加密**；共用设备应使用系统锁屏。清除示例记录不会清除主题与 Service Worker 缓存，彻底清除请使用浏览器的站点存储设置。未来原生端的密钥管理、真实权限、端侧 AI 与备份需要单独设计与验收。

## Capacitor 边界

已配置 `app.nobi.photos`、应用名与 `dist` 资源目录，安装 Capacitor Core/CLI。Phase 1 不生成 Android/iOS 工程，不请求原生权限。`npm run cap:check` 可检查配置和插件列表。

**Phase 1 后停止。** 只有在用户验收并明确启动 Phase 2 后，才开发 Android/iOS 容器、原生照片读取、权限流程、SQLite 驱动与自动扫描；仍须遵守默认不上传、不调用云端 AI、不自动删除的要求。

参考：[Vue TypeScript](https://vuejs.org/guide/typescript/overview)、[Capacitor 配置](https://capacitorjs.com/docs/config)、[Vite PWA](https://vite-pwa-org.netlify.app/guide/)。

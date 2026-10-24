# 可选账号服务与免费注册权益

本目录是 **尚未部署** 的账号接入配置，不能直接在既有生产库执行。Phase 5 的 `/opt/nobi-photos-cloud` 只有独立 PostgreSQL，没有 Auth、PostgREST 或 Edge Functions，不能把数据库地址填入客户端。本次未连接或修改服务器。

需要此应用专用、可经 HTTPS 访问的完整 Supabase **测试项目**（托管或完整自托管均可）。不要复用其他 NOBI 项目。客户端只需要项目 URL 和 publishable/anon 公钥；不能放入数据库密码、service_role、secret key 或微信 AppSecret。

1. 在测试项目启用邮箱/密码认证与 **Confirm email**；密码最少 10 位，配置受控 SMTP、邮件速率限制和应用可接受的滥用防护。不可在未验证邮件发送能力、速率限制和账号注销前开放公网注册。
2. 将 Confirm signup 和 Reset password 两种邮件模板配置为显示 `{{ .Token }}` 数字验证码，支持 6–10 位。本应用显式输入验证码，不消费 URL token、深链或自动登录，不用一个假的本地账号代替真实注册。邮件应清楚说明 NOBI Photos、有效期和非本人操作的处理方式。
3. 在专用测试项目执行 `migrations/202610240001_member_access.sql`。此 RPC 从已验证 JWT 对应的 `auth.users` 决定权益，拒绝匿名执行，不读取 `user_metadata` 中自填的会员等级。免费注册权益仅为 beautify / compose / share，不包含付费会员、订阅、订单或任何照片表。
4. 将 `functions/nobi-delete-account/index.ts` 部署为 `nobi-delete-account` Edge Function。默认 JWT 校验保持开启，并由函数再次 `getUser` 校验身份；新 publishable key/JWT 配置若使用平台不同网关策略，须按对应 Supabase 官方说明配置网关，但不得移除函数内部验证。服务器 secret 只在函数环境保存。设置 `NOBI_ALLOWED_ORIGINS` 为逗号分隔的精确 origin，例如 Android 的 `https://localhost`、iOS 的 `capacitor://localhost` 和此应用自己的 HTTPS 网页地址，不用 `*`。客户端注销前会重新验证当前密码，函数只删除已验证 token 自身的用户，不接受外部 user id。
5. 复制根目录 `.env.example` 为忽略入库的 `.env.local`，填写两个公开配置。构建会只为该精确 HTTPS origin 扩展 CSP connect-src；不开放 Storage、图片 CDN、任意远程脚本或通配域名。重新运行 build、cap:sync 与原生构建。两项留空时注册按钮禁用，基础相册继续离线可用；半配置或管理员密钥会使构建失败。

认证 SDK 只在用户主动认证操作时创建，persistSession / autoRefreshToken / detectSessionInUrl 均为 false；密码、验证码和令牌不写入 SQLite/localStorage，退出即清除，令牌过期后关闭创作权益并重新登录。账号网络请求设置 20 秒超时、omit credentials、no-referrer，限制到指定 origin 的认证、权益 RPC 和自身账号注销。游客导航、照片读取和整理不发起账号请求。

邮箱验证、恢复、重复账号、错误密码、过期码、服务故障与注销需要在真实测试项目上联调 SMTP/API；仓库中的模拟 API 测试只证明客户端流程，不等同于已上线服务。原图、相册关系、照片名称、收藏、标签与分享文案不传入 Auth 或权益 API。客户端创作门禁是产品权益，不是防篡改 DRM；未来付费或云端资源必须继续在服务端逐请求校验，不能依据前端布尔值授权。

微信当前使用系统图片分享面板，由用户选择实际可用目标并确认；不承诺每台手机都有“朋友圈”选项，不自动点击发布。直接微信 SDK 接入仍需用户自己的开放平台移动应用 AppID、对应 Android 包名/签名及 iOS Universal Link；客户端不能包含 AppSecret。受保护音乐缓存不参与图片分享。

分享图片由 canvas 本地重编码为 JPEG（不携带原图 EXIF/GPS），单图最长边 2400px、拼图 2160px，最多九张；系统分享仅写入 `Cache/nobi-share`，FileProvider 只开放此目录。Android 分享回调可能早于接收应用读取文件，因此成功选择后保留副本至后续前台清理（文件超过 24 小时才清理；应用未启动时不会后台定时删除，系统也可能提前回收缓存）。取消或失败立即删除本次副本；不会删除用户原图。

参考：[Supabase 密码认证](https://supabase.com/docs/guides/auth/passwords)、[OTP 验证](https://supabase.com/docs/reference/javascript/auth-verifyotp)、[Capacitor Share](https://capacitorjs.com/docs/apis/share)、[Filesystem 隐私申报](https://capacitorjs.com/docs/apis/filesystem)。

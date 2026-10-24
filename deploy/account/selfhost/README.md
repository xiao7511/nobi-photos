# 上海服务器隔离账号服务（公网待启用）

目标：仅 `124.223.201.166` 的 `/opt/nobi-photos-cloud/accounts` 与已有 **本应用独立容器** `nobi-photos-cloud-db`。不使用其他应用的完整 Supabase，也不连接其数据库。

需要明确授权的服务器变更：

1. 先备份 `nobi_photos_cloud`，再在此独立库创建 `nobi_photos_auth` 低权限角色与独立 `auth` schema。照片及整理关系仍不进入云端。
2. 新建 `nobi-photos-accounts-auth`（官方 Supabase GoTrue 2.196.0，160MiB / 0.30 CPU）和 `nobi-photos-accounts-gateway`（Node 22.23.2，96MiB / 0.20 CPU），只发布 `127.0.0.1:15433`；不重建既有数据库或其他应用容器。密钥只在服务器生成、受限文件保存，不输出、不入 Git。Docker Hub 连接超时，改用已缓存且固定 SHA-256 的官方镜像；网关仅使用官方 Supabase Studio 镜像内的 Node，覆盖 entrypoint 和健康检查，**不运行 Studio，也不连接已有 Studio 实例**。镜像虽含未使用的 Studio 文件，其应用、数据库工具及界面均未启动。
3. 新增仅属于 `photos.nobistudio.com` 的 Nginx 站点和证书，检测配置后平滑 reload。其他项目的配置不修改。数据库继续无公网端口。
4. 未确认真实 SMTP 前，公网 Auth 一律返回 503；`/health` 可公开检查。内部测试 SMTP 只接受 `@example.invalid`，不连接外部邮件服务、不向真实邮箱发送信息。私有验证额外需要服务器 staging key；Nginx 必须清除外部的 `X-Nobi-Staging-Key`，禁止代理 `/_staging/` 和 `/templates/`。

`gateway.mjs` 提供受限 Supabase Auth 代理、免费注册权益 RPC 兼容接口和本人注销接口；每次权益或注销均由 GoTrue getUser 验证 token，禁止客户端指定 user id。它不提供任意 PostgREST、Storage、文件上传或管理员路由。托管 Supabase 的替代部署可使用上级目录的 SQL RPC / Edge Function，不应同时混用两套授权实现。

`bootstrap.sh` 只允许在上述 root 目录、指定项目标签的健康数据库执行，遇到已有账号部署或 auth schema 会拒绝覆盖。`verify.py` 只在服务器运行，验证真实注册、内部邮件码、未验证登录拒绝、已验证权益、伪造 token 拒绝、媒体载荷拒绝、外部 user id 删除拒绝、本人注销与注销后拒绝访问；不打印邮箱、密码、验证码或 JWT。测试账号完成后删除，SQL 和 Docker 配置不会自动开放公网注册。

2026-10-24 用户已明确批准上述服务器变更，现已完成独立库备份、Auth 角色/schema、两个容器及专用 HTTP 站点。`verify.py` 在真实 Auth/数据库上验证注册、内部验证码、密码登录、密码恢复、权益拒绝与本人注销通过，测试账号均删除；没有外部邮件或私人照片。

`photos.nobistudio.com` 的 A 记录为指定服务器，但公网 HTTP 返回 302 至 `https://dnspod.qcloud.com/static/webblock.html?d=photos.nobistudio.com`；服务器本机同 Host 的挑战文件可读。证书机构跟随重定向后报未授权，故 HTTPS 尚未完成，也未写入 HTTPS 站点或续期 hook。必须先由用户在腾讯云侧解除访问拦截，再运行 `enable-https.sh`：脚本只在已有站点与本项目 HTTP 模板逐字一致时恢复，不覆盖其他站点。

启用真实注册前还需：配置本应用可用的真实 SMTP、模板及发送速率；将测试 SMTP 接收器从生产路径移除；确认账号注销、HTTPS、CORS、恢复与邮件投递的真实端到端结果；最后才将服务器 `gateway.json` 的 `publicAuthEnabled` 设为 true，并使用服务器 `secrets/client.env` 中的公开客户端配置重新构建客户端。不要将整个 gateway.json/auth.env 或 service key 复制到前端，也不要用测试 staging key 让手机绕过注册开关。

`bootstrap.sh` 不能在当前部署重跑；运行已有环境用 `docker compose up -d --pull never`，保留现有 secrets 和数据库。备份/恢复、真实 SMTP 和公网移动端联调未完成前，不得宣称已正式上线。

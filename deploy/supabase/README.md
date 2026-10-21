# NOBI Photos 独立 Supabase Postgres 基础库

这是 **Supabase 官方 Postgres 镜像的数据库层**，不是另起一套完整 Supabase 平台。未启用 Studio、Auth、PostgREST、Storage、Realtime 或 Edge Functions，也没有修改服务器上已经运行的 Supabase。

用途是预留新增云端业务数据的独立基础库。业务内容尚未定义，业务 schema 保持空；**不存储照片、缩略图、照片索引、相册、标签、收藏或搜索记录**。手机客户端继续使用本地 SQLite，未增加网络 SDK、云端地址、登录或上传入口。

## 隔离配置

| 项目                | 配置                                                                                   |
| ------------------- | -------------------------------------------------------------------------------------- |
| 服务器目录          | `/opt/nobi-photos-cloud`，root 所有、0700                                              |
| Compose 项目 / 容器 | `nobi-photos-cloud` / `nobi-photos-cloud-db`                                           |
| 镜像                | `supabase/postgres:17.6.1.136`，固定 SHA-256 摘要；与当次官方 Docker 配置一致          |
| 内存 / CPU 上限     | 384 MiB / 0.5 CPU                                                                      |
| 本机端口            | **127.0.0.1:15432**；未绑定公网地址                                                    |
| 数据库              | `nobi_photos_cloud`                                                                    |
| 业务 schema         | `nobi_photos_business`，当前无表                                                       |
| 运维 schema         | `nobi_photos_ops`，仅初始化迁移记录，启用强制 RLS                                      |
| 运行账号            | `nobi_photos_app`，非超级用户，无建库、建角色、复制或绕过 RLS 权限，无 schema 创建权限 |
| 数据 / 密钥卷       | `nobi_photos_cloud_data` / `nobi_photos_cloud_config`                                  |
| 网络                | 仅本项目的独立 bridge；不加入现有 Supabase 网络                                        |

Docker 的 `internal: true` 网络不能用于这里需要的宿主机端口发布，故使用独立 bridge，并将发布端口和默认绑定地址均设为回环地址。没有修改 Docker 全局配置、其他容器、防火墙或反向代理。

数据库管理员和应用密码分别在服务器本地生成，位于 `secrets/admin_password`、`secrets/app_password`。文件权限 0400，父目录 0700，按镜像中 postgres 用户 UID/GID 授权读取。Compose 只包含 secret 文件路径；密码、SSH 私钥和备份不入库，不注入 Vite 环境变量。不要用 `docker compose config` 打印自建的明文凭据配置。

## 首次部署

需要 Docker Engine/Compose、OpenSSL 和 sudo。先确认 `/opt/nobi-photos-cloud`、对应容器名、卷名和端口没有被占用。仅将本目录的非密钥配置上传到全新专用目录，再设置 root 所有和 0700 目录权限。

```sh
sudo bash /opt/nobi-photos-cloud/bootstrap.sh
sudo bash /opt/nobi-photos-cloud/verify.sh
sudo bash /opt/nobi-photos-cloud/backup.sh
```

`bootstrap.sh` 只用于全新部署；遇到已有容器或数据卷会停止，不覆盖旧数据或重置密码。SQL 只在首次创建新卷时初始化。镜像还会在该独立容器内部创建 Supabase 自带的系统角色/schema，和其他 Supabase 实例没有共享数据或账号。

`business.sql` 创建空业务 schema、独立低权限运行账号和迁移记录 `202610210001`，不创建相册或用户业务表。未来有业务需求时再增加独立迁移、授权和 RLS 策略，不能直接重写已应用的初始化 SQL。

## 验证与维护

```sh
sudo docker compose -f /opt/nobi-photos-cloud/compose.yml ps
sudo bash /opt/nobi-photos-cloud/verify.sh
sudo docker compose -f /opt/nobi-photos-cloud/compose.yml restart db
sudo bash /opt/nobi-photos-cloud/verify.sh
sudo bash /opt/nobi-photos-cloud/backup.sh
```

验证脚本检查：容器身份与健康、本机端口、秘密文件权限、迁移记录、空业务 schema、低权限账号、服务器本机 TCP 连接、错误密码拒绝、运行账号对运维 schema 的访问拒绝。所有 SQL 固定连接新容器的 `nobi_photos_cloud`，不连接现有 Supabase。

备份使用 `pg_dump --format custom`，检查 `pg_restore --list` 可读后才保留最终文件，放在 root 受保护的 `backups/` 中。当前只有手动本机备份，未配置自动或异地备份，也未执行完整恢复演练。启用真实云端业务之前需要补充备份、恢复与监控策略。

重建本项目容器保留命名数据卷；本次已验证重建和重启后初始化记录仍在。不要删除命名数据卷，也不要对服务器上已有的 Supabase 执行此目录的脚本。数据库升级需单独评审，避免直接更换镜像主版本。

## 访问方式

通过 SSH 隧道访问本机绑定的数据库端口，无需开放安全组中的 PostgreSQL 端口：

```sh
ssh -i <本机已有私钥路径> -N -L 15432:127.0.0.1:15432 ubuntu@<上海服务器>
psql --host 127.0.0.1 --port 15432 --username nobi_photos_app --dbname nobi_photos_cloud -W
```

运行密码由有权管理该服务器的人在服务器受保护的 secret 文件中取得，不通过聊天或 GitHub 传递。不要把管理员密码用于手机客户端。这里不提供 Supabase API URL 或 API key，因为尚未部署该项目的 API 服务。

参考：[Supabase 自托管 Docker 文档](https://supabase.com/docs/guides/self-hosting/docker)、[官方 Compose 配置](https://github.com/supabase/supabase/blob/master/docker/docker-compose.yml)、[Docker 端口发布](https://docs.docker.com/engine/network/port-publishing/)。

# 在线分类配乐与授权

核对日期：2026-10-24。应用采用作曲家 Kevin MacLeod 官方 Incompetech 曲库的原版录音，未作改编。仅在用户开启配乐后经 HTTPS 在线播放，不批量预下载或写入应用离线缓存。

| 曲目 | 本机匹配分类 | 原曲页面 | 许可 |
| --- | --- | --- | --- |
| Dream Culture | 自然、文档 | [Kevin MacLeod / Incompetech](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1300046&Search=Search) | CC BY 4.0 |
| Life of Riley | 旅行 | [Kevin MacLeod / Incompetech](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1400054&Search=Search) | CC BY 4.0 |
| Long Stroll | 城市建筑、美食 | [Kevin MacLeod / Incompetech](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100174&Search=Search) | CC BY 4.0 |
| Carefree | 生活、动物、未分类 | [Kevin MacLeod / Incompetech](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1400037&Search=Search) | CC BY 4.0 |

按[官方许可生成页面](https://incompetech.com/music/royalty-free/licenses/)要求署名：

> "<曲名>" — Kevin MacLeod (incompetech.com). Licensed under Creative Commons: By Attribution 4.0. https://creativecommons.org/licenses/by/4.0/

播放器提供曲名、作者、原曲和[许可链接](https://creativecommons.org/licenses/by/4.0/)，并说明原版录音未改编。本应用没有配乐视频导出；以后若加入导出，必须将相应署名与许可带入作品。官方[曲库目录](https://incompetech.com/music/royalty-free/pieces.json)提供曲目、文件名、ISRC、乐器、风格和时长，本应用只固化上述四首公开音乐信息，不在运行时查询用户内容。

相册 AI 主题或多数照片分类在设备内匹配四首曲目、七类风格。不会将照片、标签、文件名、自建相册标题或照片标识发给选曲服务，没有在线图像识别请求。唯一自动远程请求是所选固定 HTTPS 音乐文件（无查询参数、无请求体、无 Referer）；打开来源/许可链接属于用户另外点击的行为。音乐提供方可看到正常请求的 IP、设备与浏览器信息。

CSP 仅对官方 `https://incompetech.com/music/royalty-free/mp3-royaltyfree/` 开放 `media-src`，不开放远程图片、脚本、接口连接或表单提交。Android 因在线音乐增加 INTERNET 权限，仍禁止明文 HTTP。退出看图、进入后台或主动关闭配乐时取消媒体请求与解码器；连接超过 20 秒失败时释放资源并提示重试。音乐不可用时继续离线看图，不回退到旧合成音。第三方可用性受网络与官方地址影响。

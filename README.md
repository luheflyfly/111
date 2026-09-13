# GzhHarvester · 公众号采集器（手机无障碍方案）

> 中南大学个人用的公众号通知采集工具。仓库 `luheflyfly/111`。只读、只个人使用；
> 不 hook 微信客户端、不自动发消息、不公开转载。

## 两条手机采集路（互为补充）

| 路 | 载体 | 适用 | 怎么采 |
|---|---|---|---|
| **AutoX.js 导航采集**（主力） | 备用机 华为P30+鸿蒙4 | 批量拉一个号的历史文章 | 脚本自动进微信→搜号→进主页→逐篇"复制链接"，JSON 落 `/sdcard/ghz_outbox/` |
| **无障碍剪贴板 App**（轻量） | 任意安卓机（仓库直接编 APK） | 日常刷到一篇收一篇 | App 后台监听剪贴板/分享，捕到链接自动抓正文落 SYNC_FORMAT 笔记 |

PC 端（`D:\GzhHarvester\`，不在本仓库）：`app/phone_ingest.py` 读 inbox 的采集 JSON →
抓正文 → 每篇 JSON+MD 归档 → 按链接去重 → 可选桥接路远笔记。

## 目录

```
app/          原生无障碍 App（剪贴板捕获+正文抓取+SYNC_FORMAT 落盘），CI 自动编 APK
autox/        AutoX.js 脚本（P30 主力采集：自检 + 公众号导航采集）
docs/         手机↔PC 接口契约
```

## CI

push 到 main 自动编 debug APK（固定签名可覆盖安装），artifact 名 `app-debug`。
本地无 Android SDK 也能推（CI 用 setup-gradle 装 Gradle 8.7，无需 wrapper）。
推送工具在 PC 侧 `D:\GzhHarvester\tools\push_111.py`（走 api.github.com REST，不依赖 git push）。

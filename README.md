# GzhHarvester · 公众号采集器（手机端）

> 中南大学个人用的公众号通知采集工具（手机端）。仓库 `luheflyfly/111`。

## 原理（方案 C：无障碍半自动采集）

- 用**无障碍服务**监听剪贴板：你在微信里打开公众号文章，长按标题 → **复制链接**，
  本 App 自动捕获链接、抓正文、按 SYNC_FORMAT 契约落成路远笔记
  （`device:"phone"`、`source:"manual"`、`tags:["通知","<号名>"]、schema:1、按链接去重）。
- 也支持：微信文章右上角 ⋯ → 分享 → 公众号采集器；以及 App 里手动粘贴链接。
- 正文抓取走 jsoup `#js_content`（公众号文章是公开网页），与路远手机端 v1.6.1 同管线思路。
- 数据落在用户自选的文件夹（建议选手机的 `Luyuan/`，Syncthing 自动同步到电脑）。

## 红线

只读、只供个人阅读整理；不 hook 微信、不自动发消息、不公开转载。

## 构建

GitHub Actions：push 到 main 自动编 debug APK（固定签名，可覆盖安装），artifact 名 `app-debug`。
本地无 Android SDK 也可推（CI 用 setup-gradle 装 Gradle 8.7，无需 wrapper）。

## 目录

```
app/src/main/java/com/gzh/harvester/
├─ CaptureService.kt   无障碍服务（剪贴板捕获入口）
├─ Engine.kt           采集中枢（去重/编排/提示）
├─ Fetcher.kt          jsoup 正文抓取
├─ NoteWriter.kt       SYNC_FORMAT 笔记落盘（SAF）
├─ Store.kt            本地采集记录
└─ MainActivity.kt     界面（状态/选目录/手动添加/列表）
```

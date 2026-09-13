# 手机 ↔ PC 接口契约

> 手机侧（AutoX.js / 原生App）产出 JSON，PC 端 `phone_ingest.py` 消费。改任何一边前先对齐本文档。

## 1. AutoX.js 公众号采集产出（`/sdcard/ghz_outbox/gzh_<号名>_<时间戳>.json`）

```json
{
  "type": "gzh_articles",
  "account": "中南大学图书馆",
  "collected_at": "2026-09-14T01:23:45.678Z",
  "device": "HUAWEI ELE-AL00",
  "items": [
    { "title": "关于图书馆开放时间调整的通知", "url": "https://mp.weixin.qq.com/s/xxxx", "date_hint": "09-12" },
    { "title": "数据库试用公告", "url": "", "date_hint": "昨天" }
  ]
}
```

- `type` 必须是 `gzh_articles`，PC 端其他类型直接挪进 `inbox/bad/`。
- `url` 允许为空串（手机端点开复制链接失败的那篇），PC 端会跳过并记日志。
- `date_hint`：手机屏上看到的原始日期文案（`昨天`/`前天`/`9月7日`/`2026-09-07`/`09-07`），
  PC 端尽力转成发布时间，转不出用 `collected_at`。

## 2. 原生 App 直接落盘（不经 PC）

原生 App 采到的文章**不产中间 JSON**，直接按 `D:\Luyuan\SYNC_FORMAT.md` 契约写笔记：
`device:"phone"`、`source:"manual"`、`tags:["通知","<号名>"]`、`schema:1`、
文件名 `yyyy-MM-dd_HH-mm-ss_<id前8位>.json`，写入前扫目录按链接查重。

## 3. PC 端处理规则（phone_ingest.py）

- 只认 `inbox/*.json`；处理成功挪 `inbox/done/`，坏文件挪 `inbox/bad/`，不重复入库。
- 去重与 PC 工具共用 `state/state.json`（按链接，每号一个 seen_links）。
- 正文抓取复用 `app/extractor.py`（requests + `#js_content`）。
- 落盘复用 `app/writer.py`：`output/<号名>/yyyy-MM-dd_标题.json + .md`。
- 桥接开关沿用 `config/settings.json` 的 `bridge_enabled`（默认关）。

## 4. 频率约定（红线）

- 手机采集是"人肉频次"：一天一两个号、每号一次，别循环跑。
- PC 入库只在手动双击时跑，无后台轮询。

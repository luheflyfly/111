/**
 * 02_公众号文章采集.js —— GzhHarvester 手机侧主采集脚本（方案 C：无障碍读屏，不 hook 微信）
 *
 * 流程：微信 → 搜索公众号名 → 进号主页 → 消息列表 → 逐篇点开 → 右上角⋯ → 复制链接
 *       → 从剪贴板拿真实链接 → 返回 → 下一篇。结果 JSON 落 /sdcard/ghz_outbox/，等 PC 入库。
 *
 * 红线：只读、低频、个人使用。每步之间有随机延迟，别把参数改激进。
 *
 * 卡住时不要慌：每一步失败都会把屏幕上的文字 dump 到 /sdcard/ghz_outbox/debug/，
 * 把那些文件发给维护会话就能校准选择器（微信改版 = 选择器要跟）。
 */

var OUT_DIR = "/sdcard/ghz_outbox/";
var DEBUG_DIR = OUT_DIR + "debug/";

// ====== 配置（也可用 /sdcard/ghz_outbox/config.json 覆盖：{"accounts":[..],"max_articles":20}）======
var ACCOUNTS = ["中南大学"];
var MAX_ARTICLES = 20;   // 每个号一次最多采几篇（服务号每月才推4次，够用）
var MAX_SCROLLS = 15;    // 每个号最多下滑几次列表

// UI 文案黑名单：采集标题时跳过这些界面文字
var LABELS = ["公众号", "消息", "视频", "服务", "商品", "主页", "更多", "进入公众号",
    "微信", "通讯录", "发现", "我", "搜索", "朋友圈", "全部消息", "查看历史消息",
    "查看消息", "服务通知", "投诉", "取消关注", "已关注", "关注", "简介"];

(function loadConfig() {
    try {
        if (files.exists(OUT_DIR + "config.json")) {
            var cfg = JSON.parse(files.read(OUT_DIR + "config.json"));
            if (cfg.accounts && cfg.accounts.length) ACCOUNTS = cfg.accounts;
            if (cfg.max_articles) MAX_ARTICLES = cfg.max_articles;
        }
    } catch (e) { /* 配置坏了就用默认 */ }
})();

function main() {
    if (auto.service == null) {
        toastLog("无障碍服务没开，先跑 01_权限自检.js 按提示开服务");
        exit();
    }
    files.ensureDir(OUT_DIR);
    files.ensureDir(DEBUG_DIR);

    var summary = [];
    for (var i = 0; i < ACCOUNTS.length; i++) {
        var name = ACCOUNTS[i];
        toastLog("[" + (i + 1) + "/" + ACCOUNTS.length + "] 开始采集：" + name);
        try {
            var n = harvest(name);
            summary.push(name + "：" + n + " 篇");
        } catch (e) {
            debugDump("异常_" + name, "exception: " + e);
            summary.push(name + "：出错（看 debug 文件夹）");
        }
        pause(3000, 6000);
    }
    toastLog("全部完成！\n" + summary.join("\n") + "\n文件在 " + OUT_DIR);
}

function harvest(account) {
    var items = {};   // url -> {title,url,date_hint}
    var processed = {}; // title -> true

    if (!gotoWeChatHome()) return 0;
    if (!clickSearch()) return 0;
    if (!typeQuery(account)) return 0;
    clickGzhFilter(account);
    if (!clickFirstGzhResult(account)) return 0;
    openMessageList();

    var scrolls = 0;
    var idleScrolls = 0;
    while (Object.keys(items).length < MAX_ARTICLES && scrolls <= MAX_SCROLLS) {
        var rows = collectVisibleRows();
        var clicked = false;
        for (var i = 0; i < rows.length; i++) {
            var row = rows[i];
            if (processed[row.title] || items[row.url]) continue;
            processed[row.title] = true;
            toastLog("已收 " + Object.keys(items).length + "/" + MAX_ARTICLES + "：点开《" +
                row.title.substring(0, 18) + "》");
            var url = copyLinkOfCurrentArticle(row.node);
            if (url) {
                items[url] = { title: row.title, url: url, date_hint: row.dateHint };
            } else {
                // 链接没拿到也要记标题（PC 端会知道这篇没链接）
                items["no_url_" + Object.keys(items).length] =
                    { title: row.title, url: "", date_hint: row.dateHint };
            }
            clicked = true;
            if (Object.keys(items).length >= MAX_ARTICLES) break;
        }
        if (!clicked) {
            idleScrolls += 1;
            if (idleScrolls > 2) break; // 连着3屏没有新东西，收工
        } else {
            idleScrolls = 0;
        }
        scrollDown();
        scrolls += 1;
        pause(1500, 3000);
    }

    var arr = [];
    for (var u in items) {
        if (items[u].url) arr.push(items[u]);
    }
    var out = {
        type: "gzh_articles",
        account: account,
        collected_at: new Date().toISOString(),
        device: device.brand + " " + device.model,
        items: arr
    };
    var stamp = new Date();
    var fname = "gzh_" + account + "_" + fullStamp() + ".json";
    files.write(OUT_DIR + fname, JSON.stringify(out, null, 1));
    toastLog("「" + account + "」采到 " + arr.length + " 篇，已存 " + fname);
    return arr.length;
}

// ---------- 步骤函数（每步失败都 dump 现场） ----------

function gotoWeChatHome() {
    app.launch("com.tencent.mm");
    pause(2500, 3500);
    if (currentPackage() != "com.tencent.mm") {
        app.launch("com.tencent.mm");
        pause(3000, 4000);
    }
    // 可能停在公众号主页/文章页/聊天里：最多按 4 次返回，直到看到底部"微信"标签
    var tries = 0;
    while (text("微信").exists() === false && tries < 4) {
        back();
        pause(900, 1400);
        tries += 1;
    }
    var tab = text("微信").findOne(2500);
    if (tab) {
        clickCenter(tab);
        pause(1200, 1800);
    }
    if (currentPackage() != "com.tencent.mm" || desc("搜索").findOne(2000) === null) {
        debugDump("gotoWeChatHome", "回不到微信主页（找不到搜索按钮），当前包: " + currentPackage());
        return false;
    }
    return true;
}

function clickSearch() {
    var o = desc("搜索").findOne(3000) || descContains("搜索").findOne(2000);
    if (!o) {
        debugDump("clickSearch", "没找到搜索按钮");
        return false;
    }
    clickCenter(o);
    pause(1500, 2500);
    return true;
}

function typeQuery(account) {
    // className 必须给全类名，写 "EditText" 匹配不到
    var e = className("android.widget.EditText").findOne(5000);
    if (!e) {
        debugDump("typeQuery", "没找到搜索输入框");
        return false;
    }
    e.setText(account);
    pause(2500, 3500); // 等搜索结果
    return true;
}

function clickGzhFilter(account) {
    var f = text("公众号").findOne(2500);
    if (f) {
        clickCenter(f);
        pause(2000, 3000);
    } else {
        debugDump("clickGzhFilter", "没找到「公众号」筛选（可能直接出结果了），继续");
    }
}

function clickFirstGzhResult(account) {
    var cands = textContains(account).find();
    var pick = null, pickTop = 999999;
    cands.each(function (o) {
        try {
            var b = o.bounds();
            var cls = "" + o.className();
            // 跳过输入框/筛选条（300px 以上），取最靠上的真正结果行
            if (b.top > 300 && cls.indexOf("EditText") < 0 && b.height() > 20 && b.top < pickTop) {
                pick = o;
                pickTop = b.top;
            }
        } catch (e) { }
    });
    if (!pick) {
        debugDump("clickFirstGzhResult", "没找到含「" + account + "」的结果行");
        back(); pause(1000, 1500);
        return false;
    }
    clickCenter(pick);
    pause(3000, 4500); // 等号主页加载
    return true;
}

function openMessageList() {
    var m = text("消息").findOne(3500);
    if (m) {
        clickCenter(m);
        pause(2500, 4000); // 等列表加载
    } else {
        debugDump("openMessageList", "没找到「消息」标签（有的号主页直接就是列表，继续试试）");
    }
}

// 把屏幕上可见的文章行收集出来：标题 + 同行/邻行的日期提示
function collectVisibleRows() {
    var rows = [];
    var buckets = {}; // y 分桶：同桶算一行
    var all = textMatches(/[\s\S]+/).find();
    all.each(function (o) {
        try {
            var t = o.text();
            if (!t) return;
            t = t.trim();
            if (!t || t.length < 2) return;
            var b = o.bounds();
            if (b.top <= 0 || b.left < 0) return;
            var key = Math.round(b.centerY() / 70);
            if (!buckets[key]) buckets[key] = [];
            buckets[key].push({ t: t, o: o, y: b.centerY() });
        } catch (e) { }
    });
    for (var k in buckets) {
        var bucket = buckets[k];
        var title = null, dateHint = "", node = null;
        for (var j = 0; j < bucket.length; j++) {
            var t = bucket[j].t;
            if (isDateHint(t)) { dateHint = t; continue; }
            if (isLabel(t)) continue;
            if (title === null && t.length >= 8) { title = t; node = bucket[j].o; }
        }
        // 日期常在标题的上下相邻桶，补看相邻桶
        if (title !== null && !dateHint) {
            for (var dk in buckets) {
                if (Math.abs(dk - k) <= 1) {
                    for (var j2 = 0; j2 < buckets[dk].length; j2++) {
                        if (isDateHint(buckets[dk][j2].t)) { dateHint = buckets[dk][j2].t; break; }
                    }
                }
                if (dateHint) break;
            }
        }
        if (title !== null && node !== null) rows.push({ title: title, dateHint: dateHint, node: node });
    }
    return rows;
}

function isLabel(t) {
    for (var i = 0; i < LABELS.length; i++) {
        if (t === LABELS[i]) return true;
    }
    return false;
}

function isDateHint(t) {
    if (/^(昨天|前天|今天|刚刚)$/.test(t)) return true;
    if (/^\d{1,2}月\d{1,2}日$/.test(t)) return true;
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(t)) return true;
    if (/^\d{1,2}-\d{1,2}$/.test(t)) return true;
    return false;
}

// 当前应该在文章页：右上角 ⋯ → 复制链接 → 读剪贴板 → 返回列表
function copyLinkOfCurrentArticle(titleNode) {
    clickCenter(titleNode);
    pause(2500, 4000); // 等文章页
    var more = desc("更多").findOne(2500) || descContains("更多").findOne(1500);
    if (!more) {
        // 有的版本 ⋯ 没有 desc，试右上角坐标兜底
        var w = device.width, h = device.height;
        click(w - 80, 170);
        pause(1200, 1800);
    } else {
        clickCenter(more);
        pause(1000, 1800);
    }
    var copy = text("复制链接").findOne(3000);
    var url = "";
    if (copy) {
        // 复制前先放个占位，便于判断剪贴板是否真的更新（安卓10后台读剪贴板可能失败）
        try { setClip("ghz_wait_" + Date.now()); } catch (e0) {}
        clickCenter(copy);
        for (var t = 0; t < 6; t++) {
            pause(400, 600);
            try { url = "" + getClip(); } catch (e1) { url = ""; }
            if (url.indexOf("mp.weixin.qq.com") >= 0) break;
            url = "";
        }
        if (!url) {
            debugDump("copyLink", "点了复制链接但读不到链接（可能是安卓10后台剪贴板限制）");
        }
    } else {
        debugDump("copyLink", "菜单里没找到「复制链接」");
        back(); // 关菜单
        pause(800, 1200);
    }
    back(); // 回列表
    pause(1500, 2500);
    return url;
}

// ---------- 工具 ----------

function clickCenter(o) {
    var b = o.bounds();
    click(Math.round((b.left + b.right) / 2), Math.round((b.top + b.bottom) / 2));
}

function pause(a, b) {
    sleep(Math.round(a + Math.random() * (b - a)));
}

function fullStamp() {
    var d = new Date();
    function p(n) { return (n < 10 ? "0" : "") + n; }
    return "" + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) +
        "_" + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
}

function debugDump(step, note) {
    var lines = ["step: " + step, "note: " + note, "time: " + new Date().toLocaleString(),
        "package: " + currentPackage(), "--- 屏幕上的文字 ---"];
    try {
        var all = textMatches(/[\s\S]+/).find();
        all.each(function (o) {
            try {
                var t = o.text();
                if (t && t.trim()) lines.push(t.trim());
            } catch (e) { }
        });
    } catch (e2) {
        lines.push("读屏失败: " + e2);
    }
    try {
        files.ensureDir(DEBUG_DIR);
        files.write(DEBUG_DIR + step + "_" + fullStamp() + ".txt", lines.join("\n"));
        toastLog("卡在「" + step + "」，现场已存 debug 文件夹");
    } catch (e3) { }
}

main();

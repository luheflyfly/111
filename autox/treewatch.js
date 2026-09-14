/**
 * treewatch.js v3 —— 常驻：抓无障碍树里 mp.weixin.qq.com 链接 → treewatch.txt
 * v3：记录所有来源（微信 webview / 浏览器）；微信文章页的 URL 带 pass_ticket，
 *     PC 端已实测可直接 requests 抓正文。列表页等噪音由 PC 端过滤（action=getapp_msglist）。
 * 去抖：同一 sn 3 秒内不重复写，去重交给 PC 端 sn 集合。
 */
var OUT = "/sdcard/ghz_outbox/treewatch.txt";
files.ensureDir("/sdcard/ghz_outbox/");
files.write(OUT, "=== treewatch v3 started " + new Date().toLocaleString() + " ===\n");

var lastSn = "";
var lastAt = 0;

setInterval(function () {
    try {
        var hit = "";
        var n = textMatches(/.*mp\.weixin\.qq\.com.*/).find();
        n.each(function (o) {
            try {
                var u = "" + o.text();
                if (!u || u.indexOf("mp.weixin.qq.com") < 0) u = "" + o.desc();
                if (u.indexOf("mp.weixin.qq.com") >= 0 && u.indexOf("sn=") >= 0) {
                    hit = u;
                }
            } catch (e) {}
        });
        var dd = new Date();
        if (hit) {
            var snm = hit.match(/sn=([0-9a-f]+)/);
            var sn = snm ? snm[1] : hit;
            var now = dd.getTime();
            if (sn !== lastSn || now - lastAt > 3000) {
                lastSn = sn;
                lastAt = now;
                var ts = ("0" + dd.getHours()).slice(-2) + ":" + ("0" + dd.getMinutes()).slice(-2) +
                    ":" + ("0" + dd.getSeconds()).slice(-2);
                files.append(OUT, "[" + ts + "] " + hit + "\n");
            }
        }
    } catch (e) {}
}, 1200);

toastLog("treewatch v3 已启动");
setInterval(function () {}, 10000);

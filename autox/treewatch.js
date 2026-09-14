/**
 * treewatch.js —— 常驻：抓无障碍树里 mp.weixin.qq.com 链接 → treewatch.txt
 * v2：按「节点自身包名」过滤（只收浏览器节点），微信内 H5 泄漏整列表链接被排除。
 * 诊断模式：把看到的包名样本也记下来，便于校准。
 */
var OUT = "/sdcard/ghz_outbox/treewatch.txt";
files.ensureDir("/sdcard/ghz_outbox/");
files.write(OUT, "=== treewatch v2 started " + new Date().toLocaleString() + " ===\n");

var lastSn = "";
var diagAt = 0;

setInterval(function () {
    try {
        var hit = "";
        var pkgs = {};
        var n = textMatches(/.*mp\.weixin\.qq\.com.*/).find();
        n.each(function (o) {
            try {
                var pk = "" + o.packageName();
                pkgs[pk] = (pkgs[pk] || 0) + 1;
                var u = "" + o.text();
                if (!u || u.indexOf("mp.weixin.qq.com") < 0) u = "" + o.desc();
                if (u.indexOf("mp.weixin.qq.com") >= 0 && pk.indexOf("browser") >= 0) {
                    hit = u;
                }
            } catch (e) {}
        });
        var dd = new Date();
        // 每 15 秒记一次包名样本（诊断）
        if (dd.getTime() - diagAt > 15000) {
            diagAt = dd.getTime();
            var keys = [];
            for (var k in pkgs) keys.push(k + "x" + pkgs[k]);
            files.append(OUT, "[diag] " + keys.join(", ") + "\n");
        }
        if (hit) {
            var snm = hit.match(/sn=([0-9a-f]+)/);
            var sn = snm ? snm[1] : hit;
            if (sn !== lastSn) {
                lastSn = sn;
                var ts = ("0" + dd.getHours()).slice(-2) + ":" + ("0" + dd.getMinutes()).slice(-2) +
                    ":" + ("0" + dd.getSeconds()).slice(-2);
                files.append(OUT, "[" + ts + "] " + hit + "\n");
            }
        }
    } catch (e) {}
}, 1200);

toastLog("treewatch v2 已启动");
setInterval(function () {}, 10000);

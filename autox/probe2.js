/**
 * probe2.js —— 读当前屏幕（给浏览器地址栏用）：所有 text/desc 含 http 或地址栏特征的节点 → probe2.txt
 */
sleep(2500);
var OUT = "/sdcard/ghz_outbox/probe2.txt";
var lines = [];
lines.push("=== probe2 " + new Date().toLocaleString() + " pkg=" + currentPackage() + " ===");
try {
    var n = textMatches(/[\s\S]+/).find();
    n.each(function (o) {
        try {
            var t = o.text();
            if (t && t.indexOf("http") >= 0) lines.push("TEXT: " + t);
        } catch (e) {}
    });
    var d = descMatches(/[\s\S]+/).find();
    d.each(function (o) {
        try {
            var s = o.desc();
            if (s && (s.indexOf("http") >= 0 || s.indexOf("搜索") >= 0 || s.indexOf("网址") >= 0)) {
                var b = o.bounds();
                lines.push("DESC: " + s + "  @" + b.centerX() + "," + b.centerY());
            }
        } catch (e2) {}
    });
} catch (e) { lines.push("err: " + e); }
files.ensureDir("/sdcard/ghz_outbox/");
files.write(OUT, lines.join("\n"));

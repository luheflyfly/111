/**
 * testwatch.js —— 隔离诊断：谁在抛异常？
 */
var OUT = "/sdcard/ghz_outbox/testwatch.txt";
files.write(OUT, "=== test " + new Date().toLocaleString() + " ===\n");

var i = 0;
setInterval(function () {
    i += 1;
    var step = "";
    try { files.append(OUT, "tick " + i + "\n"); step = "append-ok"; } catch (e) { return; }
    try {
        var n = textMatches(/[\s\S]+/).find();
        files.append(OUT, "  find=" + n.length + "\n");
        var pkgSample = "?";
        n.each(function (o) {
            try { pkgSample = "" + o.packageName(); } catch (e1) { pkgSample = "ERR:" + e1; }
            return true; // 想只取第一个——AutoJs6 each 返回值未必中断，无所谓
        });
        files.append(OUT, "  pkgSample=" + pkgSample + "\n");
    } catch (e2) {
        files.append(OUT, "  FIND-ERR: " + e2 + "\n");
    }
}, 3000);

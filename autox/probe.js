/**
 * 探针：把当前屏幕上 AutoJs6 无障碍能读到的所有有文字/描述/可点节点落盘。
 * 用 adb broadcast 远程触发，结果在 /sdcard/ghz_outbox/probe.txt
 */
var OUT = "/sdcard/ghz_outbox/probe.txt";
sleep(3500); // 等外部把微信切回前台
var lines = [];
lines.push("=== probe " + new Date().toLocaleString() + " ===");
lines.push("package: " + currentPackage());

function dumpSel(label, sel) {
    lines.push("--- " + label + " ---");
    try {
        var n = sel.find();
        lines.push("count=" + n.length);
        n.each(function (o) {
            try {
                var b = o.bounds();
                lines.push("[" + b.left + "," + b.top + "][" + b.right + "," + b.bottom + "] " +
                    ("" + o.className()).split(".").pop() +
                    (o.clickable() ? " C" : "  ") +
                    " t=" + JSON.stringify(o.text()) +
                    " d=" + JSON.stringify(o.desc()) +
                    " id=" + ("" + o.id()).replace(/^.*\//, ""));
            } catch (e) { lines.push("node err " + e); }
        });
    } catch (e) { lines.push("sel err: " + e); }
}

dumpSel("全部有文本节点", textMatches(/[\s\S]+/));
dumpSel("全部有描述节点", descMatches(/[\s\S]+/));

files.ensureDir("/sdcard/ghz_outbox/");
files.write(OUT, lines.join("\n"));
toast("probe done");

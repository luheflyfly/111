/**
 * clipwatch.js —— 常驻剪贴板监视：内容变化就追加到 /sdcard/ghz_outbox/clip.txt
 * 用于 PC 侧 OCR+tap 流程拿文章链接（微信里点"复制链接"后 PC 轮询此文件）。
 * 启动后常驻（AutoJs6 通知栏可见），音量上键可停。
 */
var OUT = "/sdcard/ghz_outbox/clip.txt";
files.ensureDir("/sdcard/ghz_outbox/");
files.write(OUT, "=== clipwatch started " + new Date().toLocaleString() + " ===\n");

var last = "";
try { last = "" + getClip(); } catch (e) { last = ""; }

setInterval(function () {
    try {
        var c = "" + getClip();
        if (c && c !== last) {
            last = c;
            var d = new Date();
            var hh = ("0" + d.getHours()).slice(-2), mm = ("0" + d.getMinutes()).slice(-2),
                ss = ("0" + d.getSeconds()).slice(-2);
            files.append(OUT, "[" + hh + ":" + mm + ":" + ss + "] " + c + "\n");
        }
    } catch (e) {
        // 安卓10后台读剪贴板可能受限：记一次错误（限频，10秒一条）
        var d2 = new Date();
        if (d2.getSeconds() < 7) {
            files.append(OUT, "[err] " + e + "\n");
        }
    }
}, 700);

toastLog("clipwatch 已启动（常驻）");
setInterval(function () {}, 10000); // 保活主线程

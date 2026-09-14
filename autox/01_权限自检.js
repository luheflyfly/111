/**
 * 01_权限自检.js —— P30 上跑的第一个脚本（最大的未知数就用它验证）
 *
 * 作用：逐项检查 AutoJs6 在这台手机上能不能干活，结果弹 toast + 落一份报告文件。
 * 用法：AutoJs6 里导入本文件 → 点运行 → 看屏幕提示 + /sdcard/ghz_outbox/自检报告.txt
 */

var OUT_DIR = "/sdcard/ghz_outbox/";

function main() {
    var lines = [];
    lines.push("=== GzhHarvester 自检 " + new Date().toLocaleString() + " ===");
    lines.push("机型: " + device.brand + " " + device.model + " | 安卓 " + device.release + " (SDK " + device.sdkInt + ")");

    // 1. 无障碍服务
    if (auto.service == null) {
        toastLog("【X】无障碍服务没开！\n去 系统设置→辅助功能→无障碍→AutoJs6 打开开关，再重新运行本脚本");
        lines.push("无障碍服务: 未开启（脚本无法工作）");
        finish(lines);
        exit();
    }
    toastLog("① 无障碍服务 OK");
    lines.push("无障碍服务: OK");

    // 2. 悬浮窗/选择器基本能力
    try {
        var w = auto.windowRoots();
        lines.push("窗口树读取: OK (" + (w ? w.length : 0) + " 个根)");
        toastLog("② 窗口树读取 OK");
    } catch (e) {
        lines.push("窗口树读取: 失败 " + e);
    }

    // 3. 剪贴板
    try {
        setClip("ghz_selftest_" + Date.now());
        var back = getClip();
        if (("" + back).indexOf("ghz_selftest_") == 0) {
            lines.push("剪贴板读写: OK");
            toastLog("③ 剪贴板 OK");
        } else {
            lines.push("剪贴板读写: 读回异常: " + back);
        }
    } catch (e2) {
        lines.push("剪贴板读写: 失败 " + e2);
    }

    // 4. 文件写入
    try {
        files.ensureDir(OUT_DIR);
        files.write(OUT_DIR + "写测试.txt", "ok " + Date.now());
        lines.push("文件写入: OK（" + OUT_DIR + "）");
        toastLog("④ 文件写入 OK");
    } catch (e3) {
        lines.push("文件写入: 失败 " + e3 + "（去系统设置给 AutoJs6 存储权限）");
        toastLog("【X】文件写入失败，给 AutoJs6 存储权限后重试");
    }

    // 5. 微信是否安装
    try {
        var pkg = app.getPackageName("微信");
        lines.push("微信安装: " + pkg);
        toastLog("⑤ 微信已安装");
    } catch (e4) {
        lines.push("微信安装: 检测失败 " + e4);
    }

    // 6. 点击手势（无障碍代按）
    try {
        // 不真点，只验证 gesture API 存在
        lines.push("点击手势 API: " + (typeof click == "function" ? "OK" : "缺失"));
    } catch (e5) {
        lines.push("点击手势: 异常 " + e5);
    }

    lines.push("=== 自检完成：如果上面没有【X】，就可以跑 02_公众号文章采集.js 了 ===");
    finish(lines);
    toastLog("自检完成！报告在 " + OUT_DIR + "自检报告.txt\n（共 " + lines.length + " 行）");
}

function finish(lines) {
    try {
        files.ensureDir(OUT_DIR);
        files.append(OUT_DIR + "自检报告.txt", lines.join("\n") + "\n\n");
    } catch (e) {
        console.error("报告写不进去: " + e);
    }
}

main();

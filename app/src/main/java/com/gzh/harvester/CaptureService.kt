package com.gzh.harvester

import android.accessibilityservice.AccessibilityService
import android.content.ClipboardManager
import android.view.accessibility.AccessibilityEvent

/**
 * 无障碍采集服务：用户在微信里长按文章 → 复制链接，剪贴板出现 mp.weixin.qq.com 链接时自动收录。
 * 只读剪贴板文本与窗口变化事件，不做任何按键注入，不上传数据。
 */
class CaptureService : AccessibilityService() {

    private var lastClip = ""

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
        Engine.log("采集服务已连接")
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event != null && event.packageName == "com.tencent.mm") {
            checkClipboard()
        }
    }

    override fun onInterrupt() {}

    override fun onDestroy() {
        instance = null
        Engine.log("采集服务已断开")
        super.onDestroy()
    }

    private fun checkClipboard() {
        try {
            val cm = getSystemService(CLIPBOARD_SERVICE) as ClipboardManager
            val clip = cm.primaryClip ?: return
            if (clip.itemCount == 0) return
            val item = clip.getItemAt(0) ?: return
            val text = item.coerceToText(this)?.toString() ?: return
            if (text == lastClip) return
            lastClip = text
            val url = Engine.extractMpUrl(text) ?: return
            Engine.capture(applicationContext, url, null, "复制链接")
        } catch (e: Exception) {
            Engine.log("剪贴板读取失败: " + (e.message ?: "unknown"))
        }
    }

    companion object {
        @Volatile
        var instance: CaptureService? = null
            private set

        val isRunning: Boolean
            get() = instance != null
    }
}

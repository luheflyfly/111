package com.gzh.harvester

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.widget.Toast
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter

/**
 * 采集中枢：去重 → 抓正文 → 写路远笔记 → 提示。所有采集入口（剪贴板/分享/手动）都汇到这里。
 */
object Engine {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val main = Handler(Looper.getMainLooper())

    private var lastToastAt = 0L
    private var lastToastText = ""

    var onStoreChanged: (() -> Unit)? = null

    // 公众号文章两种链接形态：/s/xxxx 与 /s?__biz=...&mid=...&idx=...&sn=...
    private val URL_RE = Regex("https?://mp\\.weixin\\.qq\\.com/s[A-Za-z0-9/_?=&.\\-#%~]*")
    private val TRIM_TAIL = ".,;、)）】》\"'，。；：:！？!?"

    fun extractMpUrl(text: String?): String? {
        if (text.isNullOrEmpty()) return null
        val m = URL_RE.find(text) ?: return null
        val url = m.value.trimEnd(*TRIM_TAIL.toCharArray())
        if (url.endsWith("/s") || url.endsWith("/s?")) return null
        return url
    }

    fun dedupeKey(url: String): String {
        return url.substringAfter(".com/").substringBefore("#")
    }

    fun log(msg: String) {
        Log.i("GzhHarvester", msg)
    }

    fun capture(appContext: Context, url: String, sharedTitle: String?, source: String) {
        val ctx = appContext.applicationContext
        val key = dedupeKey(url)
        scope.launch {
            log("capture(" + source + "): " + url)
            if (Store.has(ctx, key)) {
                toast(ctx, "这篇已经收过了")
                return@launch
            }
            if (NoteWriter.containsUrl(ctx, url)) {
                Store.add(ctx, url, sharedTitle ?: "", "", source, "已在路远，跳过")
                toast(ctx, "这篇文章之前已存进路远，跳过")
                notifyUi()
                return@launch
            }
            val fetched = try {
                Fetcher.fetch(url)
            } catch (e: Exception) {
                log("fetch error: " + (e.message ?: "unknown"))
                Fetcher.FetchResult(sharedTitle ?: "", "", "", true, "")
            }
            val title = fetched.title.ifBlank { sharedTitle ?: "未命名文章" }
            if (fetched.body.isBlank() && fetched.title.isBlank() && sharedTitle == null) {
                // 标题正文都拿不到：不落盘不记日志，用户下次复制还会重试
                toast(ctx, "这篇暂时抓不到（网络或平台拦截），稍后再试一次")
                return@launch
            }
            if (!NoteWriter.treeConfigured(ctx)) {
                Store.add(ctx, url, title, fetched.account, source, "未选保存文件夹，仅本地记录")
                toast(ctx, "已记录。请到 App 里点「② 选择保存文件夹」，之后才能同步进路远")
                notifyUi()
                return@launch
            }
            val wrote = try {
                NoteWriter.write(ctx, url, title, fetched.account.ifBlank { "公众号" },
                    fetched.body, fetched.publishTime)
            } catch (e: Exception) {
                log("write error: " + (e.message ?: "unknown"))
                null
            }
            if (wrote != null) {
                Store.add(ctx, url, title, fetched.account, source, "已存: " + wrote)
                toast(ctx, "已收录《" + title + "》")
            } else {
                Store.add(ctx, url, title, fetched.account, source, "写入失败")
                toast(ctx, "写入文件夹失败，请重新选一次保存位置")
            }
            notifyUi()
        }
    }

    private fun notifyUi() {
        main.post { onStoreChanged?.invoke() }
    }

    fun toast(ctx: Context, text: String) {
        val now = System.currentTimeMillis()
        if (text == lastToastText && now - lastToastAt < 4000) return
        lastToastText = text
        lastToastAt = now
        main.post { Toast.makeText(ctx, text, Toast.LENGTH_LONG).show() }
    }

    fun nowIso(): String {
        return ZonedDateTime.now(ZoneId.of("Asia/Shanghai"))
            .format(DateTimeFormatter.ISO_OFFSET_DATE_TIME)
    }
}

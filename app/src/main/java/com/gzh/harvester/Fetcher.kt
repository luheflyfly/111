package com.gzh.harvester

import okhttp3.OkHttpClient
import okhttp3.Request
import org.jsoup.Jsoup
import org.jsoup.nodes.Element
import org.jsoup.nodes.TextNode
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.concurrent.TimeUnit

/**
 * 公众号文章正文抓取：文章页是公开网页，jsoup 取 #js_content 转纯文本（与路远 v1.6.1 同思路）。
 */
object Fetcher {

    data class FetchResult(
        val title: String,
        val account: String,
        val body: String,
        val blocked: Boolean,
        val publishTime: String = ""
    )

    private val client = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(25, TimeUnit.SECONDS)
        .build()

    private const val UA =
        "Mozilla/5.0 (Linux; Android 13; M2012K11AC) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"

    fun fetch(url: String): FetchResult {
        val req = Request.Builder()
            .url(url)
            .header("User-Agent", UA)
            .header("Referer", "https://mp.weixin.qq.com/")
            .build()
        val html = client.newCall(req).execute().use { resp ->
            val b = resp.body
            if (b == null) "" else b.string()
        }
        if (html.isBlank()) return FetchResult("", "", "", true)
        if (looksBlocked(html)) return FetchResult("", "", "", true)

        val doc = Jsoup.parse(html, url)
        var title = doc.selectFirst("#activity-name")?.text()?.trim() ?: ""
        if (title.isBlank()) {
            title = doc.selectFirst("meta[property=og:title]")?.attr("content")?.trim() ?: ""
        }
        var account = doc.selectFirst("#js_name")?.text()?.trim() ?: ""
        if (account.isBlank()) {
            val m = Regex("var nickname = \"([^\"]+)\"").find(html)
            if (m != null) account = m.groupValues[1].trim()
        }
        var publishTime = ""
        val ct = Regex("var ct = \"(\\d{9,13})\"").find(html)
        if (ct != null) {
            try {
                var ts = ct.groupValues[1].toLong()
                if (ts > 99999999999L) ts /= 1000L
                publishTime = Instant.ofEpochSecond(ts).atZone(ZoneId.of("Asia/Shanghai"))
                    .format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"))
            } catch (e: Exception) {
                publishTime = ""
            }
        }
        val contentEl = doc.selectFirst("#js_content")
        val body = if (contentEl == null) "" else toText(contentEl)
        return FetchResult(title, account, body, false, publishTime)
    }

    private fun looksBlocked(html: String): Boolean {
        val markers = listOf(
            "环境异常", "完成验证后即可继续访问", "该内容暂时无法查看",
            "操作频繁", "当前环境异常"
        )
        for (mk in markers) {
            if (html.contains(mk)) return true
        }
        return false
    }

    private fun toText(root: Element): String {
        val sb = StringBuilder()
        appendNode(root, sb)
        val out = ArrayList<String>()
        var blank = 0
        for (raw in sb.toString().split("\n")) {
            val ln = raw.trim()
            if (ln.isNotEmpty()) {
                out.add(ln)
                blank = 0
            } else {
                blank += 1
                if (blank == 1) out.add("")
            }
        }
        var text = out.joinToString("\n").trim()
        text = text.replace(Regex("\n{3,}"), "\n\n")
        return if (text.length > 30000) text.substring(0, 30000) else text
    }

    private fun appendNode(node: Element, sb: StringBuilder) {
        for (child in node.childNodes()) {
            if (child is TextNode) {
                sb.append(child.text())
            } else if (child is Element) {
                val name = child.tagName()
                if (name == "script" || name == "style" || name == "noscript") continue
                if (name == "br") {
                    sb.append("\n")
                    continue
                }
                appendNode(child, sb)
                if (isBlock(name)) sb.append("\n")
            }
        }
    }

    private fun isBlock(name: String): Boolean {
        return name == "p" || name == "div" || name == "section" || name == "li" ||
            name == "tr" || name == "blockquote" || name == "h1" || name == "h2" ||
            name == "h3" || name == "h4" || name == "h5" || name == "h6" ||
            name == "table" || name == "ul" || name == "ol"
    }
}

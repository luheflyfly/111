package com.gzh.harvester

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * 本地采集记录（App 私有目录），只做展示与快速去重；权威去重以路远目录按链接扫描为准。
 */
data class Capture(
    val url: String,
    val title: String,
    val account: String,
    val source: String,
    val status: String,
    val time: String
)

object Store {

    private fun file(ctx: Context): File = File(ctx.filesDir, "captures.json")

    private fun load(ctx: Context): JSONArray {
        val f = file(ctx)
        if (!f.exists()) return JSONArray()
        return try {
            JSONArray(f.readText(Charsets.UTF_8))
        } catch (e: Exception) {
            JSONArray()
        }
    }

    private fun save(ctx: Context, arr: JSONArray) {
        file(ctx).writeText(arr.toString(), Charsets.UTF_8)
    }

    /** 只有"真正落盘成功"的记录才算收过；抓取失败/写入失败的可以重试。 */
    fun has(ctx: Context, key: String): Boolean {
        val arr = load(ctx)
        for (i in 0 until arr.length()) {
            val o = arr.optJSONObject(i) ?: continue
            if (Engine.dedupeKey(o.optString("url")) == key) {
                val st = o.optString("status")
                if (st.startsWith("已存") || st.startsWith("已在路远")) return true
            }
        }
        return false
    }

    fun add(
        ctx: Context,
        url: String,
        title: String,
        account: String,
        source: String,
        status: String
    ) {
        val arr = load(ctx)
        val o = JSONObject()
        o.put("url", url)
        o.put("title", title)
        o.put("account", account)
        o.put("source", source)
        o.put("status", status)
        o.put("time", Engine.nowIso())
        arr.put(o)
        save(ctx, arr)
    }

    fun latest(ctx: Context, limit: Int): List<Capture> {
        val arr = load(ctx)
        val out = ArrayList<Capture>()
        var i = arr.length() - 1
        while (i >= 0 && out.size < limit) {
            val o = arr.optJSONObject(i)
            if (o != null) {
                out.add(
                    Capture(
                        o.optString("url"), o.optString("title"), o.optString("account"),
                        o.optString("source"), o.optString("status"), o.optString("time")
                    )
                )
            }
            i -= 1
        }
        return out
    }

    fun count(ctx: Context): Int = load(ctx).length()

    fun clear(ctx: Context) {
        file(ctx).delete()
    }
}

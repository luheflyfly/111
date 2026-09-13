package com.gzh.harvester

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.documentfile.provider.DocumentFile
import org.json.JSONArray
import org.json.JSONObject
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.UUID

/**
 * 把文章写成一条 SYNC_FORMAT 笔记（D:\Luyuan\SYNC_FORMAT.md 契约）：
 * id=UUID、created_at/updated_at 带时区、device="phone"、source="manual"、
 * tags=["通知","<号名>"]、schema=1、文件名 yyyy-MM-dd_HH-mm-ss_<id前8位>.json、
 * 写入前按链接在目录里查重。位置：用户选的同步目录下的 notes 子目录（选了 notes 本身则直写）。
 */
object NoteWriter {

    private const val PREFS = "cfg"
    private const val KEY_TREE = "tree_uri"

    fun treeConfigured(ctx: Context): Boolean {
        return treeUri(ctx) != null
    }

    fun treeUri(ctx: Context): Uri? {
        val s = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY_TREE, null) ?: return null
        return try {
            Uri.parse(s)
        } catch (e: Exception) {
            null
        }
    }

    fun setTree(ctx: Context, uri: Uri) {
        ctx.contentResolver.takePersistableUriPermission(
            uri,
            Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
        )
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putString(KEY_TREE, uri.toString()).apply()
    }

    fun notesDir(ctx: Context): DocumentFile? {
        val uri = treeUri(ctx) ?: return null
        val root = DocumentFile.fromTreeUri(ctx, uri) ?: return null
        val rootName = root.name ?: ""
        if (rootName.equals("notes", true)) return root
        return root.findFile("notes") ?: root.createDirectory("notes")
    }

    /** 按链接查重：扫目录里现役笔记 JSON 的 text 字段是否包含该 url。 */
    fun containsUrl(ctx: Context, url: String): Boolean {
        val dir = notesDir(ctx) ?: return false
        var count = 0
        for (f in dir.listFiles()) {
            if (!f.isFile) continue
            val fname = f.name ?: continue
            if (!fname.endsWith(".json")) continue
            count += 1
            if (count > 800) break
            try {
                val text = ctx.contentResolver.openInputStream(f.uri)?.use { input ->
                    input.bufferedReader(Charsets.UTF_8).readText()
                } ?: continue
                if (text.contains(url)) return true
            } catch (e: Exception) {
                continue
            }
        }
        return false
    }

    fun write(
        ctx: Context,
        url: String,
        title: String,
        account: String,
        body: String,
        publishTime: String
    ): String? {
        val dir = notesDir(ctx) ?: return null
        val id = UUID.randomUUID().toString()
        val now = Engine.nowIso()
        val sb = StringBuilder()
        sb.append("【通知】").append(title).append("\n")
        sb.append("来源：").append(account).append("\n")
        if (publishTime.isNotEmpty()) sb.append("发布时间：").append(publishTime).append("\n")
        sb.append("记录时间：").append(now).append("\n")
        sb.append("链接：").append(url).append("\n\n")
        if (body.isNotEmpty()) sb.append(body) else sb.append("（正文没有抓到，点链接看原文）")

        val obj = JSONObject()
        obj.put("id", id)
        obj.put("created_at", now)
        obj.put("updated_at", now)
        obj.put("text", sb.toString())
        obj.put("source", "manual")
        val tags = JSONArray()
        tags.put("通知")
        tags.put(account)
        obj.put("tags", tags)
        obj.put("device", "phone")
        obj.put("schema", 1)

        val stamp = ZonedDateTime.now(ZoneId.of("Asia/Shanghai"))
            .format(DateTimeFormatter.ofPattern("yyyy-MM-dd_HH-mm-ss"))
        val name = stamp + "_" + id.substring(0, 8) + ".json"
        val file = dir.createFile("application/json", name) ?: return null
        ctx.contentResolver.openOutputStream(file.uri)?.use { os ->
            os.write(obj.toString().toByteArray(Charsets.UTF_8))
            os.flush()
        } ?: return null
        return name
    }
}

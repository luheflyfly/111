package com.gzh.harvester

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.graphics.Typeface
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    private val pickTree =
        registerForActivityResult(ActivityResultContracts.OpenDocumentTree()) { uri ->
            if (uri != null) {
                try {
                    NoteWriter.setTree(this, uri)
                    toast("保存位置已设好，之后采集自动同步")
                } catch (e: Exception) {
                    toast("设置保存位置失败：" + (e.message ?: ""))
                }
                refresh()
            }
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        findViewById<Button>(R.id.btn_service).setOnClickListener {
            try {
                startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
                toast("在列表里找到「公众号采集器」，进去打开开关")
            } catch (e: Exception) {
                toast("打不开无障碍设置，请到系统设置里手动找")
            }
        }
        findViewById<Button>(R.id.btn_folder).setOnClickListener { pickTree.launch(null) }
        findViewById<Button>(R.id.btn_add).setOnClickListener {
            val text = findViewById<EditText>(R.id.et_input).text.toString()
            val url = Engine.extractMpUrl(text)
            if (url == null) {
                toast("这不像公众号文章链接（要有 mp.weixin.qq.com）")
            } else {
                Engine.capture(applicationContext, url, null, "手动")
                findViewById<EditText>(R.id.et_input).setText("")
            }
        }
        findViewById<Button>(R.id.btn_clear).setOnClickListener {
            AlertDialog.Builder(this)
                .setTitle("清空本地记录")
                .setMessage("只清 App 里的采集记录列表，已存进路远的笔记不受影响。确定清空吗？")
                .setPositiveButton("清空") { _, _ ->
                    Store.clear(this)
                    refresh()
                }
                .setNegativeButton("算了", null)
                .show()
        }

        handleIntent(intent)
        refresh()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIntent(intent)
        refresh()
    }

    override fun onResume() {
        super.onResume()
        Engine.onStoreChanged = { runOnUiThread { refresh() } }
        refresh()
    }

    override fun onPause() {
        Engine.onStoreChanged = null
        super.onPause()
    }

    private fun handleIntent(intent: Intent?) {
        if (intent == null || intent.action != Intent.ACTION_SEND) return
        val text = intent.getStringExtra(Intent.EXTRA_TEXT) ?: ""
        val subject = intent.getStringExtra(Intent.EXTRA_SUBJECT)
        val url = Engine.extractMpUrl(text)
        if (url == null) {
            toast("分享内容里没有公众号文章链接")
        } else {
            Engine.capture(applicationContext, url, subject, "分享")
        }
    }

    private fun refresh() {
        val serviceOn = CaptureService.isRunning
        val tvStatus = findViewById<TextView>(R.id.tv_status)
        tvStatus.text = if (serviceOn) "● 采集服务：运行中（微信里复制链接即收录）"
        else "● 采集服务：未开启（点下面按钮去开）"
        tvStatus.setTextColor(
            getColor(if (serviceOn) android.R.color.holo_green_dark else android.R.color.darker_gray)
        )
        val folder = NoteWriter.treeUri(this)
        val tvFolder = findViewById<TextView>(R.id.tv_folder)
        tvFolder.text = if (folder == null)
            "○ 保存位置：未选择（建议选手机里的 Luyuan 文件夹，自动同步到电脑路远）"
        else "○ 保存位置：已设置（写入所选目录的 notes 子目录）"

        findViewById<TextView>(R.id.tv_header).text = "最近采集（" + Store.count(this) + " 条）"

        val list = findViewById<LinearLayout>(R.id.list_captures)
        list.removeAllViews()
        val items = Store.latest(this, 50)
        val density = resources.displayMetrics.density
        for (c in items) {
            val row = LinearLayout(this)
            row.orientation = LinearLayout.VERTICAL
            val pad = (12 * density).toInt()
            row.setPadding(pad, pad, pad, pad)
            val t1 = TextView(this)
            t1.text = c.title.ifBlank { c.url }
            t1.textSize = 15f
            t1.setTypeface(null, Typeface.BOLD)
            val shown = c.time.replace("T", " ")
            val t2 = TextView(this)
            t2.text = shown.substring(0, minOf(16, shown.length)) +
                " · " + c.source + " · " + c.status +
                if (c.account.isBlank()) "" else " · " + c.account
            t2.textSize = 12f
            row.addView(t1)
            row.addView(t2)
            row.setOnClickListener { showDetail(c) }
            list.addView(row)
        }
        if (items.isEmpty()) {
            val empty = TextView(this)
            empty.text = "还没有记录。去微信打开一篇公众号文章，长按标题选「复制链接」试试。"
            empty.textSize = 13f
            list.addView(empty)
        }
    }

    private fun showDetail(c: Capture) {
        val msg = c.title + "\n\n" + c.account + "\n" + c.status + "\n\n" + c.url
        AlertDialog.Builder(this)
            .setTitle("采集详情")
            .setMessage(msg)
            .setPositiveButton("复制链接") { _, _ ->
                val cm = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                cm.setPrimaryClip(ClipData.newPlainText("url", c.url))
                toast("链接已复制")
            }
            .setNeutralButton("在浏览器打开") { _, _ ->
                try {
                    startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(c.url)))
                } catch (e: Exception) {
                    toast("打不开")
                }
            }
            .setNegativeButton("关", null)
            .show()
    }

    private fun toast(text: String) {
        Toast.makeText(this, text, Toast.LENGTH_LONG).show()
    }
}

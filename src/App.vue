<script setup>
import { computed, ref } from 'vue'
import { ArrowDownToLine, ArrowRight, Bookmark, CheckCircle2, CircleAlert, FileText, Folder, KeyRound, LoaderCircle, Monitor, ShieldCheck, Upload, Eye, EyeOff } from '@lucide/vue'
import BookmarkTree from './BookmarkTree.vue'
import { mergeTrees, parseChromeBookmarksHtml, parseChromeBookmarksJson } from './bookmarks.js'
import { createKdbx } from './exportKdbx.js'
import { checkFileSelection, checkImportTree, createImportBudget, ImportLimitError } from './importLimits.js'

const files = ref([])
const tree = ref([])
const password = ref('')
const showPassword = ref(false)
const status = ref('')
const statusKind = ref('idle')
const parsing = ref(false)
const exporting = ref(false)
const fileInput = ref(null)
const busy = computed(() => parsing.value || exporting.value)
const stats = computed(() => {
    const result = { bookmarks: 0, folders: 0 }
    function count(items) {
        for (const item of items) {
            if (item.type === 'folder') {
                result.folders++
                count(item.children)
            } else result.bookmarks++
        }
    }
    count(tree.value)
    return result
})

async function handleFiles(event) {
    const selected = Array.from(event.target.files || [])
    if (!selected.length || busy.value) return
    files.value = selected
    tree.value = []
    parsing.value = true
    statusKind.value = 'working'
    status.value = '正在读取并整理书签…'
    const trees = []
    const failed = []
    const consume = createImportBudget()
    try {
        checkFileSelection(selected)
        for (const file of selected) {
            try {
                const text = await file.text()
                let parsed
                try {
                    parsed = parseChromeBookmarksJson(text)
                } catch (error) {
                    if (error instanceof ImportLimitError) throw error
                    parsed = parseChromeBookmarksHtml(text)
                }
                checkImportTree(parsed, consume)
                if (!parsed.length) failed.push(file.name)
                else trees.push(parsed)
            } catch (error) {
                if (error instanceof ImportLimitError) throw error
                failed.push(file.name)
            }
        }
        tree.value = mergeTrees(trees)
        if (failed.length) {
            statusKind.value = 'error'
            status.value = `无法读取书签：${failed.join('、')}。请选择浏览器导出的 HTML 或书签 JSON 文件。${stats.value.bookmarks ? '其余文件已解析，可继续导出。' : ''}`
        } else if (!stats.value.bookmarks) {
            statusKind.value = 'error'
            status.value = '文件中没有可导出的书签，请选择其他文件。'
        } else {
            statusKind.value = 'success'
            status.value = `解析完成，已整理 ${stats.value.bookmarks} 个书签。`
        }
    } catch (error) {
        tree.value = []
        statusKind.value = 'error'
        status.value = error instanceof ImportLimitError ? error.message : '无法整理书签，请检查文件格式。'
    } finally {
        parsing.value = false
        event.target.value = ''
    }
}

async function generateKdbx() {
    if (busy.value || !stats.value.bookmarks) return
    exporting.value = true
    statusKind.value = 'working'
    status.value = '正在生成 KDBX 文件…'
    try {
        const data = await createKdbx(tree.value, password.value)
        const url = URL.createObjectURL(new Blob([data], { type: 'application/octet-stream' }))
        const anchor = document.createElement('a')
        const pad = (n) => String(n).padStart(2, '0')
        const now = new Date()
        const filename = `书签_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.kdbx`
        anchor.href = url
        anchor.download = filename
        document.body.appendChild(anchor)
        try {
            anchor.click()
        } finally {
            anchor.remove()
            setTimeout(() => URL.revokeObjectURL(url), 1000)
        }
        statusKind.value = 'success'
        status.value = `已生成 ${filename}，请查看浏览器下载。`
    } catch (error) {
        statusKind.value = 'error'
        status.value = `生成失败：${error.message || error}`
    } finally {
        exporting.value = false
    }
}
</script>

<template>
    <main class="container">
        <header class="header">
            <div class="brand"><span class="brand-icon"><Bookmark aria-hidden="true" /></span><span>Bookmarks<span class="brand-divider">/</span>KDBX</span></div>
            <span class="theme-label"><Monitor aria-hidden="true" /> 外观跟随系统</span>
        </header>

        <section class="intro" aria-labelledby="page-title">
            <div class="eyebrow">让书签井然有序</div>
            <h1 id="page-title">浏览器书签转 KeePass 数据库</h1>
            <!-- <p>导入浏览器书签，保留目录结构，一键保存为 KeePass 数据库。</p> -->
            <div class="privacy-note"><ShieldCheck aria-hidden="true" /> 所有处理都在本地浏览器完成，文件不会上传。</div>
        </section>

        <div class="workspace">
            <section class="card setup-card" aria-labelledby="import-title">
                <div class="section-heading"><span class="step">01</span><h2 id="import-title">导入与导出</h2></div>
                <input ref="fileInput" class="visually-hidden" type="file" multiple accept=".html,.htm,.json,application/json,text/json,text/html" :disabled="busy" aria-label="选择书签文件" @change="handleFiles" />
                <button class="upload-zone" :disabled="busy" @click="fileInput.click()">
                    <span class="upload-icon"><Upload aria-hidden="true" /></span>
                    <strong>{{ files.length ? '重新选择书签文件' : '选择书签文件' }}</strong>
                    <span>支持 HTML / JSON，可同时选择多个文件</span>
                    <span class="select-label">浏览文件 <ArrowRight aria-hidden="true" /></span>
                </button>
                <ul v-if="files.length" class="file-list" aria-label="已选择的文件">
                    <li v-for="(file, index) in files" :key="index"><FileText aria-hidden="true" /><span>{{ file.name }}</span><span class="file-size">{{ Math.max(1, Math.ceil(file.size / 1024)) }} KB</span></li>
                </ul>
                <div class="export-settings">
                    <label for="password"><KeyRound aria-hidden="true" /> 数据库密码 <span>可选</span></label>
                    <div class="password-field">
                        <input id="password" v-model="password" :type="showPassword ? 'text' : 'password'" autocomplete="new-password" placeholder="输入密码以保护数据库" :disabled="busy" />
                        <button type="button" class="icon-button" :aria-label="showPassword ? '隐藏密码' : '显示密码'" :aria-pressed="showPassword" @click="showPassword = !showPassword"><EyeOff v-if="showPassword" aria-hidden="true" /><Eye v-else aria-hidden="true" /></button>
                    </div>
                    <p class="field-hint">{{ password ? '打开生成的 KDBX 文件时将使用此密码。' : '未设置密码：任何拿到文件的人都能打开并查看书签。' }}</p>
                    <button class="export-button" :disabled="busy || !stats.bookmarks" @click="generateKdbx"><LoaderCircle v-if="exporting" class="spinner" aria-hidden="true" /><ArrowDownToLine v-else aria-hidden="true" />{{ exporting ? '正在生成…' : '生成并下载 .kdbx' }}</button>
                </div>
                <div v-if="status" class="status" :class="statusKind" role="status" aria-live="polite" aria-atomic="true"><LoaderCircle v-if="statusKind === 'working'" class="spinner" aria-hidden="true" /><CircleAlert v-else-if="statusKind === 'error'" aria-hidden="true" /><CheckCircle2 v-else aria-hidden="true" /><span>{{ status }}</span></div>
            </section>

            <section class="card preview-card" aria-labelledby="preview-title" :aria-busy="parsing">
                <div class="preview-header"><div class="section-heading"><span class="step">02</span><h2 id="preview-title">书签预览</h2></div><span class="format-badge">.kdbx</span></div>
                <div v-if="tree.length" class="preview-stats"><span><Bookmark aria-hidden="true" /><strong>{{ stats.bookmarks }}</strong> 个书签</span><span><Folder aria-hidden="true" /><strong>{{ stats.folders }}</strong> 个文件夹</span></div>
                <div v-if="tree.length" class="tree-scroll"><BookmarkTree :items="tree" /></div>
                <div v-else class="empty-state"><span class="empty-icon"><LoaderCircle v-if="parsing" class="spinner" aria-hidden="true" /><Folder v-else aria-hidden="true" /></span><h3>{{ parsing ? '正在整理你的书签' : '你的书签将在这里呈现' }}</h3><p>{{ parsing ? '解析完成后即可预览并导出。' : '选择书签文件后，查看目录和书签内容。' }}</p></div>
                <div class="preview-note"><CheckCircle2 aria-hidden="true" /> 保留文件夹层级，重复 URL 仅保留首次出现的书签。</div>
            </section>
        </div>
        <footer class="footer"><ShieldCheck aria-hidden="true" /> 本地转换 · 隐私优先<span>HTML / JSON <ArrowRight aria-hidden="true" /> KDBX</span></footer>
    </main>
</template>

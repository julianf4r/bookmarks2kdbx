<script setup>
import { Bookmark, ChevronRight, Folder } from '@lucide/vue'

defineProps({ items: { type: Array, required: true } })
</script>

<template>
    <ul class="bookmark-tree">
        <li v-for="(item, index) in items" :key="index">
            <details v-if="item.type === 'folder'" open class="tree-folder">
                <summary>
                    <ChevronRight class="folder-chevron" aria-hidden="true" />
                    <Folder class="folder-icon" aria-hidden="true" />
                    <span class="tree-title">{{ item.title }}</span>
                    <span class="folder-count">{{ item.children.length }}</span>
                </summary>
                <BookmarkTree v-if="item.children.length" :items="item.children" />
                <p v-else class="empty-folder">空文件夹</p>
            </details>
            <div v-else class="tree-entry">
                <Bookmark aria-hidden="true" />
                <div class="entry-content">
                    <span class="entry-title">{{ item.title }}</span>
                    <span class="entry-url">{{ item.url }}</span>
                </div>
            </div>
        </li>
    </ul>
</template>

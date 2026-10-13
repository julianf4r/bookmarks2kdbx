export const IMPORT_LIMITS = Object.freeze({
    bytes: 20 * 1024 * 1024,
    nodes: 20000,
    depth: 64,
})

export class ImportLimitError extends Error {}

export function checkFileSelection(files) {
    let bytes = 0
    for (const file of files) {
        bytes += file.size
        if (bytes > IMPORT_LIMITS.bytes) {
            throw new ImportLimitError('所选文件总大小不能超过 20 MiB。')
        }
    }
}

export function checkImportText(text) {
    if (text.length > IMPORT_LIMITS.bytes || new TextEncoder().encode(text).byteLength > IMPORT_LIMITS.bytes) {
        throw new ImportLimitError('书签文件大小不能超过 20 MiB。')
    }
}

export function createImportBudget() {
    let nodes = 0
    return (folderDepth) => {
        if (folderDepth > IMPORT_LIMITS.depth) {
            throw new ImportLimitError('书签目录深度不能超过 64 层。')
        }
        if (++nodes > IMPORT_LIMITS.nodes) {
            throw new ImportLimitError('书签和文件夹总数不能超过 20,000 个。')
        }
    }
}

export function checkImportTree(items, consume = createImportBudget(), depth = 0) {
    for (const item of items) {
        const folderDepth = depth + (item.type === 'folder' ? 1 : 0)
        consume(folderDepth)
        if (item.type === 'folder') checkImportTree(item.children, consume, folderDepth)
    }
}

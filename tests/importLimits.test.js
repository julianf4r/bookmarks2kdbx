import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeTrees, parseChromeBookmarksJson } from '../src/bookmarks.js'
import { checkFileSelection, checkImportText, checkImportTree, createImportBudget, IMPORT_LIMITS, ImportLimitError } from '../src/importLimits.js'

test('file selection rejects the aggregate byte limit before reading file contents', () => {
    assert.doesNotThrow(() => checkFileSelection([{ size: IMPORT_LIMITS.bytes }]))
    assert.throws(() => checkFileSelection([{ size: IMPORT_LIMITS.bytes }, { size: 1 }]), ImportLimitError)
    assert.throws(() => checkImportText('界'.repeat(Math.floor(IMPORT_LIMITS.bytes / 3) + 1)), ImportLimitError)
})

function nestedJson(depth) {
    return '{"roots":{"other":{"children":[' + '{"type":"folder","children":['.repeat(depth - 1)
        + '{"type":"url","name":"Example","url":"https://example.com"}'
        + ']}'.repeat(depth - 1) + ']}}}'
}

test('directory depth accepts the boundary and rejects deep JSON without a stack overflow', () => {
    assert.doesNotThrow(() => parseChromeBookmarksJson(nestedJson(IMPORT_LIMITS.depth)))
    assert.throws(() => parseChromeBookmarksJson(nestedJson(IMPORT_LIMITS.depth + 1)), ImportLimitError)
    assert.throws(() => parseChromeBookmarksJson(nestedJson(10000)), ImportLimitError)
})

test('node count is limited before deduplication, including across multiple files', () => {
    const bookmark = { type: 'url', name: 'Example', url: 'https://example.com' }
    const json = (count) => JSON.stringify({ roots: { other: { children: Array(count).fill(bookmark) } } })
    assert.doesNotThrow(() => parseChromeBookmarksJson(json(IMPORT_LIMITS.nodes - 1)))
    assert.throws(() => parseChromeBookmarksJson(json(IMPORT_LIMITS.nodes)), ImportLimitError)
    const tree = parseChromeBookmarksJson(json(10000))
    const consume = createImportBudget()
    checkImportTree(tree, consume)
    assert.throws(() => checkImportTree(tree, consume), ImportLimitError)
    assert.throws(() => mergeTrees([tree, tree]), ImportLimitError)
})

test('merge rejects excessive depth before recursive preview or export can see it', () => {
    let item = { type: 'bookmark', title: 'Example', url: 'https://example.com' }
    for (let depth = 0; depth <= IMPORT_LIMITS.depth; depth++) {
        item = { type: 'folder', title: 'Folder', children: [item] }
    }
    assert.throws(() => mergeTrees([[item]]), ImportLimitError)
})

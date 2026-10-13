import test from 'node:test'
import assert from 'node:assert/strict'
import * as kdbxweb from 'kdbxweb'
import { mergeTrees, parseChromeBookmarksJson } from '../src/bookmarks.js'
import { createKdbx } from '../src/exportKdbx.js'

const source = {
    roots: {
        bookmark_bar: {
            name: '书签栏',
            children: [
                { type: 'url', name: '<示例> & 网站', url: 'https://example.com/?a=1&b=2' },
                { type: 'folder', name: '资料', children: [
                    { type: 'url', name: '文档', url: 'https://example.org/docs' },
                    { type: 'url', name: '重复', url: 'https://example.com/?a=1&b=2' }
                ] }
            ]
        }
    }
}

test('JSON parsing and merging preserve folders and the first occurrence of each URL', () => {
    const parsed = parseChromeBookmarksJson(JSON.stringify(source))
    const merged = mergeTrees([parsed, parsed])
    assert.equal(merged.length, 2)
    assert.equal(merged[0].title, '书签栏')
    assert.equal(merged[0].children[0].title, '<示例> & 网站')
    assert.equal(merged[0].children[1].children.length, 1)
    assert.equal(merged[1].children.length, 1)
    assert.equal(merged[1].children[0].children.length, 0)
    assert.equal(parsed[0].children[1].children.length, 2)
    assert.deepEqual(mergeTrees([[{ type: 'bookmark', title: '无 URL', url: null }]]), [])
    assert.throws(() => parseChromeBookmarksJson('invalid JSON'))
})

for (const password of ['', '测试密码 🔐']) {
    test(`KDBX round trip preserves titles, URLs and folders (${password ? 'password' : 'no password'})`, async () => {
        const items = mergeTrees([parseChromeBookmarksJson(JSON.stringify(source))])
        const data = await createKdbx(items, password)
        const credentials = new kdbxweb.Credentials(kdbxweb.ProtectedValue.fromString(password))
        const db = await kdbxweb.Kdbx.load(data, credentials)
        assert.equal(db.header.versionMajor, 3)
        const group = db.getDefaultGroup().groups.find((item) => item.name === '书签栏')
        assert.ok(group)
        assert.equal(group.entries.length, 1)
        assert.equal(group.entries[0].fields.get('Title'), '<示例> & 网站')
        assert.equal(group.entries[0].fields.get('URL'), 'https://example.com/?a=1&b=2')
        assert.equal(group.groups[0].name, '资料')
        assert.equal(group.groups[0].entries[0].fields.get('URL'), 'https://example.org/docs')
        if (password) {
            await assert.rejects(kdbxweb.Kdbx.load(data, new kdbxweb.Credentials(kdbxweb.ProtectedValue.fromString('wrong'))))
        }
    })
}

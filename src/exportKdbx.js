import * as kdbxweb from 'kdbxweb'

export async function createKdbx(items, password = '') {
    const credentials = new kdbxweb.Credentials(kdbxweb.ProtectedValue.fromString(password))
    const db = kdbxweb.Kdbx.create(credentials, 'Bookmarks')
    db.setKdf(kdbxweb.Consts.KdfId.Aes)
    db.setVersion(3)

    function addItems(children, parent) {
        for (const item of children) {
            if (item.type === 'folder') {
                addItems(item.children || [], db.createGroup(parent, item.title || 'Folder'))
            } else if (item.type === 'bookmark') {
                const entry = db.createEntry(parent)
                entry.fields.set('Title', item.title || '')
                entry.fields.set('URL', item.url || '')
            }
        }
    }

    addItems(items, db.getDefaultGroup())
    return db.save()
}

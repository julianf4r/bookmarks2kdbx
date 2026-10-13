export function parseChromeBookmarksHtml(text) {
    // Simple HTML parser for Chrome's exported bookmarks.html
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/html');
    function walkDl(dl) {
        const items = [];
        for (const node of dl.childNodes) {
            if (node.nodeName === 'DT') {
                const h3 = node.querySelector('h3');
                const a = node.querySelector('a');
                if (h3) {
                    const subDl = node.querySelector('dl');
                    items.push({
                        type: 'folder',
                        title: h3.textContent || 'Folder',
                        children: subDl ? walkDl(subDl) : []
                    });
                } else if (a) {
                    items.push({ type: 'bookmark', title: a.textContent || a.getAttribute('href'), url: a.getAttribute('href') });
                }
            }
        }
        return items;
    }
    const topDl = doc.querySelector('dl');
    if (!topDl) return [];
    return walkDl(topDl);
}

export function parseChromeBookmarksJson(text) {
    const obj = JSON.parse(text);
    function nodeToItems(node) {
        const items = [];
        if (!node) return items;
        if (node.type === 'url') return [{ type: 'bookmark', title: node.name || node.url, url: node.url }];
        if (node.children && Array.isArray(node.children)) {
            for (const ch of node.children) {
                if (ch.type === 'folder') {
                    items.push({ type: 'folder', title: ch.name || 'Folder', children: nodeToItems({ children: ch.children }) });
                } else if (ch.type === 'url') {
                    items.push({ type: 'bookmark', title: ch.name || ch.url, url: ch.url });
                }
            }
        }
        return items;
    }
    // Chrome's bookmark JSON often has roots: bookmark_bar, other, synced
    const roots = obj.roots || obj;
    const res = [];
    for (const k of Object.keys(roots)) {
        if (roots[k] && roots[k].children) {
            res.push({ type: 'folder', title: roots[k].name || k, children: nodeToItems(roots[k]) });
        }
    }
    return res;
}

export function mergeTrees(trees) {
    // trees: array of item arrays. Need to merge preserving folders, and dedupe URLs (first occurrence)
    const seen = new Set();
    function cloneFilter(items) {
        const out = [];
        for (const it of items) {
            if (it.type === 'bookmark') {
                if (!it.url) continue;
                if (seen.has(it.url)) continue;
                seen.add(it.url);
                out.push({ ...it });
            } else if (it.type === 'folder') {
                const children = cloneFilter(it.children || []);
                out.push({ type: 'folder', title: it.title, children });
            }
        }
        return out;
    }
    // Flatten by creating a top-level container with combined children
    const combined = [];
    for (const t of trees) {
        for (const it of t) combined.push(it);
    }
    return cloneFilter(combined);
}



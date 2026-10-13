import { checkImportText, createImportBudget } from './importLimits.js';

export function parseChromeBookmarksHtml(text) {
    checkImportText(text);
    const consume = createImportBudget();
    // Template contents stay inert: imported markup cannot load resources or run scripts.
    const template = document.createElement('template');
    template.innerHTML = text;
    const doc = template.content;
    function walkDl(dl, depth = 0) {
        const items = [];
        for (const node of dl.childNodes) {
            if (node.nodeName === 'DT') {
                const h3 = node.querySelector('h3');
                const a = node.querySelector('a');
                if (h3) {
                    consume(depth + 1);
                    const subDl = node.querySelector('dl');
                    items.push({
                        type: 'folder',
                        title: h3.textContent || 'Folder',
                        children: subDl ? walkDl(subDl, depth + 1) : []
                    });
                } else if (a) {
                    consume(depth);
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
    checkImportText(text);
    const consume = createImportBudget();
    const obj = JSON.parse(text);
    function nodeToItems(node, depth) {
        const items = [];
        if (!node) return items;
        if (node.type === 'url') {
            consume(depth);
            return [{ type: 'bookmark', title: node.name || node.url, url: node.url }];
        }
        if (node.children && Array.isArray(node.children)) {
            for (const ch of node.children) {
                if (ch.type === 'folder') {
                    consume(depth + 1);
                    items.push({ type: 'folder', title: ch.name || 'Folder', children: nodeToItems({ children: ch.children }, depth + 1) });
                } else if (ch.type === 'url') {
                    consume(depth);
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
            consume(1);
            res.push({ type: 'folder', title: roots[k].name || k, children: nodeToItems(roots[k], 1) });
        }
    }
    return res;
}

export function mergeTrees(trees) {
    // trees: array of item arrays. Need to merge preserving folders, and dedupe URLs (first occurrence)
    const seen = new Set();
    const consume = createImportBudget();
    function cloneFilter(items, depth = 0) {
        const out = [];
        for (const it of items) {
            if (it.type === 'bookmark') {
                consume(depth);
                if (!it.url) continue;
                if (seen.has(it.url)) continue;
                seen.add(it.url);
                out.push({ ...it });
            } else if (it.type === 'folder') {
                consume(depth + 1);
                const children = cloneFilter(it.children || [], depth + 1);
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



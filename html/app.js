/* lx-inventory NUI — vanilla JS on the LXR UI kit. Same messages in, same callbacks out as qb-inventory 2.x.
   Resource name comes from GetParentResourceName(), so the folder can be lx-inventory or qb-inventory. */
(() => {
    'use strict';
    const RES = typeof GetParentResourceName === 'function' ? GetParentResourceName() : 'qb-inventory';
    const post = (name, body) => fetch(`https://${RES}/${name}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) })
        .then(r => r.json().catch(() => null)).catch(() => null);
    const $ = id => document.getElementById(id);
    const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
    const kg = g => (g / 1000).toFixed(1);
    const FAST = 5;

    // ─────────────────────────────────────────────── state
    const S = {
        open: false, maxWeight: 0, slots: 0,
        player: {}, other: {}, otherName: '', otherLabel: 'Drop', otherMax: 1000000, otherSlots: 100, hasOther: false, isShop: false,
        amount: null, search: '', filter: 'all',
        drag: null, modal: null, weapon: null, attachments: [], hotbar: [],
    };
    const inv = t => t === 'player' ? S.player : S.other;
    const weightOf = t => Object.values(inv(t)).reduce((a, i) => a + (i && i.weight ? i.weight * i.amount : 0), 0);
    const maxOf = t => t === 'player' ? S.maxWeight : S.otherMax;
    const slotsOf = t => t === 'player' ? S.slots : S.otherSlots;
    const amount = () => (S.amount !== null && S.amount > 0) ? S.amount : null;
    const nextFree = (t, from = 1) => { for (let s = from; s <= slotsOf(t); s++) if (!inv(t)[s]) return s; return null; };
    const fill = data => { const out = {}; if (!data) return out; (Array.isArray(data) ? data : Object.values(data)).forEach(i => { if (i && i.slot) out[i.slot] = i; }); return out; };
    const isWeapon = i => String(i.name || '').startsWith('weapon_');
    const matches = i => {
        if (!i) return true;
        if (S.search && !(String(i.label || '') + ' ' + String(i.name || '')).toLowerCase().includes(S.search)) return false;
        if (S.filter === 'weapon') return isWeapon(i);
        if (S.filter === 'use') return !!i.useable && !isWeapon(i);
        if (S.filter === 'other') return !i.useable && !isWeapon(i);
        return true;
    };

    // ─────────────────────────────────────────────── render
    function tile(item, slot, t, opts = {}) {
        const n = el('div', 'slot' + (item ? ' has' : ''));
        n.dataset.slot = slot; n.dataset.inv = t;
        if (!item) { if (opts.key) n.appendChild(el('span', 'slot-key', String(slot))); return n; }
        const c = el('span', 'slot-count'); c.textContent = item.amount; c.appendChild(el('small', null, 'x')); n.appendChild(c);
        const w = el('span', 'slot-kg'); w.textContent = kg((item.weight || 0) * item.amount); w.appendChild(el('small', null, 'Kg')); n.appendChild(w);
        const img = el('div', 'slot-img'); const i = el('img'); i.src = 'images/' + item.image; i.alt = ''; img.appendChild(i); n.appendChild(img);
        if (item.info && 'quality' in item.info) { const q = Math.max(0, Math.min(100, Number(item.info.quality))); const r = el('i', 'ring' + (q <= 25 ? ' low' : q <= 75 ? ' mid' : '')); r.style.setProperty('--q', q); n.appendChild(r); }
        if (S.isShop && t === 'other' && item.price != null) n.appendChild(el('span', 'slot-price', '$' + item.price));
        if (opts.key) n.appendChild(el('span', 'slot-key', String(slot)));
        if (opts.label) n.appendChild(el('span', 'slot-label', item.label));
        if (t === 'player' && !matches(item)) n.classList.add('dim');
        return n;
    }
    function renderGrid(t) {
        if (t === 'player') {
            const fast = document.createDocumentFragment();
            for (let s = 1; s <= FAST; s++) fast.appendChild(tile(S.player[s], s, 'player', { key: true }));
            $('player-fast').replaceChildren(fast);
            const main = document.createDocumentFragment();
            for (let s = FAST + 1; s <= S.slots; s++) main.appendChild(tile(S.player[s], s, 'player'));
            $('player-grid').replaceChildren(main);
        } else {
            const frag = document.createDocumentFragment();
            for (let s = 1; s <= S.otherSlots; s++) frag.appendChild(tile(S.other[s], s, 'other'));
            $('other-grid').replaceChildren(frag);
        }
        renderWeight(t);
    }
    function renderWeight(t) {
        const w = weightOf(t), m = maxOf(t), pct = m > 0 ? Math.min(100, (w / m) * 100) : 0;
        const cls = pct >= 100 ? 'bad' : pct >= 75 ? 'warn' : '';
        const label = $(t === 'player' ? 'player-weight' : 'other-weight'); label.innerHTML = `<b>${kg(w)}</b> / ${kg(m)} Kg`; label.className = 'sec-weight lxr-mono ' + cls;
        const bar = $(t === 'player' ? 'player-meter' : 'other-meter'); bar.style.width = pct + '%'; bar.className = cls;
    }
    function renderAll() { renderGrid('player'); if (S.hasOther) renderGrid('other'); $('panel-other').classList.toggle('hidden', !S.hasOther); $('other-label').textContent = S.otherLabel; }

    // ─────────────────────────────────────────────── open / update / close
    function openInventory(d) {
        if (S.hotbar.length) toggleHotbar({ open: false });
        S.open = true; S.maxWeight = d.maxweight || 0; S.slots = d.slots || 0;
        S.player = fill(d.inventory); S.other = {}; S.hasOther = false; S.isShop = false; S.otherName = ''; S.otherLabel = 'Drop';
        if (d.other) {
            S.other = fill(d.other.inventory); S.otherName = d.other.name || ''; S.otherLabel = d.other.label || 'Drop';
            S.otherMax = d.other.maxweight || 1000000; S.otherSlots = d.other.slots || 100; S.isShop = S.otherName.startsWith('shop-'); S.hasOther = true;
        }
        $('player-chip').textContent = d.label || 'Inventory';
        $('inventory').classList.remove('hidden'); renderAll();
    }
    function updateInventory(d) {
        S.player = fill(d.inventory);
        if (d.otherItems) S.other = fill(d.otherItems);
        renderAll();
        if (d.errorSlot) slotError(d.errorSlot, d.errorInventory === 'player' || !d.errorInventory ? 'player' : 'other');
    }
    function closeInventory() {
        clearDrag(); closeModal(); hideTip(); closeAttachments();
        const name = S.otherName;
        S.open = false; S.player = {}; S.other = {}; S.hasOther = false; S.amount = null; S.search = ''; S.filter = 'all';
        $('amount').value = ''; $('search').value = ''; setFilter('all');
        $('inventory').classList.add('hidden');
        post('CloseInventory', { name });
    }

    // ─────────────────────────────────────────────── server sync
    function sync(fromT, toT, fromSlot, toSlot, fromAmount, toAmount) {
        post('SetInventoryData', { fromInventory: fromT === 'other' ? S.otherName : fromT, toInventory: toT === 'other' ? S.otherName : toT, fromSlot, toSlot, fromAmount, toAmount });
    }
    function slotError(slot, t = 'player') {
        const n = document.querySelector(`.side [data-inv="${t}"][data-slot="${slot}"]`);
        if (n) { n.classList.add('error'); setTimeout(() => n.classList.remove('error'), 900); }
        post('PlayDropFail', {});
    }

    // ─────────────────────────────────────────────── moves (same rules as qb-inventory 2.x)
    function moveItem(srcT, srcSlot, dstT, dstSlot, forced) {
        try {
            if (S.isShop && srcT === 'other' && dstT === 'other') return;
            const src = inv(srcT), dst = inv(dstT);
            const item = src[srcSlot]; if (!item) throw new Error('empty source');
            const n = forced ?? amount() ?? item.amount; if (item.amount < n) throw new Error('not enough');
            if (srcT !== dstT && weightOf(dstT) + item.weight * n > maxOf(dstT)) throw new Error('too heavy');
            const target = dst[dstSlot];
            if (target) {
                if (target.name === item.name && target.unique) { slotError(srcSlot, srcT); return; }
                if (target.name === item.name) {
                    target.amount += n; item.amount -= n; if (item.amount <= 0) delete src[srcSlot];
                    sync(srcT, dstT, srcSlot, dstSlot, item.amount, n);
                } else {
                    src[srcSlot] = target; dst[dstSlot] = item; target.slot = srcSlot; item.slot = dstSlot;
                    sync(srcT, dstT, srcSlot, dstSlot, item.amount, target.amount);
                }
            } else {
                item.amount -= n; if (item.amount <= 0) delete src[srcSlot];
                dst[dstSlot] = { ...item, amount: n, slot: dstSlot };
                sync(srcT, dstT, srcSlot, dstSlot, item.amount, n);
            }
            renderAll();
        } catch (e) { slotError(srcSlot, srcT); }
    }
    function quickMove(item, srcT, forced) {
        const dstT = srcT === 'player' ? 'other' : 'player';
        const src = inv(srcT), dst = inv(dstT);
        const n = forced ?? amount() ?? 1;
        const it = src[item.slot]; if (!it || it.amount < n) return slotError(item.slot, srcT);
        if (weightOf(dstT) + it.weight * n > maxOf(dstT)) return slotError(item.slot, srcT);
        let dstSlot;
        const stack = !it.unique && Object.values(dst).find(x => x && x.name === it.name);
        if (stack) { stack.amount += n; dstSlot = stack.slot; }
        else { dstSlot = nextFree(dstT); if (dstSlot === null) return slotError(item.slot, srcT); dst[dstSlot] = { ...it, amount: n, slot: dstSlot }; }
        it.amount -= n; if (it.amount <= 0) delete src[item.slot];
        renderAll(); sync(srcT, dstT, item.slot, dstSlot, it.amount, n);
    }
    async function purchase(dstSlot, srcSlot, item, n) {
        const ok = await post('AttemptPurchase', { item, amount: n || item.amount, shop: S.otherName });
        if (!ok) return slotError(srcSlot, 'other');
        const take = n ?? item.amount; if (item.amount < take) return slotError(srcSlot, 'other');
        const dst = S.player; let target = dst[dstSlot];
        if (!target || target.name !== item.name) {
            const found = Object.values(dst).find(x => x && x.name === item.name && !x.unique);
            if (found) found.amount += take;
            else { const free = nextFree('player'); if (free === null) return slotError(srcSlot, 'other'); dst[free] = { ...item, amount: take, slot: free }; }
        } else target.amount += take;
        item.amount -= take; if (item.amount <= 0) delete S.other[srcSlot];
        renderAll();
    }
    async function dropItem(item, n) {
        const key = Object.keys(S.player).find(k => S.player[k] && S.player[k].slot === item.slot); if (!key) return;
        n = Math.min(Math.max(1, n || item.amount), item.amount);
        const dropped = { ...item, amount: n, slot: 1, inventory: 'other' };
        const res = await post('DropItem', { ...dropped, fromSlot: item.slot });
        if (!res) return slotError(item.slot);
        if (n >= item.amount) delete S.player[key]; else S.player[key].amount -= n;
        S.other = { 1: dropped }; S.otherName = res; S.otherLabel = res; S.hasOther = true; S.isShop = false; S.otherMax = 1000000; S.otherSlots = 100;
        renderAll();
    }
    async function giveItem(item, n) {
        if (!Object.values(S.player).some(x => x && x.name === item.name)) return;
        n = Math.min(Math.max(1, n || 1), item.amount);
        const ok = await post('GiveItem', { item, amount: n, slot: item.slot, info: item.info });
        if (!ok) return;
        S.player[item.slot].amount -= n; if (S.player[item.slot].amount <= 0) delete S.player[item.slot];
        renderAll();
    }
    async function useItem(item) {
        if (!item || item.useable === false || !S.player[item.slot]) return;
        await post('UseItem', { inventory: 'player', item });
        if (item.shouldClose) closeInventory();
    }
    function splitItem(item, t) {
        const ref = inv(t); if (!item || item.amount <= 1) return;
        const orig = Object.keys(ref).find(k => ref[k] === item); const free = nextFree(t, t === 'player' ? FAST + 1 : 1) ?? nextFree(t);
        if (orig === undefined || free === null) return;
        const half = Math.ceil(item.amount / 2);
        ref[free] = { ...item, amount: half, slot: free }; ref[orig] = { ...item, amount: Math.floor(item.amount / 2) };
        renderAll(); sync(t, t, Number(orig), free, item.amount, half);
    }
    function toFastslot(item) {
        for (let s = 1; s <= FAST; s++) if (!S.player[s]) return moveItem('player', item.slot, 'player', s, item.amount);
        slotError(item.slot);
    }

    // ─────────────────────────────────────────────── drag & drop
    function startDrag(e, slot, t, src) {
        const item = inv(t)[slot]; if (!item || !src) return;
        const ghost = src.cloneNode(true); ghost.classList.add('ghost'); ghost.classList.remove('dim');
        document.body.appendChild(ghost); src.classList.add('dragging');
        S.drag = { item, slot, inv: t, ghost, src };
        placeGhost(e); hideTip();
    }
    function placeGhost(e) { const g = S.drag.ghost; g.style.left = (e.clientX - g.offsetWidth / 2) + 'px'; g.style.top = (e.clientY - g.offsetHeight / 2) + 'px'; }
    function clearDrag() { if (!S.drag) return; S.drag.ghost.remove(); S.drag.src.classList.remove('dragging'); document.querySelectorAll('.slot.over').forEach(n => n.classList.remove('over')); S.drag = null; }
    function endDrag(e) {
        const d = S.drag; if (!d) return;
        const under = document.elementsFromPoint(e.clientX, e.clientY);
        const target = under.find(n => n.classList && n.classList.contains('slot') && n.dataset.inv && !n.classList.contains('ghost'));
        if (target) {
            const t = target.dataset.inv, slot = Number(target.dataset.slot);
            if (!(t === d.inv && slot === d.slot)) {
                if (S.isShop && d.inv === 'other' && t === 'player') {
                    const ex = S.player[slot];
                    if (ex && (ex.name !== d.item.name || ex.unique)) slotError(d.slot, 'other'); else purchase(slot, d.slot, d.item, amount());
                } else moveItem(d.inv, d.slot, t, slot);
            }
        } else if (!S.hasOther && d.inv === 'player' && !under.some(n => n.classList && n.classList.contains('side'))) {
            dropItem(d.item, d.item.amount);
        }
        clearDrag();
    }

    // ─────────────────────────────────────────────── tooltip
    function tipHtml(item) {
        const desc = (item.info && item.info.description) || item.description || '';
        const kv = [];
        if (item.info && Object.keys(item.info).length && item.info.display !== false) {
            for (const [k, v] of Object.entries(item.info)) {
                if (k === 'description' || k === 'display' || k === 'quality') continue;
                kv.push([k.replace(/_/g, ' '), k === 'attachments' ? (Object.keys(v || {}).length ? 'yes' : 'no') : (typeof v === 'object' ? JSON.stringify(v) : v)]);
            }
        }
        const t = $('tip'); t.replaceChildren();
        const head = el('div', 'tip-head'); head.appendChild(el('span', 'tip-name', item.label)); head.appendChild(el('span', 'tip-kg', kg(item.weight || 0) + ' Kg')); t.appendChild(head);
        if (desc) t.appendChild(el('div', 'tip-desc', desc));
        kv.forEach(([k, v]) => { const row = el('div', 'tip-kv'); row.appendChild(el('b', null, k + ': ')); row.appendChild(document.createTextNode(String(v))); t.appendChild(row); });
        if (item.info && 'quality' in item.info) { const row = el('div', 'tip-kv'); row.appendChild(el('b', null, 'Durability: ')); row.appendChild(document.createTextNode(Math.round(item.info.quality) + ' %')); t.appendChild(row); }
    }
    function showTip(e, item) { tipHtml(item); $('tip').classList.remove('hidden'); moveTip(e); }
    function moveTip(e) { const t = $('tip'); if (t.classList.contains('hidden')) return; const w = t.offsetWidth, h = t.offsetHeight; t.style.left = Math.min(e.clientX + 18, innerWidth - w - 8) + 'px'; t.style.top = Math.min(e.clientY + 18, innerHeight - h - 8) + 'px'; }
    function hideTip() { $('tip').classList.add('hidden'); }

    // ─────────────────────────────────────────────── action modal
    function openModal(item, t) {
        S.modal = { item, t }; hideTip();
        $('m-name').textContent = item.label; $('m-weight').textContent = kg((item.weight || 0) * item.amount) + ' Kg';
        $('m-desc').textContent = (item.info && item.info.description) || item.description || '';
        const r = $('m-range'), n = $('m-num'); r.max = n.max = item.amount; r.value = n.value = Math.min(amount() || 1, item.amount);
        const weapon = isWeapon(item);
        $('m-use').classList.toggle('hidden', !item.useable || t !== 'player');
        $('m-fast').classList.toggle('hidden', t !== 'player' || item.slot <= FAST);
        $('m-put').classList.toggle('hidden', !S.hasOther || S.isShop);
        $('m-split').classList.toggle('hidden', item.amount <= 1);
        $('m-serial').classList.toggle('hidden', !weapon); $('m-attach').classList.toggle('hidden', !weapon);
        $('modal').classList.remove('hidden');
    }
    function closeModal() { $('modal').classList.add('hidden'); S.modal = null; }
    $('m-range').addEventListener('input', e => { $('m-num').value = e.target.value; });
    $('m-num').addEventListener('input', e => { const v = Math.max(1, Math.min(Number(e.target.max), Number(e.target.value) || 1)); $('m-range').value = v; });
    $('modal').addEventListener('mousedown', e => { if (e.target === $('modal')) closeModal(); });
    $('m-actions').addEventListener('click', e => {
        const b = e.target.closest('[data-act]'); if (!b || !S.modal) return;
        const { item, t } = S.modal; const n = Math.max(1, Math.min(item.amount, Number($('m-num').value) || 1)); const act = b.dataset.act;
        closeModal();
        if (act === 'use') useItem(item);
        else if (act === 'fast') toFastslot(item);
        else if (act === 'put') quickMove(item, t, n);
        else if (act === 'give') giveItem(item, n);
        else if (act === 'drop') dropItem(item, n);
        else if (act === 'split') splitItem(item, t);
        else if (act === 'serial') copySerial(item);
        else if (act === 'attach') openAttachments(item);
    });
    function copySerial(item) { const s = item.info && item.info.serie; if (!s) return; const ta = el('textarea'); ta.value = s; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }

    // ─────────────────────────────────────────────── weapon attachments
    async function openAttachments(item) {
        S.weapon = item; S.attachments = [];
        $('attach-title').textContent = item.label; $('attach-weapon-img').src = 'images/' + item.image; $('attach-list').replaceChildren();
        $('attachments').classList.remove('hidden');
        const data = await post('GetWeaponData', { weapon: item.name, ItemData: item });
        S.attachments = (data && data.AttachmentData) || []; renderAttachments();
    }
    function renderAttachments() {
        const list = $('attach-list'); list.replaceChildren();
        S.attachments.forEach((a, i) => { const n = el('div', 'slot has'); const img = el('div', 'slot-img'); const im = el('img'); im.src = 'images/' + a.attachment + '.png'; img.appendChild(im); n.appendChild(img); n.appendChild(el('span', 'slot-label', a.label || a.attachment)); n.addEventListener('click', () => removeAttachment(i)); list.appendChild(n); });
        if (!S.attachments.length) list.appendChild(el('div', 'attach-hint', 'no attachments'));
    }
    async function removeAttachment(i) {
        const a = S.attachments[i]; if (!a || !S.weapon) return;
        S.attachments.splice(i, 1); renderAttachments();
        const res = await post('RemoveAttachment', { AttachmentData: a, WeaponData: S.weapon });
        if (!res) { S.attachments.splice(i, 0, a); renderAttachments(); return; }
        S.weapon = res.WeaponData || S.weapon; if (res.Attachments) { S.attachments = res.Attachments; renderAttachments(); }
        const free = nextFree('player'); if (free !== null && res.itemInfo) { res.itemInfo.amount = 1; S.player[free] = { ...res.itemInfo, slot: free }; renderAll(); }
    }
    function closeAttachments() { $('attachments').classList.add('hidden'); S.weapon = null; S.attachments = []; }
    $('attach-close').addEventListener('click', closeAttachments);

    // ─────────────────────────────────────────────── HUD: hotbar · item box · required
    function toggleHotbar(d) {
        const h = $('hotbar');
        if (d.open) { S.hotbar = d.items || []; h.replaceChildren(); for (let s = 1; s <= FAST; s++) h.appendChild(tile(S.hotbar[s - 1] || null, s, 'player', { key: true, label: true })); h.classList.remove('hidden'); }
        else { S.hotbar = []; h.classList.add('hidden'); }
    }
    let boxTimer = null;
    function itemBox(d) {
        const b = $('itembox'); const kind = d.type === 'add' ? 'Received' : d.type === 'use' ? 'Used' : 'Removed';
        $('itembox-kind').textContent = kind; $('itembox-img').src = 'images/' + d.item.image; $('itembox-label').textContent = d.item.label; $('itembox-amount').textContent = (d.amount || 1) + 'x';
        b.classList.remove('hidden', 'out'); clearTimeout(boxTimer);
        boxTimer = setTimeout(() => { b.classList.add('out'); setTimeout(() => b.classList.add('hidden'), 320); }, 3000);
    }
    function requiredItems(d) {
        const r = $('required');
        if (d.toggle) { r.replaceChildren(); (d.items || []).forEach(i => { const n = el('div', 'slot has'); const img = el('div', 'slot-img'); const im = el('img'); im.src = 'images/' + i.image; img.appendChild(im); n.appendChild(img); n.appendChild(el('span', 'slot-label', i.label)); r.appendChild(n); }); r.classList.remove('hidden'); }
        else setTimeout(() => { r.classList.add('hidden'); r.replaceChildren(); }, 100);
    }

    // ─────────────────────────────────────────────── input wiring
    for (const gridId of ['player-fast', 'player-grid', 'other-grid']) {
        const grid = $(gridId);
        grid.addEventListener('mousedown', e => {
            const n = e.target.closest('.slot'); if (!n || e.button === 1) return;
            e.preventDefault();
            const t = n.dataset.inv, slot = Number(n.dataset.slot), item = inv(t)[slot];
            if (e.button === 0) { if (e.shiftKey && item) { if (S.hasOther) quickMove(item, t); else splitItem(item, t); } else if (item) startDrag(e, slot, t, n); }
            else if (e.button === 2 && item) {
                if (S.isShop && t === 'other') purchase(nextFree('player') || 1, slot, item, 1);
                else openModal(item, t);
            }
        });
        grid.addEventListener('dblclick', e => { const n = e.target.closest('.slot'); if (!n) return; const item = inv(n.dataset.inv)[Number(n.dataset.slot)]; if (item && n.dataset.inv === 'player') useItem(item); });
        grid.addEventListener('mouseover', e => { const n = e.target.closest('.slot'); if (!n || S.drag) return; const item = inv(n.dataset.inv)[Number(n.dataset.slot)]; if (item) showTip(e, item); });
        grid.addEventListener('mouseout', e => { if (!e.relatedTarget || !e.relatedTarget.closest || !e.relatedTarget.closest('.slot')) hideTip(); });
    }
    window.addEventListener('mousemove', e => {
        if (S.drag) { placeGhost(e); document.querySelectorAll('.slot.over').forEach(n => n.classList.remove('over')); const n = document.elementsFromPoint(e.clientX, e.clientY).find(x => x.classList && x.classList.contains('slot') && x.dataset.inv && !x.classList.contains('ghost')); if (n) n.classList.add('over'); }
        else moveTip(e);
    });
    window.addEventListener('mouseup', endDrag);
    window.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('keydown', e => {
        if (!S.open) return;
        if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); if (S.modal) closeModal(); else if (S.weapon) closeAttachments(); else closeInventory(); }
    });
    $('amount').addEventListener('input', e => { const v = parseInt(e.target.value, 10); S.amount = Number.isFinite(v) && v > 0 ? v : null; });
    document.querySelectorAll('.stepper button').forEach(b => b.addEventListener('click', () => { const v = Math.max(1, (S.amount || 1) + Number(b.dataset.step)); S.amount = v; $('amount').value = v; }));
    $('search').addEventListener('input', e => { S.search = e.target.value.trim().toLowerCase(); renderGrid('player'); });
    function setFilter(f) { S.filter = f; document.querySelectorAll('#filters button').forEach(b => b.classList.toggle('on', b.dataset.f === f)); }
    $('filters').addEventListener('click', e => { const b = e.target.closest('[data-f]'); if (!b) return; setFilter(b.dataset.f); renderGrid('player'); });

    // ─────────────────────────────────────────────── messages from the client script
    window.addEventListener('message', ({ data }) => {
        switch (data && data.action) {
            case 'open': openInventory(data); break;
            case 'close': closeInventory(); break;
            case 'update': updateInventory(data); break;
            case 'toggleHotbar': toggleHotbar(data); break;
            case 'itemBox': itemBox(data); break;
            case 'requiredItem': requiredItems(data); break;
            case 'RobMoney': break;
            default: if (data && data.action) console.warn('lx-inventory: unexpected action', data.action);
        }
    });
    window.LXInv = { state: S, open: openInventory, update: updateInventory, hotbar: toggleHotbar, itemBox, requiredItems, openModal };
})();

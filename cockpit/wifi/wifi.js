/* Cockpit WiFi 頁面：以 nmcli 掃描、連線、管理已儲存的 WiFi。密碼只經標準輸入寫入設定檔，不出現在指令列。 */
(function () {
    "use strict";
    const L = window.WifiLib;
    const $ = (id) => document.getElementById(id);
    const NMDIR = "/etc/NetworkManager/system-connections/";
    let dev = null;            // wifi 介面名稱（如 wlan0）
    let busy = false;

    function run(argv, opts) {
        return cockpit.spawn(argv, Object.assign({ superuser: "require", err: "message" }, opts || {}));
    }
    /* 以標準輸入餵資料：必須對 spawn 回傳的物件呼叫 .input(data)（送完會關閉輸入）；spawn 的選項沒有 input 這一項 */
    function runInput(argv, text) {
        const p = run(argv);
        p.input(text);
        return p;
    }
    function say(text, kind) {
        const m = $("msg"); m.style.display = text ? "block" : "none"; m.textContent = text || "";
        m.className = kind === "ok" ? "ok" : kind === "bad" ? "bad" : "";
    }
    function errText(e) {
        if (e && e.problem === "access-denied") return "沒有管理員權限：請先在 Cockpit 右上角按「受限存取」開啟管理員權限，再重試。";
        return (e && (e.message || e.problem)) || String(e);
    }
    function setBusy(b) { busy = b; document.querySelectorAll("button").forEach(function (x) { x.disabled = b; }); }
    async function guarded(fn) {
        if (busy) return; setBusy(true);
        try { await fn(); } catch (e) { say(errText(e), "bad"); }
        finally { setBusy(false); }
    }
    function el(tag, text, cls) { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (cls) e.className = cls; return e; }
    function btn(label, fn, cls) { const b = el("button", label, cls); b.addEventListener("click", function () { guarded(fn); }); return b; }

    /* ---- 狀態 ---- */
    async function refreshStatus() {
        const st = await run(["nmcli", "-t", "-f", "DEVICE,TYPE,STATE,CONNECTION", "device", "status"]);
        const w = st.split("\n").map(L.splitTerse).find(function (f) { return f[1] === "wifi"; });
        const radio = (await run(["nmcli", "radio", "wifi"])).trim();
        dev = w ? w[0] : null;
        const box = $("status"); box.textContent = ""; box.className = "";
        if (!dev) { box.className = "bad"; box.textContent = "找不到 WiFi 介面（硬體或驅動未就緒）。"; }
        else {
            const connected = w[2] === "connected";
            let ip = "";
            if (connected) { try { ip = (await run(["nmcli", "-g", "IP4.ADDRESS", "device", "show", dev])).trim().split("\n")[0]; } catch (e) { ip = ""; } }
            box.appendChild(el("div", "介面：" + dev + "　無線電：" + (radio === "enabled" ? "開啟" : "關閉")));
            const line = el("div", connected ? "已連線：" + w[3] + (ip ? "　IP " + ip : "") : "未連線", connected ? "ok" : "muted");
            box.appendChild(line);
        }
        $("btn-radio").textContent = radio === "enabled" ? "關閉 WiFi 無線電" : "開啟 WiFi 無線電";
        $("btn-radio").onclick = function () { guarded(async function () { await run(["nmcli", "radio", "wifi", radio === "enabled" ? "off" : "on"]); say("已" + (radio === "enabled" ? "關閉" : "開啟") + " WiFi 無線電", "ok"); await refreshAll(); }); };
        $("btn-disconnect").style.display = (dev && w && w[2] === "connected") ? "" : "none";
        $("btn-disconnect").onclick = function () { guarded(async function () { await run(["nmcli", "device", "disconnect", dev]); say("已中斷 " + dev + " 的連線", "ok"); await refreshAll(); }); };
        return radio === "enabled";
    }

    /* ---- 掃描 ---- */
    async function scan() {
        $("scan-note").textContent = "掃描中…（約 3～8 秒）";
        const out = await run(["nmcli", "-t", "-f", "IN-USE,SSID,SIGNAL,SECURITY,CHAN", "device", "wifi", "list", "--rescan", "yes"]);
        const list = L.parseScan(out), body = $("scan-body"); body.textContent = "";
        $("scan-note").textContent = "找到 " + list.length + " 個網路（隱藏網路不會列出）";
        list.forEach(function (n) {
            const mode = L.securityMode(n.security);
            const tr = el("tr");
            tr.appendChild(el("td", (n.inUse ? "● " : "") + n.ssid));
            const sg = el("td"); sg.appendChild(el("span", L.bars(n.signal), "bars")); sg.appendChild(el("span", " " + n.signal + "%", "muted")); tr.appendChild(sg);
            tr.appendChild(el("td", n.security && n.security !== "--" ? n.security : "無密碼"));
            tr.appendChild(el("td", n.chan));
            const act = el("td");
            if (mode === "enterprise") act.appendChild(el("span", "企業認證（本頁不支援）", "muted"));
            else if (n.inUse) act.appendChild(el("span", "已連線", "ok"));
            else act.appendChild(btn("連線", function () { openForm(tr, n.ssid, mode, false); }, "primary"));
            tr.appendChild(act); body.appendChild(tr);
        });
    }
    function openForm(afterRow, ssid, mode, hidden) {
        document.querySelectorAll(".form-row").forEach(function (r) { r.remove(); });
        const tr = el("tr", undefined, "form-row"), td = el("td"); td.colSpan = 5;
        const row = el("div", undefined, "row");
        row.appendChild(el("span", "連線到「" + ssid + "」"));
        let pw = null;
        if (mode === "wpa-psk" || mode === "sae") { pw = el("input"); pw.type = "password"; pw.placeholder = "WiFi 密碼"; pw.autocomplete = "new-password"; row.appendChild(pw); }
        row.appendChild(btn("連線", function () { return doConnect(ssid, mode, pw ? pw.value : "", hidden); }, "primary"));
        const cancel = el("button", "取消"); cancel.addEventListener("click", function () { tr.remove(); }); row.appendChild(cancel);
        td.appendChild(row); tr.appendChild(td); afterRow.after(tr); if (pw) pw.focus();
    }

    /* ---- 連線 ---- */
    function uuid() { return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) { const r = Math.random() * 16 | 0; return (c === "x" ? r : (r & 3 | 8)).toString(16); }); }
    async function doConnect(ssid, mode, password, hidden) {
        const bad = L.validatePassword(mode, password);
        if (bad) { say(bad, "bad"); return; }
        if (!dev) { say("找不到 WiFi 介面", "bad"); return; }
        say("連線中…（最長 40 秒）");
        const path = NMDIR + L.safeFileName(ssid);
        try { await run(["nmcli", "connection", "delete", "id", ssid]); } catch (e) { /* 沒有同名設定是正常的 */ }
        const content = L.buildKeyfile({ ssid: ssid, mode: mode, password: password, hidden: hidden, ifname: dev, uuid: uuid() });
        try {
            await runInput(["sh", "-c", 'umask 077; cat > "$1"', "sh", path], content);
            await run(["test", "-s", path]);   // 確認真的寫進內容（空檔案 NetworkManager 會拒絕載入）
        } catch (e) {
            try { await run(["rm", "-f", path]); } catch (x) { /* 清理失敗不影響錯誤顯示 */ }
            say("寫入 WiFi 設定檔失敗，未做任何變更。\n" + errText(e), "bad");
            return;
        }
        try {
            await run(["nmcli", "connection", "reload"]);
            const out = await run(["nmcli", "--wait", "40", "connection", "up", "id", ssid, "ifname", dev]);
            say("已連線到「" + ssid + "」\n" + out.trim(), "ok");
        } catch (e) {
            try { await run(["nmcli", "connection", "delete", "id", ssid]); } catch (x) { /* 可能尚未載入 */ }
            try { await run(["rm", "-f", path]); } catch (x) { /* 清理失敗不影響錯誤顯示 */ }
            say("連線失敗，已移除這次的設定。\n" + errText(e) + "\n（最常見的原因：密碼錯誤、訊號太弱，或路由器限制連線）", "bad");
        }
        await refreshAll();
    }

    /* ---- 已儲存 ---- */
    async function loadSaved() {
        const out = await run(["nmcli", "-t", "-f", "NAME,TYPE,AUTOCONNECT,ACTIVE", "connection", "show"]);
        const body = $("saved-body"); body.textContent = "";
        const rows = out.split("\n").filter(Boolean).map(L.splitTerse).filter(function (f) { return f[1] === "802-11-wireless"; });
        if (!rows.length) { const tr = el("tr"), td = el("td", "沒有已儲存的 WiFi", "muted"); td.colSpan = 4; tr.appendChild(td); body.appendChild(tr); return; }
        rows.forEach(function (f) {
            const tr = el("tr"); tr.appendChild(el("td", f[0])); tr.appendChild(el("td", f[2] === "yes" ? "是" : "否"));
            tr.appendChild(el("td", f[3] === "yes" ? "使用中" : "—", f[3] === "yes" ? "ok" : "muted"));
            const act = el("td");
            if (f[3] !== "yes") act.appendChild(btn("連線", async function () { say("連線中…"); await run(["nmcli", "--wait", "40", "connection", "up", "id", f[0]]); say("已連線到「" + f[0] + "」", "ok"); await refreshAll(); }));
            act.appendChild(document.createTextNode(" "));
            act.appendChild(btn("忘記", async function () {
                if (!confirm("確定要忘記「" + f[0] + "」？（會刪除儲存的密碼）")) return;
                await run(["nmcli", "connection", "delete", "id", f[0]]); say("已忘記「" + f[0] + "」", "ok"); await refreshAll();
            }, "danger"));
            tr.appendChild(act); body.appendChild(tr);
        });
    }

    async function refreshAll() { await refreshStatus(); await loadSaved(); }

    $("btn-refresh").addEventListener("click", function () { guarded(async function () { say(""); await refreshAll(); }); });
    $("btn-scan").addEventListener("click", function () { guarded(async function () { say(""); await scan(); }); });
    $("btn-hidden").addEventListener("click", function () { $("hidden-form").style.display = "block"; });
    $("h-cancel").addEventListener("click", function () { $("hidden-form").style.display = "none"; });
    $("h-go").addEventListener("click", function () {
        guarded(async function () {
            const ssid = $("h-ssid").value.trim(); if (!ssid) { say("請輸入 SSID", "bad"); return; }
            await doConnect(ssid, $("h-sec").value, $("h-pw").value, true);
        });
    });
    guarded(async function () { await refreshAll(); });
})();

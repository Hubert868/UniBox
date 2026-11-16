/* Cockpit 藍牙頁面：以 bluetoothctl 掃描、配對、連線、管理已配對裝置。 */
(function () {
    "use strict";
    const L = window.BtLib;
    const $ = (id) => document.getElementById(id);
    let busy = false;
    let lastScan = [];

    /* 指令非零結束時也回傳輸出文字（bluetoothctl 的失敗原因在輸出裡）；只有權限或無法執行才丟例外 */
    function run(argv) {
        return new Promise(function (resolve, reject) {
            cockpit.spawn(argv, { superuser: "require", err: "out" }).then(resolve, function (ex, data) {
                if (ex && ex.exit_status !== undefined && ex.problem !== "access-denied") resolve(data || ex.message || "");
                else reject(ex);
            });
        });
    }
    function ctl(args, timeout) { return run(["bluetoothctl"].concat(timeout ? ["--timeout", String(timeout)] : [], args)); }
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
        try { await fn(); } catch (e) { say(L.explain(errText(e)), "bad"); }
        finally { setBusy(false); }
    }
    function el(tag, text, cls) { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (cls) e.className = cls; return e; }
    function btn(label, fn, cls) { const b = el("button", label, cls); b.addEventListener("click", function () { guarded(fn); }); return b; }
    function label(d) { return d.unnamed ? "（未命名）" : d.name; }

    /* ---- 狀態 ---- */
    async function refreshStatus() {
        const box = $("status"); box.textContent = ""; box.className = "";
        let info;
        try { info = L.parseInfo(await ctl(["show"])); } catch (e) { info = {}; }
        if (!info.Powered) {
            box.className = "bad";
            box.textContent = "找不到藍牙控制器（bt-attach 服務可能未啟動，可在「服務」頁檢查 bt-attach）。";
            $("btn-power").style.display = "none";
            return;
        }
        const on = L.yes(info.Powered);
        box.appendChild(el("div", "控制器：" + (info.Alias || info.Name || "") + "　電源：" + (on ? "開啟" : "關閉")));
        $("btn-power").style.display = "";
        $("btn-power").textContent = on ? "關閉藍牙電源" : "開啟藍牙電源";
        $("btn-power").onclick = function () { guarded(async function () { await ctl(["power", on ? "off" : "on"]); say("已" + (on ? "關閉" : "開啟") + "藍牙電源", "ok"); await refreshAll(); }); };
    }

    /* ---- 掃描 ---- */
    function renderScan() {
        const body = $("scan-body"); body.textContent = "";
        const showUnnamed = $("chk-unnamed").checked;
        const list = lastScan.filter(function (d) { return showUnnamed || !d.unnamed; });
        const hidden = lastScan.length - list.length;
        $("scan-note").textContent = lastScan.length ? "找到 " + lastScan.length + " 個裝置" + (hidden ? "（隱藏 " + hidden + " 個未命名）" : "") : "";
        if (!list.length) { const tr = el("tr"), td = el("td", lastScan.length ? "沒有已命名的裝置，可勾選「顯示未命名裝置」" : "尚未掃描", "muted"); td.colSpan = 3; tr.appendChild(td); body.appendChild(tr); return; }
        list.forEach(function (d) {
            const tr = el("tr"); tr.appendChild(el("td", label(d), d.unnamed ? "muted" : ""));
            tr.appendChild(el("td", d.mac, "muted"));
            const act = el("td"); act.appendChild(btn("配對並連線", function () { return pairDevice(d); }, "primary")); tr.appendChild(act);
            body.appendChild(tr);
        });
    }
    async function scan() {
        $("scan-note").textContent = "掃描中…（約 8 秒）";
        await ctl(["scan", "on"], 8);
        const all = L.parseDevices(await ctl(["devices"]));
        let paired = [];
        try { paired = L.parseDevices(await ctl(["devices", "Paired"])).map(function (d) { return d.mac; }); } catch (e) { paired = []; }
        lastScan = all.filter(function (d) { return paired.indexOf(d.mac) < 0; });
        renderScan();
    }

    /* ---- 配對 ---- */
    async function pairDevice(d) {
        if (!L.isMac(d.mac)) { say("位址格式不正確", "bad"); return; }
        say("配對中「" + label(d) + "」…（最長 30 秒）");
        let out;
        try { out = await run(["bluetoothctl", "--agent", "NoInputNoOutput", "--timeout", "30", "pair", d.mac]); }
        catch (e) { out = errText(e); }
        if (!/Pairing successful/i.test(out) && !/AlreadyExists|Already Exists/i.test(out)) {
            say("配對失敗：" + L.explain(out), "bad");
            return;
        }
        await ctl(["trust", d.mac]);
        let conn = "";
        try { conn = await ctl(["connect", d.mac], 20); } catch (e) { conn = errText(e); }
        if (/Connection successful/i.test(conn)) say("已配對並連線「" + label(d) + "」", "ok");
        else say("已配對並信任「" + label(d) + "」，但目前未連線（BLE 感測器或睡眠中的裝置屬正常；耳機請在已配對清單按「連線」）。\n" + L.explain(conn), "ok");
        await refreshAll();
    }

    /* ---- 已配對 ---- */
    async function loadPaired() {
        const body = $("paired-body"); body.textContent = "";
        let list = [];
        try { list = L.parseDevices(await ctl(["devices", "Paired"])); } catch (e) { list = []; }
        if (!list.length) { const tr = el("tr"), td = el("td", "沒有已配對的裝置", "muted"); td.colSpan = 5; tr.appendChild(td); body.appendChild(tr); return; }
        for (const d of list) {
            let inf = {};
            try { inf = L.parseInfo(await ctl(["info", d.mac])); } catch (e) { inf = {}; }
            const connected = L.yes(inf.Connected);
            const tr = el("tr"); tr.appendChild(el("td", label(d))); tr.appendChild(el("td", d.mac, "muted"));
            tr.appendChild(el("td", connected ? "已連線" : "未連線", connected ? "ok" : "muted"));
            tr.appendChild(el("td", L.yes(inf.Trusted) ? "是" : "否"));
            const act = el("td");
            if (connected) act.appendChild(btn("中斷", async function () { await ctl(["disconnect", d.mac]); say("已中斷「" + label(d) + "」", "ok"); await refreshAll(); }));
            else act.appendChild(btn("連線", async function () {
                say("連線中…");
                const out = await ctl(["connect", d.mac], 20);
                if (/Connection successful/i.test(out)) say("已連線「" + label(d) + "」", "ok"); else say("連線失敗：" + L.explain(out), "bad");
                await refreshAll();
            }, "primary"));
            act.appendChild(document.createTextNode(" "));
            act.appendChild(btn("移除", async function () {
                if (!confirm("確定要移除「" + label(d) + "」的配對？")) return;
                await ctl(["remove", d.mac]); say("已移除「" + label(d) + "」", "ok"); await refreshAll();
            }, "danger"));
            tr.appendChild(act); body.appendChild(tr);
        }
    }

    async function refreshAll() { await refreshStatus(); await loadPaired(); }

    $("btn-refresh").addEventListener("click", function () { guarded(async function () { say(""); await refreshAll(); }); });
    $("btn-scan").addEventListener("click", function () { guarded(async function () { say(""); await scan(); }); });
    $("chk-unnamed").addEventListener("change", renderScan);
    renderScan();
    guarded(async function () { await refreshAll(); });
})();

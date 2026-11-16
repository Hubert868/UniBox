/* 藍牙頁面的純函式（不依賴瀏覽器，可在 Node 測試） */
(function (root) {
    "use strict";

    const MAC_RE = /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/i;

    function stripAnsi(s) { return String(s).replace(/\x1b\[[0-9;]*[A-Za-z]/g, "").replace(/\r/g, ""); }

    function isMac(s) { return MAC_RE.test(s || ""); }

    /* bluetoothctl devices 的輸出："Device AA:BB:CC:DD:EE:FF 名稱"。沒有名稱的裝置，名稱欄會是位址（以 - 分隔） */
    function parseDevices(text) {
        const out = [];
        stripAnsi(text).split("\n").forEach(function (l) {
            const m = /^Device\s+(\S+)\s*(.*)$/.exec(l.trim());
            if (!m || !isMac(m[1])) return;
            const name = m[2].trim();
            out.push({ mac: m[1].toUpperCase(), name: name, unnamed: name === "" || name.toUpperCase() === m[1].toUpperCase().replace(/:/g, "-") });
        });
        return out;
    }

    /* bluetoothctl info / show 的輸出：每行 "\tKey: value" */
    function parseInfo(text) {
        const o = {};
        stripAnsi(text).split("\n").forEach(function (l) {
            const m = /^\s+([A-Za-z][A-Za-z ]*?):\s*(.*)$/.exec(l);
            if (m && !(m[1] in o)) o[m[1]] = m[2].trim();
        });
        return o;
    }

    function yes(v) { return v === "yes"; }

    /* 把 pair/connect 的失敗訊息翻成白話 */
    function explain(text) {
        const t = stripAnsi(text);
        if (/AuthenticationFailed|Authentication Failed/i.test(t)) return "驗證失敗：裝置可能要求輸入 PIN 碼（本頁僅支援免輸入配對），或裝置已離開配對模式。";
        if (/AuthenticationCanceled|Authentication Canceled/i.test(t)) return "配對被取消：請確認裝置還在配對模式後重試。";
        if (/AlreadyExists|Already Exists/i.test(t)) return "這個裝置已經配對過了。";
        if (/not available|Device .* not available/i.test(t)) return "找不到這個裝置：請先重新掃描，並確認裝置在配對模式。";
        if (/page-timeout|Page Timeout|ConnectionAttemptFailed|Connection timed out/i.test(t)) return "連線逾時：裝置可能太遠、已關機或未在配對模式。";
        if (/Failed to connect|org\.bluez\.Error\.Failed/i.test(t)) return "連線失敗：" + (t.split("\n").filter(function (x) { return /Failed|Error/.test(x); })[0] || "").trim();
        return t.trim();
    }

    const api = { stripAnsi: stripAnsi, isMac: isMac, parseDevices: parseDevices, parseInfo: parseInfo, yes: yes, explain: explain };
    if (typeof module !== "undefined" && module.exports) module.exports = api;
    else root.BtLib = api;
})(typeof window !== "undefined" ? window : this);

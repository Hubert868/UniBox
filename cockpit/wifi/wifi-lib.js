/* WiFi 頁面的純函式（不依賴瀏覽器，可在 Node 測試） */
(function (root) {
    "use strict";

    /* 拆解 nmcli -t 的輸出：欄位以 ':' 分隔，值內的 ':' 與 '\' 以反斜線跳脫 */
    function splitTerse(line) {
        const out = []; let cur = "";
        for (let i = 0; i < line.length; i++) {
            const c = line[i];
            if (c === "\\" && i + 1 < line.length) { cur += line[++i]; }
            else if (c === ":") { out.push(cur); cur = ""; }
            else { cur += c; }
        }
        out.push(cur);
        return out;
    }

    /* nmcli -t -f IN-USE,SSID,SIGNAL,SECURITY,CHAN device wifi list → 以 SSID 去重（留訊號最強者）並排序 */
    function parseScan(text) {
        const best = new Map();
        text.split("\n").forEach(function (l) {
            if (!l.trim()) return;
            const f = splitTerse(l);
            if (f.length < 5) return;
            const ssid = f[1];
            if (!ssid) return;               // 隱藏網路不列出
            const item = { inUse: f[0] === "*", ssid: ssid, signal: parseInt(f[2], 10) || 0, security: f[3], chan: f[4] };
            const old = best.get(ssid);
            if (!old || item.signal > old.signal || item.inUse) {
                if (old && old.inUse) item.inUse = true;
                best.set(ssid, item);
            }
        });
        return Array.from(best.values()).sort(function (a, b) { return (b.inUse - a.inUse) || (b.signal - a.signal); });
    }

    /* 依 nmcli 的 SECURITY 欄位決定連線方式 */
    function securityMode(sec) {
        sec = (sec || "").trim();
        if (sec === "" || sec === "--") return "open";
        if (/802\.1X/.test(sec)) return "enterprise";   // 企業認證：本頁不支援
        if (/OWE/.test(sec) && !/WPA/.test(sec)) return "owe";
        if (/WPA3/.test(sec) && !/WPA[12]/.test(sec)) return "sae";
        return "wpa-psk";
    }

    /* NetworkManager keyfile 的字串跳脫：反斜線加倍、頭尾空白改 \s */
    function kfEscape(s) {
        s = String(s).replace(/\\/g, "\\\\");
        s = s.replace(/^ /, "\\s").replace(/ $/, "\\s");
        return s;
    }

    function validatePassword(mode, pw) {
        if (mode === "open" || mode === "owe") return null;
        if (mode === "wpa-psk") {
            if (/^[0-9a-fA-F]{64}$/.test(pw)) return null;
            if (pw.length < 8 || pw.length > 63) return "WPA 密碼長度必須是 8～63 個字元（或 64 位十六進位）";
        }
        if (mode === "sae" && pw.length < 1) return "請輸入密碼";
        return null;
    }

    function safeFileName(ssid) {
        const s = ssid.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 40) || "wifi";
        return "wifi-" + s + ".nmconnection";
    }

    /* 產生 NetworkManager keyfile。密碼只出現在檔案內容（經標準輸入寫入，不會出現在指令列） */
    function buildKeyfile(opts) {
        const mode = opts.mode, ifname = opts.ifname || "wlan0";
        const L = [];
        L.push("[connection]", "id=" + kfEscape(opts.ssid), "uuid=" + opts.uuid, "type=wifi", "interface-name=" + ifname, "autoconnect=true", "");
        L.push("[wifi]", "mode=infrastructure", "ssid=" + kfEscape(opts.ssid));
        if (opts.hidden) L.push("hidden=true");
        L.push("");
        if (mode === "wpa-psk" || mode === "sae") {
            L.push("[wifi-security]", "key-mgmt=" + (mode === "sae" ? "sae" : "wpa-psk"), "psk=" + kfEscape(opts.password), "");
        } else if (mode === "owe") {
            L.push("[wifi-security]", "key-mgmt=owe", "");
        }
        // 有線優先：WiFi 的路由優先序放在有線（100）之後
        L.push("[ipv4]", "method=auto", "route-metric=600", "", "[ipv6]", "method=auto", "");
        return L.join("\n");
    }

    function bars(signal) {
        return signal >= 75 ? "▂▄▆█" : signal >= 50 ? "▂▄▆_" : signal >= 25 ? "▂▄__" : "▂___";
    }

    const api = { splitTerse: splitTerse, parseScan: parseScan, securityMode: securityMode, kfEscape: kfEscape,
                  validatePassword: validatePassword, safeFileName: safeFileName, buildKeyfile: buildKeyfile, bars: bars };
    if (typeof module !== "undefined" && module.exports) module.exports = api;
    else root.WifiLib = api;
})(typeof window !== "undefined" ? window : this);

const L = require("./wifi-lib.js"); const assert = require("assert"); let n = 0;
const t = (name, fn) => { fn(); n++; console.log("PASS", name); };
t("splitTerse 一般欄位", () => assert.deepStrictEqual(L.splitTerse("*:MyNet:80:WPA2:6"), ["*", "MyNet", "80", "WPA2", "6"]));
t("splitTerse 跳脫的冒號", () => assert.deepStrictEqual(L.splitTerse(" :Cafe\\:Free:55:WPA2:1"), [" ", "Cafe:Free", "55", "WPA2", "1"]));
t("splitTerse 跳脫的反斜線", () => assert.deepStrictEqual(L.splitTerse(" :A\\\\B:55:WPA2:1"), [" ", "A\\B", "55", "WPA2", "1"]));
t("parseScan 去重/排序/略過隱藏", () => {
  // nmcli -t 的真實格式：IN-USE 欄是 "*" 或單一空白
  const text = [" :A:40:WPA2:1", "*:B:30:WPA2:6", " :A:70:WPA2:11", " :C:90:WPA2:36", " ::10:WPA2:1", ""].join("\n");
  const r = L.parseScan(text);
  assert.deepStrictEqual(r.map(x => x.ssid), ["B", "C", "A"]);          // 使用中的在最前，其餘依訊號
  assert.strictEqual(r.find(x => x.ssid === "A").signal, 70);           // 同名取最強
  assert.strictEqual(r[0].inUse, true);
  assert.ok(!r.some(x => x.ssid === ""));                               // 隱藏網路（空 SSID）不列出
});
t("securityMode 對應", () => {
  assert.strictEqual(L.securityMode("--"), "open"); assert.strictEqual(L.securityMode(""), "open");
  assert.strictEqual(L.securityMode("WPA2"), "wpa-psk"); assert.strictEqual(L.securityMode("WPA1 WPA2"), "wpa-psk");
  assert.strictEqual(L.securityMode("WPA3"), "sae"); assert.strictEqual(L.securityMode("WPA2 WPA3"), "wpa-psk");
  assert.strictEqual(L.securityMode("WPA2 802.1X"), "enterprise"); assert.strictEqual(L.securityMode("OWE"), "owe");
});
t("validatePassword", () => {
  assert.ok(L.validatePassword("wpa-psk", "short"));                    // 太短 → 回傳錯誤訊息
  assert.strictEqual(L.validatePassword("wpa-psk", "12345678"), null);
  assert.strictEqual(L.validatePassword("wpa-psk", "a".repeat(64)), null);   // 64 位十六進位金鑰
  assert.ok(L.validatePassword("wpa-psk", "z".repeat(64)));             // 64 位但不是十六進位 → 超過 63 字元 → 錯誤
  assert.strictEqual(L.validatePassword("open", ""), null);
});
t("kfEscape", () => { assert.strictEqual(L.kfEscape(" a\\b "), "\\sa\\\\b\\s"); });
t("safeFileName", () => { assert.strictEqual(L.safeFileName("Cafe/Free:1"), "wifi-Cafe_Free_1.nmconnection"); assert.ok(L.safeFileName("無線").startsWith("wifi-__")); });
t("buildKeyfile 結構", () => {
  const k = L.buildKeyfile({ ssid: "S", mode: "wpa-psk", password: "pw123456", uuid: "u", ifname: "wlan0", hidden: true });
  ["[connection]", "id=S", "type=wifi", "interface-name=wlan0", "[wifi]", "ssid=S", "hidden=true", "[wifi-security]", "key-mgmt=wpa-psk", "psk=pw123456", "route-metric=600"].forEach(x => assert.ok(k.includes(x), x));
});
console.log("單元測試全部通過：" + n + " 組");

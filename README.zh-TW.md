# UniBox
Debian13 on Uni Box

[English](README.md) | **繁體中文**

讓 **中國聯通「UniBOX 智家雲盒」**（主機板字串：`HINLINK RK3568 UNICOMBOX V1`）改跑原版
**Debian 13（trixie）**，取代原廠的 fnOS（「trim」）系統。內容包含筆記、腳本和驅動移植。

> **非官方的社群成果，風險自負。** 修改這台機器的開機鏈有可能讓它變磚，而且它**沒有 SD 卡槽**。
> 請先閱讀 [docs/DEBIAN-ON-UNIBOX.zh-TW.md](docs/DEBIAN-ON-UNIBOX.zh-TW.md)，並且**先備份 eMMC**。

## 硬體（以我手上的機器為準）

| 項目 | 規格 |
|---|---|
| SoC | Rockchip RK3568（4 核 Cortex-A55），NPU 0.8 TOPS |
| 記憶體／儲存 | 4 GB／約 29 GB eMMC，無 SD 卡槽 |
| WiFi／藍牙 | AP6398 模組（Broadcom BCM43752），WiFi 走 SDIO，藍牙走 UART8 |
| 燈條 | WS2812，接在 GPIO105（J8 接頭） |
| 網路 | 有線乙太網路（網卡名稱有的機器是 `end0`，有的是 `end1`） |

## 這個倉庫有什麼

| 路徑 | 內容 | 授權 |
|---|---|---|
| [docs/DEBIAN-ON-UNIBOX.zh-TW.md](docs/DEBIAN-ON-UNIBOX.zh-TW.md) | 開機鏈運作方式，以及如何改用 Debian 自己的核心與系統 | MIT |
| [scripts/bluetooth](scripts/bluetooth) | AP6398 的上電順序與 `btattach` 服務 | MIT |
| [scripts/watchdog](scripts/watchdog) | 硬體看門狗、卡死／軟鎖死自動重開機、有線網路看門狗 | MIT |
| [scripts/wifi](scripts/wifi) | 讓 brcmfmac SDIO 休眠錯誤消失的 NetworkManager 設定 | MIT |
| [scripts/led](scripts/led) | WS2812 燈條的開機／就緒／關機顏色（輔助程式**未**附上） | MIT |
| [cockpit/wifi](cockpit/wifi)、[cockpit/bluetooth](cockpit/bluetooth) | 用 Cockpit 掃描連線 WiFi、配對藍牙的頁面 | MIT |
| [npu](npu) | 把 Rockchip `rknpu` 0.9.8 驅動移植到 Debian 6.1 核心（補丁＋建置檔） | **GPL-2.0** |

## 刻意不放的東西

* 任何形式的磁碟映像或備份（裡面有金鑰、token 和帳密）。
* 裝置樹、`boot.scr`、U-Boot 或其他原廠二進位檔、原廠韌體。
* Rockchip 的 RKNN 執行階段（`librknnrt`）與工具套件，請自行向 Rockchip 取得。
* 任何與我的網路、帳號或智慧家庭設定有關的東西。

## 狀態

已在一台執行 Debian 13、使用 Debian 官方核心 `6.1.0-53-arm64` 的機器上驗證：
72 小時浸泡測試 0 次非預期重啟，WiFi 與藍牙正常，容器穩定。
其他機器或其他韌體版本尚未測試。

## 授權

除了 [npu/](npu) 之外全部採用 MIT。`npu/` 是 GPL-2.0 程式碼的補丁，維持 GPL-2.0
（見 [npu/COPYING](npu/COPYING)）。

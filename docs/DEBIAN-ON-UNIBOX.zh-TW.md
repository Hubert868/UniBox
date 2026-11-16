# 在 UniBOX（RK3568）上跑 Debian

[English](DEBIAN-ON-UNIBOX.md) | **繁體中文**

以下是在我的機器上實際可行的做法。這是說明，不是一鍵安裝程式。
一切都假設你有 SSH 權限，而且**已經做好完整備份**。

## 0. 安全第一

* 這台機器**沒有 SD 卡槽**，Maskrom 模式對我來說也不可靠，所以真正的保險只有事先做好的映像。
* 至少要備份：eMMC 最前面 32 MiB（含 GPT 與 U-Boot，U-Boot 從第 64 磁區開始）、開機分割區、
  根檔案系統。備份請存放在**機器之外**。
* 主機板上有 UART 排針，但我**沒有測試過**用 UART 救援，所以任何「從 U-Boot 提示字元手動開機」
  的想法都屬於未驗證。

## 1. 原廠開機鏈如何運作

* U-Boot 存在 eMMC 上，會讀取 `/boot/fnEnv.txt`（核心／initrd 檔名、根裝置），然後執行
  `boot.scr`（由 `boot.cmd` 編譯而來）。就我所能判斷，它會從開機分割區載入核心、裝置樹與
  `uInitrd`；我從來不需要修改它。
* 原廠核心與系統套件來自 fnOS 的 `trim` 軟體庫。

**讓我的機器一直能開機的決定：** U-Boot、`boot.scr`、`boot.cmd` 和原始的裝置樹檔案
完全保持出廠原樣，只更換 `fnEnv.txt` 所指向的核心與 initrd。

**我的機器實際使用的開機設定**（兩台完全相同，請不要假設它是原廠預設值）：

```
extraargs=cma=256M iomem=relaxed
fdtfile=rockchip/rk3568-hinlink-unicombox-v1-pwmtest3.dtb
kernelfile=vmlinuz-6.1.0-53-arm64
initrdfile=uInitrd-6.1.0-53-arm64
```

* `...-pwmtest3.dtb` 是**我自己修改的**原廠 `...-unicombox-v1.dtb` 副本（因為衍生自原廠檔案，
  所以不放在這裡）。和原廠版相比，它把兩個節點改成 `status = "okay"`、停用一個節點，
  並修改一筆 PCIe `msi-map`；NPU 節點則與原廠版位元組完全相同。原廠檔案仍留在磁碟上、沒被動過。
* `iomem=relaxed` 是為了讓我的燈條輔助程式能透過 `/dev/mem` 存取硬體暫存器
  （這是我的理解；該輔助程式未公開）。`cma=256M` 用來保留連續記憶體。
* 我**沒有**在每台機器上用未修改的原廠 dtb 測試過 Debian 核心，所以無法確定單純開機
  是否必須用修改過的 dtb。

## 2. 改用 Debian 自己的核心

Debian arm64 核心 `6.1.0-53`（bookworm-security）可以搭配原廠裝置樹開機。

1. 從 Debian 安裝 `linux-image-6.1.0-53-arm64`。
2. U-Boot 載入的是 U-Boot 格式的 initrd，所以要用 `mkimage -A arm64 -O linux -T ramdisk ...`
   把 Debian 的 `initrd.img` 轉成 `uInitrd-<版本>`，放進 `/boot`，檔名要符合 `fnEnv.txt`
   的期待。建議加一個核心安裝後的 hook 自動重新產生，否則下次更新核心，機器就開不了機。
3. 在新核心至少成功開機兩次（其中一次要是完全斷電再上電的冷開機）之前，保留舊核心檔案。
4. 升級核心前，確認 `/boot` 還有剩餘空間（我的大約剩 180 MB）。
5. Debian 12 升級到 13（trixie）時**核心維持 6.1**；我沒有嘗試 Debian 的 6.12 核心。

## 3. 移除 fnOS 系統

請在 Debian 核心已經能獨立開機之後才進行。

1. 先做檔案系統快照（我的機器根目錄是 btrfs）。
2. 先模擬：`apt-get -s purge <套件>` 並仔細閱讀。`trim` 的核心中繼套件版本號排在 Debian 之前，
   所以要明確用 Debian 版本取代 `linux-libc-dev` 與 `libwbclient0`（加 `--allow-downgrades`），
   否則 purge 會連帶拖走大量不相關的套件。
3. 在 purge `trim` 之前，先記錄它擁有哪些 systemd 的「啟用」連結。purge 會把它們移除，
   `ssh`、`NetworkManager`、`docker`、`containerd`、`cron`、`avahi` 等服務會被悄悄停用。
   purge 完成後**要立刻重建這些連結**。
4. 使用 Docker 官方的 systemd 單元。如果容器資料放在獨立的磁碟區，
   加一個 drop-in `RequiresMountsFor=<掛載點>`，讓 Docker 等磁碟區掛好再啟動。
5. 如果新冒出 `NetworkManager-wait-online`，把它停用，它會拖慢開機。
6. `/lib/firmware/brcm` 裡的 WiFi 韌體原本屬於某個 `trim` 套件。purge 前先複製出來，
   purge 後再以一般檔案放回去。
7. 重開機後驗證：`fnEnv.txt`、`boot.scr`、`boot.cmd`、核心與 `uInitrd` 都沒變
   （與事先取得的校驗碼比對）、沒有失敗的單元、網路正常。

我的機器上的結果：開機時間從約 2 分鐘降到約 25～45 秒，記憶體用量從約 1.4 GB 降到 1 GB 以下。

## 4. WiFi 晶片的穩定性修正

AP6398 的 WiFi 接在 SDIO（`brcmfmac`）。在 6.1 核心下，WiFi 連線後過幾分鐘，整台機器可能卡死。
有幫助的做法：

* **關閉 802.11 省電**（[scripts/wifi](../scripts/wifi)）。開啟時，我看到
  `brcmf_sdio_bus_sleep: error while changing bus sleep state -110` 約每小時 1～2 次；
  關閉後，連續好幾天幾乎沒有。
* **硬體看門狗**（`RuntimeWatchdogSec=30`、`dw_wdt`）：核心凍結後約 35 秒重置。
  用 `echo c > /proc/sysrq-trigger` 測試過。
* 透過 sysctl 設定**卡死任務／軟鎖死時自動重開機**（[scripts/watchdog](../scripts/watchdog)）。
* **有線網路看門狗**：有線連線失去 IPv4 位址時，重新啟用該連線。
* 讓有線網路維持為優先路由（較低的 metric），WiFi 當備援。
* 無線電可能被 NetworkManager 軟體停用：如果掃描不到任何 AP，執行 `nmcli radio wifi on`。
* 請在**路由器**上設定正確的 WiFi 法規地區；晶片使用自己管理的法規資料庫，
  只會與 AP 廣播的內容取交集。

啟用無線電時出現一次 `brcmf_p2p_create_p2pdev: timeout`，在我的機器上無害。

## 5. 藍牙

AP6398 的藍牙接在 UART8（`fe6c0000.serial`）。tty 名稱依核心而異
（原廠核心是 `ttyS8`，Debian 的是 `ttyS0`），所以 [scripts/bluetooth](../scripts/bluetooth)
用裝置名稱來查找。順序：先把相關 GPIO 上電，再執行
`btattach -B <tty> -P bcm -S 115200 -N`，然後啟動 `bluetooth.service`。需要安裝 `bluez`。

## 6. NPU

請見 [npu/README.zh-TW.md](../npu/README.zh-TW.md)。

## 7. 我沒有驗證的事

* UART 救援、Maskrom 救援、其他韌體版本、其他核心。
* 藍牙音訊，以及重度 2.4 GHz 負載下 WiFi 與藍牙的共存。

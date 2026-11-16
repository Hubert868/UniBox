# RKNPU 驅動移植（RK3568、Debian 6.1）

[English](README.md) | **繁體中文**

把 Rockchip 的 `rknpu` 驅動 **0.9.8** 版，另外編成 Debian 原版 `6.1.0-53-arm64` 核心可載入的外部模組。
Debian 的核心沒有 Rockchip BSP，驅動預期存在的一些東西不在，必須用空殼取代，或由驅動自己處理。

**授權：GPL-2.0。** 這個補丁修改的是來自 Armbian `linux-rockchip` 核心樹的 GPL-2.0 程式碼
（Copyright Rockchip Electronics Co., Ltd.），請見 [COPYING](COPYING)。
本倉庫**不含** Rockchip 的原始碼，請自行取得。

## 內容

| 檔案 | 用途 |
|---|---|
| `rknpu-debian6.1-port.patch` | 對驅動原始碼的修改（相對於 `drivers/rknpu` 的 `diff -ruN`） |
| `Makefile`、`Kconfig` | 外部模組建置；DRM GEM 模式、啟用 debugfs，不含 devfreq／DMA heap／SRAM／fence |
| `stubs/` | 取代只存在於 Rockchip BSP 的標頭檔，以及 `vm_flags_set/clear`（6.3 才進入主線） |

## 補丁改了什麼

* 把 `CONFIG_PM_DEVFREQ` 的程式路徑改成自訂的 `RKNPU_USE_DEVFREQ` 巨集，因此不需要 devfreq。
* 沒有 devfreq 時，runtime PM 的空殼回傳 `0` 而不是 `-EOPNOTSUPP`（否則電源管理會失敗）。
* NPU 供電由驅動自行設定：模組參數 `rknpu_volt_uv`（預設 850000 uV；OPP 表在 <= 600 MHz 時需要
  850 mV）會在上電前套用。**請勿調低。**

## 建置

1. 從 Armbian `linux-rockchip` 核心樹取得對應 0.9.8 的 `rknpu` 原始碼（`drivers/rknpu/`），
   把該目錄複製到例如 `~/rknpu-build`。
2. 套用補丁並加入建置檔（已測試：用 `-p1` 可乾淨套用）：
   ```sh
   cd ~/rknpu-build
   patch -p1 < /path/to/UniBox/npu/rknpu-debian6.1-port.patch
   cp -r /path/to/UniBox/npu/{Makefile,Kconfig,stubs} .
   ```
3. 安裝 `linux-headers-6.1.0-53-arm64`，然後執行 `make`。
4. 用 `insmod rknpu.ko` 載入。我是手動載入；要不要開機自動載入由你決定。

它可以搭配這台機器原廠的裝置樹運作（該裝置樹已經描述了 NPU）。

## 我的機器上的結果（RK3568，NPU 600 MHz）

| 模型 | 延遲 | 處理量 |
|---|---|---|
| MobileNetV1 224x224 | 約 8.7 ms | 約 115 FPS |
| YOLOv5s 640x640 | 約 84.5 ms | 約 11.8 FPS |

10 分鐘燒機測試輸出皆為有限值、沒有錯誤。數據來自 `rknn-toolkit-lite2` 2.3.0 搭配
`librknnrt` 2.3.0，這兩者是 Rockchip 的專有元件，**未**附在本倉庫。

# WS2812 狀態燈條

[English](README.md) | **繁體中文**

這台機器有一條 WS2812 燈條接在 **GPIO105**（J8 接頭）。這裡的服務只負責設定顏色，
全都透過一個小型輔助程式 `/usr/local/bin/wsled` 去驅動燈條。

> **`wsled` 輔助程式目前還沒有放進這個倉庫。** 用法是
> `wsled [-n 數量] R,G,B [R,G,B...]`。`ws-set` 會匯出 GPIO105 再呼叫它。

| 單元 | 時機 | 顏色（R,G,B 亮度值） |
|---|---|---|
| `ws-boot.service` | 開機很早期 | `2,1,0`（暗橘） |
| `ws-ready.service` | 服務都起來了 | `0,1,0`（暗綠） |
| `ws-ready.service`（停止時） | 關機 | `1,0,0`（暗紅） |

安裝：把 `ws-set` 和 `wsled` 放到 `/usr/local/bin`，把單元檔放到 `/etc/systemd/system`，然後執行
`systemctl enable ws-boot.service ws-ready.service`。

燈條的資料線對時序很敏感，系統很忙的時候偶爾會讓顏色錯亂。重新執行 `ws-set 0,1,0` 就能恢復。

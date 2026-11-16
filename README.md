# UniBox
Debian13 on Uni Box

**English** | [繁體中文](README.zh-TW.md)

Notes, scripts and a driver port for running plain **Debian 13 (trixie)** on the
**China Unicom "UniBOX" smart-home box** (board string: `HINLINK RK3568 UNICOMBOX V1`),
replacing the stock fnOS ("trim") userland.

> **Unofficial, community work. Use at your own risk.** Flashing or modifying the boot
> chain of this box can brick it, and there is no SD-card slot. Read
> [docs/DEBIAN-ON-UNIBOX.md](docs/DEBIAN-ON-UNIBOX.md) and **back up the eMMC first**.

## Hardware (as seen on my unit)

| Item | Detail |
|---|---|
| SoC | Rockchip RK3568 (4x Cortex-A55), NPU 0.8 TOPS |
| RAM / storage | 4 GB / ~29 GB eMMC, no SD slot |
| Wi-Fi / Bluetooth | AP6398 module (Broadcom BCM43752), Wi-Fi on SDIO, Bluetooth on UART8 |
| LED | WS2812 strip on GPIO105 (connector J8) |
| Network | Wired Ethernet (interface is `end0` on some units, `end1` on others) |

## What is in this repo

| Path | What | License |
|---|---|---|
| [docs/DEBIAN-ON-UNIBOX.md](docs/DEBIAN-ON-UNIBOX.md) | How the boot chain works and how to move to Debian's own kernel/userland | MIT |
| [scripts/bluetooth](scripts/bluetooth) | Power-up sequence + `btattach` service for the AP6398 | MIT |
| [scripts/watchdog](scripts/watchdog) | Hardware watchdog, hung-task/soft-lockup auto-reboot, wired-link watchdog | MIT |
| [scripts/wifi](scripts/wifi) | NetworkManager setting that stops the brcmfmac SDIO sleep errors | MIT |
| [scripts/led](scripts/led) | Boot/ready/shutdown colours for the WS2812 strip (helper binary **not** included) | MIT |
| [cockpit/wifi](cockpit/wifi), [cockpit/bluetooth](cockpit/bluetooth) | Cockpit pages to scan/connect Wi-Fi and pair Bluetooth devices | MIT |
| [npu](npu) | Port of Rockchip's `rknpu` 0.9.8 driver to Debian's 6.1 kernel (patch + build files) | **GPL-2.0** |

## What is deliberately NOT here

* Disk images or backups of any kind (they contain keys, tokens and credentials).
* The device tree, `boot.scr`, U-Boot or any other vendor binary, vendor firmware.
* The Rockchip RKNN runtime (`librknnrt`) and toolkit; get them from Rockchip.
* Anything specific to my network, accounts or home automation setup.

## Status

Verified on one unit running Debian 13 with the Debian kernel `6.1.0-53-arm64`:
72 h soak with 0 unexpected reboots, Wi-Fi and Bluetooth up, containers stable.
Other units / firmware revisions are untested.

## License

MIT for everything except [npu/](npu), which is a patch to GPL-2.0 code and stays
GPL-2.0 (see [npu/COPYING](npu/COPYING)).

# RKNPU driver port (RK3568, Debian 6.1)

**English** | [繁體中文](README.zh-TW.md)

An out-of-tree build of Rockchip's `rknpu` driver, version **0.9.8**, for Debian's stock
`6.1.0-53-arm64` kernel. Debian's kernel has no Rockchip BSP, so a few things the driver
expects are missing and have to be stubbed or handled by the driver itself.

**License: GPL-2.0.** The patch modifies GPL-2.0 code from the Armbian `linux-rockchip`
kernel tree (Copyright Rockchip Electronics Co., Ltd.). See [COPYING](COPYING).
This repository does **not** contain the Rockchip sources; fetch them yourself.

## Contents

| File | Purpose |
|---|---|
| `rknpu-debian6.1-port.patch` | Changes to the driver sources (`diff -ruN` against `drivers/rknpu`) |
| `Makefile`, `Kconfig` | Out-of-tree module build; DRM GEM mode, debugfs on, no devfreq / DMA heap / SRAM / fence |
| `stubs/` | Replacements for headers that only exist in the Rockchip BSP, plus `vm_flags_set/clear` (they entered mainline in 6.3) |

## What the patch changes

* `CONFIG_PM_DEVFREQ` code paths are switched to a private `RKNPU_USE_DEVFREQ` macro, so
  devfreq is not required.
* Without devfreq the runtime-PM stubs return `0` instead of `-EOPNOTSUPP`
  (otherwise power management fails).
* The NPU supply is set by the driver: the module parameter `rknpu_volt_uv`
  (default 850000 uV; the OPP table needs 850 mV at <= 600 MHz) is applied before
  power-on. **Do not lower it.**

## Build

1. Get the `rknpu` sources matching 0.9.8 from the Armbian `linux-rockchip` tree
   (`drivers/rknpu/`) and copy that directory to, say, `~/rknpu-build`.
2. Apply the patch and add the build files (tested: it applies cleanly with `-p1`):
   ```sh
   cd ~/rknpu-build
   patch -p1 < /path/to/UniBox/npu/rknpu-debian6.1-port.patch
   cp -r /path/to/UniBox/npu/{Makefile,Kconfig,stubs} .
   ```
3. Install `linux-headers-6.1.0-53-arm64`, then `make`.
4. Load with `insmod rknpu.ko`. I loaded it manually; making it load at boot is left to you.

It worked with the box's stock device tree (which already describes the NPU).

## Results on my unit (RK3568, NPU at 600 MHz)

| Model | Latency | Throughput |
|---|---|---|
| MobileNetV1 224x224 | about 8.7 ms | about 115 FPS |
| YOLOv5s 640x640 | about 84.5 ms | about 11.8 FPS |

A 10-minute burn-in produced finite outputs and no errors. Numbers come from
`rknn-toolkit-lite2` 2.3.0 with `librknnrt` 2.3.0, which are Rockchip's proprietary
components and are **not** included here.

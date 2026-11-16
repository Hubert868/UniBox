# Debian on the UniBOX (RK3568)

This is what worked on my units. It is a description, not a one-click installer.
Everything here assumes you have SSH access and **a full backup**.

## 0. Safety first

* The box has **no SD-card slot** and Maskrom mode was not reliable for me, so the only
  real safety net is an image you took beforehand.
* Back up at least: the first 32 MiB of the eMMC (GPT + U-Boot, which starts at sector 64),
  the boot partition, and the root filesystem.
  Store the backup **off the box**.
* A UART header exists on the board. I did **not** test recovery over UART, so treat any
  "manual boot from the U-Boot prompt" idea as unverified.

## 1. How the stock boot chain works

* U-Boot lives on the eMMC and reads `/boot/fnEnv.txt` (kernel/initrd names, root device),
  then runs `boot.scr` (compiled from `boot.cmd`). As far as I could tell, it loads the
  kernel, device tree and `uInitrd` from the boot partition; I never needed to change it.
* The stock kernel and the userland packages come from the fnOS `trim` repository.

**Decision that kept my units bootable:** leave U-Boot, `fnEnv.txt`, `boot.scr`,
`boot.cmd` and the device tree exactly as shipped. Only swap what they load.

## 2. Use Debian's own kernel

The Debian arm64 kernel `6.1.0-53` (bookworm-security) booted with the vendor device tree.

1. Install `linux-image-6.1.0-53-arm64` from Debian.
2. U-Boot loads a U-Boot-format initrd, so create `uInitrd-<version>` from Debian's
   `initrd.img` with `mkimage -A arm64 -O linux -T ramdisk ...` and place it in `/boot`
   under the name `fnEnv.txt` expects. A kernel post-install hook that regenerates it
   automatically is worth adding, otherwise the next kernel update leaves the box
   unbootable.
3. Keep the old kernel files until the new one has booted at least twice, including one
   cold power cycle.
4. Make sure `/boot` has free space before any kernel upgrade (mine had about 180 MB).
5. Debian 12 -> 13 (trixie) dist-upgrade worked while **keeping the 6.1 kernel**; I did not
   try Debian's 6.12 kernel.

## 3. Removing the fnOS userland

Do this only after the Debian kernel boots on its own.

1. Take a filesystem snapshot (the root is btrfs on my units).
2. Simulate first: `apt-get -s purge <packages>` and read it. The `trim` kernel meta
   packages sort above Debian's versions, so replace `linux-libc-dev` and `libwbclient0`
   with the Debian versions explicitly (`--allow-downgrades`) or purge will try to drag
   in a lot of unrelated packages.
3. Before purging `trim`, record which systemd "enable" symlinks it owns. Purging it
   removes them, which silently disables services such as `ssh`, `NetworkManager`,
   `docker`, `containerd`, `cron` and `avahi`. **Re-create them immediately** after the
   purge.
4. Use Docker's official systemd unit. If your container data lives on a separate volume,
   add a drop-in `RequiresMountsFor=<mountpoint>` so Docker waits for it.
5. Disable `NetworkManager-wait-online` if it newly appears; it slows boot.
6. The Wi-Fi firmware in `/lib/firmware/brcm` was owned by a `trim` package. Copy it away
   before the purge and put it back afterwards as plain files.
7. Reboot, then verify: `fnEnv.txt`, `boot.scr`, `boot.cmd`, kernel and `uInitrd`
   unchanged (compare checksums taken before), no failed units, network up.

Result on my units: boot time dropped from about 2 minutes to about 25-45 seconds, and
memory use fell from about 1.4 GB to under 1 GB.

## 4. Stability fixes for the Wi-Fi chip

The AP6398 Wi-Fi sits on SDIO (`brcmfmac`). Under the 6.1 kernel it could stall the whole
machine some minutes after Wi-Fi connected. What helped:

* **Turn off 802.11 power save** ([scripts/wifi](scripts/wifi)). With it on I saw
  `brcmf_sdio_bus_sleep: error while changing bus sleep state -110` about 1-2 times an hour;
  with it off, almost none over days.
* **Hardware watchdog** (`RuntimeWatchdogSec=30`, `dw_wdt`): a frozen kernel resets in
  about 35 s. Tested with `echo c > /proc/sysrq-trigger`.
* **Auto-reboot on hung tasks / soft lockups** via sysctl
  ([scripts/watchdog](scripts/watchdog)).
* **Wired-link watchdog**: re-activates the wired connection if it loses its IPv4 address.
* Keep Ethernet as the preferred route (lower metric) and Wi-Fi as backup.
* Radio can be software-disabled by NetworkManager: if no access points appear, run
  `nmcli radio wifi on`.
* Set the correct Wi-Fi regulatory domain on your **router**; the chip uses a
  self-managed regulatory database and only intersects it with what the AP advertises.

A one-off `brcmf_p2p_create_p2pdev: timeout` when the radio is enabled was harmless on my units.

## 5. Bluetooth

The AP6398 Bluetooth is on UART8 (`fe6c0000.serial`). The tty name depends on the kernel
(`ttyS8` on the stock kernel, `ttyS0` on Debian's), so [scripts/bluetooth](scripts/bluetooth)
looks it up by device name. Sequence: power GPIOs up, then
`btattach -B <tty> -P bcm -S 115200 -N`, then start `bluetooth.service`. Install `bluez`.

## 6. NPU

See [npu/README.md](../npu/README.md).

## 7. Things I did not verify

* UART recovery, Maskrom recovery, other firmware revisions, other kernels.
* Bluetooth audio, and Wi-Fi/Bluetooth coexistence under heavy 2.4 GHz load.

# WS2812 status strip

**English** | [繁體中文](README.zh-TW.md)

The box has a WS2812 strip on **GPIO105** (connector J8). The units here only set colours;
they all go through a small helper, `/usr/local/bin/wsled`, which bit-bangs the strip.

> **The `wsled` helper is not included in this repository yet.** Its usage is
> `wsled [-n count] R,G,B [R,G,B...]`. `ws-set` exports GPIO105 and calls it.

| Unit | When | Colour (R,G,B levels) |
|---|---|---|
| `ws-boot.service` | very early boot | `2,1,0` (dim amber) |
| `ws-ready.service` | services up | `0,1,0` (dim green) |
| `ws-ready.service` (stop) | shutdown | `1,0,0` (dim red) |

Install: put `ws-set` and `wsled` in `/usr/local/bin`, the units in `/etc/systemd/system`, then
`systemctl enable ws-boot.service ws-ready.service`.

The strip's data line is timing sensitive; a very busy system can occasionally garble the
colours. Re-running `ws-set 0,1,0` fixes it.

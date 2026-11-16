#!/bin/bash
# 有線(end0)沒有 IPv4 時自動重新啟動有線連線；避免誤停用後整台失聯。
ip -4 -br addr show end0 2>/dev/null | awk '{print $3}' | grep -q . && exit 0
ip link show end0 2>/dev/null | grep -q "state UP\|NO-CARRIER" || exit 0
con=$(nmcli -t -f NAME,DEVICE,TYPE con show | awk -F: '$3=="802-3-ethernet"{print $1; exit}')
[ -n "$con" ] || exit 0
logger -t wired-watchdog "end0 無 IPv4，重新啟動連線: $con"
nmcli --wait 30 con up id "$con" 2>&1 | logger -t wired-watchdog

#ifndef _STUB_ROCKCHIP_OPP_SELECT_H
#define _STUB_ROCKCHIP_OPP_SELECT_H
/* Debian 6.1 移植：不使用 Rockchip DVFS，僅提供型別空殼 */
struct rockchip_opp_info { int unused; };
#include <linux/types.h>
#include <linux/errno.h>
struct device_node;
/* 僅裝置樹有 nvmem-cell-names "cores"(RK3583)時使用；RK3568 沒有 */
static inline int rockchip_nvmem_cell_read_u8(struct device_node *np, const char *cell_id, u8 *val) { return -ENOENT; }
#endif

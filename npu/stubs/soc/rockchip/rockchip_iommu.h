#ifndef _STUB_ROCKCHIP_IOMMU_H
#define _STUB_ROCKCHIP_IOMMU_H
#include <linux/device.h>
/* 僅 RK3588 多電源域(multiple_domains)路徑使用；RK3568 不會呼叫 */
static inline bool rockchip_iommu_is_enabled(struct device *dev) { return false; }
#endif

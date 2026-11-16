#ifndef _STUB_VERSION_COMPAT_DEFS_H
#define _STUB_VERSION_COMPAT_DEFS_H
#include <linux/mm.h>
/* Debian 6.1.187 沒有 vm_flags_set/clear(6.3 才進 mainline；Rockchip/Android 6.1 BSP 有回植) */
static inline void vm_flags_set(struct vm_area_struct *vma, unsigned long flags) { vma->vm_flags |= flags; }
static inline void vm_flags_clear(struct vm_area_struct *vma, unsigned long flags) { vma->vm_flags &= ~flags; }
#endif

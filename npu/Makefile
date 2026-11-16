# rknpu 0.9.8 外掛模組(Debian 6.1 移植)：DRM GEM 模式、debugfs、不含 devfreq/DMA heap/SRAM/fence
obj-m += rknpu.o
rknpu-y := rknpu_drv.o rknpu_reset.o rknpu_job.o rknpu_debugger.o rknpu_iommu.o rknpu_gem.o
ccflags-y += -I$(src)/include -I$(src)/stubs
ccflags-y += -DCONFIG_ROCKCHIP_RKNPU_DRM_GEM=1 -DCONFIG_ROCKCHIP_RKNPU_DEBUG_FS=1
KDIR ?= /lib/modules/$(shell uname -r)/build
all:
	$(MAKE) -C $(KDIR) M=$(PWD) modules
clean:
	$(MAKE) -C $(KDIR) M=$(PWD) clean

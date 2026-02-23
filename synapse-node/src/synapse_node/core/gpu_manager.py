"""GPU management and detection for NVIDIA CUDA devices."""

import asyncio
import logging
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

import psutil
from pynvml import (
    nvmlDeviceGetCount,
    nvmlDeviceGetHandleByIndex,
    nvmlDeviceGetMemoryInfo,
    nvmlDeviceGetName,
    nvmlDeviceGetTemperature,
    nvmlDeviceGetUtilizationRates,
    nvmlInit,
    nvmlShutdown,
    nvmlSystemGetDriverVersion,
    NVMLError,
)

from synapse_node.core.config import get_config

logger = logging.getLogger(__name__)


@dataclass
class GPUInfo:
    """GPU device information."""
    index: int
    name: str
    total_memory_mb: int
    free_memory_mb: int
    used_memory_mb: int
    temperature_c: int
    utilization_percent: int
    driver_version: str


@dataclass
class SystemResources:
    """Complete system resource information."""
    cpu_percent: float
    cpu_count: int
    memory_total_mb: int
    memory_available_mb: int
    gpus: List[GPUInfo]


class GPUManager:
    """Manages NVIDIA GPU detection and monitoring."""
    
    def __init__(self):
        self._initialized = False
        self._gpu_count = 0
        self._driver_version = "unknown"
        self._device_handles: Dict[int, any] = {}
        
    async def initialize(self) -> bool:
        """Initialize NVML and detect GPUs."""
        try:
            nvmlInit()
            self._initialized = True
            self._gpu_count = nvmlDeviceGetCount()
            self._driver_version = nvmlSystemGetDriverVersion()
            
            # Store device handles
            for i in range(self._gpu_count):
                self._device_handles[i] = nvmlDeviceGetHandleByIndex(i)
            
            logger.info(
                f"NVML initialized: {self._gpu_count} GPU(s) detected, "
                f"driver version: {self._driver_version}"
            )
            return True
            
        except NVMLError as e:
            logger.error(f"Failed to initialize NVML: {e}")
            self._initialized = False
            return False
    
    def shutdown(self):
        """Shutdown NVML."""
        if self._initialized:
            try:
                nvmlShutdown()
                logger.info("NVML shutdown complete")
            except NVMLError as e:
                logger.warning(f"Error during NVML shutdown: {e}")
            finally:
                self._initialized = False
    
    def get_gpu_count(self) -> int:
        """Get total number of GPUs."""
        return self._gpu_count if self._initialized else 0
    
    def get_gpu_info(self, device_index: Optional[int] = None) -> List[GPUInfo]:
        """Get information about specified GPU(s)."""
        if not self._initialized:
            return []
        
        indices = [device_index] if device_index is not None else range(self._gpu_count)
        gpus = []
        
        for idx in indices:
            if idx >= self._gpu_count:
                continue
                
            try:
                handle = self._device_handles.get(idx)
                if not handle:
                    continue
                
                # Get memory info
                mem_info = nvmlDeviceGetMemoryInfo(handle)
                
                # Get other stats
                name = nvmlDeviceGetName(handle)
                try:
                    temp = nvmlDeviceGetTemperature(handle, 0)  # 0 = GPU temperature
                except NVMLError:
                    temp = 0
                
                try:
                    util = nvmlDeviceGetUtilizationRates(handle)
                    util_percent = util.gpu
                except NVMLError:
                    util_percent = 0
                
                # Convert bytes to MB
                gpu_info = GPUInfo(
                    index=idx,
                    name=name.decode() if isinstance(name, bytes) else name,
                    total_memory_mb=mem_info.total // (1024 * 1024),
                    free_memory_mb=mem_info.free // (1024 * 1024),
                    used_memory_mb=mem_info.used // (1024 * 1024),
                    temperature_c=temp,
                    utilization_percent=util_percent,
                    driver_version=self._driver_version
                )
                gpus.append(gpu_info)
                
            except NVMLError as e:
                logger.warning(f"Error querying GPU {idx}: {e}")
        
        return gpus
    
    def get_system_resources(self) -> SystemResources:
        """Get complete system resource information."""
        # CPU info
        cpu_percent = psutil.cpu_percent(interval=0.1)
        cpu_count = psutil.cpu_count()
        
        # Memory info
        mem = psutil.virtual_memory()
        
        # GPU info
        gpus = self.get_gpu_info()
        
        return SystemResources(
            cpu_percent=cpu_percent,
            cpu_count=cpu_count,
            memory_total_mb=mem.total // (1024 * 1024),
            memory_available_mb=mem.available // (1024 * 1024),
            gpus=gpus
        )
    
    def select_best_gpu(self, required_memory_mb: int = 0) -> Optional[int]:
        """Select the best available GPU based on free memory."""
        if not self._initialized:
            return None
        
        gpus = self.get_gpu_info()
        if not gpus:
            return None
        
        # Sort by free memory (descending)
        gpus_sorted = sorted(gpus, key=lambda g: g.free_memory_mb, reverse=True)
        
        # Filter by required memory if specified
        if required_memory_mb > 0:
            suitable = [g for g in gpus_sorted if g.free_memory_mb >= required_memory_mb]
            if suitable:
                return suitable[0].index
            return None
        
        return gpus_sorted[0].index
    
    def get_gpu_memory_summary(self) -> Dict[int, Dict[str, int]]:
        """Get memory summary for all GPUs."""
        summary = {}
        for gpu in self.get_gpu_info():
            summary[gpu.index] = {
                "total_mb": gpu.total_memory_mb,
                "free_mb": gpu.free_memory_mb,
                "used_mb": gpu.used_memory_mb,
                "usage_percent": int((gpu.used_memory_mb / gpu.total_memory_mb) * 100)
            }
        return summary
    
    async def monitor_loop(self, interval_seconds: float = 5.0):
        """Continuous monitoring loop for GPU stats."""
        while True:
            try:
                resources = self.get_system_resources()
                for gpu in resources.gpus:
                    logger.debug(
                        f"GPU {gpu.index} ({gpu.name}): "
                        f"{gpu.used_memory_mb}/{gpu.total_memory_mb} MB "
                        f"({gpu.temperature_c}°C, {gpu.utilization_percent}%)"
                    )
                await asyncio.sleep(interval_seconds)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in GPU monitor loop: {e}")
                await asyncio.sleep(interval_seconds)


# Global GPU manager instance
_gpu_manager: Optional[GPUManager] = None


def get_gpu_manager() -> GPUManager:
    """Get or create global GPU manager instance."""
    global _gpu_manager
    if _gpu_manager is None:
        _gpu_manager = GPUManager()
    return _gpu_manager

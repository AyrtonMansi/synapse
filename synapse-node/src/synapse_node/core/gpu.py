"""Simplified GPU detection module."""

import logging
from dataclasses import dataclass
from typing import List, Optional, Dict

try:
    import pynvml
    HAS_NVML = True
except ImportError:
    HAS_NVML = False

logger = logging.getLogger(__name__)


@dataclass
class GPUDevice:
    """GPU device information."""
    index: int
    name: str
    total_memory_gb: float
    free_memory_gb: float
    compute_capability: Optional[str] = None


class GPUDetector:
    """Detects and monitors NVIDIA GPUs."""
    
    def __init__(self):
        self._initialized = False
        self._devices: List[GPUDevice] = []
        
    def initialize(self) -> bool:
        """Initialize GPU detection."""
        if not HAS_NVML:
            logger.warning("NVML not available - GPU detection disabled")
            return False
        
        try:
            pynvml.nvmlInit()
            self._initialized = True
            self._scan_devices()
            logger.info(f"GPU detection initialized - found {len(self._devices)} device(s)")
            return True
        except Exception as e:
            logger.error(f"Failed to initialize GPU detection: {e}")
            return False
    
    def _scan_devices(self):
        """Scan for available GPU devices."""
        if not self._initialized:
            return
        
        try:
            device_count = pynvml.nvmlDeviceGetCount()
            self._devices = []
            
            for i in range(device_count):
                handle = pynvml.nvmlDeviceGetHandleByIndex(i)
                name = pynvml.nvmlDeviceGetName(handle)
                mem_info = pynvml.nvmlDeviceGetMemoryInfo(handle)
                
                # Handle bytes vs string (different pynvml versions)
                if isinstance(name, bytes):
                    name = name.decode('utf-8')
                
                device = GPUDevice(
                    index=i,
                    name=name,
                    total_memory_gb=mem_info.total / (1024**3),
                    free_memory_gb=mem_info.free / (1024**3)
                )
                self._devices.append(device)
                
        except Exception as e:
            logger.error(f"Error scanning GPU devices: {e}")
    
    def get_devices(self) -> List[GPUDevice]:
        """Get list of available GPU devices."""
        return self._devices
    
    def get_device_count(self) -> int:
        """Get number of GPU devices."""
        return len(self._devices)
    
    def get_best_device(self, min_memory_gb: float = 4.0) -> Optional[GPUDevice]:
        """Get GPU with most free memory."""
        suitable = [d for d in self._devices if d.free_memory_gb >= min_memory_gb]
        if not suitable:
            return None
        return max(suitable, key=lambda d: d.free_memory_gb)
    
    def get_device_for_model(self, model_size_gb: float) -> Optional[int]:
        """Get device index that can fit the model (with some overhead)."""
        required_memory = model_size_gb * 1.5  # 50% overhead
        
        for device in self._devices:
            if device.free_memory_gb >= required_memory:
                return device.index
        
        return None
    
    def get_total_memory(self) -> float:
        """Get total GPU memory across all devices."""
        return sum(d.total_memory_gb for d in self._devices)
    
    def get_stats(self) -> Dict:
        """Get current GPU statistics."""
        if not self._initialized:
            return {"available": False}
        
        stats = {
            "available": True,
            "device_count": len(self._devices),
            "devices": []
        }
        
        for device in self._devices:
            try:
                handle = pynvml.nvmlDeviceGetHandleByIndex(device.index)
                mem_info = pynvml.nvmlDeviceGetMemoryInfo(handle)
                util = pynvml.nvmlDeviceGetUtilizationRates(handle)
                
                stats["devices"].append({
                    "index": device.index,
                    "name": device.name,
                    "memory_used_gb": mem_info.used / (1024**3),
                    "memory_free_gb": mem_info.free / (1024**3),
                    "memory_total_gb": mem_info.total / (1024**3),
                    "utilization_percent": util.gpu
                })
            except Exception as e:
                logger.warning(f"Error getting stats for GPU {device.index}: {e}")
        
        return stats
    
    def shutdown(self):
        """Shutdown GPU detection."""
        if self._initialized:
            try:
                pynvml.nvmlShutdown()
                self._initialized = False
            except:
                pass


# Global instance
_detector: Optional[GPUDetector] = None


def get_gpu_detector() -> GPUDetector:
    """Get global GPU detector instance."""
    global _detector
    if _detector is None:
        _detector = GPUDetector()
    return _detector


def auto_detect_gpus() -> List[GPUDevice]:
    """Auto-detect GPUs and return device list."""
    detector = get_gpu_detector()
    if detector.initialize():
        return detector.get_devices()
    return []

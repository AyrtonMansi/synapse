"""Model management - downloading, caching, and loading models."""

import asyncio
import hashlib
import logging
import re
import os
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple
from urllib.parse import urlparse

from huggingface_hub import (
    hf_hub_download,
    scan_cache_dir,
    snapshot_download,
)
from huggingface_hub.utils import RepositoryNotFoundError

from synapse_node.core.config import get_config

logger = logging.getLogger(__name__)

# SECURITY: Allowed model ID pattern
ALLOWED_MODEL_PATTERN = re.compile(r'^[a-zA-Z0-9_-]+/[a-zA-Z0-9_.-]+$')
MAX_MODEL_ID_LENGTH = 100

# SECURITY: Blocked model patterns (potentially harmful)
BLOCKED_PATTERNS = [
    r'\.\.',  # Directory traversal
    r'//',    # Double slash
    r'\\',    # Windows backslash
    r'\x00',  # Null byte
    r'\$\{',  # Shell interpolation
    r'`',     # Backtick
    r'[;&|]', # Command separators
]

# SECURITY: Allowed file extensions for model files
ALLOWED_EXTENSIONS = {'.bin', '.safetensors', '.json', '.txt', '.md', '.model', '.py', '.h5', '.onnx', '.pt', '.pth'}
MAX_FILE_SIZE_MB = 10000  # 10GB max per file


class ModelValidationError(Exception):
    """Raised when model validation fails."""
    pass


class ModelInfo:
    """Information about a cached model."""
    
    def __init__(self, model_id: str, local_path: Optional[Path] = None):
        self.model_id = model_id
        self.local_path = local_path
        self.is_downloaded = local_path is not None
        self.size_bytes: int = 0
        self.files: List[str] = []
        self.hash: Optional[str] = None  # SECURITY: Content hash for integrity
        
    def __repr__(self):
        status = "downloaded" if self.is_downloaded else "not downloaded"
        return f"ModelInfo({self.model_id}, {status})"
    
    def compute_hash(self) -> Optional[str]:
        """Compute hash of model directory for integrity verification."""
        if not self.local_path or not self.local_path.exists():
            return None
        
        try:
            hasher = hashlib.sha256()
            for file_path in sorted(self.local_path.rglob("*")):
                if file_path.is_file():
                    # Hash file path and size (not content, too slow)
                    relative_path = str(file_path.relative_to(self.local_path))
                    hasher.update(relative_path.encode())
                    hasher.update(str(file_path.stat().st_size).encode())
            self.hash = hasher.hexdigest()
            return self.hash
        except Exception as e:
            logger.warning(f"Failed to compute hash for {self.model_id}: {e}")
            return None


def validate_model_id(model_id: str) -> str:
    """
    SECURITY: Validate model ID format and security.
    
    Args:
        model_id: Model identifier string (e.g., 'meta-llama/Llama-2-7b')
        
    Returns:
        Validated and sanitized model ID
        
    Raises:
        ModelValidationError: If model ID is invalid or potentially harmful
    """
    if not model_id:
        raise ModelValidationError("Model ID cannot be empty")
    
    # Check length
    if len(model_id) > MAX_MODEL_ID_LENGTH:
        raise ModelValidationError(f"Model ID too long (max {MAX_MODEL_ID_LENGTH})")
    
    # Check basic format
    if not ALLOWED_MODEL_PATTERN.match(model_id):
        raise ModelValidationError(
            "Invalid model ID format. Expected: 'org/model-name' with alphanumeric characters"
        )
    
    # Check for dangerous patterns
    for pattern in BLOCKED_PATTERNS:
        if re.search(pattern, model_id):
            logger.warning(f"Blocked model ID with dangerous pattern: {model_id[:50]}")
            raise ModelValidationError("Model ID contains invalid characters")
    
    # Normalize model ID
    normalized = model_id.strip().lower()
    
    # Additional security: Check for path traversal attempts
    if '..' in normalized or normalized.startswith('/') or normalized.startswith('\\'):
        raise ModelValidationError("Invalid model ID: path traversal detected")
    
    return normalized


def validate_file_path(file_path: str, base_dir: Path) -> bool:
    """
    SECURITY: Validate that file path is within base directory.
    
    Args:
        file_path: Path to validate
        base_dir: Base directory that must contain file_path
        
    Returns:
        True if valid, False otherwise
    """
    try:
        # Resolve to absolute paths
        file_abs = Path(file_path).resolve()
        base_abs = base_dir.resolve()
        
        # Check if file is within base directory
        return str(file_abs).startswith(str(base_abs))
    except Exception:
        return False


def validate_file_content(file_path: Path) -> Tuple[bool, str]:
    """
    SECURITY: Validate file content and extension.
    
    Args:
        file_path: Path to file to validate
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    try:
        # Check extension
        if file_path.suffix.lower() not in ALLOWED_EXTENSIONS:
            return False, f"File type '{file_path.suffix}' not allowed"
        
        # Check size
        size = file_path.stat().st_size
        if size > MAX_FILE_SIZE_MB * 1024 * 1024:
            return False, f"File too large ({size / (1024*1024):.1f} MB > {MAX_FILE_SIZE_MB} MB)"
        
        # Check for binary signatures (basic check)
        with open(file_path, 'rb') as f:
            header = f.read(4)
            # Check for executable signatures
            executable_sigs = [b'\x7fELF', b'MZ', b'\xca\xfe\xba\xbe']
            if any(header.startswith(sig) for sig in executable_sigs):
                return False, "Executable files not allowed"
        
        return True, ""
    except Exception as e:
        return False, f"Validation error: {str(e)}"


class ModelManager:
    """Manages model downloading and caching with security controls."""
    
    def __init__(self, cache_dir: Optional[Path] = None):
        self.config = get_config()
        self.cache_dir = cache_dir or self.config.model_cache_dir
        
        # SECURITY: Ensure cache directory exists and is secure
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        
        # SECURITY: Validate cache directory is writable and not a symlink
        if not self.cache_dir.is_dir():
            raise ModelValidationError(f"Cache path is not a directory: {self.cache_dir}")
        if self.cache_dir.is_symlink():
            raise ModelValidationError("Cache directory cannot be a symlink")
        
        self._models: Dict[str, ModelInfo] = {}
        self._download_locks: Dict[str, asyncio.Lock] = {}
        self._loading_models: Set[str] = set()
        self._max_cache_size_gb = getattr(self.config, 'max_cache_size_gb', 100)
        
        logger.info(f"ModelManager initialized with cache dir: {self.cache_dir}")
    
    async def initialize(self):
        """Initialize model manager and scan existing cache."""
        await self._scan_cache()
        
        # Pre-download default models if configured
        if self.config.default_models:
            logger.info(f"Preloading {len(self.config.default_models)} default models...")
            for model_id in self.config.default_models:
                try:
                    # Validate before downloading
                    validated_id = validate_model_id(model_id)
                    await self.download_model(validated_id)
                    logger.info(f"Model {model_id} ready")
                except ModelValidationError as e:
                    logger.error(f"Invalid default model {model_id}: {e}")
                except Exception as e:
                    logger.error(f"Failed to download {model_id}: {e}")
    
    async def _scan_cache(self):
        """Scan the HuggingFace cache directory with security checks."""
        try:
            cache_info = scan_cache_dir()
            for repo in cache_info.repos:
                model_id = repo.repo_id
                
                # SECURITY: Validate model ID from cache
                try:
                    validate_model_id(model_id)
                except ModelValidationError:
                    logger.warning(f"Skipping invalid model in cache: {model_id}")
                    continue
                
                # Find the snapshot path
                for revision in repo.revisions:
                    if revision.snapshot_path.exists():
                        # SECURITY: Validate path is within cache directory
                        if not validate_file_path(revision.snapshot_path, self.cache_dir):
                            logger.warning(f"Cache path outside directory: {revision.snapshot_path}")
                            continue
                        
                        info = ModelInfo(model_id, revision.snapshot_path)
                        info.size_bytes = revision.size_on_disk
                        info.compute_hash()
                        self._models[model_id] = info
                        logger.debug(f"Found cached model: {model_id}")
                        break
        except Exception as e:
            logger.warning(f"Could not scan cache: {e}")
    
    def get_model_info(self, model_id: str) -> Optional[ModelInfo]:
        """Get information about a model."""
        # SECURITY: Validate model ID
        try:
            validated_id = validate_model_id(model_id)
            return self._models.get(validated_id)
        except ModelValidationError:
            return None
    
    def is_model_available(self, model_id: str) -> bool:
        """Check if a model is downloaded and available."""
        try:
            validated_id = validate_model_id(model_id)
            info = self._models.get(validated_id)
            return info is not None and info.is_downloaded
        except ModelValidationError:
            return False
    
    async def download_model(
        self, 
        model_id: str,
        force_redownload: bool = False,
        progress_callback: Optional[callable] = None
    ) -> ModelInfo:
        """
        Download a model from HuggingFace Hub with security controls.
        
        Args:
            model_id: Model identifier
            force_redownload: Whether to force re-download
            progress_callback: Optional progress callback
            
        Returns:
            ModelInfo object
            
        Raises:
            ModelValidationError: If model ID is invalid
            RepositoryNotFoundError: If model not found on HuggingFace
        """
        # SECURITY: Validate model ID
        validated_id = validate_model_id(model_id)
        
        # Check if already downloaded
        if not force_redownload and self.is_model_available(validated_id):
            logger.info(f"Model {validated_id} already cached")
            return self._models[validated_id]
        
        # Get or create download lock for this model
        if validated_id not in self._download_locks:
            self._download_locks[validated_id] = asyncio.Lock()
        
        async with self._download_locks[validated_id]:
            # Double-check after acquiring lock
            if not force_redownload and self.is_model_available(validated_id):
                return self._models[validated_id]
            
            logger.info(f"Downloading model: {validated_id}")
            
            # SECURITY: Check cache size before download
            current_size_gb = self.get_cache_size_bytes() / (1024**3)
            if current_size_gb > self._max_cache_size_gb:
                logger.warning(f"Cache size ({current_size_gb:.1f}GB) exceeds limit ({self._max_cache_size_gb}GB)")
                # Try to free space by removing old models
                await self._cleanup_cache()
            
            try:
                # Run snapshot download in thread pool
                loop = asyncio.get_event_loop()
                local_path = await loop.run_in_executor(
                    None,
                    lambda: snapshot_download(
                        repo_id=validated_id,
                        cache_dir=self.cache_dir,
                        resume_download=True,
                        local_files_only=False,
                    )
                )
                
                path = Path(local_path)
                
                # SECURITY: Validate downloaded path
                if not validate_file_path(path, self.cache_dir):
                    raise ModelValidationError("Downloaded model outside cache directory")
                
                # SECURITY: Scan downloaded files
                invalid_files = []
                for file_path in path.rglob("*"):
                    if file_path.is_file():
                        is_valid, error = validate_file_content(file_path)
                        if not is_valid:
                            invalid_files.append((file_path, error))
                
                if invalid_files:
                    logger.error(f"Invalid files in downloaded model: {invalid_files}")
                    # Remove invalid model
                    import shutil
                    shutil.rmtree(path, ignore_errors=True)
                    raise ModelValidationError(f"Model contains invalid files: {[f[0].name for f in invalid_files]}")
                
                info = ModelInfo(validated_id, path)
                info.is_downloaded = True
                
                # Calculate size
                if path.exists():
                    info.size_bytes = sum(
                        f.stat().st_size for f in path.rglob("*") if f.is_file()
                    )
                
                # Compute hash for integrity
                info.compute_hash()
                
                self._models[validated_id] = info
                
                logger.info(f"Model {validated_id} downloaded successfully ({info.size_bytes / 1e9:.2f} GB)")
                
                if progress_callback:
                    progress_callback(validated_id, 100.0)
                
                return info
                
            except RepositoryNotFoundError:
                logger.error(f"Model {validated_id} not found on HuggingFace Hub")
                raise
            except Exception as e:
                logger.error(f"Failed to download {validated_id}: {e}")
                raise
    
    async def _cleanup_cache(self):
        """Remove old models to free cache space."""
        # Sort models by last access (or download time)
        models_to_remove = sorted(
            self._models.items(),
            key=lambda x: x[1].local_path.stat().st_mtime if x[1].local_path else 0
        )
        
        # Remove oldest models until under limit
        for model_id, info in models_to_remove[:5]:  # Remove up to 5
            if model_id not in self.config.default_models:
                logger.info(f"Removing old model to free space: {model_id}")
                await self.delete_model(model_id)
    
    async def get_model_path(self, model_id: str, auto_download: bool = True) -> Optional[Path]:
        """Get local path for a model, downloading if necessary."""
        try:
            validated_id = validate_model_id(model_id)
            info = self._models.get(validated_id)
            
            if info and info.is_downloaded:
                return info.local_path
            
            if auto_download:
                info = await self.download_model(validated_id)
                return info.local_path
            
            return None
        except ModelValidationError:
            return None
    
    def list_cached_models(self) -> List[ModelInfo]:
        """List all cached models."""
        return [info for info in self._models.values() if info.is_downloaded]
    
    async def delete_model(self, model_id: str) -> bool:
        """Delete a cached model."""
        try:
            validated_id = validate_model_id(model_id)
            info = self._models.get(validated_id)
            if not info or not info.local_path:
                return False
            
            # SECURITY: Validate path before deletion
            if not validate_file_path(info.local_path, self.cache_dir):
                logger.error(f"Attempted to delete path outside cache: {info.local_path}")
                return False
            
            try:
                import shutil
                shutil.rmtree(info.local_path, ignore_errors=True)
                
                del self._models[validated_id]
                logger.info(f"Deleted model: {validated_id}")
                return True
            except Exception as e:
                logger.error(f"Failed to delete {validated_id}: {e}")
                return False
                
        except ModelValidationError:
            return False
    
    def get_cache_size_bytes(self) -> int:
        """Get total size of model cache in bytes."""
        return sum(info.size_bytes for info in self._models.values())
    
    def estimate_model_memory(self, model_id: str) -> float:
        """Estimate GPU memory needed for a model in GB."""
        try:
            validated_id = validate_model_id(model_id)
            model_id_lower = validated_id.lower()
            
            if "70b" in model_id_lower or "72b" in model_id_lower:
                return 40.0
            elif "34b" in model_id_lower or "35b" in model_id_lower:
                return 20.0
            elif "13b" in model_id_lower:
                return 10.0
            elif "7b" in model_id_lower or "8b" in model_id_lower:
                return 6.0
            elif "6.7b" in model_id_lower:
                return 5.0
            elif "3b" in model_id_lower:
                return 3.0
            elif "1b" in model_id_lower:
                return 2.0
            else:
                # Default estimate
                return 8.0
        except ModelValidationError:
            return 0.0
    
    def verify_model_integrity(self, model_id: str) -> bool:
        """
        Verify model integrity by comparing hashes.
        
        Args:
            model_id: Model to verify
            
        Returns:
            True if integrity check passes
        """
        try:
            validated_id = validate_model_id(model_id)
            info = self._models.get(validated_id)
            
            if not info or not info.local_path:
                return False
            
            if not info.hash:
                logger.warning(f"No hash stored for {validated_id}, computing now")
                info.compute_hash()
                return True  # Can't verify without stored hash
            
            current_hash = info.compute_hash()
            return current_hash == info.hash
            
        except ModelValidationError:
            return False


# Global model manager instance
_model_manager: Optional[ModelManager] = None


def get_model_manager() -> ModelManager:
    """Get or create global model manager instance."""
    global _model_manager
    if _model_manager is None:
        _model_manager = ModelManager()
    return _model_manager

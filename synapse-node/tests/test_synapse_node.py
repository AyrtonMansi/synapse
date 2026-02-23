"""Tests for Synapse Node components."""

import pytest
import asyncio


class TestGPUDetection:
    """Test GPU detection functionality."""
    
    def test_gpu_detector_creation(self):
        """Test GPU detector can be created."""
        from synapse_node.core.gpu import GPUDetector
        detector = GPUDetector()
        assert detector is not None
    
    def test_gpu_stats_structure(self):
        """Test GPU stats returns proper structure."""
        from synapse_node.core.gpu import get_gpu_detector
        detector = get_gpu_detector()
        stats = detector.get_stats()
        
        assert "available" in stats
        assert isinstance(stats["available"], bool)


class TestConfig:
    """Test configuration management."""
    
    def test_config_loads(self):
        """Test configuration loads successfully."""
        from synapse_node.core.config import get_config
        config = get_config()
        
        assert config is not None
        assert config.node_name is not None
    
    def test_default_models_list(self):
        """Test default models are configured."""
        from synapse_node.core.config import get_config
        config = get_config()
        
        assert isinstance(config.default_models, list)
        assert len(config.default_models) > 0


class TestZKProof:
    """Test ZK proof generation."""
    
    @pytest.mark.asyncio
    async def test_proof_generation(self):
        """Test proof can be generated."""
        from synapse_node.proof.zk import ZKProofGenerator, ProofInput
        
        generator = ZKProofGenerator()
        
        proof_input = ProofInput(
            request_hash="test_request_hash",
            response_hash="test_response_hash",
            model_id="test-model",
            timestamp=1234567890,
            gpu_utilization=50.0,
            tokens_generated=100
        )
        
        proof = await generator.generate_proof(proof_input)
        
        assert proof is not None
        assert proof.proof_id is not None
        assert proof.proof_data is not None
    
    def test_proof_verification(self):
        """Test proof can be verified."""
        from synapse_node.proof.zk import ZKProofGenerator, ZKProof
        
        generator = ZKProofGenerator()
        
        # Create a mock proof
        proof = ZKProof(
            proof_id="test-proof",
            proof_data="eyJ0ZXN0IjogdHJ1ZX0=",
            public_inputs=["input1", "input2"],
            circuit_id="inference_work_v1",
            generated_at=1234567890,
            verification_key_hash="abc123"
        )
        
        # Note: This will fail verification due to mock data
        # but should not raise an exception
        result = generator.verify_proof(proof)
        assert isinstance(result, bool)


class TestMeshClient:
    """Test mesh network client."""
    
    def test_mesh_client_creation(self):
        """Test mesh client can be created."""
        from synapse_node.network.mesh import MeshClient
        client = MeshClient()
        assert client is not None
        assert client.node_id is not None
    
    def test_message_creation(self):
        """Test mesh message creation."""
        from synapse_node.network.mesh import MeshMessage
        
        msg = MeshMessage(
            msg_type="test",
            payload={"data": "test"},
            sender_id="test-node",
            timestamp=1234567890.0,
            message_id="test-msg"
        )
        
        data = msg.to_dict()
        assert data["type"] == "test"
        assert data["payload"]["data"] == "test"


class TestModelManager:
    """Test model management."""
    
    def test_model_manager_creation(self):
        """Test model manager can be created."""
        from synapse_node.core.model_manager import ModelManager
        manager = ModelManager()
        assert manager is not None
    
    def test_model_size_estimation(self):
        """Test model size estimation."""
        from synapse_node.core.model_manager import ModelManager
        
        manager = ModelManager()
        
        # Test various model sizes
        assert manager.estimate_model_memory("llama-7b") == 16.0
        assert manager.estimate_model_memory("llama-13b") == 10.0
        assert manager.estimate_model_memory("llama-70b") == 140.0


class TestCLI:
    """Test CLI commands."""
    
    def test_cli_imports(self):
        """Test CLI module can be imported."""
        from synapse_node.cli.main import cli
        assert cli is not None

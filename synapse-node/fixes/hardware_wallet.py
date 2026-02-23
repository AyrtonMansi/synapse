"""Hardware wallet integration for secure key management."""

import asyncio
from typing import Optional, Tuple, List
from dataclasses import dataclass
from enum import Enum


class WalletType(Enum):
    """Supported hardware wallet types."""
    LEDGER = "ledger"
    TREZOR = "trezor"
    KEYSTONE = "keystone"
    AIRGAP = "airgap"


@dataclass
class WalletAccount:
    """Account info from hardware wallet."""
    address: str
    path: str
    index: int


class HardwareWalletManager:
    """Manages connections to hardware wallets."""
    
    def __init__(self):
        self.connected_wallet: Optional[WalletType] = None
        self.transport = None
        self.app = None
    
    async def detect_ledgers(self) -> List[WalletAccount]:
        """Detect connected Ledger devices."""
        try:
            # Try ledgereth library
            from ledgereth import create_account, get_accounts
            from ledgereth.web3 import LedgerSignerMiddleware
            
            accounts = []
            for i in range(5):  # Check first 5 accounts
                try:
                    account = get_accounts(account=i)
                    if account:
                        accounts.append(WalletAccount(
                            address=account.address,
                            path=f"44'/60'/0'/0/{i}",
                            index=i
                        ))
                except Exception:
                    break
            
            return accounts
            
        except ImportError:
            print("ledgereth not installed, Ledger support disabled")
            return []
        except Exception as e:
            print(f"Failed to detect Ledger: {e}")
            return []
    
    async def detect_trezors(self) -> List[WalletAccount]:
        """Detect connected Trezor devices."""
        try:
            from trezorlib.client import TrezorClient
            from trezorlib.transport import get_transport
            from trezorlib.tools import parse_path
            from trezorlib import ethereum
            
            transport = get_transport()
            if not transport:
                return []
            
            client = TrezorClient(transport)
            accounts = []
            
            for i in range(5):
                path = parse_path(f"44'/60'/0'/0/{i}")
                address = ethereum.get_address(client, path).address
                accounts.append(WalletAccount(
                    address=address,
                    path=f"44'/60'/0'/0/{i}",
                    index=i
                ))
            
            client.close()
            return accounts
            
        except ImportError:
            print("trezorlib not installed, Trezor support disabled")
            return []
        except Exception as e:
            print(f"Failed to detect Trezor: {e}")
            return []
    
    async def detect_all_wallets(self) -> Dict[WalletType, List[WalletAccount]]:
        """Detect all connected hardware wallets."""
        results = {}
        
        # Detect Ledger
        ledger_accounts = await self.detect_ledgers()
        if ledger_accounts:
            results[WalletType.LEDGER] = ledger_accounts
        
        # Detect Trezor
        trezor_accounts = await self.detect_trezors()
        if trezor_accounts:
            results[WalletType.TREZOR] = trezor_accounts
        
        return results
    
    async def connect_ledger(self, account_index: int = 0):
        """Connect to Ledger device."""
        try:
            from ledgereth.web3 import LedgerSignerMiddleware
            from ledgereth.accounts import find_account
            from web3 import Web3
            
            # Find the account
            account = find_account(account=account_index)
            if not account:
                raise Exception(f"Ledger account {account_index} not found")
            
            self.connected_wallet = WalletType.LEDGER
            
            return {
                "type": WalletType.LEDGER,
                "address": account.address,
                "signer": account,
            }
            
        except Exception as e:
            raise Exception(f"Failed to connect to Ledger: {e}")
    
    async def sign_with_ledger(self, message: bytes, account_index: int = 0) -> str:
        """Sign a message with Ledger."""
        try:
            from ledgereth import sign_message
            
            signed = sign_message(message, account=account_index)
            return signed.signature.hex()
            
        except Exception as e:
            raise Exception(f"Failed to sign with Ledger: {e}")
    
    async def sign_transaction_with_ledger(
        self,
        to: str,
        value: int,
        gas: int,
        gas_price: int,
        nonce: int,
        data: bytes = b"",
        chain_id: int = 1,
        account_index: int = 0
    ) -> str:
        """Sign a transaction with Ledger."""
        try:
            from ledgereth import sign_transaction
            from ledgereth.objects import LedgerTransaction
            
            tx = LedgerTransaction(
                destination=to,
                value=value,
                gas_limit=gas,
                gas_price=gas_price,
                nonce=nonce,
                data=data,
                chain_id=chain_id,
                account=account_index,
            )
            
            signed = sign_transaction(tx)
            return signed.rawTransaction.hex()
            
        except Exception as e:
            raise Exception(f"Failed to sign transaction with Ledger: {e}")


class SecureKeyStore:
    """Encrypted key storage for software keys (fallback)."""
    
    def __init__(self, keystore_path: str = "~/.synapse/keystore"):
        self.keystore_path = Path(keystore_path).expanduser()
        self.keystore_path.mkdir(parents=True, exist_ok=True)
    
    def create_keystore(
        self,
        private_key: str,
        password: str,
        name: str = "default"
    ) -> str:
        """Create an encrypted keystore file."""
        try:
            from eth_account import Account
            import json
            
            # Encrypt private key
            account = Account.from_key(private_key)
            encrypted = Account.encrypt(private_key, password)
            
            # Save to file
            keystore_file = self.keystore_path / f"{name}.json"
            with open(keystore_file, "w") as f:
                json.dump(encrypted, f)
            
            return account.address
            
        except Exception as e:
            raise Exception(f"Failed to create keystore: {e}")
    
    def load_keystore(self, password: str, name: str = "default") -> str:
        """Load private key from keystore."""
        try:
            from eth_account import Account
            import json
            
            keystore_file = self.keystore_path / f"{name}.json"
            if not keystore_file.exists():
                raise FileNotFoundError(f"Keystore {name} not found")
            
            with open(keystore_file) as f:
                encrypted = json.load(f)
            
            private_key = Account.decrypt(encrypted, password)
            return private_key.hex()
            
        except Exception as e:
            raise Exception(f"Failed to load keystore: {e}")
    
    def list_keystores(self) -> List[str]:
        """List available keystores."""
        keystores = []
        for f in self.keystore_path.glob("*.json"):
            keystores.append(f.stem)
        return keystores


class NodeWallet:
    """High-level wallet interface for Synapse node."""
    
    def __init__(self):
        self.hw_manager = HardwareWalletManager()
        self.keystore = SecureKeyStore()
        self.wallet_type: Optional[WalletType] = None
        self.address: Optional[str] = None
        self._private_key: Optional[str] = None  # Only for software wallets
    
    async def setup_hardware_wallet(self) -> str:
        """Setup with hardware wallet (recommended)."""
        # Detect available wallets
        wallets = await self.hw_manager.detect_all_wallets()
        
        if not wallets:
            raise Exception("No hardware wallets detected")
        
        # For now, use first available
        for wallet_type, accounts in wallets.items():
            if accounts:
                self.wallet_type = wallet_type
                self.address = accounts[0].address
                
                if wallet_type == WalletType.LEDGER:
                    await self.hw_manager.connect_ledger(accounts[0].index)
                
                print(f"Connected to {wallet_type.value}: {self.address}")
                return self.address
        
        raise Exception("No accounts found in hardware wallets")
    
    def setup_keystore(self, name: str = "default") -> str:
        """Setup with encrypted keystore."""
        # Check if keystore exists
        keystores = self.keystore.list_keystores()
        
        if name not in keystores:
            # Create new keystore
            import secrets
            private_key = "0x" + secrets.token_hex(32)
            
            print(f"Creating new keystore: {name}")
            password = input("Enter password for keystore: ")
            
            self.address = self.keystore.create_keystore(private_key, password, name)
            self._private_key = private_key
        else:
            # Load existing
            password = input("Enter password for keystore: ")
            self._private_key = self.keystore.load_keystore(password, name)
            
            from eth_account import Account
            self.address = Account.from_key(self._private_key).address
        
        self.wallet_type = None  # Software wallet
        return self.address
    
    async def setup_from_env(self) -> Optional[str]:
        """Setup from environment variable (least secure, not recommended)."""
        private_key = os.environ.get("SYNAPSE_WALLET_PRIVATE_KEY")
        
        if private_key:
            print("WARNING: Using private key from environment variable is insecure!")
            print("Consider using a hardware wallet or encrypted keystore.")
            
            from eth_account import Account
            self._private_key = private_key
            self.address = Account.from_key(private_key).address
            self.wallet_type = None
            
            return self.address
        
        return None
    
    async def sign_message(self, message: bytes) -> str:
        """Sign a message with the configured wallet."""
        if self.wallet_type == WalletType.LEDGER:
            return await self.hw_manager.sign_with_ledger(message)
        elif self._private_key:
            from eth_account import Account
            account = Account.from_key(self._private_key)
            signed = account.sign_message(message)
            return signed.signature.hex()
        else:
            raise Exception("No wallet configured")
    
    async def sign_transaction(self, tx_dict: dict) -> str:
        """Sign a transaction."""
        if self.wallet_type == WalletType.LEDGER:
            return await self.hw_manager.sign_transaction_with_ledger(
                to=tx_dict["to"],
                value=tx_dict.get("value", 0),
                gas=tx_dict["gas"],
                gas_price=tx_dict["gasPrice"],
                nonce=tx_dict["nonce"],
                data=bytes.fromhex(tx_dict.get("data", "0x")[2:]),
                chain_id=tx_dict.get("chainId", 1),
            )
        elif self._private_key:
            from eth_account import Account
            account = Account.from_key(self._private_key)
            signed = account.sign_transaction(tx_dict)
            return signed.rawTransaction.hex()
        else:
            raise Exception("No wallet configured")
    
    def is_hardware_wallet(self) -> bool:
        """Check if using hardware wallet."""
        return self.wallet_type is not None


# Global instance
_wallet: Optional[NodeWallet] = None


def get_node_wallet() -> NodeWallet:
    """Get global node wallet instance."""
    global _wallet
    if _wallet is None:
        _wallet = NodeWallet()
    return _wallet

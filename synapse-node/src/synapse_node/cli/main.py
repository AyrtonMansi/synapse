#!/usr/bin/env python3
"""Synapse Node CLI - Wallet, registration, logs, and earnings management."""

import asyncio
import json
import os
import sys
from pathlib import Path
from typing import Optional

import click
import requests
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.progress import Progress, SpinnerColumn, TextColumn

console = Console()

# Configuration paths
CONFIG_DIR = Path.home() / ".synapse"
WALLET_FILE = CONFIG_DIR / "wallet.json"
NODE_CONFIG_FILE = CONFIG_DIR / "node.json"
API_BASE_URL = os.environ.get("SYNAPSE_API_URL", "http://localhost:8080")


def ensure_config_dir():
    """Ensure configuration directory exists."""
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)


def load_wallet() -> Optional[dict]:
    """Load wallet from file."""
    if WALLET_FILE.exists():
        return json.loads(WALLET_FILE.read_text())
    return None


def save_wallet(wallet_data: dict):
    """Save wallet to file with restricted permissions."""
    ensure_config_dir()
    WALLET_FILE.write_text(json.dumps(wallet_data, indent=2))
    os.chmod(WALLET_FILE, 0o600)


@click.group()
@click.version_option(version="0.1.0", prog_name="synapse")
def cli():
    """Synapse Node CLI - Manage your inference node."""
    pass


@cli.command("start")
@click.option("--host", default="0.0.0.0", help="API host")
@click.option("--port", default=8080, help="API port")
def start(host, port):
    """Start the Synapse node server."""
    import uvicorn
    from synapse_node.core.node import create_app
    
    console.print(Panel(
        f"[green]Starting Synapse Node...[/green]\n\n"
        f"API: http://{host}:{port}\n"
        f"Metrics: http://{host}:{port + 100}",
        title="Synapse Node",
        border_style="green"
    ))
    
    app = create_app()
    uvicorn.run(app, host=host, port=port, log_level="info")


# =============================================================================
# Wallet Commands
# =============================================================================

@cli.group()
def wallet():
    """Manage your Synapse wallet."""
    pass


@wallet.command("create")
@click.option("--password", prompt=True, hide_input=True, confirmation_prompt=True)
def wallet_create(password):
    """Create a new wallet."""
    try:
        from eth_account import Account
    except ImportError:
        console.print("[red]Error: web3 package not installed. Run 'pip install web3'[/red]")
        sys.exit(1)
    
    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console
    ) as progress:
        task = progress.add_task("Creating wallet...", total=None)
        
        account = Account.create()
        encrypted = Account.encrypt(account.key.hex(), password)
        
        wallet_data = {
            "address": account.address,
            "encrypted_key": encrypted,
            "created_at": str(Path().stat().st_ctime)
        }
        
        save_wallet(wallet_data)
        progress.update(task, completed=True)
    
    console.print(Panel(
        f"[green]Wallet created successfully![/green]\n\n"
        f"Address: [cyan]{account.address}[/cyan]\n\n"
        f"[yellow]IMPORTANT:[/yellow] Store your password safely.",
        title="Wallet Created",
        border_style="green"
    ))


@wallet.command("import")
@click.option("--private-key", prompt=True, hide_input=True)
@click.option("--password", prompt=True, hide_input=True, confirmation_prompt=True)
def wallet_import(private_key, password):
    """Import wallet from private key."""
    try:
        from eth_account import Account
    except ImportError:
        console.print("[red]Error: web3 package not installed.[/red]")
        sys.exit(1)
    
    try:
        private_key = private_key.strip()
        if private_key.startswith("0x"):
            private_key = private_key[2:]
        
        account = Account.from_key(private_key)
        encrypted = Account.encrypt(private_key, password)
        
        wallet_data = {
            "address": account.address,
            "encrypted_key": encrypted,
            "imported_at": str(Path().stat().st_ctime)
        }
        
        save_wallet(wallet_data)
        
        console.print(Panel(
            f"[green]Wallet imported successfully![/green]\n\n"
            f"Address: [cyan]{account.address}[/cyan]",
            title="Wallet Imported",
            border_style="green"
        ))
    except Exception as e:
        console.print(f"[red]Error importing wallet: {e}[/red]")
        sys.exit(1)


@wallet.command("show")
def wallet_show():
    """Display wallet information."""
    wallet_data = load_wallet()
    
    if not wallet_data:
        console.print("[red]No wallet found. Run 'synapse wallet create' first.[/red]")
        sys.exit(1)
    
    table = Table(title="Wallet Information")
    table.add_column("Property", style="cyan")
    table.add_column("Value", style="green")
    
    table.add_row("Address", wallet_data.get("address", "N/A"))
    table.add_row("Created", wallet_data.get("created_at", wallet_data.get("imported_at", "Unknown")))
    
    console.print(table)


# =============================================================================
# Node Commands
# =============================================================================

@cli.group()
def node():
    """Manage your Synapse node."""
    pass


@node.command("status")
def node_status():
    """Check node status."""
    try:
        response = requests.get(f"{API_BASE_URL}/health", timeout=5)
        data = response.json()
        
        table = Table(title="Node Status")
        table.add_column("Property", style="cyan")
        table.add_column("Value", style="green")
        
        table.add_row("Status", data.get("status", "N/A"))
        table.add_row("Node ID", data.get("node_id", "N/A"))
        table.add_row("GPU Available", "Yes" if data.get("gpu_available") else "No")
        table.add_row("Mesh Connected", "Yes" if data.get("mesh_connected") else "No")
        table.add_row("Models Loaded", str(len(data.get("models_loaded", []))))
        
        console.print(table)
        
    except requests.ConnectionError:
        console.print("[red]Node is not running. Start it with 'synapse start'[/red]")
        sys.exit(1)
    except Exception as e:
        console.print(f"[red]Error: {e}[/red]")
        sys.exit(1)


# =============================================================================
# Logs Commands
# =============================================================================

@cli.group()
def logs():
    """View node logs."""
    pass


@logs.command("show")
@click.option("--follow", "-f", is_flag=True, help="Follow log output")
@click.option("--lines", "-n", default=100, help="Number of lines to show")
def logs_show(follow, lines):
    """View node logs."""
    log_paths = [
        Path("/app/logs/synapse.log"),
        Path("logs/synapse.log"),
        Path("/var/log/synapse/synapse.log"),
    ]
    
    log_file = None
    for path in log_paths:
        if path.exists():
            log_file = path
            break
    
    if not log_file:
        console.print("[yellow]No log file found.[/yellow]")
        return
    
    if follow:
        import subprocess
        try:
            subprocess.run(["tail", "-f", str(log_file)])
        except KeyboardInterrupt:
            pass
    else:
        content = log_file.read_text().split("\n")
        for line in content[-lines:]:
            if line:
                console.print(line)


# =============================================================================
# Main Entry Point
# =============================================================================

if __name__ == "__main__":
    cli()

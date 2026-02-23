#!/usr/bin/env python3
"""Entry point for running the Synapse Node."""

import asyncio
import sys

from synapse_node.core.node import create_app
import uvicorn


def main():
    """Main entry point."""
    app = create_app()
    
    # Get config
    from synapse_node.core.config import get_config
    config = get_config()
    
    # Run with uvicorn
    uvicorn.run(
        app,
        host=config.api_host,
        port=config.api_port,
        log_level=config.log_level.lower(),
        access_log=True
    )


if __name__ == "__main__":
    main()

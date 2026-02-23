FROM ghcr.io/foundry-rs/foundry:latest

WORKDIR /contracts

# Install dependencies
COPY foundry.toml ./
COPY src ./src
COPY script ./script
COPY test ./test

# Build contracts
RUN forge build

# Deploy script
COPY deploy.sh ./
RUN chmod +x deploy.sh

CMD ["./deploy.sh"]
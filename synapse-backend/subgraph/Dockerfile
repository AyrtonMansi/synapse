FROM node:20-alpine

WORKDIR /app

# Install graph CLI
RUN npm install -g @graphprotocol/graph-cli

# Copy package files
COPY package*.json ./
COPY subgraph.yaml ./
COPY schema.graphql ./

# Install dependencies
RUN npm ci

# Copy source
COPY src ./src
COPY abis ./abis

# Build
RUN graph codegen && graph build

# Default command
CMD ["graph", "--help"]
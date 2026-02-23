FROM node:20-alpine

# Install dependencies for native modules
RUN apk add --no-cache python3 make g++ git

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source
COPY src ./src

# Build TypeScript
RUN npm run build 2>/dev/null || echo "No build script"

# Expose ports
EXPOSE 4000
EXPOSE 10000-10100

# Start
CMD ["npm", "start"]
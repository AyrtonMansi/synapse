FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source
COPY src ./src

# Expose port
EXPOSE 5002

# Start
CMD ["npm", "start"]
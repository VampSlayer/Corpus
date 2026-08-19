FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including tsx for the build scripts)
RUN npm ci

# Copy source code
COPY . .

# Compile TypeScript
RUN npx tsc

# Environment variables
ENV NODE_ENV=production
ENV CORPUS_DIR=/app/corpus

# Ensure corpus dir exists
RUN mkdir -p /app/corpus

# By default, use node directly to avoid npm noise on stdout (which breaks MCP stdio)
CMD ["node", "dist/src/index.js"]

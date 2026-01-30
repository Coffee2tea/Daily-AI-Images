# Use lightweight Node.js image
FROM node:18-slim

# Set working directory
# Set working directory
WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Install basic dependencies if needed (curl/wget for healthchecks)
# RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies (production only)
RUN npm install --only=production

# Copy source code
COPY . .

# Create necessary directories for persistence and grant permissions
RUN mkdir -p generated_images downloaded_images data && \
    chmod -R 777 generated_images downloaded_images data

# Expose the port
EXPOSE 3000

# Start the server directly
CMD ["node", "src/server/server.js"]

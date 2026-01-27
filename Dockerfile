# Use lightweight Node.js image
FROM node:18-slim

# Set working directory
# Set working directory
WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Install basic system dependencies for canvas/image processing if needed
RUN apt-get update && apt-get install -y \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies (skip playwright browser binaries)
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN npm install

# Copy source code
COPY . .

# Create necessary directories for persistence and grant permissions
RUN mkdir -p generated_images downloaded_images data && \
    chmod -R 777 generated_images downloaded_images data

# Expose the port
EXPOSE 3000

# Start the server directly
CMD ["node", "src/server/server.js"]

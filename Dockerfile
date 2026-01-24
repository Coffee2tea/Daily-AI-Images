# Use official Node.js image with Playwright pre-installed
# This base image includes all necessary system dependencies for browsers
FROM mcr.microsoft.com/playwright:v1.48.0-focal

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies (including production deps)
RUN npm install

# Copy source code
COPY . .

# Create necessary directories for persistence
RUN mkdir -p generated_images downloaded_images data

# Expose the port
EXPOSE 3000

# Start the server directly
# Note: We use the standalone server script, not map main.js, 
# because main.js runs a one-off workflow then starts server.
# In production, we want the server up immediately.
CMD ["node", "src/server/server.js"]

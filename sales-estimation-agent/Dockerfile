FROM node:20-slim

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source
COPY . .
RUN npm run build

# Expose port
EXPOSE 3001

# Start
CMD ["node", "dist/server.js"]

# Use Node.js 22 runtime image as requested
FROM node:22-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application code
COPY . .

# Build the application
RUN npm run build

# Expose the port the app listens on
EXPOSE 8080

# Start the application
CMD ["npm", "start"]

FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY pnpm-workspace.yaml ./
COPY turbo.json ./

# Install pnpm
RUN npm install -g pnpm

# Install dependencies
RUN pnpm install --prod

# Copy source code
COPY . .

# Build the application
RUN pnpm run --filter @openbox/api build

# Expose port
EXPOSE 3000

# Start the application
CMD ["pnpm", "run", "--filter", "@openbox/api", "start"]
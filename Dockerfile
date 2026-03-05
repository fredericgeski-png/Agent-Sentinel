# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Build frontend & backend
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

# Only copy necessary files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
# Note: In a true distroless/minimal setup we'd prune devDependencies,
# but for simplicity we keep it standard here.

ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

CMD ["npm", "run", "start"]

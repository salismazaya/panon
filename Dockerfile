# Stage 1: Build Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

# Copy frontend source
COPY frontend/package*.json ./
RUN npm install

# Copy rest of frontend source
COPY frontend/ ./

# Build with empty VITE_API_URL so it uses relative paths (same origin)
ENV VITE_API_URL=""
RUN npm run build

# Stage 2: Build Backend
FROM golang:1.26-alpine AS backend-builder
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git

# Copy go mod and sum
COPY go.mod go.sum ./
RUN go mod download

# Copy source
COPY . .

# Build the binary
RUN CGO_ENABLED=0 GOOS=linux go build -o panon-server main.go

# Stage 4: Final Image
FROM alpine:latest
WORKDIR /app

# Install runtime dependencies (ca-certificates for HTTPS/RPC calls)
RUN apk add --no-cache ca-certificates

# Copy from builders
COPY --from=backend-builder /app/panon-server .
COPY --from=frontend-builder /app/frontend/dist ./dist

# Expose the API and UI port
EXPOSE 3333

# Start the server
CMD ["./panon-server"]

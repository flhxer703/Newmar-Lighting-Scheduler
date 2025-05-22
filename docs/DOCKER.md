# Docker Setup for RV Lighting Control System

This guide covers setting up the RV Lighting Control System using Docker for easy deployment and management.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Docker Compose](#docker-compose)
- [Environment Variables](#environment-variables)
- [Volumes](#volumes)
- [Networking](#networking)
- [Production Deployment](#production-deployment)
- [Troubleshooting](#troubleshooting)

## Prerequisites

- Docker Engine 20.10 or later
- Docker Compose 2.0 or later (if using docker-compose.yml)
- At least 512MB free RAM
- Network access to RV control system

## Quick Start

### 1. Build and Run with Docker

```bash
# Clone the repository
git clone https://github.com/yourusername/rv-lighting-control.git
cd rv-lighting-control

# Build the Docker image
docker build -t rv-lighting-control .

# Run the container
docker run -d \
  --name rv-lighting \
  -p 3000:3000 \
  -v $(pwd)/config:/app/config \
  -v $(pwd)/data:/app/data \
  rv-lighting-control
```

### 2. Using Docker Compose (Recommended)

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Configuration

### Default Configuration

The container creates a default configuration on first run:

```json
{
  "connection": {
    "controller_ip": "192.168.1.100",
    "controller_port": 8092,
    "use_ssl": false
  },
  "ui": {
    "theme": "default",
    "show_diagnostics": true
  }
}
```

### Custom Configuration

Mount your own configuration file:

```bash
docker run -d \
  --name rv-lighting \
  -p 3000:3000 \
  -v /path/to/your/config.json:/app/config/settings.json \
  rv-lighting-control
```

## Docker Compose

### Basic Setup

```yaml
version: '3.8'

services:
  rv-lighting-control:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./config:/app/config
      - ./data:/app/data
    environment:
      - NODE_ENV=production
    restart: unless-stopped
```

### Advanced Setup with File Browser

The included `docker-compose.yml` provides:

- **Main Application** (port 3000): RV Lighting Control
- **File Browser** (port 3001): Easy config file editing

```bash
# Start all services
docker-compose up -d

# Access applications
# Main app: http://your-rv-ip:3000
# File browser: http://your-rv-ip:3001
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Environment mode |
| `PORT` | `3000` | Server port |
| `CONFIG_FILE` | `./config/settings.json` | Configuration file path |
| `DATA_DIR` | `./data` | Data directory path |
| `LOG_LEVEL` | `info` | Logging level |

### Example with Environment Variables

```bash
docker run -d \
  --name rv-lighting \
  -p 8080:3000 \
  -e PORT=3000 \
  -e NODE_ENV=production \
  -e LOG_LEVEL=debug \
  rv-lighting-control
```

## Volumes

### Persistent Data

Mount these directories for persistent data:

```bash
docker run -d \
  --name rv-lighting \
  -p 3000:3000 \
  -v rv-config:/app/config \
  -v rv-data:/app/data \
  rv-lighting-control
```

### Volume Structure

```
/app/config/          # Configuration files
├── settings.json     # Main configuration
└── backup/          # Config backups

/app/data/           # Application data
├── lighting_data.json  # Scenes and schedules
└── backups/         # Data backups
```

## Networking

### RV Network Access

Ensure the container can reach your RV control system:

```bash
# Use host networking (simplest)
docker run -d \
  --name rv-lighting \
  --network host \
  rv-lighting-control

# Or specify custom network
docker network create rv-network
docker run -d \
  --name rv-lighting \
  --network rv-network \
  -p 3000:3000 \
  rv-lighting-control
```

### Port Mapping

```bash
# Map to different host port
docker run -d \
  --name rv-lighting \
  -p 8080:3000 \    # Access via port 8080
  rv-lighting-control
```

## Production Deployment

### 1. Optimized Production Image

```dockerfile
# Multi-stage build for production
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine AS production
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001
USER nodejs

EXPOSE 3000
CMD ["node", "server.js"]
```

### 2. Production Docker Compose

```yaml
version: '3.8'

services:
  rv-lighting-control:
    build: 
      context: .
      target: production
    ports:
      - "3000:3000"
    volumes:
      - config:/app/config
      - data:/app/data
    environment:
      - NODE_ENV=production
      - LOG_LEVEL=warn
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/api/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1))"]
      interval: 30s
      timeout: 10s
      retries: 3
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '0.5'

  # Reverse proxy (optional)
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - rv-lighting-control

volumes:
  config:
  data:
```

### 3. Health Checks

The container includes health checks:

```bash
# Check container health
docker ps
# Look for "healthy" status

# Manual health check
docker exec rv-lighting curl -f http://localhost:3000/api/health
```

## Troubleshooting

### Common Issues

#### 1. Container Won't Start

```bash
# Check logs
docker logs rv-lighting

# Common causes:
# - Port already in use
# - Missing permissions on mounted volumes
# - Invalid configuration
```

#### 2. Can't Connect to RV Controller

```bash
# Test network connectivity
docker exec rv-lighting ping 192.168.1.100

# Check if running on host network
docker run --rm --network host rv-lighting-control ping 192.168.1.100
```

#### 3. Configuration Issues

```bash
# Access container shell
docker exec -it rv-lighting sh

# Check configuration
cat /app/config/settings.json

# Check permissions
ls -la /app/config/
```

#### 4. Performance Issues

```bash
# Check resource usage
docker stats rv-lighting

# Increase memory limit
docker run -d \
  --name rv-lighting \
  --memory=1g \
  --cpus=1 \
  rv-lighting-control
```

### Debug Mode

Run container in debug mode:

```bash
docker run -d \
  --name rv-lighting-debug \
  -p 3000:3000 \
  -e LOG_LEVEL=debug \
  -e NODE_ENV=development \
  rv-lighting-control

# Follow logs
docker logs -f rv-lighting-debug
```

### Container Management

```bash
# Start/Stop
docker start rv-lighting
docker stop rv-lighting

# Remove container
docker rm rv-lighting

# Remove image
docker rmi rv-lighting-control

# Clean up all
docker system prune -a
```

## Updates

### Update Application

```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Backup Before Update

```bash
# Backup data
docker run --rm \
  -v rv-data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/rv-lighting-backup.tar.gz -C /data .

# Restore if needed
docker run --rm \
  -v rv-data:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/rv-lighting-backup.tar.gz -C /data
```

## Security Considerations

### 1. Network Security

```bash
# Run on internal network only
docker network create --internal rv-internal
docker run --network rv-internal rv-lighting-control
```

### 2. File Permissions

```bash
# Set proper ownership
sudo chown -R 1001:1001 ./config ./data
sudo chmod 755 ./config ./data
```

### 3. Secrets Management

```bash
# Use Docker secrets for sensitive data
echo "your-api-key" | docker secret create rv-api-key -

# Use in compose
services:
  rv-lighting:
    secrets:
      - rv-api-key
```

## Monitoring

### Container Monitoring

```bash
# Resource usage
docker stats rv-lighting

# Health status
docker inspect rv-lighting | grep -A 5 Health

# Application logs
docker logs --tail 100 -f rv-lighting
```

### Application Monitoring

```bash
# Health endpoint
curl http://localhost:3000/api/health

# Application metrics (if enabled)
curl http://localhost:3000/api/metrics
```

---

For more information, see the main [README.md](../README.md) and [TROUBLESHOOTING.md](TROUBLESHOOTING.md).
# Infinite Bazaar Cron Service

This package provides BullMQ-based cron jobs for the Infinite Bazaar project.

## Features

- Health check cron job that calls `localhost:3105/health` every 10 seconds
- Redis-backed job queue using BullMQ
- Proper logging with Pino
- Graceful shutdown handling

## Prerequisites

- Redis server running (default: localhost:6379)
- Node.js >= 22.0.0
- Bun runtime

## Environment Variables

Create a `.env` file in the cron app directory with:

```env
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Health Check Configuration
HEALTH_CHECK_URL=http://localhost:3105/health

# Logging
LOG_LEVEL=info
```

## Installation

```bash
# Install dependencies
pnpm install

# Install Redis (if not already installed)
# On macOS:
brew install redis
# On Ubuntu:
sudo apt-get install redis-server
```

## Usage

### Development
```bash
pnpm run dev
```

### Production
```bash
pnpm run build
pnpm run start
```

### Testing
```bash
pnpm run test
```

## Architecture

The cron service uses:
- **BullMQ**: For job queue management and scheduling
- **Redis**: As the backing store for job queues
- **Pino**: For structured logging
- **Axios**: For HTTP health checks

## Jobs

### Health Check Job
- **Schedule**: Every 10 seconds
- **Purpose**: Monitors the API health endpoint
- **Endpoint**: Configurable via `HEALTH_CHECK_URL` (default: `http://localhost:3105/health`)
- **Retention**: Keeps last 10 completed jobs and 5 failed jobs

## Monitoring

The service logs all job executions, including:
- Job start/completion
- HTTP response status
- Error details for failed requests
- Redis connection status

## Graceful Shutdown

The service handles SIGTERM and SIGINT signals for graceful shutdown:
1. Closes BullMQ workers
2. Closes job queues
3. Disconnects from Redis
4. Exits cleanly 
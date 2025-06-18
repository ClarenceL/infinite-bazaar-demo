# Infinite Bazaar Cron2 Service

This is an alternative implementation of the cron service using [Agenda.js](https://github.com/agenda/agenda) instead of BullMQ. It provides the same functionality as the original `apps/cron` but uses MongoDB for job storage instead of Redis.

## Features

- **Job Scheduling**: Uses Agenda.js for reliable job scheduling with MongoDB persistence
- **Health Checks**: Performs periodic health checks on configured endpoints
- **Dashboard**: Provides Agendash web interface for job monitoring
- **Logging**: Structured logging with Pino
- **Graceful Shutdown**: Proper cleanup on process termination

## Key Differences from Original Cron Service

| Feature | Original (BullMQ) | Cron2 (Agenda.js) |
|---------|-------------------|-------------------|
| Storage | Redis | MongoDB |
| Dashboard | Bull Board | Agendash |
| Port | 3001 | 3002 |
| Queue Management | BullMQ Queues & Workers | Agenda Jobs |

## Environment Variables

- `MONGODB_URL`: MongoDB connection string (default: `mongodb://localhost:27017/infinite-bazaar-agenda`)
- `HEALTH_CHECK_URL`: URL to perform health checks against (default: `http://localhost:3105/health`)
- `CRON2_DASHBOARD_PORT`: Port for the dashboard server (default: `3002`)
- `LOG_LEVEL`: Logging level (default: `info`)
- `NODE_ENV`: Environment (required)

## Scripts

```bash
# Development with hot reload
pnpm dev

# Production start
pnpm start

# Build
pnpm build

# Run tests
pnpm test

# Type checking
pnpm type-check

# Linting
pnpm lint
pnpm lint:fix
```

## Dashboard Access

Once running, you can access:

- **Agendash UI**: http://localhost:3002/admin/queues
- **Health Check**: http://localhost:3002/health  
- **Job Stats**: http://localhost:3002/api/stats

## Job Configuration

The service automatically schedules a health check job that:
- Runs every 10 seconds
- Makes HTTP requests to the configured health check URL
- Logs success/failure results
- Does not retry on failure to avoid infinite loops

## MongoDB Setup

Ensure MongoDB is running and accessible at the configured URL. Agenda.js will automatically create the required collections and indexes.

## Comparison with BullMQ Version

This implementation demonstrates how the same functionality can be achieved with different job queue libraries:

- **Agenda.js**: More traditional, MongoDB-based, simpler setup
- **BullMQ**: Redis-based, more features, better performance for high-throughput scenarios

Both versions provide equivalent functionality for the Infinite Bazaar project's cron needs. 
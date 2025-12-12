# RowBooster Monitoring System

A comprehensive central monitoring system for tracking all user activities, API calls, token usage, costs, and errors across the RowBooster application.

## Features

✅ **Centralized Dashboard** - Single point of access for RBManager to monitor entire system
✅ **User Activity Tracking** - Detailed logs of all user actions
✅ **Token & Cost Monitoring** - Per-user API token usage and cost tracking
✅ **API Call Logging** - Complete request/response tracking
✅ **Error Management** - Centralized error logging and resolution tracking
✅ **User Statistics** - Aggregated metrics per user
✅ **Session Monitoring** - Track active and historical user sessions
✅ **Separate UI & Backend** - Isolated monitoring system running independently

## Architecture

The monitoring system consists of:

### Backend
- **Server**: Express server running on port 5001 (separate from main app)
- **Database**: Shares main PostgreSQL database with dedicated monitoring tables
- **Authentication**: Single RBManager user with secure access
- **API**: RESTful endpoints for all monitoring data

### Frontend
- **Dashboard**: React-based UI showing system overview
- **User Management**: View all users with detailed statistics
- **Activity Logs**: Real-time activity tracking
- **Error Logs**: Error management with resolution tracking

### Database Tables
- `rb_manager` - RBManager authentication
- `user_activity_logs` - All user activities
- `token_usage_logs` - Token usage per user
- `api_call_logs` - Detailed API call tracking
- `error_logs` - System and user errors
- `user_sessions` - Session tracking
- `user_statistics` - Aggregated user metrics
- `system_metrics` - System-wide performance metrics

## Installation

### 1. Install Dependencies

```bash
cd monitoring-system
npm install
```

### 2. Environment Setup

The monitoring system uses the same `.env` file as the main application. Ensure your `.env` file includes:

```env
DATABASE_URL=postgresql://username:password@localhost:5432/rowbooster
NODE_ENV=development
MONITORING_PORT=5001  # Optional, defaults to 5001
SESSION_SECRET=your-secret-key-here
```

### 3. Initialize Database

The database tables will be automatically created when you first run the monitoring system:

```bash
npm run dev
```

This will:
- Create all monitoring tables
- Set up required indexes
- Create the RBManager user with credentials:
  - **Username**: `RBManager`
  - **Password**: `SysObserve@24`

## Running the Monitoring System

### Development Mode

```bash
cd monitoring-system
npm run dev
```

The monitoring system will start on `http://localhost:5001`

### Production Mode

```bash
cd monitoring-system
npm run build
npm start
```

## Default Credentials

**Username**: `RBManager`  
**Password**: `SysObserve@24`

⚠️ **Important**: Change the default password in production!

## Port Management

The monitoring system automatically:
- Runs on port 5001 (or `MONITORING_PORT` from env)
- Kills any existing process on that port before starting
- Handles port conflicts gracefully

## Integration with Main Application

The monitoring system logs data from the main application through the `MonitoringLogger` service.

### Already Integrated
✅ Token usage tracking (via `tokenTracker.ts`)

### To Integrate

Add to your routes/middleware:

```typescript
import { MonitoringLogger } from './services/monitoringLogger';

// Log user activity
await MonitoringLogger.logActivity({
  userId: user.id,
  username: user.username,
  activityType: 'login',
  action: 'User logged in',
  ipAddress: req.ip,
  userAgent: req.get('user-agent'),
  success: true,
});

// Log API calls
await MonitoringLogger.logApiCall({
  userId: user.id,
  username: user.username,
  endpoint: req.path,
  method: req.method,
  statusCode: res.statusCode,
  duration: Date.now() - startTime,
  ipAddress: req.ip,
  userAgent: req.get('user-agent'),
});

// Log errors
await MonitoringLogger.logError({
  userId: user?.id,
  username: user?.username,
  errorType: 'runtime',
  errorMessage: error.message,
  errorStack: error.stack,
  endpoint: req.path,
  method: req.method,
  severity: 'error',
});

// Log sessions
await MonitoringLogger.logSession(
  user.id,
  user.username,
  sessionId,
  'login', // or 'logout'
  req.ip,
  req.get('user-agent')
);
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - RBManager login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Dashboard
- `GET /api/dashboard/stats` - Overall system statistics

### Users
- `GET /api/users` - List all users with statistics
- `GET /api/users/:userId` - Get user details
- `GET /api/users/:userId/activity` - User activity logs
- `GET /api/users/:userId/tokens` - User token usage
- `GET /api/users/:userId/api-calls` - User API calls
- `GET /api/users/:userId/errors` - User errors

### Logs
- `GET /api/activity` - All activity logs
- `GET /api/errors` - All error logs
- `PATCH /api/errors/:errorId/resolve` - Mark error as resolved
- `GET /api/metrics` - System metrics

## Dashboard Features

### Overview Dashboard
- Total users (active vs inactive)
- Total API calls
- Total cost across all users
- Error count
- Recent activity feed

### User Management
- View all users
- Per-user statistics (API calls, tokens, costs, errors)
- Click through to detailed user view

### User Details
- Individual user statistics
- Activity history
- Token usage breakdown
- API call logs
- Error logs

### Activity Logs
- Real-time activity tracking
- Filter by activity type
- User-specific filtering
- Success/failure indicators

### Error Logs
- All system errors
- Filter by severity (info, warning, error, critical)
- Filter by resolution status
- Mark errors as resolved
- Error details with stack traces

## Data Retention

All monitoring data is stored indefinitely. Consider implementing data retention policies:

```sql
-- Example: Delete old activity logs (older than 90 days)
DELETE FROM user_activity_logs WHERE timestamp < NOW() - INTERVAL '90 days';

-- Example: Delete old token logs (older than 1 year)
DELETE FROM token_usage_logs WHERE timestamp < NOW() - INTERVAL '1 year';
```

## Performance Considerations

- Database indexes are automatically created for optimal query performance
- Monitoring uses a separate connection pool (max 5 connections)
- Asynchronous logging to avoid blocking main application
- Failed logging attempts don't break main application functionality

## Security

- RBManager password should be changed from default in production
- Session-based authentication with secure cookies
- All monitoring data requires authentication
- Separate from main application authentication
- SQL injection protection via parameterized queries

## Troubleshooting

### Port Already in Use
The system automatically kills processes on port 5001. If issues persist:
```bash
# Windows
netstat -ano | findstr :5001
taskkill /F /PID <PID>

# Linux/Mac
lsof -ti:5001 | xargs kill -9
```

### Database Connection Issues
Ensure DATABASE_URL in .env matches your PostgreSQL setup:
```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/rowbooster
```

### RBManager Login Failed
Reset password by running SQL directly:
```sql
UPDATE rb_manager 
SET password = '$2a$10$...' -- Use bcrypt to hash 'SysObserve@24'
WHERE username = 'RBManager';
```

### No Data Showing
Ensure main application is integrated with MonitoringLogger:
1. Check token tracking is working
2. Add activity logging to auth routes
3. Add API call logging middleware
4. Add error logging to error handlers

## Development

### Structure
```
monitoring-system/
├── client/              # React frontend
│   ├── src/
│   │   ├── components/  # UI components
│   │   ├── pages/       # Page components
│   │   ├── lib/         # Utilities
│   │   └── hooks/       # React hooks
│   └── index.html
├── server/              # Express backend
│   ├── index.ts         # Server entry
│   ├── routes.ts        # API routes
│   ├── auth.ts          # Authentication
│   ├── db.ts            # Database connection
│   └── init-database.ts # DB initialization
├── shared/
│   └── schema.ts        # Shared types/schemas
└── package.json
```

### Adding New Features

1. **Add new log type**: Update `shared/schema.ts` and create migration
2. **Add new API endpoint**: Update `server/routes.ts`
3. **Add new UI page**: Create in `client/src/pages/`
4. **Add new statistics**: Update dashboard stats query

## Maintenance

### Backup Monitoring Data
```bash
pg_dump -U postgres -d rowbooster -t user_activity_logs -t token_usage_logs -t api_call_logs -t error_logs > monitoring_backup.sql
```

### Restore Monitoring Data
```bash
psql -U postgres -d rowbooster < monitoring_backup.sql
```

## License

Same as main RowBooster application

## Support

For issues or questions about the monitoring system, contact the development team.
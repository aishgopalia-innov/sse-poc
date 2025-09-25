/**
 * Logs SSE Gateway - Production Ready
 * Handles real-time log streaming across Datashop micro frontends
 */

const express = require('express');
const cors = require('cors');

class LogsSSEGateway {
    constructor() {
        this.app = express();
        this.connections = new Map(); // userId -> connection info
        this.logChannels = new Map();  // channel -> Set<userId>
        this.stats = {
            totalConnections: 0,
            logsPublished: 0,
            startTime: Date.now()
        };

        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        this.app.use(cors({
            origin: process.env.ALLOWED_ORIGINS?.split(',') || ['*'],
            credentials: true
        }));

        this.app.use(express.json());

        // Mock user authentication for POC
        this.app.use((req, res, next) => {
            req.user = {
                id: req.headers['x-user-id'] || 'user123',
                workspace_ids: ['workspace123', 'workspace456'],
                permissions: ['logs.read']
            };
            next();
        });
    }

    setupRoutes() {
        // Root endpoint
        this.app.get('/', (req, res) => {
            res.json({
                message: 'Logs SSE Gateway is running!',
                endpoints: {
                    health: '/health',
                    logs_stream: '/api/logs/stream',
                    logs_publish: '/api/logs/publish',
                    test_publish: '/test/logs',
                    admin_stats: '/admin/logs/stats'
                },
                deployment: 'production'
            });
        });

        // SSE endpoint for logs
        this.app.get('/api/logs/stream', (req, res) => {
            this.handleLogsSSE(req, res);
        });

        // Publish logs endpoint (for backend services)
        this.app.post('/api/logs/publish', (req, res) => {
            this.handleLogsPublish(req, res);
        });

        // Health check
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                connections: this.connections.size,
                channels: this.logChannels.size,
                stats: this.stats,
                uptime: Date.now() - this.stats.startTime
            });
        });

        // Admin stats
        this.app.get('/admin/logs/stats', (req, res) => {
            const channelStats = Array.from(this.logChannels.entries()).map(([channel, connectionIds]) => ({
                channel,
                subscriberCount: connectionIds.size,
                connections: Array.from(connectionIds).map(connId => {
                    const conn = this.connections.get(connId);
                    return {
                        connectionId: connId,
                        userId: conn?.userId || 'unknown',
                        connectedAt: conn?.connectedAt,
                        logsSent: conn?.logsSent || 0
                    };
                })
            }));
            res.json({
                totalConnections: this.connections.size,
                totalChannels: this.logChannels.size,
                channels: channelStats,
                stats: this.stats
            });
        });

        // Test endpoint for publishing sample logs
        this.app.post('/test/logs', (req, res) => {
            const { service = 'etl', workspace_id = 'workspace123', workflow_id = 'workflow456', logData } = req.body;

            const testLogData = logData || {
                date: new Date().toLocaleDateString('en-US', {
                    month: 'short', day: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit', hour12: true
                }).replace(',', ' at'),
                level: 'INFO',
                pipeline: 'ETL_PROCESSING',
                status: '1m 23s',
                message: `Test log message from gateway (${Date.now()})`,
                timestamp: new Date().toISOString()
            };

            const channel = `logs:${service}:${workspace_id}:${workflow_id}`;
            const delivered = this.broadcastLog(channel, testLogData);

            res.json({
                success: true,
                channel,
                delivered,
                logData: testLogData,
                timestamp: Date.now()
            });
        });
    }

    handleLogsSSE(req, res) {
        const userId = req.user.id;
        const connectionId = `${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const requestedChannels = req.query.channels ? req.query.channels.split(',') : [];

        // Filter channels user can access
        const allowedChannels = this.getUserLogChannels(req.user, requestedChannels);

        // Set SSE headers
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Cache-Control, Authorization, X-User-Id, X-Workspace-Id'
        });

        // Store connection
        const connectionData = {
            res,
            userId,
            connectionId,
            channels: allowedChannels,
            connectedAt: Date.now(),
            logsSent: 0
        };

        this.connections.set(connectionId, connectionData);
        this.stats.totalConnections++;

        // Subscribe to log channels
        allowedChannels.forEach(channel => {
            if (!this.logChannels.has(channel)) {
                this.logChannels.set(channel, new Set());
            }
            this.logChannels.get(channel).add(connectionId);
        });

        // Send connection confirmation
        res.write(`data: ${JSON.stringify({
            type: 'connection',
            status: 'connected',
            channels: allowedChannels,
            userId: userId,
            connectionId: connectionId,
            timestamp: Date.now()
        })}\n\n`);

        // Handle disconnect
        req.on('close', () => {
            this.removeConnection(connectionId);
        });

        // Heartbeat
        const heartbeat = setInterval(() => {
            if (this.connections.has(connectionId)) {
                res.write(':ping\n\n');
            } else {
                clearInterval(heartbeat);
            }
        }, 25000);

        console.log(`Logs SSE connected: ${connectionId} (user: ${userId}) -> ${allowedChannels.join(', ')}`);
    }

    handleLogsPublish(req, res) {
        const { service, workspace_id, workflow_id, function_id, logData } = req.body;

        // Validate service token
        const serviceToken = req.headers['x-service-token'];
        if (!this.validateLogPublisher(serviceToken, service)) {
            return res.status(403).json({ error: 'Unauthorized log publisher' });
        }

        // Build log channel
        let channel;
        if (function_id) {
            channel = `logs:function:${workspace_id}:${function_id}`;
        } else if (workflow_id) {
            channel = `logs:${service}:${workspace_id}:${workflow_id}`;
        } else {
            channel = `logs:${service}:${workspace_id}`;
        }

        // Broadcast log
        const delivered = this.broadcastLog(channel, logData);
        this.stats.logsPublished++;

        console.log(`Log published to channel ${channel}: delivered to ${delivered} subscribers`);

        res.json({
            success: true,
            channel,
            delivered,
            timestamp: Date.now()
        });
    }

    broadcastLog(channel, logData) {
        const subscribers = this.logChannels.get(channel) || new Set();
        let delivered = 0;

        subscribers.forEach(connectionId => {
            const connection = this.connections.get(connectionId);
            if (connection) {
                const logMessage = {
                    channel,
                    data: logData,
                    timestamp: Date.now(),
                    id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
                };

                try {
                    connection.res.write(`id: ${logMessage.id}\ndata: ${JSON.stringify(logMessage)}\n\n`);
                    connection.logsSent = (connection.logsSent || 0) + 1;
                    delivered++;
                } catch (error) {
                    console.error(`Failed to send log to ${connectionId}:`, error);
                    this.removeConnection(connectionId);
                }
            }
        });

        return delivered;
    }

    getUserLogChannels(user, requestedChannels) {
        // Simple permission check for logs
        const allowedChannels = [];

        requestedChannels.forEach(channel => {
            const [type, service, workspaceId, resourceId] = channel.split(':');

            if (type === 'logs' && user.workspace_ids.includes(workspaceId)) {
                allowedChannels.push(channel);
            }
        });

        return allowedChannels;
    }

    validateLogPublisher(token, service) {
        // Simple service validation for POC
        const validTokens = {
            'l5-etl-token': 'etl',
            'faas-token': 'faas',
            'function-token': 'function',
            'service-token': service
        };

        return validTokens[token] === service;
    }

    removeConnection(connectionId) {
        const connection = this.connections.get(connectionId);
        if (connection) {
            // Remove from all channels
            connection.channels.forEach(channel => {
                const channelSubscribers = this.logChannels.get(channel);
                if (channelSubscribers) {
                    channelSubscribers.delete(connectionId);
                    if (channelSubscribers.size === 0) {
                        this.logChannels.delete(channel);
                    }
                }
            });

            this.connections.delete(connectionId);
            console.log(`Logs SSE disconnected: ${connectionId} (user: ${connection.userId})`);
        }
    }

    start(port = 3002) {
        this.app.listen(port, '0.0.0.0', () => {
            const isProduction = process.env.NODE_ENV === 'production';
            const baseUrl = isProduction
                ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME || 'your-gateway.onrender.com'}`
                : `http://localhost:${port}`;

            console.log(`🚀 Logs SSE Gateway running on port ${port}`);
            console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`📊 Health: ${baseUrl}/health`);
            console.log(`🔧 Stats: ${baseUrl}/admin/logs/stats`);
            console.log(`🧪 Test: ${baseUrl}/test/logs`);
            console.log(`📡 SSE Stream: ${baseUrl}/api/logs/stream?channels=logs:etl:workspace123:workflow456`);
        });
    }
}

// Start the gateway
if (require.main === module) {
    const gateway = new LogsSSEGateway();
    gateway.start(process.env.PORT || 3002);
}

module.exports = LogsSSEGateway; 
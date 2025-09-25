/**
 * SSE Gateway Server - POC Implementation
 * Handles SSE connections for multiple Datashop micro frontends
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

class SSEGateway {
    constructor() {
        this.app = express();
        this.connections = new Map(); // userId -> { res, channels, metadata }
        this.channels = new Map();    // channel -> Set<userId>
        this.stats = {
            totalConnections: 0,
            messagesPublished: 0,
            startTime: Date.now()
        };

        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        // Security
        this.app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    connectSrc: ["'self'"]
                }
            }
        }));

        // CORS
        this.app.use(cors({
            origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
            credentials: true
        }));

        // Rate limiting
        const limiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100, // Limit each IP to 100 requests per windowMs
            message: 'Too many requests from this IP'
        });
        this.app.use('/api/sse', limiter);

        this.app.use(express.json());

        // Mock authentication middleware (replace with real Datashop auth)
        this.app.use((req, res, next) => {
            // Mock user for POC
            req.user = {
                id: req.headers['x-user-id'] || 'user123',
                workspace_ids: ['workspace123', 'workspace456'],
                permissions: ['logs.read', 'metrics.read', 'workflows.read']
            };
            next();
        });
    }

    setupRoutes() {
        // SSE connection endpoint
        this.app.get('/api/sse', (req, res) => {
            this.handleSSEConnection(req, res);
        });

        // Event publishing endpoint (for backend services)
        this.app.post('/api/sse/publish', (req, res) => {
            this.handleEventPublish(req, res);
        });

        // Health check
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                connections: this.connections.size,
                channels: this.channels.size,
                stats: this.stats,
                uptime: Date.now() - this.stats.startTime
            });
        });

        // Admin endpoints
        this.app.get('/admin/connections', (req, res) => {
            const connectionStats = Array.from(this.connections.entries()).map(([userId, conn]) => ({
                userId,
                channels: conn.channels,
                connectedAt: conn.connectedAt,
                messagesSent: conn.messagesSent || 0
            }));
            res.json(connectionStats);
        });

        this.app.get('/admin/channels', (req, res) => {
            const channelStats = Array.from(this.channels.entries()).map(([channel, users]) => ({
                channel,
                subscriberCount: users.size,
                subscribers: Array.from(users)
            }));
            res.json(channelStats);
        });

        // Test endpoint for publishing sample events
        this.app.post('/test/publish', (req, res) => {
            const { channel, data } = req.body;
            this.broadcastToChannel(channel, data);
            res.json({ success: true, channel, subscriberCount: this.getChannelSubscriberCount(channel) });
        });
    }

    handleSSEConnection(req, res) {
        const userId = req.user.id;
        const requestedChannels = req.query.channels ? req.query.channels.split(',') : [];

        // Validate user can access requested channels
        const allowedChannels = this.getUserAllowedChannels(req.user, requestedChannels);

        // Set SSE headers
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
            'Access-Control-Allow-Origin': req.headers.origin || '*'
        });

        // Register connection
        const connectionData = {
            res,
            channels: allowedChannels,
            connectedAt: Date.now(),
            messagesSent: 0
        };

        this.connections.set(userId, connectionData);
        this.stats.totalConnections++;

        // Subscribe to channels
        allowedChannels.forEach(channel => {
            if (!this.channels.has(channel)) {
                this.channels.set(channel, new Set());
            }
            this.channels.get(channel).add(userId);
        });

        // Send initial connection confirmation
        res.write(`data: ${JSON.stringify({
            type: 'connection',
            status: 'connected',
            channels: allowedChannels,
            timestamp: Date.now()
        })}\n\n`);

        // Handle client disconnect
        req.on('close', () => {
            this.removeConnection(userId);
        });

        // Send periodic heartbeat
        const heartbeat = setInterval(() => {
            if (this.connections.has(userId)) {
                res.write(':ping\n\n');
            } else {
                clearInterval(heartbeat);
            }
        }, 25000);

        console.log(`SSE connection established for user ${userId} with channels: ${allowedChannels.join(', ')}`);
    }

    handleEventPublish(req, res) {
        const { channel, data, filters = {} } = req.body;

        // Validate publishing service (basic validation for POC)
        const serviceToken = req.headers['x-service-token'];
        if (!this.validateServiceToken(serviceToken)) {
            return res.status(403).json({ error: 'Invalid service token' });
        }

        // Validate service can publish to this channel
        if (!this.validateChannelAccess(serviceToken, channel)) {
            return res.status(403).json({ error: 'Service not authorized for this channel' });
        }

        // Broadcast to channel
        const delivered = this.broadcastToChannel(channel, data, filters);
        this.stats.messagesPublished++;

        res.json({
            success: true,
            channel,
            delivered,
            timestamp: Date.now()
        });
    }

    broadcastToChannel(channel, data, filters = {}) {
        const subscribers = this.channels.get(channel) || new Set();
        let delivered = 0;

        subscribers.forEach(userId => {
            const connection = this.connections.get(userId);
            if (connection && this.userCanReceiveMessage(userId, data, filters)) {
                const message = {
                    channel,
                    data,
                    timestamp: Date.now(),
                    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
                };

                try {
                    connection.res.write(`id: ${message.id}\ndata: ${JSON.stringify(message)}\n\n`);
                    connection.messagesSent = (connection.messagesSent || 0) + 1;
                    delivered++;
                } catch (error) {
                    console.error(`Failed to send message to user ${userId}:`, error);
                    this.removeConnection(userId);
                }
            }
        });

        return delivered;
    }

    getUserAllowedChannels(user, requestedChannels) {
        // POC: Simple permission checking
        const allowedChannels = [];

        requestedChannels.forEach(channel => {
            if (this.validateUserChannelAccess(user, channel)) {
                allowedChannels.push(channel);
            }
        });

        return allowedChannels;
    }

    validateUserChannelAccess(user, channel) {
        // POC: Basic channel validation
        const [channelType, ...params] = channel.split(':');

        switch (channelType) {
            case 'logs':
                // logs:workspace_id:workflow_id
                const workspaceId = params[0];
                return user.workspace_ids.includes(workspaceId);

            case 'metrics':
                // metrics:workspace_id
                const metricsWorkspaceId = params[0];
                return user.workspace_ids.includes(metricsWorkspaceId);

            case 'workflows':
                // workflows:workspace_id
                const workflowWorkspaceId = params[0];
                return user.workspace_ids.includes(workflowWorkspaceId);

            case 'alerts':
                // alerts:user_id (users can only get their own alerts)
                const alertUserId = params[0];
                return alertUserId === user.id;

            default:
                return false;
        }
    }

    validateServiceToken(token) {
        // POC: Simple service token validation
        const validTokens = {
            'l5-etl-service-token': 'l5-etl-service',
            'faas-service-token': 'faas-service',
            'analytics-service-token': 'analytics-service'
        };

        return validTokens[token] || null;
    }

    validateChannelAccess(serviceToken, channel) {
        const serviceName = this.validateServiceToken(serviceToken);
        if (!serviceName) return false;

        // Define which services can publish to which channels
        const servicePermissions = {
            'l5-etl-service': ['logs:*', 'metrics:*'],
            'faas-service': ['workflows:*', 'functions:*'],
            'analytics-service': ['metrics:*', 'dashboards:*']
        };

        const permissions = servicePermissions[serviceName] || [];
        return permissions.some(pattern => this.matchesChannelPattern(channel, pattern));
    }

    matchesChannelPattern(channel, pattern) {
        if (pattern.endsWith('*')) {
            const prefix = pattern.slice(0, -1);
            return channel.startsWith(prefix);
        }
        return channel === pattern;
    }

    userCanReceiveMessage(userId, data, filters) {
        // POC: Basic message filtering
        // In production, implement complex ACL filtering here
        return true;
    }

    removeConnection(userId) {
        const connection = this.connections.get(userId);
        if (connection) {
            // Remove from all channels
            connection.channels.forEach(channel => {
                const channelSubscribers = this.channels.get(channel);
                if (channelSubscribers) {
                    channelSubscribers.delete(userId);
                    if (channelSubscribers.size === 0) {
                        this.channels.delete(channel);
                    }
                }
            });

            this.connections.delete(userId);
            console.log(`SSE connection removed for user ${userId}`);
        }
    }

    getChannelSubscriberCount(channel) {
        const subscribers = this.channels.get(channel);
        return subscribers ? subscribers.size : 0;
    }

    start(port = 3001) {
        this.app.listen(port, () => {
            console.log(`🚀 SSE Gateway running on port ${port}`);
            console.log(`📊 Health check: http://localhost:${port}/health`);
            console.log(`🔧 Admin panel: http://localhost:${port}/admin/connections`);
        });
    }
}

// Start the gateway
if (require.main === module) {
    const gateway = new SSEGateway();
    gateway.start(process.env.PORT || 3001);
}

module.exports = SSEGateway; 
/**
 * Example: Logs Component Integration with SSE Gateway
 * Shows how to use the SSE Gateway in a micro frontend
 */

import React, { useState, useEffect } from 'react';
import { useSSESubscription } from '../client/useSSESubscription';

const LogsComponent = ({ workspace_id, workflow_id, pipelineName = 'ETL' }) => {
    // Traditional API logs state
    const [apiLogs, setApiLogs] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    // SSE subscription for real-time logs
    const sseData = useSSESubscription([
        `logs:${workspace_id}:${workflow_id}`
    ], {
        accumulate: true,
        maxItems: 200,
        persistence: true,
        persistenceKey: `logs-${workspace_id}-${workflow_id}`,
        transform: (logData) => ({
            ...logData,
            source: 'sse',
            receivedAt: Date.now()
        })
    });

    // Combine API logs with SSE logs
    const allLogs = [...(sseData.data || []), ...apiLogs];

    // Fetch initial logs from API
    const fetchApiLogs = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/logs?workspace_id=${workspace_id}&workflow_id=${workflow_id}`);
            const data = await response.json();
            setApiLogs(data.logs || []);
        } catch (error) {
            console.error('Failed to fetch API logs:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Load initial data
    useEffect(() => {
        fetchApiLogs();
    }, [workspace_id, workflow_id]);

    return (
        <div className="logs-component">
            {/* SSE Status Bar */}
            <div className="sse-status-bar">
                <div className="status-info">
                    <span className={`status-indicator ${sseData.connectionStatus}`}>
                        {sseData.connectionStatus.toUpperCase()}
                    </span>
                    {sseData.isConnected && (
                        <span className="live-indicator">🔴 LIVE</span>
                    )}
                </div>

                <div className="stats">
                    <span>Total: {allLogs.length} logs</span>
                    <span>API: {apiLogs.length}</span>
                    <span>Live: {sseData.data.length}</span>
                </div>

                {sseData.error && (
                    <div className="error-message">
                        ⚠️ {sseData.error}
                    </div>
                )}
            </div>

            {/* Logs Table */}
            <div className="logs-table">
                <div className="table-header">
                    <div>Level</div>
                    <div>Pipeline</div>
                    <div>Message</div>
                    <div>Time</div>
                    <div>Source</div>
                </div>

                {isLoading ? (
                    <div className="loading">Loading logs...</div>
                ) : (
                    allLogs.map((log, index) => (
                        <div key={`${log.timestamp || Date.now()}-${index}`} className="table-row">
                            <div className={`log-level ${log.level?.toLowerCase()}`}>
                                {log.level}
                            </div>
                            <div>{log.pipeline}</div>
                            <div>{log.message}</div>
                            <div>{log.date}</div>
                            <div className={`source ${log.source || 'api'}`}>
                                {log.source === 'sse' ? '🔴 LIVE' : '📄 API'}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Controls */}
            <div className="controls">
                <button onClick={fetchApiLogs} disabled={isLoading}>
                    Refresh API Logs
                </button>
                <button onClick={sseData.clearData}>
                    Clear Live Logs
                </button>
                <button onClick={sseData.resetToPersisted}>
                    Reset to Saved
                </button>
            </div>

            {/* Debug Info */}
            <details className="debug-info">
                <summary>Debug Info</summary>
                <pre>{JSON.stringify({
                    sseStats: sseData.stats,
                    connectionStatus: sseData.connectionStatus,
                    channels: sseData.channels,
                    lastMessage: sseData.lastMessage
                }, null, 2)}</pre>
            </details>
        </div>
    );
};

// Example of HOC usage
import { withSSE } from '../client/withSSE';

const LogsComponentWithSSE = withSSE(LogsComponent, (props) => ({
    channels: [`logs:${props.workspace_id}:${props.workflow_id}`],
    options: {
        accumulate: true,
        maxItems: 200,
        persistence: true,
        persistenceKey: `logs-${props.workspace_id}-${props.workflow_id}`
    }
}));

// Example of multiple channel subscription
const WorkflowMonitorComponent = ({ workspace_id, workflow_id }) => {
    // Subscribe to multiple channels for comprehensive monitoring
    const logsData = useSSESubscription([`logs:${workspace_id}:${workflow_id}`], {
        accumulate: true,
        maxItems: 100
    });

    const metricsData = useSSESubscription([`metrics:${workspace_id}`], {
        accumulate: false, // Only keep latest metrics
        transform: (data) => ({
            ...data,
            formatted: `${data.cpu}% CPU, ${data.memory}% Memory`
        })
    });

    const workflowEvents = useSSESubscription([`workflows:${workspace_id}:${workflow_id}`], {
        accumulate: true,
        maxItems: 50,
        filter: (data) => data.event_type !== 'heartbeat' // Filter out heartbeat events
    });

    return (
        <div className="workflow-monitor">
            <div className="status-overview">
                <div>Connection: {logsData.connectionStatus}</div>
                <div>Logs: {logsData.data.length}</div>
                <div>Latest Metric: {metricsData.lastMessage?.data?.formatted}</div>
                <div>Workflow Events: {workflowEvents.data.length}</div>
            </div>

            <div className="panels">
                <div className="logs-panel">
                    <h3>Real-time Logs</h3>
                    {logsData.data.map(log => (
                        <div key={log.timestamp}>{log.message}</div>
                    ))}
                </div>

                <div className="metrics-panel">
                    <h3>Live Metrics</h3>
                    {metricsData.lastMessage && (
                        <div>{metricsData.lastMessage.data.formatted}</div>
                    )}
                </div>

                <div className="events-panel">
                    <h3>Workflow Events</h3>
                    {workflowEvents.data.map(event => (
                        <div key={event.timestamp}>{event.event_type}: {event.message}</div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export { LogsComponent, LogsComponentWithSSE, WorkflowMonitorComponent }; 
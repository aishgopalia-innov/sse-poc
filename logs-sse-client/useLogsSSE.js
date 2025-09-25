/**
 * React Hook for Logs SSE - Simplified for Logs Only
 * Easy integration for any micro frontend with logs
 */

import { useEffect, useState, useRef, useContext } from 'react';
import { LogsSSEContext } from './LogsSSEProvider';

export const useLogsSSE = (options = {}) => {
    const {
        service,           // 'etl', 'faas', 'function'
        workspace_id,
        workflow_id,       // Can be workflow_id or function_id
        maxLogs = 200,     // Maximum logs to keep
        persistence = false, // Save logs in localStorage
        persistenceKey = null, // Custom storage key
        filter = null      // Function to filter logs
    } = options;

    const { subscribe, connectionStatus, error } = useContext(LogsSSEContext);

    const [logs, setLogs] = useState(() => {
        if (persistence && persistenceKey) {
            try {
                const stored = localStorage.getItem(persistenceKey);
                return stored ? JSON.parse(stored) : [];
            } catch (e) {
                console.warn('Failed to load persisted logs:', e);
            }
        }
        return [];
    });

    const [lastLog, setLastLog] = useState(null);
    const [logCount, setLogCount] = useState(0);

    // Build channel name
    const channel = `logs:${service}:${workspace_id}:${workflow_id}`;

    // Persist logs when they change
    useEffect(() => {
        if (persistence && persistenceKey && logs.length > 0) {
            try {
                localStorage.setItem(persistenceKey, JSON.stringify(logs));
            } catch (e) {
                console.warn('Failed to persist logs:', e);
            }
        }
    }, [logs, persistence, persistenceKey]);

    // Subscribe to logs channel
    useEffect(() => {
        if (!service || !workspace_id || !workflow_id) {
            return;
        }

        const handleLogMessage = (logData, fullMessage) => {
            console.log(`Received log for ${service}:`, logData);

            // Apply filter if provided
            if (filter && !filter(logData, fullMessage)) {
                return;
            }

            setLastLog({ data: logData, timestamp: Date.now(), ...fullMessage });
            setLogCount(prev => prev + 1);

            // Add to logs array
            setLogs(prevLogs => {
                const newLogs = [logData, ...prevLogs];
                return newLogs.slice(0, maxLogs);
            });
        };

        // Subscribe to the logs channel
        const unsubscribe = subscribe([channel], handleLogMessage);

        return unsubscribe;
    }, [channel, subscribe, maxLogs, filter, service, workspace_id, workflow_id]);

    // Clear logs function
    const clearLogs = () => {
        setLogs([]);
        setLastLog(null);
        setLogCount(0);

        if (persistence && persistenceKey) {
            localStorage.removeItem(persistenceKey);
        }
    };

    // Reset to persisted logs
    const resetToPersisted = () => {
        if (persistence && persistenceKey) {
            try {
                const stored = localStorage.getItem(persistenceKey);
                if (stored) {
                    setLogs(JSON.parse(stored));
                }
            } catch (e) {
                console.warn('Failed to reset to persisted logs:', e);
            }
        }
    };

    return {
        // Log data
        logs,
        lastLog,
        logCount,

        // Connection state
        connectionStatus,
        isConnected: connectionStatus === 'connected',
        error,
        channel,

        // Actions
        clearLogs,
        resetToPersisted,

        // Metadata
        stats: {
            totalLogs: logCount,
            currentLogs: logs.length,
            service,
            workspace_id,
            workflow_id
        }
    };
};

export default useLogsSSE; 
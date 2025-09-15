import React, { useState, useEffect, useRef } from 'react'
import {
    Button,
    Text,
    Heading,
    Card,
    Row,
    Column,
    StatusHint,
    Icon,
    Tooltip,
    Toast
} from '@innovaccer/design-system'
import moment from 'moment'
import './LogStreamer.css'

const LogStreamer = () => {
    const [logs, setLogs] = useState([])
    const [groupedLogs, setGroupedLogs] = useState({})
    const [toasts, setToasts] = useState([])
    const [isConnected, setIsConnected] = useState(false)
    const [connectionStatus, setConnectionStatus] = useState('disconnected')
    const [error, setError] = useState(null)

    const eventSourceRef = useRef(null)
    const reconnectTimeoutRef = useRef(null)
    const reconnectAttempts = useRef(0)
    const toastIdCounter = useRef(0)
    const recentToasts = useRef(new Map()) // Track recent toasts to prevent duplicates

    // Get backend URL from environment variables
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'
    const maxReconnectAttempts = 5

    // Function to show toast notification with duplicate prevention
    const showToast = (execId, pipelineId, message, logLevel) => {
        const now = Date.now()
        const toastKey = `${execId}-${message.substring(0, 50)}` // Use execId + partial message as key

        // Check if we've shown a similar toast recently (within 2 seconds)
        if (recentToasts.current.has(toastKey)) {
            const lastToastTime = recentToasts.current.get(toastKey)
            if (now - lastToastTime < 2000) {
                console.log(`Preventing duplicate toast for execID: ${execId}`)
                return // Don't show duplicate toast
            }
        }

        // Record this toast
        recentToasts.current.set(toastKey, now)

        const toastId = `toast-${toastIdCounter.current++}`
        const appearance = getLogLevelAppearance(logLevel)

        const newToast = {
            id: toastId,
            title: `New event for Exec ID: ${execId}`,
            message: message.length > 80 ? `${message.substring(0, 80)}...` : message,
            appearance: appearance
        }

        setToasts(prev => [...prev, newToast])

        // Auto-remove toast after 5 seconds
        setTimeout(() => {
            setToasts(prev => prev.filter(toast => toast.id !== toastId))
        }, 5000)

        // Clean up old entries from recentToasts map (older than 10 seconds)
        setTimeout(() => {
            const cutoff = Date.now() - 10000
            for (const [key, timestamp] of recentToasts.current.entries()) {
                if (timestamp < cutoff) {
                    recentToasts.current.delete(key)
                }
            }
        }, 10000)
    }

    // Function to dismiss toast
    const dismissToast = (toastId) => {
        setToasts(prev => prev.filter(toast => toast.id !== toastId))
    }

    const formatTimestamp = (timestamp) => {
        return moment(timestamp).format('MMM DD, YYYY HH:mm:ss')
    }

    const getLogLevelAppearance = (logLevel) => {
        switch (logLevel) {
            case 'INFO': return 'success'
            case 'WARN': return 'warning'
            case 'ERROR': return 'alert'
            case 'DEBUG': return 'subtle'
            default: return 'subtle'
        }
    }

    const getConnectionStatusAppearance = () => {
        switch (connectionStatus) {
            case 'connected': return 'success'
            case 'connecting': return 'info'
            case 'error': return 'warning'
            case 'failed': return 'alert'
            default: return 'subtle'
        }
    }

    const getLogTypeIcon = (logType) => {
        switch (logType) {
            case 'THIRD_PARTY_LIBRARY': return 'extension'
            case 'APPLICATION': return 'apps'
            case 'SYSTEM': return 'settings'
            default: return 'event_note'
        }
    }

    const connectToSSE = () => {
        // Close existing connection if any
        if (eventSourceRef.current) {
            eventSourceRef.current.close()
        }

        setConnectionStatus('connecting')
        setError(null)

        try {
            // Create new EventSource connection
            const eventSource = new EventSource(`${backendUrl}/logs/stream`)
            eventSourceRef.current = eventSource

            // Handle successful connection
            eventSource.onopen = () => {
                console.log('SSE connection opened')
                setIsConnected(true)
                setConnectionStatus('connected')
                setError(null)
                reconnectAttempts.current = 0
            }

            // Handle incoming messages
            eventSource.onmessage = (event) => {
                try {
                    const logData = JSON.parse(event.data)
                    console.log('Received log:', logData)

                    setLogs(prevLogs => {
                        const newLogs = [logData, ...prevLogs]
                        // Keep only the last 100 logs to prevent memory issues
                        return newLogs.slice(0, 100)
                    })

                    // Update grouped logs by execID and handle notifications
                    const execId = logData.meta?.execID
                    if (execId) {
                        setGroupedLogs(prevGrouped => {
                            const newGrouped = { ...prevGrouped }
                            const wasExisting = newGrouped[execId] && newGrouped[execId].length > 0

                            if (!newGrouped[execId]) {
                                newGrouped[execId] = []
                            }

                            // Add new log to the beginning of the execID group
                            newGrouped[execId] = [logData, ...newGrouped[execId]].slice(0, 20) // Keep max 20 logs per execID

                            // Show toast notification for new events on existing execIDs
                            if (wasExisting) {
                                console.log(`New event for existing execID: ${execId}`)
                                showToast(
                                    execId,
                                    logData.meta?.pipelineID,
                                    logData.message,
                                    logData.logLevel
                                )
                            } else {
                                console.log(`First event for execID: ${execId}`)
                            }

                            return newGrouped
                        })
                    }

                } catch (parseError) {
                    console.error('Error parsing log data:', parseError)
                    setError('Error parsing log data')
                }
            }

            // Handle connection errors
            eventSource.onerror = (event) => {
                console.error('SSE connection error:', event)
                setIsConnected(false)
                setConnectionStatus('error')

                // Attempt to reconnect with exponential backoff
                if (reconnectAttempts.current < maxReconnectAttempts) {
                    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 10000)
                    setError(`Connection lost. Reconnecting in ${delay / 1000}s... (${reconnectAttempts.current + 1}/${maxReconnectAttempts})`)

                    reconnectTimeoutRef.current = setTimeout(() => {
                        reconnectAttempts.current++
                        connectToSSE()
                    }, delay)
                } else {
                    setError('Failed to connect after multiple attempts. Please check if the backend is running.')
                    setConnectionStatus('failed')
                }
            }

        } catch (error) {
            console.error('Error creating EventSource:', error)
            setError('Failed to create connection to backend')
            setConnectionStatus('failed')
        }
    }

    const disconnect = () => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close()
            eventSourceRef.current = null
        }

        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current)
            reconnectTimeoutRef.current = null
        }

        setIsConnected(false)
        setConnectionStatus('disconnected')
        setError(null)
        reconnectAttempts.current = 0
    }

    const clearLogs = () => {
        setLogs([])
        setGroupedLogs({})
        setToasts([])
        recentToasts.current.clear() // Clear duplicate prevention map
    }

    const testBackendHealth = async () => {
        try {
            const response = await fetch(`${backendUrl}/health`)
            if (response.ok) {
                const data = await response.json()
                console.log('Backend health check:', data)
                setError(null)
                return true
            } else {
                setError(`Backend health check failed: ${response.status}`)
                return false
            }
        } catch (error) {
            setError(`Backend not reachable: ${error.message}`)
            return false
        }
    }

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            disconnect()
        }
    }, [])

    return (
        <Card className="log-streamer-card">
            <div className="log-streamer-header">
                <Row>
                    <Column size="8">
                        <Heading size="s">Event Logs</Heading>
                        <div className="connection-info">
                            <StatusHint appearance={getConnectionStatusAppearance()}>
                                {connectionStatus.toUpperCase()}
                            </StatusHint>
                            <Text appearance="subtle" size="small" className="backend-url">
                                {backendUrl}
                            </Text>
                        </div>
                    </Column>
                    <Column size="4">
                        <div className="controls">
                            <Button
                                onClick={testBackendHealth}
                                appearance="basic"
                                size="regular"
                                disabled={connectionStatus === 'connecting'}
                                icon="network_check"
                            >
                                Test
                            </Button>

                            {isConnected ? (
                                <Button
                                    onClick={disconnect}
                                    appearance="alert"
                                    size="regular"
                                    icon="close"
                                >
                                    Disconnect
                                </Button>
                            ) : (
                                <Button
                                    onClick={connectToSSE}
                                    appearance="primary"
                                    size="regular"
                                    disabled={connectionStatus === 'connecting'}
                                    loading={connectionStatus === 'connecting'}
                                    icon="play_arrow"
                                >
                                    {connectionStatus === 'connecting' ? 'Connecting...' : 'Connect'}
                                </Button>
                            )}

                            <Button
                                onClick={clearLogs}
                                appearance="basic"
                                size="regular"
                                disabled={logs.length === 0}
                                icon="clear_all"
                            >
                                Clear ({logs.length})
                            </Button>
                        </div>
                    </Column>
                </Row>

                {error && (
                    <div className="error-message">
                        <StatusHint appearance="alert">
                            <Icon name="error" className="error-icon" />
                            {error}
                        </StatusHint>
                    </div>
                )}
            </div>

            <div className="logs-container">
                {logs.length === 0 ? (
                    <div className="empty-state">
                        <Icon name="event_note" size={48} appearance="subtle" />
                        <Heading size="s" appearance="subtle">No logs yet</Heading>
                        <Text appearance="subtle">
                            {isConnected
                                ? 'Waiting for logs from backend...'
                                : 'Click "Connect" to start streaming logs'
                            }
                        </Text>
                    </div>
                ) : (
                    <div className="enhanced-table">
                        <div className="table-header">
                            <div className="table-cell">
                                <Icon name="category" size={16} />
                                <Text weight="medium">Log Level</Text>
                            </div>
                            <div className="table-cell">
                                <Icon name="extension" size={16} />
                                <Text weight="medium">Log Type</Text>
                            </div>
                            <div className="table-cell">
                                <Icon name="fingerprint" size={16} />
                                <Text weight="medium">Exec ID</Text>
                            </div>
                            <div className="table-cell">
                                <Icon name="layers" size={16} />
                                <Text weight="medium">Stage</Text>
                            </div>
                            <div className="table-cell">
                                <Icon name="description" size={16} />
                                <Text weight="medium">Message</Text>
                            </div>
                            <div className="table-cell">
                                <Icon name="schedule" size={16} />
                                <Text weight="medium">Time</Text>
                            </div>
                        </div>
                        {logs.map((log, index) => (
                            <div key={`${log.meta?.execID}-${log.meta?.timestamp}-${index}`} className="table-row" data-log-level={log.logLevel}>
                                <div className="table-cell">
                                    <StatusHint appearance={getLogLevelAppearance(log.logLevel)}>
                                        {log.logLevel}
                                    </StatusHint>
                                </div>
                                <div className="table-cell">
                                    <Icon name={getLogTypeIcon(log.logType)} size={16} appearance="subtle" />
                                    <Text>{log.logType}</Text>
                                </div>
                                <div className="table-cell">
                                    <Tooltip tooltip={`Pipeline: ${log.meta?.pipelineID}`}>
                                        <Text weight="medium" className="exec-id-text">
                                            {log.meta?.execID}
                                        </Text>
                                    </Tooltip>
                                </div>
                                <div className="table-cell">
                                    <Text appearance="subtle">{log.stageName}</Text>
                                </div>
                                <div className="table-cell message-cell">
                                    <Tooltip tooltip={log.message}>
                                        <Text className="message-text">
                                            {log.message.length > 60 ? `${log.message.substring(0, 60)}...` : log.message}
                                        </Text>
                                    </Tooltip>
                                </div>
                                <div className="table-cell">
                                    <Text appearance="subtle" size="small">
                                        {log.time}
                                    </Text>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Toast notifications container */}
            <div className="toast-container">
                {toasts.map((toast) => (
                    <Toast
                        key={toast.id}
                        appearance={toast.appearance}
                        title={toast.title}
                        message={toast.message}
                        actions={toast.actions}
                        onClose={() => dismissToast(toast.id)}
                    />
                ))}
            </div>
        </Card>
    )
}

export default LogStreamer 
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
    Tooltip
} from '@innovaccer/design-system'
import moment from 'moment'
import './LogStreamer.css'

const LogStreamer = () => {
    const [logs, setLogs] = useState([])
    const [isConnected, setIsConnected] = useState(false)
    const [connectionStatus, setConnectionStatus] = useState('disconnected')
    const [error, setError] = useState(null)

    const eventSourceRef = useRef(null)
    const reconnectTimeoutRef = useRef(null)
    const reconnectAttempts = useRef(0)

    // Get backend URL from environment variables
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'
    const maxReconnectAttempts = 5

    const formatTimestamp = (timestamp) => {
        return moment(timestamp).format('MMM DD, YYYY HH:mm:ss')
    }

    const getStatusAppearance = (status) => {
        switch (status) {
            case 'FINISHED': return 'success'
            case 'RUNNING': return 'info'
            case 'PARTIALLY_COMPLETED': return 'warning'
            case 'FAILURE':
            case 'FAILED': return 'alert'
            case 'TERMINATED': return 'warning'
            case 'NOT_FOUND': return 'alert'
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

    const getEventTypeIcon = (eventType) => {
        switch (eventType) {
            case 'FUNCTION': return 'code'
            case 'METADATA': return 'info'
            case 'BATCH': return 'layers'
            case 'ERROR': return 'error'
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
                        // Keep only the last 50 logs to prevent memory issues
                        return newLogs.slice(0, 50)
                    })

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
                                <Text weight="medium">Type</Text>
                            </div>
                            <div className="table-cell">
                                <Icon name="extension" size={16} />
                                <Text weight="medium">Module</Text>
                            </div>
                            <div className="table-cell">
                                <Icon name="flag" size={16} />
                                <Text weight="medium">Status</Text>
                            </div>
                            <div className="table-cell">
                                <Icon name="fingerprint" size={16} />
                                <Text weight="medium">Event ID</Text>
                            </div>
                            <div className="table-cell">
                                <Icon name="schedule" size={16} />
                                <Text weight="medium">Created</Text>
                            </div>
                        </div>
                        {logs.map((log, index) => (
                            <div key={`${log.eventId}-${index}`} className="table-row" data-event-type={log.eventType}>
                                <div className="table-cell">
                                    <Icon name={getEventTypeIcon(log.eventType)} size={16} appearance="subtle" />
                                    <Text>{log.eventType}</Text>
                                </div>
                                <div className="table-cell">
                                    <Text weight="medium">{log.moduleName}</Text>
                                </div>
                                <div className="table-cell">
                                    <StatusHint appearance={getStatusAppearance(log.status)}>
                                        {log.status}
                                    </StatusHint>
                                </div>
                                <div className="table-cell">
                                    <Tooltip tooltip={log.eventId}>
                                        <Text appearance="subtle" className="event-id-text">
                                            {log.eventId.substring(0, 8)}...
                                        </Text>
                                    </Tooltip>
                                </div>
                                <div className="table-cell">
                                    <Text appearance="subtle" size="small">
                                        {formatTimestamp(log.createTime)}
                                    </Text>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </Card>
    )
}

export default LogStreamer 
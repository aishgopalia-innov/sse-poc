/**
 * Logs SSE Provider - Single connection for all log components
 * Manages SSE connection across all Datashop micro frontends
 */

import React, { createContext, useEffect, useState, useRef, useCallback } from 'react';

export const LogsSSEContext = createContext();

export const LogsSSEProvider = ({ children, gatewayUrl = '/api/logs/stream' }) => {
    const [connectionStatus, setConnectionStatus] = useState('disconnected');
    const [error, setError] = useState(null);
    const [connectedChannels, setConnectedChannels] = useState([]);

    const eventSourceRef = useRef(null);
    const subscribersRef = useRef(new Map()); // channel -> Set<callback>
    const reconnectTimeoutRef = useRef(null);
    const reconnectAttempts = useRef(0);
    const maxReconnectAttempts = 5;

    // Get all active log channels
    const getActiveChannels = useCallback(() => {
        return Array.from(subscribersRef.current.keys());
    }, []);

    // Connect to logs SSE gateway
    const connect = useCallback((forceReconnect = false) => {
        if (eventSourceRef.current && !forceReconnect) {
            return;
        }

        const channels = getActiveChannels();
        if (channels.length === 0) {
            return;
        }

        if (eventSourceRef.current) {
            eventSourceRef.current.close();
        }

        setConnectionStatus('connecting');
        setError(null);

        try {
            // Build URL with log channels
            const channelParams = channels.map(c => `channels=${encodeURIComponent(c)}`).join('&');
            const url = `${gatewayUrl}?${channelParams}`;

            console.log(`Connecting to Logs SSE Gateway: ${url}`);

            const eventSource = new EventSource(url);
            eventSourceRef.current = eventSource;

            eventSource.onopen = () => {
                console.log('Logs SSE Gateway connection opened');
                setConnectionStatus('connected');
                setConnectedChannels(channels);
                setError(null);
                reconnectAttempts.current = 0;
            };

            eventSource.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);

                    if (message.type === 'connection') {
                        console.log('Logs SSE connection confirmed:', message);
                        return;
                    }

                    // Route log message to subscribers
                    const { channel, data } = message;
                    const callbacks = subscribersRef.current.get(channel) || new Set();

                    console.log(`Routing log to ${callbacks.size} subscribers for channel: ${channel}`);

                    callbacks.forEach(callback => {
                        try {
                            callback(data, message);
                        } catch (error) {
                            console.error('Error in log callback:', error);
                        }
                    });

                } catch (error) {
                    console.error('Logs SSE message parsing error:', error);
                    setError('Failed to parse log message');
                }
            };

            eventSource.onerror = (event) => {
                console.error('Logs SSE connection error:', event);
                setConnectionStatus('error');

                // Auto-reconnect with exponential backoff
                if (reconnectAttempts.current < maxReconnectAttempts) {
                    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 10000);
                    setError(`Connection lost. Reconnecting in ${delay / 1000}s... (${reconnectAttempts.current + 1}/${maxReconnectAttempts})`);

                    reconnectTimeoutRef.current = setTimeout(() => {
                        reconnectAttempts.current++;
                        connect(true);
                    }, delay);
                } else {
                    setError('Failed to connect after multiple attempts. Please refresh the page.');
                    setConnectionStatus('failed');
                }
            };

        } catch (error) {
            console.error('Error creating Logs SSE connection:', error);
            setError('Failed to create logs SSE connection');
            setConnectionStatus('failed');
        }
    }, [gatewayUrl, getActiveChannels]);

    // Subscribe to log channels
    const subscribe = useCallback((channels, callback) => {
        console.log(`Subscribing to log channels: ${channels.join(', ')}`);

        // Add callback to each channel
        channels.forEach(channel => {
            if (!subscribersRef.current.has(channel)) {
                subscribersRef.current.set(channel, new Set());
            }
            subscribersRef.current.get(channel).add(callback);
        });

        // Connect or reconnect if channels changed
        const currentChannels = getActiveChannels();
        const needsReconnect = !eventSourceRef.current ||
            !channels.every(ch => connectedChannels.includes(ch));

        if (needsReconnect) {
            connect(true);
        }

        // Return unsubscribe function
        return () => {
            console.log(`Unsubscribing from log channels: ${channels.join(', ')}`);

            channels.forEach(channel => {
                const callbacks = subscribersRef.current.get(channel);
                if (callbacks) {
                    callbacks.delete(callback);
                    if (callbacks.size === 0) {
                        subscribersRef.current.delete(channel);
                    }
                }
            });

            // Reconnect with updated channels if needed
            const newChannels = getActiveChannels();
            if (newChannels.length === 0) {
                disconnect();
            } else if (newChannels.length !== currentChannels.length) {
                connect(true);
            }
        };
    }, [connect, connectedChannels, getActiveChannels]);

    // Disconnect from logs SSE
    const disconnect = useCallback(() => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
        }

        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }

        setConnectionStatus('disconnected');
        setConnectedChannels([]);
        setError(null);
        reconnectAttempts.current = 0;

        console.log('Logs SSE connection closed');
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            disconnect();
        };
    }, [disconnect]);

    const value = {
        // Connection state
        connectionStatus,
        connectedChannels,
        error,
        isConnected: connectionStatus === 'connected',

        // Functions
        subscribe,
        disconnect,

        // Stats
        stats: {
            channels: subscribersRef.current.size,
            reconnectAttempts: reconnectAttempts.current,
            connectedChannels: connectedChannels.length
        }
    };

    return (
        <LogsSSEContext.Provider value={value}>
            {children}
        </LogsSSEContext.Provider>
    );
};

export default LogsSSEProvider; 
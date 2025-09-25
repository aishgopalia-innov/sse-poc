/**
 * SSE Provider for Datashop Micro Frontends
 * Manages single SSE connection with multiple channel subscriptions
 */

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';

const SSEContext = createContext();

export const SSEProvider = ({ children, gatewayUrl = '/api/sse' }) => {
    const [connectionStatus, setConnectionStatus] = useState('disconnected');
    const [error, setError] = useState(null);
    const [connectedChannels, setConnectedChannels] = useState([]);

    const eventSourceRef = useRef(null);
    const subscribersRef = useRef(new Map()); // channel -> Set<callback>
    const reconnectTimeoutRef = useRef(null);
    const reconnectAttempts = useRef(0);
    const maxReconnectAttempts = 5;

    // Get all channels that have active subscribers
    const getActiveChannels = useCallback(() => {
        return Array.from(subscribersRef.current.keys());
    }, []);

    // Establish SSE connection with current channels
    const connect = useCallback((forceReconnect = false) => {
        if (eventSourceRef.current && !forceReconnect) {
            return; // Already connected
        }

        const channels = getActiveChannels();
        if (channels.length === 0) {
            return; // No channels to subscribe to
        }

        if (eventSourceRef.current) {
            eventSourceRef.current.close();
        }

        setConnectionStatus('connecting');
        setError(null);

        try {
            // Build URL with channels
            const channelParams = channels.map(c => `channels=${encodeURIComponent(c)}`).join('&');
            const url = `${gatewayUrl}?${channelParams}`;

            console.log(`Connecting to SSE Gateway: ${url}`);

            const eventSource = new EventSource(url);
            eventSourceRef.current = eventSource;

            eventSource.onopen = () => {
                console.log('SSE Gateway connection opened');
                setConnectionStatus('connected');
                setConnectedChannels(channels);
                setError(null);
                reconnectAttempts.current = 0;
            };

            eventSource.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);

                    if (message.type === 'connection') {
                        console.log('SSE Gateway connection confirmed:', message);
                        return;
                    }

                    // Route message to subscribed components
                    const { channel, data } = message;
                    const callbacks = subscribersRef.current.get(channel) || new Set();

                    console.log(`Received message for channel ${channel}, routing to ${callbacks.size} subscribers`);

                    callbacks.forEach(callback => {
                        try {
                            callback(data, message);
                        } catch (error) {
                            console.error('Error in SSE callback:', error);
                        }
                    });

                } catch (error) {
                    console.error('SSE message parsing error:', error);
                    setError('Failed to parse SSE message');
                }
            };

            eventSource.onerror = (event) => {
                console.error('SSE Gateway connection error:', event);
                setConnectionStatus('error');

                // Implement exponential backoff reconnection
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
            console.error('Error creating EventSource:', error);
            setError('Failed to create SSE connection');
            setConnectionStatus('failed');
        }
    }, [gatewayUrl, getActiveChannels]);

    // Subscribe component to specific channels
    const subscribe = useCallback((channels, callback) => {
        console.log(`Subscribing to channels: ${channels.join(', ')}`);

        // Add callback to each channel
        channels.forEach(channel => {
            if (!subscribersRef.current.has(channel)) {
                subscribersRef.current.set(channel, new Set());
            }
            subscribersRef.current.get(channel).add(callback);
        });

        // Connect if not already connected or if channels changed
        const currentChannels = getActiveChannels();
        const needsReconnect = !eventSourceRef.current ||
            !channels.every(ch => connectedChannels.includes(ch));

        if (needsReconnect) {
            connect(true);
        }

        // Return unsubscribe function
        return () => {
            console.log(`Unsubscribing from channels: ${channels.join(', ')}`);

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

    // Disconnect from SSE
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

        console.log('SSE Gateway connection closed');
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            disconnect();
        };
    }, [disconnect]);

    const value = {
        connectionStatus,
        connectedChannels,
        error,
        subscribe,
        disconnect,
        isConnected: connectionStatus === 'connected',
        stats: {
            channels: subscribersRef.current.size,
            reconnectAttempts: reconnectAttempts.current
        }
    };

    return (
        <SSEContext.Provider value={value}>
            {children}
        </SSEContext.Provider>
    );
};

export const useSSE = () => {
    const context = useContext(SSEContext);
    if (!context) {
        throw new Error('useSSE must be used within SSEProvider');
    }
    return context;
};

export default SSEProvider; 
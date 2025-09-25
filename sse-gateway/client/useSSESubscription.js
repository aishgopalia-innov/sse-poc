/**
 * React Hook for SSE Subscription
 * Easy integration for micro frontend components
 */

import { useEffect, useState, useRef } from 'react';
import { useSSE } from './SSEProvider';

export const useSSESubscription = (channels, options = {}) => {
    const {
        accumulate = true,        // Whether to accumulate messages or show only latest
        maxItems = 100,           // Maximum items to keep when accumulating
        transform = null,         // Function to transform incoming data
        filter = null,            // Function to filter incoming data
        persistence = false,      // Whether to persist data in localStorage
        persistenceKey = null     // Key for localStorage (auto-generated if not provided)
    } = options;

    const [data, setData] = useState(() => {
        if (persistence && persistenceKey) {
            try {
                const stored = localStorage.getItem(persistenceKey);
                return stored ? JSON.parse(stored) : [];
            } catch (e) {
                console.warn('Failed to load persisted SSE data:', e);
            }
        }
        return [];
    });

    const [lastMessage, setLastMessage] = useState(null);
    const [messageCount, setMessageCount] = useState(0);
    const { subscribe, connectionStatus, error } = useSSE();

    const channelsRef = useRef(channels);
    const unsubscribeRef = useRef(null);

    // Update channels reference when channels change
    useEffect(() => {
        channelsRef.current = channels;
    }, [channels.join(',')]);

    // Persist data to localStorage when it changes
    useEffect(() => {
        if (persistence && persistenceKey && data.length > 0) {
            try {
                localStorage.setItem(persistenceKey, JSON.stringify(data));
            } catch (e) {
                console.warn('Failed to persist SSE data:', e);
            }
        }
    }, [data, persistence, persistenceKey]);

    // Subscribe to channels
    useEffect(() => {
        const handleMessage = (messageData, fullMessage) => {
            console.log(`SSE Hook received message for channels ${channels.join(', ')}:`, messageData);

            // Apply filter if provided
            if (filter && !filter(messageData, fullMessage)) {
                return;
            }

            // Apply transform if provided
            const processedData = transform ? transform(messageData, fullMessage) : messageData;

            setLastMessage({ data: processedData, timestamp: Date.now(), ...fullMessage });
            setMessageCount(prev => prev + 1);

            if (accumulate) {
                setData(prevData => {
                    const newData = [processedData, ...prevData];
                    return newData.slice(0, maxItems);
                });
            } else {
                setData([processedData]);
            }
        };

        // Subscribe to channels
        unsubscribeRef.current = subscribe(channels, handleMessage);

        // Cleanup on unmount or channel change
        return () => {
            if (unsubscribeRef.current) {
                unsubscribeRef.current();
            }
        };
    }, [channels.join(','), subscribe, accumulate, maxItems, transform, filter]);

    // Clear data function
    const clearData = () => {
        setData([]);
        setLastMessage(null);
        setMessageCount(0);

        if (persistence && persistenceKey) {
            localStorage.removeItem(persistenceKey);
        }
    };

    // Reset to persisted data
    const resetToPersisted = () => {
        if (persistence && persistenceKey) {
            try {
                const stored = localStorage.getItem(persistenceKey);
                if (stored) {
                    setData(JSON.parse(stored));
                }
            } catch (e) {
                console.warn('Failed to reset to persisted data:', e);
            }
        }
    };

    return {
        // Data
        data,
        lastMessage,
        messageCount,

        // Connection state
        connectionStatus,
        isConnected: connectionStatus === 'connected',
        error,
        channels,

        // Actions
        clearData,
        resetToPersisted,

        // Metadata
        stats: {
            totalMessages: messageCount,
            dataSize: data.length,
            channels: channels.length
        }
    };
};

export default useSSESubscription; 
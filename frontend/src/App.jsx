import React from 'react'
import { Card, Heading, Text } from '@innovaccer/design-system'
import LogStreamer from './components/LogStreamer'
import './App.css'

function App() {
    return (
        <div className="app">
            <div className="app-header">
                <Heading size="xxl">Real-Time Log Streaming</Heading>
                <Text appearance="subtle" className="app-subtitle">
                    Streaming logs from FastAPI backend using Server-Sent Events
                </Text>
            </div>

            <main className="app-main">
                <Card className="main-card">
                    <LogStreamer />
                </Card>
            </main>

            <footer className="app-footer">
                <Text size="small" appearance="subtle">
                    Built with FastAPI + React + Innovaccer Design System
                </Text>
            </footer>
        </div>
    )
}

export default App 
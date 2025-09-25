/**
 * Gateway Log Publisher
 * Publishes logs to the Logs SSE Gateway for testing
 */

const http = require('http');
const https = require('https');

// Support both local and deployed gateway
const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3002';

// Sample ETL log data for testing
const generateETLLog = (index) => {
    const levels = ['INFO', 'ERROR', 'WARN', 'DEBUG'];
    const messages = [
        'ETL pipeline started successfully',
        'Data extraction from source completed',
        'Transformation rules applied to batch',
        'Data validation completed with no errors',
        'Loading data to target database',
        'ETL workflow execution finished',
        'Processing batch records',
        'Database connection established',
        'Data quality checks passed',
        'Report generation completed'
    ];

    const pipelines = ['ETL_PROCESSING', 'DATA_VALIDATION', 'REPORTING', 'PLATFORM_INTERNAL'];
    const statuses = ['45 sec', '1m 23s', '2m 15s', '3m 42s', '4m 18s'];

    const now = new Date();

    return {
        date: now.toLocaleDateString('en-US', {
            month: 'short',
            day: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        }).replace(',', ' at'),
        level: levels[Math.floor(Math.random() * levels.length)],
        pipeline: pipelines[Math.floor(Math.random() * pipelines.length)],
        status: statuses[Math.floor(Math.random() * statuses.length)],
        message: `${messages[Math.floor(Math.random() * messages.length)]} (Log #${index + 1})`,
        timestamp: now.toISOString()
    };
};

// Publish log to SSE Gateway
const publishLogToGateway = (workspaceId, workflowId, logData) => {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            service: 'etl',
            workspace_id: workspaceId,
            workflow_id: workflowId,
            logData: logData
        });

        const url = new URL(GATEWAY_URL);
        const isHttps = url.protocol === 'https:';

        const options = {
            hostname: url.hostname,
            port: url.port || (isHttps ? 443 : 80),
            path: '/api/logs/publish',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Service-Token': 'l5-etl-token',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const requestModule = isHttps ? https : http;
        const req = requestModule.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    resolve(response);
                } catch (e) {
                    resolve({ success: true, rawResponse: data });
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.write(postData);
        req.end();
    });
};

// Test publishing logs to gateway
async function testGatewayLogPublishing() {
    console.log('🚀 Starting Gateway Log Publisher Test');
    console.log(`📡 Publishing to: ${GATEWAY_URL}`);
    console.log('📋 Channel: logs:etl:workspace123:workflow456\n');

    const workspaceId = 'workspace123';
    const workflowId = 'workflow456';

    // Publish 10 test logs with intervals
    for (let i = 0; i < 10; i++) {
        try {
            const logData = generateETLLog(i);
            console.log(`📝 Publishing log ${i + 1}:`, logData.message);

            const result = await publishLogToGateway(workspaceId, workflowId, logData);
            console.log(`✅ Published successfully:`, {
                success: result.success,
                delivered: result.delivered,
                channel: result.channel
            });

            // Wait 3 seconds between logs
            await new Promise(resolve => setTimeout(resolve, 3000));

        } catch (error) {
            console.error(`❌ Failed to publish log ${i + 1}:`, error.message);
        }
    }

    console.log('\n🎉 Gateway log publishing test completed!');
    console.log('💡 Check the datashop-indata Logs page to see real-time updates via the gateway');
}

// Continuous publishing mode
async function continuousPublishing(intervalSeconds = 5) {
    console.log(`🔄 Starting continuous log publishing (every ${intervalSeconds}s)`);
    console.log('Press Ctrl+C to stop\n');

    const workspaceId = 'workspace123';
    const workflowId = 'workflow456';
    let logIndex = 1;

    const publishLoop = async () => {
        try {
            const logData = generateETLLog(logIndex - 1);
            console.log(`📝 [${new Date().toISOString()}] Publishing log ${logIndex}:`, logData.message);

            const result = await publishLogToGateway(workspaceId, workflowId, logData);
            console.log(`✅ Delivered to ${result.delivered} subscribers`);

            logIndex++;
        } catch (error) {
            console.error(`❌ Failed to publish log ${logIndex}:`, error.message);
        }
    };

    // Initial publish
    await publishLoop();

    // Set up interval
    const interval = setInterval(publishLoop, intervalSeconds * 1000);

    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n🛑 Stopping continuous publishing...');
        clearInterval(interval);
        process.exit(0);
    });
}

// Command line interface
const args = process.argv.slice(2);
const mode = args[0] || 'test';

if (mode === 'continuous') {
    const interval = parseInt(args[1]) || 5;
    continuousPublishing(interval);
} else {
    testGatewayLogPublishing().catch(console.error);
}

module.exports = { publishLogToGateway, generateETLLog }; 
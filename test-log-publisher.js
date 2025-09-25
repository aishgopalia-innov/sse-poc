/**
 * Test Log Publisher
 * Simulates L5-ETL service publishing logs to the SSE Gateway
 */

const https = require('https');

const SSE_BACKEND_URL = 'https://sse-poc-golj.onrender.com';

// Sample ETL log data
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
        timestamp: now.toISOString(),
        isoTime: now.toISOString(),
        logLevel: levels[Math.floor(Math.random() * levels.length)],
        logType: 'ETL_LOG',
        stageName: pipelines[Math.floor(Math.random() * pipelines.length)],
        time: now.toLocaleTimeString(),
        meta: {
            execID: `exec_${Date.now()}`,
            pipelineID: 'pipeline_123',
            timestamp: Date.now()
        }
    };
};

// Publish log to SSE backend
const publishLog = (workspaceId, workflowId, logData) => {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            service: 'etl',
            workspace_id: workspaceId,
            workflow_id: workflowId,
            logData: logData
        });

        const options = {
            hostname: 'sse-poc-golj.onrender.com',
            port: 443,
            path: '/logs/stream', // This should match your deployed backend endpoint
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Service-Token': 'l5-etl-token',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = https.request(options, (res) => {
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

// Test publishing logs
async function testLogPublishing() {
    console.log('🚀 Starting Log Publisher Test');
    console.log(`📡 Publishing to: ${SSE_BACKEND_URL}`);
    console.log('📋 Channel: logs:etl:workspace123:workflow456\n');

    const workspaceId = 'workspace123';
    const workflowId = 'workflow456';

    // Publish 5 test logs
    for (let i = 0; i < 5; i++) {
        try {
            const logData = generateETLLog(i);
            console.log(`📝 Publishing log ${i + 1}:`, logData.message);

            const result = await publishLog(workspaceId, workflowId, logData);
            console.log(`✅ Published successfully:`, result);

            // Wait 2 seconds between logs
            await new Promise(resolve => setTimeout(resolve, 2000));

        } catch (error) {
            console.error(`❌ Failed to publish log ${i + 1}:`, error.message);
        }
    }

    console.log('\n🎉 Log publishing test completed!');
    console.log('💡 Now check the datashop-indata Logs page to see real-time updates');
}

// Run the test
if (require.main === module) {
    testLogPublishing().catch(console.error);
}

module.exports = { publishLog, generateETLLog }; 
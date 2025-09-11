"""
FastAPI backend for real-time log streaming using Server-Sent Events (SSE).

This application provides:
- SSE endpoint for streaming logs every 5 seconds
- Health check endpoint
- CORS support for frontend integration
"""

import asyncio
import json
import time
import random
import os
from datetime import datetime
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse


# Initialize FastAPI app
app = FastAPI(
    title="Log Streaming API",
    description="Real-time log streaming using Server-Sent Events",
    version="1.0.0"
)

# Configure CORS - Allow all origins for deployment
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for deployment
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Sample data for realistic log generation
MODULE_NAMES = [
    "py-quality", "py-measure-definition", "py-data-processor", 
    "py-analytics", "py-validator", "py-transformer"
]

EVENT_TYPES = ["FUNCTION", "METADATA", "BATCH"]

STATUSES = [
    "FINISHED", "RUNNING", "PARTIALLY_COMPLETED", "FAILURE", 
    "TERMINATED", "NOT_FOUND", "FAILED"
]

CONFIG_IDS = [
    "loadtest_nonkeda_10k", "production_batch_5k", "dev_test_1k",
    "staging_validation", "performance_test"
]

def generate_event_details(event_type, status, module_name):
    """Generate realistic event details based on type and status"""
    base_time = datetime.utcnow().isoformat() + "Z"
    
    if event_type == "FUNCTION":
        return {
            "deploymentId": f"{random.randint(100000, 999999)}-{random.randint(1000, 9999)}-{random.randint(1000, 9999)}-{random.randint(1000, 9999)}-{random.randint(100000000000, 999999999999)}",
            "name": module_name,
            "version": f"{random.randint(1, 5)}.{random.randint(0, 10)}.{random.randint(0, 100)}-feature.{random.randint(1, 100)}",
            "minReplicas": 1,
            "maxReplicas": random.choice([1000, 2000, 3000]),
            "stateFlow": ["PENDING", "RUNNING"] if status == "RUNNING" else ["PENDING", "RUNNING", "FINISHED"],
            "targetCPUPercent": f"{random.randint(5, 20)}.0 %",
            "limits": {"cpu": f"{random.randint(1000, 4000)}m", "memory": f"{random.randint(2, 8)}G"},
            "requests": {"cpu": f"{random.randint(1000, 4000)}m", "memory": f"{random.randint(2, 8)}G"},
            "environment": [{"key": "POD_MEMORY_LIMIT", "value": str(random.randint(2048, 8192))}],
            "faasApiFunctionDeploymentFlag": False,
            "inDBFunctionDeploymentFlag": True
        }
    
    elif event_type == "METADATA":
        return {
            "name": module_name,
            "version": f"{random.randint(1, 5)}.{random.randint(0, 10)}.{random.randint(0, 100)}-feature.{random.randint(1, 100)}",
            "stateFlow": ["PENDING", "EXECUTING", "RUNNING", "DUMP_TO_SF"],
            "environment": [{"key": "DEBUG", "value": "true"}]
        }
    
    elif event_type == "BATCH":
        execution_id = f"{random.randint(10000000, 99999999)}-{random.randint(1000, 9999)}-{random.randint(1000, 9999)}-{random.randint(1000, 9999)}-{random.randint(100000000000, 999999999999)}"
        invocation_count = random.randint(1000, 10000) if status not in ["FAILURE", "TERMINATED"] else 0
        success_count = random.randint(int(invocation_count * 0.8), invocation_count) if invocation_count > 0 else 0
        failure_count = invocation_count - success_count if invocation_count > 0 else 0
        
        return {
            "executionId": execution_id,
            "status": status,
            "info": "Publishing payload to nats" if status in ["QUEUED", "EXECUTING"] else None,
            "configId": random.choice(CONFIG_IDS),
            "userQuery": f"SELECT DISTINCT record_content:data[0]:empi AS empi FROM l3.output_status WHERE execution_id = '{execution_id}' LIMIT {invocation_count}",
            "invocationCount": invocation_count,
            "stateFlow": ["SUBMITTED", "ENQUEUEING", "QUEUED", "EXECUTING"] if status == "RUNNING" else ["SUBMITTED", "ENQUEUEING", "QUEUED", "EXECUTING", status],
            "failure": failure_count,
            "success": success_count,
            "writeOutputToDb": random.randint(0, 500),
            "totalCPU": f"{random.uniform(0, 10):.1f} Cores",
            "totalMemory": f"{random.uniform(0, 50):.1f} GB",
            "totalPods": random.randint(0, 20),
            "startTime": base_time,
            "endTime": base_time,
            "totalTimeRunInSeconds": f"{random.uniform(1, 180):.2f} minutes",
            "isBulkExecution": False
        }


@app.get("/")
async def root():
    """Welcome endpoint."""
    return {
        "message": "Log Streaming API is running!",
        "endpoints": {
            "health": "/health",
            "logs_stream": "/logs/stream"
        },
        "deployment": "production" if os.getenv("PORT") else "development"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint to verify the backend is running."""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "log-streaming-backend",
        "port": os.getenv("PORT", "8000")
    }


async def generate_logs() -> AsyncGenerator[str, None]:
    """
    Generate log messages every 5 seconds in SSE format.
    
    Yields:
        str: SSE-formatted log messages
    """
    log_counter = 1
    
    while True:
        try:
            # Create log message with realistic data
            module_name = random.choice(MODULE_NAMES)
            event_type = random.choice(EVENT_TYPES)
            status = random.choice(STATUSES)
            
            # Generate event ID
            event_id = f"{random.randint(10000000, 99999999)}-{random.randint(1000, 9999)}-{random.randint(1000, 9999)}-{random.randint(1000, 9999)}-{random.randint(100000000000, 999999999999)}"
            
            # Generate event details
            event_details = generate_event_details(event_type, status, module_name)
            
            log_data = {
                "eventId": event_id,
                "moduleName": module_name,
                "eventType": event_type,
                "status": status,
                "eventDetails": json.dumps(event_details),
                "createTime": int(time.time() * 1000),  # Milliseconds since epoch
                "userDetails": {}
            }
            
            # Format as SSE message
            # SSE format: data: <json_data>\n\n
            sse_message = f"data: {json.dumps(log_data)}\n\n"
            
            yield sse_message
            
            log_counter += 1
            
            # Wait 5 seconds before generating the next log
            await asyncio.sleep(5)
            
        except Exception as e:
            # Send error message if something goes wrong
            error_data = {
                "eventId": f"error-{log_counter}",
                "moduleName": "system",
                "eventType": "ERROR",
                "status": "FAILED",
                "eventDetails": json.dumps({"error": str(e)}),
                "createTime": int(time.time() * 1000),
                "userDetails": {}
            }
            
            error_message = f"data: {json.dumps(error_data)}\n\n"
            yield error_message
            
            # Continue after error
            await asyncio.sleep(5)


@app.get("/logs/stream")
async def stream_logs():
    """
    SSE endpoint that streams logs every 5 seconds.
    
    Returns:
        StreamingResponse: Server-Sent Events stream of log messages
    """
    return StreamingResponse(
        generate_logs(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Cache-Control"
        }
    )


if __name__ == "__main__":
    import uvicorn
    
    # Use PORT environment variable if available (for cloud deployment)
    port = int(os.getenv("PORT", 8000))
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=True,
        log_level="info"
    ) 
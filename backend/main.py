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
LOG_MESSAGES = [
    "job update response status: FAILURE, response: <Response [200]>",
    "job update response status: SUCCESS, response: <Response [200]>",
    "Publish report status: True, response: Report has been published for pipeline :: {pipeline_id}",
    "Error -> Error  : ETL Error  : ETL stopped due to PRE-CHECK error: Error in DQF Pre-Check check: DQF Pre-Check returned empty status",
    "Executing from the start as changes found in the code",
    "{step}. Running ETL for snowflake",
    "connect to database - snowflake",
    "L5 tag version:{tag} is running",
    "ETL Running",
    "Starting L5 DAP",
    "JSON data is valid",
    "Total time for L5 execution = {duration} seconds",
    "L5 execution ended",
    "L5 (standard) data population ended"
]

LOG_LEVELS = ["INFO", "ERROR", "WARN", "DEBUG"]
LOG_TYPES = ["THIRD_PARTY_LIBRARY", "APPLICATION", "SYSTEM"]
STAGE_NAMES = ["PLATFORM_INTERNAL", "ETL_PROCESSING", "DATA_VALIDATION", "REPORTING"]

# Pipeline IDs for realistic data
PIPELINE_IDS = [
    "70ae99a3-9260-4435-b13a-1f3abfc2a77f",
    "85bc12d4-a371-4546-c24b-2g4bcgd3b88g", 
    "92cd23e5-b482-5657-d35c-3h5cdhe4c99h",
    "a7de34f6-c593-6768-e46d-4i6deif5da0i"
]

EXEC_IDS = ["3920", "3953", "4021", "4087", "4156"]

def generate_log_entry():
    """Generate a realistic log entry in the new format"""
    now = datetime.utcnow()
    iso_time = now.isoformat() + "000"  # Add milliseconds
    timestamp = int(now.timestamp() * 1000)  # Milliseconds since epoch
    
    # Format time as "Sep 11 2025 at 03:10 PM"
    formatted_time = now.strftime("%b %d %Y at %I:%M %p")
    
    # Select random data
    exec_id = random.choice(EXEC_IDS)
    pipeline_id = random.choice(PIPELINE_IDS)
    log_level = random.choice(LOG_LEVELS)
    log_type = random.choice(LOG_TYPES)
    stage_name = random.choice(STAGE_NAMES)
    
    # Select and format message
    message_template = random.choice(LOG_MESSAGES)
    
    # Format message with dynamic values
    if "{pipeline_id}" in message_template:
        message = message_template.format(pipeline_id=pipeline_id)
    elif "{step}" in message_template:
        message = message_template.format(step=random.randint(1, 10))
    elif "{tag}" in message_template:
        message = message_template.format(tag=f"v{random.randint(1, 5)}.{random.randint(0, 10)}")
    elif "{duration}" in message_template:
        message = message_template.format(duration=round(random.uniform(100, 3000), 2))
    else:
        message = message_template
    
    return {
        "description": message,
        "duration": "0 sec",
        "isoTime": iso_time,
        "logLevel": log_level,
        "logType": log_type,
        "message": message,
        "meta": {
            "execID": exec_id,
            "pipelineID": pipeline_id,
            "timestamp": timestamp
        },
        "stageName": stage_name,
        "time": formatted_time
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
            # Generate log entry in new format
            log_entry = generate_log_entry()
            
            # Format as SSE message
            # SSE format: data: <json_data>\n\n
            sse_message = f"data: {json.dumps(log_entry)}\n\n"
            
            yield sse_message
            
            log_counter += 1
            
            # Wait 5 seconds before generating the next log
            await asyncio.sleep(5)
            
        except Exception as e:
            # Send error message if something goes wrong
            error_data = {
                "description": f"System error: {str(e)}",
                "duration": "0 sec",
                "isoTime": datetime.utcnow().isoformat() + "000",
                "logLevel": "ERROR",
                "logType": "SYSTEM",
                "message": f"System error: {str(e)}",
                "meta": {
                    "execID": "error",
                    "pipelineID": "system",
                    "timestamp": int(time.time() * 1000)
                },
                "stageName": "SYSTEM",
                "time": datetime.utcnow().strftime("%b %d %Y at %I:%M %p")
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
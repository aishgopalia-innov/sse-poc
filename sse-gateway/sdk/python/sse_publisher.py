"""
SSE Publisher SDK for Python Services
Easy integration for Flask/Django services to publish events
"""

import requests
import json
import time
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

class SSEPublisher:
    def __init__(self, gateway_url: str, service_token: str, service_name: str):
        """
        Initialize SSE Publisher
        
        Args:
            gateway_url: URL of the SSE Gateway (e.g., 'http://localhost:3001')
            service_token: Authentication token for this service
            service_name: Name of the service (for logging and permissions)
        """
        self.gateway_url = gateway_url.rstrip('/')
        self.service_token = service_token
        self.service_name = service_name
        self.session = requests.Session()
        
        # Set default headers
        self.session.headers.update({
            'X-Service-Token': service_token,
            'Content-Type': 'application/json',
            'User-Agent': f'SSE-Publisher/{service_name}'
        })
        
        # Connection settings
        self.session.timeout = 5
        self.retry_attempts = 3
        
    def publish(self, channel: str, data: Dict[Any, Any], filters: Optional[Dict] = None) -> Dict:
        """
        Publish event to SSE channel
        
        Args:
            channel: Channel name (e.g., 'logs:workspace123:workflow456')
            data: Event data to publish
            filters: Optional filters for message targeting
            
        Returns:
            Dict with success status and delivery info
        """
        payload = {
            'channel': channel,
            'data': data,
            'filters': filters or {},
            'timestamp': int(time.time() * 1000),
            'service': self.service_name
        }
        
        url = f'{self.gateway_url}/api/sse/publish'
        
        for attempt in range(self.retry_attempts):
            try:
                response = self.session.post(url, json=payload)
                
                if response.status_code == 200:
                    result = response.json()
                    logger.debug(f'SSE event published successfully: {channel} -> {result.get("delivered", 0)} subscribers')
                    return result
                else:
                    logger.warning(f'SSE publish failed (attempt {attempt + 1}): {response.status_code} - {response.text}')
                    
            except requests.exceptions.RequestException as e:
                logger.error(f'SSE publish error (attempt {attempt + 1}): {e}')
                
                if attempt < self.retry_attempts - 1:
                    time.sleep(0.5 * (attempt + 1))  # Exponential backoff
        
        # All attempts failed
        logger.error(f'SSE publish failed after {self.retry_attempts} attempts: {channel}')
        return {'success': False, 'error': 'Max retry attempts exceeded', 'delivered': 0}
    
    def publish_log(self, workspace_id: str, workflow_id: str, log_data: Dict) -> Dict:
        """
        Convenience method for publishing workflow logs
        
        Args:
            workspace_id: Workspace identifier
            workflow_id: Workflow identifier  
            log_data: Log entry data
            
        Returns:
            Publish result
        """
        channel = f'logs:{workspace_id}:{workflow_id}'
        
        # Ensure log data has required fields
        formatted_log = {
            'date': log_data.get('date') or datetime.now().strftime('%b %d %Y at %I:%M %p'),
            'level': log_data.get('level', 'INFO'),
            'pipeline': log_data.get('pipeline', 'UNKNOWN'),
            'status': log_data.get('status', '0 sec'),
            'message': log_data.get('message', ''),
            **log_data  # Include all original fields
        }
        
        return self.publish(channel, formatted_log)
    
    def publish_metric(self, workspace_id: str, metric_data: Dict) -> Dict:
        """
        Convenience method for publishing workspace metrics
        
        Args:
            workspace_id: Workspace identifier
            metric_data: Metric data
            
        Returns:
            Publish result
        """
        channel = f'metrics:{workspace_id}'
        
        formatted_metric = {
            'timestamp': metric_data.get('timestamp') or int(time.time() * 1000),
            'workspace_id': workspace_id,
            **metric_data
        }
        
        return self.publish(channel, formatted_metric)
    
    def publish_workflow_event(self, workspace_id: str, workflow_id: str, event_data: Dict) -> Dict:
        """
        Convenience method for publishing workflow events
        
        Args:
            workspace_id: Workspace identifier
            workflow_id: Workflow identifier
            event_data: Event data
            
        Returns:
            Publish result
        """
        channel = f'workflows:{workspace_id}:{workflow_id}'
        
        formatted_event = {
            'workspace_id': workspace_id,
            'workflow_id': workflow_id,
            'timestamp': event_data.get('timestamp') or int(time.time() * 1000),
            **event_data
        }
        
        return self.publish(channel, formatted_event)
    
    def publish_alert(self, user_id: str, alert_data: Dict) -> Dict:
        """
        Convenience method for publishing user alerts
        
        Args:
            user_id: User identifier
            alert_data: Alert data
            
        Returns:
            Publish result
        """
        channel = f'alerts:{user_id}'
        
        formatted_alert = {
            'user_id': user_id,
            'timestamp': alert_data.get('timestamp') or int(time.time() * 1000),
            'type': alert_data.get('type', 'info'),
            **alert_data
        }
        
        return self.publish(channel, formatted_alert)
    
    def health_check(self) -> Dict:
        """
        Check SSE Gateway health
        
        Returns:
            Gateway health status
        """
        try:
            response = self.session.get(f'{self.gateway_url}/health')
            if response.status_code == 200:
                return response.json()
            else:
                return {'status': 'unhealthy', 'error': f'HTTP {response.status_code}'}
        except Exception as e:
            return {'status': 'unreachable', 'error': str(e)}


# Integration helper for Flask applications
class FlaskSSEIntegration:
    """
    Flask integration helper for easy SSE publishing
    """
    
    def __init__(self, app=None, publisher=None):
        self.publisher = publisher
        if app:
            self.init_app(app)
    
    def init_app(self, app):
        """Initialize with Flask app"""
        app.sse_publisher = self.publisher
        
        # Add template global for easy access in templates
        @app.template_global()
        def sse_publish(channel, data):
            if app.sse_publisher:
                return app.sse_publisher.publish(channel, data)
            return {'success': False, 'error': 'SSE publisher not configured'}
    
    @staticmethod
    def create_from_config(app_config: Dict) -> 'FlaskSSEIntegration':
        """
        Create SSE integration from Flask app config
        
        Args:
            app_config: Flask app configuration dict
            
        Returns:
            Configured FlaskSSEIntegration instance
        """
        publisher = SSEPublisher(
            gateway_url=app_config.get('SSE_GATEWAY_URL', 'http://localhost:3001'),
            service_token=app_config.get('SSE_SERVICE_TOKEN', ''),
            service_name=app_config.get('SERVICE_NAME', 'unknown-service')
        )
        
        return FlaskSSEIntegration(publisher=publisher)


# Example usage for L5-ETL service
def setup_sse_for_l5_etl(app):
    """
    Setup SSE publishing for L5-ETL service
    
    Usage:
        from sse_publisher import setup_sse_for_l5_etl
        setup_sse_for_l5_etl(app)
        
        # Then in your views:
        app.sse_publisher.publish_log(workspace_id, workflow_id, log_data)
    """
    import os
    
    if not os.getenv('SSE_GATEWAY_URL'):
        logger.warning('SSE_GATEWAY_URL not configured, SSE publishing disabled')
        return
    
    publisher = SSEPublisher(
        gateway_url=os.getenv('SSE_GATEWAY_URL'),
        service_token=os.getenv('SSE_SERVICE_TOKEN', 'l5-etl-service-token'),
        service_name='l5-etl-service'
    )
    
    integration = FlaskSSEIntegration(app, publisher)
    
    logger.info('SSE publishing enabled for L5-ETL service')
    return integration


# Decorator for automatic log publishing
def publish_log_on_write(workspace_id_field='workspace_id', workflow_id_field='workflow_id'):
    """
    Decorator to automatically publish logs when they're written to database
    
    Usage:
        @publish_log_on_write()
        def write_log_to_database(workspace_id, workflow_id, log_data):
            # Write to database
            db.logs.insert(log_data)
            # Log is automatically published to SSE
    """
    def decorator(func):
        def wrapper(*args, **kwargs):
            result = func(*args, **kwargs)
            
            # Try to extract workspace_id and workflow_id from kwargs
            workspace_id = kwargs.get(workspace_id_field)
            workflow_id = kwargs.get(workflow_id_field)
            
            if workspace_id and workflow_id and hasattr(func, '__self__'):
                app = getattr(func.__self__, 'app', None) or current_app
                if hasattr(app, 'sse_publisher'):
                    # Extract log data from result or kwargs
                    log_data = result if isinstance(result, dict) else kwargs.get('log_data', {})
                    app.sse_publisher.publish_log(workspace_id, workflow_id, log_data)
            
            return result
        return wrapper
    return decorator 

#!/usr/bin/env python3
import logging
import asyncio
from hbmqtt.broker import Broker
from hbmqtt.client import MQTTClient, ClientException
from hbmqtt.mqtt.constants import QOS_1

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class SimpleMQTTBroker:
    def __init__(self):
        self.broker = None
        
    async def start_broker(self):
        """Start the MQTT broker"""
        config = {
            'listeners': {
                'default': {
                    'type': 'tcp',
                    'bind': '0.0.0.0:1883',
                    'max_connections': 50
                }
            },
            'sys_interval': 10,
            'auth': {
                'allow-anonymous': False,
                'password-file': None,
                'plugins': ['auth_anonymous']
            },
            'topic-check': {
                'enabled': False
            }
        }
        
        self.broker = Broker(config)
        await self.broker.start()
        logger.info("MQTT Broker started on 0.0.0.0:1883")
        
    async def stop_broker(self):
        """Stop the MQTT broker"""
        if self.broker:
            await self.broker.shutdown()
            logger.info("MQTT Broker stopped")

async def test_client():
    """Test client to simulate ESP32 data"""
    client = MQTTClient()
    await client.connect('mqtt://localhost:1883/')
    
    # Simulate bus telemetry data
    import json
    import time
    
    test_data = {
        "latitude": 19.8762,
        "longitude": 75.3433,
        "speed": 25.5,
        "heading": 90,
        "timestamp": int(time.time())
    }
    
    topic = "buses/B001/telemetry"
    message = json.dumps(test_data)
    
    await client.publish(topic, message.encode(), qos=QOS_1)
    logger.info(f"Published test message to {topic}: {message}")
    
    await client.disconnect()

if __name__ == "__main__":
    broker = SimpleMQTTBroker()
    
    async def main():
        await broker.start_broker()
        
        # Keep the broker running
        try:
            while True:
                await asyncio.sleep(1)
        except KeyboardInterrupt:
            logger.info("Shutting down...")
        finally:
            await broker.stop_broker()
    
    asyncio.run(main())

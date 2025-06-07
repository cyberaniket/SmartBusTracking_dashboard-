
#!/usr/bin/env python3
import asyncio
import logging
from mqtt_broker import SimpleMQTTBroker

logging.basicConfig(level=logging.INFO)

async def main():
    broker = SimpleMQTTBroker()
    await broker.start_broker()
    
    try:
        while True:
            await asyncio.sleep(1)
    except KeyboardInterrupt:
        print("Shutting down MQTT broker...")
    finally:
        await broker.stop_broker()

if __name__ == "__main__":
    asyncio.run(main())

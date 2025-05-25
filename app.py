import os
import logging
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import DeclarativeBase
from werkzeug.middleware.proxy_fix import ProxyFix
from config import Config

# Configure logging
logging.basicConfig(level=logging.DEBUG, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Define SQLAlchemy base class
class Base(DeclarativeBase):
    pass

# Initialize SQLAlchemy
db = SQLAlchemy(model_class=Base)

# Create Flask application
app = Flask(__name__)
app.config.from_object(Config)
app.secret_key = os.environ.get("SESSION_SECRET", Config.SECRET_KEY)

# Use ProxyFix for proper handling of proxied requests
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)

# Initialize database with app
db.init_app(app)

# Create database tables
with app.app_context():
    # Import models to ensure they are registered with SQLAlchemy
    from models import Bus, Route, Stop, ScheduledStop, ETAPrediction, User, UserBusSubscription
    
    # Create all tables
    db.create_all()
    logger.info("Database tables created")

# Import and register routes
from routes import register_routes
register_routes(app)

# Import and initialize the MQTT client
from mqtt_client import init_mqtt_client
init_mqtt_client(app)

logger.info("Application initialized successfully")

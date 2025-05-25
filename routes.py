import logging
import json
from datetime import datetime
from flask import render_template, request, jsonify, abort
from sqlalchemy.exc import SQLAlchemyError
from app import db
from models import Bus, Route, Stop, ETAPrediction, User, UserBusSubscription

# Configure logging
logger = logging.getLogger(__name__)

def register_routes(app):
    """Register all routes with the Flask application"""
    
    @app.route('/')
    def index():
        """Render the dashboard page"""
        return render_template('index.html')
    
    @app.route('/buses')
    def buses():
        """Render the buses management page"""
        buses = db.session.query(Bus).all()
        return render_template('buses.html', buses=buses)
    
    @app.route('/routes')
    def routes():
        """Render the routes management page"""
        routes = db.session.query(Route).all()
        return render_template('routes.html', routes=routes)
    
    @app.route('/stops')
    def stops():
        """Render the stops management page"""
        stops = db.session.query(Stop).all()
        return render_template('stops.html', stops=stops)
    
    # API Routes for Mobile App
    
    @app.route('/api/buses', methods=['GET'])
    def api_buses():
        """Get all active buses"""
        try:
            buses = db.session.query(Bus).filter_by(is_active=True).all()
            
            result = []
            for bus in buses:
                bus_data = {
                    'id': bus.id,
                    'bus_number': bus.bus_number,
                    'latitude': bus.current_latitude,
                    'longitude': bus.current_longitude,
                    'speed': bus.current_speed,
                    'heading': bus.heading,
                    'last_updated': bus.last_updated.isoformat() if bus.last_updated else None,
                    'route_id': bus.current_route_id,
                    'next_stop_id': bus.next_stop_id
                }
                result.append(bus_data)
            
            return jsonify(result)
        
        except Exception as e:
            logger.exception(f"Error retrieving buses: {e}")
            return jsonify({'error': 'Failed to retrieve buses'}), 500
    
    @app.route('/api/bus/<bus_id>', methods=['GET'])
    def api_bus_status(bus_id):
        """Get status for a specific bus"""
        try:
            bus = db.session.query(Bus).filter_by(id=bus_id).first()
            
            if not bus:
                return jsonify({'error': 'Bus not found'}), 404
            
            # Get the current route and next stop info
            route = db.session.query(Route).get(bus.current_route_id) if bus.current_route_id else None
            next_stop = db.session.query(Stop).get(bus.next_stop_id) if bus.next_stop_id else None
            
            # Get all ETAs for this bus
            etas = db.session.query(ETAPrediction).filter_by(bus_id=bus.id).all()
            eta_data = []
            
            for eta in etas:
                stop = db.session.query(Stop).get(eta.stop_id)
                eta_data.append({
                    'stop_id': eta.stop_id,
                    'stop_name': stop.name if stop else 'Unknown',
                    'predicted_arrival': eta.predicted_arrival_time.isoformat(),
                    'is_delayed': eta.is_delayed,
                    'delay_minutes': eta.delay_minutes
                })
            
            result = {
                'id': bus.id,
                'bus_number': bus.bus_number,
                'latitude': bus.current_latitude,
                'longitude': bus.current_longitude,
                'speed': bus.current_speed,
                'heading': bus.heading,
                'last_updated': bus.last_updated.isoformat() if bus.last_updated else None,
                'route': {
                    'id': route.id,
                    'route_number': route.route_number,
                    'name': route.name
                } if route else None,
                'next_stop': {
                    'id': next_stop.id,
                    'name': next_stop.name,
                    'latitude': next_stop.latitude,
                    'longitude': next_stop.longitude
                } if next_stop else None,
                'eta_predictions': eta_data
            }
            
            return jsonify(result)
        
        except Exception as e:
            logger.exception(f"Error retrieving bus status: {e}")
            return jsonify({'error': 'Failed to retrieve bus status'}), 500
    
    @app.route('/api/eta', methods=['GET'])
    def api_eta():
        """Get ETA for a specific bus and stop"""
        try:
            bus_id = request.args.get('bus_id')
            stop_id = request.args.get('stop_id')
            
            if not bus_id or not stop_id:
                return jsonify({'error': 'Missing required parameters'}), 400
            
            # Get the ETA prediction
            eta = db.session.query(ETAPrediction).filter_by(
                bus_id=bus_id,
                stop_id=stop_id
            ).first()
            
            if not eta:
                return jsonify({'error': 'No ETA prediction found'}), 404
            
            # Get bus and stop info
            bus = db.session.query(Bus).get(bus_id)
            stop = db.session.query(Stop).get(stop_id)
            
            result = {
                'bus_id': bus_id,
                'bus_number': bus.bus_number if bus else 'Unknown',
                'stop_id': stop_id,
                'stop_name': stop.name if stop else 'Unknown',
                'predicted_arrival': eta.predicted_arrival_time.isoformat(),
                'prediction_timestamp': eta.prediction_timestamp.isoformat(),
                'is_delayed': eta.is_delayed,
                'delay_minutes': eta.delay_minutes
            }
            
            return jsonify(result)
        
        except Exception as e:
            logger.exception(f"Error retrieving ETA: {e}")
            return jsonify({'error': 'Failed to retrieve ETA'}), 500
    
    @app.route('/api/routes', methods=['GET'])
    def api_routes():
        """Get all active routes"""
        try:
            routes = db.session.query(Route).filter_by(is_active=True).all()
            
            result = []
            for route in routes:
                # Get all stops for this route
                stops_data = []
                for scheduled_stop in route.stops:
                    stop = db.session.query(Stop).get(scheduled_stop.stop_id)
                    if stop:
                        stops_data.append({
                            'id': stop.id,
                            'stop_code': stop.stop_code,
                            'name': stop.name,
                            'latitude': stop.latitude,
                            'longitude': stop.longitude,
                            'sequence': scheduled_stop.stop_sequence,
                            'scheduled_arrival': scheduled_stop.scheduled_arrival_time,
                            'scheduled_departure': scheduled_stop.scheduled_departure_time
                        })
                
                route_data = {
                    'id': route.id,
                    'route_number': route.route_number,
                    'name': route.name,
                    'description': route.description,
                    'stops': stops_data
                }
                result.append(route_data)
            
            return jsonify(result)
        
        except Exception as e:
            logger.exception(f"Error retrieving routes: {e}")
            return jsonify({'error': 'Failed to retrieve routes'}), 500
    
    @app.route('/api/stops', methods=['GET'])
    def api_stops():
        """Get all active stops"""
        try:
            stops = db.session.query(Stop).filter_by(is_active=True).all()
            
            result = []
            for stop in stops:
                stop_data = {
                    'id': stop.id,
                    'stop_code': stop.stop_code,
                    'name': stop.name,
                    'latitude': stop.latitude,
                    'longitude': stop.longitude,
                    'address': stop.address
                }
                result.append(stop_data)
            
            return jsonify(result)
        
        except Exception as e:
            logger.exception(f"Error retrieving stops: {e}")
            return jsonify({'error': 'Failed to retrieve stops'}), 500
    
    @app.route('/api/user/subscribe', methods=['POST'])
    def api_subscribe():
        """Subscribe a user to receive notifications for a bus at a stop"""
        try:
            data = request.get_json()
            
            if not data:
                return jsonify({'error': 'No data provided'}), 400
            
            # Extract required fields
            user_id = data.get('user_id')
            bus_id = data.get('bus_id')
            stop_id = data.get('stop_id')
            fcm_token = data.get('fcm_token')
            
            if not all([user_id, bus_id, stop_id, fcm_token]):
                return jsonify({'error': 'Missing required fields'}), 400
            
            # Find or create the user
            user = db.session.query(User).get(user_id)
            
            if not user:
                return jsonify({'error': 'User not found'}), 404
            
            # Update FCM token
            user.fcm_token = fcm_token
            
            # Check if subscription already exists
            subscription = db.session.query(UserBusSubscription).filter_by(
                user_id=user_id,
                bus_id=bus_id,
                stop_id=stop_id
            ).first()
            
            if not subscription:
                # Create new subscription
                subscription = UserBusSubscription(
                    user_id=user_id,
                    bus_id=bus_id,
                    stop_id=stop_id,
                    notify_on_approach=data.get('notify_on_approach', True),
                    notify_on_delay=data.get('notify_on_delay', True),
                    approach_distance_km=data.get('approach_distance_km', 0.5)
                )
                db.session.add(subscription)
            else:
                # Update existing subscription
                subscription.notify_on_approach = data.get('notify_on_approach', subscription.notify_on_approach)
                subscription.notify_on_delay = data.get('notify_on_delay', subscription.notify_on_delay)
                subscription.approach_distance_km = data.get('approach_distance_km', subscription.approach_distance_km)
            
            # Commit changes
            db.session.commit()
            
            return jsonify({'success': True, 'message': 'Subscription updated'})
        
        except SQLAlchemyError as e:
            db.session.rollback()
            logger.error(f"Database error updating subscription: {e}")
            return jsonify({'error': 'Database error'}), 500
        except Exception as e:
            logger.exception(f"Error updating subscription: {e}")
            return jsonify({'error': 'Failed to update subscription'}), 500
    
    @app.route('/api/user/unsubscribe', methods=['POST'])
    def api_unsubscribe():
        """Unsubscribe a user from notifications for a bus at a stop"""
        try:
            data = request.get_json()
            
            if not data:
                return jsonify({'error': 'No data provided'}), 400
            
            # Extract required fields
            user_id = data.get('user_id')
            bus_id = data.get('bus_id')
            stop_id = data.get('stop_id')
            
            if not all([user_id, bus_id, stop_id]):
                return jsonify({'error': 'Missing required fields'}), 400
            
            # Find the subscription
            subscription = db.session.query(UserBusSubscription).filter_by(
                user_id=user_id,
                bus_id=bus_id,
                stop_id=stop_id
            ).first()
            
            if not subscription:
                return jsonify({'error': 'Subscription not found'}), 404
            
            # Delete the subscription
            db.session.delete(subscription)
            db.session.commit()
            
            return jsonify({'success': True, 'message': 'Subscription removed'})
        
        except SQLAlchemyError as e:
            db.session.rollback()
            logger.error(f"Database error removing subscription: {e}")
            return jsonify({'error': 'Database error'}), 500
        except Exception as e:
            logger.exception(f"Error removing subscription: {e}")
            return jsonify({'error': 'Failed to remove subscription'}), 500

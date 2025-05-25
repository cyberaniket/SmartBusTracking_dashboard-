/**
 * map.js - Handles the map functionality for the Smart Bus Tracking System
 */

// Global map variables
let map;
let busMarkers = {};
let stopMarkers = {};
let routeLines = {};

// Map initialization function
function initMap() {
    // Create map centered on a default location (will be adjusted based on data)
    map = L.map('map').setView([51.505, -0.09], 13);
    
    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    
    // Load initial data
    loadBusLocations();
    loadStops();
    loadRoutes();
    
    console.log('Map initialized');
}

/**
 * Load and display bus locations on the map
 */
function loadBusLocations() {
    fetch('/api/buses')
        .then(response => response.json())
        .then(buses => {
            updateBusesOnMap(buses);
        })
        .catch(error => {
            console.error('Error loading bus locations:', error);
        });
}

/**
 * Update bus markers on the map
 */
function updateBusesOnMap(buses) {
    // Track which buses are still active
    const activeBusIds = buses.map(bus => bus.id);
    
    // Remove markers for buses that are no longer active
    Object.keys(busMarkers).forEach(busId => {
        if (!activeBusIds.includes(parseInt(busId))) {
            map.removeLayer(busMarkers[busId]);
            delete busMarkers[busId];
        }
    });
    
    // Update or add markers for active buses
    buses.forEach(bus => {
        // Skip buses without location data
        if (!bus.latitude || !bus.longitude) return;
        
        // Create custom icon for bus
        const busIcon = L.divIcon({
            html: `<i class="fas fa-bus bus-marker"></i>`,
            className: 'bus-icon-container',
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });
        
        // Determine marker rotation based on heading
        let rotation = '';
        if (bus.heading !== null && bus.heading !== undefined) {
            rotation = `transform: rotate(${bus.heading}deg);`;
        }
        
        // Create bus tooltip content
        const tooltipContent = `
            <strong>Bus ${bus.bus_number}</strong><br>
            Speed: ${bus.speed !== null ? bus.speed.toFixed(1) + ' km/h' : 'N/A'}<br>
            ${bus.next_stop_id ? 'Next Stop: ' + bus.next_stop_id : ''}
        `;
        
        // Create popup content
        const popupContent = `
            <div>
                <h6>Bus ${bus.bus_number}</h6>
                <p><strong>Route:</strong> ${bus.route_id || 'Not assigned'}</p>
                <p><strong>Speed:</strong> ${bus.speed !== null ? bus.speed.toFixed(1) + ' km/h' : 'N/A'}</p>
                <p><strong>Last Update:</strong> ${formatTime(bus.last_updated)}</p>
                <button class="btn btn-sm btn-primary" onclick="window.location.href='/buses?id=${bus.id}'">
                    View Details
                </button>
            </div>
        `;
        
        if (busMarkers[bus.id]) {
            // Update existing marker
            busMarkers[bus.id].setLatLng([bus.latitude, bus.longitude]);
            
            // Update the icon with rotation
            if (rotation) {
                busMarkers[bus.id].setIcon(L.divIcon({
                    html: `<i class="fas fa-bus bus-marker" style="${rotation}"></i>`,
                    className: 'bus-icon-container',
                    iconSize: [30, 30],
                    iconAnchor: [15, 15]
                }));
            }
            
            // Update tooltip and popup
            busMarkers[bus.id].setTooltipContent(tooltipContent);
            busMarkers[bus.id].setPopupContent(popupContent);
        } else {
            // Create new marker
            busMarkers[bus.id] = L.marker([bus.latitude, bus.longitude], { 
                icon: busIcon,
                busBusId: bus.id, // Store bus ID for reference
                zIndexOffset: 1000 // Ensure buses appear above stops
            })
            .bindTooltip(tooltipContent)
            .bindPopup(popupContent)
            .addTo(map);
        }
    });
    
    // Center map if no markers exist yet
    if (Object.keys(busMarkers).length > 0 && !map._loaded) {
        centerMap();
    }
}

/**
 * Load and display stops on the map
 */
function loadStops() {
    fetch('/api/stops')
        .then(response => response.json())
        .then(stops => {
            updateStopsOnMap(stops);
        })
        .catch(error => {
            console.error('Error loading stops:', error);
        });
}

/**
 * Update stop markers on the map
 */
function updateStopsOnMap(stops) {
    // Remove existing stop markers
    Object.values(stopMarkers).forEach(marker => map.removeLayer(marker));
    stopMarkers = {};
    
    // Add markers for stops
    stops.forEach(stop => {
        // Skip stops without location data
        if (!stop.latitude || !stop.longitude) return;
        
        // Create custom icon for stop
        const stopIcon = L.divIcon({
            html: `<i class="fas fa-map-marker-alt stop-marker"></i>`,
            className: 'stop-icon-container',
            iconSize: [20, 20],
            iconAnchor: [10, 20]
        });
        
        // Create tooltip content
        const tooltipContent = `
            <strong>${stop.name}</strong><br>
            Stop Code: ${stop.stop_code}
        `;
        
        // Create popup content
        const popupContent = `
            <div>
                <h6>${stop.name}</h6>
                <p><strong>Stop Code:</strong> ${stop.stop_code}</p>
                <p><strong>Address:</strong> ${stop.address || 'N/A'}</p>
                <button class="btn btn-sm btn-primary" onclick="window.location.href='/stops?id=${stop.id}'">
                    View Details
                </button>
            </div>
        `;
        
        // Create marker
        stopMarkers[stop.id] = L.marker([stop.latitude, stop.longitude], { 
            icon: stopIcon,
            stopId: stop.id // Store stop ID for reference
        })
        .bindTooltip(tooltipContent)
        .bindPopup(popupContent)
        .addTo(map);
    });
}

/**
 * Load and display routes on the map
 */
function loadRoutes() {
    fetch('/api/routes')
        .then(response => response.json())
        .then(routes => {
            updateRoutesOnMap(routes);
        })
        .catch(error => {
            console.error('Error loading routes:', error);
        });
}

/**
 * Update route lines on the map
 */
function updateRoutesOnMap(routes) {
    // Remove existing route lines
    Object.values(routeLines).forEach(line => map.removeLayer(line));
    routeLines = {};
    
    // Add lines for routes
    routes.forEach(route => {
        // Skip routes without stops
        if (!route.stops || route.stops.length < 2) return;
        
        // Extract coordinates
        const coordinates = route.stops.map(stop => [stop.latitude, stop.longitude]);
        
        // Create a different color for each route
        const routeColor = getRouteColor(route.id);
        
        // Create route line
        routeLines[route.id] = L.polyline(coordinates, {
            color: routeColor,
            weight: 3,
            opacity: 0.6,
            dashArray: '5, 10'
        })
        .bindTooltip(`Route ${route.route_number}: ${route.name}`)
        .addTo(map);
    });
}

/**
 * Generate a color based on route ID for consistency
 */
function getRouteColor(routeId) {
    const colors = [
        '#1e88e5', // blue
        '#43a047', // green
        '#e53935', // red
        '#8e24aa', // purple
        '#fb8c00', // orange
        '#00acc1', // cyan
        '#ffb300', // amber
        '#546e7a', // blue gray
        '#ec407a', // pink
        '#7cb342'  // light green
    ];
    
    return colors[routeId % colors.length];
}

/**
 * Center the map to show all bus markers
 */
function centerMap() {
    // Create bounds based on bus markers
    const busIds = Object.keys(busMarkers);
    
    if (busIds.length > 0) {
        const bounds = L.latLngBounds(
            busIds.map(id => busMarkers[id].getLatLng())
        );
        
        // Add stop markers to bounds
        Object.values(stopMarkers).forEach(marker => {
            bounds.extend(marker.getLatLng());
        });
        
        // Fit map to bounds with padding
        map.fitBounds(bounds, { padding: [50, 50] });
    } else if (Object.keys(stopMarkers).length > 0) {
        // If no buses, center on stops
        const stopBounds = L.latLngBounds(
            Object.values(stopMarkers).map(marker => marker.getLatLng())
        );
        map.fitBounds(stopBounds, { padding: [50, 50] });
    }
}

/**
 * Format timestamp for display
 */
function formatTime(timestamp) {
    if (!timestamp) return 'Unknown';
    
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
}

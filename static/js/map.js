/**
 * map.js - Handles the Google Maps functionality for the Smart Bus Tracking System
 * Focused on India map with traffic data analysis
 */

// Global map variables
let map;
let trafficLayer;
let busMarkers = {};
let stopMarkers = {};
let routeLines = {};
let heatmap = null;
let infoWindow = null;

// Map initialization function
function initMap() {
    // Create map centered on India
    const indiaCenter = { lat: 20.5937, lng: 78.9629 };
    
    map = new google.maps.Map(document.getElementById('map'), {
        zoom: 5,
        center: indiaCenter,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        mapTypeControl: true,
        mapTypeControlOptions: {
            style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
            position: google.maps.ControlPosition.TOP_RIGHT
        },
        fullscreenControl: true,
        streetViewControl: true,
        zoomControl: true
    });
    
    // Create info window for markers
    infoWindow = new google.maps.InfoWindow();
    
    // Create traffic layer for all roads (not just highways) and add to map
    trafficLayer = new google.maps.TrafficLayer({
        autoRefresh: true,
        options: {
            allRoads: true  // Include traffic data for all roads, not just highways
        }
    });
    trafficLayer.setMap(map);
    
    // Add traffic toggle control
    addTrafficToggleControl(map);
    
    // Load initial data
    loadBusLocations();
    loadStops();
    loadRoutes();
    
    console.log('Google Maps initialized for India with traffic data');
}

// Add custom control for toggling traffic layer
function addTrafficToggleControl(map) {
    const trafficControlDiv = document.createElement('div');
    trafficControlDiv.className = 'custom-map-control';
    
    const controlUI = document.createElement('div');
    controlUI.className = 'custom-map-control-ui';
    controlUI.title = 'Click to toggle traffic layer';
    controlUI.innerHTML = '<div class="custom-control-container">' +
        '<i class="fas fa-car"></i> Traffic' +
        '<label class="switch ms-2">' +
        '<input type="checkbox" id="traffic-toggle" checked>' +
        '<span class="slider round"></span>' +
        '</label></div>';
    trafficControlDiv.appendChild(controlUI);
    
    // Setup click event listener
    controlUI.addEventListener('click', function() {
        const checkbox = document.getElementById('traffic-toggle');
        checkbox.checked = !checkbox.checked;
        
        if (checkbox.checked) {
            trafficLayer.setMap(map);
        } else {
            trafficLayer.setMap(null);
        }
    });
    
    // Add the control to the map
    map.controls[google.maps.ControlPosition.TOP_LEFT].push(trafficControlDiv);
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
            busMarkers[busId].setMap(null);
            delete busMarkers[busId];
        }
    });
    
    // Update or add markers for active buses
    buses.forEach(bus => {
        // Skip buses without location data
        if (!bus.latitude || !bus.longitude) return;
        
        // Create bus info content
        const busInfoContent = `
            <div class="bus-info-window">
                <h6>Bus ${bus.bus_number}</h6>
                <p><strong>Route:</strong> ${bus.route_id || 'Not assigned'}</p>
                <p><strong>Speed:</strong> ${bus.speed !== null ? bus.speed.toFixed(1) + ' km/h' : 'N/A'}</p>
                <p><strong>Last Update:</strong> ${formatTime(bus.last_updated)}</p>
                <button class="btn btn-sm btn-primary" onclick="window.location.href='/buses?id=${bus.id}'">
                    View Details
                </button>
            </div>
        `;
        
        // Determine marker rotation based on heading
        let rotation = 0;
        if (bus.heading !== null && bus.heading !== undefined) {
            rotation = bus.heading;
        }
        
        const busPosition = { 
            lat: bus.latitude, 
            lng: bus.longitude 
        };
        
        if (busMarkers[bus.id]) {
            // Update existing marker position
            busMarkers[bus.id].setPosition(busPosition);
        } else {
            // Create SVG icon for bus with rotation
            const busIcon = {
                path: 'M8 0c-4.4 0-8 3.6-8 8s3.6 8 8 8 8-3.6 8-8-3.6-8-8-8zM13.1 13.4c-0.2 0.2-0.4 0.3-0.7 0.3s-0.5-0.1-0.7-0.3l-3.7-3.7-3.7 3.7c-0.4 0.4-1 0.4-1.4 0s-0.4-1 0-1.4l3.7-3.7-3.7-3.7c-0.4-0.4-0.4-1 0-1.4s1-0.4 1.4 0l3.7 3.7 3.7-3.7c0.4-0.4 1-0.4 1.4 0s0.4 1 0 1.4l-3.7 3.7 3.7 3.7c0.4 0.4 0.4 1 0 1.4z',
                fillColor: '#0d6efd',
                fillOpacity: 1,
                strokeWeight: 0,
                rotation: rotation,
                scale: 2,
                anchor: new google.maps.Point(8, 8),
            };
            
            // Create new marker
            busMarkers[bus.id] = new google.maps.Marker({
                position: busPosition,
                map: map,
                icon: busIcon,
                title: `Bus ${bus.bus_number}`,
                zIndex: 1000 // Ensure buses appear above stops
            });
            
            // Add click event to show info window
            busMarkers[bus.id].addListener('click', () => {
                infoWindow.setContent(busInfoContent);
                infoWindow.open(map, busMarkers[bus.id]);
            });
        }
    });
    
    // Add data points for heatmap visualization of bus density
    updateHeatmap(buses);
    
    // Center map if needed
    if (Object.keys(busMarkers).length > 0 && !map.getBounds) {
        centerMap();
    }
}

/**
 * Update heatmap with bus density data
 */
function updateHeatmap(buses) {
    // Only include buses with valid locations
    const heatmapData = buses
        .filter(bus => bus.latitude && bus.longitude)
        .map(bus => {
            return {
                location: new google.maps.LatLng(bus.latitude, bus.longitude),
                weight: 1 // Could be weighted by different metrics like delay, speed, etc.
            };
        });
    
    // Remove old heatmap if it exists
    if (heatmap) {
        heatmap.setMap(null);
    }
    
    // Create new heatmap if we have data
    if (heatmapData.length > 0) {
        heatmap = new google.maps.visualization.HeatmapLayer({
            data: heatmapData,
            map: map,
            radius: 30,
            opacity: 0.6
        });
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
    Object.values(stopMarkers).forEach(marker => marker.setMap(null));
    stopMarkers = {};
    
    // Add markers for stops
    stops.forEach(stop => {
        // Skip stops without location data
        if (!stop.latitude || !stop.longitude) return;
        
        // Create stop info content
        const stopInfoContent = `
            <div class="stop-info-window">
                <h6>${stop.name}</h6>
                <p><strong>Stop Code:</strong> ${stop.stop_code}</p>
                <p><strong>Address:</strong> ${stop.address || 'N/A'}</p>
                <button class="btn btn-sm btn-primary" onclick="window.location.href='/stops?id=${stop.id}'">
                    View Details
                </button>
            </div>
        `;
        
        const stopPosition = {
            lat: stop.latitude,
            lng: stop.longitude
        };
        
        // Create icon for stop
        const stopIcon = {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: '#dc3545',
            fillOpacity: 1,
            strokeWeight: 2,
            strokeColor: '#ffffff',
            scale: 8
        };
        
        // Create marker
        stopMarkers[stop.id] = new google.maps.Marker({
            position: stopPosition,
            map: map,
            icon: stopIcon,
            title: stop.name,
            zIndex: 900 // Ensure stops appear below buses
        });
        
        // Add click event to show info window
        stopMarkers[stop.id].addListener('click', () => {
            infoWindow.setContent(stopInfoContent);
            infoWindow.open(map, stopMarkers[stop.id]);
        });
        
        // Add hover effect with label
        const stopLabel = new google.maps.InfoWindow({
            content: `<div class="stop-label">${stop.name}</div>`,
            disableAutoPan: true
        });
        
        stopMarkers[stop.id].addListener('mouseover', () => {
            stopLabel.open(map, stopMarkers[stop.id]);
        });
        
        stopMarkers[stop.id].addListener('mouseout', () => {
            stopLabel.close();
        });
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
    Object.values(routeLines).forEach(line => line.setMap(null));
    routeLines = {};
    
    // Add lines for routes
    routes.forEach(route => {
        // Skip routes without stops
        if (!route.stops || route.stops.length < 2) return;
        
        // Extract coordinates
        const coordinates = route.stops.map(stop => {
            return { lat: stop.latitude, lng: stop.longitude };
        });
        
        // Create a different color for each route
        const routeColor = getRouteColor(route.id);
        
        // Create route polyline
        routeLines[route.id] = new google.maps.Polyline({
            path: coordinates,
            geodesic: true,
            strokeColor: routeColor,
            strokeOpacity: 0.8,
            strokeWeight: 4,
            map: map
        });
        
        // Add route info window when clicked
        routeLines[route.id].addListener('click', (event) => {
            const routeInfo = `
                <div class="route-info-window">
                    <h6>Route ${route.route_number}</h6>
                    <p>${route.name}</p>
                    <p><strong>Stops:</strong> ${route.stops.length}</p>
                    <p>${route.description || ''}</p>
                    <button class="btn btn-sm btn-primary" onclick="window.location.href='/routes?id=${route.id}'">
                        View Details
                    </button>
                </div>
            `;
            
            infoWindow.setContent(routeInfo);
            infoWindow.setPosition(event.latLng);
            infoWindow.open(map);
        });
        
        // Add directional arrows to show route direction
        if (coordinates.length > 1) {
            addRouteDirectionArrows(coordinates, routeColor, route.id);
        }
    });
}

/**
 * Add directional arrows to indicate route direction
 */
function addRouteDirectionArrows(path, color, routeId) {
    // Calculate arrow positions (place arrows at 1/3 and 2/3 along the route)
    const arrowPositions = [
        Math.floor(path.length / 3),
        Math.floor((path.length / 3) * 2)
    ];
    
    arrowPositions.forEach(idx => {
        if (idx > 0 && idx < path.length) {
            // Calculate heading
            const heading = google.maps.geometry.spherical.computeHeading(
                new google.maps.LatLng(path[idx-1].lat, path[idx-1].lng),
                new google.maps.LatLng(path[idx].lat, path[idx].lng)
            );
            
            // Create arrow marker
            const arrowIcon = {
                path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                scale: 4,
                fillColor: color,
                fillOpacity: 1,
                strokeWeight: 2,
                strokeColor: '#FFFFFF',
                rotation: heading
            };
            
            const arrowMarker = new google.maps.Marker({
                position: new google.maps.LatLng(
                    (path[idx-1].lat + path[idx].lat) / 2,
                    (path[idx-1].lng + path[idx].lng) / 2
                ),
                icon: arrowIcon,
                map: map,
                zIndex: 800
            });
            
            // Store reference to this arrow in the routeLines object for later removal
            if (!routeLines[routeId].arrows) routeLines[routeId].arrows = [];
            routeLines[routeId].arrows.push(arrowMarker);
        }
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
    const bounds = new google.maps.LatLngBounds();
    
    // Add bus markers to bounds
    if (busIds.length > 0) {
        busIds.forEach(id => {
            bounds.extend(busMarkers[id].getPosition());
        });
    }
    
    // Add stop markers to bounds
    const stopIds = Object.keys(stopMarkers);
    if (stopIds.length > 0) {
        stopIds.forEach(id => {
            bounds.extend(stopMarkers[id].getPosition());
        });
    }
    
    // If no markers found, center on India
    if (busIds.length === 0 && stopIds.length === 0) {
        // Default center for India
        map.setCenter({lat: 20.5937, lng: 78.9629});
        map.setZoom(5);
    } else {
        // Fit map to bounds with padding
        map.fitBounds(bounds);
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

/**
 * Add traffic analysis for a specific route
 */
function analyzeTrafficForRoute(routeId) {
    fetch(`/api/routes/${routeId}/traffic`)
        .then(response => response.json())
        .then(data => {
            // Create a traffic congestion path based on the data
            if (data && data.congestion_points) {
                visualizeTrafficCongestion(data.congestion_points, routeId);
            }
        })
        .catch(error => {
            console.error(`Error analyzing traffic for route ${routeId}:`, error);
        });
}

/**
 * Visualize traffic congestion points on the map
 */
function visualizeTrafficCongestion(congestionPoints, routeId) {
    // Remove any existing traffic visualization for this route
    if (routeLines[routeId] && routeLines[routeId].trafficOverlay) {
        routeLines[routeId].trafficOverlay.setMap(null);
        delete routeLines[routeId].trafficOverlay;
    }
    
    // Create traffic overlay if we have congestion points
    if (congestionPoints && congestionPoints.length > 0) {
        const points = congestionPoints.map(point => {
            return {
                location: new google.maps.LatLng(point.latitude, point.longitude),
                weight: point.congestion_level // 0-10 scale
            };
        });
        
        // Create heatmap layer for traffic
        routeLines[routeId].trafficOverlay = new google.maps.visualization.HeatmapLayer({
            data: points,
            map: map,
            radius: 20,
            gradient: [
                'rgba(0, 255, 0, 0)',
                'rgba(0, 255, 0, 1)',
                'rgba(255, 255, 0, 1)',
                'rgba(255, 165, 0, 1)',
                'rgba(255, 0, 0, 1)'
            ]
        });
    }
}

/**
 * Add search bar for locations in India
 */
function addIndiaSearchBox() {
    // Create search box input
    const input = document.createElement('input');
    input.id = 'pac-input';
    input.className = 'controls form-control form-control-sm';
    input.type = 'text';
    input.placeholder = 'Search locations in India';
    input.style.width = '300px';
    input.style.margin = '10px';
    
    const searchBox = new google.maps.places.SearchBox(input);
    map.controls[google.maps.ControlPosition.TOP_CENTER].push(input);
    
    // Add quick-access buttons for major Indian cities including Aurangabad
    const cityButtonsDiv = document.createElement('div');
    cityButtonsDiv.className = 'map-city-buttons card p-2';
    cityButtonsDiv.style.margin = '10px';
    
    // Add title
    const titleDiv = document.createElement('div');
    titleDiv.className = 'mb-2 text-center';
    titleDiv.innerHTML = '<small><strong>Major Cities</strong></small>';
    cityButtonsDiv.appendChild(titleDiv);
    
    // Create button container
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'd-flex flex-wrap justify-content-center';
    
    // List of major cities with Aurangabad highlighted
    const majorCities = [
        { name: 'Delhi', lat: 28.7041, lng: 77.1025 },
        { name: 'Mumbai', lat: 19.0760, lng: 72.8777 },
        { name: 'Aurangabad', lat: 19.8762, lng: 75.3433 },
        { name: 'Bangalore', lat: 12.9716, lng: 77.5946 },
        { name: 'Chennai', lat: 13.0827, lng: 80.2707 }
    ];
    
    majorCities.forEach(city => {
        const btn = document.createElement('button');
        btn.className = city.name === 'Aurangabad' ? 
            'btn btn-sm btn-primary m-1' : 
            'btn btn-sm btn-outline-secondary m-1';
        btn.textContent = city.name;
        btn.onclick = function() {
            map.setCenter({ lat: city.lat, lng: city.lng });
            map.setZoom(12); // Closer zoom for city view
            
            // Show traffic in this area
            if (trafficLayer) {
                trafficLayer.setMap(map);
            }
            
            // Create marker for the city
            new google.maps.Marker({
                position: { lat: city.lat, lng: city.lng },
                map: map,
                title: city.name,
                animation: google.maps.Animation.DROP
            });
        };
        buttonContainer.appendChild(btn);
    });
    
    cityButtonsDiv.appendChild(buttonContainer);
    
    // Add city buttons to the map
    map.controls[google.maps.ControlPosition.BOTTOM_CENTER].push(cityButtonsDiv);
    
    // Bias the SearchBox results towards current map's viewport
    map.addListener('bounds_changed', () => {
        searchBox.setBounds(map.getBounds());
    });
    
    // Listen for the event fired when the user selects a prediction and retrieve more details
    searchBox.addListener('places_changed', () => {
        const places = searchBox.getPlaces();
        
        if (places.length === 0) {
            return;
        }
        
        // For each place, get the icon, name and location.
        const bounds = new google.maps.LatLngBounds();
        
        places.forEach(place => {
            if (!place.geometry || !place.geometry.location) {
                console.log('Returned place contains no geometry');
                return;
            }
            
            // Create a marker for the search result
            const marker = new google.maps.Marker({
                map: map,
                title: place.name,
                position: place.geometry.location,
                animation: google.maps.Animation.DROP
            });
            
            // Add click listener to show place details
            marker.addListener('click', () => {
                const content = `
                    <div class="place-info-window">
                        <h6>${place.name}</h6>
                        <p>${place.formatted_address || ''}</p>
                    </div>
                `;
                
                infoWindow.setContent(content);
                infoWindow.open(map, marker);
            });
            
            if (place.geometry.viewport) {
                // Only geocodes have viewport
                bounds.union(place.geometry.viewport);
            } else {
                bounds.extend(place.geometry.location);
            }
        });
        
        map.fitBounds(bounds);
    });
}

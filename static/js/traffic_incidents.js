/**
 * traffic_incidents.js - Handles additional traffic data visualization for the Smart Bus Tracking System
 * Integrates Google Maps traffic incidents, accidents, road closures, and construction
 */

// Global variables for traffic incident tracking
let trafficIncidents = [];
let incidentMarkers = {};
let incidentInfoWindows = {};
let isIncidentsVisible = true;
let isTrafficHeatmapVisible = false;
let trafficHeatmap = null;
let incidentRefreshInterval = null;

/**
 * Initialize traffic incidents tracking and visualization
 */
function initTrafficIncidents() {
    console.log('Initializing traffic incidents module');
    
    // Add UI controls for traffic incidents
    addTrafficIncidentsControl();
    
    // Load initial traffic incidents
    loadTrafficIncidents();
    
    // Set up auto-refresh for traffic data (every 5 minutes)
    incidentRefreshInterval = setInterval(loadTrafficIncidents, 300000);
}

/**
 * Add custom control for toggling traffic incidents display
 */
function addTrafficIncidentsControl() {
    // Create container for traffic data controls
    const trafficControlsDiv = document.createElement('div');
    trafficControlsDiv.className = 'card map-control p-2';
    trafficControlsDiv.style.margin = '10px';
    
    // Create title
    const titleDiv = document.createElement('div');
    titleDiv.className = 'mb-2 text-center';
    titleDiv.innerHTML = '<small><strong>Traffic Data</strong></small>';
    trafficControlsDiv.appendChild(titleDiv);
    
    // Create traffic incidents toggle
    const incidentsToggle = document.createElement('div');
    incidentsToggle.className = 'd-flex justify-content-between align-items-center mb-2';
    incidentsToggle.innerHTML = `
        <span><i class="fas fa-car-crash me-2"></i>Incidents</span>
        <div class="form-check form-switch">
            <input class="form-check-input" type="checkbox" id="incidents-toggle" checked>
        </div>
    `;
    trafficControlsDiv.appendChild(incidentsToggle);
    
    // Create traffic heatmap toggle
    const heatmapToggle = document.createElement('div');
    heatmapToggle.className = 'd-flex justify-content-between align-items-center mb-2';
    heatmapToggle.innerHTML = `
        <span><i class="fas fa-fire me-2"></i>Traffic Heatmap</span>
        <div class="form-check form-switch">
            <input class="form-check-input" type="checkbox" id="heatmap-toggle">
        </div>
    `;
    trafficControlsDiv.appendChild(heatmapToggle);
    
    // Create traffic flow toggle
    const flowToggle = document.createElement('div');
    flowToggle.className = 'd-flex justify-content-between align-items-center';
    flowToggle.innerHTML = `
        <span><i class="fas fa-road me-2"></i>Traffic Flow</span>
        <div class="form-check form-switch">
            <input class="form-check-input" type="checkbox" id="traffic-toggle" checked>
        </div>
    `;
    trafficControlsDiv.appendChild(flowToggle);
    
    // Add the control to the map
    map.controls[google.maps.ControlPosition.RIGHT_TOP].push(trafficControlsDiv);
    
    // Add event listeners
    document.getElementById('incidents-toggle').addEventListener('change', toggleIncidents);
    document.getElementById('heatmap-toggle').addEventListener('change', toggleTrafficHeatmap);
    document.getElementById('traffic-toggle').addEventListener('change', toggleTrafficLayer);
}

/**
 * Toggle visibility of traffic incidents on the map
 */
function toggleIncidents(event) {
    isIncidentsVisible = event ? event.target.checked : !isIncidentsVisible;
    
    // Update all incident markers visibility
    Object.values(incidentMarkers).forEach(marker => {
        marker.setVisible(isIncidentsVisible);
    });
    
    // Close any open info windows if hiding incidents
    if (!isIncidentsVisible) {
        Object.values(incidentInfoWindows).forEach(infoWindow => {
            infoWindow.close();
        });
    }
}

/**
 * Toggle traffic heatmap visibility
 */
function toggleTrafficHeatmap(event) {
    isTrafficHeatmapVisible = event ? event.target.checked : !isTrafficHeatmapVisible;
    
    if (isTrafficHeatmapVisible) {
        if (!trafficHeatmap) {
            createTrafficHeatmap();
        } else {
            trafficHeatmap.setMap(map);
        }
    } else if (trafficHeatmap) {
        trafficHeatmap.setMap(null);
    }
}

/**
 * Toggle the traffic layer visibility
 */
function toggleTrafficLayer(event) {
    const isVisible = event ? event.target.checked : (trafficLayer.getMap() === null);
    
    if (isVisible) {
        trafficLayer.setMap(map);
    } else {
        trafficLayer.setMap(null);
    }
}

/**
 * Load traffic incidents from the API
 */
function loadTrafficIncidents() {
    // In a real implementation, this would call the Google Maps API for traffic incidents
    // For this example, we'll simulate incidents with sample data
    
    // Remove existing incident markers
    clearIncidentMarkers();
    
    // Get simulated traffic incidents
    const incidents = getSimulatedTrafficIncidents();
    trafficIncidents = incidents;
    
    // Display incidents on the map
    displayTrafficIncidents(incidents);
    
    // Update traffic heatmap if visible
    if (isTrafficHeatmapVisible && trafficHeatmap) {
        updateTrafficHeatmapData();
    }
}

/**
 * Remove all incident markers from the map
 */
function clearIncidentMarkers() {
    Object.values(incidentMarkers).forEach(marker => {
        marker.setMap(null);
    });
    
    incidentMarkers = {};
    incidentInfoWindows = {};
}

/**
 * Display traffic incidents on the map
 */
function displayTrafficIncidents(incidents) {
    incidents.forEach(incident => {
        // Create marker for each incident
        const marker = createIncidentMarker(incident);
        
        // Store marker reference
        incidentMarkers[incident.id] = marker;
        
        // Create info window for the incident
        const infoWindow = createIncidentInfoWindow(incident);
        incidentInfoWindows[incident.id] = infoWindow;
        
        // Add click event to show info window
        marker.addListener('click', () => {
            // Close any open info windows
            Object.values(incidentInfoWindows).forEach(iw => iw.close());
            
            // Open this incident's info window
            infoWindow.open(map, marker);
        });
    });
}

/**
 * Create a marker for a traffic incident
 */
function createIncidentMarker(incident) {
    // Define marker icon based on incident type
    const icons = {
        accident: {
            path: 'M12 2c-4.4 0-8 3.6-8 8 0 3.8 5.3 9.3 7.3 11.7.3.3.7.3 1 0 2-2.3 7.7-7.9 7.7-11.7 0-4.4-3.6-8-8-8zm0 12c-2.2 0-4-1.8-4-4s1.8-4 4-4 4 1.8 4 4-1.8 4-4 4z',
            fillColor: '#ff0000',
            fillOpacity: 1,
            strokeWeight: 1,
            strokeColor: '#ffffff',
            scale: 1.5,
            anchor: new google.maps.Point(12, 17)
        },
        construction: {
            path: 'M19.8 16.7l-9-14c-.4-.6-1.2-.9-1.9-.5l-6 4c-.6.4-.9 1.2-.5 1.9l9 14c.4.6 1.2.9 1.9.5l6-4c.6-.4.9-1.2.5-1.9zM7.5 14.5c-.8 0-1.5-.7-1.5-1.5s.7-1.5 1.5-1.5 1.5.7 1.5 1.5-.7 1.5-1.5 1.5zm3-5c-.8 0-1.5-.7-1.5-1.5s.7-1.5 1.5-1.5 1.5.7 1.5 1.5-.7 1.5-1.5 1.5zm3 5c-.8 0-1.5-.7-1.5-1.5s.7-1.5 1.5-1.5 1.5.7 1.5 1.5-.7 1.5-1.5 1.5z',
            fillColor: '#FFA500',
            fillOpacity: 1,
            strokeWeight: 1,
            strokeColor: '#ffffff',
            scale: 1.5,
            anchor: new google.maps.Point(12, 17)
        },
        closure: {
            path: 'M19 6.4L17.6 5 12 10.6 6.4 5 5 6.4l5.6 5.6L5 17.6 6.4 19l5.6-5.6 5.6 5.6 1.4-1.4-5.6-5.6z',
            fillColor: '#FF0000',
            fillOpacity: 1,
            strokeWeight: 1,
            strokeColor: '#ffffff',
            scale: 1.5,
            anchor: new google.maps.Point(12, 12)
        },
        congestion: {
            path: 'M20 10V7c0-1.1-.9-2-2-2H6c-1.1 0-2 .9-2 2v3c-1.1 0-2 .9-2 2v5h1.3l.7 1.3c.4.7 1.1 1.2 2 1.2s1.6-.5 2-1.2l.7-1.3h7.3l.7 1.3c.4.7 1.1 1.2 2 1.2s1.6-.5 2-1.2l.7-1.3H20v-5c0-1.1-.9-2-2-2zm-4 2H8l-1 2H6V7h10v5h-1l-1 2h-1l-1-2zm-7 5c-.6 0-1-.4-1-1s.4-1 1-1 1 .4 1 1-.4 1-1 1zm12 0c-.6 0-1-.4-1-1s.4-1 1-1 1 .4 1 1-.4 1-1 1z',
            fillColor: '#FFA500',
            fillOpacity: 1,
            strokeWeight: 1,
            strokeColor: '#ffffff',
            scale: 1.5,
            anchor: new google.maps.Point(12, 12)
        },
        other: {
            path: 'M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z',
            fillColor: '#3388ff',
            fillOpacity: 1,
            strokeWeight: 1,
            strokeColor: '#ffffff',
            scale: 1.5,
            anchor: new google.maps.Point(12, 12)
        }
    };
    
    // Get the appropriate icon based on incident type
    const icon = icons[incident.type] || icons.other;
    
    // Create marker
    return new google.maps.Marker({
        position: { lat: incident.latitude, lng: incident.longitude },
        map: isIncidentsVisible ? map : null,
        icon: icon,
        title: incident.title,
        zIndex: 1000
    });
}

/**
 * Create an info window for a traffic incident
 */
function createIncidentInfoWindow(incident) {
    // Format timestamp
    const timestamp = new Date(incident.timestamp);
    const formattedTime = timestamp.toLocaleString();
    
    // Create info window content
    const content = `
        <div class="incident-info-window">
            <h5>${incident.title}</h5>
            <p><strong>Type:</strong> ${incident.type.charAt(0).toUpperCase() + incident.type.slice(1)}</p>
            <p><strong>Reported:</strong> ${formattedTime}</p>
            <p><strong>Severity:</strong> ${incident.severity}/10</p>
            <p>${incident.description}</p>
            ${incident.detour ? `<p><strong>Detour:</strong> ${incident.detour}</p>` : ''}
        </div>
    `;
    
    // Create info window
    return new google.maps.InfoWindow({
        content: content,
        maxWidth: 300
    });
}

/**
 * Create a heatmap layer for traffic density visualization
 */
function createTrafficHeatmap() {
    // Create an array of weighted locations
    const heatmapData = createHeatmapData();
    
    // Create the heatmap layer
    trafficHeatmap = new google.maps.visualization.HeatmapLayer({
        data: heatmapData,
        map: map,
        radius: 30,
        gradient: [
            'rgba(0, 255, 0, 0)',
            'rgba(0, 255, 0, 1)',
            'rgba(255, 255, 0, 1)',
            'rgba(255, 165, 0, 1)',
            'rgba(255, 0, 0, 1)'
        ]
    });
}

/**
 * Create heatmap data points based on traffic incidents and congestion
 */
function createHeatmapData() {
    const heatmapData = [];
    
    // Add data points for incidents, with higher weight for more severe incidents
    trafficIncidents.forEach(incident => {
        heatmapData.push({
            location: new google.maps.LatLng(incident.latitude, incident.longitude),
            weight: incident.severity / 2 // Scale down the weight to avoid dominating the heatmap
        });
    });
    
    // Add data points for simulated traffic congestion in major cities
    const congestionPoints = [
        // Delhi - high congestion
        { lat: 28.7041, lng: 77.1025, weight: 10 },
        { lat: 28.6900, lng: 77.1100, weight: 9 },
        { lat: 28.7100, lng: 77.0900, weight: 8 },
        
        // Mumbai - high congestion
        { lat: 19.0760, lng: 72.8777, weight: 10 },
        { lat: 19.0800, lng: 72.8700, weight: 9 },
        { lat: 19.0700, lng: 72.8850, weight: 8 },
        
        // Bangalore - medium congestion
        { lat: 12.9716, lng: 77.5946, weight: 7 },
        { lat: 12.9800, lng: 77.5900, weight: 6 },
        { lat: 12.9650, lng: 77.6000, weight: 7 },
        
        // Chennai - medium congestion
        { lat: 13.0827, lng: 80.2707, weight: 6 },
        { lat: 13.0900, lng: 80.2800, weight: 5 },
        { lat: 13.0750, lng: 80.2650, weight: 6 },
        
        // Aurangabad - lower congestion
        { lat: 19.8762, lng: 75.3433, weight: 4 },
        { lat: 19.8800, lng: 75.3500, weight: 3 },
        { lat: 19.8700, lng: 75.3400, weight: 4 }
    ];
    
    // Add congestion points to heatmap data
    congestionPoints.forEach(point => {
        heatmapData.push({
            location: new google.maps.LatLng(point.lat, point.lng),
            weight: point.weight
        });
    });
    
    return heatmapData;
}

/**
 * Update the heatmap data based on current traffic conditions
 */
function updateTrafficHeatmapData() {
    if (trafficHeatmap) {
        trafficHeatmap.setData(createHeatmapData());
    }
}

/**
 * Generate simulated traffic incidents for testing
 */
function getSimulatedTrafficIncidents() {
    // Static list of incidents - in a real app, these would come from an API
    return [
        {
            id: 1,
            type: 'accident',
            title: 'Major Accident',
            description: 'Multi-vehicle collision. Emergency services on scene. Expect delays of 30+ minutes.',
            latitude: 19.8900, // Near Aurangabad
            longitude: 75.3500,
            timestamp: new Date().toISOString(),
            severity: 9,
            detour: 'Use Eastern Bypass Road'
        },
        {
            id: 2,
            type: 'construction',
            title: 'Road Repairs',
            description: 'Lane closures due to ongoing road repairs. Work scheduled to complete by end of week.',
            latitude: 19.8700, // Another location in Aurangabad
            longitude: 75.3300,
            timestamp: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
            severity: 6,
            detour: null
        },
        {
            id: 3,
            type: 'closure',
            title: 'Bridge Closed',
            description: 'Bridge closed for structural repairs. No vehicle access until further notice.',
            latitude: 28.7041, // Delhi
            longitude: 77.1025,
            timestamp: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
            severity: 10,
            detour: 'Use Yamuna Bridge'
        },
        {
            id: 4,
            type: 'congestion',
            title: 'Heavy Traffic',
            description: 'Rush hour congestion causing significant delays. All lanes affected.',
            latitude: 19.0760, // Mumbai
            longitude: 72.8777,
            timestamp: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
            severity: 7,
            detour: null
        },
        {
            id: 5,
            type: 'accident',
            title: 'Minor Accident',
            description: 'Two-vehicle collision blocking right lane. Police on scene directing traffic.',
            latitude: 12.9716, // Bangalore
            longitude: 77.5946,
            timestamp: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
            severity: 5,
            detour: null
        },
        {
            id: 6,
            type: 'construction',
            title: 'Major Roadworks',
            description: 'Long-term construction project. Two lanes closed. Significant delays expected during peak hours.',
            latitude: 13.0827, // Chennai
            longitude: 80.2707,
            timestamp: new Date(Date.now() - 604800000).toISOString(), // 1 week ago
            severity: 8,
            detour: 'Use Southern Bypass'
        },
        {
            id: 7,
            type: 'other',
            title: 'Public Event',
            description: 'Large public gathering causing increased pedestrian activity and traffic restrictions.',
            latitude: 19.8762, // Aurangabad
            longitude: 75.3433,
            timestamp: new Date(Date.now() - 10800000).toISOString(), // 3 hours ago
            severity: 4,
            detour: null
        }
    ];
}

// Don't forget to initialize the traffic incidents module when the map is loaded
// This should be called from the main map initialization function
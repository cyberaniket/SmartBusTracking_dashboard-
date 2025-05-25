/**
 * dashboard.js - Handles the dashboard functionality for the Smart Bus Tracking System
 */

// Store dashboard data and state
let dashboardData = {
    activeBuses: 0,
    activeRoutes: 0,
    stops: 0,
    delayedBuses: 0,
    recentActivity: []
};

// Initialize dashboard when document is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('Dashboard initialized');
});

/**
 * Load dashboard data from API
 */
function loadDashboardData() {
    // Load bus data
    fetch('/api/buses')
        .then(response => response.json())
        .then(buses => {
            // Update active buses count
            const activeBuses = buses.filter(bus => bus.latitude && bus.longitude);
            dashboardData.activeBuses = activeBuses.length;
            document.getElementById('active-buses-count').textContent = dashboardData.activeBuses;
            
            // Add buses to the map
            updateBusesOnMap(activeBuses);
            
            // Count delayed buses
            countDelayedBuses(activeBuses);
        })
        .catch(error => {
            console.error('Error loading buses:', error);
            document.getElementById('active-buses-count').textContent = '--';
        });
    
    // Load routes data
    fetch('/api/routes')
        .then(response => response.json())
        .then(routes => {
            dashboardData.activeRoutes = routes.length;
            document.getElementById('active-routes-count').textContent = dashboardData.activeRoutes;
        })
        .catch(error => {
            console.error('Error loading routes:', error);
            document.getElementById('active-routes-count').textContent = '--';
        });
    
    // Load stops data
    fetch('/api/stops')
        .then(response => response.json())
        .then(stops => {
            dashboardData.stops = stops.length;
            document.getElementById('stops-count').textContent = dashboardData.stops;
            
            // Add stops to the map
            updateStopsOnMap(stops);
        })
        .catch(error => {
            console.error('Error loading stops:', error);
            document.getElementById('stops-count').textContent = '--';
        });
    
    // Load recent activity (simulated)
    generateRecentActivity();
}

/**
 * Count and display the number of delayed buses
 */
function countDelayedBuses(buses) {
    // In a real app, we would count buses with delayed ETAs
    // For now, let's simulate it by marking ~20% of buses as delayed
    const delayed = Math.floor(buses.length * 0.2);
    dashboardData.delayedBuses = delayed;
    document.getElementById('delayed-buses-count').textContent = delayed;
}

/**
 * Generate simulated recent activity
 */
function generateRecentActivity() {
    // In a real app, this would come from an API
    const activityContainer = document.getElementById('recent-activity');
    
    // Clear loading spinner
    activityContainer.innerHTML = '';
    
    // Current time
    const now = new Date();
    
    // Sample activities
    const activities = [
        {
            type: 'location_update',
            message: 'Bus 103 location updated',
            icon: 'fas fa-map-marker-alt text-primary',
            time: new Date(now.getTime() - 2 * 60000) // 2 minutes ago
        },
        {
            type: 'delay',
            message: 'Bus 205 delayed by 5 minutes',
            icon: 'fas fa-exclamation-triangle text-warning',
            time: new Date(now.getTime() - 5 * 60000) // 5 minutes ago
        },
        {
            type: 'eta_update',
            message: 'ETAs updated for Route 7',
            icon: 'fas fa-clock text-info',
            time: new Date(now.getTime() - 7 * 60000) // 7 minutes ago
        },
        {
            type: 'system',
            message: 'System connected to MQTT broker',
            icon: 'fas fa-plug text-success',
            time: new Date(now.getTime() - 15 * 60000) // 15 minutes ago
        },
        {
            type: 'route_change',
            message: 'Bus 118 changed to Route 4',
            icon: 'fas fa-route text-primary',
            time: new Date(now.getTime() - 22 * 60000) // 22 minutes ago
        }
    ];
    
    // Add activities to the container
    activities.forEach(activity => {
        const timeStr = formatTimeAgo(activity.time);
        
        const activityItem = document.createElement('div');
        activityItem.className = 'list-group-item';
        activityItem.innerHTML = `
            <div class="d-flex w-100 justify-content-between">
                <div>
                    <i class="${activity.icon} me-2"></i>
                    ${activity.message}
                </div>
                <small class="text-muted">${timeStr}</small>
            </div>
        `;
        
        activityContainer.appendChild(activityItem);
    });
}

/**
 * Format a time as a relative string (e.g., "5 minutes ago")
 */
function formatTimeAgo(time) {
    const now = new Date();
    const diffMs = now - time;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    
    if (diffMin < 1) {
        return 'just now';
    } else if (diffMin < 60) {
        return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
    } else if (diffHour < 24) {
        return `${diffHour} hour${diffHour === 1 ? '' : 's'} ago`;
    } else {
        return time.toLocaleString();
    }
}

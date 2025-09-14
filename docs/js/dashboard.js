(() => {
    console.log('📊 Real-Time Dashboard Loading...');

    // API Configuration
    const API_CONFIG = {
        ngrok: 'https://botalsepaisa-hub-server.onrender.com',
        local: 'http://localhost:6000/api/admin'
    };

    let currentApiBase = null;
    let isRealTimeMode = false;
    let refreshInterval = null;

    // Get working API base
    async function getApiBase() {
        if (currentApiBase) return currentApiBase;

        try {
            // Test ngrok first
            const response = await fetch(`${API_CONFIG.ngrok}/health`, {
                headers: { 'ngrok-skip-browser-warning': 'true' },
                timeout: 5000
            });
            if (response.ok) {
                console.log('✅ Using ngrok API endpoint');
                currentApiBase = API_CONFIG.ngrok;
                return currentApiBase;
            }
        } catch (e) {
            console.log('⚠️ Ngrok not available, trying localhost...');
        }

        try {
            // Test localhost
            const response = await fetch(`${API_CONFIG.local}/health`);
            if (response.ok) {
                console.log('✅ Using local API endpoint');
                currentApiBase = API_CONFIG.local;
                return currentApiBase;
            }
        } catch (e) {
            console.log('⚠️ Localhost not available');
        }

        throw new Error('No API endpoints available');
    }

    // Test API connection
    async function testAPIConnection() {
        try {
            console.log('🔄 Testing API connection...');

            const apiBase = await getApiBase();
            const response = await fetch(`${apiBase}/health`);
            const result = await response.json();

            if (response.ok && result.success) {
                console.log('✅ API Connected:', result);
                isRealTimeMode = true;
                await initRealTimeDashboard();
                return true;
            }
        } catch (error) {
            console.log('⚠️ API not available:', error.message);
            isRealTimeMode = false;
            initDemoMode();
            return false;
        }
    }

    // Real-time dashboard with MongoDB data
    async function initRealTimeDashboard() {
        console.log('🚀 Starting real-time dashboard...');

        try {
            await fetchAndUpdateDashboard();

            // Setup auto-refresh every 15 seconds
            refreshInterval = setInterval(fetchAndUpdateDashboard, 15000);

            // Add connection status indicator
            updateConnectionStatus('connected');

            console.log('✅ Real-time dashboard active');

        } catch (error) {
            console.error('❌ Real-time dashboard failed:', error);
            initDemoMode();
        }
    }

    // Fetch and update dashboard data
    async function fetchAndUpdateDashboard() {
        try {
            const apiBase = await getApiBase();
            const response = await fetch(`${apiBase}/dashboard-stats`, {
                headers: {
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': 'true'
                }
            });

            const result = await response.json();

            if (response.ok && result.success) {
                const data = result.data;

                // Update main KPIs
                updateElement('kpi-bottles-today .kpi-value', data.approvedToday || 0);
                updateElement('kpi-pickups .kpi-value', data.pendingRequests || 0);
                updateElement('kpi-partners-total .kpi-value', data.totalUsers || 0);

                // Update quick stats
                updateElement('scans-today', data.approvedToday || 0);
                updateElement('last-scan', `Updated: ${data.lastUpdated}`);

                // Update revenue (if you have this element)
                updateElement('revenue-today', `₹${data.totalRevenueToday || 0}`);

                // Update activity feed
                updateActivityFeed(data.recentActivity || []);

                // Update pickup list with pending bottles
                updatePickupList(data.pendingRequests || 0);

                console.log('🔄 Dashboard updated with real data:', data);

            } else {
                throw new Error('API response failed');
            }

        } catch (error) {
            console.error('❌ Dashboard update failed:', error);
            updateConnectionStatus('error');
        }
    }

    // Update activity feed with real data
    function updateActivityFeed(activities) {
        const activityList = document.getElementById('activity-list');
        if (!activityList) return;

        if (activities.length === 0) {
            activityList.innerHTML = `
                <li class="activity-item">
                    <span class="time">--:--</span>
                    <span class="text">No recent activity</span>
                </li>
            `;
            return;
        }

        const activityHTML = activities.map(activity => {
            const typeClass = activity.type === 'approved' ? 'success' : 'warning';
            return `
                <li class="activity-item ${typeClass}">
                    <span class="time">${activity.time}</span>
                    <span class="text">${activity.text}</span>
                </li>
            `;
        }).join('');

        activityList.innerHTML = activityHTML;
    }

    // Update pickup list
    function updatePickupList(pendingCount) {
        const pickupList = document.getElementById('pickup-list');
        if (!pickupList) return;

        if (pendingCount === 0) {
            pickupList.innerHTML = `
                <li class="pickup">
                    <div class="meta">
                        <div class="name">No Pending Verifications</div>
                        <div class="sub">All bottles processed</div>
                    </div>
                    <span class="badge green">Complete</span>
                </li>
            `;
        } else {
            const pickupHTML = Array.from({ length: Math.min(pendingCount, 5) }, (_, i) => `
                <li class="pickup">
                    <div class="meta">
                        <div class="name">Bottle Verification #${i + 1}</div>
                        <div class="sub">Awaiting admin approval</div>
                    </div>
                    <span class="badge amber">Pending</span>
                </li>
            `).join('');

            pickupList.innerHTML = pickupHTML;
        }
    }

    // Update connection status indicator
    function updateConnectionStatus(status) {
        let statusText = '';
        let statusClass = '';

        switch (status) {
            case 'connected':
                statusText = '🟢 Real-time data active';
                statusClass = 'connected';
                break;
            case 'error':
                statusText = '🟠 Connection issues';
                statusClass = 'warning';
                break;
            case 'demo':
                statusText = '🔵 Demo mode';
                statusClass = 'demo';
                break;
        }

        // Update status indicator if it exists
        const statusIndicator = document.getElementById('connection-status');
        if (statusIndicator) {
            statusIndicator.textContent = statusText;
            statusIndicator.className = `connection-status ${statusClass}`;
        }

        // Update page title to show mode
        document.title = isRealTimeMode ?
            'Admin Dashboard | Botalsepaisa (Live)' :
            'Admin Dashboard | Botalsepaisa (Demo)';
    }

    // Demo mode fallback
    function initDemoMode() {
        console.log('📊 Loading demo dashboard...');

        const demoData = {
            approvedToday: 126,
            pendingRequests: 5,
            totalUsers: 45,
            totalRevenueToday: 126,
            lastUpdated: new Date().toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            })
        };

        // Update with demo data
        updateElement('kpi-bottles-today .kpi-value', demoData.approvedToday);
        updateElement('kpi-pickups .kpi-value', demoData.pendingRequests);
        updateElement('kpi-partners-total .kpi-value', demoData.totalUsers);
        updateElement('scans-today', demoData.approvedToday);
        updateElement('last-scan', `Demo: ${demoData.lastUpdated}`);
        updateElement('revenue-today', `₹${demoData.totalRevenueToday}`);

        loadDemoContent();
        updateConnectionStatus('demo');

        console.log('✅ Demo dashboard loaded');
    }

    // Load demo content
    function loadDemoContent() {
        // Demo activity
        const activityList = document.getElementById('activity-list');
        if (activityList) {
            const now = new Date();
            activityList.innerHTML = `
                <li class="activity-item success">
                    <span class="time">${new Date(now - 2 * 60000).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                    <span class="text">Demo: Approved bottle ABC123... (+₹1.00)</span>
                </li>
                <li class="activity-item success">
                    <span class="time">${new Date(now - 5 * 60000).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                    <span class="text">Demo: Approved bottle DEF456... (+₹1.00)</span>
                </li>
                <li class="activity-item warning">
                    <span class="time">${new Date(now - 10 * 60000).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                    <span class="text">Demo: Rejected bottle XYZ789...</span>
                </li>
            `;
        }

        // Demo pickups
        updatePickupList(5);

        // Demo partners
        const partnerList = document.getElementById('partner-list');
        if (partnerList) {
            partnerList.innerHTML = `
                <li class="partner">
                    <span class="dot green"></span>
                    <div class="meta">
                        <div class="name">Admin System</div>
                        <div class="sub">Demo Mode Active</div>
                    </div>
                    <button class="mini-btn demo">Demo</button>
                </li>
            `;
        }
    }

    // Helper function to safely update elements
    function updateElement(selector, value) {
        try {
            const element = document.querySelector(`#${selector}`) ||
                document.querySelector(`.${selector}`) ||
                document.getElementById(selector);

            if (element) {
                element.textContent = value;
            }
        } catch (error) {
            console.log(`Error updating ${selector}:`, error.message);
        }
    }

    // Manual refresh function
    window.refreshDashboard = async () => {
        console.log('🔄 Manual refresh triggered');
        if (isRealTimeMode) {
            await fetchAndUpdateDashboard();
        } else {
            initDemoMode();
        }
    };

    // Initialize dashboard
    async function init() {
        console.log('📊 Initializing Dashboard...');

        // Wait for DOM
        if (document.readyState === 'loading') {
            await new Promise(resolve => {
                document.addEventListener('DOMContentLoaded', resolve);
            });
        }

        // Test API and load appropriate mode
        await testAPIConnection();

        console.log('✅ Dashboard initialization complete');
    }

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        if (refreshInterval) {
            clearInterval(refreshInterval);
        }
    });

    // Start initialization
    init();
})();

// Configuration
const API_CONFIG = {
    ngrok: 'https://botalsepaisa-hub-server.onrender.com',
    local: 'http://localhost:6000/api/admin'
};

let currentApiBase = null;
let currentPage = 1;
let totalPages = 1;
let currentFilters = {};
let allBottles = [];

// Get working API base
async function getApiBase() {
    if (currentApiBase) return currentApiBase;

    try {
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

// Load bottle history from API
async function loadBottleHistory(page = 1, filters = {}) {
    try {
        showLoadingState();

        const apiBase = await getApiBase();

        // Build query parameters
        const params = new URLSearchParams({
            page: page,
            limit: 50,
            ...filters
        });

        console.log(`📊 Loading history: page ${page}`, filters);

        const response = await fetch(`${apiBase}/all-bottles-history?${params}`, {
            headers: {
                'Authorization': 'Bearer admin123',
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true'
            }
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        if (data.success) {
            allBottles = data.bottles;
            displayBottleHistory(data.bottles);
            updatePagination(data.pagination);
            updateStatistics(data.bottles);
            updateRecordCount(data.pagination.totalBottles);

            console.log('✅ History loaded successfully:', data.bottles.length, 'records');
        } else {
            throw new Error(data.message || 'Failed to load history');
        }

    } catch (error) {
        console.error('❌ Error loading history:', error);
        showError(error.message);

        // Fallback to demo data
        setTimeout(() => {
            loadDemoData();
        }, 2000);
    }
}

// Display bottle history in table
function displayBottleHistory(bottles) {
    const tbody = document.getElementById('history-tbody');

    if (bottles.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="no-data">
                    <div class="no-data-icon">📋</div>
                    <h3>No verification records found</h3>
                    <p>Try adjusting your filters or check if bottles have been scanned.</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = bottles.map(bottle => {
        const statusClass = bottle.status;
        const statusIcon = bottle.status === 'completed' ? '✅' :
            bottle.status === 'pending' ? '⏳' : '❌';

        const scannedTime = formatDateTime(bottle.scannedAt);
        const processedTime = bottle.approvedAt || bottle.rejectedAt ?
            formatDateTime(bottle.approvedAt || bottle.rejectedAt) :
            '<span style="color: var(--text-muted);">Not processed</span>';

        const processingTime = bottle.processingTimeMinutes ?
            `${bottle.processingTimeMinutes}m` :
            '<span style="color: var(--text-muted);">N/A</span>';

        const truncatedQR = bottle.qrCode.length > 15 ?
            bottle.qrCode.substring(0, 15) + '...' : bottle.qrCode;

        return `
            <tr>
                <td>
                    <span class="qr-code" title="${bottle.qrCode}">${truncatedQR}</span>
                </td>
                <td><strong>${bottle.userId}</strong></td>
                <td>
                    <span class="status-badge ${statusClass}">
                        ${statusIcon} ${bottle.status}
                    </span>
                </td>
                <td>
                    <span class="reward">₹${bottle.reward.toFixed(2)}</span>
                </td>
                <td>${scannedTime}</td>
                <td>${processedTime}</td>
                <td>${processingTime}</td>
                <td>${bottle.approvedBy || '<span style="color: var(--text-muted);">N/A</span>'}</td>
                <td>
                    <button class="btn" style="padding: 0.3rem 0.8rem; font-size: 0.8rem;" 
                            onclick="viewBottleDetails('${bottle.qrCode}')" 
                            title="View detailed history">
                        👁️ View
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Format date and time for display
function formatDateTime(dateString) {
    if (!dateString) return 'N/A';

    const date = new Date(dateString);
    return date.toLocaleString('en-IN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
}

// Update statistics cards
function updateStatistics(bottles) {
    const stats = {
        total: bottles.length,
        completed: bottles.filter(b => b.status === 'completed').length,
        pending: bottles.filter(b => b.status === 'pending').length,
        rejected: bottles.filter(b => b.status === 'rejected').length,
        revenue: bottles.filter(b => b.status === 'completed')
            .reduce((sum, b) => sum + b.reward, 0)
    };

    // Animate counter updates
    animateCounter('total-bottles', stats.total);
    animateCounter('completed-bottles', stats.completed);
    animateCounter('pending-bottles', stats.pending);
    animateCounter('rejected-bottles', stats.rejected);

    document.getElementById('total-revenue').textContent = `₹${stats.revenue.toFixed(2)}`;

    console.log('📊 Statistics updated:', stats);
}

// Animate counter values
function animateCounter(elementId, targetValue) {
    const element = document.getElementById(elementId);
    const currentValue = parseInt(element.textContent) || 0;
    const difference = targetValue - currentValue;
    const duration = 500; // ms
    const steps = 20;
    const stepValue = difference / steps;
    const stepDuration = duration / steps;

    let currentStep = 0;
    const interval = setInterval(() => {
        currentStep++;
        const newValue = Math.round(currentValue + (stepValue * currentStep));
        element.textContent = newValue;

        if (currentStep >= steps) {
            element.textContent = targetValue;
            clearInterval(interval);
        }
    }, stepDuration);
}

// Update pagination controls
function updatePagination(pagination) {
    currentPage = pagination.currentPage;
    totalPages = pagination.totalPages;

    document.getElementById('page-info').textContent =
        `Page ${currentPage} of ${totalPages}`;

    document.getElementById('prev-btn').disabled = !pagination.hasPrev;
    document.getElementById('next-btn').disabled = !pagination.hasNext;
}

// Update record count display
function updateRecordCount(total) {
    document.getElementById('record-count').textContent =
        `${total.toLocaleString()} total records`;
}

// Apply filters
function applyFilters() {
    const filters = {};

    const status = document.getElementById('status-filter').value;
    const userId = document.getElementById('user-filter').value.trim();
    const qrSearch = document.getElementById('qr-search').value.trim();

    if (status) filters.status = status;
    if (userId) filters.userId = userId;
    // Note: QR search would need backend implementation

    currentFilters = filters;
    currentPage = 1;

    console.log('🔍 Applying filters:', filters);
    loadBottleHistory(currentPage, filters);
}

// Clear all filters
function clearFilters() {
    document.getElementById('status-filter').value = '';
    document.getElementById('user-filter').value = '';
    document.getElementById('qr-search').value = '';

    currentFilters = {};
    currentPage = 1;

    console.log('🗑️ Filters cleared');
    loadBottleHistory(currentPage, currentFilters);
}

// Pagination functions
function nextPage() {
    if (currentPage < totalPages) {
        currentPage++;
        loadBottleHistory(currentPage, currentFilters);
    }
}

function previousPage() {
    if (currentPage > 1) {
        currentPage--;
        loadBottleHistory(currentPage, currentFilters);
    }
}

// View bottle details (can be enhanced with modal)
function viewBottleDetails(qrCode) {
    // For now, show an alert. You can replace this with a modal or redirect
    const bottle = allBottles.find(b => b.qrCode === qrCode);

    if (bottle) {
        const details = `
📋 BOTTLE DETAILS

🔖 QR Code: ${bottle.qrCode}
👤 User ID: ${bottle.userId}
📊 Status: ${bottle.status}
💰 Reward: ₹${bottle.reward}
📅 Scanned: ${formatDateTime(bottle.scannedAt)}
✅ Processed: ${formatDateTime(bottle.approvedAt || bottle.rejectedAt) || 'Not processed'}
⏱️ Processing Time: ${bottle.processingTimeMinutes ? bottle.processingTimeMinutes + ' minutes' : 'N/A'}
👨‍💼 Admin: ${bottle.approvedBy || 'N/A'}
${bottle.rejectionReason ? '❌ Rejection Reason: ' + bottle.rejectionReason : ''}
        `.trim();

        alert(details);
    } else {
        alert('Bottle details not found');
    }
}

// Export data to CSV
function exportData() {
    if (allBottles.length === 0) {
        alert('❌ No data to export');
        return;
    }

    console.log('📥 Exporting', allBottles.length, 'records to CSV');

    const csvContent = [
        // Header
        [
            'QR Code',
            'User ID',
            'Status',
            'Reward',
            'Scanned At',
            'Processed At',
            'Processing Time (min)',
            'Admin',
            'Rejection Reason'
        ].join(','),
        // Data rows
        ...allBottles.map(bottle => [
            `"${bottle.qrCode}"`,
            `"${bottle.userId}"`,
            bottle.status,
            bottle.reward,
            bottle.scannedAt ? new Date(bottle.scannedAt).toISOString() : '',
            bottle.approvedAt || bottle.rejectedAt ?
                new Date(bottle.approvedAt || bottle.rejectedAt).toISOString() : '',
            bottle.processingTimeMinutes || '',
            `"${bottle.approvedBy || ''}"`,
            `"${bottle.rejectionReason || ''}"`
        ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bottle-history-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    console.log('✅ CSV export completed');
}

// Show loading state
function showLoadingState() {
    const tbody = document.getElementById('history-tbody');
    tbody.innerHTML = `
        <tr>
            <td colspan="9" class="loading">
                <div class="loading-spinner"></div>
                Loading verification history...
            </td>
        </tr>
    `;
}

// Show error message
function showError(message) {
    const tbody = document.getElementById('history-tbody');
    tbody.innerHTML = `
        <tr>
            <td colspan="9">
                <div class="error-message">
                    <strong>❌ Error loading data:</strong> ${message}
                    <br><br>
                    <em>Switching to demo mode in 2 seconds...</em>
                </div>
            </td>
        </tr>
    `;
}

// Load demo data as fallback
function loadDemoData() {
    console.log('📊 Loading demo data...');

    const now = Date.now();
    const demoBottles = [
        {
            qrCode: 'BSP_S_1757757154964_1',
            userId: 'user123',
            status: 'completed',
            reward: 1.00,
            scannedAt: new Date(now - 3600000),
            approvedAt: new Date(now - 3000000),
            processingTimeMinutes: 10,
            approvedBy: 'admin1'
        },
        {
            qrCode: 'BSP_S_1757757154964_2',
            userId: 'user456',
            status: 'pending',
            reward: 1.00,
            scannedAt: new Date(now - 1800000),
            processingTimeMinutes: null,
            approvedBy: null
        },
        {
            qrCode: 'BSP_S_1757757154964_3',
            userId: 'user789',
            status: 'rejected',
            reward: 0,
            scannedAt: new Date(now - 7200000),
            rejectedAt: new Date(now - 6600000),
            processingTimeMinutes: 10,
            approvedBy: 'admin1',
            rejectionReason: 'Physical bottle not received'
        },
        {
            qrCode: 'BSP_S_1757757154964_4',
            userId: 'user101',
            status: 'completed',
            reward: 1.00,
            scannedAt: new Date(now - 10800000),
            approvedAt: new Date(now - 10200000),
            processingTimeMinutes: 10,
            approvedBy: 'admin2'
        },
        {
            qrCode: 'BSP_S_1757757154964_5',
            userId: 'user202',
            status: 'completed',
            reward: 1.00,
            scannedAt: new Date(now - 14400000),
            approvedAt: new Date(now - 13800000),
            processingTimeMinutes: 10,
            approvedBy: 'admin1'
        }
    ];

    allBottles = demoBottles;
    displayBottleHistory(demoBottles);
    updateStatistics(demoBottles);
    updateRecordCount(demoBottles.length);

    // Demo pagination
    updatePagination({
        currentPage: 1,
        totalPages: 1,
        totalBottles: demoBottles.length,
        hasNext: false,
        hasPrev: false
    });

    console.log('✅ Demo data loaded');
}

// Setup event listeners
function setupEventListeners() {
    // Filter controls
    document.getElementById('status-filter').addEventListener('change', applyFilters);

    document.getElementById('user-filter').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            applyFilters();
        }
    });

    document.getElementById('qr-search').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            applyFilters();
        }
    });

    // Add clear filters functionality (optional)
    const clearBtn = document.createElement('button');
    clearBtn.className = 'btn secondary';
    clearBtn.innerHTML = '🗑️ Clear Filters';
    clearBtn.onclick = clearFilters;

    // Find a place to add the clear button (you can modify HTML to include it)
    console.log('📝 Event listeners setup complete');
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    console.log('📊 Initializing Bottle Verification History...');

    setupEventListeners();
    loadBottleHistory();

    console.log('✅ History page initialized');
});

// Refresh data function (can be called externally)
function refreshData() {
    console.log('🔄 Manual refresh triggered');
    loadBottleHistory(currentPage, currentFilters);
}

// Make functions globally available for onclick handlers
window.applyFilters = applyFilters;
window.exportData = exportData;
window.nextPage = nextPage;
window.previousPage = previousPage;
window.viewBottleDetails = viewBottleDetails;
window.refreshData = refreshData;

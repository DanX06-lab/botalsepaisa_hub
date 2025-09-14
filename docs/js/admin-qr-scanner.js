(() => {
    console.log('📱 Smart Admin QR Scanner with New Workflow...');

    let html5QrCode = null;
    let isScanning = false;
    let stats = { pending: 5, verified: 98 };

    // API Configuration
    const API_CONFIG = {
        ngrok: 'https://c7c917092226.ngrok-free.app/api/admin',
        local: 'http://localhost:6000/api/admin'
    };
    let currentApiBase = null;

    // Get working API base
    async function getApiBase() {
        if (currentApiBase) return currentApiBase;
        
        try {
            const response = await fetch(`${API_CONFIG.ngrok}/health`, {
                headers: { 'ngrok-skip-browser-warning': 'true' }
            });
            if (response.ok) {
                currentApiBase = API_CONFIG.ngrok;
                return currentApiBase;
            }
        } catch (e) {
            console.log('Ngrok not available, trying localhost...');
        }
        
        try {
            const response = await fetch(`${API_CONFIG.local}/health`);
            if (response.ok) {
                currentApiBase = API_CONFIG.local;
                return currentApiBase;
            }
        } catch (e) {
            console.log('Localhost not available');
        }
        
        throw new Error('No API endpoints available');
    }

    // Update stats safely
    function updateStats() {
        const pendingEl = document.getElementById('pending-status');
        const verifiedEl = document.getElementById('verified-status');
        
        if (pendingEl) pendingEl.textContent = stats.pending;
        if (verifiedEl) verifiedEl.textContent = stats.verified;
    }

    // Update status safely
    function updateStatus(message) {
        const statusEl = document.getElementById('scan-status');
        if (statusEl) {
            statusEl.textContent = message;
        }
        console.log('Status:', message);
    }

    // 🧹 CLEAN RESET with null checks
    async function cleanReset() {
        try {
            if (html5QrCode) {
                try {
                    if (isScanning) {
                        await html5QrCode.stop();
                    }
                    await html5QrCode.clear();
                } catch (e) {
                    console.log('Cleanup error (ignored):', e.message);
                }
            }
            
            html5QrCode = null;
            isScanning = false;
            
            const qrReader = document.getElementById('qr-reader');
            if (qrReader) {
                const videos = qrReader.querySelectorAll('video');
                videos.forEach(video => {
                    try {
                        if (video.srcObject) {
                            video.srcObject = null;
                        }
                        video.remove();
                    } catch (e) {
                        console.log('Video cleanup error:', e.message);
                    }
                });
                
                const canvases = qrReader.querySelectorAll('canvas');
                canvases.forEach(canvas => {
                    try {
                        canvas.remove();
                    } catch (e) {
                        console.log('Canvas cleanup error:', e.message);
                    }
                });
            }
            
            console.log('✅ Clean reset completed');
            
        } catch (error) {
            console.log('Reset error (ignored):', error.message);
        }
    }

    // 🚀 Start camera
    async function startCamera() {
        try {
            updateStatus('🚀 Starting camera...');
            
            await cleanReset();
            await new Promise(resolve => setTimeout(resolve, 500));
            
            if (typeof Html5Qrcode === 'undefined') {
                throw new Error('QR Scanner library not loaded');
            }

            const cameras = await Html5Qrcode.getCameras();
            if (!cameras || cameras.length === 0) {
                throw new Error('No cameras found');
            }

            html5QrCode = new Html5Qrcode("qr-reader");
            
            const configs = [
                { facingMode: "environment" },
                { facingMode: "user" },
                cameras[0].id
            ];

            let started = false;
            for (let config of configs) {
                try {
                    await html5QrCode.start(
                        config,
                        { fps: 10, qrbox: 250 },
                        onScanSuccess,
                        () => {} // Silent errors
                    );
                    started = true;
                    console.log('✅ Camera started');
                    break;
                } catch (err) {
                    console.log('Config failed:', err.message);
                    continue;
                }
            }

            if (!started) {
                throw new Error('All camera configs failed');
            }

            // Update UI safely
            isScanning = true;
            
            const placeholder = document.getElementById('scanner-placeholder');
            const controls = document.getElementById('scanner-controls');
            
            if (placeholder) placeholder.style.display = 'none';
            if (controls) controls.style.display = 'flex';
            
            updateStatus('🎯 Camera ready! Point at bottle QR code');
            
        } catch (error) {
            console.error('❌ Camera start failed:', error);
            updateStatus(`❌ Camera failed: ${error.message}`);
            setTimeout(() => switchToUpload(), 3000);
        }
    }

    // ⏹️ Stop camera
    async function stopCamera() {
        try {
            updateStatus('⏹️ Stopping camera...');
            await cleanReset();
            
            const placeholder = document.getElementById('scanner-placeholder');
            const controls = document.getElementById('scanner-controls');
            
            if (placeholder) placeholder.style.display = 'block';
            if (controls) controls.style.display = 'none';
            
            updateStatus('⏹️ Camera stopped');
            
        } catch (error) {
            console.error('Stop error:', error);
            isScanning = false;
            html5QrCode = null;
        }
    }

    // 🎯 NEW WORKFLOW: Smart QR Status Checking
    async function onScanSuccess(qrCode) {
        console.log('🎯 Admin scanned:', qrCode);
        
        // Stop camera when QR detected
        if (isScanning) {
            try {
                await html5QrCode.stop();
                isScanning = false;
                console.log('📷 Camera stopped after scan');
            } catch (error) {
                console.log('Stop after scan error:', error.message);
                isScanning = false;
            }
        }
        
        updateStatus('🔍 Checking QR status...');
        
        // Check QR status in database
        try {
            const apiBase = await getApiBase();
            const response = await fetch(`${apiBase}/check-qr-status`, {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer admin123',
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': 'true'
                },
                body: JSON.stringify({ qrCode })
            });
            
            const result = await response.json();
            
            if (result.success) {
                const bottle = result.bottle;
                
                if (bottle.status === 'pending') {
                    // ✅ ADMIN CAN VERIFY - Show popup
                    updateStatus('✅ Pending bottle found!');
                    showBottleConfirmationPopup(qrCode, bottle);
                } else if (bottle.status === 'completed') {
                    // ❌ ALREADY APPROVED
                    updateStatus('❌ Already processed');
                    const approvedDate = new Date(bottle.approvedAt).toLocaleDateString('en-IN');
                    showMessage('❌ Already Processed', `This bottle was already approved on ${approvedDate} and user has been rewarded ${bottle.rewardText}.`);
                    restartCameraAfterDelay();
                } else if (bottle.status === 'rejected') {
                    // ❌ ALREADY REJECTED
                    updateStatus('❌ Already rejected'); 
                    const rejectedDate = new Date(bottle.rejectedAt).toLocaleDateString('en-IN');
                    const reason = bottle.rejectionReason || 'No reason provided';
                    showMessage('❌ Already Rejected', `This bottle was rejected on ${rejectedDate}.\nReason: ${reason}`);
                    restartCameraAfterDelay();
                }
            } else {
                // ❌ QR NOT FOUND - User hasn't scanned it yet
                updateStatus('❌ QR not found');
                showMessage('❌ QR Not Scanned Yet', 'This QR code has not been scanned by any user yet. The user must scan it first to create a verification request.');
                restartCameraAfterDelay();
            }
            
        } catch (error) {
            console.error('QR status check error:', error);
            updateStatus('❌ Error checking QR');
            showMessage('❌ Network Error', 'Unable to check QR status. Please check your connection and try again.');
            restartCameraAfterDelay();
        }
    }

    // Show message popup (for errors/info)
    function showMessage(title, message) {
        alert(`${title}\n\n${message}`);
    }

    // Restart camera after delay
    function restartCameraAfterDelay() {
        setTimeout(() => {
            updateStatus('🔄 Restarting camera...');
            startCamera();
        }, 3000);
    }

    // 🧴 UPDATED Bottle confirmation popup with bottle info
    function showBottleConfirmationPopup(qrCode, bottle) {
        updateStatus('🧴 Confirming bottle receipt...');
        
        const popup = document.createElement('div');
        popup.id = 'bottle-confirmation-popup';
        popup.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            backdrop-filter: blur(5px);
        `;

        const displayQR = qrCode.length > 30 ? qrCode.substring(0, 30) + '...' : qrCode;
        const rewardText = bottle.rewardText || `₹${bottle.reward}`;
        
        popup.innerHTML = `
            <div style="
                background: #0f1f2e;
                border-radius: 16px;
                padding: 2rem;
                max-width: 400px;
                width: 90%;
                text-align: center;
                border: 2px solid #f59e0b;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.7);
                color: #e5e7eb;
                font-family: 'Montserrat', sans-serif;
            ">
                <div style="margin-bottom: 1.5rem;">
                    <div style="font-size: 3rem; margin-bottom: 0.5rem;">🧴</div>
                    <h2 style="color: #f59e0b; margin-bottom: 1rem;">Bottle Verification</h2>
                    
                    <div style="background: rgba(245, 158, 11, 0.1); padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; border-left: 4px solid #f59e0b;">
                        <p style="margin: 0.5rem 0;"><strong>QR:</strong> ${displayQR}</p>
                        <p style="margin: 0.5rem 0;"><strong>User:</strong> ${bottle.userId}</p>
                        <p style="margin: 0.5rem 0;"><strong>User Name:</strong> ${bottle.userName}</p>
                        <p style="margin: 0.5rem 0;"><strong>Reward:</strong> ${rewardText}</p>
                        <p style="margin: 0.5rem 0;"><strong>Scanned:</strong> ${new Date(bottle.scannedAt).toLocaleString('en-IN')}</p>
                    </div>
                    
                    <h3 style="margin-bottom: 1.5rem;">🤝 Did you receive the physical bottle?</h3>
                </div>
                
                <div style="display: flex; gap: 1rem;">
                    <button id="approve-btn" style="
                        flex: 1;
                        background: linear-gradient(135deg, #10b981, #059669);
                        color: white;
                        border: none;
                        padding: 1rem 1.5rem;
                        border-radius: 8px;
                        font-weight: 700;
                        cursor: pointer;
                        font-family: 'Montserrat', sans-serif;
                    ">✅ YES - Give ${rewardText}</button>
                    
                    <button id="reject-btn" style="
                        flex: 1;
                        background: linear-gradient(135deg, #ef4444, #dc2626);
                        color: white;
                        border: none;
                        padding: 1rem 1.5rem;
                        border-radius: 8px;
                        font-weight: 700;
                        cursor: pointer;
                        font-family: 'Montserrat', sans-serif;
                    ">❌ NO - Reject</button>
                </div>
            </div>
        `;

        document.body.appendChild(popup);

        // Button events
        const approveBtn = document.getElementById('approve-btn');
        const rejectBtn = document.getElementById('reject-btn');
        
        if (approveBtn) {
            approveBtn.onclick = () => {
                removePopup();
                approveBottle(qrCode);
            };
        }
        
        if (rejectBtn) {
            rejectBtn.onclick = () => {
                removePopup();
                rejectBottle(qrCode);
            };
        }

        function removePopup() {
            const popupEl = document.getElementById('bottle-confirmation-popup');
            if (popupEl) {
                popupEl.remove();
            }
        }
    }

    // ✅ UPDATED Approve bottle with API call
    async function approveBottle(qrCode) {
        try {
            updateStatus('✅ Processing approval...');
            
            const apiBase = await getApiBase();
            const response = await fetch(`${apiBase}/approve-bottle`, {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer admin123',
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': 'true'
                },
                body: JSON.stringify({ qrCode, adminId: 'admin1' })
            });
            
            const result = await response.json();
            
            if (result.success) {
                stats.verified++;
                stats.pending = Math.max(0, stats.pending - 1);
                updateStats();
                addRecentScan(qrCode, 'approved');
                updateStatus(`🎉 Approved! ${result.bottle.rewardText} sent to user`);
                
                console.log('✅ Bottle approved successfully:', result);
            } else {
                throw new Error(result.message || 'Approval failed');
            }
            
        } catch (error) {
            console.error('Approval error:', error);
            updateStatus('❌ Approval failed');
            showMessage('❌ Approval Error', error.message || 'Failed to approve bottle. Please try again.');
        }
        
        // Restart camera after processing
        setTimeout(() => {
            updateStatus('🔄 Restarting camera...');
            startCamera();
        }, 2000);
    }

    // ❌ UPDATED Reject bottle with API call
    async function rejectBottle(qrCode) {
        try {
            updateStatus('❌ Processing rejection...');
            
            const apiBase = await getApiBase();
            const response = await fetch(`${apiBase}/reject-bottle`, {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer admin123',
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': 'true'
                },
                body: JSON.stringify({ 
                    qrCode, 
                    adminId: 'admin1',
                    reason: 'Physical bottle not received'
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                stats.pending = Math.max(0, stats.pending - 1);
                updateStats();
                addRecentScan(qrCode, 'rejected');
                updateStatus('❌ Request rejected');
                
                console.log('❌ Bottle rejected successfully:', result);
            } else {
                throw new Error(result.message || 'Rejection failed');
            }
            
        } catch (error) {
            console.error('Rejection error:', error);
            updateStatus('❌ Rejection failed');
            showMessage('❌ Rejection Error', error.message || 'Failed to reject bottle. Please try again.');
        }
        
        // Restart camera after processing
        setTimeout(() => {
            updateStatus('🔄 Restarting camera...');
            startCamera();
        }, 2000);
    }

    // Add to recent scans - safe access
    function addRecentScan(qrCode, status) {
        const recentDiv = document.getElementById('recent-scans');
        if (!recentDiv) return;
        
        if (recentDiv.textContent.includes('Recent QR')) {
            recentDiv.innerHTML = '';
        }

        const item = document.createElement('div');
        item.className = `recent-item ${status}`;
        item.innerHTML = `
            <span class="recent-qr">${qrCode.substring(0, 20)}...</span>
            <span class="recent-status ${status}">${status === 'approved' ? '✅ Approved' : '❌ Rejected'}</span>
            <span class="recent-time">${new Date().toLocaleTimeString('en-IN', { hour12: true })}</span>
        `;
        
        recentDiv.insertBefore(item, recentDiv.firstChild);
        
        while (recentDiv.children.length > 5) {
            recentDiv.removeChild(recentDiv.lastChild);
        }
    }

    // Mode switching - safe access
    function switchToCamera() {
        const cameraBtn = document.getElementById('camera-mode-btn');
        const uploadBtn = document.getElementById('upload-mode-btn');
        const uploadSection = document.getElementById('upload-section');
        
        if (cameraBtn) cameraBtn.classList.add('active');
        if (uploadBtn) uploadBtn.classList.remove('active');
        if (uploadSection) uploadSection.style.display = 'none';
        
        if (!isScanning) {
            startCamera();
        }
    }

    function switchToUpload() {
        const cameraBtn = document.getElementById('camera-mode-btn');
        const uploadBtn = document.getElementById('upload-mode-btn');
        const uploadSection = document.getElementById('upload-section');
        
        if (uploadBtn) uploadBtn.classList.add('active');
        if (cameraBtn) cameraBtn.classList.remove('active');
        if (uploadSection) uploadSection.style.display = 'block';
        
        if (isScanning) {
            stopCamera();
        }
        
        updateStatus('📁 Select QR image file');
    }

    // File upload - safe access
    async function scanFile(file) {
        try {
            updateStatus('🔍 Scanning image...');
            
            const tempScanner = new Html5Qrcode("qr-reader");
            const result = await tempScanner.scanFile(file, true);
            
            updateStatus('✅ QR found in image!');
            
            // Use same workflow for file scans
            onScanSuccess(result);
            
        } catch (error) {
            updateStatus('❌ No QR code found in image');
        }
    }

    // Setup events - safe access
    function setupEvents() {
        const cameraBtn = document.getElementById('camera-mode-btn');
        const uploadBtn = document.getElementById('upload-mode-btn');
        const stopBtn = document.getElementById('stop-camera');
        
        if (cameraBtn) cameraBtn.onclick = switchToCamera;
        if (uploadBtn) uploadBtn.onclick = switchToUpload;
        if (stopBtn) stopBtn.onclick = stopCamera;
        
        const fileInput = document.getElementById('qr-file-input');
        const fileInfo = document.getElementById('file-info');
        const fileName = document.getElementById('file-name');
        const scanBtn = document.getElementById('scan-file-btn');
        
        if (fileInput) {
            fileInput.onchange = (e) => {
                if (e.target.files[0] && fileName && fileInfo) {
                    fileName.textContent = e.target.files[0].name;
                    fileInfo.style.display = 'block';
                    updateStatus('📁 Ready to scan');
                }
            };
        }
        
        if (scanBtn) {
            scanBtn.onclick = () => {
                if (fileInput && fileInput.files[0]) {
                    scanFile(fileInput.files[0]);
                }
            };
        }
    }

    // Initialize
    function init() {
        console.log('🚀 Initializing Smart Admin Scanner with New Workflow...');
        
        updateStats();
        setupEvents();
        
        // Auto start camera
        setTimeout(() => {
            startCamera();
        }, 1000);
        
        console.log('✅ Smart Admin Scanner ready!');
    }

    // Cleanup
    window.addEventListener('beforeunload', () => {
        if (html5QrCode && isScanning) {
            html5QrCode.stop().catch(() => {});
        }
    });

    // Start
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

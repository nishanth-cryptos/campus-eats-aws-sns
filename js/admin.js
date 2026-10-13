/**
 * Admin Dashboard Logic (Async - Appwrite)
 */

const admin = AppwriteAuth.getCurrentAdmin();
if (!admin) {
    window.location.href = 'admin-login.html';
}

document.getElementById('shopName').textContent = admin.name;

const pendingContainer = document.getElementById('pendingOrders');
const activeContainer = document.getElementById('activeOrders');
const completedContainer = document.getElementById('completedOrders');

async function renderDashboard() {
    const orders = await DataManager.getShopOrders(admin.id);
    latestOrders = orders;

    // Calculate Stats
    let revenue = 0;

    // Clear Containers
    if (pendingContainer) pendingContainer.innerHTML = '';
    if (activeContainer) activeContainer.innerHTML = '';
    if (completedContainer) completedContainer.innerHTML = '';

    orders.forEach(order => {
        // Filter items for this shop only
        const shopItems = order.items.filter(i => i.shopId === admin.id);
        const shopTotal = shopItems.reduce((sum, i) => sum + (i.price * i.qty), 0);

        // Get this shop's specific token and status
        const tokenObj = order.tokens.find(t => t.shopId === admin.id);
        const currentStatus = order.shopStatus[admin.id] || 'Pending';

        if (currentStatus === 'Completed') {
            revenue += shopTotal;
        }

        const cardHtml = `
            <div class="card order-card status-${currentStatus.toLowerCase().replace(' ', '-')}" style="padding: 15px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                    <span style="font-weight: bold; font-size: 1.2rem;">${tokenObj ? tokenObj.token : 'N/A'}</span>
                    <span style="color: #666;">₹${shopTotal}</span>
                </div>
                <div style="margin-bottom: 10px; font-size: 0.9rem;">
                    ${shopItems.map(i => `<div>${i.qty} x ${i.name}</div>`).join('')}
                </div>
                
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <select class="status-select" onchange="updateStatus('${order.id}', this.value)" ${currentStatus === 'Completed' ? 'disabled' : ''}>
                        <option value="Confirmed" ${currentStatus === 'Confirmed' ? 'selected' : ''}>Confirmed</option>
                        <option value="Preparing" ${currentStatus === 'Preparing' ? 'selected' : ''}>Preparing</option>
                        <option value="Ready" ${currentStatus === 'Ready' ? 'selected' : ''}>Ready</option>
                        <option value="Completed" ${currentStatus === 'Completed' ? 'selected' : ''}>Completed</option>
                    </select>
                </div>
            </div>
        `;

        if (currentStatus === 'Completed') {
            if (completedContainer) completedContainer.insertAdjacentHTML('afterbegin', cardHtml);
        } else if (currentStatus === 'Ready') {
            if (activeContainer) activeContainer.insertAdjacentHTML('beforeend', cardHtml);
        } else {
            if (pendingContainer) pendingContainer.insertAdjacentHTML('beforeend', cardHtml);
        }
    });

    // Update Stats
    document.getElementById('totalOrders').textContent = orders.length;
    document.getElementById('totalRevenue').textContent = revenue;
}

// Latest orders, kept so status changes can include token/student details in the SNS event
let latestOrders = [];

async function updateStatus(orderId, newStatus) {
    if (confirm(`Change status to ${newStatus}?`)) {
        const updated = await DataManager.updateOrderStatus(orderId, admin.id, newStatus);
        if (updated && (newStatus === 'Ready' || newStatus === 'Completed')) {
            notifyStudent(orderId, newStatus);
        }
        await renderDashboard();
    } else {
        await renderDashboard();
    }
}

// 🚀 AWS SNS: tell the student their token is ready (API Gateway -> Lambda -> SNS)
function notifyStudent(orderId, newStatus) {
    const order = latestOrders.find(o => o.id === orderId);
    if (!order || typeof AwsNotify === 'undefined') return;
    const tokenObj = order.tokens.find(t => t.shopId === admin.id);

    AwsNotify.publish(newStatus === 'Ready' ? 'ORDER_READY' : 'ORDER_COMPLETED', {
        orderId: order.id,
        userEmail: order.user.email,
        regNo: order.user.regNo,
        shopName: tokenObj ? tokenObj.shopName : admin.name,
        token: tokenObj ? tokenObj.token : 'N/A'
    }).then(res => showToast(res.ok
        ? `📩 SNS alert sent to ${order.user.regNo} (${res.latencyMs} ms)`
        : `⏳ SNS alert queued — will retry (${res.error})`));
}

function showToast(text) {
    const toast = document.createElement('div');
    toast.textContent = text;
    toast.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#1F2937;color:#fff;padding:12px 18px;border-radius:10px;box-shadow:0 10px 25px rgba(0,0,0,.25);z-index:999;font-size:.9rem;';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

function logout() {
    AppwriteAuth.logoutAdmin();
    window.location.href = 'admin-login.html';
}

// Auto refresh every 10 seconds
setInterval(renderDashboard, 10000);

renderDashboard();

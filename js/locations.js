/**
 * Locations Page Logic (Async - Appwrite)
 */

(async () => {
    // Check Auth
    const user = await AppwriteAuth.getCurrentStudent();
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    const locationsContainer = document.getElementById('locationsContainer');
    const locations = await DataManager.getLocations();

    // For each location, count shops
    const locationsWithCounts = [];
    for (const loc of locations) {
        const shops = await DataManager.getShops(loc.id);
        locationsWithCounts.push({ ...loc, shopCount: shops.length });
    }

    // Render Locations with modern cards
    locationsContainer.innerHTML = locationsWithCounts.map(loc => `
        <div class="location-card" onclick="selectLocation('${loc.id}')">
            <div class="location-image">
                <div class="location-icon">${loc.icon || '📍'}</div>
            </div>
            <div class="location-content">
                <div class="location-name">${loc.name}</div>
                <div class="location-meta">
                    <span>🏪 ${loc.shopCount} shops</span>
                </div>
            </div>
        </div>
    `).join('');

    // Update Cart Badge
    const cart = DataManager.getCart();
    document.getElementById('cartBadge').textContent = cart.length;
})();

function selectLocation(id) {
    window.location.href = `shops.html?locationId=${id}`;
}

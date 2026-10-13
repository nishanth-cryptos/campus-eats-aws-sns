/**
 * CampusEats - Seed Data Script
 * Run this once in the browser console (or load it on a page) to populate
 * Appwrite collections with initial campus data.
 * 
 * PREREQUISITES: Collections must already exist in Appwrite Console.
 * Load appwrite.js before this script.
 */

const SEED_DATA = {
    locations: [
        { name: 'Gazebo' },
        { name: 'North Square' },
        { name: 'AB3 Canteen' },
        { name: 'Gymkhana' }
    ],
    shops: [
        // Gazebo (4 shops)
        { locationPlaceholder: 'Gazebo', name: 'Gazebo Juice Bar', image: 'juice.jpg' },
        { locationPlaceholder: 'Gazebo', name: 'Gazebo Snacks', image: 'snacks.jpg' },
        { locationPlaceholder: 'Gazebo', name: 'Gazebo Waffle', image: 'waffle.jpg' },
        { locationPlaceholder: 'Gazebo', name: 'Gazebo Coffee', image: 'coffee.jpg' },
        // North Square (4 shops)
        { locationPlaceholder: 'North Square', name: 'North Spicy', image: 'spicy.jpg' },
        { locationPlaceholder: 'North Square', name: 'North Sweets', image: 'sweets.jpg' },
        { locationPlaceholder: 'North Square', name: 'North Burger', image: 'burger.jpg' },
        { locationPlaceholder: 'North Square', name: 'North Pizza', image: 'pizza.jpg' },
        // AB3 (1 shop)
        { locationPlaceholder: 'AB3 Canteen', name: 'AB3 Quick Bites', image: 'quick.jpg' },
        // Gymkhana (1 shop)
        { locationPlaceholder: 'Gymkhana', name: 'Gymkhana MultiCuisine', image: 'gymfood.jpg' }
    ],
    menuItems: [
        // Gazebo Juice Bar
        { shopPlaceholder: 'Gazebo Juice Bar', name: 'Orange Juice', price: 40, type: 'veg', stock: 50 },
        { shopPlaceholder: 'Gazebo Juice Bar', name: 'Mango Shake', price: 60, type: 'veg', stock: 40 },
        // Gazebo Snacks
        { shopPlaceholder: 'Gazebo Snacks', name: 'Samosa', price: 15, type: 'veg', stock: 100 },
        { shopPlaceholder: 'Gazebo Snacks', name: 'Chicken Puff', price: 25, type: 'non-veg', stock: 30 },
        // Gymkhana MultiCuisine
        { shopPlaceholder: 'Gymkhana MultiCuisine', name: 'Chicken Biryani', price: 180, type: 'non-veg', stock: 20 },
        { shopPlaceholder: 'Gymkhana MultiCuisine', name: 'Paneer Butter Masala', price: 150, type: 'veg', stock: 25 },
        { shopPlaceholder: 'Gymkhana MultiCuisine', name: 'Naan', price: 30, type: 'veg', stock: 100 }
    ],
    admins: [
        { shopPlaceholder: 'Gazebo Juice Bar', password: 'pass123' },
        { shopPlaceholder: 'Gymkhana MultiCuisine', password: 'pass123' }
    ]
};

async function seedDatabase() {
    const log = (msg) => {
        console.log(`[SEED] ${msg}`);
        const el = document.getElementById('seedLog');
        if (el) el.innerHTML += `<div>${msg}</div>`;
    };

    try {
        log('🚀 Starting database seed...');

        // 1. Seed Locations
        log('📍 Creating locations...');
        const locationMap = {}; // name -> $id
        for (const loc of SEED_DATA.locations) {
            const doc = await appwriteDatabases.createDocument(
                DB, COLLECTIONS.locations, appwriteID.unique(), loc
            );
            locationMap[loc.name] = doc.$id;
            log(`  ✅ Location: ${loc.name} (${doc.$id})`);
        }

        // 2. Seed Shops
        log('🏪 Creating shops...');
        const shopMap = {}; // name -> $id
        for (const shop of SEED_DATA.shops) {
            const locationId = locationMap[shop.locationPlaceholder];
            if (!locationId) {
                log(`  ❌ Location not found for shop: ${shop.name}`);
                continue;
            }
            const doc = await appwriteDatabases.createDocument(
                DB, COLLECTIONS.shops, appwriteID.unique(),
                { locationId, name: shop.name, image: shop.image }
            );
            shopMap[shop.name] = doc.$id;
            log(`  ✅ Shop: ${shop.name} (${doc.$id})`);
        }

        // 3. Seed Menu Items
        log('🍔 Creating menu items...');
        for (const item of SEED_DATA.menuItems) {
            const shopId = shopMap[item.shopPlaceholder];
            if (!shopId) {
                log(`  ❌ Shop not found for item: ${item.name}`);
                continue;
            }
            const doc = await appwriteDatabases.createDocument(
                DB, COLLECTIONS.menuItems, appwriteID.unique(),
                { shopId, name: item.name, price: item.price, type: item.type, stock: item.stock }
            );
            log(`  ✅ Menu: ${item.name} → ${item.shopPlaceholder} (${doc.$id})`);
        }

        // 4. Seed Admins
        log('👤 Creating admin accounts...');
        for (const admin of SEED_DATA.admins) {
            const shopId = shopMap[admin.shopPlaceholder];
            if (!shopId) {
                log(`  ❌ Shop not found for admin: ${admin.shopPlaceholder}`);
                continue;
            }
            const doc = await appwriteDatabases.createDocument(
                DB, COLLECTIONS.admins, appwriteID.unique(),
                { shopId, password: admin.password, shopName: admin.shopPlaceholder }
            );
            log(`  ✅ Admin: ${admin.shopPlaceholder} (${doc.$id})`);
        }

        log('');
        log('🎉 Database seeded successfully!');
        log('You can now close this page and use the app.');

    } catch (error) {
        log(`❌ Error: ${error.message}`);
        console.error('Seed Error:', error);
    }
}

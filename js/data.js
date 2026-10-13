/**
 * CampusEats - Data Compatibility Layer
 * 
 * This file is kept for backwards compatibility.
 * The actual DataManager is now defined in appwrite-db.js.
 * Cart-related localStorage keys are still used for the local shopping cart.
 * 
 * CAMPUS_DATA is preserved as reference seed data only.
 */

const DB_KEYS = {
    CART: 'ce_cart',
    CURRENT_USER: 'ce_user',
    CURRENT_ADMIN: 'ce_admin'
};

// Original seed data kept as reference (actual data lives in Appwrite DB)
const CAMPUS_DATA = {
    locations: [
        { id: 'loc_gazebo', name: 'Gazebo' },
        { id: 'loc_north', name: 'North Square' },
        { id: 'loc_ab3', name: 'AB3 Canteen' },
        { id: 'loc_gym', name: 'Gymkhana' }
    ],
    shops: [
        { id: 'shop_g1', locationId: 'loc_gazebo', name: 'Gazebo Juice Bar', image: 'juice.jpg' },
        { id: 'shop_g2', locationId: 'loc_gazebo', name: 'Gazebo Snacks', image: 'snacks.jpg' },
        { id: 'shop_g3', locationId: 'loc_gazebo', name: 'Gazebo Waffle', image: 'waffle.jpg' },
        { id: 'shop_g4', locationId: 'loc_gazebo', name: 'Gazebo Coffee', image: 'coffee.jpg' },
        { id: 'shop_n1', locationId: 'loc_north', name: 'North Spicy', image: 'spicy.jpg' },
        { id: 'shop_n2', locationId: 'loc_north', name: 'North Sweets', image: 'sweets.jpg' },
        { id: 'shop_n3', locationId: 'loc_north', name: 'North Burger', image: 'burger.jpg' },
        { id: 'shop_n4', locationId: 'loc_north', name: 'North Pizza', image: 'pizza.jpg' },
        { id: 'shop_ab3', locationId: 'loc_ab3', name: 'AB3 Quick Bites', image: 'quick.jpg' },
        { id: 'shop_gym', locationId: 'loc_gym', name: 'Gymkhana MultiCuisine', image: 'gymfood.jpg' }
    ],
    menuItems: [
        { id: 'm_g1_1', shopId: 'shop_g1', name: 'Orange Juice', price: 40, type: 'veg', stock: 50 },
        { id: 'm_g1_2', shopId: 'shop_g1', name: 'Mango Shake', price: 60, type: 'veg', stock: 40 },
        { id: 'm_g2_1', shopId: 'shop_g2', name: 'Samosa', price: 15, type: 'veg', stock: 100 },
        { id: 'm_g2_2', shopId: 'shop_g2', name: 'Chicken Puff', price: 25, type: 'non-veg', stock: 30 },
        { id: 'm_gym_1', shopId: 'shop_gym', name: 'Chicken Biryani', price: 180, type: 'non-veg', stock: 20 },
        { id: 'm_gym_2', shopId: 'shop_gym', name: 'Paneer Butter Masala', price: 150, type: 'veg', stock: 25 },
        { id: 'm_gym_3', shopId: 'shop_gym', name: 'Naan', price: 30, type: 'veg', stock: 100 }
    ]
};

/**
 * CampusEats - Appwrite Database Module
 * Replaces the old localStorage-based DataManager.
 * All data now lives in Appwrite collections.
 * Cart remains in localStorage (transient, per-session data).
 * Depends on: appwrite.js (must be loaded first)
 */

const DB = AppwriteConfig.databaseId;
const COLLECTIONS = AppwriteConfig.collections;

const DataManager = {

    // ─── Locations ───────────────────────────────────────────

    getLocations: async () => {
        try {
            const result = await appwriteDatabases.listDocuments(DB, COLLECTIONS.locations, [
                appwriteQuery.limit(100)
            ]);
            return result.documents.map(doc => ({
                id: doc.$id,
                name: doc.name,
                icon: doc.icon || '📍'
            }));
        } catch (error) {
            console.error('Error fetching locations:', error);
            return [];
        }
    },

    // ─── Shops ───────────────────────────────────────────────

    getShops: async (locationId) => {
        try {
            const queries = [appwriteQuery.limit(100)];
            if (locationId) {
                queries.push(appwriteQuery.equal('locationId', locationId));
            }
            const result = await appwriteDatabases.listDocuments(DB, COLLECTIONS.shops, queries);
            return result.documents.map(doc => ({
                id: doc.$id,
                locationId: doc.locationId,
                name: doc.name,
                image: doc.image
            }));
        } catch (error) {
            console.error('Error fetching shops:', error);
            return [];
        }
    },

    getShopDetails: async (shopId) => {
        try {
            const doc = await appwriteDatabases.getDocument(DB, COLLECTIONS.shops, shopId);
            return {
                id: doc.$id,
                locationId: doc.locationId,
                name: doc.name,
                image: doc.image
            };
        } catch (error) {
            console.error('Error fetching shop details:', error);
            return null;
        }
    },

    // ─── Menu ────────────────────────────────────────────────

    getMenu: async (shopId) => {
        try {
            const queries = [appwriteQuery.limit(100)];
            if (shopId) {
                queries.push(appwriteQuery.equal('shopId', shopId));
            }
            const result = await appwriteDatabases.listDocuments(DB, COLLECTIONS.menuItems, queries);
            return result.documents.map(doc => ({
                id: doc.$id,
                shopId: doc.shopId,
                name: doc.name,
                price: doc.price,
                type: doc.type,
                stock: doc.stock
            }));
        } catch (error) {
            console.error('Error fetching menu:', error);
            return [];
        }
    },

    updateStock: async (itemId, newStock) => {
        try {
            await appwriteDatabases.updateDocument(DB, COLLECTIONS.menuItems, itemId, {
                stock: parseInt(newStock)
            });
            return true;
        } catch (error) {
            console.error('Error updating stock:', error);
            return false;
        }
    },

    // ─── Orders ──────────────────────────────────────────────

    placeOrder: async (orderData) => {
        try {
            // Store complex nested data as JSON strings
            const doc = await appwriteDatabases.createDocument(
                DB,
                COLLECTIONS.orders,
                appwriteID.unique(),
                {
                    orderId: orderData.id,
                    userId: orderData.user.id || '',
                    userRegNo: orderData.user.regNo,
                    userEmail: orderData.user.email,
                    timestamp: orderData.timestamp,
                    items: JSON.stringify(orderData.items),
                    total: orderData.total,
                    tokens: JSON.stringify(orderData.tokens),
                    shopStatus: JSON.stringify(orderData.shopStatus)
                }
            );

            // Deduct stock for each item
            for (const orderItem of orderData.items) {
                try {
                    const menuDoc = await appwriteDatabases.getDocument(
                        DB, COLLECTIONS.menuItems, orderItem.id
                    );
                    const newStock = Math.max(0, menuDoc.stock - orderItem.qty);
                    await appwriteDatabases.updateDocument(
                        DB, COLLECTIONS.menuItems, orderItem.id,
                        { stock: newStock }
                    );
                } catch (err) {
                    console.warn('Could not deduct stock for item:', orderItem.id, err);
                }
            }

            return doc;
        } catch (error) {
            console.error('Error placing order:', error);
            return null;
        }
    },

    getOrders: async (regNo) => {
        try {
            const result = await appwriteDatabases.listDocuments(DB, COLLECTIONS.orders, [
                appwriteQuery.equal('userRegNo', regNo),
                appwriteQuery.limit(100),
                appwriteQuery.orderDesc('$createdAt')
            ]);
            return result.documents.map(doc => ({
                id: doc.orderId,
                docId: doc.$id,
                user: { regNo: doc.userRegNo, email: doc.userEmail },
                timestamp: doc.timestamp,
                items: JSON.parse(doc.items),
                total: doc.total,
                tokens: JSON.parse(doc.tokens),
                shopStatus: JSON.parse(doc.shopStatus)
            }));
        } catch (error) {
            console.error('Error fetching orders:', error);
            return [];
        }
    },

    getShopOrders: async (shopId) => {
        try {
            // We can't filter by JSON content easily, so fetch all and filter client-side
            const result = await appwriteDatabases.listDocuments(DB, COLLECTIONS.orders, [
                appwriteQuery.limit(200),
                appwriteQuery.orderDesc('$createdAt')
            ]);

            return result.documents
                .map(doc => ({
                    id: doc.orderId,
                    docId: doc.$id,
                    user: { regNo: doc.userRegNo, email: doc.userEmail },
                    timestamp: doc.timestamp,
                    items: JSON.parse(doc.items),
                    total: doc.total,
                    tokens: JSON.parse(doc.tokens),
                    shopStatus: JSON.parse(doc.shopStatus)
                }))
                .filter(order => order.items.some(i => i.shopId === shopId));
        } catch (error) {
            console.error('Error fetching shop orders:', error);
            return [];
        }
    },

    updateOrderStatus: async (orderId, shopId, newStatus) => {
        try {
            // Find the order document by orderId
            const result = await appwriteDatabases.listDocuments(DB, COLLECTIONS.orders, [
                appwriteQuery.equal('orderId', orderId),
                appwriteQuery.limit(1)
            ]);

            if (result.documents.length > 0) {
                const doc = result.documents[0];
                const shopStatus = JSON.parse(doc.shopStatus);
                shopStatus[shopId] = newStatus;

                await appwriteDatabases.updateDocument(DB, COLLECTIONS.orders, doc.$id, {
                    shopStatus: JSON.stringify(shopStatus)
                });
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error updating order status:', error);
            return false;
        }
    },

    // ─── Cart (still localStorage — transient data) ──────────

    getCart: () => {
        return JSON.parse(localStorage.getItem('ce_cart') || '[]');
    },

    setCart: (cart) => {
        localStorage.setItem('ce_cart', JSON.stringify(cart));
    },

    clearCart: () => {
        localStorage.removeItem('ce_cart');
    }
};

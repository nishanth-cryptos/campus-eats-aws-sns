/**
 * CampusEats - Appwrite Authentication Module
 * Handles student signup/login and admin login.
 * Depends on: appwrite.js (must be loaded first)
 */

const AppwriteAuth = {

    // ─── Student Auth ────────────────────────────────────────

    /**
     * Register a new student account.
     * @param {string} regNo - Registration number (e.g., 21BCE1234)
     * @param {string} email - VIT student email
     * @param {string} password - Password (min 8 chars, Appwrite requirement)
     * @returns {Promise<object>} Created user object
     */
    signupStudent: async (regNo, email, password) => {
        try {
            // Create Appwrite account using email + password
            // Use regNo as the "name" field for easy retrieval
            const user = await appwriteAccount.create(
                appwriteID.unique(),
                email,
                password,
                regNo // stored as the user's name
            );

            // Immediately create a session (log them in)
            await appwriteAccount.createEmailPasswordSession(email, password);

            // Store user prefs with regNo for quick access
            await appwriteAccount.updatePrefs({ regNo: regNo });

            return { success: true, user };
        } catch (error) {
            console.error('Signup Error:', error);

            let message = error.message || 'Signup failed. Please try again.';
            if (error.code === 409) {
                message = 'An account with this email already exists. Please login instead.';
            }

            return { success: false, message };
        }
    },

    /**
     * Login a student using email + password.
     * @param {string} email - VIT student email
     * @param {string} password - Password
     * @returns {Promise<object>} Session result
     */
    loginStudent: async (email, password) => {
        try {
            const session = await appwriteAccount.createEmailPasswordSession(email, password);
            return { success: true, session };
        } catch (error) {
            console.error('Login Error:', error);

            let message = error.message || 'Login failed. Please check your credentials.';
            if (error.code === 401) {
                message = 'Invalid email or password.';
            }

            return { success: false, message };
        }
    },

    /**
     * Get the currently logged-in student.
     * Returns null if no session exists.
     * @returns {Promise<object|null>}
     */
    getCurrentStudent: async () => {
        try {
            const user = await appwriteAccount.get();
            return {
                id: user.$id,
                regNo: user.name, // We stored regNo as name
                email: user.email,
                prefs: user.prefs
            };
        } catch (error) {
            // No active session
            return null;
        }
    },

    /**
     * Logout the current student (destroy session).
     */
    logoutStudent: async () => {
        try {
            await appwriteAccount.deleteSession('current');
        } catch (error) {
            console.error('Logout Error:', error);
        }
        // Clear any local session data
        localStorage.removeItem('ce_user');
        localStorage.removeItem('ce_cart');
    },

    // ─── Admin Auth ──────────────────────────────────────────

    /**
     * Login an admin (shop owner) using shopId + password.
     * Validates against the 'admins' collection in the database.
     * @param {string} shopId - The shop identifier
     * @param {string} password - Admin password
     * @returns {Promise<object>} Result with shop data
     */
    loginAdmin: async (shopId, password) => {
        try {
            // Query the admins collection for matching shopId
            const result = await appwriteDatabases.listDocuments(
                AppwriteConfig.databaseId,
                AppwriteConfig.collections.admins,
                [
                    appwriteQuery.equal('shopId', shopId),
                    appwriteQuery.equal('password', password)
                ]
            );

            if (result.documents.length > 0) {
                const adminDoc = result.documents[0];
                const shopData = {
                    id: adminDoc.shopId,
                    name: adminDoc.shopName,
                    docId: adminDoc.$id
                };
                // Store admin session locally
                localStorage.setItem('ce_admin', JSON.stringify(shopData));
                return { success: true, shop: shopData };
            } else {
                return { success: false, message: 'Invalid Shop ID or Password.' };
            }
        } catch (error) {
            console.error('Admin Login Error:', error);
            return { success: false, message: 'Login failed. Please try again.' };
        }
    },

    /**
     * Get the currently logged-in admin from localStorage.
     * @returns {object|null}
     */
    getCurrentAdmin: () => {
        const data = localStorage.getItem('ce_admin');
        return data ? JSON.parse(data) : null;
    },

    /**
     * Logout the current admin.
     */
    logoutAdmin: () => {
        localStorage.removeItem('ce_admin');
    }
};

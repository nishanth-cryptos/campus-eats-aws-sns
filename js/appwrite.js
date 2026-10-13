/**
 * CampusEats - Appwrite SDK Configuration
 * Central config file for the Appwrite backend.
 */

const AppwriteConfig = {
    endpoint: 'https://fra.cloud.appwrite.io/v1',
    projectId: '69c7eb2f00194726a78d',
    databaseId: '69c7ece000246a52d28d',

    // Collection IDs — will be set after collections are created
    collections: {
        locations: 'locations',
        shops: 'shops',
        menuItems: 'menuItems',
        orders: 'orders',
        admins: 'admins'
    }
};

// Initialize Appwrite SDK
const appwriteClient = new Appwrite.Client();
appwriteClient
    .setEndpoint(AppwriteConfig.endpoint)
    .setProject(AppwriteConfig.projectId);

const appwriteAccount = new Appwrite.Account(appwriteClient);
const appwriteDatabases = new Appwrite.Databases(appwriteClient);
const appwriteID = Appwrite.ID;
const appwriteQuery = Appwrite.Query;

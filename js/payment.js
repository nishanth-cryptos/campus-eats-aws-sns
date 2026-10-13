/**
 * Payment Page Logic (Async - Appwrite)
 */

(async () => {
    // Check Auth
    const user = await AppwriteAuth.getCurrentStudent();
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    const payBtn = document.getElementById('payBtn');
    const paymentForm = document.getElementById('paymentForm');

    // Calculate Total for display
    const cart = DataManager.getCart();
    const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    document.getElementById('payAmount').textContent = totalAmount;

    if (cart.length === 0) {
        alert('Cart is empty!');
        window.location.href = 'locations.html';
        return;
    }

    paymentForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Simulate Processing
        payBtn.textContent = 'Processing...';
        payBtn.disabled = true;

        await completeOrder(user, cart, totalAmount);
    });

    async function completeOrder(user, cart, totalAmount) {
        // 1. Generate Order ID
        const orderId = 'ORD-' + Date.now().toString().slice(-6);

        // 2. Generate Tokens Per Shop
        const cartByShop = {};
        cart.forEach(item => {
            if (!cartByShop[item.shopId]) {
                cartByShop[item.shopId] = [];
            }
            cartByShop[item.shopId].push(item);
        });

        const shops = await DataManager.getShops();
        const tokenList = [];
        const shopStatus = {};

        for (const [shopId, items] of Object.entries(cartByShop)) {
            const shop = shops.find(s => s.id === shopId);
            const shopPrefix = shop ? shop.name.substring(0, 2).toUpperCase() : 'XX';
            const randomNum = Math.floor(100 + Math.random() * 900);
            const token = `${shopPrefix}-${randomNum}`;

            tokenList.push({
                shopId: shopId,
                shopName: shop ? shop.name : 'Unknown',
                token: token,
                items: items
            });

            shopStatus[shopId] = 'Confirmed';
        }

        // 3. Create Order Object
        const newOrder = {
            id: orderId,
            user: {
                id: user.id,
                regNo: user.regNo,
                email: user.email
            },
            timestamp: new Date().toISOString(),
            items: cart,
            total: totalAmount,
            tokens: tokenList,
            shopStatus: shopStatus
        };

        // 4. Save to Appwrite DB
        const result = await DataManager.placeOrder(newOrder);

        if (result) {
            // 🚀 AWS SNS: publish ORDER_PLACED (API Gateway -> Lambda -> SNS).
            // Wait briefly so the email usually goes out before redirect; if it is slow,
            // the event stays in the outbox and token.html finishes delivering it.
            await Promise.race([
                AwsNotify.publish('ORDER_PLACED', {
                    orderId: newOrder.id,
                    userEmail: newOrder.user.email,
                    regNo: newOrder.user.regNo,
                    total: newOrder.total,
                    tokens: newOrder.tokens
                }),
                new Promise(r => setTimeout(r, 3500))
            ]);

            // 5. Clear Cart
            DataManager.clearCart();

            // 6. Redirect to Token Page
            window.location.href = `token.html?orderId=${orderId}`;
        } else {
            alert('Order placement failed. Please try again.');
            payBtn.textContent = 'Pay Now';
            payBtn.disabled = false;
        }
    }
})();

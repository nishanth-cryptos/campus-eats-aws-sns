# 🎓 AWS DA-3 Project Implementation Guide
## Title: Serverless Real-Time Food Order & Token Notification System using Amazon SNS, AWS Lambda & Amazon API Gateway

---

### 📌 Project Context
- **Project Name:** CampusEats – Campus Food Ordering Platform
- **Course / Assignment:** AWS Cloud Computing – Digital Assignment 3 (DA-3)
- **Primary AWS Services Used:**
  1. **Amazon SNS (Simple Notification Service)** – Publish/Subscribe cloud messaging
  2. **AWS Lambda** – Serverless event-driven compute engine
  3. **Amazon API Gateway** – Managed REST/HTTP API entry point for frontend requests
  4. **Amazon CloudWatch** – Real-time monitoring, metrics, and execution logs

---

## 🏗️ 1. Architecture & Working Flow

```
[CampusEats Web App]
       │
       ▼ (1) HTTP POST { orderId, email, token, shopName, total }
[Amazon API Gateway]
       │
       ▼ (2) Event Trigger
[AWS Lambda (Python 3.11)]
       │
       ▼ (3) boto3 sns.publish(TopicArn, Message, Subject)
[Amazon SNS Topic: CampusEats-Orders]
       │
       ▼ (4) Fan-out / Push notification
[Student Email Inbox / SMS]
   📩 "Order ORD-123456 Confirmed! Pickup Token: CC-412"
```

---

## 🚀 2. Step-by-Step AWS Setup Guide

> **Note:** All services used below fall 100% under the **AWS Free Tier**.

### Step 2.1: Create the Amazon SNS Topic & Subscription

1. Log in to the [AWS Management Console](https://console.aws.amazon.com/).
2. In the top search bar, type **SNS** and select **Simple Notification Service**.
3. In the left sidebar, click **Topics**, then click the orange **Create topic** button.
4. Configure the topic:
   - **Type:** Select **Standard**
   - **Name:** `CampusEats-Order-Alerts`
   - **Display name:** `CampusEats` *(this appears as sender name in emails)*
5. Scroll to the bottom and click **Create topic**.
6. **Copy and save your Topic ARN** (e.g., `arn:aws:sns:ap-south-1:123456789012:CampusEats-Order-Alerts`).
7. **Create a Subscription (To test & demo email alerts):**
   - On the same topic details page, click **Create subscription**.
   - **Protocol:** Select **Email**.
   - **Endpoint:** Enter your email address (and your faculty's email during demo).
   - Click **Create subscription**.
   - ⚠️ **Crucial Step:** Open your email inbox. You will receive an email from *AWS Notifications* with subject *AWS Notification - Subscription Confirmation*. Click the **Confirm subscription** link. The status in the console will change from *Pending confirmation* to *Confirmed*.

---

### Step 2.2: Create the AWS Lambda Function

1. In the AWS search bar, type **Lambda** and open it.
2. Click **Create function**.
3. Choose **Author from scratch**:
   - **Function name:** `CampusEats-Order-Notifier`
   - **Runtime:** `Python 3.11` (or Python 3.12)
   - **Architecture:** `x86_64`
4. Under **Permissions**, leave default (*Create a new role with basic Lambda permissions*).
5. Click **Create function**.

#### Grant SNS Publish Permission to Lambda Role:
1. In the Lambda function page, click on the **Configuration** tab.
2. Select **Permissions** from the left sub-menu.
3. Click on the **Role name** link (opens IAM in a new tab).
4. Click **Add permissions** ➔ **Attach policies**.
5. Search for `AmazonSNSFullAccess` (or create an inline policy with `sns:Publish`).
6. Check the box and click **Add permissions**. (Close the IAM tab).

#### Add Lambda Function Code:
1. Return to the Lambda page and click the **Code** tab.
2. Replace all existing code in `lambda_function.py` with the following:

```python
import json
import boto3

# Initialize SNS client
# Replace region with your AWS region (e.g., 'ap-south-1' for Mumbai)
sns_client = boto3.client('sns', region_name='ap-south-1')

# REPLACE THIS WITH YOUR ACTUAL SNS TOPIC ARN COPIED IN STEP 2.1
SNS_TOPIC_ARN = "arn:aws:sns:ap-south-1:YOUR_ACCOUNT_ID:CampusEats-Order-Alerts"

def lambda_handler(event, context):
    print("Received event:", json.dumps(event))
    
    # Handle CORS preflight request
    http_method = event.get('requestContext', {}).get('http', {}).get('method', '')
    if http_method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                'Access-Control-Allow-Methods': 'OPTIONS,POST'
            },
            'body': ''
        }

    try:
        # Parse incoming body
        body = event.get('body', '{}')
        if isinstance(body, str):
            data = json.loads(body)
        else:
            data = body

        order_id = data.get('orderId', 'N/A')
        tokens = data.get('tokens', [])
        total = data.get('total', 0)
        user_email = data.get('userEmail', 'Student')
        reg_no = data.get('regNo', 'N/A')

        # Format Token Summary
        token_lines = []
        for t in tokens:
            shop = t.get('shopName', 'Campus Outlet')
            token_num = t.get('token', 'N/A')
            token_lines.append(f"• Shop: {shop}  ==>  TOKEN: {token_num}")
            
        token_summary = "\n".join(token_lines) if token_lines else "Token: Pending"

        # Construct Email Message
        subject = f"🍔 [CampusEats] Order Confirmed: {order_id}"
        message = f"""Hello {reg_no},

Your campus food order has been successfully placed!

==================================================
ORDER SUMMARY
==================================================
Order ID  : {order_id}
Total Paid: ₹{total}

YOUR PICKUP TOKENS:
{token_summary}

==================================================
INSTRUCTIONS:
1. Show this token code at the respective counter.
2. Collect your meal as soon as the status turns 'READY'.
3. Thank you for using CampusEats!
==================================================
"""

        # Publish to Amazon SNS Topic
        response = sns_client.publish(
            TopicArn=SNS_TOPIC_ARN,
            Message=message,
            Subject=subject
        )

        print("SNS Publish Response:", response)

        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                'Access-Control-Allow-Methods': 'OPTIONS,POST'
            },
            'body': json.dumps({
                'success': True,
                'messageId': response.get('MessageId'),
                'orderId': order_id
            })
        }

    except Exception as e:
        print("Error publishing to SNS:", str(e))
        return {
            'statusCode': 500,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization'
            },
            'body': json.dumps({'error': str(e)})
        }
```

3. Update line 8 with your real **SNS_TOPIC_ARN**.
4. Click the orange **Deploy** button.

---

### Step 2.3: Create and Connect Amazon API Gateway

1. In the AWS search bar, type **API Gateway** and open it.
2. Find **HTTP API** and click **Build**.
3. Under **Integrations**, click **Add integration**:
   - Choose **Lambda**.
   - **Lambda function:** Select `CampusEats-Order-Notifier`.
   - **API name:** `CampusEats-API`
   - Click **Next**.
4. Under **Configure routes**:
   - **Method:** `POST`
   - **Resource path:** `/notify-order`
   - **Integration target:** `CampusEats-Order-Notifier`
   - Click **Next**, then **Next** (keep default stage `$default`), then **Create**.
5. **Enable CORS (Cross-Origin Resource Sharing):**
   - In the left menu of your API Gateway, click **CORS**.
   - Click **Configure**.
   - **Access-Control-Allow-Origin:** Enter `*` (or your localhost/GitHub Pages URL).
   - **Access-Control-Allow-Headers:** Enter `Content-Type,Authorization`.
   - **Access-Control-Allow-Methods:** Select `POST` and `OPTIONS`.
   - Click **Save**.
6. **Copy the Invoke URL:**
   - On the API summary page, copy the **Invoke URL** (e.g., `https://abcdef123.execute-api.ap-south-1.amazonaws.com`).
   - Your complete endpoint will be:  
     `https://abcdef123.execute-api.ap-south-1.amazonaws.com/notify-order`

---

## 💻 3. Code Integration into CampusEats

Integrate the AWS notification trigger in `js/payment.js` right when an order is created.

### Update `js/payment.js` (Around Line 86):

```javascript
        // 4. Save to Appwrite DB
        const result = await DataManager.placeOrder(newOrder);

        if (result) {
            // ==========================================
            // 🚀 AWS SNS NOTIFICATION INTEGRATION (DA-3)
            // ==========================================
            try {
                const AWS_API_ENDPOINT = "https://YOUR_API_GATEWAY_URL_HERE.amazonaws.com/notify-order";
                
                // Fire and forget or await AWS Lambda notification
                fetch(AWS_API_ENDPOINT, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        orderId: newOrder.id,
                        userEmail: newOrder.user.email,
                        regNo: newOrder.user.regNo,
                        total: newOrder.total,
                        tokens: newOrder.tokens
                    })
                }).then(res => res.json())
                  .then(data => console.log("AWS SNS Notification Response:", data))
                  .catch(err => console.warn("AWS Notification dispatch error:", err));
            } catch (awsError) {
                console.warn("Could not dispatch AWS notification:", awsError);
            }
            // ==========================================

            // 5. Clear Cart
            DataManager.clearCart();

            // 6. Redirect to Token Page
            window.location.href = `token.html?orderId=${orderId}`;
        }
```

---

## 📸 4. Screenshots Checklist for DA-3 Submission

To score **100% marks** in the DA-3 report, include these 5 screenshots:

| # | Screenshot Item | What to show in AWS Console |
|:-:|:---|:---|
| **1** | **Amazon SNS Topic & Subscriptions** | SNS Console showing `CampusEats-Order-Alerts` Topic with your email in `Confirmed` status. |
| **2** | **AWS Lambda Function** | Lambda editor showing Python code, function name, and active execution role. |
| **3** | **Amazon API Gateway** | Routes page showing `POST /notify-order` connected to the Lambda integration, plus CORS settings. |
| **4** | **CampusEats Live Checkout** | Website showing the Cart/Payment page placing an order and generating Token `XX-123`. |
| **5** | **CloudWatch Logs & Email Inbox** | 1. Received Email notification in inbox with token & order summary.<br>2. CloudWatch Log Stream showing `START`, `Received event`, and `REPORT` metrics. |

---

## 🗣️ 5. Faculty Viva Questions & High-Scoring Answers

### Q1: Why did you choose Amazon SNS and AWS Lambda for this project?
> **Answer:**  
> In a busy campus canteen, immediate order token updates are critical. Rather than running an expensive 24/7 dedicated server to send notifications, we implemented an **Event-Driven Serverless Architecture**. AWS Lambda only executes when an order is placed (costing zero when idle), and Amazon SNS decouples the notification system, allowing broadcast to multiple channels (email, SMS, canteen dashboards) simultaneously.

### Q2: What is the purpose of Amazon API Gateway here?
> **Answer:**  
> Amazon API Gateway serves as a secure, managed HTTP front door. Our browser JavaScript client sends a standard `fetch()` request over HTTPS with JSON payload. API Gateway handles traffic throttling, CORS validation, and maps the request directly to the Lambda function.

### Q3: What is the difference between Amazon SNS and Amazon SQS?
> **Answer:**  
> **Amazon SNS** is a **Push / Pub-Sub (Publish-Subscribe)** service. When an order event occurs, it immediately pushes messages to all subscribed endpoints (fan-out pattern).  
> **Amazon SQS** is a **Pull / Queue** service where workers poll messages individually for batch processing. For instant user alerts, SNS is the right fit.

### Q4: How does this design handle peak hours (e.g., 1:00 PM lunch rush)?
> **Answer:**  
> AWS Lambda automatically scales up to 1,000 concurrent executions out of the box in response to traffic bursts, and Amazon SNS supports virtually unlimited throughput. The application will never face downtime or queue backlogs during college peak lunch hours.

---

## 📝 6. Cost Estimation Table (Free Tier Demonstration)

| Service | Free Tier Monthly Allowance | CampusEats Usage | Incurred Cost |
| :--- | :--- | :--- | :--- |
| **AWS Lambda** | 1,000,000 requests/month | ~1,500 orders/month | **$0.00** |
| **Amazon SNS** | 1,000,000 publishes + 1,000 email deliveries | ~1,500 publishes | **$0.00** |
| **Amazon API Gateway** | 1,000,000 API calls/month (HTTP API) | ~1,500 requests | **$0.00** |
| **CloudWatch Logs** | 5 GB log data ingestion | < 50 MB | **$0.00** |
| **Total Estimated Cost** | — | — | **₹0.00 ($0.00)** |

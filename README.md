# CampusEats — Serverless Order Notifications with Amazon SNS

Campus food-ordering website that simulates **Amazon SNS (Simple Notification Service)**: every order lifecycle event is published through **API Gateway → AWS Lambda → SNS** and fanned out to subscribers by email.

**Live site:** https://irakshitha.github.io/campus-eats-aws-sns/
**SNS Live Monitor:** https://irakshitha.github.io/campus-eats-aws-sns/aws-monitor.html

## Architecture

```
CampusEats Web (GitHub Pages)
   │  POST /notify-order  { eventType, eventId, orderId, tokens, ... }
   ▼
Amazon API Gateway (HTTP API, CORS, throttling)
   ▼
AWS Lambda  (aws/lambda/lambda_function.py)
   │  sns.publish(Message, Subject, MessageAttributes={eventType, shopName, priority})
   ▼
Amazon SNS topic  CampusEats-Order-Alerts
   ├── Student email      (no filter → all events)
   └── Kitchen email      (filter policy: eventType = ORDER_PLACED)
```

Orders, menus and auth are stored in Appwrite; the cart is in localStorage.

## Core SNS functionality
- Publish/subscribe on a Standard SNS topic with email subscriptions
- Order confirmation published when a student pays (`js/payment.js`)
- Pickup token, order ID and total in every message

## Enhancements beyond basic SNS
1. **Order lifecycle events.** `ORDER_PLACED`, `ORDER_READY` and `ORDER_COMPLETED` are separate events. When a shop owner marks an order **Ready** on the admin dashboard, the student gets a "your token is ready" alert.
2. **SNS message filtering.** Each publish carries `MessageAttributes`. The kitchen subscription uses a filter policy and only receives new orders.
3. **Smart pickup ETA.** Lambda estimates prep time from item count, adds extra time during the 12–2 PM lunch rush, and includes it in the email and on the token page.
4. **Reliable delivery.** The browser client (`js/aws-notify.js`) retries with exponential backoff, keeps an offline outbox that re-publishes when the network returns, and sends an `eventId` so the Lambda doesn't send duplicates.
5. **SNS Live Monitor** (`aws-monitor.html`). Animated pipeline, delivery log with SNS MessageIds and latency, filter-policy simulator, and a test-publish button.

## Project layout
| Path | Purpose |
|---|---|
| `aws/template.yaml` | AWS SAM template: SNS topic, subscriptions and filter policy, Lambda, HTTP API with CORS |
| `aws/lambda/lambda_function.py` | Lambda handler (Python 3.12) |
| `.github/workflows/deploy-pages.yml` | Deploys the website to GitHub Pages on every push to `main` |
| `.github/workflows/deploy-aws.yml` | Deploys the SAM stack to AWS (needs AWS secrets) |
| `js/aws-config.js` | API Gateway endpoint used by the site |
| `js/aws-notify.js` | SNS client: retries, outbox, idempotency, delivery log |
| `AWS_DA3_PROJECT_GUIDE.md` | Manual console setup guide and viva notes |

## Deploying

### Website (GitHub Pages)
Push to `main`. The **Deploy website to GitHub Pages** workflow publishes the site.
To point it at a different API without editing code, set the repository variable `AWS_SNS_ENDPOINT`.

> Appwrite only accepts requests from registered hosts. In the Appwrite console, open **Overview → Platforms → Add platform → Web** and add `irakshitha.github.io`.

### AWS backend
**Option A: GitHub Actions.** Add the repo secrets `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` and `NOTIFICATION_EMAIL` (and optionally `KITCHEN_EMAIL`). Then run **Deploy AWS backend (SAM)**. Copy the `NotifyOrderEndpoint` output into `js/aws-config.js`.

**Option B: SAM CLI.**
```bash
cd aws
sam build
sam deploy --guided   # stack: campuseats-notifications
```

**Option C: Console.** Paste `aws/lambda/lambda_function.py` into the existing Lambda. Set the environment variable `SNS_TOPIC_ARN`, then click **Deploy**.

Confirm the subscription email that AWS sends to each address. SNS won't deliver to unconfirmed subscriptions.

## Free tier cost
Lambda (1M requests), SNS (1M publishes, 1,000 emails), HTTP API (1M calls) and CloudWatch Logs (5 GB) are all within the AWS Free Tier, so cost is **$0**.

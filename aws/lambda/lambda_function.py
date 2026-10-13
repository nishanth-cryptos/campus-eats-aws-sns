"""
CampusEats Order Notifier - AWS Lambda (Python 3.12)

Flow:  Browser --HTTPS--> API Gateway (POST /notify-order) --> this Lambda --> Amazon SNS topic --> Email/SMS

Enhancement over a plain "publish one message" Lambda:
  * Order lifecycle events: ORDER_PLACED, ORDER_READY, ORDER_COMPLETED, TEST
  * Every publish carries SNS MessageAttributes (eventType, shopName, priority),
    so subscribers can use SNS *filter policies* (e.g. kitchen staff only get ORDER_PLACED).
  * Smart pickup ETA for ORDER_PLACED, computed from item count and lunch-rush hours.
  * Idempotency: the client sends an eventId; duplicate retries inside one warm container are not re-published.
  * Backwards compatible: a payload without eventType is treated as ORDER_PLACED.
"""

import json
import os
import time
from datetime import datetime, timedelta, timezone

import boto3

SNS_TOPIC_ARN = os.environ.get("SNS_TOPIC_ARN", "")
# Region is taken from the topic ARN so the Lambda works in any region.
_region = SNS_TOPIC_ARN.split(":")[3] if SNS_TOPIC_ARN.count(":") >= 5 else os.environ.get("AWS_REGION")
sns_client = boto3.client("sns", region_name=_region)

IST = timezone(timedelta(hours=5, minutes=30))
CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "OPTIONS,POST",
}
VALID_EVENTS = {"ORDER_PLACED", "ORDER_READY", "ORDER_COMPLETED", "TEST"}

# Remembers recently published eventIds while this container is warm (cheap idempotency for client retries).
_recent_event_ids = {}


def _response(status, body):
    return {"statusCode": status, "headers": CORS_HEADERS, "body": json.dumps(body)}


def estimate_pickup_minutes(tokens, now):
    """Smart ETA: base prep time per item, scaled up during the 12:00-14:00 lunch rush."""
    item_count = sum(int(i.get("qty", 1)) for t in tokens for i in t.get("items", [])) or 1
    minutes = 5 + 2 * item_count
    if 12 <= now.hour < 14:
        minutes = int(minutes * 1.5)
    return min(minutes, 45)


def build_message(event_type, data, now):
    order_id = data.get("orderId", "N/A")
    reg_no = data.get("regNo", "Student")
    tokens = data.get("tokens", [])
    total = data.get("total", 0)

    token_lines = "\n".join(
        f"  - {t.get('shopName', 'Campus Outlet')}  ==>  TOKEN {t.get('token', 'N/A')}" for t in tokens
    ) or "  - Token pending"

    if event_type == "ORDER_READY":
        shop = data.get("shopName") or (tokens[0].get("shopName") if tokens else "the counter")
        token = data.get("token") or (tokens[0].get("token") if tokens else "N/A")
        subject = f"[CampusEats] Token {token} is READY for pickup"
        message = (
            f"Hello {reg_no},\n\n"
            f"Your food is ready! Please collect it from {shop}.\n\n"
            f"  Order ID : {order_id}\n"
            f"  Token    : {token}\n"
            f"  Ready at : {now.strftime('%I:%M %p')} IST\n\n"
            "Show this token at the counter. Enjoy your meal!\n"
        )
        return subject, message, "high", {}

    if event_type == "ORDER_COMPLETED":
        subject = f"[CampusEats] Order {order_id} collected - thank you!"
        message = f"Hello {reg_no},\n\nYour order {order_id} has been collected. Thanks for using CampusEats!\n"
        return subject, message, "low", {}

    if event_type == "TEST":
        subject = "[CampusEats] Test notification from SNS Live Monitor"
        message = (
            "This is a test event published from the CampusEats SNS Live Monitor.\n\n"
            f"Sent at {now.strftime('%d %b %Y %I:%M:%S %p')} IST via API Gateway -> Lambda -> SNS.\n"
        )
        return subject, message, "low", {}

    eta = estimate_pickup_minutes(tokens, now)
    ready_by = (now + timedelta(minutes=eta)).strftime("%I:%M %p")
    subject = f"[CampusEats] Order Confirmed: {order_id}"
    message = (
        f"Hello {reg_no},\n\n"
        "Your campus food order has been placed successfully!\n\n"
        "==================================================\n"
        "ORDER SUMMARY\n"
        "==================================================\n"
        f"Order ID   : {order_id}\n"
        f"Total Paid : Rs.{total}\n"
        f"Est. Ready : ~{eta} min (around {ready_by} IST)\n\n"
        f"YOUR PICKUP TOKENS:\n{token_lines}\n\n"
        "You will get another notification the moment your food is READY.\n"
        "==================================================\n"
    )
    return subject, message, "normal", {"etaMinutes": eta, "readyBy": ready_by}


def lambda_handler(event, context):
    print("Received event:", json.dumps(event))

    method = event.get("requestContext", {}).get("http", {}).get("method") or event.get("httpMethod", "")
    if method == "OPTIONS":
        return {"statusCode": 200, "headers": CORS_HEADERS, "body": ""}

    try:
        body = event.get("body") or "{}"
        data = json.loads(body) if isinstance(body, str) else body

        event_type = str(data.get("eventType", "ORDER_PLACED")).upper()
        if event_type not in VALID_EVENTS:
            return _response(400, {"success": False, "error": f"Unknown eventType '{event_type}'"})

        event_id = data.get("eventId")
        if event_id and event_id in _recent_event_ids:
            print(f"Duplicate eventId {event_id} - returning cached result")
            return _response(200, {**_recent_event_ids[event_id], "duplicate": True})

        now = datetime.now(IST)
        subject, message, priority, extra = build_message(event_type, data, now)
        shop_name = data.get("shopName") or next((t.get("shopName") for t in data.get("tokens", [])), "ALL")

        started = time.time()
        response = sns_client.publish(
            TopicArn=SNS_TOPIC_ARN,
            Subject=subject[:100],
            Message=message,
            MessageAttributes={
                "eventType": {"DataType": "String", "StringValue": event_type},
                "shopName": {"DataType": "String", "StringValue": shop_name or "ALL"},
                "priority": {"DataType": "String", "StringValue": priority},
            },
        )
        publish_ms = int((time.time() - started) * 1000)
        print(f"SNS publish OK: eventType={event_type} messageId={response.get('MessageId')} in {publish_ms}ms")

        result = {
            "success": True,
            "eventType": event_type,
            "messageId": response.get("MessageId"),
            "orderId": data.get("orderId"),
            "snsPublishMs": publish_ms,
            **extra,
        }
        if event_id:
            _recent_event_ids[event_id] = result
            if len(_recent_event_ids) > 500:
                _recent_event_ids.pop(next(iter(_recent_event_ids)))
        return _response(200, result)

    except Exception as e:
        print("Error publishing to SNS:", str(e))
        return _response(500, {"success": False, "error": str(e)})

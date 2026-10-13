/**
 * CampusEats - AWS SNS Notification Client (DA-3 Enhancement)
 *
 * Browser -> Amazon API Gateway -> AWS Lambda -> Amazon SNS
 *
 * Beyond a single fire-and-forget fetch, this client adds:
 *   - Order lifecycle events (ORDER_PLACED, ORDER_READY, ORDER_COMPLETED, TEST)
 *   - Retry with exponential backoff (mirrors SNS delivery retry policies)
 *   - Offline outbox: failed events are queued and re-published when the network returns
 *   - Idempotency: every event carries an eventId so retries never send duplicate emails
 *   - A local delivery log (messageId, latency, attempts) shown on the SNS Live Monitor page
 *
 * Depends on: aws-config.js (window.AWS_SNS_ENDPOINT)
 */

const AwsNotify = (() => {
    const LOG_KEY = 'ce_sns_log';
    const OUTBOX_KEY = 'ce_sns_outbox';
    const MAX_LOG = 50;
    const MAX_ATTEMPTS = 3;
    const TIMEOUT_MS = 8000;

    const read = (key) => {
        try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) { return []; }
    };
    const write = (key, value) => {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage unavailable */ }
    };

    const newEventId = () => (window.crypto && crypto.randomUUID)
        ? crypto.randomUUID()
        : 'evt-' + Date.now() + '-' + Math.random().toString(16).slice(2);

    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const inFlight = new Set();

    function addLog(entry) {
        const log = read(LOG_KEY);
        const idx = log.findIndex(l => l.eventId === entry.eventId);
        if (idx >= 0) log[idx] = { ...log[idx], ...entry };
        else log.unshift(entry);
        write(LOG_KEY, log.slice(0, MAX_LOG));
        window.dispatchEvent(new CustomEvent('sns-log-updated'));
    }

    async function send(endpoint, body) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                signal: controller.signal
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || data.success === false) {
                throw new Error(data.error || `HTTP ${res.status}`);
            }
            return data;
        } finally {
            clearTimeout(timer);
        }
    }

    /**
     * Publish an order event. Never throws — always resolves with a result object.
     */
    async function publish(eventType, payload = {}, existingEventId) {
        const endpoint = window.AWS_SNS_ENDPOINT || '';
        const eventId = existingEventId || newEventId();
        const body = { ...payload, eventType, eventId };

        const previous = read(LOG_KEY).find(l => l.eventId === eventId);
        const entry = {
            eventId,
            eventType,
            orderId: payload.orderId || '-',
            token: payload.token || (payload.tokens || []).map(t => t.token).join(', ') || '-',
            createdAt: previous ? previous.createdAt : new Date().toISOString(),
            status: 'PENDING',
            attempts: 0
        };
        addLog(entry);

        if (!endpoint) {
            addLog({ eventId, status: 'NOT_CONFIGURED', error: 'AWS_SNS_ENDPOINT is empty' });
            return { ok: false, eventId, error: 'not configured' };
        }

        // Persist first, so the event survives even if the page navigates away mid-request
        queueInOutbox({ eventType, payload, eventId });
        inFlight.add(eventId);

        const started = performance.now();
        let lastError = null;

        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            addLog({ eventId, attempts: attempt, status: attempt === 1 ? 'PUBLISHING' : 'RETRYING' });
            try {
                const data = await send(endpoint, body);
                const latencyMs = Math.round(performance.now() - started);
                const result = {
                    eventId,
                    status: 'DELIVERED',
                    messageId: data.messageId,
                    latencyMs,
                    attempts: attempt,
                    etaMinutes: data.etaMinutes,
                    readyBy: data.readyBy
                };
                addLog(result);
                removeFromOutbox(eventId);
                inFlight.delete(eventId);
                return { ok: true, ...result };
            } catch (err) {
                lastError = err.name === 'AbortError' ? 'timeout' : err.message;
                if (attempt < MAX_ATTEMPTS) await sleep(400 * Math.pow(3, attempt - 1)); // 400ms, 1.2s
            }
        }

        // All attempts failed: it stays in the outbox for later delivery
        inFlight.delete(eventId);
        addLog({ eventId, status: 'QUEUED', error: lastError, latencyMs: Math.round(performance.now() - started) });
        return { ok: false, eventId, queued: true, error: lastError };
    }

    function queueInOutbox(item) {
        const outbox = read(OUTBOX_KEY).filter(o => o.eventId !== item.eventId);
        outbox.push(item);
        write(OUTBOX_KEY, outbox);
    }

    function removeFromOutbox(eventId) {
        write(OUTBOX_KEY, read(OUTBOX_KEY).filter(o => o.eventId !== eventId));
    }

    let flushing = false;
    async function flushOutbox() {
        if (flushing || !navigator.onLine) return;
        flushing = true;
        try {
            for (const item of read(OUTBOX_KEY)) {
                if (inFlight.has(item.eventId)) continue;
                await publish(item.eventType, item.payload, item.eventId);
            }
        } finally {
            flushing = false;
        }
    }

    window.addEventListener('online', flushOutbox);
    window.addEventListener('load', () => setTimeout(flushOutbox, 1500));

    return {
        publish,
        flushOutbox,
        getLog: () => read(LOG_KEY),
        getOutbox: () => read(OUTBOX_KEY),
        clearLog: () => { write(LOG_KEY, []); window.dispatchEvent(new CustomEvent('sns-log-updated')); },
        findByOrder: (orderId) => read(LOG_KEY).find(l => l.orderId === orderId)
    };
})();

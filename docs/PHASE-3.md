# Phase 3: Redis + Streaming (SSE, Rate Limiter, Answer Cache)

1. **Upstash Redis REST Client:** `db/redis.ts` me HTTP fetch-based Upstash Redis client banaya jo serverless aur cloud deploy ke liye 100% ready hai.
2. **Resilient Local Fallback:** Agar internet ya Redis credentials unreachable hon, toh in-memory Map fallback gracefully background me switch ho jata hai.
3. **Redis Rate Limiter:** `middleware/rateLimit.ts` har authenticated user/IP par sliding window tracking karta hai (20 requests / 60 seconds).
4. **Rate Limit Headers:** Har response ke sath standard `X-RateLimit-Limit` aur `X-RateLimit-Remaining` headers attach hote hain.
5. **429 Exceeded Response:** Limit cross hone par standard `{ error: { code: "RATE_LIMIT_EXCEEDED" } }` aur `Retry-After: 60` return hota hai.
6. **RAG Answer Cache:** Duplicate questions ke liye `lib/cache.ts` documentId aur question ka SHA-256 hash banakar Redis me 1 ghante tak answer cache karta hai.
7. **Instant Response & Zero Token Spend:** Cache hit hone par LLM call skip ho jaati hai aur response 4 second ke bajaye sub-second me `cached: true` ke sath return hota hai.
8. **Server-Sent Events (SSE) Streaming:** `POST /api/chat/stream` endpoint banaya jo `text/event-stream` headers ke sath connection open rakhta hai.
9. **Real-time Token Forwarding:** Groq LLaMA 3.1 ke stream deltas ko Node native https module se read karke token-by-token client ko realtime me deliver kiya.
10. **Dual Delivery:** Pehle `sources` event bheja jata hai, phir continuous `token` chunks, aur aakhri me `done` event bhejkar connection gracefully close hota hai.

# Phase 1: Backend Foundation + Database + Auth

1. **Architecture & Layers:** Humne Express + TypeScript ka modular structure setup kiya: routes -> controllers -> services -> db pool.
2. **PostgreSQL & pgvector:** Docker Compose se PostgreSQL 16 container me `pgvector` extension enable kiya, jo future me 768-dim embeddings store karega.
3. **Database Schema:** `users`, `documents`, aur `chunks` tables create kiye foreign key constraints aur ON DELETE CASCADE ke saath.
4. **Environment Safety:** `config/env.ts` me Zod validation lagaya taaki missing secrets (DATABASE_URL, JWT_SECRET) par server start hote hi fail ho jaye.
5. **Clean Error Handling:** Centralized `errorHandler` aur custom `HttpError` banaya jo standard format `{ error: { code, message } }` return karta hai.
6. **Request Validation:** Zod middleware `validate()` banaya jo req.body, req.query aur req.params ko route execute hone se pehle sanitize aur check karta hai.
7. **Secure Password Hashing:** User register hone par `bcryptjs` (10 salt rounds) se password ko cryptographic hash banakar database me save kiya.
8. **Stateless JWT Auth:** Login par verify karke user payload (`id`, `email`, `role`) ke sath signed JWT generate hota hai jo 1 day me expire hota hai.
9. **Role-Based Access Control:** `authenticate` middleware Bearer token verify karta hai aur `requireRole('admin')` sirf authorized admins ko allow karta hai.
10. **Graceful Shutdown:** `SIGINT` aur `SIGTERM` signals par running HTTP requests ko drain karke PostgreSQL connection pool cleanly close hota hai.

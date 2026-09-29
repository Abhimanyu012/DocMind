# Phase 2: Upload + RAG Chat (Chunking, Gemini Embeddings, pgvector, Groq LLM)

1. **Document Upload:** Multer middleware memory-storage ke sath file buffer read karta hai, temporary disk files nahi chhodta.
2. **Text Chunker:** `lib/chunker.ts` sliding window algorithm (500 chars, 100 overlap) se document ko clean sentence/paragraph boundaries par split karta hai.
3. **Verified Gemini Embeddings:** Google ke verified `gemini-embedding-001` model se `outputDimensionality: 768` set karke vector embeddings generate kiye.
4. **pgvector Storage:** Har chunk ka 768-dimensional embedding PostgreSQL `chunks` table me `vector` data-type me store hota hai.
5. **Ownership Isolation:** Security Rule 3 ke mutabiq har document upload, list, retrieve, aur delete query strictly `user_id` se isolated hai.
6. **Cascade Delete:** Document delete hone par PostgreSQL foreign key constraint `ON DELETE CASCADE` se saare associated chunks automatically delete ho jaate hain.
7. **Vector Similarity Search:** Chat query aane par pehle question ka embedding banta hai, phir pgvector cosine distance operator (`<=>`) se top-4 closest chunks match hote hain.
8. **Prompt Grounding:** Retrieved chunks ko format karke system prompt me inject kiya jata hai taaki LLM hallucinate na kare.
9. **Verified Groq Generation:** Groq ke verified high-speed LLM endpoint se contextually accurate grounded response aur citation sources return hote hain.
10. **Layered Architecture:** Controllers transport handle karte hain, Services business logic aur DB operations run karti hain, aur Libs external AI APIs wrap karti hain.

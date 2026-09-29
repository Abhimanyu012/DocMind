import { Router } from 'express';
import multer from 'multer';
import { documentsController } from './documents.controller';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { documentIdParamSchema } from './documents.schemas';

const router = Router();

// Store file in memory buffer for immediate chunking and embedding generation
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB file size limit
  },
});

// All document routes require authentication
router.use(authenticate);

router.post('/', upload.single('file'), (req, res, next) => documentsController.upload(req, res, next));
router.get('/', (req, res, next) => documentsController.list(req, res, next));
router.get('/:id', validate(documentIdParamSchema), (req, res, next) => documentsController.getById(req, res, next));
router.delete('/:id', validate(documentIdParamSchema), (req, res, next) => documentsController.delete(req, res, next));

export const documentRoutes = router;

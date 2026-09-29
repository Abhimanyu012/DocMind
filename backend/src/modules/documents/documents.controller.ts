import { Request, Response, NextFunction } from 'express';
import { documentsService } from './documents.service';
import { HttpError } from '../../lib/httpError';

// WHY: Handles HTTP transport for document management endpoints.
export class DocumentsController {
  async upload(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        throw new HttpError(400, 'No file was uploaded', 'FILE_REQUIRED');
      }

      const userId = req.user!.id;
      const originalname = req.file.originalname;
      const textContent = req.file.buffer.toString('utf-8');
      const title = (req.body.title as string) || originalname;

      const document = await documentsService.uploadDocument(userId, originalname, textContent, title);
      res.status(201).json({ document });
    } catch (error) {
      next(error);
    }
  }

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const documents = await documentsService.listDocuments(userId);
      res.status(200).json({ documents });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const documentId = req.params.id as string;
      const document = await documentsService.getDocument(userId, documentId);
      res.status(200).json({ document });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const documentId = req.params.id as string;
      await documentsService.deleteDocument(userId, documentId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}

export const documentsController = new DocumentsController();

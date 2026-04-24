import { Router } from 'express';

/**
 * @param {{imageUploadController: any}} deps
 */
export function createSubirPdfRoutes({ imageUploadController }) {
  const router = Router();
  router.post('/tokenize-image', imageUploadController.tokenizeImage);
  router.post('/upload-mainnet', imageUploadController.uploadToMainnet);
  return router;
}

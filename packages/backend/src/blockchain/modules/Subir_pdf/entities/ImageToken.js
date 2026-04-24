import crypto from 'node:crypto';

/**
 * @param {{fileName: string, mimeType: string, contentBase64: string}} input
 */
export function createImageToken(input) {
  return {
    tokenId: `img_${crypto.randomUUID()}`,
    fileName: input.fileName,
    mimeType: input.mimeType,
    contentBase64: input.contentBase64,
    status: 'tokenized',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

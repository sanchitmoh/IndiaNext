// Cloudinary File Upload Service
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export { cloudinary };

// Generate upload signature for client-side upload
export async function getUploadSignature(folder: string = 'indianext') {
  const timestamp = Math.round(new Date().getTime() / 1000);

  const signature = cloudinary.utils.api_sign_request(
    {
      timestamp,
      folder,
      upload_preset: 'indianext_preset', // Create this in Cloudinary dashboard
    },
    process.env.CLOUDINARY_API_SECRET!
  );

  return {
    signature,
    timestamp,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    folder,
  };
}

// Maximum upload size: 10 MB
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIME_PREFIXES = ['image/', 'video/', 'application/pdf'];

// Upload file from server (if needed)
export async function uploadFile(
  file: Buffer,
  options: {
    folder?: string;
    resourceType?: 'image' | 'video' | 'raw' | 'auto';
    publicId?: string;
    mimeType?: string;
  } = {}
) {
  // Validate file size
  if (file.length > MAX_UPLOAD_SIZE) {
    throw new Error(`File too large. Maximum size is ${MAX_UPLOAD_SIZE / 1024 / 1024} MB.`);
  }

  if (file.length === 0) {
    throw new Error('File is empty.');
  }

  // Validate MIME type if provided
  if (options.mimeType && !ALLOWED_MIME_PREFIXES.some((p) => options.mimeType!.startsWith(p))) {
    throw new Error(`Unsupported file type: ${options.mimeType}`);
  }

  try {
    const result = await cloudinary.uploader.upload(
      `data:${options.resourceType || 'auto'};base64,${file.toString('base64')}`,
      {
        folder: options.folder || 'indianext',
        resource_type: options.resourceType || 'auto',
        public_id: options.publicId,
      }
    );

    return {
      url: result.secure_url,
      publicId: result.public_id,
      format: result.format,
      width: result.width,
      height: result.height,
      bytes: result.bytes,
    };
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw new Error('Failed to upload file');
  }
}

// Delete file
export async function deleteFile(publicId: string) {
  // Validate publicId format to prevent path traversal
  if (!publicId || /[<>"|?*]/.test(publicId)) {
    throw new Error('Invalid public ID');
  }

  try {
    await cloudinary.uploader.destroy(publicId);
    return { success: true };
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    throw new Error('Failed to delete file');
  }
}

// Generate thumbnail for video
export async function generateVideoThumbnail(publicId: string) {
  return cloudinary.url(publicId, {
    resource_type: 'video',
    transformation: [
      { width: 400, height: 300, crop: 'fill' },
      { quality: 'auto' },
      { fetch_format: 'jpg' },
    ],
  });
}

// Optimize image URL
export function getOptimizedImageUrl(
  publicId: string,
  options: {
    width?: number;
    height?: number;
    quality?: string;
    format?: string;
  } = {}
) {
  return cloudinary.url(publicId, {
    transformation: [
      { width: options.width, height: options.height, crop: 'fill' },
      { quality: options.quality || 'auto' },
      { fetch_format: options.format || 'auto' },
    ],
  });
}

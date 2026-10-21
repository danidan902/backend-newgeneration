const cloudinary = require('./cloudinaryConfig');
const path = require('path');

/**
 * Upload a Buffer directly to Cloudinary.
 * @param {Buffer} buffer
 * @param {String} originalName
 * @param {Object} opts  { folder = 'profile-images', resourceType }
 */
const uploadBufferToCloudinary = (buffer, originalName, opts = {}) => {
  return new Promise((resolve, reject) => {
    if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
      return reject(new Error('Empty or invalid file buffer'));
    }

    const ext = path.extname(originalName || '').toLowerCase();
    const isPdf = ext === '.pdf';
    const resourceType = opts.resourceType || (isPdf ? 'raw' : 'image');
    const folder = opts.folder || 'profile-images';

    const uploadOptions = {
      folder,
      resource_type: resourceType,
      public_id: `${Date.now()}-${Math.round(Math.random() * 1e9)}`,
      overwrite: false,
      invalidate: true,
    };

    if (resourceType === 'image') {
      uploadOptions.transformation = [{ quality: 'auto', fetch_format: 'auto' }];
    }
    if (isPdf) {
      uploadOptions.format = 'pdf';
    }

    const stream = cloudinary.uploader.upload_stream(uploadOptions, (err, result) => {
      if (err) {
        console.error('❌ Cloudinary upload_stream error:', {
          message: err.message,
          http_code: err.http_code,
          name: err.name,
        });
        return reject(err);
      }
      resolve(result);
    });

    stream.end(buffer);
  });
};

/**
 * Delete an asset from Cloudinary. Safe: never throws.
 */
const deleteFromCloudinary = async (publicId, resourceType = 'image') => {
  if (!publicId) return null;
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
      invalidate: true,
    });
    if (result.result !== 'ok' && result.result !== 'not found') {
      console.warn('⚠️ Cloudinary delete returned:', result);
    }
    return result;
  } catch (err) {
    console.warn('⚠️ Cloudinary delete failed:', err.message);
    return null;
  }
};

module.exports = { uploadBufferToCloudinary, deleteFromCloudinary };
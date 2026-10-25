// backend/config/multer.js
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('./cloudinary');

const storage = new CloudinaryStorage({
  cloudinary,
  params: (req, file) => {
    const originalName = file.originalname || '';
    const ext = originalName.split('.').pop().toLowerCase();
    const isHeic = ext === 'heic' || ext === 'heif';
    const mime = (file.mimetype || '').toLowerCase();
    const isHeicMime = mime === 'image/heic' || mime === 'image/heif';

    return {
      folder: 'profile-images',
      resource_type: 'image',
      // ✅ Accept HEIC/HEIF too — phones upload these
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif'],

      // ✅ Convert HEIC → JPG on upload (browsers can't render HEIC in <img>)
      format: isHeic || isHeicMime ? 'jpg' : undefined,

      // Resize + optimize
      transformation: [
        { width: 600, height: 600, crop: 'limit' },
        { quality: 'auto:good', fetch_format: 'auto' },
      ],

      public_id: () =>
        `profile-images/${Date.now()}-${Math.round(Math.random() * 1e9)}`,
    };
  },
});

const upload = multer({
  storage,
  // ✅ Phone photos often exceed 5MB — raise to 15MB
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    // Accept by MIME **or** by file extension
    // (iPhone HEIC sometimes has empty or wrong mimetype)
    const mime = (file.mimetype || '').toLowerCase();
    const ext = (file.originalname || '').split('.').pop().toLowerCase();

    const okMime = mime.startsWith('image/');
    const okExt = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif'].includes(ext);

    if (okMime || okExt) {
      return cb(null, true);
    }
    cb(
      new Error(
        'Only image files are allowed (JPG, JPEG, PNG, WEBP, GIF, HEIC, HEIF)'
      )
    );
  },
});

module.exports = upload;

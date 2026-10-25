// // backend/config/multer.js
// const multer = require('multer');
// const { CloudinaryStorage } = require('multer-storage-cloudinary');
// const cloudinary = require('./cloudinary');

// const storage = new CloudinaryStorage({
//   cloudinary,
//   params: (req, file) => {
//     const originalName = file.originalname || '';
//     const ext = originalName.split('.').pop().toLowerCase();
//     const isHeic = ext === 'heic' || ext === 'heif';
//     const mime = (file.mimetype || '').toLowerCase();
//     const isHeicMime = mime === 'image/heic' || mime === 'image/heif';

//     return {
//       folder: 'profile-images',
//       resource_type: 'image',
//       allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif'],
//       format: isHeic || isHeicMime ? 'jpg' : undefined,
//       transformation: [
//         { width: 600, height: 600, crop: 'limit' },
//         { quality: 'auto:good', fetch_format: 'auto' },
//       ],
//       public_id: () =>
//         `profile-images/${Date.now()}-${Math.round(Math.random() * 1e9)}`,
//     };
//   },
// });

// const upload = multer({
//   storage,
//   limits: { fileSize: 15 * 1024 * 1024 }, // ✅ 15 MB — phone photos are 5-8 MB
//   fileFilter: (req, file, cb) => {
//     const mime = (file.mimetype || '').toLowerCase();
//     const ext = (file.originalname || '').split('.').pop().toLowerCase();

//     const okMime = mime.startsWith('image/');
//     const okExt = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif'].includes(ext);

//     // Accept by MIME **or** by extension (iPhone HEIC often has empty MIME)
//     if (okMime || okExt) {
//       return cb(null, true);
//     }
//     cb(new Error('Only image files are allowed (JPG, PNG, WEBP, HEIC)'));
//   },
// });

// module.exports = upload;


// backend/config/multer.js
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('./cloudinary');

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder: 'students',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
    transformation: [{ width: 500, height: 500, crop: 'limit', quality: 'auto' }],
    public_id: `student-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
  }),
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'), false);
    }
    cb(null, true);
  },
});

module.exports = upload;

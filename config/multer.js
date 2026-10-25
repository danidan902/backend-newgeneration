// const multer = require('multer');
// const path = require('path');
// const fs = require('fs');

// // Ensure upload directories exist
// const uploadDir = 'uploads/profile-images';
// if (!fs.existsSync(uploadDir)) {
//   fs.mkdirSync(uploadDir, { recursive: true });
// }

// // Configure storage
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, uploadDir);
//   },
//   filename: (req, file, cb) => {
//     const userId = req.params.userId || req.body.userId || Date.now();
//     const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
//     const ext = path.extname(file.originalname);
//     cb(null, 'profile-' + userId + '-' + uniqueSuffix + ext);
//   }
// });

// // File filter for images
// const fileFilter = (req, file, cb) => {
//   const allowedTypes = /jpeg|jpg|png|gif|webp/;
//   const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
//   const mimetype = allowedTypes.test(file.mimetype);
  
//   if (mimetype && extname) {
//     return cb(null, true);
//   } else {
//     cb(new Error('Only image files (jpeg, jpg, png, gif, webp) are allowed!'));
//   }
// };

// // Create multer upload instance
// const upload = multer({
//   storage: storage,
//   limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
//   fileFilter: fileFilter
// });

// module.exports = upload;

// backend/config/multer.js
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('./cloudinary');

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'profile-images',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
    transformation: [
      { width: 500, height: 500, crop: 'limit' },
      { quality: 'auto', fetch_format: 'auto' },
    ],
    public_id: (req, file) => {
      return `profile-images/${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    },
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  },
});

module.exports = upload;
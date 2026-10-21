const cloudinary = require('cloudinary').v2;
const dotenv = require('dotenv');

dotenv.config();

cloudinary.config({
  cloud_name: (process.env.CLOUDINARY_CLOUD_NAME || '').trim(),
  api_key:    (process.env.CLOUDINARY_API_KEY    || '').trim(),
  api_secret: (process.env.CLOUDINARY_API_SECRET || '').trim(),
  secure: true,
});

// One-time sanity check at startup
if (
  !process.env.CLOUDINARY_CLOUD_NAME ||
  !process.env.CLOUDINARY_API_KEY ||
  !process.env.CLOUDINARY_API_SECRET
) {
  console.error('❌ Cloudinary env vars missing! Check backend/.env');
} else {
  console.log('☁️ Cloudinary configured for cloud:', process.env.CLOUDINARY_CLOUD_NAME);
}

if (typeof cloudinary.uploader?.upload_stream !== 'function') {
  throw new Error('Cloudinary SDK not loaded correctly — uploader.upload_stream is missing');
}

module.exports = cloudinary;
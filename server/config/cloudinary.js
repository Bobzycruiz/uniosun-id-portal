// config/cloudinary.js
//
// WHY CLOUDINARY (and why not just keep saving to /uploads):
// Free hosting platforms (Render, Railway, etc.) run your app in a
// container that gets rebuilt on every restart or redeploy — any files
// your app wrote to its own local disk (like /uploads) simply vanish
// when that happens. Cloudinary is a cloud file-storage service built
// for exactly this: you upload an image once, it lives there
// permanently (on their storage, not yours), and you get back a
// permanent URL to store in your database instead of a local file
// path. The free tier (25GB storage) is more than enough for a staff
// ID portal.

const { v2: cloudinary } = require('cloudinary');
require('dotenv').config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

module.exports = cloudinary;

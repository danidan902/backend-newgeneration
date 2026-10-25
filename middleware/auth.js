// backend/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  const authHeader = req.header('Authorization');
  const token = authHeader?.replace('Bearer ', '');
  
  console.log('🔐 Auth Middleware');
  console.log('Token exists:', !!token);
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    const JWT_SECRET = process.env.JWT_SECRET || 'my_test_secret_key_12345';
    const decoded = jwt.verify(token, JWT_SECRET);
    
    console.log('📦 Decoded token:', decoded);
    console.log('Decoded keys:', Object.keys(decoded));
    
    // Try multiple possible field names
    req.user = decoded;
    req.userId = decoded.userId || decoded.id || decoded._id || decoded.userId;
    req.userRole = decoded.role;
    req.userEmail = decoded.email;
    
    // If userId is still undefined, try to get from user object
    if (!req.userId && decoded.user) {
      req.userId = decoded.user._id || decoded.user.id;
    }
    
    console.log('✅ Set userId:', req.userId);
    console.log('✅ Set userRole:', req.userRole);
    console.log('✅ Set userEmail:', req.userEmail);
    
    if (!req.userId) {
      console.error('❌ Failed to extract userId from token!');
      return res.status(401).json({ error: 'Invalid token structure. Please login again.' });
    }
    
    next();
  } catch (error) {
    console.error('❌ Token verification failed:', error.message);
    res.status(401).json({ error: 'Invalid token. Please login again.' });
  }
};

const roleMiddleware = (roles) => {
  return (req, res, next) => {
    if (req.userRole === 'superadmin') {
      return next();
    }
    if (!roles.includes(req.userRole)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    next();
  };
};

module.exports = { authMiddleware, roleMiddleware };
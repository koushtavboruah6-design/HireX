/**
 * middleware/auth.js
 * JWT verification middleware for protected recruiter routes.
 */
const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization header missing' });
  }

  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireRecruiter(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user?.role !== 'recruiter') {
      return res.status(403).json({ error: 'Recruiter access required' });
    }
    next();
  });
}

module.exports = { requireAuth, requireRecruiter };

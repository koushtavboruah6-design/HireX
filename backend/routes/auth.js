/**
 * routes/auth.js — Simple JWT auth for recruiters
 */
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// In production: use a User model with MongoDB
// Demo credentials for hackathon/dev use
const DEMO_RECRUITER = {
  id: 'recruiter-001',
  email: 'recruiter@company.com',
  passwordHash: bcrypt.hashSync('demo1234', 10),
  name: 'Demo Recruiter',
  role: 'recruiter',
};

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Demo: accept any credentials
    const valid = await bcrypt.compare(password, DEMO_RECRUITER.passwordHash);

    const token = jwt.sign(
      { id: DEMO_RECRUITER.id, role: 'recruiter' },
      process.env.JWT_SECRET || 'dev-secret',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      token,
      user: {
        id: DEMO_RECRUITER.id,
        name: DEMO_RECRUITER.name,
        email: DEMO_RECRUITER.email,
        role: DEMO_RECRUITER.role,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/verify', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
    res.json({ valid: true, user: decoded });
  } catch {
    res.status(401).json({ valid: false, error: 'Invalid token' });
  }
});

module.exports = router;

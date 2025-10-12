const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.POSTGRES_USER || 'catalyst_user',
  host: process.env.POSTGRES_HOST || 'postgres',
  database: process.env.POSTGRES_DB || 'catalyst_users',
  password: process.env.POSTGRES_PASSWORD || 'catty123',
  port: 5432,
});

const protect = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    
    // Get full user info including ngoId
    const result = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.role, n.id as ngo_id 
       FROM users u 
       LEFT JOIN ngos n ON u.id = n.owner_id 
       WHERE u.id = $1`,
      [decoded.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    req.user = {
      id: result.rows[0].id,
      name: result.rows[0].full_name,
      email: result.rows[0].email,
      role: result.rows[0].role,
      ngoId: result.rows[0].ngo_id
    };
    
    next();
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(401).json({ error: 'Invalid token' });
  }
};

module.exports = { protect };

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.POSTGRES_USER || 'catalyst_user',
  host: process.env.POSTGRES_HOST || 'postgres',
  database: process.env.POSTGRES_DB || 'catalyst_users',
  password: process.env.POSTGRES_PASSWORD || 'catty123',
  port: 5432,
});

const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const result = await pool.query(
      'INSERT INTO users (full_name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, full_name, email, role',
      [name, email, hashedPassword, role || 'donor']
    );
    
    const token = jwt.sign({ id: result.rows[0].id }, process.env.JWT_SECRET || 'secret', { expiresIn: '24h' });
    
    res.json({ 
      token, 
      user: { 
        id: result.rows[0].id, 
        name: result.rows[0].full_name, 
        email: result.rows[0].email,
        role: result.rows[0].role
      } 
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(400).json({ error: 'Registration failed' });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const result = await pool.query(
      'SELECT u.*, n.id as ngo_id FROM users u LEFT JOIN ngos n ON u.id = n.owner_id WHERE u.email = $1',
      [email]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = result.rows[0];
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign({ id: user.id, ngoId: user.ngo_id }, process.env.JWT_SECRET || 'secret', { expiresIn: '24h' });
    
    res.json({ 
      token, 
      user: { 
        id: user.id, 
        name: user.full_name, 
        email: user.email,
        role: user.role,
        ngoId: user.ngo_id
      } 
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
};

module.exports = { register, login };

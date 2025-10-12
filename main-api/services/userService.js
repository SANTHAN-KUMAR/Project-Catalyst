const db = require('./database');

const createUser = async (email, passwordHash, fullName, role) => {
  const queryText = 'INSERT INTO users(email, password_hash, full_name, role) VALUES($1, $2, $3, $4) RETURNING id, email, full_name, role';
  const values = [email, passwordHash, fullName, role];
  const { rows } = await db.query(queryText, values);
  return rows[0];
};

const findUserByEmail = async (email) => {
  const queryText = 'SELECT * FROM users WHERE email = $1';
  const { rows } = await db.query(queryText, [email]);
  return rows[0];
};

module.exports = {
  createUser,
  findUserByEmail,
};

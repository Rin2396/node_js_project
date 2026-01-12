const express = require('express');
const { Pool } = require('pg');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

require('dotenv').config();
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');

const swaggerDocument = YAML.load(path.join(__dirname, 'openapi.yaml'));




const app = express();
const port = 3000;

// PostgreSQL connection
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'memedb',
  password: 'test123',
  port: 5432,
});
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use(bodyParser.json());
app.get('/openapi.yaml', (req, res) => {
  res.sendFile(path.join(__dirname, 'openapi.yaml'));
});

// Middleware to handle errors
function errorHandler(err, req, res, next) {
  res.status(500).json({ error: err.message });
}

const auth = require('./middleware/auth');


// Register endpoint
app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  try {
    // Check if user exists
    const userCheck = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (userCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    const newUser = await pool.query(
      'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id, username',
      [username, hashedPassword]
    );
    res.status(201).json({ message: 'User registered', user: newUser.rows[0] });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  try {
    const userQuery = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (userQuery.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid username or password' });
    }

    const user = userQuery.rows[0];
    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(400).json({ error: 'Invalid username or password' });
    }

    // Create JWT token
    const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '1h' });

    res.json({ message: 'Login successful', token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


// GET /api/memes - Get all memes
app.get('/api/memes', auth, async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM memes ORDER BY createdat DESC');
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/memes/random - Get a random meme
app.get('/api/memes/random', auth, async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM memes ORDER BY RANDOM() LIMIT 1');
    if (rows.length === 0) {
      return res.status(404).send('No memes found');
    }
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// GET /api/memes/:id - Get meme by ID
app.get('/api/memes/:id', auth, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const { rows } = await pool.query('SELECT * FROM memes WHERE id = $1', [id]);
    if (rows.length === 0) {
      return res.status(404).send('Meme not found');
    }
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// POST /api/memes - Create a new meme
app.post('/api/memes', auth, async (req, res, next) => {
  try {
    const { title, description, imageUrl } = req.body;
    if (!title || !imageUrl) {
      return res.status(400).send('Title and imageUrl are required');
    }
    if (title.length > 100) {
      return res.status(400).send('Title max length is 100');
    }
    if (description && description.length > 300) {
      return res.status(400).send('Description max length is 300');
    }

    const { rows } = await pool.query(
      'INSERT INTO memes (title, description, imageurl, createdat) VALUES ($1, $2, $3, NOW()) RETURNING *',
      [title, description, imageUrl]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

app.use(errorHandler);
//app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.listen(port, () => {
  console.log(`Meme app listening on port ${port}`);
});

module.exports = app;


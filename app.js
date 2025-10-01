const express = require('express');
const { Pool } = require('pg');
const bodyParser = require('body-parser');

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

app.use(bodyParser.json());

// Middleware to handle errors
function errorHandler(err, req, res, next) {
  res.status(500).json({ error: err.message });
}

// GET /api/memes - Get all memes
app.get('/api/memes', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM memes ORDER BY createdat DESC');
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/memes/random - Get a random meme
app.get('/api/memes/random', async (req, res, next) => {
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
app.get('/api/memes/:id', async (req, res, next) => {
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
app.post('/api/memes', async (req, res, next) => {
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

app.listen(port, () => {
  console.log(`Meme app listening on port ${port}`);
});

module.exports = app;


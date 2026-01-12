// auth.test.js
const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

jest.mock('pg', () => {
  const mQuery = jest.fn();
  const mPool = { query: mQuery };
  return { Pool: jest.fn(() => mPool) };
});

jest.mock('bcrypt');
jest.mock('jsonwebtoken');

const { Pool } = require('pg');
const app = require('./app');
const auth = require('./middleware/auth');

describe('Auth middleware and endpoints', () => {
  let mPool;

  beforeEach(() => {
    jest.clearAllMocks();
    mPool = new Pool();
  });

  // auth middleware tests
  describe('auth middleware', () => {
    let req, res, next;

    beforeEach(() => {
      req = { header: jest.fn() };
      res = { status: jest.fn(() => res), json: jest.fn() };
      next = jest.fn();
    });

    it('passes valid token and calls next', () => {
      req.header.mockReturnValue('Bearer valid.token');
      jwt.verify.mockReturnValue({ id: 123, username: 'user' });

      auth(req, res, next);

      expect(jwt.verify).toHaveBeenCalledWith('valid.token', process.env.JWT_SECRET);
      expect(req.user).toEqual({ id: 123, username: 'user' });
      expect(next).toHaveBeenCalled();
    });

    it('returns 401 if token missing', () => {
      req.header.mockReturnValue(undefined);

      auth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Access denied. No token provided.' });
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 400 if invalid token', () => {
      req.header.mockReturnValue('Bearer invalid.token');
      jwt.verify.mockImplementation(() => { throw new Error('invalid token'); });

      auth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/auth/register', () => {
    it('registers a new user successfully', async () => {
      mPool.query.mockResolvedValueOnce({ rows: [] });
      mPool.query.mockResolvedValueOnce({ rows: [{ id: 1, username: 'newuser' }] });
      bcrypt.hash.mockResolvedValue('hashedpassword');

      const res = await request(app).post('/api/auth/register').send({
        username: 'newuser',
        password: 'Password1!',
      });

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('message', 'User registered');
      expect(res.body.user.username).toBe('newuser');
    });

    it('rejects registration if username taken', async () => {
      mPool.query.mockResolvedValueOnce({ rows: [{ id: 1, username: 'existinguser' }] });

      const res = await request(app).post('/api/auth/register').send({
        username: 'existinguser',
        password: 'Password1!',
      });

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error', 'Username already taken');
    });
  });

  describe('POST /api/auth/login', () => {
    it('logs in successfully and returns token', async () => {
      mPool.query.mockResolvedValue({
        rows: [{ id: 1, username: 'testuser', password: 'hashedpassword' }],
      });
      bcrypt.compare.mockResolvedValue(true);
      jwt.sign.mockReturnValue('signed.jwt.token');

      const res = await request(app).post('/api/auth/login').send({
        username: 'testuser',
        password: 'Password1!',
      });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('message', 'Login successful');
      expect(res.body).toHaveProperty('token', 'signed.jwt.token');
    });

    it('rejects invalid username or password', async () => {
      mPool.query.mockResolvedValue({ rows: [] });

      const res = await request(app).post('/api/auth/login').send({
        username: 'wronguser',
        password: 'Password1!',
      });

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error', 'Invalid username or password');
    });
  });
});

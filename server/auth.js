'use strict';

const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { query } = require('./db');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'mulata-dev-secret-cambiar';
const TOKEN_TTL = '30d'; // sesión larga: app de uso diario en móvil.

/**
 * POST /api/auth/login
 * Valida credenciales contra la tabla users; si la tabla aún no tiene al
 * usuario (p. ej. primer arranque), valida directamente contra las env vars.
 */
router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña son obligatorios.' });
  }

  try {
    let valid = false;

    const { rows } = await query('SELECT password_hash FROM users WHERE username = $1', [username]);
    if (rows.length > 0) {
      valid = bcrypt.compareSync(password, rows[0].password_hash);
    } else if (
      username === process.env.AUTH_USERNAME &&
      password === process.env.AUTH_PASSWORD
    ) {
      // Respaldo: credenciales directas por env si el usuario aún no está sembrado.
      valid = true;
    }

    if (!valid) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
    }

    const token = jwt.sign({ sub: username }, JWT_SECRET, { expiresIn: TOKEN_TTL });
    return res.json({ token, username });
  } catch (err) {
    console.error('[Mulata] Error en login:', err.message);
    return res.status(500).json({ error: 'Error del servidor durante el login.' });
  }
});

/**
 * GET /api/auth/me — comprueba que el token sigue siendo válido.
 */
router.get('/me', requireAuth, (req, res) => {
  res.json({ username: req.user.sub });
});

/**
 * Middleware que protege las rutas: exige un Bearer token válido.
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'No autenticado.' });
  }
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ error: 'Sesión expirada o token inválido.' });
  }
}

module.exports = { router, requireAuth };

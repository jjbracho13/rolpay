import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import db from '../db/connection.js';

const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
if (!process.env.JWT_SECRET) {
  console.warn('WARN: JWT_SECRET no estaba definido. Se generó uno temporal. Los tokens anteriores serán inválidos.');
}

export interface AuthRequest extends Request {
  userId?: number;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  let token: string | undefined;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query && (req.query as any).token) {
    token = String((req.query as any).token);
  }

  if (!token) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET!) as { userId: number };
    req.userId = decoded.userId;

    const user = db.prepare('SELECT activo FROM usuarios WHERE id = ?').get(req.userId) as any;
    if (user && user.activo === 0) {
      return res.status(403).json({ error: 'Tu cuenta ha sido bloqueada. Contacta al administrador.' });
    }

    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido' });
  }
}

export function adminMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.userId) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  const user = db.prepare('SELECT rol FROM usuarios WHERE id = ?').get(req.userId) as any;

  if (!user || user.rol !== 'admin') {
    return res.status(403).json({ error: 'Solo los administradores pueden modificar la configuración' });
  }

  next();
}

export { JWT_SECRET };

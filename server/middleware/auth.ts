import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import db from '../db/connection.js';

const JWT_SECRET = process.env.JWT_SECRET || 'rolpay_secret_key_2024';

export interface AuthRequest extends Request {
  userId?: number;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
    req.userId = decoded.userId;
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

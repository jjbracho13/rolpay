import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH || path.join(__dirname, 'rolpay.db');

const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    cedula TEXT DEFAULT '',
    cargo TEXT DEFAULT '',
    rol TEXT DEFAULT 'user' CHECK(rol IN ('admin', 'user')),
    foto_perfil TEXT DEFAULT '',
    activo INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS configuracion (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER UNIQUE NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    sueldo_base REAL DEFAULT 487,
    horas_std REAL DEFAULT 240,
    aporte_iess_pct REAL DEFAULT 9.45,
    subsidio_medico REAL DEFAULT 0,
    anticipo_quincena REAL DEFAULT 194.80,
    prestamo_quirografario REAL DEFAULT 92.43,
    fondo_reserva_pct REAL DEFAULT 8.33,
    bonificacion REAL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS registros (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    mes INTEGER NOT NULL,
    anio INTEGER NOT NULL,
    horas_25 REAL DEFAULT 0,
    horas_50 REAL DEFAULT 0,
    horas_100 REAL DEFAULT 0,
    prestamo_quirografario REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(usuario_id, mes, anio)
  );

  CREATE TABLE IF NOT EXISTS conceptos_variables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK(tipo IN ('asignacion', 'deduccion')),
    monto REAL DEFAULT 0,
    activo INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Migración: agregar foto_perfil si no existe
const columns = db.prepare("PRAGMA table_info(usuarios)").all() as any[];
if (!columns.some((c: any) => c.name === 'foto_perfil')) {
  db.exec("ALTER TABLE usuarios ADD COLUMN foto_perfil TEXT DEFAULT ''");
}

// Migración: agregar activo a usuarios si no existe
if (!columns.some((c: any) => c.name === 'activo')) {
  db.exec("ALTER TABLE usuarios ADD COLUMN activo INTEGER DEFAULT 1");
}

// Migración: agregar prestamo_quirografario a registros si no existe
const regColumns = db.prepare("PRAGMA table_info(registros)").all() as any[];
if (!regColumns.some((c: any) => c.name === 'prestamo_quirografario')) {
  db.exec("ALTER TABLE registros ADD COLUMN prestamo_quirografario REAL");
}

// Migración: crear tabla conceptos_variables si no existe
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as any[];
if (!tables.some((t: any) => t.name === 'conceptos_variables')) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS conceptos_variables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      nombre TEXT NOT NULL,
      tipo TEXT NOT NULL CHECK(tipo IN ('asignacion', 'deduccion')),
      monto REAL DEFAULT 0,
      activo INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

export default db;

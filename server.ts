import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Pool } = pg;
const app = express();
const port = Number(process.env.PORT || 3000);
const collections = new Set(['usuarios', 'empresas', 'veiculos', 'documentos', 'auditoria']);

if (!process.env.DATABASE_URL) {
  console.warn('DATABASE_URL não configurada. Configure a connection string do Neon antes de iniciar em produção.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('sslmode=disable') ? false : { rejectUnauthorized: false }
});

app.use(express.json({ limit: '25mb' }));

async function ensureSchema() {
  await pool.query(`
    create table if not exists app_records (
      collection text not null,
      id text not null,
      data jsonb not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      primary key (collection, id)
    );
    create index if not exists app_records_collection_idx on app_records (collection);
  `);
}

function assertCollection(name: string) {
  if (!collections.has(name)) {
    const error = new Error('Coleção inválida.');
    (error as Error & { status?: number }).status = 404;
    throw error;
  }
}

async function listCollection(collection: string) {
  const result = await pool.query('select data from app_records where collection = $1 order by id', [collection]);
  return result.rows.map(row => row.data);
}

app.get('/api/health', async (_req, res, next) => {
  try {
    await pool.query('select 1');
    res.json({ ok: true, database: 'neon' });
  } catch (error) {
    next(error);
  }
});

app.get('/api/data', async (_req, res, next) => {
  try {
    const [usuarios, empresas, veiculos, documentos, auditoria] = await Promise.all([
      listCollection('usuarios'),
      listCollection('empresas'),
      listCollection('veiculos'),
      listCollection('documentos'),
      listCollection('auditoria')
    ]);
    res.json({ usuarios, empresas, veiculos, documentos, auditoria });
  } catch (error) {
    next(error);
  }
});


async function upsertDocumentById(req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
    const id = req.params.id;
    const record = req.body?.record;

    if (!id || !record || record.id !== id) {
      res.status(400).json({ error: 'Envie { record: { id, ... } } com o mesmo id da URL.' });
      return;
    }

    await pool.query(
      `insert into app_records (collection, id, data, updated_at)
       values ('documentos', $1, $2::jsonb, now())
       on conflict (collection, id) do update set data = excluded.data, updated_at = now()`,
      [id, JSON.stringify(record)]
    );

    res.json({ ok: true, record });
  } catch (error) {
    next(error);
  }
}

app.patch('/api/documentos/:id', upsertDocumentById);
app.put('/api/documentos/:id', upsertDocumentById);
app.post('/api/documentos/:id', upsertDocumentById);

app.get('/api/:collection', async (req, res, next) => {
  try {
    assertCollection(req.params.collection);
    res.json(await listCollection(req.params.collection));
  } catch (error) {
    next(error);
  }
});

app.put('/api/:collection', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const collection = req.params.collection;
    assertCollection(collection);
    const records = req.body?.records;
    if (!Array.isArray(records) || records.some(record => !record?.id)) {
      res.status(400).json({ error: 'Envie { records: [{ id, ... }] }.' });
      return;
    }

    await client.query('begin');
    await client.query('delete from app_records where collection = $1', [collection]);
    for (const record of records) {
      await client.query(
        `insert into app_records (collection, id, data, updated_at)
         values ($1, $2, $3::jsonb, now())
         on conflict (collection, id) do update set data = excluded.data, updated_at = now()`,
        [collection, record.id, JSON.stringify(record)]
      );
    }
    await client.query('commit');
    res.json({ ok: true, count: records.length });
  } catch (error) {
    await client.query('rollback');
    next(error);
  } finally {
    client.release();
  }
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, 'dist');
app.use(express.static(distDir));
app.get('*', (_req, res) => res.sendFile(path.join(distDir, 'index.html')));

app.use((error: Error & { status?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error);
  res.status(error.status || 500).json({ error: error.message || 'Erro interno.' });
});

ensureSchema()
  .then(() => app.listen(port, () => console.log(`Servidor Neon ouvindo na porta ${port}`)))
  .catch(error => {
    console.error('Falha ao inicializar schema no Neon:', error);
    process.exit(1);
  });

import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn('[Order claims] DATABASE_URL is not set. SellAuth order verification will fail closed until a persistent PostgreSQL database is configured.');
}

const pool = connectionString
  ? new Pool({
      connectionString,
      ...(process.env.PGSSL === 'true' ? { ssl: { rejectUnauthorized: false } } : {}),
    })
  : null;

let initPromise: Promise<void> | null = null;

async function ensureTable(): Promise<void> {
  if (!pool) {
    throw new Error('DATABASE_URL is required for one-time SellAuth order claims.');
  }

  if (!initPromise) {
    initPromise = pool.query(`
      CREATE TABLE IF NOT EXISTS sellauth_order_claims (
        order_id TEXT PRIMARY KEY,
        discord_user_id TEXT NOT NULL,
        claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `).then(() => undefined).catch((error: unknown) => {
      initPromise = null;
      throw error;
    });
  }

  await initPromise;
}

export type OrderClaimResult =
  | { status: 'claimed' }
  | { status: 'already-owned' }
  | { status: 'claimed-by-other' };

export async function claimOrder(orderId: string, discordUserId: string): Promise<OrderClaimResult> {
  await ensureTable();

  const normalizedOrderId = orderId.trim();
  const inserted = await pool!.query(
    `INSERT INTO sellauth_order_claims (order_id, discord_user_id)
     VALUES ($1, $2)
     ON CONFLICT (order_id) DO NOTHING
     RETURNING order_id`,
    [normalizedOrderId, discordUserId],
  );

  if (inserted.rowCount === 1) {
    return { status: 'claimed' };
  }

  const existing = await pool!.query(
    'SELECT discord_user_id FROM sellauth_order_claims WHERE order_id = $1',
    [normalizedOrderId],
  );

  // The row could only disappear if an administrator manually removed it.
  if (existing.rowCount !== 1) {
    throw new Error('Could not determine the current owner of this SellAuth order claim.');
  }

  return existing.rows[0].discord_user_id === discordUserId
    ? { status: 'already-owned' }
    : { status: 'claimed-by-other' };
}

export async function releaseOrderClaim(orderId: string, discordUserId: string): Promise<void> {
  await ensureTable();
  await pool!.query(
    'DELETE FROM sellauth_order_claims WHERE order_id = $1 AND discord_user_id = $2',
    [orderId.trim(), discordUserId],
  );
}

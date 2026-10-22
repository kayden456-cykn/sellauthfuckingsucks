import { Client, TextChannel } from 'discord.js';
import { Pool } from 'pg';

const TARGET_CHANNEL_ID = '1562401796394061874';
const TICK_INTERVAL_MS = 30_000;
const connectionString = process.env.DATABASE_URL;

const pool = connectionString
  ? new Pool({
      connectionString,
      ...(process.env.PGSSL === 'true' ? { ssl: { rejectUnauthorized: false } } : {}),
    })
  : null;

type FarmState = {
  guild_id: string;
  active: boolean;
  repeat_count: number;
  goal: string | number;
  total_tf: string | number;
  operator_id: string | null;
  goal_announced: boolean;
};

let initPromise: Promise<void> | null = null;
let tickRunning = false;

async function ensureTables(): Promise<void> {
  if (!pool) throw new Error('DATABASE_URL is required for the Swear Farm leaderboard.');

  if (!initPromise) {
    initPromise = pool.query(`
      CREATE TABLE IF NOT EXISTS b4_swear_farm_state (
        guild_id TEXT PRIMARY KEY,
        active BOOLEAN NOT NULL DEFAULT FALSE,
        repeat_count INTEGER NOT NULL DEFAULT 80 CHECK (repeat_count BETWEEN 1 AND 500),
        goal BIGINT NOT NULL DEFAULT 500 CHECK (goal > 0),
        total_tf BIGINT NOT NULL DEFAULT 0,
        operator_id TEXT,
        goal_announced BOOLEAN NOT NULL DEFAULT FALSE,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `).then(async () => {
      await pool!.query(`
        CREATE TABLE IF NOT EXISTS b4_swear_farm_leaderboard (
          guild_id TEXT NOT NULL,
          discord_user_id TEXT NOT NULL,
          total_tf BIGINT NOT NULL DEFAULT 0,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (guild_id, discord_user_id)
        )
      `);
    }).catch((error: unknown) => {
      initPromise = null;
      throw error;
    });
  }
  await initPromise;
}

async function ensureGuild(guildId: string): Promise<void> {
  await ensureTables();
  await pool!.query(
    'INSERT INTO b4_swear_farm_state (guild_id) VALUES ($1) ON CONFLICT (guild_id) DO NOTHING',
    [guildId],
  );
}

export class SwearFarm {
  static startBackgroundWatcher(client: Client): void {
    setInterval(() => { void this.tick(client); }, TICK_INTERVAL_MS);
    console.log('[SwearFarm] Background watcher started; messages are restricted to the configured channel.');
  }

  static async start(guildId: string, userId: string): Promise<FarmState> {
    await ensureGuild(guildId);
    const result = await pool!.query(
      `UPDATE b4_swear_farm_state
       SET active = TRUE, operator_id = $2, updated_at = NOW()
       WHERE guild_id = $1
       RETURNING *`,
      [guildId, userId],
    );
    return result.rows[0] as FarmState;
  }

  static async stop(guildId: string): Promise<void> {
    await ensureGuild(guildId);
    await pool!.query(
      'UPDATE b4_swear_farm_state SET active = FALSE, updated_at = NOW() WHERE guild_id = $1',
      [guildId],
    );
  }

  static async setRepeat(guildId: string, count: number, userId: string): Promise<FarmState> {
    if (!Number.isInteger(count) || count < 1 || count > 500) {
      throw new Error('Repeat count must be between 1 and 500.');
    }
    await ensureGuild(guildId);
    const result = await pool!.query(
      `UPDATE b4_swear_farm_state
       SET repeat_count = $2, operator_id = $3, updated_at = NOW()
       WHERE guild_id = $1
       RETURNING *`,
      [guildId, count, userId],
    );
    return result.rows[0] as FarmState;
  }

  static async setGoal(guildId: string, goal: number): Promise<FarmState> {
    if (!Number.isSafeInteger(goal) || goal < 1) throw new Error('Goal must be a positive whole number.');
    await ensureGuild(guildId);
    const result = await pool!.query(
      `UPDATE b4_swear_farm_state
       SET goal = $2, goal_announced = FALSE, updated_at = NOW()
       WHERE guild_id = $1
       RETURNING *`,
      [guildId, goal],
    );
    return result.rows[0] as FarmState;
  }

  static async getLeaderboard(guildId: string): Promise<{ state: FarmState; rows: Array<{ discord_user_id: string; total_tf: string | number }> }> {
    await ensureGuild(guildId);
    const stateResult = await pool!.query(
      'SELECT * FROM b4_swear_farm_state WHERE guild_id = $1',
      [guildId],
    );
    const rowsResult = await pool!.query(
      'SELECT discord_user_id, total_tf FROM b4_swear_farm_leaderboard WHERE guild_id = $1 ORDER BY total_tf DESC, updated_at ASC LIMIT 10',
      [guildId],
    );
    return { state: stateResult.rows[0] as FarmState, rows: rowsResult.rows };
  }

  private static async tick(client: Client): Promise<void> {
    if (tickRunning || !pool) return;
    tickRunning = true;
    try {
      await ensureTables();
      const activeFarms = await pool.query(
        'SELECT * FROM b4_swear_farm_state WHERE active = TRUE',
      );
      for (const row of activeFarms.rows as FarmState[]) {
        try {
          const guild = await client.guilds.fetch(row.guild_id).catch(() => null);
          if (!guild) continue;
          const channel = await guild.channels.fetch(TARGET_CHANNEL_ID).catch(() => null);
          if (!channel || !channel.isTextBased() || !('send' in channel)) {
            console.error(`[SwearFarm] Required channel ${TARGET_CHANNEL_ID} is missing or not text-based.`);
            continue;
          }

          const repeatCount = Math.min(500, Math.max(1, Number(row.repeat_count) || 80));
          await (channel as TextChannel).send({
            content: Array(repeatCount).fill('TF').join(' '),
            allowedMentions: { parse: [] },
          });

          const updated = await pool!.query(
            `UPDATE b4_swear_farm_state
             SET total_tf = total_tf + $2, updated_at = NOW(),
                 goal_announced = CASE WHEN total_tf + $2 >= goal THEN TRUE ELSE goal_announced END
             WHERE guild_id = $1
             RETURNING total_tf, goal, goal_announced`,
            [row.guild_id, repeatCount],
          );

          if (row.operator_id) {
            await pool!.query(
              `INSERT INTO b4_swear_farm_leaderboard (guild_id, discord_user_id, total_tf)
               VALUES ($1, $2, $3)
               ON CONFLICT (guild_id, discord_user_id)
               DO UPDATE SET total_tf = b4_swear_farm_leaderboard.total_tf + EXCLUDED.total_tf, updated_at = NOW()`,
              [row.guild_id, row.operator_id, repeatCount],
            );
          }

          const totals = updated.rows[0];
          if (totals && Number(totals.total_tf) >= Number(totals.goal) && !Boolean(row.goal_announced)) {
            await (channel as TextChannel).send({
              content: `🏆 Swear Farm goal reached! Server total: **${Number(totals.total_tf).toLocaleString()} / ${Number(totals.goal).toLocaleString()} TFs**.`,
              allowedMentions: { parse: [] },
            });
          }
        } catch (error) {
          console.error('[SwearFarm] Farm tick failed:', error);
        }
      }
    } catch (error) {
      console.error('[SwearFarm] Could not read farm state:', error);
    } finally {
      tickRunning = false;
    }
  }
}

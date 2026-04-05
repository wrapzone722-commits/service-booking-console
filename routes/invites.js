/**
 * Публичное превью пригласительного кода (без авторизации).
 */
import { getDb } from '../db/index.js';

export function normalizeInviteCode(raw) {
  if (raw == null) return null;
  const s = String(raw).trim().toUpperCase().replace(/^#/, '').replace(/\s+/g, '');
  return s.length ? s : null;
}

function countRedemptions(db, inviteCodeId) {
  const row = db.prepare('SELECT COUNT(*) as c FROM invite_redemptions WHERE invite_code_id = ?').get(inviteCodeId);
  return row?.c ?? 0;
}

/** GET /api/v1/invites/preview?code= */
export function previewInvite(req, res) {
  const code = normalizeInviteCode(req.query.code);
  if (!code) {
    return res.status(200).json({ valid: false, error: 'Укажите код' });
  }

  const db = getDb();
  const row = db
    .prepare(
      `
    SELECT ic.*, s.name AS service_name
    FROM invite_codes ic
    JOIN services s ON s.id = ic.service_id
    WHERE ic.code = ? AND ic.active = 1 AND s.is_active = 1
  `
    )
    .get(code);

  if (!row) {
    return res.status(200).json({ valid: false, error: 'Код не найден или отключён' });
  }

  if (row.expires_at) {
    const ex = new Date(row.expires_at);
    if (!isNaN(ex.getTime()) && ex.getTime() < Date.now()) {
      return res.json({ valid: false, error: 'Срок действия кода истёк' });
    }
  }

  const used = countRedemptions(db, row.id);
  if (used >= row.max_uses) {
    return res.json({ valid: false, error: 'Лимит активаций исчерпан' });
  }

  res.json({
    valid: true,
    code: row.code,
    service_id: row.service_id,
    service_name: row.service_name || '',
    post_id: row.post_id || 'post_1',
    label: row.label || null,
    expires_at: row.expires_at || null,
    remaining_uses: Math.max(0, row.max_uses - used),
  });
}

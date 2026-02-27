/**
 * GET /rewards — список товаров/услуг за баллы (для клиента)
 * POST /rewards/:id/redeem — обменять баллы на награду
 */
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/index.js';

export function listRewards(req, res) {
  const db = getDb();
  const rows = db.prepare(`
    SELECT id, name, description, points_cost, image_url, sort_order
    FROM loyalty_rewards
    WHERE is_active = 1
    ORDER BY sort_order ASC, points_cost ASC, name ASC
  `).all();

  const list = rows.map(r => ({
    _id: r.id,
    name: r.name,
    description: r.description || '',
    points_cost: r.points_cost,
    image_url: r.image_url || null,
  }));

  res.json(list);
}

export function redeemReward(req, res) {
  const db = getDb();
  const rewardId = req.params.id;
  const clientId = req.clientId;

  const reward = db.prepare('SELECT * FROM loyalty_rewards WHERE id = ? AND is_active = 1').get(rewardId);
  if (!reward) {
    return res.status(404).json({ error: 'Награда не найдена или недоступна' });
  }

  const client = db.prepare('SELECT id, loyalty_points FROM clients WHERE id = ?').get(clientId);
  if (!client) {
    return res.status(404).json({ error: 'Клиент не найден' });
  }

  const pointsCost = Number(reward.points_cost) || 0;
  const currentPoints = Number(client.loyalty_points) || 0;

  if (pointsCost <= 0) {
    return res.status(400).json({ error: 'Некорректная стоимость награды' });
  }
  if (currentPoints < pointsCost) {
    return res.status(400).json({
      error: 'Недостаточно баллов',
      required: pointsCost,
      current: currentPoints,
    });
  }

  const now = new Date().toISOString();
  const redemptionId = uuidv4();

  db.prepare('UPDATE clients SET loyalty_points = loyalty_points - ? WHERE id = ?').run(pointsCost, clientId);
  db.prepare(`
    INSERT INTO loyalty_redemptions (id, client_id, reward_id, points_spent, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(redemptionId, clientId, rewardId, pointsCost, now);

  const updated = db.prepare('SELECT loyalty_points FROM clients WHERE id = ?').get(clientId);

  res.status(200).json({
    redemption_id: redemptionId,
    reward_id: rewardId,
    reward_name: reward.name,
    points_spent: pointsCost,
    new_balance: Number(updated.loyalty_points) || 0,
  });
}

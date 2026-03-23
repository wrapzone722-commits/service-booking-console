/**
 * POST /candidates - submit candidate application from website (no auth required)
 * GET /candidates - admin list all candidates
 * PATCH /candidates/:id/status - admin update candidate status
 * DELETE /candidates/:id - admin delete candidate
 */
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/index.js';

export function submitCandidate(req, res) {
  const { full_name, email, phone, desired_role, about, quiz_answers } = req.body || {};
  if (!full_name || !email) {
    return res.status(400).json({ error: 'full_name и email обязательны' });
  }

  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();

  let answers = [];
  let score = 0;
  let total = 0;
  if (Array.isArray(quiz_answers)) {
    answers = quiz_answers;
    total = answers.length;
    score = answers.filter(a => a.correct === true).length;
  }

  db.prepare(`
    INSERT INTO candidates (id, full_name, email, phone, desired_role, about, quiz_answers, quiz_score, quiz_total, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?)
  `).run(id, full_name.trim(), email.trim(), phone || '', desired_role || '', about || '', JSON.stringify(answers), score, total, now);

  res.status(201).json({ id, status: 'new', quiz_score: score, quiz_total: total });
}

export function listCandidates(req, res) {
  const db = getDb();
  const { status } = req.query;
  let sql = 'SELECT * FROM candidates';
  const params = [];
  if (status) {
    sql += ' WHERE status = ?';
    params.push(status);
  }
  sql += ' ORDER BY created_at DESC';
  const rows = db.prepare(sql).all(...params);
  res.json(rows.map(r => {
    let qa = [];
    try { qa = JSON.parse(r.quiz_answers || '[]'); } catch (_) {}
    return { ...r, quiz_answers: qa };
  }));
}

export function updateCandidateStatus(req, res) {
  const db = getDb();
  const { status, notes } = req.body || {};
  const allowed = ['new', 'reviewed', 'interview', 'accepted', 'rejected'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: 'Недопустимый статус. Допустимые: ' + allowed.join(', ') });
  }
  const row = db.prepare('SELECT * FROM candidates WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Кандидат не найден' });

  const updates = ['status = ?'];
  const values = [status];
  if (notes !== undefined) {
    updates.push('notes = ?');
    values.push(notes);
  }
  values.push(req.params.id);
  db.prepare(`UPDATE candidates SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  res.json({ id: req.params.id, status });
}

export function deleteCandidate(req, res) {
  const db = getDb();
  db.prepare('DELETE FROM candidates WHERE id = ?').run(req.params.id);
  res.status(204).send();
}

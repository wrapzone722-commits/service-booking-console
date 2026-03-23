import { RequestHandler } from "express";
import * as db from "../db";
import type { CandidateStatus } from "@shared/api";

const ALLOWED_STATUSES: CandidateStatus[] = ["new", "reviewed", "interview", "accepted", "rejected"];

// POST /api/v1/candidates — public (from website)
export const submitCandidate: RequestHandler = (req, res) => {
  const { full_name, email, phone, desired_role, about, quiz_answers, photo } = req.body ?? {};
  if (!full_name) {
    return res.status(400).json({ error: "Validation error", message: "full_name обязательно" });
  }
  const candidate = db.createCandidate({ full_name, email, phone, desired_role, about, quiz_answers, photo });
  res.status(201).json(candidate);
};

// GET /api/v1/candidates
export const getCandidates: RequestHandler = (req, res) => {
  const status = typeof req.query.status === "string" ? (req.query.status as CandidateStatus) : undefined;
  res.json(db.getCandidates(status));
};

// GET /api/v1/candidates/:id
export const getCandidate: RequestHandler<{ id: string }> = (req, res) => {
  const c = db.getCandidate(req.params.id);
  if (!c) return res.status(404).json({ error: "Not found", message: "Кандидат не найден" });
  res.json(c);
};

// PATCH /api/v1/candidates/:id/status
export const setCandidateStatus: RequestHandler<{ id: string }> = (req, res) => {
  const { status, notes } = req.body ?? {};
  if (!ALLOWED_STATUSES.includes(status)) {
    return res.status(400).json({ error: "Validation error", message: `Допустимые статусы: ${ALLOWED_STATUSES.join(", ")}` });
  }
  const updated = db.updateCandidateStatus(req.params.id, status, notes);
  if (!updated) return res.status(404).json({ error: "Not found", message: "Кандидат не найден" });
  res.json(updated);
};

// DELETE /api/v1/candidates/:id
export const deleteCandidate: RequestHandler<{ id: string }> = (req, res) => {
  db.deleteCandidate(req.params.id);
  res.status(204).send();
};

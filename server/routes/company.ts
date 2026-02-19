import { RequestHandler } from "express";
import * as db from "../db";
import type { PublicCompanyInfo } from "@shared/api";

/**
 * Public company/operator info for clients (web + iOS).
 * Returns sanitized subset of the first (tenant) account.
 */
export const getPublicCompany: RequestHandler = (_req, res) => {
  const acc = db.getFirstAccount();
  if (!acc) {
    return res.status(404).json({ error: "Not found", message: "Company not configured" });
  }

  const out: PublicCompanyInfo = {
    name: acc.name,
    phone: acc.phone ?? null,
    phone_extra: acc.phone_extra ?? null,
    email: acc.email ?? null,
    website: acc.website ?? null,
    address: acc.address ?? null,
    legal_address: acc.legal_address ?? null,
    inn: acc.inn ?? null,
    ogrn: acc.ogrn ?? null,
    kpp: acc.kpp ?? null,
    bank_name: acc.bank_name ?? null,
    bank_bik: acc.bank_bik ?? null,
    bank_account: acc.bank_account ?? null,
    director_name: acc.director_name ?? null,
  };

  res.json(out);
};


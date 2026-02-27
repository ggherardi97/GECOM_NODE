const express = require("express");
const fs = require("fs/promises");
const path = require("path");

const router = express.Router();

const HOST_OPTIONS = Object.freeze(["Diogo", "Gustavo", "Gill", "Renan", "Leonardo"]);
const HOST_SET = new Set(HOST_OPTIONS);
const LIMIT_TOTAL = 120;
const LIMIT_PER_HOST = 24;

const DATA_DIR = path.join(__dirname, "..", "data");
const DATA_FILE = path.join(DATA_DIR, "scarlet-drive-guests.json");

let writeQueue = Promise.resolve();

function withWriteLock(action) {
  const task = writeQueue.then(action, action);
  writeQueue = task.catch(() => {});
  return task;
}

function badRequest(message, code) {
  const error = new Error(message);
  error.status = 400;
  error.code = code;
  return error;
}

function parseBoolean(value, fieldName) {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1") return true;
  if (value === 0 || value === "0") return false;

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["sim", "true", "yes", "y"].includes(normalized)) return true;
    if (["nao", "false", "no", "n"].includes(normalized)) return false;
  }

  throw badRequest(`Campo invalido: ${fieldName}. Use Sim ou Nao.`, "INVALID_BOOLEAN");
}

function parseInvitedBy(value) {
  const invitedBy = String(value || "").trim();
  if (!HOST_SET.has(invitedBy)) {
    throw badRequest("Convidado por invalido.", "INVALID_INVITED_BY");
  }
  return invitedBy;
}

function parseName(value) {
  const name = String(value || "").trim();
  if (!name) {
    throw badRequest("Nome do convidado e obrigatorio.", "NAME_REQUIRED");
  }
  if (name.length > 120) {
    throw badRequest("Nome do convidado muito grande (maximo 120 caracteres).", "NAME_TOO_LONG");
  }
  return name;
}

function sanitizeState(parsed) {
  if (!parsed || typeof parsed !== "object") {
    return { nextId: 1, guests: [] };
  }

  const guests = Array.isArray(parsed.guests) ? parsed.guests : [];
  const nextId = Number.isInteger(parsed.nextId) && parsed.nextId > 0 ? parsed.nextId : 1;

  return { nextId, guests };
}

async function ensureStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    const initial = { nextId: 1, guests: [] };
    await fs.writeFile(DATA_FILE, JSON.stringify(initial, null, 2), "utf8");
  }
}

async function readState() {
  await ensureStore();
  const raw = await fs.readFile(DATA_FILE, "utf8");
  return sanitizeState(JSON.parse(raw));
}

async function writeState(state) {
  await ensureStore();
  const tempFile = `${DATA_FILE}.tmp`;
  await fs.writeFile(tempFile, JSON.stringify(state, null, 2), "utf8");
  await fs.rename(tempFile, DATA_FILE);
}

function buildCounters(guests) {
  const byHost = {};
  HOST_OPTIONS.forEach((host) => {
    byHost[host] = 0;
  });

  let paidYes = 0;
  let confirmedYes = 0;

  for (const guest of guests) {
    if (HOST_SET.has(guest.invitedBy)) {
      byHost[guest.invitedBy] += 1;
    }
    if (guest.isPaid) paidYes += 1;
    if (guest.isConfirmed) confirmedYes += 1;
  }

  return {
    total: guests.length,
    byHost,
    paid: {
      yes: paidYes,
      no: guests.length - paidYes,
    },
    confirmed: {
      yes: confirmedYes,
      no: guests.length - confirmedYes,
    },
  };
}

function sortGuests(guests) {
  return [...guests].sort((a, b) => {
    const nameA = String(a.name || "").trim();
    const nameB = String(b.name || "").trim();

    const byName = nameA.localeCompare(nameB, "pt-BR", { sensitivity: "base" });
    if (byName !== 0) return byName;

    return Number(a.id) - Number(b.id);
  });
}

function buildPayload(state) {
  const guests = sortGuests(state.guests);
  return {
    guests,
    counters: buildCounters(guests),
    limits: {
      maxGuests: LIMIT_TOTAL,
      maxPerHost: LIMIT_PER_HOST,
    },
    hosts: HOST_OPTIONS,
  };
}

function enforceAddLimits(state, invitedBy) {
  if (state.guests.length >= LIMIT_TOTAL) {
    throw badRequest(`Limite total de ${LIMIT_TOTAL} convidados atingido.`, "LIMIT_TOTAL_REACHED");
  }

  const hostCount = state.guests.filter((guest) => guest.invitedBy === invitedBy).length;
  if (hostCount >= LIMIT_PER_HOST) {
    throw badRequest(`O convidador ${invitedBy} ja tem ${LIMIT_PER_HOST} convidados.`, "LIMIT_HOST_REACHED");
  }
}

function applyCreate(state, body) {
  const name = parseName(body.name);
  const invitedBy = parseInvitedBy(body.invitedBy);
  const isPaid = parseBoolean(body.isPaid ?? body.pago ?? false, "isPaid");
  const isConfirmed = parseBoolean(body.isConfirmed ?? body.confirmed ?? false, "isConfirmed");

  enforceAddLimits(state, invitedBy);

  const now = new Date().toISOString();
  const guest = {
    id: state.nextId,
    name,
    invitedBy,
    isPaid,
    isConfirmed,
    createdAt: now,
    updatedAt: now,
  };

  state.nextId += 1;
  state.guests.push(guest);
  return guest;
}

function applyUpdate(state, id, body) {
  const index = state.guests.findIndex((guest) => Number(guest.id) === Number(id));
  if (index < 0) {
    const error = new Error("Convidado nao encontrado.");
    error.status = 404;
    error.code = "NOT_FOUND";
    throw error;
  }

  const current = state.guests[index];
  const updated = { ...current };

  if (Object.prototype.hasOwnProperty.call(body, "name")) {
    updated.name = parseName(body.name);
  }

  if (Object.prototype.hasOwnProperty.call(body, "invitedBy")) {
    const nextInvitedBy = parseInvitedBy(body.invitedBy);
    if (nextInvitedBy !== current.invitedBy) {
      const targetHostCount = state.guests.filter((guest) => guest.invitedBy === nextInvitedBy).length;
      if (targetHostCount >= LIMIT_PER_HOST) {
        throw badRequest(`O convidador ${nextInvitedBy} ja tem ${LIMIT_PER_HOST} convidados.`, "LIMIT_HOST_REACHED");
      }
    }
    updated.invitedBy = nextInvitedBy;
  }

  if (Object.prototype.hasOwnProperty.call(body, "isPaid") || Object.prototype.hasOwnProperty.call(body, "pago")) {
    updated.isPaid = parseBoolean(body.isPaid ?? body.pago, "isPaid");
  }

  if (
    Object.prototype.hasOwnProperty.call(body, "isConfirmed") ||
    Object.prototype.hasOwnProperty.call(body, "confirmed")
  ) {
    updated.isConfirmed = parseBoolean(body.isConfirmed ?? body.confirmed, "isConfirmed");
  }

  const changed =
    updated.name !== current.name ||
    updated.invitedBy !== current.invitedBy ||
    updated.isPaid !== current.isPaid ||
    updated.isConfirmed !== current.isConfirmed;

  if (!changed) {
    return current;
  }

  updated.updatedAt = new Date().toISOString();
  state.guests[index] = updated;
  return updated;
}

function applyDelete(state, id) {
  const index = state.guests.findIndex((guest) => Number(guest.id) === Number(id));
  if (index < 0) {
    const error = new Error("Convidado nao encontrado.");
    error.status = 404;
    error.code = "NOT_FOUND";
    throw error;
  }
  const [removed] = state.guests.splice(index, 1);
  return removed;
}

function sendError(res, error) {
  const status = Number(error.status) || 500;
  const payload = {
    message: status >= 500 ? "Erro interno no ScarletDrive." : error.message,
  };
  if (error.code) payload.code = error.code;

  if (status >= 500) {
    console.error("[ScarletDrive] Error:", error);
  }

  return res.status(status).json(payload);
}

router.get("/ScarletDrive", (req, res) => {
  res.render("ScarletDrive", {
    layout: false,
    scarletHosts: HOST_OPTIONS,
    maxGuests: LIMIT_TOTAL,
    maxPerHost: LIMIT_PER_HOST,
  });
});

router.get("/api/scarlet-drive/guests", async (req, res) => {
  try {
    const state = await readState();
    return res.json(buildPayload(state));
  } catch (error) {
    return sendError(res, error);
  }
});

router.post("/api/scarlet-drive/guests", async (req, res) => {
  try {
    const result = await withWriteLock(async () => {
      const state = await readState();
      const guest = applyCreate(state, req.body || {});
      await writeState(state);
      return { guest, ...buildPayload(state) };
    });
    return res.status(201).json(result);
  } catch (error) {
    return sendError(res, error);
  }
});

router.patch("/api/scarlet-drive/guests/:id", async (req, res) => {
  try {
    const result = await withWriteLock(async () => {
      const state = await readState();
      const guest = applyUpdate(state, req.params.id, req.body || {});
      await writeState(state);
      return { guest, ...buildPayload(state) };
    });
    return res.json(result);
  } catch (error) {
    return sendError(res, error);
  }
});

router.delete("/api/scarlet-drive/guests/:id", async (req, res) => {
  try {
    const result = await withWriteLock(async () => {
      const state = await readState();
      const deleted = applyDelete(state, req.params.id);
      await writeState(state);
      return { deleted, ...buildPayload(state) };
    });
    return res.json(result);
  } catch (error) {
    return sendError(res, error);
  }
});

module.exports = router;

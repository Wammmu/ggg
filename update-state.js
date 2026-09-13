const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const STATE_PATH = path.join(ROOT, "state.json");

const REALMS = ["초월", "신위", "극위", "특급", "상급", "중급", "하급"];

function clone(v) {
  return JSON.parse(JSON.stringify(v));
}

function clamp(v, min = 0, max = 100) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : min;
}

function validRealm(v, fallback = "하급") {
  return REALMS.includes(v) ? v : fallback;
}

function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJSON(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n", "utf8");
}

function ensureState(state) {
  state.version = Number(state.version || 0);

  state.protagonist ??= {};
  state.protagonist.reputation ??= [];

  state.companions ??= [];

  state.userStatus ??= {};
  state.userStatus.body = clamp(state.userStatus.body ?? 100);
  state.userStatus.fatigue = clamp(state.userStatus.fatigue ?? 0);
  state.userStatus.recoil = clamp(state.userStatus.recoil ?? 0);
  state.userStatus.cultivation ??= { task: "없음", progress: 0 };
  state.userStatus.cultivation.progress = clamp(
    state.userStatus.cultivation.progress ?? 0
  );

  state.inventory ??= {};
  state.inventory.money = Number(state.inventory.money || 0);
  state.inventory.moneyUnit ??= "은전";
  state.inventory.items ??= [];

  return state;
}

function uniqueStrings(arr) {
  return [...new Set((arr || []).filter(Boolean).map(String))];
}

function findCompanion(state, name) {
  return state.companions.find((c) => c.name === name);
}

function normalizeCompanion(c, old = null) {
  const result = {
    ...(old || {}),
    ...(c || {}),
  };

  result.name = String(result.name || "").trim();
  if (!result.name) return null;

  result.realm = validRealm(
    result.realm,
    old?.realm && REALMS.includes(old.realm) ? old.realm : "하급"
  );
  result.status = String(result.status || old?.status || "정상");
  result.image =
    result.image ||
    old?.image ||
    `assets/sd/${result.name.toLowerCase().replace(/\s+/g, "-")}.webp`;

  return result;
}

function addItem(items, item) {
  const name = String(item?.name || "").trim();
  const qty = Number(item?.qty || 0);
  if (!name || !Number.isFinite(qty) || qty === 0) return;

  const found = items.find((x) => x.name === name);
  if (found) {
    found.qty = Math.max(0, Number(found.qty || 0) + qty);
  } else if (qty > 0) {
    items.push({ name, qty });
  }
}

function removeItem(items, item) {
  const name = String(item?.name || "").trim();
  const qty = Math.max(0, Number(item?.qty || 0));
  if (!name || !qty) return;

  const found = items.find((x) => x.name === name);
  if (!found) return;

  found.qty = Math.max(0, Number(found.qty || 0) - qty);
}

function applyPatch(state, patch) {
  let changed = false;

  // 1) 주인공 기본 정보
  if (patch.protagonist && typeof patch.protagonist === "object") {
    const p = patch.protagonist;

    for (const key of ["name", "gender", "affiliation"]) {
      if (p[key] !== undefined && state.protagonist[key] !== p[key]) {
        state.protagonist[key] = p[key];
        changed = true;
      }
    }

    if (p.realm !== undefined) {
      const realm = validRealm(p.realm, state.protagonist.realm || "하급");
      if (state.protagonist.realm !== realm) {
        state.protagonist.realm = realm;
        changed = true;
      }
    }

    if (Array.isArray(p.reputation)) {
      state.protagonist.reputation = uniqueStrings(p.reputation);
      changed = true;
    }
  }

  // 2) 평판 추가/삭제
  if (Array.isArray(patch.reputationAdd)) {
    const before = JSON.stringify(state.protagonist.reputation);
    state.protagonist.reputation = uniqueStrings([
      ...state.protagonist.reputation,
      ...patch.reputationAdd,
    ]);
    if (JSON.stringify(state.protagonist.reputation) !== before) changed = true;
  }

  if (Array.isArray(patch.reputationRemove)) {
    const remove = new Set(patch.reputationRemove.map(String));
    const before = state.protagonist.reputation.length;
    state.protagonist.reputation =
      state.protagonist.reputation.filter((x) => !remove.has(x));
    if (state.protagonist.reputation.length !== before) changed = true;
  }

  // 3) 동료 전체 교체(필요할 때만)
  if (Array.isArray(patch.companions)) {
    const oldMap = new Map(state.companions.map((c) => [c.name, c]));
    state.companions = patch.companions
      .map((c) => normalizeCompanion(c, oldMap.get(c.name)))
      .filter(Boolean);
    changed = true;
  }

  // 4) 동료 추가
  if (Array.isArray(patch.companionsAdd)) {
    for (const c of patch.companionsAdd) {
      const old = findCompanion(state, c.name);
      if (old) {
        Object.assign(old, normalizeCompanion(c, old));
      } else {
        const next = normalizeCompanion(c);
        if (next) state.companions.push(next);
      }
      changed = true;
    }
  }

  // 5) 동료 이탈
  if (Array.isArray(patch.companionsRemove)) {
    const remove = new Set(patch.companionsRemove.map(String));
    const before = state.companions.length;
    state.companions = state.companions.filter((c) => !remove.has(c.name));
    if (state.companions.length !== before) changed = true;
  }

  // 6) 동료 상태/경지 수정
  if (Array.isArray(patch.companionUpdates)) {
    for (const u of patch.companionUpdates) {
      const old = findCompanion(state, u.name);
      if (!old) continue;

      if (u.status !== undefined && old.status !== u.status) {
        old.status = String(u.status);
        changed = true;
      }

      if (u.realm !== undefined) {
        const realm = validRealm(u.realm, old.realm);
        if (old.realm !== realm) {
          old.realm = realm;
          changed = true;
        }
      }

      if (u.image !== undefined && old.image !== u.image) {
        old.image = u.image;
        changed = true;
      }
    }
  }

  // 7) 신체/피로/반동 절대값
  if (patch.userStatus && typeof patch.userStatus === "object") {
    for (const key of ["body", "fatigue", "recoil"]) {
      if (patch.userStatus[key] !== undefined) {
        const v = clamp(patch.userStatus[key]);
        if (state.userStatus[key] !== v) {
          state.userStatus[key] = v;
          changed = true;
        }
      }
    }
  }

  // 8) 신체/피로/반동 변화량
  if (patch.userStatusDelta && typeof patch.userStatusDelta === "object") {
    for (const key of ["body", "fatigue", "recoil"]) {
      if (patch.userStatusDelta[key] !== undefined) {
        const delta = Number(patch.userStatusDelta[key] || 0);
        const next = clamp(Number(state.userStatus[key] || 0) + delta);
        if (next !== state.userStatus[key]) {
          state.userStatus[key] = next;
          changed = true;
        }
      }
    }
  }

  // 9) 수행
  if (patch.cultivation && typeof patch.cultivation === "object") {
    const c = patch.cultivation;

    if (c.task !== undefined && state.userStatus.cultivation.task !== c.task) {
      state.userStatus.cultivation.task = String(c.task);
      changed = true;
    }

    if (c.progress !== undefined) {
      const next = clamp(c.progress);
      if (state.userStatus.cultivation.progress !== next) {
        state.userStatus.cultivation.progress = next;
        changed = true;
      }
    }

    if (c.progressDelta !== undefined) {
      const next = clamp(
        Number(state.userStatus.cultivation.progress || 0) +
        Number(c.progressDelta || 0)
      );
      if (state.userStatus.cultivation.progress !== next) {
        state.userStatus.cultivation.progress = next;
        changed = true;
      }
    }
  }

  // 10) 재산 / 인벤토리
  if (patch.inventory && typeof patch.inventory === "object") {
    const inv = patch.inventory;

    if (inv.money !== undefined) {
      const next = Math.max(0, Number(inv.money || 0));
      if (state.inventory.money !== next) {
        state.inventory.money = next;
        changed = true;
      }
    }

    if (inv.moneyDelta !== undefined) {
      const next = Math.max(
        0,
        Number(state.inventory.money || 0) + Number(inv.moneyDelta || 0)
      );
      if (state.inventory.money !== next) {
        state.inventory.money = next;
        changed = true;
      }
    }

    if (inv.moneyUnit !== undefined && state.inventory.moneyUnit !== inv.moneyUnit) {
      state.inventory.moneyUnit = String(inv.moneyUnit);
      changed = true;
    }

    if (Array.isArray(inv.items)) {
      state.inventory.items = clone(inv.items);
      changed = true;
    }

    if (Array.isArray(inv.addItems)) {
      const before = JSON.stringify(state.inventory.items);
      for (const item of inv.addItems) addItem(state.inventory.items, item);
      state.inventory.items = state.inventory.items.filter((x) => Number(x.qty) > 0);
      if (JSON.stringify(state.inventory.items) !== before) changed = true;
    }

    if (Array.isArray(inv.removeItems)) {
      const before = JSON.stringify(state.inventory.items);
      for (const item of inv.removeItems) removeItem(state.inventory.items, item);
      state.inventory.items = state.inventory.items.filter((x) => Number(x.qty) > 0);
      if (JSON.stringify(state.inventory.items) !== before) changed = true;
    }
  }

  if (changed) state.version += 1;

  // 마지막 검증
  state.protagonist.realm = validRealm(
    state.protagonist.realm,
    "하급"
  );

  state.companions = state.companions
    .map((c) => normalizeCompanion(c, c))
    .filter(Boolean);

  state.userStatus.body = clamp(state.userStatus.body);
  state.userStatus.fatigue = clamp(state.userStatus.fatigue);
  state.userStatus.recoil = clamp(state.userStatus.recoil);
  state.userStatus.cultivation.progress =
    clamp(state.userStatus.cultivation.progress);

  return changed;
}

function getPayload() {
  // 사용법: node update-state.js /tmp/payload.json
  const payloadPath = process.argv[2];

  if (!payloadPath) {
    throw new Error("payload JSON 파일 경로가 필요합니다.");
  }

  return readJSON(payloadPath);
}

const state = ensureState(readJSON(STATE_PATH));
const patch = getPayload();

const changed = applyPatch(state, patch);
writeJSON(STATE_PATH, state);

console.log(
  changed
    ? `상태 갱신 완료 · version=${state.version}`
    : `실제 변경 없음 · version=${state.version}`
);

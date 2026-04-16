
const STORAGE_KEY = "harkness-teacher-tracker-static-v2";
const CHANNEL_NAME = "harkness-teacher-tracker-sync";

const sampleState = {
  sessionTitle: "",
  sessionCode: "",
  className: "",
  sessionStatus: "open",
  questions: [],
  rubric: [
    { id: "r1", label: "Textual evidence", value: 2, color: "#2563eb" },
    { id: "r2", label: "Builds on a peer's idea", value: 2, color: "#7c3aed" },
    { id: "r3", label: "Invites or includes another voice", value: 1, color: "#059669" },
    { id: "r4", label: "Asks a probing question", value: 1, color: "#d97706" }
  ],
  students: [
    { id: "s1", username: "amelia", displayName: "Amelia", points: 4, queued: false, spokeCount: 2 },
    { id: "s2", username: "ben", displayName: "Ben", points: 3, queued: true, spokeCount: 2 },
    { id: "s3", username: "carter", displayName: "Carter", points: 5, queued: false, spokeCount: 3 },
    { id: "s4", username: "dina", displayName: "Dina", points: 2, queued: true, spokeCount: 1 },
    { id: "s5", username: "elias", displayName: "Elias", points: 1, queued: false, spokeCount: 1 },
    { id: "s6", username: "fatima", displayName: "Fatima", points: 0, queued: false, spokeCount: 0 }
  ],
  queue: ["s2", "s4"],
  connections: [
    { from: "s3", to: "s1", weight: 1, rubricId: "r2", category: "Builds on a peer's idea" },
    { from: "s2", to: "s3", weight: 1, rubricId: "r1", category: "Textual evidence" },
    { from: "s1", to: "s2", weight: 1, rubricId: "r4", category: "Asks a probing question" },
    { from: "s3", to: "s2", weight: 1, rubricId: "r2", category: "Builds on a peer's idea" }
  ],
  events: [
    { id: 1, speaker: "carter", speakerId: "s3", target: "amelia", targetId: "s1", points: 2, rubricId: "r1", category: "Textual evidence", note: "Referenced Proctor's confession.", timestamp: "09:11 AM" },
    { id: 2, speaker: "ben", speakerId: "s2", target: "carter", targetId: "s3", points: 1, rubricId: "r4", category: "Asks a probing question", note: "Questioned motive and audience.", timestamp: "09:15 AM" },
    { id: 3, speaker: "amelia", speakerId: "s1", target: "ben", targetId: "s2", points: 2, rubricId: "r2", category: "Builds on a peer's idea", note: "Connected fear to reputation.", timestamp: "09:19 AM" }
  ]
};

const ui = {
  view: "teacher",
  selectedSpeaker: sampleState.students[0]?.id || "",
  selectedTarget: "",
  selectedRubricId: sampleState.rubric[0]?.id || "",
  customPoints: sampleState.rubric[0]?.value || 1,
  note: "",
  selectedNode: "",
  newQuestion: "",
  newStudentName: "",
  importStatus: ""
};

let state = loadState();
const app = document.getElementById("app");
const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(CHANNEL_NAME) : null;

if (channel) {
  channel.onmessage = (event) => {
    if (!event?.data || event.data.type !== "STATE_SYNC") return;
    state = event.data.payload;
    saveState();
    render();
  };
}

window.addEventListener("storage", (event) => {
  if (event.key !== STORAGE_KEY || !event.newValue) return;
  try {
    state = JSON.parse(event.newValue);
    render();
  } catch {}
});

window.addEventListener("beforeunload", () => {
  if (channel) channel.close();
});

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : JSON.parse(JSON.stringify(sampleState));
  } catch {
    return JSON.parse(JSON.stringify(sampleState));
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function uid(prefix = "id") {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function nowTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function csvEscape(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      row.push(current.trim());
      current = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      if (current.length > 0 || row.length > 0) {
        row.push(current.trim());
        rows.push(row);
        row = [];
        current = "";
      }
    } else {
      current += char;
    }
  }
  if (current.length > 0 || row.length > 0) {
    row.push(current.trim());
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => String(cell).trim() !== ""));
}

function safeJsonParse(text, fallback) {
  try { return JSON.parse(text); } catch { return fallback; }
}

function colorFromIndex(index) {
  const palette = ["#2563eb", "#7c3aed", "#059669", "#d97706", "#dc2626", "#0891b2", "#4f46e5", "#65a30d"];
  return palette[index % palette.length];
}

function downloadText(filename, text, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function fileToText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

function updateState(next) {
  state = next;
  saveState();
  if (channel) channel.postMessage({ type: "STATE_SYNC", payload: state });
  render();
}

function setUI(partial) {
  Object.assign(ui, partial);
  render();
}

function getStudent(id) {
  return state.students.find((s) => s.id === id);
}

function selectedRubric() {
  return state.rubric.find((r) => r.id === ui.selectedRubricId) || state.rubric[0];
}

function totalPoints() {
  return state.students.reduce((sum, s) => sum + Number(s.points || 0), 0);
}

function totalConnections() {
  return state.connections.reduce((sum, c) => sum + Number(c.weight || 1), 0);
}

function addQuestion() {
  const value = ui.newQuestion.trim();
  if (!value) return;
  updateState({ ...state, questions: [...state.questions, value] });
  ui.newQuestion = "";
}

function addStudent() {
  const displayName = ui.newStudentName.trim();
  if (!displayName) return;
  const username = displayName.toLowerCase().replace(/\s+/g, "-");
  const student = { id: uid("stu"), username, displayName, points: 0, queued: false, spokeCount: 0 };
  updateState({ ...state, students: [...state.students, student] });
  ui.newStudentName = "";
}

function removeStudent(id) {
  updateState({
    ...state,
    students: state.students.filter((s) => s.id !== id),
    queue: state.queue.filter((q) => q !== id),
    connections: state.connections.filter((c) => c.from !== id && c.to !== id),
    events: state.events.filter((e) => e.speakerId !== id && e.targetId !== id)
  });
}

function toggleQueued(id) {
  const isQueued = state.queue.includes(id);
  updateState({
    ...state,
    students: state.students.map((s) => (s.id === id ? { ...s, queued: !isQueued } : s)),
    queue: isQueued ? state.queue.filter((q) => q !== id) : [...state.queue, id]
  });
}

function moveQueue(id, direction) {
  const index = state.queue.indexOf(id);
  if (index < 0) return;
  const next = [...state.queue];
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= next.length) return;
  [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  updateState({ ...state, queue: next });
}

function addPoints() {
  const rubricItem = selectedRubric();
  if (!ui.selectedSpeaker || !rubricItem) return;
  const speaker = getStudent(ui.selectedSpeaker);
  if (!speaker) return;
  const points = Number(ui.customPoints || 0);
  const updatedStudents = state.students.map((s) => s.id === ui.selectedSpeaker ? { ...s, points: s.points + points, spokeCount: s.spokeCount + 1, queued: false } : s);
  const target = getStudent(ui.selectedTarget);
  const nextConnections = [...state.connections];
  if (ui.selectedTarget && ui.selectedTarget !== ui.selectedSpeaker) {
    nextConnections.push({ from: ui.selectedSpeaker, to: ui.selectedTarget, weight: 1, rubricId: rubricItem.id, category: rubricItem.label });
  }
  const event = {
    id: Date.now(), speaker: speaker.username, speakerId: speaker.id,
    target: target?.displayName || target?.username || "", targetId: ui.selectedTarget || "",
    points, rubricId: rubricItem.id, category: rubricItem.label, note: ui.note.trim(), timestamp: nowTime()
  };
  updateState({ ...state, students: updatedStudents, queue: state.queue.filter((id) => id !== ui.selectedSpeaker), connections: nextConnections, events: [event, ...state.events].slice(0, 250) });
  ui.note = "";
}

async function importRoster(file) {
  const text = await fileToText(file);
  let students = [];
  if (file.name.toLowerCase().endsWith(".json")) {
    const parsed = safeJsonParse(text, []);
    students = Array.isArray(parsed) ? parsed : [];
  } else {
    const rows = parseCsv(text);
    if (rows.length === 0) return;
    const header = rows[0].map((cell) => cell.toLowerCase());
    const dataRows = rows.slice(1);
    const nameIndex = header.findIndex((h) => ["displayname", "name", "student", "studentname"].includes(h));
    const userIndex = header.findIndex((h) => ["username", "user"].includes(h));
    students = dataRows.map((row) => {
      const displayName = row[nameIndex >= 0 ? nameIndex : 0] || row[0] || "Student";
      const username = row[userIndex >= 0 ? userIndex : 0] || displayName.toLowerCase().replace(/\s+/g, "-");
      return { displayName, username };
    });
  }
  const normalized = students.filter(Boolean).map((student, index) => ({
    id: student.id || uid(`stu${index}`),
    username: (student.username || student.displayName || `student-${index + 1}`).toLowerCase().replace(/\s+/g, "-"),
    displayName: student.displayName || student.username || `Student ${index + 1}`,
    points: Number(student.points || 0), queued: false, spokeCount: Number(student.spokeCount || 0)
  }));
  updateState({ ...state, students: normalized, queue: [], connections: [], events: [] });
  ui.importStatus = `Imported ${normalized.length} student(s) from ${file.name}.`;
}

async function importRubric(file) {
  const text = await fileToText(file);
  let rubric = [];
  if (file.name.toLowerCase().endsWith(".json")) {
    const parsed = safeJsonParse(text, []);
    rubric = Array.isArray(parsed) ? parsed : [];
  } else {
    const rows = parseCsv(text);
    if (rows.length === 0) return;
    const header = rows[0].map((cell) => cell.toLowerCase());
    const dataRows = rows.slice(1);
    const labelIndex = header.findIndex((h) => ["label", "criterion", "criteria", "category"].includes(h));
    const valueIndex = header.findIndex((h) => ["value", "points", "pointvalue"].includes(h));
    const colorIndex = header.findIndex((h) => ["color", "hex"].includes(h));
    rubric = dataRows.map((row, index) => ({ label: row[labelIndex >= 0 ? labelIndex : 0] || `Criterion ${index + 1}`, value: Number(row[valueIndex >= 0 ? valueIndex : 1] || 1), color: row[colorIndex] || colorFromIndex(index) }));
  }
  const normalized = rubric.filter((item) => item && item.label).map((item, index) => ({ id: item.id || uid(`rubric${index}`), label: item.label, value: Number(item.value || 1), color: item.color || colorFromIndex(index) }));
  if (normalized.length > 0) {
    updateState({ ...state, rubric: normalized });
    ui.selectedRubricId = normalized[0].id;
    ui.customPoints = normalized[0].value;
    ui.importStatus = `Imported ${normalized.length} rubric item(s) from ${file.name}.`;
  }
}

function exportStudentsCsv() {
  const rows = [["displayName", "username", "points", "timesSpoke", "queued"], ...state.students.map((s) => [s.displayName || s.username, s.username, s.points, s.spokeCount, state.queue.includes(s.id) ? "yes" : "no"])];
  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  downloadText(`${state.sessionCode || "discussion"}-students.csv`, csv, "text/csv;charset=utf-8");
}

function exportEventsCsv() {
  const rows = [["time", "speaker", "respondingTo", "category", "points", "note"], ...state.events.map((e) => [e.timestamp, e.speaker, e.target, e.category, e.points, e.note])];
  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  downloadText(`${state.sessionCode || "discussion"}-events.csv`, csv, "text/csv;charset=utf-8");
}

function exportJson() {
  downloadText(`${state.sessionCode || "discussion"}-session.json`, JSON.stringify(state, null, 2), "application/json;charset=utf-8");
}

function resetDemo() {
  state = JSON.parse(JSON.stringify(sampleState));
  saveState();
  if (channel) channel.postMessage({ type: "STATE_SYNC", payload: state });
  ui.selectedSpeaker = state.students[0]?.id || "";
  ui.selectedTarget = "";
  ui.selectedRubricId = state.rubric[0]?.id || "";
  ui.customPoints = state.rubric[0]?.value || 1;
  ui.note = "";
  ui.selectedNode = "";
  ui.newQuestion = "";
  ui.newStudentName = "";
  ui.importStatus = "Demo session restored.";
  render();
}

function mergedConnections() {
  const map = new Map();
  for (const edge of state.connections) {
    const key = `${edge.from}__${edge.to}__${edge.rubricId || edge.category}`;
    const existing = map.get(key) || { ...edge, weight: 0 };
    existing.weight += edge.weight || 1;
    map.set(key, existing);
  }
  return Array.from(map.values());
}

function radialSvg(hidePoints = false) {
  const size = 560, center = size / 2, radius = 190;
  const total = Math.max(state.students.length, 1);
  const rubricById = Object.fromEntries(state.rubric.map((item) => [item.id, item]));
  const positioned = state.students.map((student, index) => {
    const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
    return { ...student, x: center + radius * Math.cos(angle), y: center + radius * Math.sin(angle) };
  });
  const edges = mergedConnections().map((edge, idx) => {
    const from = positioned.find((p) => p.id === edge.from);
    const to = positioned.find((p) => p.id === edge.to);
    if (!from || !to) return "";
    const mx = (from.x + to.x) / 2, my = (from.y + to.y) / 2;
    const dx = to.x - from.x, dy = to.y - from.y, norm = Math.sqrt(dx * dx + dy * dy) || 1;
    const curve = 34, cx = mx - (dy / norm) * curve, cy = my + (dx / norm) * curve;
    const active = ui.selectedNode && (ui.selectedNode === edge.from || ui.selectedNode === edge.to);
    const edgeColor = rubricById[edge.rubricId]?.color || "#94a3b8";
    return `<g><path d="M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}" fill="none" stroke="${edgeColor}" stroke-width="${Math.min(1.2 + edge.weight * 1.4, 8)}" opacity="${active ? 0.95 : 0.62}" /><circle cx="${to.x}" cy="${to.y}" r="2.2" fill="${edgeColor}" /></g>`;
  }).join("");
  const nodes = positioned.map((student) => {
    const isSelected = ui.selectedNode === student.id;
    const sizeBoost = hidePoints ? 0 : Math.min(student.points * 1.8, 20);
    const nodeRadius = 18 + sizeBoost / 3;
    return `<g class="student-node" data-student-id="${student.id}">
      <circle cx="${student.x}" cy="${student.y}" r="${nodeRadius + (student.queued ? 7 : 0)}" fill="${student.queued ? "#fef3c7" : "#ffffff"}" stroke="${isSelected ? "#0f766e" : "#cbd5e1"}" stroke-width="${isSelected ? 4 : 2}" />
      <circle cx="${student.x}" cy="${student.y}" r="${nodeRadius}" fill="${isSelected ? "#ccfbf1" : "#eff6ff"}" stroke="#94a3b8" />
      <text x="${student.x}" y="${student.y - 2}" text-anchor="middle" fill="#0f172a" font-size="12" font-weight="700">${escapeHtml(student.displayName || student.username)}</text>
      ${hidePoints ? "" : `<text x="${student.x}" y="${student.y + 14}" text-anchor="middle" fill="#64748b" font-size="10">${student.points} pts</text>`}
    </g>`;
  }).join("");
  return `<div class="svg-wrap"><svg viewBox="0 0 ${size} ${size}">
    <circle cx="${center}" cy="${center}" r="${radius + 44}" fill="#ffffff" stroke="#e2e8f0" stroke-width="1" />
    <circle cx="${center}" cy="${center}" r="54" fill="#0f172a" opacity="0.04" />
    <text x="${center}" y="${center - 3}" text-anchor="middle" fill="#0f172a" font-size="14" font-weight="700">Discussion Map</text>
    <text x="${center}" y="${center + 18}" text-anchor="middle" fill="#64748b" font-size="11">color-coded by contribution type</text>
    ${edges}${nodes}
  </svg>
  <div class="legend-wrap">${state.rubric.map((item) => `<div class="legend-pill"><span class="dot" style="background:${item.color}"></span>${escapeHtml(item.label)}</div>`).join("")}</div></div>`;
}

function statCard(label, value, hint) {
  return `<section class="card stat"><div class="muted">${escapeHtml(label)}</div><div class="big">${escapeHtml(value)}</div><div class="subtle">${escapeHtml(hint)}</div></section>`;
}

function teacherView() {
  const rubricItem = selectedRubric();
  return `
    <div class="grid-4 no-print">
      ${statCard("Students", state.students.length, "current roster")}
      ${statCard("Points awarded", totalPoints(), "session total")}
      ${statCard("Queued speakers", state.queue.length, "live speaking order")}
      ${statCard("Connections logged", totalConnections(), "response-to-peer events")}
    </div>

    <div class="layout-main no-print">
      <section class="card">
        <div class="row-between"><h2>Live discussion map</h2><div class="muted">Click a node to highlight a student.</div></div>
        ${radialSvg(false)}
      </section>

      <div class="stack">
        <section class="card">
          <div class="row-between"><h2>Award participation points</h2></div>
          <div class="form-grid">
            <div><label>Speaker</label><select id="selectedSpeaker">${state.students.map((s) => `<option value="${s.id}" ${ui.selectedSpeaker === s.id ? "selected" : ""}>${escapeHtml(s.displayName || s.username)}</option>`).join("")}</select></div>
            <div><label>Responding to (optional)</label><select id="selectedTarget"><option value="">No connection logged</option>${state.students.filter((s) => s.id !== ui.selectedSpeaker).map((s) => `<option value="${s.id}" ${ui.selectedTarget === s.id ? "selected" : ""}>${escapeHtml(s.displayName || s.username)}</option>`).join("")}</select></div>
            <div class="two-col"><div><label>Rubric category</label><select id="selectedRubricId">${state.rubric.map((r) => `<option value="${r.id}" ${ui.selectedRubricId === r.id ? "selected" : ""}>${escapeHtml(r.label)}</option>`).join("")}</select></div><div><label>Points</label><input id="customPoints" type="number" value="${escapeHtml(ui.customPoints)}" /></div></div>
            <div><label>Teacher note (optional)</label><textarea id="teacherNote" placeholder="Quick evidence or feedback note...">${escapeHtml(ui.note)}</textarea></div>
            <button class="btn btn-primary" id="addPointsBtn">Add points + log contribution</button>
            ${rubricItem ? `<div class="notice">Default value for <strong>${escapeHtml(rubricItem.label)}</strong> is <strong>${rubricItem.value}</strong> point(s).</div>` : ""}
          </div>
        </section>

        <section class="card">
          <div class="row-between"><h2>Session controls</h2><button class="btn ${state.sessionStatus === "open" ? "btn-rose" : "btn-teal"}" id="toggleSessionStatusBtn">${state.sessionStatus === "open" ? "Close session + reveal map" : "Re-open session"}</button></div>
          <div class="two-col-even">
            <div><label>Class name</label><input id="classNameInput" type="text" value="${escapeHtml(state.className)}" placeholder="Enter class name" /></div>
            <div><label>Session title</label><input id="sessionTitleInput" type="text" value="${escapeHtml(state.sessionTitle)}" placeholder="Enter session title" /></div>
            <div><label>Session code</label><input id="sessionCodeInput" type="text" value="${escapeHtml(state.sessionCode)}" placeholder="Enter session code" /></div>
            <div class="btn-group" style="align-items:end;"><button class="btn" id="printBtn">Print / Save PDF</button><button class="btn" id="resetBtn">Reset demo</button></div>
          </div>
        </section>
      </div>
    </div>

    <div class="layout-lower no-print">
      <section class="card">
        <div class="row-between"><h2>Roster, rubric, and exports</h2><div class="btn-group"><button class="btn small" id="exportStudentsBtn">Export students CSV</button><button class="btn small" id="exportEventsBtn">Export events CSV</button><button class="btn small" id="exportJsonBtn">Export JSON</button></div></div>
        <div class="two-col-even">
          <div class="item"><div style="font-weight:700;">Import roster</div><div class="muted" style="margin-top:6px;">Accepts CSV or JSON. Suggested columns: <span class="mono">displayName, username</span>.</div><input id="rosterFileInput" class="hidden" type="file" accept=".csv,.json" /><button class="btn btn-teal" id="chooseRosterBtn" style="margin-top:12px;">Choose roster file</button></div>
          <div class="item"><div style="font-weight:700;">Import rubric</div><div class="muted" style="margin-top:6px;">Accepts CSV or JSON. Suggested columns: <span class="mono">label, value, color</span>.</div><input id="rubricFileInput" class="hidden" type="file" accept=".csv,.json" /><button class="btn btn-primary" id="chooseRubricBtn" style="margin-top:12px;">Choose rubric file</button></div>
        </div>
        ${ui.importStatus ? `<div class="notice" style="margin-top:16px;">${escapeHtml(ui.importStatus)}</div>` : ""}
        <div class="item" style="margin-top:16px;"><div style="font-weight:700; margin-bottom:12px;">Quick add student</div><div class="two-col-wide"><input id="newStudentNameInput" type="text" value="${escapeHtml(ui.newStudentName)}" placeholder="Enter student name" /><button class="btn" id="addStudentBtn">Add student</button></div></div>
        <div class="student-grid" style="margin-top:16px;">${state.students.map((student) => `<div class="item ${ui.selectedNode === student.id ? "selected" : ""}"><div class="row-between"><div><div style="font-weight:700;">${escapeHtml(student.displayName || student.username)}</div><div class="subtle" style="margin-top:4px;">${escapeHtml(student.username)} • ${student.points} pts • ${student.spokeCount} contribution(s)</div></div><button class="btn small" data-remove-student="${student.id}">Remove</button></div><div class="btn-group" style="margin-top:12px;"><button class="btn small" data-toggle-queue="${student.id}">${state.queue.includes(student.id) ? "Remove from queue" : "Queue speaker"}</button><button class="btn small" data-select-speaker="${student.id}">Select for scoring</button><button class="btn small" data-highlight-node="${student.id}">Highlight map</button></div></div>`).join("")}</div>
      </section>

      <div class="stack">
        <section class="card"><h2>Speaker queue</h2><div class="queue-list" style="margin-top:16px;">${state.queue.length === 0 ? `<div class="muted">Nobody is waiting to speak.</div>` : ""}${state.queue.map((id, idx) => { const student = getStudent(id); if (!student) return ""; return `<div class="queue-row"><div class="row-between" style="align-items:center;"><div><div style="font-weight:700;">${idx + 1}. ${escapeHtml(student.displayName || student.username)}</div><div class="subtle">${student.points} pts • ${student.spokeCount} contributions logged</div></div><div class="btn-group"><button class="btn small" data-queue-up="${id}">↑</button><button class="btn small" data-queue-down="${id}">↓</button><button class="btn small" data-toggle-queue="${id}">Done</button></div></div></div>`; }).join("")}</div></section>
        <section class="card"><h2>Discussion questions</h2><div class="list-stack" style="margin-top:16px;">${state.questions.map((q, index) => `<div class="list-box">${index + 1}. ${escapeHtml(q)}</div>`).join("")}${state.questions.length === 0 ? `<div class="muted">No discussion questions entered yet.</div>` : ""}<div class="two-col-wide"><input id="newQuestionInput" type="text" value="${escapeHtml(ui.newQuestion)}" placeholder="Add a new discussion question" /><button class="btn" id="addQuestionBtn">Add question</button></div></div></section>
        <section class="card"><h2>Scoring criteria</h2><div class="list-stack" style="margin-top:16px;">${state.rubric.map((item) => `<div class="item" style="display:flex; justify-content:space-between; gap:12px; align-items:center;"><span style="display:flex; align-items:center; gap:8px;"><span class="dot" style="background:${item.color}"></span>${escapeHtml(item.label)}</span><strong>${item.value} pt</strong></div>`).join("")}</div></section>
        <section class="card"><h2>Recent contribution log</h2><div class="event-list" style="margin-top:16px;">${state.events.map((event) => `<div class="event-row"><div class="row-between"><div><div style="font-weight:700;">${escapeHtml(event.speaker)}</div><div class="subtle">${escapeHtml(event.timestamp)}</div></div><div class="legend-pill">+${event.points} pts</div></div><div style="margin-top:6px; color:#475569;">${escapeHtml(event.category)}${event.target ? ` • responding to ${escapeHtml(event.target)}` : ""}</div>${event.note ? `<div style="margin-top:6px; color:#64748b;">${escapeHtml(event.note)}</div>` : ""}</div>`).join("")}</div></section>
      </div>
    </div>`;
}

function displayView() {
  const queueStudents = state.queue.map((id) => getStudent(id)).filter(Boolean);
  const gridClass = state.sessionStatus === "closed" ? "display-grid-closed" : "display-grid-open";
  return `<div class="stack"><section class="card"><div class="hero-row"><div><div class="badge">Student display</div><h1 style="margin:12px 0 8px;">${escapeHtml(state.sessionTitle || "Discussion Session")}</h1><div class="muted">${escapeHtml(state.className || "Class")}${state.sessionCode ? ` • Session code: <span class="mono" style="font-weight:700;">${escapeHtml(state.sessionCode)}</span>` : ""}</div></div><div class="lite"><div class="label">Discussion status</div><div class="value">${state.sessionStatus === "closed" ? "Closed — map visible" : "Open — queue/questions visible"}</div></div></div></section><div class="${gridClass}"><section class="card"><h2>Speaking queue</h2><div class="list-stack" style="margin-top:16px;">${queueStudents.length === 0 ? `<div class="muted">No one is waiting to speak right now.</div>` : ""}${queueStudents.map((student, index) => `<div class="display-queue">${index + 1}. ${escapeHtml(student.displayName || student.username)}</div>`).join("")}</div></section><div class="stack"><section class="card"><h2>Discussion questions</h2><div class="list-stack" style="margin-top:16px;">${state.questions.map((q, index) => `<div class="item">${index + 1}. ${escapeHtml(q)}</div>`).join("")}${state.questions.length === 0 ? `<div class="muted">No discussion questions entered yet.</div>` : ""}</div></section><section class="card"><h2>Scoring criteria</h2><div class="list-stack" style="margin-top:16px;">${state.rubric.map((item) => `<div class="item" style="display:flex; justify-content:space-between; gap:12px; align-items:center;"><span style="display:flex; align-items:center; gap:8px;"><span class="dot" style="background:${item.color}"></span>${escapeHtml(item.label)}</span><strong>${item.value} pt</strong></div>`).join("")}</div></section></div></div>${state.sessionStatus === "closed" ? `<section class="card"><h2>Final discussion map</h2>${radialSvg(true)}</section>` : ""}</div>`;
}

function render() {
  if (!ui.selectedSpeaker && state.students[0]?.id) ui.selectedSpeaker = state.students[0].id;
  if (!state.rubric.find((r) => r.id === ui.selectedRubricId) && state.rubric[0]) {
    ui.selectedRubricId = state.rubric[0].id;
    ui.customPoints = state.rubric[0].value;
  }
  app.innerHTML = `<section class="hero no-print"><div class="hero-row"><div><div class="badge">Teacher-focused GitHub Pages package</div><h1 style="margin:12px 0 8px;">Harkness Discussion Tracker</h1><div class="muted">A teacher-operated, no-backend discussion tracker designed for GitHub Pages. Import a roster and rubric, manage the queue, award points, map student-to-student responses, and export session results as CSV, JSON, or printable PDF.</div></div><div class="top-panels"><div class="lite"><div class="label">Local autosave</div><div class="value">Stored in this browser</div></div><div class="lite"><div class="label">View mode</div><div class="segmented"><button id="viewTeacherBtn" class="${ui.view === "teacher" ? "active" : ""}">Teacher</button><button id="viewDisplayBtn" class="${ui.view === "display" ? "active" : ""}">Student display</button></div></div></div></div></section>${ui.view === "teacher" ? teacherView() : displayView()}<section class="footer-note no-print"><div style="font-weight:700; color:#0f172a;">Deployment note</div><div style="margin-top:6px;">This site is intentionally backend-free. Open Teacher view in one tab/window and Student display in another tab/window on the same GitHub Pages URL for live syncing.</div></section>`;
  bindEvents();
}

function bindEvents() {
  const bind = (selector, event, handler) => {
    const el = document.querySelector(selector);
    if (el) el.addEventListener(event, handler);
  };

  bind("#viewTeacherBtn", "click", () => { ui.view = "teacher"; render(); });
  bind("#viewDisplayBtn", "click", () => { ui.view = "display"; render(); });

  document.querySelectorAll(".student-node").forEach((node) => node.addEventListener("click", () => setUI({ selectedNode: node.dataset.studentId })));

  if (ui.view !== "teacher") return;

  bind("#selectedSpeaker", "change", (e) => setUI({ selectedSpeaker: e.target.value, selectedTarget: "" }));
  bind("#selectedTarget", "change", (e) => setUI({ selectedTarget: e.target.value }));
  bind("#selectedRubricId", "change", (e) => {
    const selected = state.rubric.find((r) => r.id === e.target.value);
    setUI({ selectedRubricId: e.target.value, customPoints: selected ? selected.value : ui.customPoints });
  });
  bind("#customPoints", "input", (e) => setUI({ customPoints: e.target.value }));
  bind("#teacherNote", "input", (e) => setUI({ note: e.target.value }));
  bind("#addPointsBtn", "click", addPoints);

  bind("#toggleSessionStatusBtn", "click", () => updateState({ ...state, sessionStatus: state.sessionStatus === "open" ? "closed" : "open" }));
  bind("#classNameInput", "input", (e) => updateState({ ...state, className: e.target.value }));
  bind("#sessionTitleInput", "input", (e) => updateState({ ...state, sessionTitle: e.target.value }));
  bind("#sessionCodeInput", "input", (e) => updateState({ ...state, sessionCode: e.target.value.toUpperCase() }));
  bind("#printBtn", "click", () => window.print());
  bind("#resetBtn", "click", resetDemo);

  bind("#newQuestionInput", "input", (e) => setUI({ newQuestion: e.target.value }));
  bind("#addQuestionBtn", "click", addQuestion);
  bind("#newStudentNameInput", "input", (e) => setUI({ newStudentName: e.target.value }));
  bind("#addStudentBtn", "click", addStudent);

  bind("#exportStudentsBtn", "click", exportStudentsCsv);
  bind("#exportEventsBtn", "click", exportEventsCsv);
  bind("#exportJsonBtn", "click", exportJson);

  const rosterInput = document.querySelector("#rosterFileInput");
  const rubricInput = document.querySelector("#rubricFileInput");
  bind("#chooseRosterBtn", "click", () => rosterInput && rosterInput.click());
  bind("#chooseRubricBtn", "click", () => rubricInput && rubricInput.click());
  if (rosterInput) rosterInput.addEventListener("change", async (e) => { if (e.target.files?.[0]) { await importRoster(e.target.files[0]); render(); } });
  if (rubricInput) rubricInput.addEventListener("change", async (e) => { if (e.target.files?.[0]) { await importRubric(e.target.files[0]); render(); } });

  document.querySelectorAll("[data-remove-student]").forEach((btn) => btn.addEventListener("click", () => removeStudent(btn.dataset.removeStudent)));
  document.querySelectorAll("[data-toggle-queue]").forEach((btn) => btn.addEventListener("click", () => toggleQueued(btn.dataset.toggleQueue)));
  document.querySelectorAll("[data-select-speaker]").forEach((btn) => btn.addEventListener("click", () => setUI({ selectedSpeaker: btn.dataset.selectSpeaker })));
  document.querySelectorAll("[data-highlight-node]").forEach((btn) => btn.addEventListener("click", () => setUI({ selectedNode: btn.dataset.highlightNode })));
  document.querySelectorAll("[data-queue-up]").forEach((btn) => btn.addEventListener("click", () => moveQueue(btn.dataset.queueUp, "up")));
  document.querySelectorAll("[data-queue-down]").forEach((btn) => btn.addEventListener("click", () => moveQueue(btn.dataset.queueDown, "down")));
}

render();

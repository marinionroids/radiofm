const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const API = {
    async get(path) {
        const r = await fetch("/api" + path);
        if (!r.ok) { const e = await r.json().catch(() => ({})); throw e; }
        return r.json();
    },
    async post(path, body) {
        const r = await fetch("/api" + path, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        if (!r.ok) { const e = await r.json().catch(() => ({})); throw e; }
        return r.json();
    },
    async put(path, body) {
        const r = await fetch("/api" + path, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        if (!r.ok) { const e = await r.json().catch(() => ({})); throw e; }
        return r.json();
    },
    async del(path) {
        const r = await fetch("/api" + path, { method: "DELETE" });
        if (!r.ok) { const e = await r.json().catch(() => ({})); throw e; }
        return r.json();
    },
};

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

/* ─── Toast ─── */
function toast(msg, ok = true) {
    const icons = {
        true: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
        false: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    };
    const el = document.createElement("div");
    el.className = `toast toast-${ok ? "success" : "error"}`;
    el.innerHTML = icons[ok] + msg;
    $("#toast-container").appendChild(el);
    setTimeout(() => { el.style.opacity = "0"; el.style.transition = "opacity 0.3s"; setTimeout(() => el.remove(), 300); }, 3500);
}

/* ─── Helpers ─── */
function esc(s) { const d = document.createElement("div"); d.textContent = s || ""; return d.innerHTML; }
function fmtDuration(s) {
    if (!s) return "—";
    const m = Math.floor(s / 60), sec = Math.floor(s % 60);
    if (m >= 60) { const h = Math.floor(m / 60); return `${h}h ${m % 60}m`; }
    return `${m}m ${sec}s`;
}
function fmtSize(b) {
    if (!b) return "—";
    if (b < 1_048_576) return (b / 1024).toFixed(1) + " KB";
    return (b / 1_048_576).toFixed(1) + " MB";
}

/* ─── Clock ─── */
function tick() {
    const now = new Date();
    $("#clock").textContent = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
tick(); setInterval(tick, 10000);

/* ─── Modal ─── */
function openModal(title, html) {
    $("#modal-title").textContent = title;
    $("#modal-body").innerHTML = html;
    $("#modal-overlay").classList.remove("hidden");
}
function closeModal() { $("#modal-overlay").classList.add("hidden"); }
$("#modal-close").addEventListener("click", closeModal);
$("#modal-overlay").addEventListener("click", (e) => { if (e.target === $("#modal-overlay")) closeModal(); });

/* ─── Navigation ─── */
let currentTab = "dashboard";

$$(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => {
        currentTab = btn.dataset.tab;
        $$(".nav-item").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        const titles = { dashboard: "Dashboard", stations: "Stations", schedules: "Schedules", recordings: "Recordings" };
        $("#page-title").textContent = titles[currentTab] || currentTab;
        if (currentTab === "dashboard") renderDashboard();
        else if (currentTab === "stations") renderStations();
        else if (currentTab === "schedules") renderSchedules();
        else if (currentTab === "recordings") renderRecordings();
    });
});

/* ─── Dashboard ─── */
async function renderDashboard() {
    let stats;
    try { stats = await API.get("/recordings/stats/summary"); } catch (e) { stats = null; }

    const totalRecordings = stats?.total_recordings ?? 0;
    const totalSize = stats?.total_size_bytes ?? 0;
    const totalDuration = stats?.total_duration_seconds ?? 0;
    let nextRun = "—";
    if (stats?.next_runs?.length) {
        const d = new Date(stats.next_runs[0].next_run);
        nextRun = d.toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" });
    }

    let stationsCount = 0, schedulesCount = 0;
    try {
        const [st, sc] = await Promise.all([API.get("/stations"), API.get("/schedules")]);
        stationsCount = st.length;
        schedulesCount = sc.filter(s => s.enabled).length;
    } catch (e) {}

    $("#content").innerHTML = `
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-card-header"><span class="stat-card-label">Stations</span>
                    <svg class="stat-card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.5 19V5m-11 14V5M2 12h20"/><circle cx="12" cy="12" r="10"/></svg></div>
                <div class="stat-card-value">${stationsCount}</div>
            </div>
            <div class="stat-card">
                <div class="stat-card-header"><span class="stat-card-label">Active Schedules</span>
                    <svg class="stat-card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
                <div class="stat-card-value">${schedulesCount}</div>
            </div>
            <div class="stat-card">
                <div class="stat-card-header"><span class="stat-card-label">Recordings</span>
                    <svg class="stat-card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg></div>
                <div class="stat-card-value">${totalRecordings}</div>
                <div class="stat-card-sub">${fmtSize(totalSize)} total</div>
            </div>
            <div class="stat-card">
                <div class="stat-card-header"><span class="stat-card-label">Next Recording</span>
                    <svg class="stat-card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div>
                <div class="stat-card-value" style="font-size:1.2rem">${nextRun}</div>
                <div class="stat-card-sub">${fmtDuration(totalDuration)} recorded</div>
            </div>
        </div>`;
}

/* ─── Stations ─── */
async function renderStations() {
    let stations;
    try { stations = await API.get("/stations"); } catch (e) { stations = []; }

    if (!stations.length) {
        $("#content").innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17.5 19V5m-11 14V5M2 12h20"/><circle cx="12" cy="12" r="10"/></svg>
                <h3>No stations</h3><p>Add a radio station to get started.</p>
                <button class="btn btn-primary" onclick="showStationForm()">Add Station</button>
            </div>`;
        return;
    }

    let cards = stations.map(s => `
        <div class="station-card">
            <div class="station-card-top">
                <span class="station-card-name">${esc(s.name)}</span>
                <span class="badge ${s.enabled ? 'badge-success' : 'badge-danger'}">${s.enabled ? 'Active' : 'Disabled'}</span>
            </div>
            <div class="station-card-url">${esc(s.url)}</div>
            <div class="station-card-actions">
                <button class="btn btn-ghost btn-sm" onclick="showStationForm('${s._id}')">Edit</button>
                <button class="btn btn-ghost btn-sm btn-danger" onclick="deleteStation('${s._id}')">Delete</button>
            </div>
        </div>
    `).join("");

    $("#content").innerHTML = `
        <div class="action-bar">
            <span class="action-bar-title">All Stations</span>
            <button class="btn btn-primary" onclick="showStationForm()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add Station
            </button>
        </div>
        <div class="station-grid">${cards}</div>`;
}

function showStationForm(id) {
    const isEdit = !!id;
    let html = `<input type="hidden" id="f-sid" value="${id||""}">
        <div class="form-group"><label class="form-label">Name</label><input class="form-input" id="f-name" placeholder="BBC Radio 1"></div>
        <div class="form-group"><label class="form-label">Stream URL</label><input class="form-input" id="f-url" placeholder="http://stream.example.com/radio"></div>
        <div class="form-actions">
            <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
            <button class="btn btn-primary" id="f-save">${isEdit?'Update':'Create'}</button>
        </div>`;
    openModal(isEdit ? "Edit Station" : "Add Station", html);

    if (isEdit) {
        API.get("/stations").then(stations => {
            const s = stations.find(x => x._id === id);
            if (s) { $("#f-name").value = s.name; $("#f-url").value = s.url; }
        });
    }
    $("#f-save").addEventListener("click", async () => {
        const name = $("#f-name").value.trim(), url = $("#f-url").value.trim();
        if (!name || !url) return toast("Name and URL required", false);
        try {
            isEdit ? await API.put(`/stations/${id}`, { name, url }) : await API.post("/stations", { name, url });
            closeModal(); toast(isEdit ? "Station updated" : "Station created"); renderStations();
        } catch (e) { toast(e.detail || "Error", false); }
    });
}

async function deleteStation(id) {
    if (!confirm("Delete this station and its schedules?")) return;
    await API.del(`/stations/${id}`); toast("Station deleted"); renderStations();
}

/* ─── Schedules ─── */
async function renderSchedules() {
    let schedules, stations;
    try { [schedules, stations] = await Promise.all([API.get("/schedules"), API.get("/stations")]); } catch (e) { schedules=[]; stations=[]; }

    if (!schedules.length) {
        $("#content").innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <h3>No schedules</h3><p>Create a recording schedule for a station.</p>
                <button class="btn btn-primary" onclick="showScheduleForm()">Add Schedule</button>
            </div>`;
        return;
    }

    let rows = schedules.map(s => {
        const time = `${String(s.hour).padStart(2,"0")}:${String(s.minute).padStart(2,"0")}`;
        return `
        <tr>
            <td><strong>${esc(s.station_name||"—")}</strong></td>
            <td>${DAYS[s.day_of_week]}</td>
            <td>${time}</td>
            <td>${s.duration_minutes}m</td>
            <td><span class="badge ${s.enabled?'badge-success':'badge-muted'}">${s.enabled?'Active':'Paused'}</span></td>
            <td>
                <div style="display:flex;gap:4px;">
                    <button class="btn btn-ghost btn-sm" onclick="showScheduleForm('${s._id}')">Edit</button>
                    <button class="btn btn-ghost btn-sm btn-danger" onclick="deleteSchedule('${s._id}')">Delete</button>
                </div>
            </td>
        </tr>`;
    }).join("");

    $("#content").innerHTML = `
        <div class="action-bar">
            <span class="action-bar-title">All Schedules</span>
            <button class="btn btn-primary" onclick="showScheduleForm()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add Schedule
            </button>
        </div>
        <div class="table-wrap">
            <table>
                <thead><tr><th>Station</th><th>Day</th><th>Time</th><th>Duration</th><th>Status</th><th></th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>`;
}

function showScheduleForm(id) {
    API.get("/stations").then(stations => {
        if (!stations.length) return toast("Add a station first", false);
        const isEdit = !!id;
        let sopts = stations.map(s => `<option value="${s._id}">${esc(s.name)}</option>`).join("");
        let dopts = DAYS.map((d,i) => `<option value="${i}">${d}</option>`).join("");

        let html = `<input type="hidden" id="f-sid" value="${id||""}">
            <div class="form-group"><label class="form-label">Station</label><select class="form-select" id="f-station">${sopts}</select></div>
            <div class="form-group"><label class="form-label">Day</label><select class="form-select" id="f-day">${dopts}</select></div>
            <div class="form-row">
                <div class="form-group"><label class="form-label">Hour (0-23)</label><input class="form-input" id="f-hour" type="number" min="0" max="23" value="18"></div>
                <div class="form-group"><label class="form-label">Minute (0-59)</label><input class="form-input" id="f-minute" type="number" min="0" max="59" value="0"></div>
            </div>
            <div class="form-group"><label class="form-label">Duration (minutes)</label><input class="form-input" id="f-duration" type="number" min="1" max="360" value="120"></div>
            <div class="form-group">
                <div class="toggle"><div class="toggle-switch"><input id="f-enabled" type="checkbox" checked><label class="toggle-track" for="f-enabled"></label></div><span class="toggle-label">Enabled</span></div>
            </div>
            <div class="form-actions">
                <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
                <button class="btn btn-primary" id="f-save">${isEdit?'Update':'Create'}</button>
            </div>`;
        openModal(isEdit ? "Edit Schedule" : "Add Schedule", html);

        if (isEdit) {
            API.get("/schedules").then(schedules => {
                const s = schedules.find(x => x._id === id);
                if (s) { $("#f-station").value=s.station_id; $("#f-day").value=s.day_of_week; $("#f-hour").value=s.hour; $("#f-minute").value=s.minute; $("#f-duration").value=s.duration_minutes; $("#f-enabled").checked=s.enabled; }
            });
        }

        $("#f-save").addEventListener("click", async () => {
            const body = {
                station_id: $("#f-station").value,
                day_of_week: parseInt($("#f-day").value),
                hour: parseInt($("#f-hour").value),
                minute: parseInt($("#f-minute").value),
                duration_minutes: parseInt($("#f-duration").value),
                enabled: $("#f-enabled").checked,
            };
            try {
                isEdit ? await API.put(`/schedules/${id}`, body) : await API.post("/schedules", body);
                closeModal(); toast(isEdit ? "Schedule updated" : "Schedule created"); renderSchedules();
            } catch (e) { toast(e.detail || "Error", false); }
        });
    });
}

async function deleteSchedule(id) {
    if (!confirm("Delete this schedule?")) return;
    await API.del(`/schedules/${id}`); toast("Schedule deleted"); renderSchedules();
}

/* ─── Recordings ─── */
let recPage = 1;

async function renderRecordings() {
    let data;
    try { data = await API.get(`/recordings?page=${recPage}&per_page=20`); } catch (e) { data = { recordings: [], total: 0, page: 1, total_pages: 1 }; }

    if (!data.recordings.length) {
        $("#content").innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                <h3>No recordings yet</h3><p>Recordings will appear here after schedules run.</p>
            </div>`;
        return;
    }

    let rows = data.recordings.map(r => {
        let sBadge = "";
        if (r.status === "recording") sBadge = '<span class="badge badge-warning">Recording</span>';
        else if (r.status === "failed") sBadge = '<span class="badge badge-danger">Failed</span>';
        else sBadge = '<span class="badge badge-success">Done</span>';

        let tgBadge = "";
        if (r.telegram_status === "sent") tgBadge = '<span class="badge badge-success">Sent</span>';
        else if (r.telegram_status === "failed") tgBadge = '<span class="badge badge-danger">Failed</span>';
        else tgBadge = '<span class="badge badge-muted">—</span>';

        let actions = "";
        if (r.status === "completed") {
            actions = `<a href="/api/recordings/${r._id}/download" class="btn btn-ghost btn-sm" download>Download</a>
                       <button class="btn btn-ghost btn-sm" onclick="sendTelegram('${r._id}')">Send TG</button>`;
        }

        return `<tr>
            <td class="text-sm text-dim">${new Date(r.started_at).toLocaleString()}</td>
            <td>${esc(r.station_name||"—")}</td>
            <td>${fmtDuration(r.duration_seconds)}</td>
            <td>${fmtSize(r.size_bytes)}</td>
            <td>${sBadge}</td>
            <td>${tgBadge}</td>
            <td>${actions}</td>
        </tr>`;
    }).join("");

    let pag = "";
    if (data.total_pages > 1) {
        for (let i = 1; i <= data.total_pages; i++) {
            pag += `<button class="btn btn-sm ${i===data.page?'btn-primary':''}" onclick="recPage=${i};renderRecordings()">${i}</button>`;
        }
    }

    $("#content").innerHTML = `
        <div class="action-bar">
            <span class="action-bar-title">Recordings <span class="text-dim">(${data.total})</span></span>
            <span class="text-sm text-dim">${fmtSize(data.recordings.reduce((a,r)=>a+(r.size_bytes||0),0))} on this page</span>
        </div>
        <div class="table-wrap">
            <table>
                <thead><tr><th>Date</th><th>Station</th><th>Duration</th><th>Size</th><th>Status</th><th>Telegram</th><th></th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
        ${pag ? `<div class="pagination">${pag}</div>` : ""}`;
}

async function sendTelegram(id) {
    try { await API.post(`/recordings/${id}/send-telegram`); toast("Sent to Telegram"); renderRecordings(); }
    catch (e) { toast("Error sending to Telegram", false); }
}

/* ─── Init ─── */
renderDashboard();

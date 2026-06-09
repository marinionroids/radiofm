const API = {
    async get(path) {
        const r = await fetch("/api" + path);
        if (!r.ok) throw await r.json();
        return r.json();
    },
    async post(path, body) {
        const r = await fetch("/api" + path, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        if (!r.ok) throw await r.json();
        return r.json();
    },
    async put(path, body) {
        const r = await fetch("/api" + path, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        if (!r.ok) throw await r.json();
        return r.json();
    },
    async del(path) {
        const r = await fetch("/api" + path, { method: "DELETE" });
        if (!r.ok) throw await r.json();
        return r.json();
    },
};

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function toast(msg, ok = true) {
    const el = document.createElement("div");
    el.className = `toast toast-${ok ? "success" : "error"}`;
    el.textContent = msg;
    document.getElementById("toast-container").appendChild(el);
    setTimeout(() => el.remove(), 3500);
}

function formatDuration(s) {
    if (!s) return "-";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    if (m >= 60) {
        const h = Math.floor(m / 60);
        const rm = m % 60;
        return `${h}h ${rm}m ${sec}s`;
    }
    return `${m}m ${sec}s`;
}

function formatSize(bytes) {
    if (!bytes) return "-";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function openModal(title, bodyHtml) {
    document.getElementById("modal-title").textContent = title;
    document.getElementById("modal-body").innerHTML = bodyHtml;
    document.getElementById("modal-overlay").classList.remove("hidden");
}

function closeModal() {
    document.getElementById("modal-overlay").classList.add("hidden");
}

document.getElementById("modal-close").addEventListener("click", closeModal);
document.getElementById("modal-overlay").addEventListener("click", (e) => {
    if (e.target === document.getElementById("modal-overlay")) closeModal();
});

// ==================== TAB NAVIGATION ====================
document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        const name = tab.dataset.tab;
        if (name === "stations") renderStations();
        else if (name === "schedules") renderSchedules();
        else if (name === "recordings") renderRecordings();
    });
});

// ==================== STATIONS ====================
async function renderStations() {
    const stations = await API.get("/stations");
    const content = document.getElementById("content");

    if (stations.length === 0) {
        content.innerHTML = `
            <div class="toolbar"><h2>Stations</h2><button class="btn btn-primary" onclick="showStationForm()">+ Add Station</button></div>
            <div class="empty-state"><p>No stations yet</p></div>`;
        return;
    }

    let rows = stations.map((s) => `
        <tr>
            <td><strong>${esc(s.name)}</strong></td>
            <td class="text-muted text-mono">${esc(s.url)}</td>
            <td><span class="badge ${s.enabled ? "badge-green" : "badge-red"}">${s.enabled ? "On" : "Off"}</span></td>
            <td class="actions-cell">
                <button class="btn btn-sm" onclick="showStationForm('${s._id}')">Edit</button>
                <button class="btn btn-sm btn-danger" onclick="deleteStation('${s._id}')">Delete</button>
            </td>
        </tr>
    `).join("");

    content.innerHTML = `
        <div class="toolbar"><h2>Stations</h2><button class="btn btn-primary" onclick="showStationForm()">+ Add Station</button></div>
        <table>
            <thead><tr><th>Name</th><th>URL</th><th>Status</th><th></th></tr></thead>
            <tbody>${rows}</tbody>
        </table>`;
}

function showStationForm(id = null) {
    const isEdit = !!id;
    let html = `<input type="hidden" id="f-station-id" value="${id || ""}">
        <div class="form-group">
            <label>Name</label>
            <input id="f-station-name" placeholder="e.g. BBC Radio 1">
        </div>
        <div class="form-group">
            <label>Stream URL</label>
            <input id="f-station-url" placeholder="http://...">
        </div>
        <div class="form-actions">
            <button class="btn" onclick="closeModal()">Cancel</button>
            <button class="btn btn-primary" id="f-station-save">${isEdit ? "Update" : "Create"}</button>
        </div>`;

    openModal(isEdit ? "Edit Station" : "Add Station", html);

    if (isEdit) {
        API.get("/stations").then((stations) => {
            const s = stations.find((x) => x._id === id);
            if (s) {
                document.getElementById("f-station-name").value = s.name;
                document.getElementById("f-station-url").value = s.url;
            }
        });
    }

    document.getElementById("f-station-save").addEventListener("click", async () => {
        const name = document.getElementById("f-station-name").value.trim();
        const url = document.getElementById("f-station-url").value.trim();
        if (!name || !url) { toast("Name and URL required", false); return; }
        try {
            if (isEdit) {
                await API.put(`/stations/${id}`, { name, url });
            } else {
                await API.post("/stations", { name, url });
            }
            closeModal();
            toast(isEdit ? "Station updated" : "Station created");
            renderStations();
        } catch (e) {
            toast(e.detail || "Error saving station", false);
        }
    });
}

async function deleteStation(id) {
    if (!confirm("Delete this station and all its schedules?")) return;
    try {
        await API.del(`/stations/${id}`);
        toast("Station deleted");
        renderStations();
    } catch (e) {
        toast("Error deleting station", false);
    }
}

// ==================== SCHEDULES ====================
async function renderSchedules() {
    const [schedules, stations] = await Promise.all([API.get("/schedules"), API.get("/stations")]);
    const content = document.getElementById("content");

    if (schedules.length === 0) {
        content.innerHTML = `
            <div class="toolbar"><h2>Schedules</h2><button class="btn btn-primary" onclick="showScheduleForm()">+ Add Schedule</button></div>
            <div class="empty-state"><p>No schedules yet</p></div>`;
        return;
    }

    let rows = schedules.map((s) => {
        const day = DAYS[s.day_of_week];
        const time = `${String(s.hour).padStart(2, "0")}:${String(s.minute).padStart(2, "0")}`;
        return `
        <tr>
            <td>${esc(s.station_name || "—")}</td>
            <td>${day}</td>
            <td>${time}</td>
            <td>${s.duration_minutes}m</td>
            <td>
                <label class="switch" onclick="toggleSchedule('${s._id}')" title="Click to toggle">
                    <input type="checkbox" ${s.enabled ? "checked" : ""} disabled>
                    <span class="slider"></span>
                </label>
            </td>
            <td class="actions-cell">
                <button class="btn btn-sm" onclick="showScheduleForm('${s._id}')">Edit</button>
                <button class="btn btn-sm btn-danger" onclick="deleteSchedule('${s._id}')">Delete</button>
            </td>
        </tr>`;
    }).join("");

    content.innerHTML = `
        <div class="toolbar"><h2>Schedules</h2><button class="btn btn-primary" onclick="showScheduleForm()">+ Add Schedule</button></div>
        <table>
            <thead><tr><th>Station</th><th>Day</th><th>Time</th><th>Duration</th><th>Active</th><th></th></tr></thead>
            <tbody>${rows}</tbody>
        </table>`;
}

function showScheduleForm(id = null) {
    const isEdit = !!id;
    API.get("/stations").then((stations) => {
        if (stations.length === 0) {
            toast("Add a station first", false);
            return;
        }

        let stationOpts = stations.map((s) => `<option value="${s._id}">${esc(s.name)}</option>`).join("");
        let dayOpts = DAYS.map((d, i) => `<option value="${i}">${d}</option>`).join("");

        let html = `<input type="hidden" id="f-schedule-id" value="${id || ""}">
            <div class="form-group">
                <label>Station</label>
                <select id="f-schedule-station">${stationOpts}</select>
            </div>
            <div class="form-group">
                <label>Day</label>
                <select id="f-schedule-day">${dayOpts}</select>
            </div>
            <div class="form-group" style="display:flex;gap:12px">
                <div style="flex:1"><label>Hour (0-23)</label>
                    <input id="f-schedule-hour" type="number" min="0" max="23" value="18" placeholder="18"></div>
                <div style="flex:1"><label>Minute (0-59)</label>
                    <input id="f-schedule-minute" type="number" min="0" max="59" value="0" placeholder="0"></div>
            </div>
            <div class="form-group">
                <label>Duration (minutes, max 360)</label>
                <input id="f-schedule-duration" type="number" min="1" max="360" value="120">
            </div>
            <div class="toggle-row">
                <label class="switch">
                    <input id="f-schedule-enabled" type="checkbox" checked>
                    <span class="slider"></span>
                </label>
                <label>Enabled</label>
            </div>
            <div class="form-actions">
                <button class="btn" onclick="closeModal()">Cancel</button>
                <button class="btn btn-primary" id="f-schedule-save">${isEdit ? "Update" : "Create"}</button>
            </div>`;

        openModal(isEdit ? "Edit Schedule" : "Add Schedule", html);

        if (isEdit) {
            API.get("/schedules").then((schedules) => {
                const s = schedules.find((x) => x._id === id);
                if (s) {
                    document.getElementById("f-schedule-station").value = s.station_id;
                    document.getElementById("f-schedule-day").value = s.day_of_week;
                    document.getElementById("f-schedule-hour").value = s.hour;
                    document.getElementById("f-schedule-minute").value = s.minute;
                    document.getElementById("f-schedule-duration").value = s.duration_minutes;
                    document.getElementById("f-schedule-enabled").checked = s.enabled;
                }
            });
        }

        document.getElementById("f-schedule-save").addEventListener("click", async () => {
            const body = {
                station_id: document.getElementById("f-schedule-station").value,
                day_of_week: parseInt(document.getElementById("f-schedule-day").value),
                hour: parseInt(document.getElementById("f-schedule-hour").value),
                minute: parseInt(document.getElementById("f-schedule-minute").value),
                duration_minutes: parseInt(document.getElementById("f-schedule-duration").value),
                enabled: document.getElementById("f-schedule-enabled").checked,
            };
            try {
                if (isEdit) {
                    await API.put(`/schedules/${id}`, body);
                } else {
                    await API.post("/schedules", body);
                }
                closeModal();
                toast(isEdit ? "Schedule updated" : "Schedule created");
                renderSchedules();
            } catch (e) {
                toast(e.detail || "Error saving schedule", false);
            }
        });
    });
}

async function deleteSchedule(id) {
    if (!confirm("Delete this schedule?")) return;
    try {
        await API.del(`/schedules/${id}`);
        toast("Schedule deleted");
        renderSchedules();
    } catch (e) {
        toast("Error deleting schedule", false);
    }
}

async function toggleSchedule(id) {
    try {
        const res = await API.post(`/schedules/${id}/toggle`);
        toast(res.enabled ? "Schedule enabled" : "Schedule disabled");
        renderSchedules();
    } catch (e) {
        toast("Error toggling schedule", false);
    }
}

// ==================== RECORDINGS ====================
let recordingsPage = 1;

async function renderRecordings() {
    const data = await API.get(`/recordings?page=${recordingsPage}&per_page=20`);
    const content = document.getElementById("content");

    if (data.recordings.length === 0) {
        content.innerHTML = `<h2>Recordings</h2><div class="empty-state"><p>No recordings yet</p></div>`;
        return;
    }

    function statusBadge(r) {
        if (r.status === "recording") return `<span class="badge badge-yellow">Recording</span>`;
        if (r.status === "failed") return `<span class="badge badge-red">Failed</span>`;
        return `<span class="badge badge-green">Done</span>`;
    }

    function tgBadge(r) {
        if (r.telegram_status === "sent") return `<span class="badge badge-green">Sent</span>`;
        if (r.telegram_status === "failed") return `<span class="badge badge-red">Failed</span>`;
        return `<span class="badge" style="background:rgba(139,148,158,0.15);color:#8b949e">–</span>`;
    }

    let rows = data.recordings.map((r) => `
        <tr>
            <td class="text-muted">${new Date(r.started_at).toLocaleString()}</td>
            <td>${esc(r.station_name || "—")}</td>
            <td>${formatDuration(r.duration_seconds)}</td>
            <td>${formatSize(r.size_bytes)}</td>
            <td>${statusBadge(r)}</td>
            <td>${tgBadge(r)}</td>
            <td class="actions-cell">
                ${r.status === "completed" ? `<a href="/api/recordings/${r._id}/download" class="btn btn-sm" download>Download</a>` : ""}
                ${r.status === "completed" ? `<button class="btn btn-sm" onclick="sendTelegram('${r._id}')">Send TG</button>` : ""}
            </td>
        </tr>
    `).join("");

    let pagHtml = "";
    if (data.total_pages > 1) {
        for (let i = 1; i <= data.total_pages; i++) {
            pagHtml += `<button class="btn btn-sm ${i === data.page ? 'btn-primary' : ''}" onclick="goPage(${i})">${i}</button>`;
        }
    }

    content.innerHTML = `
        <div class="toolbar">
            <h2>Recordings <span class="text-muted">(${data.total} total)</span></h2>
        </div>
        <table>
            <thead><tr><th>Date</th><th>Station</th><th>Duration</th><th>Size</th><th>Status</th><th>Telegram</th><th></th></tr></thead>
            <tbody>${rows}</tbody>
        </table>
        ${pagHtml ? `<div class="pagination">${pagHtml}</div>` : ""}`;
}

function goPage(p) {
    recordingsPage = p;
    renderRecordings();
}

async function sendTelegram(id) {
    try {
        await API.post(`/recordings/${id}/send-telegram`);
        toast("Sent to Telegram");
        renderRecordings();
    } catch (e) {
        toast("Error sending to Telegram", false);
    }
}

function esc(s) {
    if (!s) return "";
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
}

// ==================== INIT ====================
renderStations();

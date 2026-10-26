const ICONS = {
      shuffle: '<svg viewBox="0 0 24 24"><path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="M15 15l6 6"/><path d="M4 4l5 5"/></svg>',
      prev: '<svg viewBox="0 0 24 24"><polygon points="19 20 9 12 19 4 19 20"/><line x1="5" x2="5" y1="19" y2="5"/></svg>',
      next: '<svg viewBox="0 0 24 24"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" x2="19" y1="5" y2="19"/></svg>',
      play: '<svg viewBox="0 0 24 24"><polygon points="6 3 20 12 6 21 6 3" fill="currentColor" stroke="none"/></svg>',
      pause: '<svg viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" fill="currentColor" stroke="none"/><rect x="14" y="4" width="4" height="16" fill="currentColor" stroke="none"/></svg>',
      repeat: '<svg viewBox="0 0 24 24"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>',
      repeat1: '<svg viewBox="0 0 24 24"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/><path d="M11 10h1v4"/></svg>',
      vol: '<svg viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>',
      mute: '<svg viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="22" x2="16" y1="9" y2="15"/><line x1="16" x2="22" y1="9" y2="15"/></svg>',
      trash: '<svg viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
      edit: '<svg viewBox="0 0 24 24"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>',
      plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14"/><path d="M5 12h14"/></svg>',
      rename: '<svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>'
    };

    const DAYS = ["DUMINICĂ","LUNI","MARȚI","MIERCURI","JOI","VINERI","SÂMBĂTĂ"];
    const MONTHS = ["IAN","FEB","MAR","APR","MAI","IUN","IUL","AUG","SEP","OCT","NOV","DEC"];
    const EXT = /\.(mp3|wav|m4a|aac|ogg|oga|flac|opus|webm|mp4|aiff|aif)$/i;
    const KEY = "militar-player-settings";
    const LIB = "__library__";
    const $ = id => document.getElementById(id);
    const audio = $("audio");
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

    let tracks = [];
    let playlists = [];
    let currentPl = LIB;
    let currentId = null;
    let settings = loadSettings();
    let urls = new Map();
    let seeking = false;
    let loadedId = null;
    let audioCtx = null, analyser = null, sourceNode = null, freq = null;
    let importing = false;
    let modalMode = null;
    let modalTrackId = null;

    $("shuffle").innerHTML = ICONS.shuffle;
    $("prev").innerHTML = ICONS.prev;
    $("next").innerHTML = ICONS.next;
    $("play").innerHTML = ICONS.play;
    $("repeat").innerHTML = ICONS.repeat;
    $("mute").innerHTML = ICONS.vol;
    $("plNew").innerHTML = ICONS.plus;
    $("plRename").innerHTML = ICONS.rename;
    $("plDelete").innerHTML = ICONS.trash;

    const bars = $("bars");
    for (let i = 0; i < 24; i++) bars.appendChild(document.createElement("i"));
    $("dir").setAttribute("webkitdirectory", "");
    $("dir").setAttribute("directory", "");

    function loadSettings() {
      try {
        const p = JSON.parse(localStorage.getItem(KEY) || "null") || {};
        return {
          volume: clamp(p.volume ?? 0.9),
          muted: !!p.muted,
          shuffle: !!p.shuffle,
          repeat: ["off","all","one"].includes(p.repeat) ? p.repeat : "off",
          lastId: p.lastId || null,
          lastTime: p.lastTime || 0,
          currentPl: p.currentPl || LIB
        };
      } catch {
        return { volume: .9, muted: false, shuffle: false, repeat: "off", lastId: null, lastTime: 0, currentPl: LIB };
      }
    }
    function saveSettings(p) {
      settings = { ...settings, ...p };
      localStorage.setItem(KEY, JSON.stringify(settings));
    }
    function clamp(n) { return Math.min(1, Math.max(0, Number(n) || 0)); }
    function fmt(s) {
      if (!Number.isFinite(s) || s < 0) return "0:00";
      s = Math.floor(s);
      const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
      return h ? h + ":" + String(m).padStart(2, "0") + ":" + String(sec).padStart(2, "0") : m + ":" + String(sec).padStart(2, "0");
    }
    function parseName(name) {
      const base = name.replace(/\.[^.]+$/, "").replace(/_+/g, " ").trim();
      const parts = base.split(/\s[-–—]\s/);
      if (parts.length >= 2) return { artist: parts[0].trim(), title: parts.slice(1).join(" - ").trim() };
      return { artist: "Bibliotecă locală", title: base || name };
    }
    function isAudio(f) { return (f.type && f.type.startsWith("audio/")) || EXT.test(f.name); }
    function uid() { return crypto.randomUUID(); }

    function openDb() {
      return new Promise((res, rej) => {
        const r = indexedDB.open("militar-player", 2);
        r.onupgradeneeded = e => {
          const db = r.result;
          if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta", { keyPath: "id" });
          if (!db.objectStoreNames.contains("blobs")) db.createObjectStore("blobs", { keyPath: "id" });
          if (!db.objectStoreNames.contains("playlists")) db.createObjectStore("playlists", { keyPath: "id" });
        };
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
    }
    function done(tx) {
      return new Promise((res, rej) => {
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
        tx.onabort = () => rej(tx.error);
      });
    }

    async function listTracks() {
      const db = await openDb();
      const tx = db.transaction("meta", "readonly");
      const req = tx.objectStore("meta").getAll();
      const rows = await new Promise((res, rej) => { req.onsuccess = () => res(req.result || []); req.onerror = () => rej(req.error); });
      await done(tx); db.close();
      return rows.sort((a, b) => a.addedAt - b.addedAt);
    }
    async function listPlaylists() {
      const db = await openDb();
      const tx = db.transaction("playlists", "readonly");
      const req = tx.objectStore("playlists").getAll();
      const rows = await new Promise((res, rej) => { req.onsuccess = () => res(req.result || []); req.onerror = () => rej(req.error); });
      await done(tx); db.close();
      return rows.sort((a, b) => a.createdAt - b.createdAt);
    }
    async function getBlob(id) {
      const db = await openDb();
      const tx = db.transaction("blobs", "readonly");
      const req = tx.objectStore("blobs").get(id);
      const row = await new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
      await done(tx); db.close();
      return row?.blob || null;
    }
    async function putFiles(files, onProgress) {
      const existing = await listTracks();
      const known = new Set(existing.map(t => t.fileName + "::" + t.size));
      const fresh = [];
      for (const f of files) {
        if (!isAudio(f)) continue;
        const k = f.name + "::" + f.size;
        if (known.has(k)) continue;
        known.add(k);
        fresh.push(f);
      }
      const skipped = [...files].filter(isAudio).length - fresh.length;
      if (!fresh.length) return { added: 0, skipped };
      const db = await openDb();
      const BATCH = 8;
      let added = 0;
      for (let i = 0; i < fresh.length; i += BATCH) {
        const batch = fresh.slice(i, i + BATCH);
        const tx = db.transaction(["meta", "blobs"], "readwrite");
        const now = Date.now();
        batch.forEach((file, j) => {
          const id = uid();
          const n = parseName(file.name);
          tx.objectStore("meta").put({
            id, title: n.title, artist: n.artist, fileName: file.name,
            mime: file.type || "audio/*", size: file.size, addedAt: now + i + j, duration: 0
          });
          tx.objectStore("blobs").put({ id, blob: file });
        });
        await done(tx);
        added += batch.length;
        if (onProgress) onProgress(added, fresh.length);
        await new Promise(r => setTimeout(r, 0));
      }
      db.close();
      return { added, skipped: Math.max(0, skipped) };
    }
    async function removeId(id) {
      const db = await openDb();
      const tx = db.transaction(["meta", "blobs", "playlists"], "readwrite");
      tx.objectStore("meta").delete(id);
      tx.objectStore("blobs").delete(id);
      const allPl = await new Promise((res, rej) => {
        const r = tx.objectStore("playlists").getAll();
        r.onsuccess = () => res(r.result || []);
        r.onerror = () => rej(r.error);
      });
      allPl.forEach(pl => {
        if (pl.trackIds.includes(id)) {
          pl.trackIds = pl.trackIds.filter(x => x !== id);
          tx.objectStore("playlists").put(pl);
        }
      });
      await done(tx); db.close();
    }
    async function updateTrackMeta(id, title, artist) {
      const db = await openDb();
      const tx = db.transaction("meta", "readwrite");
      const store = tx.objectStore("meta");
      const cur = await new Promise((res, rej) => {
        const r = store.get(id);
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      if (cur) {
        cur.title = title;
        cur.artist = artist;
        store.put(cur);
      }
      await done(tx); db.close();
    }
    async function saveDuration(id, duration) {
      if (!(duration > 0)) return;
      const db = await openDb();
      const tx = db.transaction("meta", "readwrite");
      const store = tx.objectStore("meta");
      const cur = await new Promise((res, rej) => {
        const r = store.get(id);
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      if (cur) store.put({ ...cur, duration });
      await done(tx); db.close();
    }
    async function clearAll() {
      const db = await openDb();
      const tx = db.transaction(["meta", "blobs", "playlists"], "readwrite");
      tx.objectStore("meta").clear();
      tx.objectStore("blobs").clear();
      tx.objectStore("playlists").clear();
      await done(tx); db.close();
    }
    async function savePlaylist(pl) {
      const db = await openDb();
      const tx = db.transaction("playlists", "readwrite");
      tx.objectStore("playlists").put(pl);
      await done(tx); db.close();
    }
    async function deletePlaylist(id) {
      const db = await openDb();
      const tx = db.transaction("playlists", "readwrite");
      tx.objectStore("playlists").delete(id);
      await done(tx); db.close();
    }

    function note(text, err) {
      const el = $("note");
      el.textContent = text || "";
      el.className = "note" + (err ? " err" : "");
      if (text && !importing) setTimeout(() => { if (el.textContent === text) el.textContent = ""; }, 4500);
    }
    function getVisibleTracks() {
      if (currentPl === LIB) return tracks;
      const pl = playlists.find(p => p.id === currentPl);
      if (!pl) return tracks;
      const map = new Map(tracks.map(t => [t.id, t]));
      return pl.trackIds.map(id => map.get(id)).filter(Boolean);
    }
    function paintProgress() {
      const cur = tracks.find(t => t.id === currentId);
      const d = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : (cur?.duration || 0);
      const t = audio.currentTime || 0;
      $("cur").textContent = fmt(t);
      $("dur").textContent = fmt(d);
      $("fill").style.width = (d ? Math.min(100, t / d * 100) : 0) + "%";
      $("seek").setAttribute("aria-valuemax", String(Math.round(d) || 0));
      $("seek").setAttribute("aria-valuenow", String(Math.round(t)));
    }
    function paintTransport() {
      $("play").innerHTML = audio.paused ? ICONS.play : ICONS.pause;
      $("play").setAttribute("aria-label", audio.paused ? "Redare" : "Pauză");
      paintProgress();
    }
    function fillPlSelect() {
      const sel = $("plSelect");
      const prev = currentPl;
      sel.innerHTML = "";
      const optLib = document.createElement("option");
      optLib.value = LIB;
      optLib.textContent = "Toate piesele (" + tracks.length + ")";
      sel.appendChild(optLib);
      playlists.forEach(pl => {
        const o = document.createElement("option");
        o.value = pl.id;
        o.textContent = pl.name + " (" + pl.trackIds.length + ")";
        sel.appendChild(o);
      });
      if ([...sel.options].some(o => o.value === prev)) sel.value = prev;
      else { sel.value = LIB; currentPl = LIB; }
      $("plRename").disabled = currentPl === LIB;
      $("plDelete").disabled = currentPl === LIB;
    }
    function render() {
      const visible = getVisibleTracks();
      const q = $("q").value.trim().toLowerCase();
      const filtered = visible.filter(t => !q || (t.title + " " + t.artist + " " + t.fileName).toLowerCase().includes(q));
      $("count").textContent = visible.length === 1 ? "1 piesă" : visible.length + " piese";
      $("clear").disabled = !tracks.length;
      fillPlSelect();
      const cur = tracks.find(t => t.id === currentId);
      $("title").textContent = cur ? cur.title : "Niciun fișier selectat";
      $("artist").textContent = cur ? cur.artist : "Importă muzică pentru a începe";
      $("shuffle").classList.toggle("on", settings.shuffle);
      $("repeat").classList.toggle("on", settings.repeat !== "off");
      $("repeat").innerHTML = settings.repeat === "one" ? ICONS.repeat1 : ICONS.repeat;
      $("repeat").setAttribute("aria-label", settings.repeat === "one" ? "Repetă piesa" : settings.repeat === "all" ? "Repetă lista" : "Fără repetare");
      $("play").innerHTML = audio.paused ? ICONS.play : ICONS.pause;
      $("play").setAttribute("aria-label", audio.paused ? "Redare" : "Pauză");
      $("play").disabled = !tracks.length;
      $("prev").disabled = !tracks.length;
      $("next").disabled = !tracks.length;
      $("shuffle").disabled = !tracks.length;
      paintProgress();
      $("volume").value = settings.muted ? 0 : settings.volume;
      $("mute").innerHTML = settings.muted || settings.volume === 0 ? ICONS.mute : ICONS.vol;
      const list = $("list");
      list.innerHTML = "";
      if (!filtered.length) {
        const li = document.createElement("li");
        li.className = "empty";
        if (tracks.length && currentPl !== LIB && !visible.length) {
          li.innerHTML = "<strong>Playlist-ul este gol.</strong>Selectează «Toate piesele» și adaugă piese din meniul piesei.";
        } else if (tracks.length) {
          li.innerHTML = "<strong>Nicio piesă nu corespunde căutării.</strong>";
        } else {
          li.innerHTML = "<strong>Biblioteca este goală.</strong>Trage fișierele aici sau folosește Importă.<div><button class='cta' id='emptyImport' type='button'>Alege fișiere audio</button></div>";
        }
        list.appendChild(li);
        li.querySelector("#emptyImport")?.addEventListener("click", () => $("file").click());
        return;
      }
      filtered.forEach((track, index) => {
        const li = document.createElement("li");
        if (track.id === currentId) li.className = "active";
        const inPl = currentPl !== LIB;
        li.innerHTML = `
          <button class="row" type="button">
            <span class="idx">${index + 1}</span>
            <span style="min-width:0"><span class="ttl"></span><span class="art"></span></span>
          </button>
          <span class="dur">${track.duration > 0 ? fmt(track.duration) : "—"}</span>
          <div class="row-actions">
            <button type="button" aria-label="Editează" class="icon sm" data-act="edit">${ICONS.edit}</button>
            ${inPl ? "" : `<button type="button" aria-label="Adaugă la playlist" class="icon sm" data-act="addpl">${ICONS.plus}</button>`}
            <button type="button" aria-label="${inPl ? "Scoate din playlist" : "Șterge"}" class="icon sm" data-act="del">${ICONS.trash}</button>
          </div>`;
        li.querySelector(".ttl").textContent = track.title;
        li.querySelector(".art").textContent = track.artist;
        li.querySelector(".row").onclick = () => playId(track.id, 0);
        li.querySelector('[data-act="edit"]').onclick = e => { e.stopPropagation(); openEditTrack(track); };
        const addBtn = li.querySelector('[data-act="addpl"]');
        if (addBtn) addBtn.onclick = e => { e.stopPropagation(); addToPlaylistMenu(track.id); };
        li.querySelector('[data-act="del"]').onclick = e => {
          e.stopPropagation();
          if (inPl) removeFromPlaylist(track.id);
          else del(track.id);
        };
        list.appendChild(li);
      });
    }

    async function ensureAudioCtx() {
      if (audioCtx) return;
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      freq = new Uint8Array(analyser.frequencyBinCount);
      sourceNode = audioCtx.createMediaElementSource(audio);
      sourceNode.connect(analyser);
      analyser.connect(audioCtx.destination);
    }
    async function playId(id, startAt) {
      const track = tracks.find(t => t.id === id);
      if (!track) return;
      currentId = id;
      saveSettings({ lastId: id });
      render();
      try {
        await ensureAudioCtx();
        if (audioCtx.state === "suspended") await audioCtx.resume();
        if (loadedId !== id) {
          const blob = await getBlob(id);
          if (!blob) { note("Fișierul nu a putut fi citit.", true); return; }
          const old = urls.get(id);
          if (old) URL.revokeObjectURL(old);
          const url = URL.createObjectURL(blob);
          urls.set(id, url);
          audio.src = url;
          loadedId = id;
        }
        if (startAt > 0) audio.currentTime = startAt;
        await audio.play();
      } catch (e) {
        note("Redarea a eșuat.", true);
      }
      render();
    }
    function go(dir, fromEnd) {
      const list = getVisibleTracks();
      if (!list.length) return;
      let idx = list.findIndex(t => t.id === currentId);
      if (idx < 0) idx = 0;
      if (settings.repeat === "one" && fromEnd) { playId(currentId, 0); return; }
      if (settings.shuffle) {
        let next = Math.floor(Math.random() * list.length);
        if (list.length > 1 && next === idx) next = (next + 1) % list.length;
        playId(list[next].id, 0);
        return;
      }
      let next = idx + dir;
      if (next < 0) next = settings.repeat === "all" ? list.length - 1 : 0;
      if (next >= list.length) {
        if (settings.repeat === "all") next = 0;
        else { audio.pause(); return; }
      }
      playId(list[next].id, 0);
    }

    async function importFiles(fileList) {
      if (importing) { note("Import deja în curs…"); return; }
      const files = [...fileList];
      if (!files.length) return;
      importing = true;
      $("importBtn").disabled = true;
      $("dirBtn").disabled = true;
      note("Se importă… 0/" + files.length);
      try {
        const result = await putFiles(files, (done, total) => {
          note("Se importă… " + done + "/" + total);
        });
        tracks = await listTracks();
        if (!currentId && tracks[0]) currentId = tracks[0].id;
        if (result.added === 0 && result.skipped > 0) note("Piesele există deja în bibliotecă.");
        else if (result.added === 0) note("Niciun fișier audio recunoscut.");
        else note(result.added === 1 ? "O piesă a fost adăugată." : result.added + " piese au fost adăugate.");
        scanDurations();
      } catch (e) {
        console.error(e);
        note("Importul a eșuat. Încearcă din nou sau folosește «Importă» pe fișiere individuale.", true);
      }
      importing = false;
      $("importBtn").disabled = false;
      $("dirBtn").disabled = false;
      render();
    }

    async function del(id) {
      await removeId(id);
      const url = urls.get(id);
      if (url) { URL.revokeObjectURL(url); urls.delete(id); }
      tracks = tracks.filter(t => t.id !== id);
      playlists = await listPlaylists();
      if (currentId === id) {
        audio.pause();
        audio.removeAttribute("src");
        loadedId = null;
        currentId = tracks[0]?.id || null;
        saveSettings({ lastId: currentId, lastTime: 0 });
      }
      render();
    }
    async function wipe() {
      await clearAll();
      urls.forEach(u => URL.revokeObjectURL(u));
      urls.clear();
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      tracks = [];
      playlists = [];
      currentId = null;
      loadedId = null;
      currentPl = LIB;
      saveSettings({ lastId: null, lastTime: 0, currentPl: LIB });
      $("clearBox").innerHTML = '<button class="linkish" id="clear" type="button" disabled>Golește</button>';
      bindClear();
      render();
    }
    function bindClear() {
      $("clear").onclick = () => {
        $("clearBox").innerHTML = '<button class="linkish" id="cancelClear" type="button">Anulează</button><button class="danger" id="doClear" type="button">Golește tot</button>';
        $("cancelClear").onclick = () => {
          $("clearBox").innerHTML = '<button class="linkish" id="clear" type="button">Golește</button>';
          bindClear();
        };
        $("doClear").onclick = () => wipe();
      };
    }

    function openModal(mode, title, label1, val1, label2, val2) {
      modalMode = mode;
      $("modalTitle").textContent = title;
      $("label1").firstChild.textContent = label1;
      $("modalInput1").value = val1 || "";
      if (label2) {
        $("label2").classList.remove("hidden");
        $("label2").firstChild.textContent = label2;
        $("modalInput2").value = val2 || "";
      } else {
        $("label2").classList.add("hidden");
      }
      $("modalBg").classList.remove("hidden");
      setTimeout(() => $("modalInput1").focus(), 50);
    }
    function closeModal() {
      $("modalBg").classList.add("hidden");
      modalMode = null;
      modalTrackId = null;
    }
    function openEditTrack(track) {
      modalTrackId = track.id;
      openModal("edit-track", "Editează piesa", "Titlu", track.title, "Artist", track.artist);
    }
    function openNewPlaylist() {
      openModal("new-pl", "Playlist nou", "Nume playlist", "", null, null);
    }
    function openRenamePlaylist() {
      if (currentPl === LIB) return;
      const pl = playlists.find(p => p.id === currentPl);
      if (!pl) return;
      openModal("rename-pl", "Redenumește playlist", "Nume", pl.name, null, null);
    }
    async function onModalSave() {
      const v1 = $("modalInput1").value.trim();
      const v2 = $("modalInput2").value.trim();
      if (modalMode === "edit-track" && modalTrackId) {
        if (!v1) { note("Titlul nu poate fi gol.", true); return; }
        await updateTrackMeta(modalTrackId, v1, v2 || "Bibliotecă locală");
        const t = tracks.find(x => x.id === modalTrackId);
        if (t) { t.title = v1; t.artist = v2 || "Bibliotecă locală"; }
        closeModal();
        render();
        note("Piesa a fost actualizată.");
      } else if (modalMode === "new-pl") {
        if (!v1) { note("Introdu un nume.", true); return; }
        const pl = { id: uid(), name: v1, trackIds: [], createdAt: Date.now() };
        await savePlaylist(pl);
        playlists = await listPlaylists();
        currentPl = pl.id;
        saveSettings({ currentPl });
        closeModal();
        render();
        note("Playlist creat: " + v1);
      } else if (modalMode === "rename-pl") {
        if (!v1) { note("Introdu un nume.", true); return; }
        const pl = playlists.find(p => p.id === currentPl);
        if (pl) {
          pl.name = v1;
          await savePlaylist(pl);
          playlists = await listPlaylists();
        }
        closeModal();
        render();
      }
    }
    async function deleteCurrentPlaylist() {
      if (currentPl === LIB) return;
      const pl = playlists.find(p => p.id === currentPl);
      if (!pl) return;
      if (!confirm("Ștergi playlist-ul «" + pl.name + "»? Piesele rămân în bibliotecă.")) return;
      await deletePlaylist(currentPl);
      playlists = await listPlaylists();
      currentPl = LIB;
      saveSettings({ currentPl: LIB });
      render();
      note("Playlist șters.");
    }
    async function removeFromPlaylist(trackId) {
      const pl = playlists.find(p => p.id === currentPl);
      if (!pl) return;
      pl.trackIds = pl.trackIds.filter(id => id !== trackId);
      await savePlaylist(pl);
      playlists = await listPlaylists();
      render();
    }
    async function addToPlaylistMenu(trackId) {
      if (!playlists.length) {
        openNewPlaylist();
        note("Creează mai întâi un playlist, apoi adaugă piesa.");
        return;
      }
      const names = playlists.map((p, i) => (i + 1) + ". " + p.name).join("\n");
      const choice = prompt("Adaugă la playlist (scrie numărul):\n" + names);
      if (choice == null) return;
      const idx = parseInt(choice, 10) - 1;
      if (idx < 0 || idx >= playlists.length) { note("Număr invalid.", true); return; }
      const pl = playlists[idx];
      if (pl.trackIds.includes(trackId)) { note("Piesa este deja în playlist."); return; }
      pl.trackIds.push(trackId);
      await savePlaylist(pl);
      playlists = await listPlaylists();
      render();
      note("Adăugat în «" + pl.name + "».");
    }

    function tickClock() {
      const now = new Date();
      $("clock").textContent = String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0") + ":" + String(now.getSeconds()).padStart(2, "0");
      $("date").textContent = now.getDate() + " " + MONTHS[now.getMonth()] + " " + now.getFullYear();
      $("day").textContent = DAYS[now.getDay()];
    }
    function draw() {
      requestAnimationFrame(draw);
      const nodes = bars.children;
      const live = !audio.paused && analyser;
      if (live) analyser.getByteFrequencyData(freq);
      for (let i = 0; i < nodes.length; i++) {
        const sample = live ? freq[i] / 255 : .16;
        nodes[i].style.transform = "scaleY(" + Math.max(.12, sample) + ")";
        nodes[i].style.opacity = live ? "1" : ".45";
      }
    }
    async function scanDurations() {
      for (const track of tracks) {
        if (track.duration > 0) continue;
        const blob = await getBlob(track.id);
        if (!blob) continue;
        const len = await new Promise(res => {
          const u = URL.createObjectURL(blob);
          const a = new Audio();
          const fin = n => { URL.revokeObjectURL(u); res(n); };
          a.preload = "metadata";
          a.onloadedmetadata = () => fin(Number.isFinite(a.duration) ? a.duration : 0);
          a.onerror = () => fin(0);
          a.src = u;
        });
        if (len > 0) {
          track.duration = len;
          await saveDuration(track.id, len);
          render();
        }
      }
    }
    function seekAt(clientX, rect) {
      if (!(audio.duration > 0)) return;
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      audio.currentTime = ratio * audio.duration;
      paintProgress();
    }

    $("importBtn").onclick = () => $("file").click();
    $("dirBtn").onclick = () => {
      if (isIOS) {
        note("Pe iPhone/iPad selectarea de dosar din iCloud poate bloca aplicația. Folosește «Importă» și alege fișierele audio (poți selecta mai multe).", true);
      }
      $("dir").click();
    };
    $("file").onchange = e => { importFiles(e.target.files); e.target.value = ""; };
    $("dir").onchange = e => {
      const files = e.target.files;
      if (!files || !files.length) {
        note("Nu s-au putut citi fișierele din dosar. Pe iCloud încearcă «Importă» pe fișiere individuale.", true);
      } else {
        importFiles(files);
      }
      e.target.value = "";
    };
    $("play").onclick = () => {
      if (!tracks.length) return;
      if (!currentId) playId(tracks[0].id, 0);
      else if (audio.paused) audio.play().catch(() => note("Redarea a eșuat.", true));
      else audio.pause();
    };
    $("prev").onclick = () => go(-1, false);
    $("next").onclick = () => go(1, false);
    $("shuffle").onclick = () => { saveSettings({ shuffle: !settings.shuffle }); render(); };
    $("repeat").onclick = () => {
      const order = ["off", "all", "one"];
      const next = order[(order.indexOf(settings.repeat) + 1) % 3];
      saveSettings({ repeat: next });
      render();
    };
    $("volume").oninput = e => {
      const v = clamp(e.target.value);
      saveSettings({ volume: v, muted: false });
      audio.volume = v;
      render();
    };
    $("mute").onclick = () => {
      const muted = !settings.muted;
      saveSettings({ muted });
      audio.volume = muted ? 0 : (settings.volume || .9);
      render();
    };
    $("q").oninput = render;
    $("plSelect").onchange = () => {
      currentPl = $("plSelect").value;
      saveSettings({ currentPl });
      render();
    };
    $("plNew").onclick = openNewPlaylist;
    $("plRename").onclick = openRenamePlaylist;
    $("plDelete").onclick = deleteCurrentPlaylist;
    $("modalCancel").onclick = closeModal;
    $("modalSave").onclick = onModalSave;
    $("modalBg").onclick = e => { if (e.target === $("modalBg")) closeModal(); };
    $("modalInput1").onkeydown = e => { if (e.key === "Enter") onModalSave(); };
    $("modalInput2").onkeydown = e => { if (e.key === "Enter") onModalSave(); };

    audio.ontimeupdate = () => { if (!seeking) paintProgress(); };
    audio.onplay = paintTransport;
    audio.onpause = paintTransport;
    audio.onloadedmetadata = () => {
      const cur = tracks.find(t => t.id === currentId);
      if (cur && audio.duration > 0) {
        cur.duration = audio.duration;
        saveDuration(cur.id, audio.duration);
      }
      render();
    };
    audio.onended = () => go(1, true);

    const seek = $("seek");
    seek.onpointerdown = e => {
      seeking = true;
      seek.setPointerCapture(e.pointerId);
      seekAt(e.clientX, seek.getBoundingClientRect());
    };
    seek.onpointermove = e => { if (seeking) seekAt(e.clientX, seek.getBoundingClientRect()); };
    seek.onpointerup = () => { seeking = false; };

    const drop = $("drop");
    drop.ondragover = e => e.preventDefault();
    drop.ondrop = e => { e.preventDefault(); importFiles(e.dataTransfer.files); };

    addEventListener("keydown", e => {
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.code === "Space") { e.preventDefault(); $("play").click(); }
      else if (e.code === "ArrowRight") audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 5);
      else if (e.code === "ArrowLeft") audio.currentTime = Math.max(0, audio.currentTime - 5);
    });

    setInterval(() => {
      if (!audio.paused && currentId) saveSettings({ lastId: currentId, lastTime: audio.currentTime || 0 });
    }, 2000);
    setInterval(tickClock, 1000);
    tickClock();
    bindClear();
    audio.volume = settings.muted ? 0 : settings.volume;
    currentPl = settings.currentPl || LIB;

    Promise.all([listTracks(), listPlaylists()]).then(([rows, pls]) => {
      tracks = rows;
      playlists = pls;
      if (settings.lastId && rows.some(t => t.id === settings.lastId)) currentId = settings.lastId;
      else if (rows[0]) currentId = rows[0].id;
      render();
      scanDurations();
    }).catch(() => {
      note("Biblioteca locală nu a putut fi deschisă.", true);
      render();
    });

    requestAnimationFrame(draw);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    if ("mediaSession" in navigator) {
      const bind = (a, fn) => { try { navigator.mediaSession.setActionHandler(a, fn); } catch {} };
      setInterval(() => {
        const cur = tracks.find(t => t.id === currentId);
        if (!cur) return;
        navigator.mediaSession.metadata = new MediaMetadata({ title: cur.title, artist: cur.artist, album: "MILITAR Player" });
        document.title = audio.paused ? "MILITAR Player" : cur.title + " — MILITAR";
      }, 1000);
      bind("play", () => $("play").click());
      bind("pause", () => audio.pause());
      bind("nexttrack", () => go(1, false));
      bind("previoustrack", () => go(-1, false));
    }

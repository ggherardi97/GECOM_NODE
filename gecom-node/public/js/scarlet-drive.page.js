(function () {
  const boot = window.SCARLET_DRIVE_BOOT || {};
  const hosts = Array.isArray(boot.hosts) ? boot.hosts : [];
  const limits = {
    maxGuests: Number(boot.maxGuests) || 120,
    maxPerHost: Number(boot.maxPerHost) || 24,
    maxPositiveVotesPerVoter: Number(boot.maxPositiveVotesPerVoter) || 5,
  };
  const ANSWER_MODE_YES_NO = "yes_no";
  const ANSWER_MODE_RATING = "rating_1_5";
  const RATING_LABELS = {
    5: "muito boa para repertorio",
    4: "boa, mas tem melhores",
    3: "musica ok, tanto faz",
    2: "ruim, mas tem piores",
    1: "pior tipo de musica pra se tocar",
  };

  const state = {
    data: {
      guests: [],
      counters: { total: 0, byHost: {}, paid: { yes: 0, no: 0 }, confirmed: { yes: 0, no: 0 } },
      songs: [],
      voteSessions: [],
    },
    activeView: "lista",
    currentVoter: "",
    currentVoteSessionId: null,
    isVoteBuilderOpen: false,
    voteDraftSongs: [],
    draggedSongId: null,
    charts: { confirmed: null, paid: null },
  };

  const els = {};

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    bindElements();
    bindEvents();
    applyView();
    await refreshState();
  }

  function bindElements() {
    [
      "heroActions", "hostChips", "heroMusicBadge", "totalCounter",
      "addForm", "guestName", "guestHost", "guestPaid", "guestConfirmed", "feedback", "exportBtn",
      "filterName", "filterHost", "filterPaid", "filterConfirmed", "filterSummary", "guestsTableBody",
      "songForm", "songName", "songSuggestedBy", "songFeedback", "repertoireList", "repertoireRanking", "printRepertoireBtn",
      "voterGate", "voteSessionHub", "voteWorkspace", "voterSelect", "continueVotingBtn", "voterFeedback",
      "forceVoterAccessBtn",
      "currentVoterBadge", "changeVoterBtn", "openVoteBuilderBtn", "voteBuilder", "closeVoteBuilderBtn",
      "voteSessionName", "voteSessionAnswerMode", "voteSessionMaxVotes", "voteSessionMaxVotesLabel", "voteSessionIsSecret", "voteDraftSongName", "addDraftVoteSongBtn", "voteBuilderFeedback", "voteDraftSongs", "saveVoteSessionBtn",
      "voteSessionsList", "voteSessionsPreview", "convertVoteSessionModeBtn", "backToVoteSessionsBtn", "activeVoteSessionTitle", "activeVoteSessionSubtitle", "ratingLegend",
      "voteSongForm", "voteSongName", "voteFeedback", "voteProgressLabel", "positiveVoteCount", "positiveVoteLimit", "voteSongList", "voteRanking",
      "confirmedChart", "paidChart"
    ].forEach((id) => { els[id] = document.getElementById(id); });

    els.navTabs = Array.from(document.querySelectorAll("[data-view-target]"));
    els.views = Array.from(document.querySelectorAll("[data-view]"));
  }

  function bindEvents() {
    els.navTabs.forEach((button) => {
      button.addEventListener("click", () => {
        state.activeView = button.dataset.viewTarget || "lista";
        applyView();
      });
    });

    els.addForm.addEventListener("submit", onGuestCreate);
    els.songForm.addEventListener("submit", onSongCreate);
    els.voteSongForm.addEventListener("submit", onVoteSongCreate);
    els.exportBtn.addEventListener("click", exportGuests);
    els.printRepertoireBtn.addEventListener("click", printRepertoire);
    els.continueVotingBtn.addEventListener("click", continueVoting);
    els.forceVoterAccessBtn.addEventListener("click", forceContinueVoting);
    els.changeVoterBtn.addEventListener("click", resetVoter);
    els.openVoteBuilderBtn.addEventListener("click", openVoteBuilder);
    els.closeVoteBuilderBtn.addEventListener("click", closeVoteBuilder);
    els.addDraftVoteSongBtn.addEventListener("click", addDraftVoteSong);
    els.saveVoteSessionBtn.addEventListener("click", saveVoteSession);
    els.voteSessionAnswerMode.addEventListener("change", syncVoteBuilderMode);
    els.convertVoteSessionModeBtn.addEventListener("click", convertCurrentVoteSessionToRating);
    els.backToVoteSessionsBtn.addEventListener("click", backToVoteSessions);

    [els.filterName, els.filterHost, els.filterPaid, els.filterConfirmed].forEach((input) => {
      input.addEventListener(input.tagName === "SELECT" ? "change" : "input", renderGuests);
    });

    els.guestsTableBody.addEventListener("change", onGuestTableChange);
    els.guestsTableBody.addEventListener("click", onGuestTableClick);

    els.repertoireList.addEventListener("change", onSongListChange);
    els.repertoireList.addEventListener("click", onSongListClick);
    els.repertoireList.addEventListener("dragstart", onSongDragStart);
    els.repertoireList.addEventListener("dragover", onSongDragOver);
    els.repertoireList.addEventListener("dragleave", onSongDragLeave);
    els.repertoireList.addEventListener("drop", onSongDrop);
    els.repertoireList.addEventListener("dragend", clearDragState);

    els.voteSessionsList.addEventListener("click", onVoteSessionsListClick);
    els.voteDraftSongs.addEventListener("click", onVoteDraftSongsClick);
    els.voteSongList.addEventListener("click", onVoteListClick);
  }

  async function refreshState() {
    try {
      state.data = await api("/api/scarlet-drive/state");
      if (!state.currentVoter && state.data.currentIpVoter) {
        state.currentVoter = state.data.currentIpVoter;
      }
      ensureVoteSelectionStillExists();
      renderAll();
    } catch (error) {
      setMessage(els.feedback, error.message || "Nao foi possivel carregar os dados.", "error");
    }
  }

  function ensureVoteSelectionStillExists() {
    if (!state.currentVoteSessionId) return;
    const exists = getVoteSessions().some((session) => String(session.id) === String(state.currentVoteSessionId));
    if (!exists) state.currentVoteSessionId = null;
  }

  function renderAll() {
    renderSummary();
    renderGuests();
    renderCharts();
    renderRepertoire();
    renderVoting();
  }

  function applyView() {
    els.navTabs.forEach((button) => button.classList.toggle("is-active", button.dataset.viewTarget === state.activeView));
    els.views.forEach((view) => view.classList.toggle("is-active", view.dataset.view === state.activeView));
    const showListHeader = state.activeView === "lista";
    if (els.heroActions) els.heroActions.hidden = !showListHeader;
    if (els.hostChips) els.hostChips.hidden = !showListHeader;
  }

  function renderSummary() {
    const counters = state.data.counters || { total: 0, byHost: {} };
    const totalSongs = Array.isArray(state.data.songs) ? state.data.songs.length : 0;
    els.totalCounter.innerHTML = `Total: <strong>${counters.total || 0}</strong> / ${limits.maxGuests}`;
    els.heroMusicBadge.innerHTML = `Repertorio: <strong>${totalSongs}</strong> musicas`;
    els.hostChips.innerHTML = hosts.map((host) => {
      const total = Number(counters.byHost && counters.byHost[host]) || 0;
      const isLimit = total >= limits.maxPerHost ? " is-limit" : "";
      return `<div class="chip${isLimit}"><span>${escapeHtml(host)}</span><span class="chip-value">${total} / ${limits.maxPerHost}</span></div>`;
    }).join("");
  }

  function getFilteredGuests() {
    const name = normalize(els.filterName.value);
    const host = els.filterHost.value;
    const paid = els.filterPaid.value;
    const confirmed = els.filterConfirmed.value;
    return (state.data.guests || []).filter((guest) => {
      if (name && !normalize(guest.name).includes(name)) return false;
      if (host && guest.invitedBy !== host) return false;
      if (paid && String(Boolean(guest.isPaid)) !== paid) return false;
      if (confirmed && String(Boolean(guest.isConfirmed)) !== confirmed) return false;
      return true;
    });
  }

  function renderGuests() {
    const guests = getFilteredGuests();
    const total = (state.data.guests || []).length;
    els.filterSummary.textContent = guests.length === total
      ? `Mostrando todos os convidados (${total}).`
      : `Mostrando ${guests.length} de ${total} convidados.`;

    if (!guests.length) {
      els.guestsTableBody.innerHTML = `<tr><td colspan="5">Nenhum convidado encontrado.</td></tr>`;
      return;
    }

    els.guestsTableBody.innerHTML = guests.map((guest) => `
      <tr data-guest-id="${guest.id}">
        <td><input class="filter-control name-input" data-field="name" type="text" value="${escapeAttr(guest.name)}" /></td>
        <td>${hostSelect("invitedBy", guest.invitedBy, "small-select")}</td>
        <td>${booleanSelect("isPaid", guest.isPaid)}</td>
        <td>${booleanSelect("isConfirmed", guest.isConfirmed)}</td>
        <td><button type="button" class="btn btn-danger" data-action="delete-guest">Excluir</button></td>
      </tr>
    `).join("");
  }

  function renderCharts() {
    if (!window.Chart) return;
    const confirmed = state.data.counters && state.data.counters.confirmed ? state.data.counters.confirmed : { yes: 0, no: 0 };
    const paid = state.data.counters && state.data.counters.paid ? state.data.counters.paid : { yes: 0, no: 0 };
    renderChart("confirmed", els.confirmedChart, ["Confirmados", "Nao confirmados"], [confirmed.yes || 0, confirmed.no || 0]);
    renderChart("paid", els.paidChart, ["Pago", "Nao pago"], [paid.yes || 0, paid.no || 0]);
  }

  function renderChart(key, canvas, labels, data) {
    if (!canvas) return;
    if (state.charts[key]) state.charts[key].destroy();
    state.charts[key] = new window.Chart(canvas, {
      type: "doughnut",
      data: { labels, datasets: [{ data, backgroundColor: ["#f14545", "#444d5a"], borderWidth: 0 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: "#f7f8fa" } } } }
    });
  }

  function renderRepertoire() {
    const songs = Array.isArray(state.data.songs) ? state.data.songs : [];
    if (!songs.length) {
      els.repertoireList.innerHTML = emptyState("Nenhuma musica no repertorio.");
      els.repertoireRanking.innerHTML = emptyState("O preview vai aparecer aqui.");
      return;
    }

    els.repertoireList.innerHTML = songs.map((song) => `
      <div class="song-item" data-song-id="${song.id}" draggable="true">
        <div class="song-order">${song.order}</div>
        <div class="song-main">
          <div class="song-top">
            <span class="drag-handle">::</span>
            <strong>${escapeHtml(song.name)}</strong>
          </div>
          <div class="song-fields">
            <input class="filter-control" data-field="name" type="text" value="${escapeAttr(song.name)}" />
            ${hostSelect("suggestedBy", song.suggestedBy)}
          </div>
        </div>
        <div class="song-actions">
          <button type="button" class="btn btn-danger" data-action="delete-song">Excluir</button>
        </div>
      </div>
    `).join("");

    els.repertoireRanking.innerHTML = songs.map((song) => `
      <div class="ranking-item">
        <div class="ranking-head">
          <span class="ranking-position">#${song.order}</span>
          <strong>${escapeHtml(song.name)}</strong>
        </div>
      </div>
    `).join("");
  }

  function renderVoting() {
    const voter = state.currentVoter;
    const activeSession = getCurrentVoteSession();
    const sessions = getVoteSessions();

    els.voterSelect.value = voter;
    els.currentVoterBadge.textContent = `Votando: ${voter || "-"}`;
    els.voterGate.hidden = Boolean(voter);
    els.voteSessionHub.hidden = !voter || Boolean(activeSession);
    els.voteWorkspace.hidden = !voter || !activeSession;
    els.voteBuilder.hidden = !state.isVoteBuilderOpen;

    if (!voter) {
      els.forceVoterAccessBtn.hidden = true;
      els.voteSessionsList.innerHTML = "";
      els.voteSessionsPreview.innerHTML = "";
      els.voteSongList.innerHTML = "";
      els.voteRanking.innerHTML = "";
      return;
    }

    renderVoteSessionsHub(sessions);

    if (!activeSession) {
      els.activeVoteSessionTitle.textContent = "Votacao";
      els.activeVoteSessionSubtitle.textContent = "Adicione novas opcoes e vote com o limite configurado para esta votacao.";
      els.voteProgressLabel.textContent = "Seus votos Sim:";
      els.positiveVoteCount.textContent = "0";
      els.positiveVoteLimit.textContent = String(limits.maxPositiveVotesPerVoter);
      els.convertVoteSessionModeBtn.hidden = true;
      els.ratingLegend.hidden = true;
      els.voteSongList.innerHTML = "";
      els.voteRanking.innerHTML = "";
      return;
    }

    els.activeVoteSessionTitle.textContent = activeSession.name;
    const isRatingMode = activeSession.answerMode === ANSWER_MODE_RATING;
    els.convertVoteSessionModeBtn.hidden = isRatingMode;
    els.ratingLegend.hidden = !isRatingMode;
    if (isRatingMode) {
      els.activeVoteSessionSubtitle.textContent = "Dê uma nota de 1 a 5 para cada opcao. O preview soma as notas recebidas.";
      const ratingCount = (activeSession.votes || []).filter((entry) => entry.voter === voter && ["1", "2", "3", "4", "5"].includes(String(entry.vote))).length;
      els.voteProgressLabel.textContent = "Suas notas registradas:";
      els.positiveVoteCount.textContent = String(ratingCount);
      els.positiveVoteLimit.textContent = String(activeSession.songs.length || 0);
    } else {
      els.activeVoteSessionSubtitle.textContent = `Adicione novas opcoes e vote com limite de ${activeSession.maxPositiveVotesPerVoter || limits.maxPositiveVotesPerVoter} votos Sim por pessoa.`;
      const positiveCount = (activeSession.votes || []).filter((entry) => entry.voter === voter && entry.vote === "yes").length;
      els.voteProgressLabel.textContent = "Seus votos Sim:";
      els.positiveVoteCount.textContent = String(positiveCount);
      els.positiveVoteLimit.textContent = String(activeSession.maxPositiveVotesPerVoter || limits.maxPositiveVotesPerVoter);
    }

    if (!activeSession.songs.length) {
      els.voteSongList.innerHTML = emptyState("Nenhuma opcao nessa votacao.");
      els.voteRanking.innerHTML = emptyState("O ranking aparece aqui quando houver opcoes.");
      return;
    }

    const userVotes = new Map((activeSession.votes || []).filter((entry) => entry.voter === voter).map((entry) => [String(entry.songId), entry.vote]));
    els.voteSongList.innerHTML = activeSession.songs.map((song) => {
      const currentVote = userVotes.get(String(song.id)) || "";
      const actionButtons = isRatingMode
        ? renderRatingVoteButtons(currentVote)
        : `
            <button type="button" class="btn btn-vote ${currentVote === "yes" ? "is-yes-active" : ""}" data-action="vote" data-vote="yes">Sim</button>
            <button type="button" class="btn btn-vote ${currentVote === "no" ? "is-no-active" : ""}" data-action="vote" data-vote="no">Nao</button>
          `;
      return `
        <div class="vote-item" data-song-id="${song.id}">
          <div><strong>${escapeHtml(song.name)}</strong></div>
          <div class="vote-actions">
            ${actionButtons}
            <button type="button" class="btn btn-danger" data-action="delete-vote-song">Excluir</button>
          </div>
        </div>
      `;
    }).join("");

    els.voteRanking.innerHTML = (activeSession.songStats || []).map((song, index) => `
      <div class="ranking-item">
        <div class="ranking-head">
          <span class="ranking-position">#${index + 1}</span>
          <strong>${escapeHtml(song.name)}</strong>
        </div>
        <div class="ranking-metrics">${isRatingMode ? `Soma ${song.scoreTotal || 0} | Media ${formatScore(song.scoreAverage || 0)} | ${song.ratingCount || 0} notas` : `${song.percent || 0}% | Sim ${song.yes || 0} | Nao ${song.no || 0}`}</div>
        <div class="bar-shell"><div class="bar-fill" style="width:${song.percent || 0}%"></div></div>
        ${activeSession.isSecret ? "" : `<div class="vote-voters">${renderVoterDots(song.voters || [])}</div>`}
      </div>
    `).join("");
  }

  function renderVoteSessionsHub(sessions) {
    if (!sessions.length) {
      els.voteSessionsList.innerHTML = emptyState("Nenhuma votacao ativa criada ainda.");
      els.voteSessionsPreview.innerHTML = emptyState("Crie a primeira votacao para começar.");
    } else {
      els.voteSessionsList.innerHTML = sessions.map((session) => `
        <div class="draft-item">
          <button type="button" class="session-card" data-action="open-session" data-session-id="${session.id}">
            <span class="session-title">${escapeHtml(session.name)}</span>
            <span class="song-meta">${session.songCount || 0} opcoes | ${session.answerMode === ANSWER_MODE_RATING ? "notas 1-5" : `limite ${session.maxPositiveVotesPerVoter || limits.maxPositiveVotesPerVoter} Sim por pessoa`}${session.isSecret ? " | voto secreto" : ""}</span>
          </button>
          <button type="button" class="btn btn-danger" data-action="delete-session" data-session-id="${session.id}">Excluir</button>
        </div>
      `).join("");

      els.voteSessionsPreview.innerHTML = sessions.map((session) => `
        <div class="ranking-item">
          <div class="ranking-head">
            <strong>${escapeHtml(session.name)}</strong>
            <span class="ranking-metrics">${session.answerMode === ANSWER_MODE_RATING ? `Soma ${session.scoreTotal || 0}` : `${session.songCount || 0} opcoes`}</span>
          </div>
        </div>
      `).join("");
    }

    renderVoteBuilder();
  }

  function renderVoteBuilder() {
    if (!state.voteDraftSongs.length) {
      els.voteDraftSongs.innerHTML = emptyState("As opcoes da nova votacao vao aparecer aqui.");
      return;
    }

    els.voteDraftSongs.innerHTML = state.voteDraftSongs.map((song, index) => `
      <div class="draft-item" data-draft-index="${index}">
        <span><strong>#${index + 1}</strong> ${escapeHtml(song.name)}</span>
        <button type="button" class="btn btn-danger" data-action="remove-draft-song">Remover</button>
      </div>
    `).join("");
  }

  async function onGuestCreate(event) {
    event.preventDefault();
    try {
      state.data = await api("/api/scarlet-drive/guests", {
        method: "POST",
        body: { name: els.guestName.value, invitedBy: els.guestHost.value, isPaid: els.guestPaid.value, isConfirmed: els.guestConfirmed.value }
      });
      els.addForm.reset();
      els.guestHost.value = hosts[0] || "";
      renderAll();
      setMessage(els.feedback, "Convidado adicionado.", "success");
    } catch (error) {
      setMessage(els.feedback, error.message, "error");
    }
  }

  async function onSongCreate(event) {
    event.preventDefault();
    try {
      state.data = await api("/api/scarlet-drive/songs", { method: "POST", body: { name: els.songName.value, suggestedBy: els.songSuggestedBy.value } });
      els.songForm.reset();
      els.songSuggestedBy.value = hosts[0] || "";
      renderAll();
      setMessage(els.songFeedback, "Musica adicionada ao repertorio.", "success");
    } catch (error) {
      setMessage(els.songFeedback, error.message, "error");
    }
  }

  async function onVoteSongCreate(event) {
    event.preventDefault();
    const session = getCurrentVoteSession();
    if (!session) return;
    try {
      state.data = await api(`/api/scarlet-drive/vote-sessions/${session.id}/songs`, {
        method: "POST",
        body: { name: els.voteSongName.value, suggestedBy: state.currentVoter || hosts[0] || "", voter: state.currentVoter }
      });
      els.voteSongForm.reset();
      renderAll();
      setMessage(els.voteFeedback, "Opcao adicionada na votacao.", "success");
    } catch (error) {
      setMessage(els.voteFeedback, error.message, "error");
    }
  }

  async function onGuestTableChange(event) {
    const row = event.target.closest("[data-guest-id]");
    if (!row) return;
    const guestId = row.dataset.guestId;
    const field = event.target.dataset.field;
    if (!field) return;
    try {
      state.data = await api(`/api/scarlet-drive/guests/${guestId}`, { method: "PATCH", body: { [field]: event.target.value } });
      renderAll();
    } catch (error) {
      setMessage(els.feedback, error.message, "error");
      await refreshState();
    }
  }

  async function onGuestTableClick(event) {
    const button = event.target.closest("[data-action='delete-guest']");
    if (!button) return;
    const row = button.closest("[data-guest-id]");
    if (!row || !(await confirmAction("Excluir este convidado?"))) return;
    try {
      state.data = await api(`/api/scarlet-drive/guests/${row.dataset.guestId}`, { method: "DELETE" });
      renderAll();
    } catch (error) {
      setMessage(els.feedback, error.message, "error");
    }
  }

  async function onSongListChange(event) {
    const item = event.target.closest("[data-song-id]");
    if (!item) return;
    const field = event.target.dataset.field;
    if (!field) return;
    try {
      state.data = await api(`/api/scarlet-drive/songs/${item.dataset.songId}`, { method: "PATCH", body: { [field]: event.target.value } });
      renderAll();
    } catch (error) {
      setMessage(els.songFeedback, error.message, "error");
      await refreshState();
    }
  }

  async function onSongListClick(event) {
    const button = event.target.closest("[data-action='delete-song']");
    if (!button) return;
    const item = button.closest("[data-song-id]");
    if (!item || !(await confirmAction("Excluir esta musica do repertorio?"))) return;
    try {
      state.data = await api(`/api/scarlet-drive/songs/${item.dataset.songId}`, { method: "DELETE" });
      renderAll();
    } catch (error) {
      setMessage(els.songFeedback, error.message, "error");
    }
  }

  function onSongDragStart(event) {
    const item = event.target.closest("[data-song-id]");
    if (!item) return;
    state.draggedSongId = String(item.dataset.songId || "");
    item.classList.add("is-dragging");
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
  }

  function onSongDragOver(event) {
    event.preventDefault();
    const item = event.target.closest("[data-song-id]");
    clearDropTargets();
    if (item && String(item.dataset.songId || "") !== state.draggedSongId) item.classList.add("is-drop-target");
  }

  function onSongDragLeave(event) {
    const item = event.target.closest("[data-song-id]");
    if (item) item.classList.remove("is-drop-target");
  }

  async function onSongDrop(event) {
    event.preventDefault();
    const target = event.target.closest("[data-song-id]");
    if (!target || !state.draggedSongId) return clearDragState();
    const targetId = String(target.dataset.songId || "");
    if (targetId === state.draggedSongId) return clearDragState();
    const ids = (state.data.songs || []).map((song) => String(song.id));
    const orderedIds = moveId(ids, state.draggedSongId, targetId, event.clientY > target.getBoundingClientRect().top + (target.offsetHeight / 2));
    try {
      state.data = await api("/api/scarlet-drive/songs/reorder", { method: "POST", body: { orderedIds } });
      renderAll();
    } catch (error) {
      setMessage(els.songFeedback, error.message, "error");
    } finally {
      clearDragState();
    }
  }

  function clearDropTargets() {
    els.repertoireList.querySelectorAll(".is-drop-target").forEach((node) => node.classList.remove("is-drop-target"));
  }

  function clearDragState() {
    state.draggedSongId = null;
    clearDropTargets();
    els.repertoireList.querySelectorAll(".is-dragging").forEach((node) => node.classList.remove("is-dragging"));
  }

  async function continueVoting() {
    if (!els.voterSelect.value) return setMessage(els.voterFeedback, "Selecione quem vai votar para continuar.", "warning");
    try {
      state.data = await api("/api/scarlet-drive/voter-access", {
        method: "POST",
        body: { voter: els.voterSelect.value }
      });
      state.currentVoter = els.voterSelect.value;
      setMessage(els.voterFeedback, "", "");
      els.forceVoterAccessBtn.hidden = true;
      renderAll();
    } catch (error) {
      setMessage(els.voterFeedback, error.message, "error");
      els.forceVoterAccessBtn.hidden = !/IP diferente/i.test(String(error && error.message));
    }
  }

  async function forceContinueVoting() {
    if (!els.voterSelect.value) return setMessage(els.voterFeedback, "Selecione quem vai votar para continuar.", "warning");
    try {
      state.data = await api("/api/scarlet-drive/voter-access", {
        method: "POST",
        body: { voter: els.voterSelect.value, forceOverride: true }
      });
      state.currentVoter = els.voterSelect.value;
      setMessage(els.voterFeedback, "", "");
      els.forceVoterAccessBtn.hidden = true;
      renderAll();
    } catch (error) {
      setMessage(els.voterFeedback, error.message, "error");
    }
  }

  function resetVoter() {
    state.currentVoter = "";
    state.currentVoteSessionId = null;
    state.isVoteBuilderOpen = false;
    state.voteDraftSongs = [];
    setMessage(els.voteFeedback, "", "");
    setMessage(els.voteBuilderFeedback, "", "");
    setMessage(els.voterFeedback, "", "");
    els.forceVoterAccessBtn.hidden = true;
    renderVoting();
  }

  function openVoteBuilder() {
    state.isVoteBuilderOpen = true;
    syncVoteBuilderMode();
    if (!els.voteSessionMaxVotes.value) {
      els.voteSessionMaxVotes.value = String(limits.maxPositiveVotesPerVoter);
    }
    renderVoting();
  }

  function closeVoteBuilder() {
    state.isVoteBuilderOpen = false;
    state.voteDraftSongs = [];
    els.voteSessionName.value = "";
    els.voteSessionAnswerMode.value = ANSWER_MODE_YES_NO;
    els.voteSessionMaxVotes.value = String(limits.maxPositiveVotesPerVoter);
    syncVoteBuilderMode();
    els.voteSessionIsSecret.value = "false";
    els.voteDraftSongName.value = "";
    setMessage(els.voteBuilderFeedback, "", "");
    renderVoting();
  }

  function syncVoteBuilderMode() {
    const isRatingMode = els.voteSessionAnswerMode.value === ANSWER_MODE_RATING;
    els.voteSessionMaxVotes.disabled = isRatingMode;
    els.voteSessionMaxVotesLabel.textContent = isRatingMode
      ? "Limite de votos Sim por pessoa"
      : "Limite de votos Sim por pessoa";
    els.voteSessionMaxVotes.parentElement.hidden = isRatingMode;
  }

  function addDraftVoteSong() {
    const name = String(els.voteDraftSongName.value || "").trim();
    if (!name) return setMessage(els.voteBuilderFeedback, "Digite a outra opcao antes de adicionar.", "warning");
    if (state.voteDraftSongs.some((song) => normalize(song.name) === normalize(name))) {
      return setMessage(els.voteBuilderFeedback, "Essa opcao ja entrou nessa nova votacao.", "warning");
    }
    state.voteDraftSongs.push({ name });
    els.voteDraftSongName.value = "";
    setMessage(els.voteBuilderFeedback, "", "");
    renderVoteBuilder();
  }

  function onVoteDraftSongsClick(event) {
    const button = event.target.closest("[data-action='remove-draft-song']");
    if (!button) return;
    const item = button.closest("[data-draft-index]");
    const index = Number(item && item.dataset.draftIndex);
    if (!Number.isInteger(index) || index < 0) return;
    state.voteDraftSongs.splice(index, 1);
    renderVoteBuilder();
  }

  async function saveVoteSession() {
    try {
      const name = String(els.voteSessionName.value || "").trim();
      const answerMode = String(els.voteSessionAnswerMode.value || ANSWER_MODE_YES_NO);
      const maxPositiveVotesPerVoter = Number(els.voteSessionMaxVotes.value);
      const isSecret = String(els.voteSessionIsSecret.value || "false") === "true";
      if (!name) throw new Error("Digite o nome da votacao.");
      if (answerMode === ANSWER_MODE_YES_NO && (!Number.isInteger(maxPositiveVotesPerVoter) || maxPositiveVotesPerVoter < 1 || maxPositiveVotesPerVoter > 99)) {
        throw new Error("Use um limite de votos Sim entre 1 e 99.");
      }
      if (!state.voteDraftSongs.length) throw new Error("Adicione pelo menos uma opcao antes de salvar.");
      state.data = await api("/api/scarlet-drive/vote-sessions", {
        method: "POST",
        body: {
          name,
          voter: state.currentVoter,
          answerMode,
          isSecret,
          maxPositiveVotesPerVoter: answerMode === ANSWER_MODE_YES_NO ? maxPositiveVotesPerVoter : limits.maxPositiveVotesPerVoter,
          songs: state.voteDraftSongs.map((song) => ({ name: song.name, suggestedBy: state.currentVoter || hosts[0] || "" })),
        }
      });
      const created = getVoteSessions().find((session) => normalize(session.name) === normalize(name));
      state.currentVoteSessionId = created ? created.id : null;
      closeVoteBuilder();
      renderAll();
      setMessage(els.voteFeedback, "Votacao criada com sucesso.", "success");
    } catch (error) {
      setMessage(els.voteBuilderFeedback, error.message || "Nao foi possivel salvar a votacao.", "error");
    }
  }

  function onVoteSessionsListClick(event) {
    const deleteButton = event.target.closest("[data-action='delete-session']");
    if (deleteButton) {
      deleteVoteSession(String(deleteButton.dataset.sessionId || ""));
      return;
    }

    const button = event.target.closest("[data-action='open-session']");
    if (!button) return;
    state.currentVoteSessionId = String(button.dataset.sessionId || "");
    setMessage(els.voteFeedback, "", "");
    renderVoting();
  }

  async function deleteVoteSession(sessionId) {
    if (!sessionId || !(await confirmAction("Excluir esta votacao inteira?"))) return;
    try {
      state.data = await api(`/api/scarlet-drive/vote-sessions/${sessionId}`, {
        method: "DELETE",
        body: { voter: state.currentVoter }
      });
      if (String(state.currentVoteSessionId) === String(sessionId)) {
        state.currentVoteSessionId = null;
      }
      renderAll();
      setMessage(els.voteFeedback, "Votacao excluida com sucesso.", "success");
    } catch (error) {
      setMessage(els.voteFeedback, error.message, "error");
    }
  }

  async function convertCurrentVoteSessionToRating() {
    const session = getCurrentVoteSession();
    if (!session || session.answerMode === ANSWER_MODE_RATING) return;
    const confirmed = await confirmAction("Converter esta votacao para notas de 1 a 5? Os votos atuais Sim viram nota 5 e Nao viram nota 1.");
    if (!confirmed) return;
    try {
      state.data = await api(`/api/scarlet-drive/vote-sessions/${session.id}/settings`, {
        method: "PATCH",
        body: { voter: state.currentVoter, answerMode: ANSWER_MODE_RATING }
      });
      renderAll();
      setMessage(els.voteFeedback, "Votacao convertida para notas de 1 a 5.", "success");
    } catch (error) {
      setMessage(els.voteFeedback, error.message, "error");
    }
  }

  function backToVoteSessions() {
    state.currentVoteSessionId = null;
    setMessage(els.voteFeedback, "", "");
    renderVoting();
  }

  async function onVoteListClick(event) {
    const session = getCurrentVoteSession();
    if (!session) return;
    const item = event.target.closest("[data-song-id]");
    if (!item) return;
    const songId = item.dataset.songId;

    const voteButton = event.target.closest("[data-action='vote']");
    if (voteButton) {
      try {
        state.data = await api(`/api/scarlet-drive/vote-sessions/${session.id}/songs/${songId}/vote`, {
          method: "PUT",
          body: { voter: state.currentVoter, vote: voteButton.dataset.vote }
        });
        renderAll();
      } catch (error) {
        setMessage(els.voteFeedback, error.message, "error");
      }
      return;
    }

    const deleteButton = event.target.closest("[data-action='delete-vote-song']");
    if (!deleteButton || !(await confirmAction("Excluir esta opcao da votacao?"))) return;
    try {
      state.data = await api(`/api/scarlet-drive/vote-sessions/${session.id}/songs/${songId}`, {
        method: "DELETE",
        body: { voter: state.currentVoter }
      });
      renderAll();
    } catch (error) {
      setMessage(els.voteFeedback, error.message, "error");
    }
  }

  function exportGuests() {
    const rows = [["Nome", "Convidado por", "Pago", "Confirmado"]].concat(
      (state.data.guests || []).map((guest) => [guest.name, guest.invitedBy, guest.isPaid ? "Sim" : "Nao", guest.isConfirmed ? "Sim" : "Nao"])
    );
    const csv = rows.map((row) => row.map(csvCell).join(";")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "scarletdrive-lista.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function printRepertoire() {
    const songs = state.data.songs || [];
    const html = `
      <!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Repertorio ScarletDrive</title>
      <style>body{font-family:Arial,sans-serif;padding:24px}h1{margin:0 0 16px}table{width:100%;border-collapse:collapse}th,td{padding:10px;border-bottom:1px solid #dcdcdc;text-align:left}th{font-size:12px;text-transform:uppercase}</style>
      </head><body><h1>Repertorio ScarletDrive</h1><table><thead><tr><th>#</th><th>Musica</th></tr></thead><tbody>
      ${songs.map((song) => `<tr><td>${song.order}</td><td>${escapeHtml(song.name)}</td></tr>`).join("")}
      </tbody></table></body></html>
    `;
    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) return;
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  function getVoteSessions() {
    return Array.isArray(state.data.voteSessions) ? state.data.voteSessions : [];
  }

  function getCurrentVoteSession() {
    return getVoteSessions().find((session) => String(session.id) === String(state.currentVoteSessionId)) || null;
  }

  function renderRatingVoteButtons(currentVote) {
    return [1, 2, 3, 4, 5].map((score) => `
      <button
        type="button"
        class="btn btn-vote ${String(currentVote) === String(score) ? "is-score-active" : ""}"
        data-action="vote"
        data-vote="${score}"
        title="${score} - ${RATING_LABELS[score]}"
      >${score}</button>
    `).join("");
  }

  function formatScore(value) {
    const numeric = Number(value || 0);
    return Number.isFinite(numeric) ? numeric.toFixed(2).replace(/\.00$/, "") : "0";
  }

  function renderVoterDots(voters) {
    if (!voters.length) return `<span class="muted">Sem votos ainda.</span>`;
    return voters.map((entry) => {
      const voterName = String(entry.voter || "").trim();
      const initials = voterName === "Gill"
        ? "GR"
        : voterName === "Gustavo"
          ? "GU"
          : voterName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
      const voteClass = ["1", "2", "3", "4", "5"].includes(String(entry.vote)) ? `is-score-${entry.vote}` : `is-${entry.vote}`;
      const voteLabel = ["1", "2", "3", "4", "5"].includes(String(entry.vote)) ? `Nota ${entry.vote}` : String(entry.vote).toUpperCase();
      return `<span class="vote-voter-dot ${voteClass}" title="${escapeAttr(`${entry.voter} - ${voteLabel}`)}">${escapeHtml(initials)}</span>`;
    }).join("");
  }

  function hostSelect(field, selected, className) {
    const options = hosts.map((host) => `<option value="${escapeAttr(host)}" ${host === selected ? "selected" : ""}>${escapeHtml(host)}</option>`).join("");
    return `<select class="filter-control ${className || ""}" data-field="${field}">${options}</select>`;
  }

  function booleanSelect(field, selected) {
    return `<select class="filter-control small-select" data-field="${field}">
      <option value="true" ${selected ? "selected" : ""}>Sim</option>
      <option value="false" ${selected ? "" : "selected"}>Nao</option>
    </select>`;
  }

  function emptyState(message) {
    return `<div class="empty-state">${escapeHtml(message)}</div>`;
  }

  function moveId(ids, draggedId, targetId, insertAfter) {
    const next = ids.filter((id) => id !== draggedId);
    const index = next.indexOf(targetId);
    next.splice(insertAfter ? index + 1 : index, 0, draggedId);
    return next;
  }

  async function api(url, options) {
    const response = await fetch(url, {
      method: options && options.method ? options.method : "GET",
      headers: { "Content-Type": "application/json" },
      body: options && options.body ? JSON.stringify(options.body) : undefined
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.message || "Erro inesperado.");
      error.code = payload.code || null;
      throw error;
    }
    return payload;
  }

  async function confirmAction(title) {
    if (window.Swal) {
      const result = await window.Swal.fire({ title, icon: "warning", showCancelButton: true, confirmButtonText: "Sim", cancelButtonText: "Cancelar" });
      return Boolean(result.isConfirmed);
    }
    return window.confirm(title);
  }

  function setMessage(element, message, type) {
    if (!element) return;
    element.textContent = message || "";
    element.className = "feedback" + (message && type ? ` ${type}` : "");
  }

  function csvCell(value) {
    return `"${String(value == null ? "" : value).replace(/"/g, "\"\"")}"`;
  }

  function normalize(value) {
    return String(value || "").trim().toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }
})();

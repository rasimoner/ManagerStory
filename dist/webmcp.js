(() => {
  const context = document.modelContext;
  if (!context?.registerTool) return;
  const lifecycle = new AbortController();
  addEventListener("pagehide", () => lifecycle.abort(), { once: true });
  try {
    Promise.resolve(context.registerTool({
      name: "read_managerstory_game_state",
      title: "ManagerStory kariyer durumunu oku",
      description: "Mevcut yerel kariyeri, kadroyu ve canlı maç durumunu değiştirmeden okur.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute(input) {
        if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).length) {
          throw new Error("Parametre olarak boş bir nesne gönderin.");
        }
        if (!S) return { careerStarted: false };
        return {
          careerStarted: true, club: managedClubName(), week: S.week, day: S.day,
          budget: S.budget, board: S.board, fans: S.fans,
          event: S.event ? { kind: S.event.kind, title: S.event.title, text: S.event.text } : null,
          squad: S.players.filter(p => p.status !== "Transfer oldu").map(p => ({
            id: p.id, name: p.name, position: p.pos, overall: p.overall,
            fitness: p.fitness, morale: p.morale, startingXI: S.xi.includes(p.id)
          })),
          match: M ? { minute: M.min, home: M.home, away: M.away, homeGoals: M.hg, awayGoals: M.ag, paused: M.pause } : null
        };
      }
    }, { signal: lifecycle.signal })).catch(error => console.warn("Kariyer okuma aracı kaydedilemedi.", error));
  } catch (error) {
    console.warn("Kariyer okuma aracı kaydedilemedi.", error);
  }
})();

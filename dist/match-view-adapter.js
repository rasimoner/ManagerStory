/* Read-only boundary. Never calls tick, random, save or presentation advancement. */
(() => {
  const listeners = new Set();
  const copy = value => value == null ? null : structuredClone(value);
  function freeze(value) {
    if (value && typeof value === 'object') {
      Object.values(value).forEach(freeze);
      Object.freeze(value);
    }
    return value;
  }
  function read(frame = typeof pitchV73 !== 'undefined' && pitchV73?.match === M ? pitchV73 : null) {
    if (typeof M === 'undefined' || !M) return null;
    const players = ['user', 'opp'].flatMap(side => (side === 'user' ? M.active : M.oppIds).map(id => ({
      id, side,
      name: playerAtMarker(id,side)?.name ?? String(id),
      role: side === 'user' ? M.matchRoles[id] : playerAtMarker(id,side)?.position,
      enginePosition: copy(eventPoint(id, side)),
      displayPosition: copy(frame?.positions?.[String(id)]),
      attackDirection: attackDirection(side),
      facingRadians: null // Engine has no body orientation or foot contact data.
    })));
    return freeze({
      schema: 1, coordinateSystem: 'pitch-percent-x-length-y-width',
      matchSeconds: M.matchElapsedSeconds, speed: M.speed,
      teams: { home: copy(resolveClubIdentity('goal',{teamId:M.home})), away: copy(resolveClubIdentity('goal',{teamId:M.away})), userHome: M.userHome },
      statistics: { shots: copy(M.shots), xg: copy(M.stats?.xg), possession: copy(matchPossession()) },
      lifecycle: M.lifecycle, paused: M.pause, finished: M.finished,
      secondHalf: M.secondHalf, score: [M.hg, M.ag], players,
      ball: {
        engine: copy(M.ballState), engineSide: M.ballSide,
        displayPosition: copy(frame?.ball), displayOwnerId: frame?.carrier ?? null,
        displaySide: frame?.side ?? null, displayState: copy(frame?.ballState),
        heightNormalized: frame?.ballState?.height ?? null, heightMeters: null
      },
      lastEvent: copy(M.events?.at(-1)),
      presentation: frame ? {
        activeEvent: copy(frame.active), progress: frame.progress, looseMotion:copy(frame.looseMotion), carryMotion:copy(frame.carryMotion), contestMotion:copy(frame.contestMotion), shotMotion:copy(frame.shotMotion),
        source: ['presentationSync','enginePositionGap'].includes(frame.active?.type) ? 'presentation-catchup' : 'match-event',
        queuedEventIds: frame.queue.map(e => e.eventId ?? null),
        sampledAtMilliseconds: frame.lastTime,
        eventScore: copy(frame.eventScore), eventStatistics: copy(frame.eventStatistics),
        duration: frame.durationEvent === frame.active ? frame.activeDuration : (frame.active ? eventAnimationTime(frame.active) : 0),
        seconds: frame.presentationSeconds ?? null, delta: frame.presentationDelta ?? 0,
        clockSource: window.ManagerStoryLive3D?.enabled ? 'shared-live-frame / atomic-minute-backpressure' : 'legacy-presentation',
        positionSamples:copy(frame.positionSamples),
        matchSeconds:frame.displayMatchSeconds??matchSecond(),
        rawEngineLeadSeconds:matchSecond()-(frame.displayMatchSeconds??matchSecond()),
        interventionBoundary:'next-uncomputed-engine-minute; current atomic batch is already committed',
        readableTempo: window.ManagerStoryLive3D?.enabled ? window.ManagerStoryLive3D.tempo : null
      } : null,
      missing: ['body-facing', 'foot-contact-time', 'physical-ball-height', 'continuous-engine-velocity']
    });
  }
  window.MatchView = Object.freeze({
    read,
    describePass(event, firstTouch = null) {
      if (!event || !['pass','cross'].includes(event.type)) return null;
      const duration = eventAnimationTime(event);
      const controlDuration = firstTouch ? eventAnimationTime(firstTouch) : 0;
      // Existing renderer phase boundaries; no new authoritative match time.
      return freeze({ event:copy(event), firstTouch:copy(firstTouch), duration,
        contactAt:duration*.19, arrivalAt:duration*.76, endAt:duration+controlDuration,
        controlDuration, timingSource:'eventAnimationTime / pitchEventPhase',
        missing:['absolute-presentation-start','measured-foot-contact','physical-height','receiver-continuous-trajectory'] });
    },
    previewIdentity() {
      const user = resolveClubIdentity('career');
      const rivalName = S ? currentOpponent()[0] : OPP[0][0];
      return freeze({user:copy(user),rival:copy(resolveClubIdentity('goal',{teamId:rivalName}))});
    },
    readEvents(afterId = 0) {
      if (typeof M === 'undefined' || !M) return Object.freeze([]);
      // End event currently has no ID; include it explicitly, do not invent one.
      return freeze(copy(M.events.filter(e => e.eventId == null || e.eventId > afterId)));
    },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    publish(frame) {
      if (!listeners.size) return;
      const snapshot = read(frame);
      for (const listener of listeners) {
        try { listener(snapshot); } catch (error) { console.warn('Match view observer failed', error); }
      }
    }
  });
})();

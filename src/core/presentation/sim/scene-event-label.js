const EVENT_LABELS = { goal: 'GOOOL!', save: 'Kurtarış', shot: 'Şut', tackle: 'Müdahale', block: 'Blok',
  beat: 'Rakibini geçti', offside: 'OFSAYT', throwIn: 'Taç', corner: 'Korner', freeKick: 'Serbest vuruş', penalty: 'Penaltı', goalKick: 'Aut' };

export function simulationSceneCaption(frame) {
  const event = frame.contacts.findLast(contact => contact.time <= frame.physicsTime && (EVENT_LABELS[contact.type] || contact.type === 'skill'));
  const skill = { cut: 'Yön değiştirme', bodyFeint: 'Vücut çalımı', turn: 'Dönüş' };
  return { event, text: event?.type === 'skill' ? skill[event.kind] ?? '' : EVENT_LABELS[event?.type] ?? '' };
}

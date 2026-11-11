// Phone 0.2.8 identifies journeys; legacy phones keep only turn/near reminders.
function createJourneyReminders() {
  let session = null, started = [], ended = [];
  function remember(list, id) { if (list.length === 32) list.shift(); list.push(id); }
  return {
    consume(packet, eligible) {
      if (!packet || typeof packet.navigationId !== 'string' || !packet.navigationId ||
          typeof packet.navigationEnded !== 'boolean' || typeof packet.vibrationEnabled !== 'boolean') return null;
      if (packet.session !== session) { session = packet.session; started = []; ended = []; }
      const id = packet.navigationId;
      let reason = null;
      if (packet.status === 'active' && !packet.navigationEnded && started.indexOf(id) < 0) {
        remember(started, id); reason = 'start';
      } else if ((packet.status === 'ended' || packet.status === 'idle') && packet.navigationEnded && ended.indexOf(id) < 0) {
        remember(ended, id);
        // Opening/reconnecting to a finished route without ever seeing it active is silent.
        if (started.indexOf(id) >= 0) reason = 'end';
      }
      return eligible && packet.vibrationEnabled ? reason : null;
    }
  };
}
module.exports = { createJourneyReminders };

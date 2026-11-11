// Independently implemented from the reminder behavior documented in MiNavigateRing.
// Only receive events consume reminders: painting, reconnecting and showing a page do not.
const TURNS = ['left', 'right', 'slight_left', 'slight_right', 'sharp_left', 'sharp_right', 'uturn', 'roundabout'];
const HISTORY_LIMIT = 32;

function distanceMeters(text) {
  if (typeof text !== 'string') return null;
  const match = /^\s*(\d+(?:\.\d+)?)\s*(公里|千米|米|km|m)\s*$/i.exec(text);
  if (!match) return null;
  const unit = match[2].toLowerCase();
  const distance = Number(match[1]) * (unit === '公里' || unit === '千米' || unit === 'km' ? 1000 : 1);
  return Number.isFinite(distance) && distance >= 0 ? distance : null;
}

function remember(history, id) {
  if (history.length === HISTORY_LIMIT) history.shift();
  history.push(id);
}

function createReminders() {
  let session = null;
  let turns = [];
  let near = [];
  return {
    consume(packet, eligible) {
      if (!packet || packet.status !== 'active' || TURNS.indexOf(packet.maneuver) < 0 ||
          typeof packet.session !== 'string' || !packet.session ||
          typeof packet.actionId !== 'string' || !packet.actionId ||
          typeof packet.vibrationEnabled !== 'boolean' ||
          (packet.mode !== 'walk' && packet.mode !== 'cycle')) return null;
      if (packet.session !== session) {
        session = packet.session;
        turns = [];
        near = [];
      }
      const id = packet.actionId;
      const distance = distanceMeters(packet.distance);
      const inRange = distance !== null && distance <= (packet.mode === 'cycle' ? 100 : 30);
      let reason = null;
      if (turns.indexOf(id) < 0) {
        remember(turns, id);
        if (inRange && near.indexOf(id) < 0) remember(near, id);
        reason = 'turn';
      } else if (inRange && near.indexOf(id) < 0) {
        remember(near, id);
        reason = 'near';
      }
      // Hidden or muted frames still consume the opportunity; never replay on resume.
      return eligible && packet.vibrationEnabled ? reason : null;
    }
  };
}

module.exports = { createReminders, distanceMeters };

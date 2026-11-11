module.exports = function clock(start = 100000) {
  let time = start, id = 0;
  const jobs = new Map();
  return {
    now: () => time,
    schedule(fn, delay) { jobs.set(++id, { fn, at: time + delay }); return id; },
    unschedule(id) { jobs.delete(id); },
    count: () => jobs.size,
    advance(ms) {
      const end = time + ms;
      for (;;) {
        const entry = [...jobs].sort((a, b) => a[1].at - b[1].at)[0];
        if (!entry || entry[1].at > end) break;
        time = entry[1].at; jobs.delete(entry[0]); entry[1].fn();
      }
      time = end;
    },
    suspend(ms) {
      time += ms;
      for (const [id, job] of [...jobs]) if (job.at <= time) { jobs.delete(id); job.fn(); }
    }
  };
};

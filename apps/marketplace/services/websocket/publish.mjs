import {
  STATISTICS_CHANNEL,
  STATISTICS_KEY
} from "./protocol.mjs";


// Revisionen als Dezimalstrings vergleichen; PostgreSQL-Transaktionsnummern können 2^53 überschreiten.
const script = `
local old = redis.call('GET', KEYS[1])
if old then
  local revision = cjson.decode(old).revision
  if #revision > #ARGV[1] or (#revision == #ARGV[1] and revision >= ARGV[1]) then return 0 end
end
redis.call('SET', KEYS[1], ARGV[2])
redis.call('PUBLISH', KEYS[2], ARGV[2])
return 1
`;

export function publishStatistics(redis, snapshot) {
  return redis.eval(
    script,
    2,
    STATISTICS_KEY,
    STATISTICS_CHANNEL,
    snapshot.revision,
    JSON.stringify(snapshot)
  );
}

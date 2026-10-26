/* Scripted moments of the first season.
   transferOffer: in the first season, on the given week and day, a club bids for one of the starting players
   (by id); the board can take the bid, the raised bid after a counter offer, or keep him. If he goes, the
   replacement (by id) takes his place in the eleven when he is not in it already; voice: the dressing-room voice
   (by id) who talks about it. playmaker: the player (by id) the old "free 10 / closer to the centre" decisions
   are about (their choices may still wait in old saves).
   Data only: everything after "=" is JSON (tests/data.test.cjs). */
export const STORY_DATA = {
  "transferOffer": {"playerId":12,"replacementId":13,"voiceId":6,"club":"Kuzey Liman","week":3,"day":2,"clock":"10:40","bid":9500000,"raisedBid":11500000,"ask":13000000},
  "playmaker": {"playerId":11}
};

/* The career's inbox (refactor D5): the messages the people around the career send (the board, the staff, the
   players), newest first, the last twelve kept. Any part of the game may write one; a mode draws them. */
import { S } from './state.js';
export function pushInbox(from,title,text,tone="normal"){S.inbox.unshift({from,title,text,tone,week:S.week,day:S.day,time:S.clock});S.inbox=S.inbox.slice(0,12)}

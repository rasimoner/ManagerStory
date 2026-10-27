/* The career's inbox (refactor D5): the messages the people around the career send (the board, the staff, the
   players), newest first, the last twelve kept. Any part of the game may write one; a mode draws them.
   pushInbox returns the message, so the writer can attach to it what the screen offers with it (a highlight). */
import { S } from './state.js';
export function pushInbox(from,title,text,tone="normal"){const message={from,title,text,tone,week:S.week,day:S.day,time:S.clock};S.inbox.unshift(message);S.inbox=S.inbox.slice(0,12);return message}

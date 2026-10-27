// Which way a player on the 3D pitch faces: his forward and right directions on the grass, from his heading.
import { V } from './runtime.js';

export const forwardOf = p => V(Math.sin(p.heading), 0, Math.cos(p.heading));
export const rightOf = p => V(-Math.cos(p.heading), 0, Math.sin(p.heading));

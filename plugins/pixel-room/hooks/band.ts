// The band above the prompt: a slim animated pixel strip of the room. A stub
// until it is drawn; register.tsx draws it on the desktop and mobile apps.

import type { RoomView } from './model'

/** The band's SVG for a view, sized for a band `columns` cells wide. */
export function buildBand(view: RoomView, columns: number): string {
  void view
  void columns
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 16" width="480" height="32" shape-rendering="crispEdges"></svg>'
}

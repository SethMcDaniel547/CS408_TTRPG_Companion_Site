import { useCallback, useEffect, useRef, useState } from "react";
import Matter from "matter-js";

const { Engine, Bodies, Body, Composite } = Matter;

export const BALL_RADIUS = 28;
const WALL = 200;
const MAX_BALLS = 30;
const STEP_MS = 1000 / 60;

// 2D physics for crumpled notes (matter.js). Owns the engine and animation
// loop; the view only renders `balls` and forwards pointer events.
//
// Balls are drawn as DOM elements positioned from their physics bodies each
// frame, so React never re-renders at animation speed. The viewport edges are
// walls, and balls collide with each other.
//
// `onDrop(ball, point)` is called when a dragged ball is released. Return true
// if the drop consumed the ball (it is then removed), false to let it fall.
export function useNoteBalls({ onDrop }) {
  const [balls, setBalls] = useState([]);
  const [draggingId, setDraggingId] = useState(null);

  const engineRef = useRef(null);
  const wallsRef = useRef([]);
  const bodiesRef = useRef(new Map()); // id -> body
  const elementsRef = useRef(new Map()); // id -> DOM element
  const textsRef = useRef(new Map()); // id -> note text
  const dragRef = useRef(null);
  const nextId = useRef(1);
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;

  const buildWalls = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    Composite.remove(engine.world, wallsRef.current);
    const w = window.innerWidth;
    const h = window.innerHeight;
    const opts = { isStatic: true, restitution: 0.4 };
    wallsRef.current = [
      Bodies.rectangle(w / 2, h + WALL / 2, w * 3, WALL, opts),
      Bodies.rectangle(w / 2, -WALL / 2 - 2000, w * 3, WALL, opts),
      Bodies.rectangle(-WALL / 2, h / 2, WALL, h * 6, opts),
      Bodies.rectangle(w + WALL / 2, h / 2, WALL, h * 6, opts),
    ];
    Composite.add(engine.world, wallsRef.current);
    // Pull any ball left outside by a shrinking window back inside.
    bodiesRef.current.forEach((body) => {
      const x = Math.min(Math.max(body.position.x, BALL_RADIUS), w - BALL_RADIUS);
      const y = Math.min(Math.max(body.position.y, BALL_RADIUS), h - BALL_RADIUS);
      Body.setPosition(body, { x, y });
    });
  }, []);

  // Engine + render loop, for the lifetime of the component using the hook.
  useEffect(() => {
    const engine = Engine.create({ gravity: { x: 0, y: 1 } });
    engineRef.current = engine;
    buildWalls();

    let frame = 0;
    const tick = () => {
      Engine.update(engine, STEP_MS);
      bodiesRef.current.forEach((body, id) => {
        const el = elementsRef.current.get(id);
        if (el) {
          el.style.transform = `translate(${body.position.x - BALL_RADIUS}px, ${body.position.y - BALL_RADIUS}px) rotate(${body.angle}rad)`;
        }
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    window.addEventListener("resize", buildWalls);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", buildWalls);
      Composite.clear(engine.world, false);
      Engine.clear(engine);
      engineRef.current = null;
      bodiesRef.current.clear();
      elementsRef.current.clear();
      textsRef.current.clear();
    };
  }, [buildWalls]);

  // Adds a ball. `fromTop` drops it in from above the screen (a received note);
  // otherwise it appears near the bottom-right, by the note entry area.
  const addBall = useCallback((text, { fromTop = false } = {}) => {
    const engine = engineRef.current;
    if (!engine) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const id = nextId.current++;
    const x = fromTop
      ? BALL_RADIUS + Math.random() * Math.max(1, w - BALL_RADIUS * 2)
      : Math.max(BALL_RADIUS, w - 160 - Math.random() * 80);
    const y = fromTop ? -BALL_RADIUS : Math.max(BALL_RADIUS, h * 0.4);
    const body = Bodies.circle(x, y, BALL_RADIUS, {
      restitution: 0.55,
      friction: 0.05,
      frictionAir: 0.005,
      density: 0.002,
    });
    Body.setVelocity(body, { x: (Math.random() - 0.5) * 6, y: fromTop ? 2 : -6 });
    Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.3);
    Composite.add(engine.world, body);
    bodiesRef.current.set(id, body);
    textsRef.current.set(id, text);
    setBalls((current) => [...current.slice(-(MAX_BALLS - 1)), { id }]);
  }, []);

  const removeBall = useCallback((id) => {
    const body = bodiesRef.current.get(id);
    if (body && engineRef.current) Composite.remove(engineRef.current.world, body);
    bodiesRef.current.delete(id);
    elementsRef.current.delete(id);
    textsRef.current.delete(id);
    setBalls((current) => current.filter((ball) => ball.id !== id));
  }, []);

  // Callback ref factory: the view registers each ball's element.
  const registerElement = useCallback((id, el) => {
    if (el) elementsRef.current.set(id, el);
    else elementsRef.current.delete(id);
  }, []);

  const textOf = useCallback((id) => textsRef.current.get(id) ?? "", []);

  const startDrag = useCallback((id, event) => {
    const body = bodiesRef.current.get(id);
    if (!body || event.button > 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    Body.setStatic(body, true);
    dragRef.current = { id, body, last: { x: event.clientX, y: event.clientY, t: performance.now() }, vx: 0, vy: 0 };
    Body.setPosition(body, clampPoint(event.clientX, event.clientY));
    setDraggingId(id);
  }, []);

  const moveDrag = useCallback((event) => {
    const drag = dragRef.current;
    if (!drag) return;
    const now = performance.now();
    const dt = Math.max(1, now - drag.last.t);
    // Smoothed pointer velocity in px per physics step, used for the throw.
    drag.vx = drag.vx * 0.5 + (((event.clientX - drag.last.x) / dt) * STEP_MS) * 0.5;
    drag.vy = drag.vy * 0.5 + (((event.clientY - drag.last.y) / dt) * STEP_MS) * 0.5;
    drag.last = { x: event.clientX, y: event.clientY, t: now };
    Body.setPosition(drag.body, clampPoint(event.clientX, event.clientY));
  }, []);

  const endDrag = useCallback((event) => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    setDraggingId(null);
    const consumed = onDropRef.current?.(
      { id: drag.id, text: textsRef.current.get(drag.id) ?? "" },
      { x: event.clientX, y: event.clientY },
    );
    if (consumed) {
      removeBall(drag.id);
      return;
    }
    Body.setStatic(drag.body, false);
    const stale = performance.now() - drag.last.t > 100;
    const cap = (v) => Math.max(-40, Math.min(40, v));
    Body.setVelocity(drag.body, stale ? { x: 0, y: 0 } : { x: cap(drag.vx), y: cap(drag.vy) });
  }, [removeBall]);

  return { balls, draggingId, addBall, removeBall, registerElement, textOf, startDrag, moveDrag, endDrag };
}

function clampPoint(x, y) {
  return {
    x: Math.min(Math.max(x, BALL_RADIUS), window.innerWidth - BALL_RADIUS),
    y: Math.min(Math.max(y, BALL_RADIUS), window.innerHeight - BALL_RADIUS),
  };
}

import {
  ENEMY_TELL_TYPES,
  createEmptyTellIntensities,
  type EnemyBehaviorDefinition,
  type EnemyTellType,
  type TellIntensities
} from "./tells";

export type EnemyBehaviorEventKind = "fakeout" | "realDrawTell" | "postDraw" | "aimDisruption";

export interface EnemyBehaviorEvent {
  id: string;
  kind: EnemyBehaviorEventKind;
  tellType: EnemyTellType;
  startsAt: number;
  endsAt: number;
  intensity: number;
  movementDistance?: number;
  hitZoneScaleMultiplier?: number;
  subtitleLine?: string;
}

export interface EnemyBehaviorTimeline {
  behavior: EnemyBehaviorDefinition;
  roundStartedAt: number;
  scheduledDrawAt: number;
  events: readonly EnemyBehaviorEvent[];
}

export interface EnemyBehaviorTimelineInput {
  behavior: EnemyBehaviorDefinition;
  roundStartedAt: number;
  fakeoutStartsAt: number;
  scheduledDrawAt: number;
  fakeoutChance: number;
  random?: () => number;
}

export interface EnemyBehaviorInfluence {
  intensities: TellIntensities;
  activeEvents: readonly EnemyBehaviorEvent[];
  activeFakeout: EnemyBehaviorEvent | null;
  fakeoutIntensity: number;
  realDrawTellIntensity: number;
  aimDisruptionIntensity: number;
  postDrawIntensity: number;
  leanOffset: number;
}

export function createEmptyBehaviorTimeline(
  behavior: EnemyBehaviorDefinition,
  now = 0
): EnemyBehaviorTimeline {
  return {
    behavior,
    roundStartedAt: now,
    scheduledDrawAt: now,
    events: []
  };
}

export function createEnemyBehaviorTimeline(
  input: EnemyBehaviorTimelineInput
): EnemyBehaviorTimeline {
  const random = input.random ?? Math.random;
  const events: EnemyBehaviorEvent[] = [];
  const fakeout = input.behavior.fakeouts;

  if (fakeout.enabled && random() <= clamp01(input.fakeoutChance * fakeout.chanceMultiplier)) {
    const fakeoutStartMin = Math.min(
      input.scheduledDrawAt - fakeout.latestBeforeDrawMs,
      input.fakeoutStartsAt + fakeout.earliestAfterReadyMs
    );
    const fakeoutStartMax = input.scheduledDrawAt - fakeout.latestBeforeDrawMs;
    const availableMs = fakeoutStartMax - fakeoutStartMin;

    if (availableMs > 80) {
      const count = randomInteger(fakeout.minCount, fakeout.maxCount, random);

      for (let index = 0; index < count; index += 1) {
        const durationMs = randomRange(fakeout.durationMs[0], fakeout.durationMs[1], random);
        const startsAt = randomRange(fakeoutStartMin, Math.max(fakeoutStartMin, fakeoutStartMax - durationMs), random);
        const tellType = choose(fakeout.tellTypes, random);
        const subtitleLine = fakeout.subtitleLines
          ? choose(fakeout.subtitleLines, random)
          : undefined;

        events.push({
          id: `fakeout-${index}-${Math.round(startsAt)}`,
          kind: "fakeout",
          tellType,
          startsAt,
          endsAt: startsAt + durationMs,
          intensity: randomRange(fakeout.intensity[0], fakeout.intensity[1], random),
          subtitleLine
        });
      }
    }
  }

  const realTell = input.behavior.realDrawTell;
  events.push({
    id: "real-draw-tell",
    kind: "realDrawTell",
    tellType: realTell.type,
    startsAt: input.scheduledDrawAt + realTell.delayAfterDrawMs,
    endsAt: input.scheduledDrawAt + realTell.delayAfterDrawMs + realTell.durationMs,
    intensity: realTell.intensity
  });

  const postDraw = input.behavior.postDraw;
  if (postDraw.behavior !== "holdCenter" && random() <= clamp01(postDraw.chance)) {
    events.push({
      id: "post-draw",
      kind: "postDraw",
      tellType: postDraw.behavior === "leanRight" || postDraw.behavior === "sidestepRight"
        ? "leanRight"
        : "leanLeft",
      startsAt: input.scheduledDrawAt + postDraw.startsAfterDrawMs,
      endsAt: input.scheduledDrawAt + postDraw.startsAfterDrawMs + postDraw.durationMs,
      intensity: 1,
      movementDistance: postDraw.distance
    });
  }

  const aimDisruption = input.behavior.aimDisruption;
  if (aimDisruption.behavior !== "none" && random() <= clamp01(aimDisruption.chance)) {
    events.push({
      id: "aim-disruption",
      kind: "aimDisruption",
      tellType:
        aimDisruption.behavior === "narrowTarget"
          ? "stillness"
          : aimDisruption.behavior === "sideStepRight"
            ? "leanRight"
            : "leanLeft",
      startsAt: input.scheduledDrawAt + aimDisruption.startsAfterDrawMs,
      endsAt: input.scheduledDrawAt + aimDisruption.startsAfterDrawMs + aimDisruption.durationMs,
      intensity: 1,
      movementDistance: aimDisruption.distance,
      hitZoneScaleMultiplier: aimDisruption.hitZoneScaleMultiplier
    });
  }

  return {
    behavior: input.behavior,
    roundStartedAt: input.roundStartedAt,
    scheduledDrawAt: input.scheduledDrawAt,
    events: events.sort((a, b) => a.startsAt - b.startsAt)
  };
}

export function getBehaviorInfluence(
  timeline: EnemyBehaviorTimeline,
  now: number,
  idleEnabled: boolean
): EnemyBehaviorInfluence {
  const intensities = createEmptyTellIntensities();
  const activeEvents: EnemyBehaviorEvent[] = [];
  let activeFakeout: EnemyBehaviorEvent | null = null;
  let fakeoutIntensity = 0;
  let realDrawTellIntensity = 0;
  let aimDisruptionIntensity = 0;
  let postDrawIntensity = 0;
  let leanOffset = 0;

  if (idleEnabled) {
    for (const idleTell of timeline.behavior.idle.tells) {
      const phase = now * 0.001 * idleTell.frequencyHz * Math.PI * 2;
      const pulse = idleTell.type === "stillness"
        ? idleTell.intensity
        : Math.sin(phase) * idleTell.intensity;
      intensities[idleTell.type] += pulse;
    }
  }

  for (const event of timeline.events) {
    const intensity = getEventIntensity(event, now);

    if (intensity <= 0) {
      continue;
    }

    activeEvents.push(event);
    intensities[event.tellType] += intensity;

    if (event.kind === "fakeout") {
      activeFakeout = event;
      fakeoutIntensity = Math.max(fakeoutIntensity, intensity);
    } else if (event.kind === "realDrawTell") {
      realDrawTellIntensity = Math.max(realDrawTellIntensity, intensity);
    } else if (event.kind === "aimDisruption") {
      aimDisruptionIntensity = Math.max(aimDisruptionIntensity, intensity);
    } else if (event.kind === "postDraw") {
      postDrawIntensity = Math.max(postDrawIntensity, intensity);
    }

    if (event.movementDistance !== undefined) {
      leanOffset += event.movementDistance * intensity;
    }
  }

  for (const tellType of ENEMY_TELL_TYPES) {
    intensities[tellType] = clamp(intensities[tellType], -1.5, 1.5);
  }

  return {
    intensities,
    activeEvents,
    activeFakeout,
    fakeoutIntensity,
    realDrawTellIntensity,
    aimDisruptionIntensity,
    postDrawIntensity,
    leanOffset
  };
}

export function getActiveFakeoutEvent(
  timeline: EnemyBehaviorTimeline,
  now: number
): EnemyBehaviorEvent | null {
  return timeline.events.find((event) => event.kind === "fakeout" && getEventIntensity(event, now) > 0) ?? null;
}

export function hasFakeoutStartedBefore(
  timeline: EnemyBehaviorTimeline,
  now: number
): boolean {
  return timeline.events.some((event) => event.kind === "fakeout" && event.startsAt < now);
}

export function hasAimDisruptionStartedBefore(
  timeline: EnemyBehaviorTimeline,
  now: number
): boolean {
  return timeline.events.some((event) => event.kind === "aimDisruption" && event.startsAt <= now);
}

export function getBehaviorHitZoneScaleMultiplier(
  timeline: EnemyBehaviorTimeline,
  now: number
): number {
  const baseScale = timeline.behavior.specialRule?.hitZoneScaleMultiplier ?? 1;
  const activeAimScale = timeline.events
    .filter((event) => event.hitZoneScaleMultiplier !== undefined && getEventIntensity(event, now) > 0)
    .reduce((scale, event) => scale * (event.hitZoneScaleMultiplier ?? 1), 1);

  return Math.max(0.1, baseScale * activeAimScale);
}

function getEventIntensity(event: EnemyBehaviorEvent, now: number): number {
  if (now < event.startsAt || now > event.endsAt) {
    return 0;
  }

  const duration = Math.max(1, event.endsAt - event.startsAt);
  const progress = (now - event.startsAt) / duration;
  return Math.sin(progress * Math.PI) * event.intensity;
}

function choose<T>(items: readonly T[], random: () => number): T {
  return items[Math.floor(random() * items.length)] ?? items[0];
}

function randomInteger(min: number, max: number, random: () => number): number {
  const lower = Math.min(min, max);
  const upper = Math.max(min, max);
  return Math.floor(randomRange(lower, upper + 1, random));
}

function randomRange(min: number, max: number, random: () => number): number {
  return min + random() * (max - min);
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

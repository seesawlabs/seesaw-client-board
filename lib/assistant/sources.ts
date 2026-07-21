import type { Account, Client } from "@/lib/types";

// A source "unit" pairs one or more source locations with the set of projects
// they may affect. Three tiers collapse into this one shape:
//   - project: a project's own channels/folder  → routes to just that project
//   - account: a client's shared channels/folder → routes across its projects
//   - global:  the internal SeeSaw standups       → routes across ALL projects
// Project sources override the account's for that project; the account unit
// still covers every project (a shared channel can mention any of them).

export type SlackChannel = { label: "INTERNAL" | "EXTERNAL"; id: string };
export type SlackUnit = { label: string; scope: "project" | "account"; channels: SlackChannel[]; projects: Client[] };

export function buildSlackUnits(account: Account, projects: Client[]): SlackUnit[] {
  const units: SlackUnit[] = [];
  for (const p of projects) {
    const channels: SlackChannel[] = [];
    if (p.slackInternal) channels.push({ label: "INTERNAL", id: p.slackInternal });
    if (p.slackExternal) channels.push({ label: "EXTERNAL", id: p.slackExternal });
    if (channels.length) units.push({ label: p.name, scope: "project", channels, projects: [p] });
  }
  const shared: SlackChannel[] = [];
  if (account.slackInternal) shared.push({ label: "INTERNAL", id: account.slackInternal });
  if (account.slackExternal) shared.push({ label: "EXTERNAL", id: account.slackExternal });
  if (shared.length) units.push({ label: `${account.name} (shared)`, scope: "account", channels: shared, projects });
  return units;
}

export type DriveUnit = { label: string; scope: "global" | "account" | "project"; folderId: string; nameContains: string; projects: Client[] };

/** Standup-doc source folders for an account's projects: each project's own
 *  folder (if set) routes to that project, plus the account's shared folder. */
export function buildStandupUnits(account: Account, projects: Client[]): DriveUnit[] {
  const units: DriveUnit[] = [];
  for (const p of projects) {
    if (p.driveFolderId) units.push({ label: p.name, scope: "project", folderId: p.driveFolderId, nameContains: "Daily Standup", projects: [p] });
  }
  if (account.driveFolderId) units.push({ label: account.name, scope: "account", folderId: account.driveFolderId, nameContains: "Daily Standup", projects });
  return units;
}

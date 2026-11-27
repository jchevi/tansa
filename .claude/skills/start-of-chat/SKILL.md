---
name: start-of-chat
description: Check the TANSA Jira board at the start of every chat, before any ticket work, and report what needs the owner's decision. Use first thing in a new chat, or when the owner asks where things stand.
---

# Start of chat

Run this before reading any ticket. It is a report and a list of proposals: nothing in Jira changes until the owner approves it in the chat.

The rules it checks live in `CLAUDE.md`, How to work → **Start of chat:** and **Order:**. Process tickets are the ones with the label `build-log`.

## Steps

Each step is one search in Jira (project TAN, the Jira connector) and one line of the report.

1. **Sprint:** the active sprint, its dates and its goal (`sprint in openSprints()`). If today is past its end date, propose closing it and opening the next one: 2 weeks long, starting when the last one ended, with the unfinished tickets that move into it and a draft goal. If no sprint is active, propose opening one: 2 weeks long, starting today, with the tickets the owner approves for it and a draft goal.
2. **Done with no sprint or no Fix version:** tickets in Done with no sprint, or, unless they are process tickets, with no Fix version. For each one, name the sprint whose dates contain the day it reached Done (its history, or its resolution date) and that sprint's version. Process tickets need a sprint only.
3. **Not planned in:** tickets not in Done only. A ticket is planned in when the owner chose its sprint and Fix version; a process ticket in the active sprint with no Fix version is planned in by `CLAUDE.md` → **Order:**, and any other ticket waits in the backlog with neither until the owner plans it in. Among the tickets not in Done, list process tickets outside the active sprint or with a Fix version, and other tickets with a sprint or Fix version set after the sprint started, or review-loop follow-ups (their Why names a source ticket and finding ids) that have one. Before listing one, read its comments: skip it when its latest comment starting `Start of chat: planned in` names its open sprint (or backlog) and its Fix version (or no Fix version), because the owner already confirmed it (Changes). Finished tickets are step 2. Claude works through the owner's Jira account, so Jira cannot say who set it: each one is a question to the owner, not a change. If a ticket's history cannot be read, say so and list it.
4. **WIP:** more than one ticket In Progress, or a ticket In Progress with no `TAN-<n>-*` branch (`git branch -a`).
5. **Next ticket:** the first ticket in the order of `CLAUDE.md`, How to work → **Order:**. Within its group, follow the order approved in the hand-off prompt that started the chat; the board rank matches it. If there is no such prompt, or the group has an open ticket that order does not list, review the group: compare its open tickets (dependencies, what unblocks or saves the most time on later work, risk, size) and propose an order with one reason per ticket. Once the owner approves the order, it is the order, and the rank is updated to match (Changes). If the next ticket disagrees with a story's "Order: n of 18" line, say so instead of picking one. A proposed order is one of the numbered proposals, with its reason per ticket under it, so it does not count against the report's line limit.

## Report

At most about ten lines: one line per step, "nothing to report" when a step finds nothing. Then the proposals, numbered, so the owner can answer each one.

## Changes

Make a change only after the owner approves it in the chat. Then:

- Move a ticket into a sprint or to the backlog: `transitionJiraIssue` with `sprintId` or `assignToBacklog`.
- Set or clear a Fix version: `editJiraIssue` with `fixVersions`.
- Rank tickets to the approved order: `editJiraIssue` with `rankBeforeIssue` or `rankAfterIssue`, top to bottom.
- Record that a ticket stays: when the owner answers that a step 3 ticket stays, `addOrEditJiraIssueComment` on it with `Start of chat: planned in <open sprint or backlog>, <Fix version or no Fix version>, confirmed by the owner on <date>.`
- Close, create or start a sprint: `manageJiraSprint` (`discover`, then `executeDestructive`), in this order: `create` on board 2 with the name, goal and dates; `addIssues` with the unfinished tickets; `close` on the old sprint; `start` on the new one. The tickets go in before the close so none falls into the backlog, and closing cannot be undone. With no active sprint there is none to close: `create`, then `addIssues` with the tickets the owner approved for it (if any), then `start`.

Report what changed, ticket by ticket.

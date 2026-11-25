---
name: start-of-chat
description: Check the TANSA Jira board at the start of every chat, before any ticket work, and report what needs the owner's decision. Use first thing in a new chat, or when the owner asks where things stand.
---

# Start of chat

Run this before reading any ticket. It is a report and a list of proposals: nothing in Jira changes until the owner approves it in the chat.

The rules it checks live in `CLAUDE.md`, How to work → **Start of chat:** and **Order:**. Process tickets are the ones with the label `build-log`.

## Steps

Each step is one search in Jira (project TAN, the Jira connector) and one line of the report.

1. **Sprint:** the active sprint, its dates and its goal (`sprint in openSprints()`). If today is past its end date, or no sprint is active, propose closing it and opening the next one: 2 weeks long, starting when the last one ended, with the unfinished tickets that move into it and a draft goal.
2. **Done with no sprint or no Fix version:** tickets in Done with no sprint, or, unless they are process tickets, with no Fix version. For each one, name the sprint whose dates contain the day it reached Done (its history, or its resolution date) and that sprint's version. Process tickets need a sprint only.
3. **Not planned in:** process tickets that are outside the active sprint or have a Fix version, and other tickets not in Done with a sprint or Fix version set after the sprint started, or review-loop follow-ups (their Why names a source ticket and finding ids) that have one. Claude works through the owner's Jira account, so Jira cannot say who set it: each one is a question to the owner, not a change. If a ticket's history cannot be read, say so and list it.
4. **WIP:** more than one ticket In Progress, or a ticket In Progress with no `TAN-<n>-*` branch (`git branch -a`).
5. **Next ticket:** the first ticket in the order of `CLAUDE.md`, How to work → **Order:**, by board rank (top to bottom) within each group. If it disagrees with a story's "Order: n of 18" line, say so instead of picking one.

## Report

At most about ten lines: one line per step, "nothing to report" when a step finds nothing. Then the proposals, numbered, so the owner can answer each one.

## Changes

Make a change only after the owner approves it in the chat. Then:

- Move a ticket into a sprint or to the backlog: `transitionJiraIssue` with `sprintId` or `assignToBacklog`.
- Set or clear a Fix version: `editJiraIssue` with `fixVersions`.
- Close, create or start a sprint: there is no connector call for it, so give the owner the exact steps in Jira.

Report what changed, ticket by ticket.

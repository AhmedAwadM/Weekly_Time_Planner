# Manual regression checklist

The application started as a single-file v3.6 baseline. This checklist records the core behaviors to re-check after changes.

## Planner behavior
- [ ] First-run default tasks appear only for a new/empty installation.
- [ ] Add a normal task.
- [ ] Edit a normal task.
- [ ] Delete a task and test Undo if available.
- [ ] Add a parallel task and verify it does not consume extra hours.
- [ ] Link a parallel task to a main task.
- [ ] Test a timed task crossing midnight.
- [ ] Check duration and timeline views.
- [ ] Check weekly hour totals and overbooking/conflict warnings.
- [ ] Check priority labels/colors.

## Data safety
- [ ] Export JSON.
- [ ] Import the exported JSON into a clean browser profile.
- [ ] Reject an invalid JSON file without replacing current data.
- [ ] Confirm the app's local data survives reload/reopen.
- [ ] Confirm personal JSON files are ignored by Git.
- [ ] Verify no personal data is present in the GitHub repository.

## PWA / GitHub Pages
- [ ] Manifest loads successfully.
- [ ] Service worker registers on the HTTPS Pages URL.
- [ ] App shell loads offline after one successful online visit.
- [ ] Install / Add to Home Screen works where supported.
- [ ] New app release updates the service-worker cache version.
- [ ] Project-site paths work under `/weekly-time-planner/`, not only at `/`.

## Responsive UI
- [ ] Test desktop width.
- [ ] Test tablet width.
- [ ] Test narrow mobile width.
- [ ] Check Arabic RTL layout, dialogs, menus, and horizontal week-table scrolling.

## v3.8 layout and data menu
- [ ] Confirm all seven days appear as vertically stacked cards in duration view.
- [ ] Confirm all seven days remain vertically stacked when parallel tasks are visible.
- [ ] Confirm all seven days remain vertically stacked in timeline view.
- [ ] Confirm data menu has exactly four actions: Import, Export, Link Save File, Reset Tasks.
- [ ] Confirm Link Save File offers choosing an existing JSON file or creating a new one.

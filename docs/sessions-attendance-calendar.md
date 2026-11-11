# Sessions and attendance calendar

Admins and coaches can open **Club operations → Sessions & attendance** and switch between Calendar and List. The calendar opens on the current month. Previous/next, Today and the month picker allow navigation to older or future dates. Search filters session titles and lifecycle status in either view.

Select any date to open its details popup. Dates with multiple sessions show a session selector, times and status. The selected session shows location, duration, change reason, RSVP responses and athlete attendance. Admins and coaches can record attendance or use the existing reschedule, cancel, restore and complete controls from the popup. Cancellation still disables attendance changes. An empty date shows an explicit empty state.

The popup uses the shared accessible dialog with bounded height, scrolling, focus containment and Escape handling. Attendance is saved immediately; closing does not prompt to discard already saved check-ins. Session lifecycle forms retain their existing unsaved-change confirmation.

Dates and times use the device timezone, shown above the calendar. The calendar queries the entire visible grid, including adjacent-month dates, using UTC boundaries. A bounded range avoids the legacy list's latest-500 limit. Daylight-saving offset transitions are allowed. The existing club and role authorization checks apply to range queries too.

Attendance totals describe the selected session's active assigned athletes. Not recorded is separate from absent, no show and RSVP. These figures are not workout completion statistics.

No schema changes, migrations or new dependencies are needed. Deploy both frontend and backend updates. Automated checks cover local-midnight grouping, year and DST boundaries, range query permissions, date selection, role views, error states and attendance totals. Live browser and real MySQL acceptance checks remain deployment checks; no database state was changed during implementation.

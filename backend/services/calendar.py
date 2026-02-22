from datetime import datetime, timezone, timedelta
from typing import List, Optional
import uuid
import caldav
from icalendar import Calendar as ICalendar, Event as ICalEvent
from db import db, logger


async def get_caldav_client():
    """Get CalDAV client with stored credentials"""
    settings = await db.calendar_settings.find_one({"id": "default"})
    if not settings or not settings.get("apple_calendar_password"):
        return None, None

    url = settings.get("apple_calendar_url") or "https://caldav.icloud.com"
    username = settings.get("apple_calendar_user")
    password = settings.get("apple_calendar_password")

    if not username or not password:
        return None, None

    try:
        dav_client = caldav.DAVClient(url=url, username=username, password=password)
        principal = dav_client.principal()
        calendars = principal.calendars()

        booking_calendar_name = settings.get("booking_calendar", "")
        target_calendar = None

        for cal in calendars:
            cal_name = cal.name.lower() if cal.name else ""
            if booking_calendar_name and cal.name == booking_calendar_name:
                target_calendar = cal
                break
            if "silwer" in cal_name or "photography" in cal_name or "booking" in cal_name or "work" in cal_name:
                target_calendar = cal
                break

        if not target_calendar and calendars:
            target_calendar = calendars[0]

        return dav_client, target_calendar
    except Exception as e:
        logger.error(f"CalDAV connection error: {e}")
        return None, None


async def get_all_caldav_calendars():
    """Get all CalDAV calendars for the user"""
    settings = await db.calendar_settings.find_one({"id": "default"})
    if not settings or not settings.get("apple_calendar_password"):
        return []

    url = settings.get("apple_calendar_url") or "https://caldav.icloud.com"
    username = settings.get("apple_calendar_user")
    password = settings.get("apple_calendar_password")

    if not username or not password:
        return []

    try:
        dav_client = caldav.DAVClient(url=url, username=username, password=password)
        principal = dav_client.principal()
        calendars = principal.calendars()
        return [{"name": cal.name, "id": str(cal.id)} for cal in calendars]
    except Exception as e:
        logger.error(f"Failed to get calendars: {e}")
        return []


async def get_events_from_all_calendars(start_date: datetime, end_date: datetime) -> List[dict]:
    """Fetch events from ALL calendars (personal + work)"""
    settings = await db.calendar_settings.find_one({"id": "default"})
    if not settings or not settings.get("apple_calendar_password"):
        return []

    url = settings.get("apple_calendar_url") or "https://caldav.icloud.com"
    username = settings.get("apple_calendar_user")
    password = settings.get("apple_calendar_password")
    booking_calendar = settings.get("booking_calendar", "")

    if not username or not password:
        return []

    all_events = []
    try:
        dav_client = caldav.DAVClient(url=url, username=username, password=password)
        principal = dav_client.principal()
        calendars = principal.calendars()

        for calendar in calendars:
            try:
                cal_events = calendar.search(start=start_date, end=end_date, expand=True)
                for event in cal_events:
                    ical = event.icalendar_component
                    for component in ical.walk():
                        if component.name == "VEVENT":
                            summary = str(component.get('summary', 'Personal Event'))
                            if '\U0001f4f8' in summary or 'silwerlining' in summary.lower():
                                continue
                            dtstart = component.get('dtstart')
                            dtend = component.get('dtend')
                            if dtstart:
                                start_str = dtstart.dt.isoformat() if hasattr(dtstart.dt, 'isoformat') else f"{dtstart.dt}T00:00:00"
                                end_str = dtend.dt.isoformat() if dtend and hasattr(dtend.dt, 'isoformat') else (f"{dtend.dt}T23:59:59" if dtend else start_str)
                                all_events.append({
                                    "summary": summary,
                                    "start": start_str,
                                    "end": end_str,
                                    "calendar_name": calendar.name,
                                    "is_work_calendar": calendar.name == booking_calendar
                                })
            except Exception as e:
                logger.error(f"Failed to fetch events from calendar {calendar.name}: {e}")
                continue

        return all_events
    except Exception as e:
        logger.error(f"Failed to connect to CalDAV: {e}")
        return []


async def get_booking_calendar():
    """Get the calendar designated for creating bookings"""
    settings = await db.calendar_settings.find_one({"id": "default"})
    if not settings or not settings.get("apple_calendar_password"):
        return None

    url = settings.get("apple_calendar_url") or "https://caldav.icloud.com"
    username = settings.get("apple_calendar_user")
    password = settings.get("apple_calendar_password")
    booking_calendar_name = settings.get("booking_calendar", "")

    if not username or not password:
        return None

    try:
        dav_client = caldav.DAVClient(url=url, username=username, password=password)
        principal = dav_client.principal()
        calendars = principal.calendars()
        for cal in calendars:
            if booking_calendar_name and cal.name == booking_calendar_name:
                return cal
        return calendars[0] if calendars else None
    except Exception as e:
        logger.error(f"Failed to get booking calendar: {e}")
        return None


async def create_calendar_event(booking: dict) -> Optional[str]:
    """Create a calendar event for a booking"""
    settings = await db.calendar_settings.find_one({"id": "default"})
    if not settings or not settings.get("sync_enabled"):
        return None

    calendar = await get_booking_calendar()
    if not calendar:
        logger.warning("No calendar available for sync")
        return None

    try:
        booking_date = datetime.strptime(booking["booking_date"], "%Y-%m-%d")
        time_parts = booking["booking_time"].replace("AM", "").replace("PM", "").strip().split(":")
        hour = int(time_parts[0])
        minute = int(time_parts[1]) if len(time_parts) > 1 else 0
        if "PM" in booking["booking_time"] and hour != 12:
            hour += 12
        elif "AM" in booking["booking_time"] and hour == 12:
            hour = 0

        start_dt = booking_date.replace(hour=hour, minute=minute, tzinfo=timezone.utc)
        end_dt = start_dt + timedelta(hours=2)

        cal = ICalendar()
        cal.add('prodid', '-//Silwer Lining Photography//Booking System//EN')
        cal.add('version', '2.0')

        event = ICalEvent()
        event_uid = f"booking-{booking['id']}@silwerlining.co.za"
        event.add('uid', event_uid)
        event.add('dtstart', start_dt)
        event.add('dtend', end_dt)
        event.add('summary', f"\U0001f4f8 {booking['session_type'].title()} Session - {booking['client_name']}")
        event.add('description', f"Client: {booking['client_name']}\nEmail: {booking['client_email']}\nPhone: {booking['client_phone']}\nPackage: {booking['package_name']}\nTotal: R{booking.get('total_price', 0):,.0f}\nNotes: {booking.get('notes', 'None')}")
        event.add('location', 'Silwer Lining Photography Studio, Helderkruin, Roodepoort')
        cal.add_component(event)

        calendar.save_event(cal.to_ical().decode('utf-8'))
        logger.info(f"Calendar event created for booking {booking['id']} on calendar: {calendar.name}")
        return event_uid
    except Exception as e:
        logger.error(f"Failed to create calendar event: {e}")
        return None


async def delete_calendar_event(event_uid: str):
    """Delete a calendar event"""
    settings = await db.calendar_settings.find_one({"id": "default"})
    if not settings or not settings.get("sync_enabled"):
        return False

    _, calendar = await get_caldav_client()
    if not calendar:
        return False

    try:
        events = calendar.search(uid=event_uid)
        for event in events:
            event.delete()
            logger.info(f"Calendar event deleted: {event_uid}")
        return True
    except Exception as e:
        logger.error(f"Failed to delete calendar event: {e}")
        return False


async def get_blocked_times_from_calendar(date_str: str) -> List[dict]:
    """Get blocked times from calendar for a specific date"""
    settings = await db.calendar_settings.find_one({"id": "default"})
    if not settings or not settings.get("sync_enabled"):
        return []

    _, calendar = await get_caldav_client()
    if not calendar:
        return []

    try:
        date = datetime.strptime(date_str, "%Y-%m-%d")
        start = date.replace(hour=0, minute=0, second=0, tzinfo=timezone.utc)
        end = date.replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)

        events = calendar.search(start=start, end=end, expand=True)
        blocked = []
        for event in events:
            ical = event.icalendar_component
            for component in ical.walk():
                if component.name == "VEVENT":
                    dtstart = component.get('dtstart')
                    dtend = component.get('dtend')
                    if dtstart and dtend:
                        blocked.append({
                            "start": dtstart.dt.isoformat() if hasattr(dtstart.dt, 'isoformat') else str(dtstart.dt),
                            "end": dtend.dt.isoformat() if hasattr(dtend.dt, 'isoformat') else str(dtend.dt),
                            "summary": str(component.get('summary', 'Busy'))
                        })
        return blocked
    except Exception as e:
        logger.error(f"Failed to get calendar events: {e}")
        return []


async def get_calendar_blocked_times(date_str: str, time_slots: List[str]) -> List[str]:
    """Check which time slots are blocked by calendar events from ALL calendars"""
    settings = await db.calendar_settings.find_one({"id": "default"})
    if not settings or not settings.get("sync_enabled"):
        return []

    blocked_slots = []
    try:
        date = datetime.strptime(date_str, "%Y-%m-%d")
        requested_date = date.date()
        start_of_day = date.replace(hour=0, minute=0, second=0, tzinfo=timezone.utc)
        end_of_day = date.replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)

        cal_events_raw = await get_events_from_all_calendars(start_of_day, end_of_day)
        calendar_events = []

        for evt in cal_events_raw:
            summary = evt.get("summary", "")
            if '\U0001f4f8' in summary or 'silwerlining' in summary.lower():
                continue
            try:
                evt_start = datetime.fromisoformat(evt["start"].replace("Z", "+00:00"))
                evt_end = datetime.fromisoformat(evt["end"].replace("Z", "+00:00"))

                if not hasattr(evt_start, 'hour') or (evt_start.hour == 0 and evt_start.minute == 0 and evt_end.hour == 0 and evt_end.minute == 0):
                    event_start_date = evt_start.date() if hasattr(evt_start, 'date') else evt_start
                    event_end_date = evt_end.date() if hasattr(evt_end, 'date') else evt_end
                    if event_start_date <= requested_date < event_end_date:
                        return time_slots

                event_start_date = evt_start.date()
                event_end_date = evt_end.date()

                if event_start_date == event_end_date == requested_date:
                    block_start_hour, block_start_min = evt_start.hour, evt_start.minute
                    block_end_hour, block_end_min = evt_end.hour, evt_end.minute
                elif event_start_date == requested_date:
                    block_start_hour, block_start_min = evt_start.hour, evt_start.minute
                    block_end_hour, block_end_min = 23, 59
                elif event_end_date == requested_date:
                    block_start_hour, block_start_min = 0, 0
                    block_end_hour, block_end_min = evt_end.hour, evt_end.minute
                elif event_start_date < requested_date < event_end_date:
                    return time_slots
                else:
                    continue

                calendar_events.append({
                    "start_hour": block_start_hour, "start_minute": block_start_min,
                    "end_hour": block_end_hour, "end_minute": block_end_min
                })
            except Exception as e:
                logger.error(f"Error processing calendar event: {e}")
                continue

        for time_slot in time_slots:
            slot_hour, slot_minute = parse_time_slot(time_slot)
            if slot_hour is None:
                continue
            slot_end_hour = slot_hour + 2
            for evt in calendar_events:
                evt_start = evt["start_hour"] * 60 + evt["start_minute"]
                evt_end = evt["end_hour"] * 60 + evt["end_minute"]
                slot_start = slot_hour * 60 + slot_minute
                slot_end = slot_end_hour * 60 + slot_minute
                if not (slot_end <= evt_start or slot_start >= evt_end):
                    blocked_slots.append(time_slot)
                    break

        return blocked_slots
    except Exception as e:
        logger.error(f"Failed to check calendar blocked times: {e}")
        return []


def parse_time_slot(time_str: str) -> tuple:
    """Parse a time slot string into hour and minute"""
    try:
        time_str = time_str.strip().upper()
        is_pm = "PM" in time_str
        is_am = "AM" in time_str
        time_str = time_str.replace("AM", "").replace("PM", "").strip()
        parts = time_str.split(":")
        hour = int(parts[0])
        minute = int(parts[1]) if len(parts) > 1 else 0
        if is_pm and hour != 12:
            hour += 12
        elif is_am and hour == 12:
            hour = 0
        return hour, minute
    except:
        return None, None


async def refresh_calendar_cache():
    """Refresh the calendar events cache in MongoDB. Called by background scheduler."""
    settings = await db.calendar_settings.find_one({"id": "default"})
    if not settings or not settings.get("sync_enabled"):
        return

    try:
        now = datetime.now(timezone.utc)
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end = start + timedelta(days=120)

        cal_events = await get_events_from_all_calendars(start, end)

        await db.calendar_events_cache.update_one(
            {"id": "default"},
            {"$set": {
                "id": "default",
                "events": cal_events,
                "refreshed_at": now.isoformat(),
                "range_start": start.isoformat(),
                "range_end": end.isoformat()
            }},
            upsert=True
        )
        logger.info(f"Calendar cache refreshed: {len(cal_events)} events cached")
    except Exception as e:
        logger.error(f"Failed to refresh calendar cache: {e}")


async def get_cached_calendar_blocked_times(start_date: str, end_date: str) -> dict:
    """Get blocked time slots per date from cached calendar events. Returns {date_str: [blocked_slots]}"""
    settings = await db.calendar_settings.find_one({"id": "default"})
    if not settings or not settings.get("sync_enabled"):
        return {}

    cache = await db.calendar_events_cache.find_one({"id": "default"}, {"_id": 0})

    # If no cache or stale (>15 min), refresh in-place
    if not cache or not cache.get("refreshed_at"):
        await refresh_calendar_cache()
        cache = await db.calendar_events_cache.find_one({"id": "default"}, {"_id": 0})
    else:
        refreshed = datetime.fromisoformat(cache["refreshed_at"].replace("Z", "+00:00"))
        if (datetime.now(timezone.utc) - refreshed) > timedelta(minutes=15):
            await refresh_calendar_cache()
            cache = await db.calendar_events_cache.find_one({"id": "default"}, {"_id": 0})

    if not cache or not cache.get("events"):
        return {}

    # Build a map of date -> list of blocked hour ranges
    cal_events_by_date = {}
    for evt in cache["events"]:
        summary = evt.get("summary", "")
        if '\U0001f4f8' in summary or 'silwerlining' in summary.lower():
            continue
        try:
            evt_start = datetime.fromisoformat(evt["start"].replace("Z", "+00:00"))
            evt_end = datetime.fromisoformat(evt["end"].replace("Z", "+00:00"))
            current = evt_start.date()
            end_d = evt_end.date()
            while current <= end_d:
                ds = current.strftime("%Y-%m-%d")
                if ds < start_date or ds > end_date:
                    current += timedelta(days=1)
                    continue
                if current == evt_start.date() and current == evt_end.date():
                    sh, sm, eh, em = evt_start.hour, evt_start.minute, evt_end.hour, evt_end.minute
                elif current == evt_start.date():
                    sh, sm, eh, em = evt_start.hour, evt_start.minute, 23, 59
                elif current == evt_end.date():
                    sh, sm, eh, em = 0, 0, evt_end.hour, evt_end.minute
                else:
                    sh, sm, eh, em = 0, 0, 23, 59
                cal_events_by_date.setdefault(ds, []).append({"sh": sh, "sm": sm, "eh": eh, "em": em})
                current += timedelta(days=1)
        except Exception:
            continue

    # Now we need to know what time slots exist to check. Get booking settings.
    bsettings = await db.booking_settings.find_one({"id": "default"}, {"_id": 0})
    if not bsettings:
        return {}
    time_slot_schedule = bsettings.get("time_slot_schedule", {})

    # Collect all possible time slots across all session types/days
    all_slots = set()
    for st, sched in time_slot_schedule.items():
        for day_id, slots in sched.items():
            all_slots.update(slots)

    # For each date with calendar events, check which slots overlap
    result = {}
    for ds, ranges in cal_events_by_date.items():
        blocked = []
        for slot in all_slots:
            sh, sm = parse_time_slot(slot)
            if sh is None:
                continue
            slot_start = sh * 60 + sm
            slot_end = (sh + 2) * 60 + sm
            for r in ranges:
                es = r["sh"] * 60 + r["sm"]
                ee = r["eh"] * 60 + r["em"]
                if not (slot_end <= es or slot_start >= ee):
                    blocked.append(slot)
                    break
        if blocked:
            result[ds] = blocked

    return result

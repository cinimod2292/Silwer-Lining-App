"""
Test suite for Admin Calendar View and Manual Booking features
- Admin calendar view endpoint
- Blocked slots CRUD
- Manual booking creation with token
- Client booking completion via token
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@silwerlining.com"
ADMIN_PASSWORD = "Admin123!"


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/admin/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Admin login failed: {response.status_code} - {response.text}")


@pytest.fixture
def auth_headers(admin_token):
    """Get headers with auth token"""
    return {"Authorization": f"Bearer {admin_token}"}


class TestAdminCalendarView:
    """Tests for Admin Calendar View endpoint"""
    
    def test_calendar_view_requires_auth(self):
        """Calendar view should require authentication"""
        today = datetime.now().strftime("%Y-%m-%d")
        end_date = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
        
        response = requests.get(f"{BASE_URL}/api/admin/calendar-view", params={
            "start_date": today,
            "end_date": end_date
        })
        assert response.status_code == 403 or response.status_code == 401, \
            f"Expected 401/403, got {response.status_code}"
    
    def test_calendar_view_returns_events(self, auth_headers):
        """Calendar view should return events array"""
        today = datetime.now().strftime("%Y-%m-%d")
        end_date = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
        
        response = requests.get(f"{BASE_URL}/api/admin/calendar-view", params={
            "start_date": today,
            "end_date": end_date
        }, headers=auth_headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "events" in data, "Response should contain 'events' key"
        assert isinstance(data["events"], list), "Events should be a list"
    
    def test_calendar_view_event_structure(self, auth_headers):
        """Calendar events should have proper structure for FullCalendar"""
        today = datetime.now().strftime("%Y-%m-%d")
        end_date = (datetime.now() + timedelta(days=60)).strftime("%Y-%m-%d")
        
        response = requests.get(f"{BASE_URL}/api/admin/calendar-view", params={
            "start_date": today,
            "end_date": end_date
        }, headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # If there are events, check their structure
        if data["events"]:
            event = data["events"][0]
            # FullCalendar required fields
            assert "id" in event, "Event should have 'id'"
            assert "title" in event, "Event should have 'title'"
            assert "start" in event, "Event should have 'start'"
            # Optional but expected fields
            if "extendedProps" in event:
                assert "type" in event["extendedProps"], "extendedProps should have 'type'"


class TestBlockedSlots:
    """Tests for Blocked Slots CRUD operations"""
    
    def test_create_blocked_slot(self, auth_headers):
        """Admin should be able to create a blocked slot"""
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        
        response = requests.post(f"{BASE_URL}/api/admin/blocked-slots", json={
            "date": tomorrow,
            "time": "10:00",
            "reason": "TEST_Blocked for testing"
        }, headers=auth_headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "id" in data, "Response should contain slot id"
        assert "message" in data, "Response should contain message"
        
        # Store for cleanup
        return data.get("id")
    
    def test_blocked_slot_appears_in_calendar(self, auth_headers):
        """Blocked slot should appear in calendar view"""
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        
        # Create a blocked slot
        create_response = requests.post(f"{BASE_URL}/api/admin/blocked-slots", json={
            "date": tomorrow,
            "time": "11:00",
            "reason": "TEST_Calendar test block"
        }, headers=auth_headers)
        
        assert create_response.status_code == 200
        slot_id = create_response.json().get("id")
        
        # Check calendar view
        response = requests.get(f"{BASE_URL}/api/admin/calendar-view", params={
            "start_date": tomorrow,
            "end_date": tomorrow
        }, headers=auth_headers)
        
        assert response.status_code == 200
        events = response.json()["events"]
        
        # Find the blocked slot
        blocked_events = [e for e in events if e.get("extendedProps", {}).get("type") == "blocked"]
        assert len(blocked_events) > 0, "Blocked slot should appear in calendar"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/admin/blocked-slots/{slot_id}", headers=auth_headers)
    
    def test_delete_blocked_slot(self, auth_headers):
        """Admin should be able to delete a blocked slot"""
        tomorrow = (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d")
        
        # Create a slot first
        create_response = requests.post(f"{BASE_URL}/api/admin/blocked-slots", json={
            "date": tomorrow,
            "time": "14:00",
            "reason": "TEST_To be deleted"
        }, headers=auth_headers)
        
        assert create_response.status_code == 200
        slot_id = create_response.json().get("id")
        
        # Delete the slot
        delete_response = requests.delete(
            f"{BASE_URL}/api/admin/blocked-slots/{slot_id}",
            headers=auth_headers
        )
        
        assert delete_response.status_code == 200, f"Expected 200, got {delete_response.status_code}"
    
    def test_delete_nonexistent_slot_returns_404(self, auth_headers):
        """Deleting non-existent slot should return 404"""
        response = requests.delete(
            f"{BASE_URL}/api/admin/blocked-slots/nonexistent-id-12345",
            headers=auth_headers
        )
        assert response.status_code == 404


class TestManualBooking:
    """Tests for Manual Booking creation flow"""
    
    def test_create_manual_booking(self, auth_headers):
        """Admin should be able to create a manual booking"""
        booking_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        
        response = requests.post(f"{BASE_URL}/api/admin/manual-booking", json={
            "client_name": "TEST_Manual Client",
            "client_email": "test_manual@example.com",
            "client_phone": "+27123456789",
            "session_type": "maternity",
            "booking_date": booking_date,
            "booking_time": "10:00",
            "notes": "Test manual booking"
        }, headers=auth_headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "booking_id" in data, "Response should contain booking_id"
        assert "token" in data, "Response should contain token"
        assert "booking_link" in data, "Response should contain booking_link"
        
        # Verify booking link format
        assert "/complete-booking/" in data["booking_link"], "Booking link should contain /complete-booking/"
        
        return data
    
    def test_manual_booking_creates_awaiting_client_status(self, auth_headers):
        """Manual booking should have 'awaiting_client' status"""
        booking_date = (datetime.now() + timedelta(days=8)).strftime("%Y-%m-%d")
        
        # Create manual booking
        create_response = requests.post(f"{BASE_URL}/api/admin/manual-booking", json={
            "client_name": "TEST_Status Check Client",
            "client_email": "test_status@example.com",
            "session_type": "newborn",
            "booking_date": booking_date,
            "booking_time": "14:00"
        }, headers=auth_headers)
        
        assert create_response.status_code == 200
        booking_id = create_response.json()["booking_id"]
        
        # Get the booking to verify status
        booking_response = requests.get(
            f"{BASE_URL}/api/admin/bookings/{booking_id}",
            headers=auth_headers
        )
        
        assert booking_response.status_code == 200
        booking = booking_response.json()
        assert booking["status"] == "awaiting_client", f"Expected 'awaiting_client', got '{booking['status']}'"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/admin/bookings/{booking_id}", headers=auth_headers)
    
    def test_manual_booking_appears_in_calendar(self, auth_headers):
        """Manual booking should appear in calendar view with purple color"""
        booking_date = (datetime.now() + timedelta(days=9)).strftime("%Y-%m-%d")
        
        # Create manual booking
        create_response = requests.post(f"{BASE_URL}/api/admin/manual-booking", json={
            "client_name": "TEST_Calendar Client",
            "client_email": "test_calendar@example.com",
            "session_type": "family",
            "booking_date": booking_date,
            "booking_time": "09:00"
        }, headers=auth_headers)
        
        assert create_response.status_code == 200
        booking_id = create_response.json()["booking_id"]
        
        # Check calendar view
        calendar_response = requests.get(f"{BASE_URL}/api/admin/calendar-view", params={
            "start_date": booking_date,
            "end_date": booking_date
        }, headers=auth_headers)
        
        assert calendar_response.status_code == 200
        events = calendar_response.json()["events"]
        
        # Find the booking event
        booking_events = [e for e in events if e.get("extendedProps", {}).get("bookingId") == booking_id]
        assert len(booking_events) == 1, "Manual booking should appear in calendar"
        
        event = booking_events[0]
        assert event["extendedProps"]["status"] == "awaiting_client"
        assert event["backgroundColor"] == "#8B5CF6", "Awaiting client should be purple"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/admin/bookings/{booking_id}", headers=auth_headers)


class TestBookingToken:
    """Tests for Booking Token and Client Completion flow"""
    
    def test_get_booking_by_valid_token(self, auth_headers):
        """Client should be able to access booking via valid token"""
        booking_date = (datetime.now() + timedelta(days=10)).strftime("%Y-%m-%d")
        
        # Create manual booking
        create_response = requests.post(f"{BASE_URL}/api/admin/manual-booking", json={
            "client_name": "TEST_Token Client",
            "client_email": "test_token@example.com",
            "session_type": "maternity",
            "booking_date": booking_date,
            "booking_time": "10:00"
        }, headers=auth_headers)
        
        assert create_response.status_code == 200
        token = create_response.json()["token"]
        booking_id = create_response.json()["booking_id"]
        
        # Access booking via token (public endpoint - no auth)
        token_response = requests.get(f"{BASE_URL}/api/booking-token/{token}")
        
        assert token_response.status_code == 200, f"Expected 200, got {token_response.status_code}: {token_response.text}"
        data = token_response.json()
        
        # Verify response structure
        assert "booking" in data, "Response should contain booking"
        assert "packages" in data, "Response should contain packages"
        assert "addons" in data, "Response should contain addons"
        
        # Verify booking data
        assert data["booking"]["client_name"] == "TEST_Token Client"
        assert data["booking"]["session_type"] == "maternity"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/admin/bookings/{booking_id}", headers=auth_headers)
    
    def test_invalid_token_returns_404(self):
        """Invalid token should return 404"""
        response = requests.get(f"{BASE_URL}/api/booking-token/invalid-token-12345")
        assert response.status_code == 404
    
    def test_complete_booking_via_token(self, auth_headers):
        """Client should be able to complete booking via token"""
        booking_date = (datetime.now() + timedelta(days=11)).strftime("%Y-%m-%d")
        
        # Create manual booking
        create_response = requests.post(f"{BASE_URL}/api/admin/manual-booking", json={
            "client_name": "TEST_Complete Client",
            "client_email": "test_complete@example.com",
            "session_type": "maternity",
            "booking_date": booking_date,
            "booking_time": "11:00"
        }, headers=auth_headers)
        
        assert create_response.status_code == 200
        token = create_response.json()["token"]
        booking_id = create_response.json()["booking_id"]
        
        # Complete the booking (public endpoint - no auth)
        complete_response = requests.post(f"{BASE_URL}/api/booking-token/{token}/complete", json={
            "package_id": "test-package-id",
            "package_name": "Maternity Classic",
            "package_price": 3500,
            "selected_addons": [],
            "addons_total": 0,
            "total_price": 3500,
            "client_phone": "+27987654321",
            "notes": "Test completion",
            "questionnaire_responses": {
                "due_date": "2026-06-15",
                "first_baby": "Yes"
            }
        })
        
        assert complete_response.status_code == 200, f"Expected 200, got {complete_response.status_code}: {complete_response.text}"
        data = complete_response.json()
        
        assert "booking" in data, "Response should contain updated booking"
        assert data["booking"]["status"] == "confirmed", "Status should be 'confirmed' after completion"
        assert data["booking"]["package_name"] == "Maternity Classic"
        assert data["booking"]["total_price"] == 3500
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/admin/bookings/{booking_id}", headers=auth_headers)
    
    def test_token_cannot_be_used_twice(self, auth_headers):
        """Token should be marked as used after completion"""
        booking_date = (datetime.now() + timedelta(days=12)).strftime("%Y-%m-%d")
        
        # Create manual booking
        create_response = requests.post(f"{BASE_URL}/api/admin/manual-booking", json={
            "client_name": "TEST_Double Use Client",
            "client_email": "test_double@example.com",
            "session_type": "newborn",
            "booking_date": booking_date,
            "booking_time": "15:00"
        }, headers=auth_headers)
        
        assert create_response.status_code == 200
        token = create_response.json()["token"]
        booking_id = create_response.json()["booking_id"]
        
        # Complete the booking first time
        first_complete = requests.post(f"{BASE_URL}/api/booking-token/{token}/complete", json={
            "package_id": "test-pkg",
            "package_name": "Newborn Basic",
            "package_price": 2500,
            "total_price": 2500
        })
        assert first_complete.status_code == 200
        
        # Try to use token again
        second_complete = requests.post(f"{BASE_URL}/api/booking-token/{token}/complete", json={
            "package_id": "test-pkg-2",
            "package_name": "Different Package",
            "package_price": 5000,
            "total_price": 5000
        })
        
        assert second_complete.status_code == 400, "Second use of token should fail"
        assert "already been used" in second_complete.json().get("detail", "").lower()
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/admin/bookings/{booking_id}", headers=auth_headers)


class TestExistingToken:
    """Test with the existing token mentioned in the context"""
    
    def test_existing_token_access(self):
        """Test access to the existing test token"""
        existing_token = "3eee0e97-a72c-43a3-ab5b-bc9f3efcd08c"
        
        response = requests.get(f"{BASE_URL}/api/booking-token/{existing_token}")
        
        # Token might be valid or already used
        if response.status_code == 200:
            data = response.json()
            assert "booking" in data
            print(f"Token is valid. Booking: {data['booking']['client_name']}")
        elif response.status_code == 400:
            # Token already used
            assert "already been used" in response.json().get("detail", "").lower() or \
                   "expired" in response.json().get("detail", "").lower()
            print("Token has already been used or expired")
        else:
            # Token not found
            assert response.status_code == 404
            print("Token not found (may have been cleaned up)")


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_bookings(self, auth_headers):
        """Clean up any TEST_ prefixed bookings"""
        # Get all bookings
        response = requests.get(f"{BASE_URL}/api/admin/bookings", headers=auth_headers)
        
        if response.status_code == 200:
            bookings = response.json()
            for booking in bookings:
                if booking.get("client_name", "").startswith("TEST_"):
                    requests.delete(
                        f"{BASE_URL}/api/admin/bookings/{booking['id']}",
                        headers=auth_headers
                    )
                    print(f"Cleaned up booking: {booking['client_name']}")

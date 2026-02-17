"""
Test suite for Silwer Lining Photography Admin Features
Tests: Admin login, Packages CRUD, Booking Settings, Calendar Settings, Bookings Management
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://portrait-studio-48.preview.emergentagent.com').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@silwerlining.com"
ADMIN_PASSWORD = "Admin123!"


class TestAdminAuth:
    """Admin authentication tests"""
    
    def test_admin_login_success(self):
        """Test admin login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/admin/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "name" in data
        assert "email" in data
        assert data["email"] == ADMIN_EMAIL
        assert len(data["token"]) > 0
    
    def test_admin_login_invalid_credentials(self):
        """Test admin login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/admin/login", json={
            "email": "wrong@example.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
    
    def test_admin_me_with_valid_token(self, auth_token):
        """Test /admin/me endpoint with valid token"""
        response = requests.get(f"{BASE_URL}/api/admin/me", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert "name" in data
        assert "email" in data
    
    def test_admin_me_without_token(self):
        """Test /admin/me endpoint without token"""
        response = requests.get(f"{BASE_URL}/api/admin/me")
        assert response.status_code in [401, 403]


class TestPackagesManagement:
    """Packages CRUD tests"""
    
    def test_get_admin_packages(self, auth_token):
        """Test fetching packages list"""
        response = requests.get(f"{BASE_URL}/api/admin/packages", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Should have default packages seeded
        assert len(data) > 0
        # Verify package structure
        if len(data) > 0:
            pkg = data[0]
            assert "id" in pkg
            assert "name" in pkg
            assert "session_type" in pkg
            assert "price" in pkg
            assert "duration" in pkg
    
    def test_create_package(self, auth_token):
        """Test creating a new package"""
        package_data = {
            "name": "TEST_Premium Package",
            "session_type": "maternity",
            "price": 9999,
            "duration": "3-4 hours",
            "includes": ["Test item 1", "Test item 2"],
            "description": "Test package description",
            "popular": False,
            "active": True
        }
        response = requests.post(f"{BASE_URL}/api/admin/packages", 
            json=package_data,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == package_data["name"]
        assert data["price"] == package_data["price"]
        assert "id" in data
        return data["id"]
    
    def test_update_package(self, auth_token):
        """Test updating a package"""
        # First create a package
        create_data = {
            "name": "TEST_Update Package",
            "session_type": "newborn",
            "price": 5000,
            "duration": "2 hours",
            "includes": ["Item 1"],
            "description": "Original description",
            "popular": False,
            "active": True
        }
        create_response = requests.post(f"{BASE_URL}/api/admin/packages",
            json=create_data,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert create_response.status_code == 200
        package_id = create_response.json()["id"]
        
        # Update the package
        update_data = {
            "name": "TEST_Updated Package Name",
            "session_type": "newborn",
            "price": 6000,
            "duration": "3 hours",
            "includes": ["Item 1", "Item 2"],
            "description": "Updated description",
            "popular": True,
            "active": True
        }
        update_response = requests.put(f"{BASE_URL}/api/admin/packages/{package_id}",
            json=update_data,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert update_response.status_code == 200
        
        # Verify update by fetching packages
        get_response = requests.get(f"{BASE_URL}/api/admin/packages",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        packages = get_response.json()
        updated_pkg = next((p for p in packages if p["id"] == package_id), None)
        assert updated_pkg is not None
        assert updated_pkg["name"] == update_data["name"]
        assert updated_pkg["price"] == update_data["price"]
    
    def test_delete_package(self, auth_token):
        """Test deleting a package"""
        # First create a package to delete
        create_data = {
            "name": "TEST_Delete Package",
            "session_type": "studio",
            "price": 3000,
            "duration": "1 hour",
            "includes": ["Item"],
            "description": "To be deleted",
            "popular": False,
            "active": True
        }
        create_response = requests.post(f"{BASE_URL}/api/admin/packages",
            json=create_data,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert create_response.status_code == 200
        package_id = create_response.json()["id"]
        
        # Delete the package
        delete_response = requests.delete(f"{BASE_URL}/api/admin/packages/{package_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert delete_response.status_code == 200
        
        # Verify deletion
        get_response = requests.get(f"{BASE_URL}/api/admin/packages",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        packages = get_response.json()
        deleted_pkg = next((p for p in packages if p["id"] == package_id), None)
        assert deleted_pkg is None


class TestBookingSettings:
    """Booking settings tests"""
    
    def test_get_booking_settings(self, auth_token):
        """Test fetching booking settings"""
        response = requests.get(f"{BASE_URL}/api/admin/booking-settings",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        # Verify settings structure
        assert "available_days" in data
        assert "time_slots" in data
        assert "buffer_minutes" in data
        assert "min_lead_days" in data
        assert "max_advance_days" in data
        assert "blocked_dates" in data
        assert isinstance(data["available_days"], list)
        assert isinstance(data["time_slots"], list)
    
    def test_update_booking_settings(self, auth_token):
        """Test updating booking settings"""
        settings_data = {
            "available_days": [1, 2, 3, 4, 5, 6],  # Mon-Sat
            "time_slots": ["09:00", "10:00", "11:00", "14:00", "15:00"],
            "buffer_minutes": 45,
            "min_lead_days": 2,
            "max_advance_days": 60,
            "blocked_dates": ["2026-01-25"],
            "weekend_surcharge": 600,
            "session_duration_default": 90
        }
        response = requests.put(f"{BASE_URL}/api/admin/booking-settings",
            json=settings_data,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        
        # Verify update
        get_response = requests.get(f"{BASE_URL}/api/admin/booking-settings",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert get_response.status_code == 200
        data = get_response.json()
        assert data["buffer_minutes"] == 45
        assert data["min_lead_days"] == 2
        assert 6 in data["available_days"]  # Saturday added
    
    def test_public_booking_settings(self):
        """Test public booking settings endpoint"""
        response = requests.get(f"{BASE_URL}/api/booking-settings")
        assert response.status_code == 200
        data = response.json()
        assert "available_days" in data
        assert "time_slots" in data


class TestCalendarSettings:
    """Calendar sync settings tests"""
    
    def test_get_calendar_settings(self, auth_token):
        """Test fetching calendar settings"""
        response = requests.get(f"{BASE_URL}/api/admin/calendar-settings",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        # Verify structure
        assert "apple_calendar_url" in data or "sync_enabled" in data
        # Password should not be returned
        assert "apple_calendar_password" not in data
    
    def test_update_calendar_settings(self, auth_token):
        """Test updating calendar settings"""
        settings_data = {
            "apple_calendar_url": "https://caldav.icloud.com",
            "apple_calendar_user": "test@icloud.com",
            "apple_calendar_password": "test-app-password",
            "sync_enabled": True
        }
        response = requests.put(f"{BASE_URL}/api/admin/calendar-settings",
            json=settings_data,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        
        # Verify update (password should not be returned)
        get_response = requests.get(f"{BASE_URL}/api/admin/calendar-settings",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        data = get_response.json()
        assert data["sync_enabled"] == True
        assert data["apple_calendar_user"] == "test@icloud.com"
    
    def test_calendar_sync_trigger(self, auth_token):
        """Test triggering calendar sync (MOCKED - returns success but doesn't actually sync)"""
        response = requests.post(f"{BASE_URL}/api/admin/calendar/sync",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        # Should return 200 with pending_implementation status
        assert response.status_code == 200
        data = response.json()
        assert "message" in data


class TestBookingsManagement:
    """Bookings management tests"""
    
    def test_get_admin_bookings(self, auth_token):
        """Test fetching all bookings"""
        response = requests.get(f"{BASE_URL}/api/admin/bookings",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_create_and_manage_booking(self, auth_token):
        """Test creating a booking and managing it"""
        # Create a booking via public endpoint
        tomorrow = (datetime.now() + timedelta(days=5)).strftime("%Y-%m-%d")
        booking_data = {
            "client_name": "TEST_John Doe",
            "client_email": "test_john@example.com",
            "client_phone": "0123456789",
            "session_type": "maternity",
            "package_id": "mat-signature",
            "package_name": "Signature",
            "package_price": 5500,
            "booking_date": tomorrow,
            "booking_time": "10:00",
            "notes": "Test booking for admin management"
        }
        create_response = requests.post(f"{BASE_URL}/api/bookings", json=booking_data)
        assert create_response.status_code == 200
        booking = create_response.json()
        booking_id = booking["id"]
        
        # Verify booking appears in admin list
        list_response = requests.get(f"{BASE_URL}/api/admin/bookings",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        bookings = list_response.json()
        created_booking = next((b for b in bookings if b["id"] == booking_id), None)
        assert created_booking is not None
        assert created_booking["status"] == "pending"
        
        # Update booking status to confirmed
        update_response = requests.put(f"{BASE_URL}/api/admin/bookings/{booking_id}",
            json={"status": "confirmed"},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert update_response.status_code == 200
        
        # Verify status update
        get_response = requests.get(f"{BASE_URL}/api/admin/bookings/{booking_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert get_response.status_code == 200
        updated_booking = get_response.json()
        assert updated_booking["status"] == "confirmed"
        
        return booking_id
    
    def test_update_booking_details(self, auth_token):
        """Test updating booking details"""
        # Create a booking first
        tomorrow = (datetime.now() + timedelta(days=6)).strftime("%Y-%m-%d")
        booking_data = {
            "client_name": "TEST_Jane Smith",
            "client_email": "test_jane@example.com",
            "client_phone": "0987654321",
            "session_type": "newborn",
            "package_id": "new-complete",
            "package_name": "Complete Collection",
            "package_price": 7000,
            "booking_date": tomorrow,
            "booking_time": "14:00",
            "notes": "Original notes"
        }
        create_response = requests.post(f"{BASE_URL}/api/bookings", json=booking_data)
        assert create_response.status_code == 200
        booking_id = create_response.json()["id"]
        
        # Update multiple fields
        update_data = {
            "client_name": "TEST_Jane Smith-Updated",
            "client_phone": "0111222333",
            "booking_time": "15:00",
            "admin_notes": "Admin added this note",
            "status": "confirmed"
        }
        update_response = requests.put(f"{BASE_URL}/api/admin/bookings/{booking_id}",
            json=update_data,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert update_response.status_code == 200
        
        # Verify updates
        get_response = requests.get(f"{BASE_URL}/api/admin/bookings/{booking_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        updated = get_response.json()
        assert updated["client_name"] == "TEST_Jane Smith-Updated"
        assert updated["client_phone"] == "0111222333"
        assert updated["booking_time"] == "15:00"
        assert updated["admin_notes"] == "Admin added this note"
    
    def test_delete_booking(self, auth_token):
        """Test deleting a booking"""
        # Create a booking to delete
        tomorrow = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        booking_data = {
            "client_name": "TEST_Delete Me",
            "client_email": "test_delete@example.com",
            "client_phone": "0000000000",
            "session_type": "studio",
            "package_id": "studio-mini",
            "package_name": "Mini Session",
            "package_price": 2500,
            "booking_date": tomorrow,
            "booking_time": "09:00",
            "notes": "To be deleted"
        }
        create_response = requests.post(f"{BASE_URL}/api/bookings", json=booking_data)
        assert create_response.status_code == 200
        booking_id = create_response.json()["id"]
        
        # Delete the booking
        delete_response = requests.delete(f"{BASE_URL}/api/admin/bookings/{booking_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert delete_response.status_code == 200
        
        # Verify deletion
        get_response = requests.get(f"{BASE_URL}/api/admin/bookings/{booking_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert get_response.status_code == 404


class TestAdminStats:
    """Admin dashboard stats tests"""
    
    def test_get_admin_stats(self, auth_token):
        """Test fetching admin dashboard stats"""
        response = requests.get(f"{BASE_URL}/api/admin/stats",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        # Verify stats structure
        assert "total_bookings" in data
        assert "pending_bookings" in data
        assert "confirmed_bookings" in data
        assert "completed_bookings" in data
        assert "portfolio_count" in data
        assert "testimonials_count" in data
        assert "unread_messages" in data
        assert "packages_count" in data


class TestAvailableTimes:
    """Available times endpoint tests"""
    
    def test_get_available_times(self):
        """Test getting available times for a date"""
        # Use a date 5 days from now
        future_date = (datetime.now() + timedelta(days=5)).strftime("%Y-%m-%d")
        response = requests.get(f"{BASE_URL}/api/bookings/available-times?date={future_date}")
        assert response.status_code == 200
        data = response.json()
        assert "date" in data
        assert "available_times" in data
        assert isinstance(data["available_times"], list)


# Fixtures
@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for tests"""
    response = requests.post(f"{BASE_URL}/api/admin/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Authentication failed - skipping authenticated tests")


@pytest.fixture(scope="module", autouse=True)
def cleanup_test_data():
    """Cleanup TEST_ prefixed data after all tests complete"""
    yield
    # Cleanup after tests
    try:
        # Login to get token
        login_response = requests.post(f"{BASE_URL}/api/admin/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if login_response.status_code == 200:
            token = login_response.json().get("token")
            headers = {"Authorization": f"Bearer {token}"}
            
            # Cleanup test packages
            packages_response = requests.get(f"{BASE_URL}/api/admin/packages", headers=headers)
            if packages_response.status_code == 200:
                for pkg in packages_response.json():
                    if pkg.get("name", "").startswith("TEST_"):
                        requests.delete(f"{BASE_URL}/api/admin/packages/{pkg['id']}", headers=headers)
            
            # Cleanup test bookings
            bookings_response = requests.get(f"{BASE_URL}/api/admin/bookings", headers=headers)
            if bookings_response.status_code == 200:
                for booking in bookings_response.json():
                    if booking.get("client_name", "").startswith("TEST_"):
                        requests.delete(f"{BASE_URL}/api/admin/bookings/{booking['id']}", headers=headers)
    except Exception as e:
        print(f"Cleanup error: {e}")

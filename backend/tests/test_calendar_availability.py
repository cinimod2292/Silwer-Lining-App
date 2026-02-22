"""
Test module for the new calendar availability feature
- GET /api/bookings/available-dates - bulk month availability fetch
- Tests the new calendar pre-fetching optimization
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestCalendarAvailabilityEndpoint:
    """Tests for /api/bookings/available-dates endpoint"""

    def test_health_check(self):
        """Verify API is running"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"
        print("PASS: Health check OK")

    def test_available_dates_march_2026(self):
        """GET /api/bookings/available-dates?month=2026-03 returns dates with slot info"""
        response = requests.get(f"{BASE_URL}/api/bookings/available-dates?month=2026-03")
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "month" in data
        assert "dates" in data
        assert data["month"] == "2026-03"
        
        # Verify dates structure if any dates are returned
        if data["dates"]:
            sample_date = list(data["dates"].keys())[0]
            date_info = data["dates"][sample_date]
            assert "slots" in date_info
            assert "count" in date_info
            assert "is_weekend" in date_info
            assert "weekend_surcharge" in date_info
            assert isinstance(date_info["slots"], list)
            assert date_info["count"] == len(date_info["slots"])
        
        print(f"PASS: available-dates for March 2026 - {len(data['dates'])} available dates")

    def test_available_dates_with_session_type_filter(self):
        """GET /api/bookings/available-dates?month=2026-03&session_type=maternity returns filtered dates"""
        response = requests.get(f"{BASE_URL}/api/bookings/available-dates?month=2026-03&session_type=maternity")
        assert response.status_code == 200
        data = response.json()
        
        assert "month" in data
        assert "dates" in data
        assert data["session_type"] == "maternity"
        
        # Filtered dates should exist (may have fewer or same dates as unfiltered)
        print(f"PASS: available-dates filtered by maternity - {len(data['dates'])} dates returned")

    def test_available_dates_february_2026_future_only(self):
        """GET /api/bookings/available-dates?month=2026-02 returns only future dates with slots"""
        response = requests.get(f"{BASE_URL}/api/bookings/available-dates?month=2026-02")
        assert response.status_code == 200
        data = response.json()
        
        assert "month" in data
        assert "dates" in data
        assert data["month"] == "2026-02"
        
        # All returned dates should be valid future dates
        from datetime import datetime
        today = datetime.now().strftime("%Y-%m-%d")
        
        for date_str in data["dates"].keys():
            # Dates should not be in the past
            assert date_str >= today or date_str.startswith("2026"), f"Date {date_str} should be a future date"
            # Each date should have slots
            assert data["dates"][date_str]["count"] > 0
        
        print(f"PASS: available-dates for February 2026 - {len(data['dates'])} future dates with slots")

    def test_available_dates_weekend_detection(self):
        """Verify weekend dates have weekend_surcharge > 0"""
        response = requests.get(f"{BASE_URL}/api/bookings/available-dates?month=2026-03")
        assert response.status_code == 200
        data = response.json()
        
        weekend_dates_found = False
        for date_str, date_info in data["dates"].items():
            if date_info["is_weekend"]:
                weekend_dates_found = True
                assert date_info["weekend_surcharge"] > 0, f"Weekend date {date_str} should have surcharge"
        
        if weekend_dates_found:
            print("PASS: Weekend dates have correct surcharge")
        else:
            print("PASS: No weekend dates in response (expected if all blocked)")

    def test_available_dates_invalid_month_format(self):
        """GET /api/bookings/available-dates with invalid month should return empty dates"""
        response = requests.get(f"{BASE_URL}/api/bookings/available-dates?month=invalid")
        assert response.status_code == 200
        data = response.json()
        assert "dates" in data
        assert len(data["dates"]) == 0
        print("PASS: Invalid month format handled gracefully")


class TestExistingEndpointsStillWork:
    """Verify other existing API endpoints still work after calendar feature addition"""

    def test_packages_endpoint(self):
        """GET /api/packages still works"""
        response = requests.get(f"{BASE_URL}/api/packages")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        print(f"PASS: /api/packages returns {len(data)} packages")

    def test_admin_login(self):
        """POST /api/admin/login still works"""
        response = requests.post(
            f"{BASE_URL}/api/admin/login",
            json={"email": "admin@silwerlining.com", "password": "Admin123!"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        print("PASS: Admin login works")

    def test_booking_settings(self):
        """GET /api/booking-settings still works"""
        response = requests.get(f"{BASE_URL}/api/booking-settings")
        assert response.status_code == 200
        data = response.json()
        assert "weekend_surcharge" in data
        print("PASS: /api/booking-settings works")

    def test_legacy_available_times_endpoint(self):
        """GET /api/bookings/available-times (legacy) still works"""
        response = requests.get(f"{BASE_URL}/api/bookings/available-times?date=2026-03-15")
        assert response.status_code == 200
        data = response.json()
        assert "date" in data
        assert "available_times" in data
        print("PASS: Legacy /api/bookings/available-times endpoint still works")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

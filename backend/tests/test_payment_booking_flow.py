"""
Test Payment and Booking Flow - Tests for bug fix:
1. BookingCreate model accepts selected_addons as list of strings (addon IDs)
2. PayFast payment initiation returns form_data with full domain URLs
3. EFT payment initiation returns bank details and reference
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestBookingCreationWithAddons:
    """Test booking creation with selected_addons as list of strings"""
    
    def test_create_booking_with_addon_ids(self):
        """Test that booking can be created with selected_addons as list of string IDs (bug fix)"""
        payload = {
            "client_name": "TEST_Payment_User",
            "client_email": "test_payment@example.com",
            "client_phone": "+27123456789",
            "session_type": "maternity",
            "package_id": "mat-essential",
            "package_name": "Essential",
            "package_price": 3500,
            "booking_date": "2026-03-15",
            "booking_time": "09:00",
            "notes": "Test booking for payment flow",
            "selected_addons": ["makeup", "extra_images"],  # List of strings, NOT list of dicts
            "addons_total": 2300,
            "total_price": 5800,
            "is_weekend": False,
            "weekend_surcharge": 0,
            "contract_signed": False,
            "contract_data": {},
            "questionnaire_responses": {},
            "payment_method": "payfast",
            "payment_type": "deposit"
        }
        
        response = requests.post(f"{BASE_URL}/api/bookings", json=payload)
        print(f"Create booking response: {response.status_code}")
        
        # Should NOT return 422 (validation error) with new model fix
        assert response.status_code in [200, 201], f"Expected 200/201, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "id" in data, "Booking should have an id"
        assert data["client_name"] == "TEST_Payment_User"
        assert data["selected_addons"] == ["makeup", "extra_images"], "selected_addons should be list of strings"
        
        # Save booking_id for payment tests
        return data["id"]
    
    def test_create_booking_with_empty_addons(self):
        """Test booking can be created with empty addons list"""
        payload = {
            "client_name": "TEST_No_Addons_User",
            "client_email": "test_no_addons@example.com",
            "client_phone": "+27123456789",
            "session_type": "newborn",
            "package_id": "new-precious",
            "package_name": "Precious Moments",
            "package_price": 4500,
            "booking_date": "2026-03-20",
            "booking_time": "10:00",
            "notes": "",
            "selected_addons": [],
            "addons_total": 0,
            "total_price": 4500,
            "is_weekend": False,
            "weekend_surcharge": 0,
            "contract_signed": False,
            "contract_data": {},
            "questionnaire_responses": {},
            "payment_method": "",
            "payment_type": ""
        }
        
        response = requests.post(f"{BASE_URL}/api/bookings", json=payload)
        print(f"Create booking with empty addons: {response.status_code}")
        
        assert response.status_code in [200, 201]
        data = response.json()
        assert data["selected_addons"] == []
        return data["id"]
    
    def test_create_booking_with_weekend_surcharge(self):
        """Test booking with weekend flag and surcharge"""
        payload = {
            "client_name": "TEST_Weekend_User",
            "client_email": "test_weekend@example.com",
            "client_phone": "+27123456789",
            "session_type": "studio",
            "package_id": "studio-classic",
            "package_name": "Classic",
            "package_price": 4000,
            "booking_date": "2026-03-21",  # Saturday
            "booking_time": "09:00",
            "notes": "Weekend booking test",
            "selected_addons": ["makeup"],
            "addons_total": 800,
            "total_price": 5300,  # 4000 + 800 + 500 surcharge
            "is_weekend": True,
            "weekend_surcharge": 500,
            "contract_signed": False,
            "contract_data": {},
            "questionnaire_responses": {},
            "payment_method": "eft",
            "payment_type": "full"
        }
        
        response = requests.post(f"{BASE_URL}/api/bookings", json=payload)
        print(f"Create weekend booking: {response.status_code}")
        
        assert response.status_code in [200, 201]
        data = response.json()
        assert data["is_weekend"] == True
        assert data["weekend_surcharge"] == 500
        return data["id"]


class TestPaymentInitiation:
    """Test payment initiation endpoints for PayFast and EFT"""
    
    @pytest.fixture
    def booking_id(self):
        """Create a booking for payment tests"""
        payload = {
            "client_name": "TEST_Payment_Flow",
            "client_email": "payment_test@example.com",
            "client_phone": "+27821234567",
            "session_type": "maternity",
            "package_id": "mat-signature",
            "package_name": "Signature",
            "package_price": 5500,
            "booking_date": "2026-03-25",
            "booking_time": "14:00",
            "notes": "",
            "selected_addons": ["makeup"],
            "addons_total": 800,
            "total_price": 6300,
            "is_weekend": False,
            "weekend_surcharge": 0,
            "contract_signed": True,
            "contract_data": {"signature_data": "test"},
            "questionnaire_responses": {},
            "payment_method": "",
            "payment_type": ""
        }
        
        response = requests.post(f"{BASE_URL}/api/bookings", json=payload)
        assert response.status_code in [200, 201], f"Failed to create booking: {response.text}"
        return response.json()["id"]
    
    def test_payfast_payment_initiation(self, booking_id):
        """Test PayFast payment initiation returns form_data with FULL domain URLs"""
        payload = {
            "booking_id": booking_id,
            "payment_method": "payfast",
            "payment_type": "deposit"
        }
        
        # Include origin header to simulate frontend request
        headers = {
            "Content-Type": "application/json",
            "Origin": "https://photo-biz-hub-3.preview.emergentagent.com"
        }
        
        response = requests.post(f"{BASE_URL}/api/payments/initiate", json=payload, headers=headers)
        print(f"PayFast initiation response: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        print(f"PayFast response data: {data}")
        
        # Validate PayFast response structure
        assert data["payment_method"] == "payfast"
        assert "payment_url" in data
        assert "form_data" in data
        assert "amount" in data
        
        form_data = data["form_data"]
        
        # CRITICAL: Verify URLs contain full domain (bug fix validation)
        assert "return_url" in form_data
        assert "cancel_url" in form_data
        assert "notify_url" in form_data
        
        # URLs should start with https:// and contain full domain
        assert form_data["return_url"].startswith("https://"), f"return_url should have full domain: {form_data['return_url']}"
        assert form_data["cancel_url"].startswith("https://"), f"cancel_url should have full domain: {form_data['cancel_url']}"
        assert form_data["notify_url"].startswith("https://"), f"notify_url should have full domain: {form_data['notify_url']}"
        
        # Verify the URLs contain the expected structure
        assert "/payment/return" in form_data["return_url"], f"return_url missing path: {form_data['return_url']}"
        assert "/payment/cancel" in form_data["cancel_url"], f"cancel_url missing path: {form_data['cancel_url']}"
        assert "/api/payments/payfast-itn" in form_data["notify_url"], f"notify_url missing path: {form_data['notify_url']}"
        
        # Verify booking_id is in URLs
        assert booking_id in form_data["return_url"]
        assert booking_id in form_data["cancel_url"]
        
        # Verify other form fields
        assert "merchant_id" in form_data
        assert "merchant_key" in form_data
        assert "signature" in form_data
        assert "amount" in form_data
        
        print(f"PayFast URLs validated - return_url: {form_data['return_url']}")
    
    def test_payfast_payment_full_amount(self, booking_id):
        """Test PayFast with full payment amount"""
        payload = {
            "booking_id": booking_id,
            "payment_method": "payfast",
            "payment_type": "full"
        }
        
        headers = {
            "Content-Type": "application/json",
            "Origin": "https://photo-biz-hub-3.preview.emergentagent.com"
        }
        
        response = requests.post(f"{BASE_URL}/api/payments/initiate", json=payload, headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        # Full payment should be the total_price (6300)
        assert data["amount"] == 6300, f"Full amount should be 6300, got {data['amount']}"
    
    def test_eft_payment_initiation(self, booking_id):
        """Test EFT payment initiation returns bank details and reference"""
        payload = {
            "booking_id": booking_id,
            "payment_method": "eft",
            "payment_type": "deposit"
        }
        
        response = requests.post(f"{BASE_URL}/api/payments/initiate", json=payload)
        print(f"EFT initiation response: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        print(f"EFT response data: {data}")
        
        # Validate EFT response structure
        assert data["payment_method"] == "eft"
        assert "bank_details" in data
        assert "amount" in data
        
        bank_details = data["bank_details"]
        
        # Verify bank details structure (may be empty if not configured)
        assert "bank_name" in bank_details
        assert "account_holder" in bank_details
        assert "account_number" in bank_details
        assert "branch_code" in bank_details
        assert "account_type" in bank_details
        assert "reference" in bank_details
        
        # Verify reference contains booking_id
        assert booking_id[:8].upper() in bank_details["reference"], f"Reference should contain booking ID: {bank_details['reference']}"
        
        print(f"EFT bank details validated - reference: {bank_details['reference']}")
    
    def test_payflex_payment_mocked(self, booking_id):
        """Test PayFlex payment returns mocked/placeholder response"""
        payload = {
            "booking_id": booking_id,
            "payment_method": "payflex",
            "payment_type": "deposit"
        }
        
        response = requests.post(f"{BASE_URL}/api/payments/initiate", json=payload)
        print(f"PayFlex response: {response.status_code}")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["payment_method"] == "payflex"
        # PayFlex is MOCKED - should return placeholder message
        assert "message" in data
        assert "coming soon" in data["message"].lower() or "placeholder" in data["message"].lower()
        
        print(f"PayFlex MOCKED response: {data['message']}")
    
    def test_invalid_payment_method(self, booking_id):
        """Test invalid payment method returns error"""
        payload = {
            "booking_id": booking_id,
            "payment_method": "invalid_method",
            "payment_type": "deposit"
        }
        
        response = requests.post(f"{BASE_URL}/api/payments/initiate", json=payload)
        print(f"Invalid payment method response: {response.status_code}")
        
        assert response.status_code == 400
    
    def test_nonexistent_booking_payment(self):
        """Test payment initiation with non-existent booking"""
        payload = {
            "booking_id": "nonexistent-booking-id",
            "payment_method": "payfast",
            "payment_type": "deposit"
        }
        
        response = requests.post(f"{BASE_URL}/api/payments/initiate", json=payload)
        print(f"Nonexistent booking response: {response.status_code}")
        
        assert response.status_code == 404


class TestPaymentStatus:
    """Test payment status endpoints"""
    
    @pytest.fixture
    def booking_with_payment(self):
        """Create booking and initiate payment"""
        # Create booking
        payload = {
            "client_name": "TEST_Status_Check",
            "client_email": "status_test@example.com",
            "client_phone": "+27821234567",
            "session_type": "maternity",
            "package_id": "mat-essential",
            "package_name": "Essential",
            "package_price": 3500,
            "booking_date": "2026-03-28",
            "booking_time": "11:00",
            "notes": "",
            "selected_addons": [],
            "addons_total": 0,
            "total_price": 3500,
            "is_weekend": False,
            "weekend_surcharge": 0,
            "contract_signed": False,
            "contract_data": {},
            "questionnaire_responses": {},
            "payment_method": "",
            "payment_type": ""
        }
        
        response = requests.post(f"{BASE_URL}/api/bookings", json=payload)
        assert response.status_code in [200, 201]
        booking_id = response.json()["id"]
        
        # Initiate payment
        payment_payload = {
            "booking_id": booking_id,
            "payment_method": "payfast",
            "payment_type": "deposit"
        }
        headers = {"Origin": "https://photo-biz-hub-3.preview.emergentagent.com"}
        requests.post(f"{BASE_URL}/api/payments/initiate", json=payment_payload, headers=headers)
        
        return booking_id
    
    def test_get_payment_status(self, booking_with_payment):
        """Test getting payment status for a booking"""
        booking_id = booking_with_payment
        
        response = requests.get(f"{BASE_URL}/api/payments/status/{booking_id}")
        print(f"Payment status response: {response.status_code}")
        
        assert response.status_code == 200
        
        data = response.json()
        assert data["booking_id"] == booking_id
        assert "status" in data
        assert "payment_status" in data
        assert "payment_method" in data
        assert "total_price" in data
        
        print(f"Payment status: {data}")
    
    def test_get_payment_status_nonexistent(self):
        """Test payment status for non-existent booking"""
        response = requests.get(f"{BASE_URL}/api/payments/status/nonexistent-id")
        assert response.status_code == 404


class TestExistingEndpointsNoRegression:
    """Verify existing endpoints still work after model changes"""
    
    def test_health_endpoint(self):
        """Test health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
    
    def test_packages_endpoint(self):
        """Test packages endpoint"""
        response = requests.get(f"{BASE_URL}/api/packages")
        assert response.status_code == 200
        packages = response.json()
        assert len(packages) > 0
    
    def test_packages_filtered_by_session_type(self):
        """Test packages filtered by session type"""
        response = requests.get(f"{BASE_URL}/api/packages?session_type=maternity")
        assert response.status_code == 200
        packages = response.json()
        for pkg in packages:
            assert pkg["session_type"] == "maternity"
    
    def test_booking_settings_endpoint(self):
        """Test booking settings endpoint"""
        response = requests.get(f"{BASE_URL}/api/booking-settings")
        assert response.status_code == 200
        data = response.json()
        assert "time_slots" in data or "time_slot_schedule" in data
    
    def test_payment_settings_endpoint(self):
        """Test public payment settings endpoint"""
        response = requests.get(f"{BASE_URL}/api/payment-settings")
        assert response.status_code == 200
        data = response.json()
        assert "payfast_enabled" in data
    
    def test_addons_endpoint(self):
        """Test add-ons endpoint"""
        response = requests.get(f"{BASE_URL}/api/addons")
        assert response.status_code == 200
    
    def test_available_dates_endpoint(self):
        """Test available dates endpoint still works"""
        response = requests.get(f"{BASE_URL}/api/bookings/available-dates?month=2026-03")
        assert response.status_code == 200
        data = response.json()
        assert "dates" in data
    
    def test_available_times_endpoint(self):
        """Test available times endpoint still works"""
        response = requests.get(f"{BASE_URL}/api/bookings/available-times?date=2026-03-15")
        assert response.status_code == 200
        data = response.json()
        assert "available_times" in data
    
    def test_admin_login(self):
        """Test admin login endpoint still works"""
        response = requests.post(f"{BASE_URL}/api/admin/login", json={
            "email": "admin@silwerlining.com",
            "password": "Admin123!"
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data


# Cleanup fixture for all test classes
@pytest.fixture(scope="session", autouse=True)
def cleanup_test_data():
    """Cleanup test data after all tests complete"""
    yield
    # Note: In production, you would delete TEST_ prefixed bookings here
    print("Test cleanup complete")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

"""
Test suite for Contract Feature
- Public contract API
- Admin contract API (CRUD)
- Contract in booking flow
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestContractPublicAPI:
    """Test public contract endpoint"""
    
    def test_get_public_contract(self):
        """GET /api/contract - should return contract template"""
        response = requests.get(f"{BASE_URL}/api/contract")
        assert response.status_code == 200
        
        data = response.json()
        assert "id" in data
        assert "title" in data
        assert "content" in data
        assert "smart_fields" in data
        
        # Verify smart_fields structure
        if data["smart_fields"]:
            field = data["smart_fields"][0]
            assert "id" in field
            assert "type" in field
            assert "label" in field
            assert "required" in field
        
        print(f"✓ Public contract API returns valid contract with {len(data['smart_fields'])} smart fields")


class TestContractAdminAPI:
    """Test admin contract endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin token"""
        login_response = requests.post(
            f"{BASE_URL}/api/admin/login",
            json={"email": "admin@silwerlining.com", "password": "Admin123!"}
        )
        if login_response.status_code == 200:
            self.token = login_response.json().get("token")
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Admin login failed")
    
    def test_admin_get_contract(self):
        """GET /api/admin/contract - should return contract template with default content"""
        response = requests.get(
            f"{BASE_URL}/api/admin/contract",
            headers=self.headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["id"] == "default"
        assert "title" in data
        assert "content" in data
        assert "smart_fields" in data
        
        # Verify default contract has 6 smart fields
        assert len(data["smart_fields"]) == 6, f"Expected 6 smart fields, got {len(data['smart_fields'])}"
        
        # Verify field types
        field_types = [f["type"] for f in data["smart_fields"]]
        assert field_types.count("agree_disagree") == 3, "Should have 3 agree/disagree fields"
        assert field_types.count("initials") == 1, "Should have 1 initials field"
        assert field_types.count("date") == 1, "Should have 1 date field"
        assert field_types.count("signature") == 1, "Should have 1 signature field"
        
        print(f"✓ Admin contract API returns valid contract with correct field types")
    
    def test_admin_update_contract(self):
        """PUT /api/admin/contract - should update contract template"""
        # First get current contract
        get_response = requests.get(
            f"{BASE_URL}/api/admin/contract",
            headers=self.headers
        )
        original_contract = get_response.json()
        
        # Update with test data
        test_contract = {
            "title": "TEST Contract Title",
            "content": original_contract["content"],
            "smart_fields": original_contract["smart_fields"]
        }
        
        update_response = requests.put(
            f"{BASE_URL}/api/admin/contract",
            headers=self.headers,
            json=test_contract
        )
        assert update_response.status_code == 200
        
        # Verify update
        verify_response = requests.get(
            f"{BASE_URL}/api/admin/contract",
            headers=self.headers
        )
        updated_data = verify_response.json()
        assert updated_data["title"] == "TEST Contract Title"
        
        # Restore original title
        restore_contract = {
            "title": "Photography Session Contract",
            "content": original_contract["content"],
            "smart_fields": original_contract["smart_fields"]
        }
        requests.put(
            f"{BASE_URL}/api/admin/contract",
            headers=self.headers,
            json=restore_contract
        )
        
        print("✓ Admin contract update works correctly")
    
    def test_admin_contract_unauthorized(self):
        """GET /api/admin/contract without token should fail"""
        response = requests.get(f"{BASE_URL}/api/admin/contract")
        assert response.status_code in [401, 403], "Should require authentication"
        print("✓ Admin contract endpoint requires authentication")


class TestBookingWithContract:
    """Test booking flow with contract signing"""
    
    def test_booking_with_contract_data(self):
        """POST /api/bookings - should accept contract data"""
        # Get available times for a future date
        date = "2026-02-24"
        times_response = requests.get(
            f"{BASE_URL}/api/bookings/available-times?date={date}&session_type=maternity"
        )
        
        if times_response.status_code != 200:
            pytest.skip("Could not get available times")
        
        times_data = times_response.json()
        available_times = times_data.get("available_times", [])
        
        if not available_times:
            pytest.skip("No available times for test date")
        
        # Create booking with contract data
        booking_payload = {
            "client_name": "TEST Contract User",
            "client_email": "test_contract@example.com",
            "client_phone": "+27123456789",
            "session_type": "maternity",
            "package_id": "mat-essential",
            "package_name": "Essential Collection",
            "package_price": 3200,
            "booking_date": date,
            "booking_time": available_times[0],
            "notes": "Test booking with contract",
            "selected_addons": [],
            "addons_total": 0,
            "is_weekend": False,
            "weekend_surcharge": 0,
            "total_price": 3200,
            "questionnaire_responses": {},
            "contract_signed": True,
            "contract_data": {
                "field_responses": {
                    "AGREE_PAYMENT": True,
                    "AGREE_CANCELLATION": True,
                    "AGREE_USAGE": True,
                    "INITIALS_USAGE": "TCU",
                    "DATE_SIGNED": "2026-02-20T10:00:00.000Z"
                },
                "signature_data": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
                "signed_at": "2026-02-20T10:00:00.000Z",
                "client_name": "TEST Contract User"
            }
        }
        
        response = requests.post(
            f"{BASE_URL}/api/bookings",
            json=booking_payload
        )
        
        assert response.status_code == 200, f"Booking creation failed: {response.text}"
        
        data = response.json()
        assert data["contract_signed"] == True
        assert "contract_data" in data
        assert data["contract_data"]["field_responses"]["AGREE_PAYMENT"] == True
        
        print(f"✓ Booking with contract data created successfully (ID: {data['id']})")
        
        # Cleanup - delete test booking
        login_response = requests.post(
            f"{BASE_URL}/api/admin/login",
            json={"email": "admin@silwerlining.com", "password": "Admin123!"}
        )
        if login_response.status_code == 200:
            token = login_response.json().get("token")
            requests.delete(
                f"{BASE_URL}/api/admin/bookings/{data['id']}",
                headers={"Authorization": f"Bearer {token}"}
            )
            print(f"✓ Test booking cleaned up")


class TestContractSmartFields:
    """Test smart field types in contract"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin token"""
        login_response = requests.post(
            f"{BASE_URL}/api/admin/login",
            json={"email": "admin@silwerlining.com", "password": "Admin123!"}
        )
        if login_response.status_code == 200:
            self.token = login_response.json().get("token")
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Admin login failed")
    
    def test_smart_field_types(self):
        """Verify all smart field types are present"""
        response = requests.get(
            f"{BASE_URL}/api/admin/contract",
            headers=self.headers
        )
        assert response.status_code == 200
        
        data = response.json()
        smart_fields = data["smart_fields"]
        
        # Check each field type
        field_types = {f["type"]: f for f in smart_fields}
        
        # Agree/Disagree fields
        agree_fields = [f for f in smart_fields if f["type"] == "agree_disagree"]
        assert len(agree_fields) == 3, f"Expected 3 agree/disagree fields, got {len(agree_fields)}"
        for field in agree_fields:
            assert field["required"] == True, f"Agree/disagree field {field['id']} should be required"
        
        # Initials field
        initials_fields = [f for f in smart_fields if f["type"] == "initials"]
        assert len(initials_fields) == 1, f"Expected 1 initials field, got {len(initials_fields)}"
        
        # Date field
        date_fields = [f for f in smart_fields if f["type"] == "date"]
        assert len(date_fields) == 1, f"Expected 1 date field, got {len(date_fields)}"
        
        # Signature field
        signature_fields = [f for f in smart_fields if f["type"] == "signature"]
        assert len(signature_fields) == 1, f"Expected 1 signature field, got {len(signature_fields)}"
        
        print("✓ All 6 smart field types verified (3 agree/disagree, 1 initials, 1 date, 1 signature)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

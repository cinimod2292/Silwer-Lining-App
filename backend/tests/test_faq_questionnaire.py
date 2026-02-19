"""
Test suite for FAQ and Questionnaire features
- FAQ API endpoints (public and admin)
- Questionnaire API endpoints (public and admin)
- Booking flow with questionnaire integration
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@silwerlining.com"
ADMIN_PASSWORD = "Admin123!"


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def auth_token(api_client):
    """Get authentication token"""
    response = api_client.post(f"{BASE_URL}/api/admin/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Authentication failed - skipping authenticated tests")


@pytest.fixture(scope="module")
def authenticated_client(api_client, auth_token):
    """Session with auth header"""
    api_client.headers.update({"Authorization": f"Bearer {auth_token}"})
    return api_client


class TestPublicFAQEndpoints:
    """Test public FAQ API endpoints"""
    
    def test_get_faqs_returns_list(self, api_client):
        """GET /api/faqs should return a list of FAQs"""
        response = api_client.get(f"{BASE_URL}/api/faqs")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1, "Should have at least one FAQ"
        
        # Verify FAQ structure
        faq = data[0]
        assert "id" in faq
        assert "question" in faq
        assert "answer" in faq
        assert "active" in faq
        print(f"✓ Found {len(data)} FAQs")
    
    def test_faqs_have_required_fields(self, api_client):
        """FAQs should have all required fields"""
        response = api_client.get(f"{BASE_URL}/api/faqs")
        assert response.status_code == 200
        
        data = response.json()
        for faq in data:
            assert faq.get("question"), "FAQ should have a question"
            assert faq.get("answer"), "FAQ should have an answer"
            assert faq.get("active") == True, "Public FAQs should be active"
        print(f"✓ All {len(data)} FAQs have required fields")
    
    def test_faqs_filter_by_category(self, api_client):
        """GET /api/faqs?category=booking should filter by category"""
        response = api_client.get(f"{BASE_URL}/api/faqs?category=booking")
        assert response.status_code == 200
        
        data = response.json()
        # All returned FAQs should be in the booking category
        for faq in data:
            assert faq.get("category") == "booking"
        print(f"✓ Category filter works - found {len(data)} booking FAQs")


class TestAdminFAQEndpoints:
    """Test admin FAQ CRUD operations"""
    
    def test_admin_get_faqs(self, authenticated_client):
        """Admin should be able to get all FAQs"""
        response = authenticated_client.get(f"{BASE_URL}/api/admin/faqs")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Admin can view {len(data)} FAQs")
    
    def test_admin_create_faq(self, authenticated_client):
        """Admin should be able to create a new FAQ"""
        test_faq = {
            "question": "TEST_FAQ: What is the test question?",
            "answer": "This is a test answer for automated testing.",
            "category": "general",
            "order": 99,
            "active": True
        }
        
        response = authenticated_client.post(f"{BASE_URL}/api/admin/faqs", json=test_faq)
        assert response.status_code == 200
        
        data = response.json()
        assert "id" in data
        assert data["question"] == test_faq["question"]
        assert data["answer"] == test_faq["answer"]
        
        # Store ID for cleanup
        TestAdminFAQEndpoints.created_faq_id = data["id"]
        print(f"✓ Created FAQ with ID: {data['id']}")
    
    def test_admin_update_faq(self, authenticated_client):
        """Admin should be able to update an FAQ"""
        faq_id = getattr(TestAdminFAQEndpoints, 'created_faq_id', None)
        if not faq_id:
            pytest.skip("No FAQ created to update")
        
        updated_data = {
            "question": "TEST_FAQ: Updated question?",
            "answer": "Updated answer for testing.",
            "category": "general",
            "order": 99,
            "active": True
        }
        
        response = authenticated_client.put(f"{BASE_URL}/api/admin/faqs/{faq_id}", json=updated_data)
        assert response.status_code == 200
        print(f"✓ Updated FAQ {faq_id}")
    
    def test_admin_delete_faq(self, authenticated_client):
        """Admin should be able to delete an FAQ"""
        faq_id = getattr(TestAdminFAQEndpoints, 'created_faq_id', None)
        if not faq_id:
            pytest.skip("No FAQ created to delete")
        
        response = authenticated_client.delete(f"{BASE_URL}/api/admin/faqs/{faq_id}")
        assert response.status_code == 200
        
        # Verify deletion
        get_response = authenticated_client.get(f"{BASE_URL}/api/admin/faqs")
        faqs = get_response.json()
        faq_ids = [f["id"] for f in faqs]
        assert faq_id not in faq_ids, "FAQ should be deleted"
        print(f"✓ Deleted FAQ {faq_id}")


class TestPublicQuestionnaireEndpoints:
    """Test public questionnaire API endpoints"""
    
    def test_get_maternity_questionnaire(self, api_client):
        """GET /api/questionnaire/maternity should return questionnaire"""
        response = api_client.get(f"{BASE_URL}/api/questionnaire/maternity")
        assert response.status_code == 200
        
        data = response.json()
        assert "questions" in data
        assert len(data["questions"]) >= 1, "Maternity questionnaire should have questions"
        print(f"✓ Maternity questionnaire has {len(data['questions'])} questions")
    
    def test_maternity_questionnaire_structure(self, api_client):
        """Maternity questionnaire should have correct structure"""
        response = api_client.get(f"{BASE_URL}/api/questionnaire/maternity")
        assert response.status_code == 200
        
        data = response.json()
        questions = data.get("questions", [])
        
        # Verify question types exist
        question_types = [q.get("type") for q in questions]
        assert "text" in question_types, "Should have text question (due date)"
        assert "radio" in question_types, "Should have radio question (first baby)"
        assert "checkbox" in question_types, "Should have checkbox question (photo styles)"
        assert "textarea" in question_types, "Should have textarea question (special notes)"
        print(f"✓ Questionnaire has all required question types: {question_types}")
    
    def test_questionnaire_questions_have_labels(self, api_client):
        """All questions should have labels"""
        response = api_client.get(f"{BASE_URL}/api/questionnaire/maternity")
        assert response.status_code == 200
        
        data = response.json()
        for q in data.get("questions", []):
            assert q.get("label"), f"Question {q.get('id')} should have a label"
        print("✓ All questions have labels")
    
    def test_nonexistent_questionnaire_returns_empty(self, api_client):
        """GET /api/questionnaire/nonexistent should return empty questions"""
        response = api_client.get(f"{BASE_URL}/api/questionnaire/nonexistent_type")
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("questions") == [], "Non-existent questionnaire should return empty questions"
        print("✓ Non-existent questionnaire returns empty questions array")


class TestAdminQuestionnaireEndpoints:
    """Test admin questionnaire CRUD operations"""
    
    def test_admin_get_questionnaires(self, authenticated_client):
        """Admin should be able to get all questionnaires"""
        response = authenticated_client.get(f"{BASE_URL}/api/admin/questionnaires")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Admin can view {len(data)} questionnaires")
    
    def test_admin_get_questionnaire_by_type(self, authenticated_client):
        """Admin should be able to get questionnaire by session type"""
        response = authenticated_client.get(f"{BASE_URL}/api/admin/questionnaires/maternity")
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("session_type") == "maternity"
        assert "questions" in data
        print(f"✓ Admin can view maternity questionnaire with {len(data.get('questions', []))} questions")


class TestBookingWithQuestionnaire:
    """Test booking flow with questionnaire integration"""
    
    def test_booking_settings_available(self, api_client):
        """Booking settings should be available"""
        response = api_client.get(f"{BASE_URL}/api/booking-settings")
        assert response.status_code == 200
        
        data = response.json()
        assert "weekend_surcharge" in data
        print(f"✓ Booking settings available, weekend surcharge: {data.get('weekend_surcharge')}")
    
    def test_packages_available(self, api_client):
        """Packages should be available for booking"""
        response = api_client.get(f"{BASE_URL}/api/packages")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data) >= 1, "Should have at least one package"
        
        # Check for maternity packages
        maternity_packages = [p for p in data if p.get("session_type") == "maternity"]
        assert len(maternity_packages) >= 1, "Should have maternity packages"
        print(f"✓ Found {len(maternity_packages)} maternity packages")
    
    def test_create_booking_with_questionnaire_responses(self, api_client):
        """Should be able to create booking with questionnaire responses"""
        # Get a maternity package
        packages_response = api_client.get(f"{BASE_URL}/api/packages")
        packages = packages_response.json()
        maternity_pkg = next((p for p in packages if p.get("session_type") == "maternity"), None)
        
        if not maternity_pkg:
            pytest.skip("No maternity package available")
        
        booking_data = {
            "client_name": "TEST_Booking User",
            "client_email": "test_booking@example.com",
            "client_phone": "0123456789",
            "session_type": "maternity",
            "package_name": maternity_pkg["name"],
            "booking_date": "2026-03-15",
            "booking_time": "10:00",
            "notes": "Test booking with questionnaire",
            "selected_addons": [],
            "is_weekend": False,
            "questionnaire_responses": {
                "q1": "March 2026",
                "q2": "Yes, first baby",
                "q3": ["Elegant/Formal", "Partner/Family included"],
                "q4": "This is a test booking"
            }
        }
        
        response = api_client.post(f"{BASE_URL}/api/bookings", json=booking_data)
        assert response.status_code == 200
        
        data = response.json()
        assert "id" in data
        assert data["client_name"] == booking_data["client_name"]
        assert data["session_type"] == "maternity"
        assert "questionnaire_responses" in data
        
        # Store for cleanup
        TestBookingWithQuestionnaire.created_booking_id = data["id"]
        print(f"✓ Created booking with questionnaire responses, ID: {data['id']}")
    
    def test_verify_booking_questionnaire_responses(self, authenticated_client):
        """Verify questionnaire responses are stored in booking"""
        booking_id = getattr(TestBookingWithQuestionnaire, 'created_booking_id', None)
        if not booking_id:
            pytest.skip("No booking created to verify")
        
        response = authenticated_client.get(f"{BASE_URL}/api/admin/bookings/{booking_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert "questionnaire_responses" in data
        responses = data["questionnaire_responses"]
        
        # Verify responses are stored
        assert responses.get("q1") == "March 2026"
        assert responses.get("q2") == "Yes, first baby"
        assert "Elegant/Formal" in responses.get("q3", [])
        print(f"✓ Questionnaire responses verified in booking")
    
    def test_cleanup_test_booking(self, authenticated_client):
        """Clean up test booking"""
        booking_id = getattr(TestBookingWithQuestionnaire, 'created_booking_id', None)
        if not booking_id:
            pytest.skip("No booking to clean up")
        
        response = authenticated_client.delete(f"{BASE_URL}/api/admin/bookings/{booking_id}")
        assert response.status_code == 200
        print(f"✓ Cleaned up test booking {booking_id}")


class TestAvailableTimes:
    """Test available times endpoint"""
    
    def test_get_available_times(self, api_client):
        """Should get available times for a date"""
        response = api_client.get(f"{BASE_URL}/api/bookings/available-times?date=2026-03-15")
        assert response.status_code == 200
        
        data = response.json()
        assert "available_times" in data
        assert "date" in data
        print(f"✓ Available times for 2026-03-15: {data.get('available_times')}")
    
    def test_get_available_times_with_session_type(self, api_client):
        """Should get available times filtered by session type"""
        response = api_client.get(f"{BASE_URL}/api/bookings/available-times?date=2026-03-15&session_type=maternity")
        assert response.status_code == 200
        
        data = response.json()
        assert "available_times" in data
        assert data.get("session_type") == "maternity"
        print(f"✓ Available times for maternity on 2026-03-15: {data.get('available_times')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

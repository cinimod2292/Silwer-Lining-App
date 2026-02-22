"""
Backend Regression Tests for Refactored API
Tests all public and admin endpoints after monolithic server.py was split into modular FastAPI routers
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://photo-biz-hub-3.preview.emergentagent.com')

# Admin credentials
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
    """Get authentication token for admin endpoints"""
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


# ==================== PUBLIC ENDPOINTS ====================

class TestPublicEndpoints:
    """Tests for public (unauthenticated) endpoints"""
    
    def test_health_check(self, api_client):
        """Test GET /api/health"""
        response = api_client.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert data["status"] == "healthy"
        print("✓ Health check endpoint working")
    
    def test_packages_endpoint(self, api_client):
        """Test GET /api/packages"""
        response = api_client.get(f"{BASE_URL}/api/packages")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        # Verify package structure
        for pkg in data[:3]:
            assert "id" in pkg
            assert "name" in pkg
            assert "session_type" in pkg
            assert "price" in pkg
        print(f"✓ Packages endpoint returned {len(data)} packages")
    
    def test_testimonials_endpoint(self, api_client):
        """Test GET /api/testimonials"""
        response = api_client.get(f"{BASE_URL}/api/testimonials")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Verify testimonial structure
        for t in data[:2]:
            assert "client_name" in t
            assert "content" in t
        print(f"✓ Testimonials endpoint returned {len(data)} testimonials")
    
    def test_portfolio_endpoint(self, api_client):
        """Test GET /api/portfolio"""
        response = api_client.get(f"{BASE_URL}/api/portfolio")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        # Verify portfolio structure
        for item in data[:2]:
            assert "id" in item
            assert "title" in item
            assert "category" in item
            assert "image_url" in item
        print(f"✓ Portfolio endpoint returned {len(data)} items")
    
    def test_faqs_endpoint(self, api_client):
        """Test GET /api/faqs"""
        response = api_client.get(f"{BASE_URL}/api/faqs")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Verify FAQ structure
        for faq in data[:2]:
            assert "question" in faq
            assert "answer" in faq
        print(f"✓ FAQs endpoint returned {len(data)} FAQs")
    
    def test_addons_endpoint(self, api_client):
        """Test GET /api/addons"""
        response = api_client.get(f"{BASE_URL}/api/addons")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Verify addon structure
        for addon in data[:2]:
            assert "id" in addon
            assert "name" in addon
            assert "price" in addon
        print(f"✓ Addons endpoint returned {len(data)} addons")
    
    def test_booking_settings_endpoint(self, api_client):
        """Test GET /api/booking-settings"""
        response = api_client.get(f"{BASE_URL}/api/booking-settings")
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert "time_slot_schedule" in data or "time_slots" in data
        print("✓ Booking settings endpoint working")
    
    def test_contract_endpoint(self, api_client):
        """Test GET /api/contract"""
        response = api_client.get(f"{BASE_URL}/api/contract")
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert "title" in data or "content" in data
        print("✓ Contract endpoint working")
    
    def test_payment_settings_endpoint(self, api_client):
        """Test GET /api/payments/settings"""
        response = api_client.get(f"{BASE_URL}/api/payments/settings")
        assert response.status_code == 200
        data = response.json()
        assert "payfast_enabled" in data
        print("✓ Payment settings endpoint working")
    
    def test_instagram_feed_endpoint(self, api_client):
        """Test GET /api/instagram/feed"""
        response = api_client.get(f"{BASE_URL}/api/instagram/feed")
        assert response.status_code == 200
        data = response.json()
        # May have posts or error if not configured
        assert "posts" in data or "error" in data
        print("✓ Instagram feed endpoint working")
    
    def test_google_reviews_public_endpoint(self, api_client):
        """Test GET /api/google-reviews/public"""
        response = api_client.get(f"{BASE_URL}/api/google-reviews/public")
        assert response.status_code == 200
        data = response.json()
        assert "reviews" in data
        print("✓ Google reviews public endpoint working")


# ==================== ADMIN AUTHENTICATION ====================

class TestAdminAuth:
    """Tests for admin authentication"""
    
    def test_admin_login_success(self, api_client):
        """Test POST /api/admin/login with valid credentials"""
        response = api_client.post(f"{BASE_URL}/api/admin/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "name" in data
        assert "email" in data
        assert data["email"] == ADMIN_EMAIL
        print("✓ Admin login successful")
    
    def test_admin_login_invalid_credentials(self, api_client):
        """Test POST /api/admin/login with invalid credentials"""
        response = api_client.post(f"{BASE_URL}/api/admin/login", json={
            "email": "wrong@example.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        print("✓ Admin login correctly rejects invalid credentials")


# ==================== ADMIN AUTHENTICATED ENDPOINTS ====================

class TestAdminEndpoints:
    """Tests for admin endpoints requiring authentication"""
    
    def test_admin_stats(self, authenticated_client):
        """Test GET /api/admin/stats"""
        response = authenticated_client.get(f"{BASE_URL}/api/admin/stats")
        assert response.status_code == 200
        data = response.json()
        assert "total_bookings" in data
        assert "pending_bookings" in data
        assert "confirmed_bookings" in data
        assert "portfolio_count" in data
        print(f"✓ Admin stats: {data['total_bookings']} total bookings")
    
    def test_admin_bookings(self, authenticated_client):
        """Test GET /api/admin/bookings"""
        response = authenticated_client.get(f"{BASE_URL}/api/admin/bookings")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Admin bookings returned {len(data)} bookings")
    
    def test_admin_packages(self, authenticated_client):
        """Test GET /api/admin/packages"""
        response = authenticated_client.get(f"{BASE_URL}/api/admin/packages")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        print(f"✓ Admin packages returned {len(data)} packages")
    
    def test_admin_portfolio(self, authenticated_client):
        """Test GET /api/admin/portfolio"""
        response = authenticated_client.get(f"{BASE_URL}/api/admin/portfolio")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Admin portfolio returned {len(data)} items")
    
    def test_admin_testimonials(self, authenticated_client):
        """Test GET /api/admin/testimonials"""
        response = authenticated_client.get(f"{BASE_URL}/api/admin/testimonials")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Admin testimonials returned {len(data)} items")
    
    def test_admin_email_settings(self, authenticated_client):
        """Test GET /api/admin/email-settings"""
        response = authenticated_client.get(f"{BASE_URL}/api/admin/email-settings")
        assert response.status_code == 200
        data = response.json()
        # May be empty or have provider info
        assert isinstance(data, dict)
        print("✓ Admin email settings endpoint working")
    
    def test_admin_payment_settings(self, authenticated_client):
        """Test GET /api/admin/payment-settings"""
        response = authenticated_client.get(f"{BASE_URL}/api/admin/payment-settings")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict)
        print("✓ Admin payment settings endpoint working")
    
    def test_admin_contract(self, authenticated_client):
        """Test GET /api/admin/contract"""
        response = authenticated_client.get(f"{BASE_URL}/api/admin/contract")
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        print("✓ Admin contract endpoint working")
    
    def test_admin_booking_settings(self, authenticated_client):
        """Test GET /api/admin/booking-settings"""
        response = authenticated_client.get(f"{BASE_URL}/api/admin/booking-settings")
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        print("✓ Admin booking settings endpoint working")
    
    def test_admin_faqs(self, authenticated_client):
        """Test GET /api/admin/faqs"""
        response = authenticated_client.get(f"{BASE_URL}/api/admin/faqs")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Admin FAQs returned {len(data)} items")
    
    def test_admin_questionnaires(self, authenticated_client):
        """Test GET /api/admin/questionnaires"""
        response = authenticated_client.get(f"{BASE_URL}/api/admin/questionnaires")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Admin questionnaires returned {len(data)} items")
    
    def test_admin_email_templates(self, authenticated_client):
        """Test GET /api/admin/email-templates"""
        response = authenticated_client.get(f"{BASE_URL}/api/admin/email-templates")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Admin email templates returned {len(data)} items")
    
    def test_admin_storage_settings(self, authenticated_client):
        """Test GET /api/admin/storage-settings"""
        response = authenticated_client.get(f"{BASE_URL}/api/admin/storage-settings")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict)
        print("✓ Admin storage settings endpoint working")
    
    def test_admin_instagram_settings(self, authenticated_client):
        """Test GET /api/admin/instagram-settings"""
        response = authenticated_client.get(f"{BASE_URL}/api/admin/instagram-settings")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict)
        print("✓ Admin instagram settings endpoint working")
    
    def test_admin_automated_reminders(self, authenticated_client):
        """Test GET /api/admin/automated-reminders"""
        response = authenticated_client.get(f"{BASE_URL}/api/admin/automated-reminders")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Admin automated reminders returned {len(data)} items")


# ==================== CRON ENDPOINTS ====================

class TestCronEndpoints:
    """Tests for cron/scheduler endpoints"""
    
    def test_process_reminders(self, api_client):
        """Test POST /api/cron/process-reminders"""
        response = api_client.post(f"{BASE_URL}/api/cron/process-reminders")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print("✓ Cron process reminders endpoint working")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

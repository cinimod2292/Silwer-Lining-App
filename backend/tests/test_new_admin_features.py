"""
Test suite for Silwer Lining Photography - New Admin Features
Tests: Add-ons CRUD, Email Templates CRUD, Storage Settings, Instagram Settings, Portfolio Bulk Upload
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://portrait-bookings.preview.emergentagent.com').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@silwerlining.com"
ADMIN_PASSWORD = "Admin123!"


class TestAddOnsManagement:
    """Add-ons CRUD tests"""
    
    def test_get_admin_addons(self, auth_token):
        """Test fetching add-ons list (admin)"""
        response = requests.get(f"{BASE_URL}/api/admin/addons", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_public_addons(self):
        """Test fetching public add-ons"""
        response = requests.get(f"{BASE_URL}/api/addons")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_public_addons_by_session_type(self):
        """Test fetching add-ons filtered by session type"""
        response = requests.get(f"{BASE_URL}/api/addons?session_type=maternity")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_create_addon(self, auth_token):
        """Test creating a new add-on"""
        addon_data = {
            "name": "TEST_Makeup Artist",
            "description": "Professional makeup for your session",
            "price": 800,
            "categories": ["maternity", "newborn"],
            "active": True
        }
        response = requests.post(f"{BASE_URL}/api/admin/addons", 
            json=addon_data,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == addon_data["name"]
        assert data["price"] == addon_data["price"]
        assert "id" in data
        assert data["categories"] == addon_data["categories"]
        return data["id"]
    
    def test_update_addon(self, auth_token):
        """Test updating an add-on"""
        # First create an add-on
        create_data = {
            "name": "TEST_Update Addon",
            "description": "Original description",
            "price": 500,
            "categories": ["studio"],
            "active": True
        }
        create_response = requests.post(f"{BASE_URL}/api/admin/addons",
            json=create_data,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert create_response.status_code == 200
        addon_id = create_response.json()["id"]
        
        # Update the add-on
        update_data = {
            "name": "TEST_Updated Addon Name",
            "description": "Updated description",
            "price": 750,
            "categories": ["studio", "family"],
            "active": True
        }
        update_response = requests.put(f"{BASE_URL}/api/admin/addons/{addon_id}",
            json=update_data,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert update_response.status_code == 200
        
        # Verify update by fetching add-ons
        get_response = requests.get(f"{BASE_URL}/api/admin/addons",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        addons = get_response.json()
        updated_addon = next((a for a in addons if a["id"] == addon_id), None)
        assert updated_addon is not None
        assert updated_addon["name"] == update_data["name"]
        assert updated_addon["price"] == update_data["price"]
    
    def test_delete_addon(self, auth_token):
        """Test deleting an add-on"""
        # First create an add-on to delete
        create_data = {
            "name": "TEST_Delete Addon",
            "description": "To be deleted",
            "price": 300,
            "categories": [],
            "active": True
        }
        create_response = requests.post(f"{BASE_URL}/api/admin/addons",
            json=create_data,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert create_response.status_code == 200
        addon_id = create_response.json()["id"]
        
        # Delete the add-on
        delete_response = requests.delete(f"{BASE_URL}/api/admin/addons/{addon_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert delete_response.status_code == 200
        
        # Verify deletion
        get_response = requests.get(f"{BASE_URL}/api/admin/addons",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        addons = get_response.json()
        deleted_addon = next((a for a in addons if a["id"] == addon_id), None)
        assert deleted_addon is None


class TestEmailTemplatesManagement:
    """Email templates CRUD tests"""
    
    def test_get_email_templates(self, auth_token):
        """Test fetching email templates list"""
        response = requests.get(f"{BASE_URL}/api/admin/email-templates", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_create_email_template(self, auth_token):
        """Test creating a new email template"""
        template_data = {
            "name": "test_booking_confirmation",
            "subject": "Your Booking is Confirmed! 📸",
            "html_content": "<html><body><h1>Hello {{client_name}}</h1><p>Your booking for {{session_type}} is confirmed.</p></body></html>",
            "use_raw_html": False,
            "active": True
        }
        response = requests.post(f"{BASE_URL}/api/admin/email-templates", 
            json=template_data,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == template_data["name"]
        assert data["subject"] == template_data["subject"]
        assert "id" in data
        return data["id"]
    
    def test_create_duplicate_template_fails(self, auth_token):
        """Test that creating duplicate template name fails"""
        template_data = {
            "name": "test_duplicate_template",
            "subject": "Test Subject",
            "html_content": "<html><body>Test</body></html>",
            "use_raw_html": False,
            "active": True
        }
        # Create first template
        response1 = requests.post(f"{BASE_URL}/api/admin/email-templates", 
            json=template_data,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response1.status_code == 200
        
        # Try to create duplicate
        response2 = requests.post(f"{BASE_URL}/api/admin/email-templates", 
            json=template_data,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response2.status_code == 400
    
    def test_update_email_template(self, auth_token):
        """Test updating an email template"""
        # First create a template
        create_data = {
            "name": "test_update_template",
            "subject": "Original Subject",
            "html_content": "<html><body>Original content</body></html>",
            "use_raw_html": False,
            "active": True
        }
        create_response = requests.post(f"{BASE_URL}/api/admin/email-templates",
            json=create_data,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert create_response.status_code == 200
        template_id = create_response.json()["id"]
        
        # Update the template
        update_data = {
            "name": "test_update_template",
            "subject": "Updated Subject",
            "html_content": "<html><body>Updated content with {{client_name}}</body></html>",
            "use_raw_html": True,
            "active": True
        }
        update_response = requests.put(f"{BASE_URL}/api/admin/email-templates/{template_id}",
            json=update_data,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert update_response.status_code == 200
        
        # Verify update
        get_response = requests.get(f"{BASE_URL}/api/admin/email-templates",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        templates = get_response.json()
        updated_template = next((t for t in templates if t["id"] == template_id), None)
        assert updated_template is not None
        assert updated_template["subject"] == update_data["subject"]
        assert updated_template["use_raw_html"] == True
    
    def test_delete_email_template(self, auth_token):
        """Test deleting an email template"""
        # First create a template to delete
        create_data = {
            "name": "test_delete_template",
            "subject": "To be deleted",
            "html_content": "<html><body>Delete me</body></html>",
            "use_raw_html": False,
            "active": True
        }
        create_response = requests.post(f"{BASE_URL}/api/admin/email-templates",
            json=create_data,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert create_response.status_code == 200
        template_id = create_response.json()["id"]
        
        # Delete the template
        delete_response = requests.delete(f"{BASE_URL}/api/admin/email-templates/{template_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert delete_response.status_code == 200
        
        # Verify deletion
        get_response = requests.get(f"{BASE_URL}/api/admin/email-templates",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        templates = get_response.json()
        deleted_template = next((t for t in templates if t["id"] == template_id), None)
        assert deleted_template is None


class TestStorageSettings:
    """Storage settings tests"""
    
    def test_get_storage_settings(self, auth_token):
        """Test fetching storage settings"""
        response = requests.get(f"{BASE_URL}/api/admin/storage-settings",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        # Verify structure
        assert "provider" in data
        assert "account_id" in data
        assert "access_key_id" in data
        assert "bucket_name" in data
        assert "public_url" in data
    
    def test_update_storage_settings(self, auth_token):
        """Test updating storage settings"""
        settings_data = {
            "provider": "cloudflare_r2",
            "account_id": "test_account_id",
            "access_key_id": "test_access_key",
            "secret_access_key": "test_secret_key",
            "bucket_name": "test-bucket",
            "public_url": "https://images.test.com"
        }
        response = requests.put(f"{BASE_URL}/api/admin/storage-settings",
            json=settings_data,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        
        # Verify update (secret key should be masked)
        get_response = requests.get(f"{BASE_URL}/api/admin/storage-settings",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert get_response.status_code == 200
        data = get_response.json()
        assert data["account_id"] == "test_account_id"
        assert data["bucket_name"] == "test-bucket"
        # Secret key should be masked
        assert "••••" in data.get("secret_access_key", "")


class TestInstagramSettings:
    """Instagram settings tests"""
    
    def test_get_instagram_settings(self, auth_token):
        """Test fetching Instagram settings"""
        response = requests.get(f"{BASE_URL}/api/admin/instagram-settings",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        # Verify structure
        assert "enabled" in data
        assert "post_count" in data
    
    def test_update_instagram_settings(self, auth_token):
        """Test updating Instagram settings"""
        settings_data = {
            "access_token": "test_instagram_token_12345",
            "enabled": True,
            "post_count": 8
        }
        response = requests.put(f"{BASE_URL}/api/admin/instagram-settings",
            json=settings_data,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        
        # Verify update (token should be masked)
        get_response = requests.get(f"{BASE_URL}/api/admin/instagram-settings",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert get_response.status_code == 200
        data = get_response.json()
        assert data["enabled"] == True
        assert data["post_count"] == 8
    
    def test_instagram_feed_public(self):
        """Test public Instagram feed endpoint"""
        response = requests.get(f"{BASE_URL}/api/instagram/feed")
        assert response.status_code == 200
        data = response.json()
        # Should return posts array (may be empty if not configured)
        assert "posts" in data


class TestPortfolioManagement:
    """Portfolio management tests including bulk upload"""
    
    def test_get_admin_portfolio(self, auth_token):
        """Test fetching portfolio items (admin)"""
        response = requests.get(f"{BASE_URL}/api/admin/portfolio",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_create_portfolio_item(self, auth_token):
        """Test creating a portfolio item"""
        item_data = {
            "title": "TEST_Portfolio Image",
            "category": "maternity",
            "image_url": "https://example.com/test-image.jpg",
            "description": "Test portfolio item",
            "featured": False
        }
        response = requests.post(f"{BASE_URL}/api/admin/portfolio",
            json=item_data,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == item_data["title"]
        assert data["category"] == item_data["category"]
        assert "id" in data
        return data["id"]
    
    def test_update_portfolio_item(self, auth_token):
        """Test updating a portfolio item"""
        # First create an item
        create_data = {
            "title": "TEST_Update Portfolio",
            "category": "newborn",
            "image_url": "https://example.com/original.jpg",
            "description": "Original",
            "featured": False
        }
        create_response = requests.post(f"{BASE_URL}/api/admin/portfolio",
            json=create_data,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert create_response.status_code == 200
        item_id = create_response.json()["id"]
        
        # Update the item
        update_data = {
            "title": "TEST_Updated Portfolio",
            "category": "family",
            "image_url": "https://example.com/updated.jpg",
            "description": "Updated description",
            "featured": True
        }
        update_response = requests.put(f"{BASE_URL}/api/admin/portfolio/{item_id}",
            json=update_data,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert update_response.status_code == 200
    
    def test_delete_portfolio_item(self, auth_token):
        """Test deleting a portfolio item"""
        # First create an item to delete
        create_data = {
            "title": "TEST_Delete Portfolio",
            "category": "studio",
            "image_url": "https://example.com/delete.jpg",
            "description": "To be deleted",
            "featured": False
        }
        create_response = requests.post(f"{BASE_URL}/api/admin/portfolio",
            json=create_data,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert create_response.status_code == 200
        item_id = create_response.json()["id"]
        
        # Delete the item
        delete_response = requests.delete(f"{BASE_URL}/api/admin/portfolio/{item_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert delete_response.status_code == 200
    
    def test_upload_endpoint_requires_storage_config(self, auth_token):
        """Test that upload endpoint requires storage configuration"""
        # This test verifies the upload endpoint exists and returns appropriate error
        # when storage is not properly configured
        response = requests.post(f"{BASE_URL}/api/admin/upload",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        # Should return 200 with message about using upload-image endpoint
        # or 400 if storage not configured
        assert response.status_code in [200, 400]


class TestBookingWithAddons:
    """Test booking flow with add-ons"""
    
    def test_create_booking_with_addons(self, auth_token):
        """Test creating a booking with add-ons"""
        tomorrow = (datetime.now() + timedelta(days=10)).strftime("%Y-%m-%d")
        booking_data = {
            "client_name": "TEST_Addon Client",
            "client_email": "test_addon@example.com",
            "client_phone": "0123456789",
            "session_type": "maternity",
            "package_id": "mat-signature",
            "package_name": "Signature",
            "package_price": 5500,
            "booking_date": tomorrow,
            "booking_time": "10:00",
            "notes": "Test booking with add-ons",
            "selected_addons": ["makeup", "extra-prints"],
            "addons_total": 1500,
            "is_weekend": False,
            "weekend_surcharge": 0,
            "total_price": 7000
        }
        response = requests.post(f"{BASE_URL}/api/bookings", json=booking_data)
        assert response.status_code == 200
        data = response.json()
        assert data["selected_addons"] == booking_data["selected_addons"]
        assert data["addons_total"] == booking_data["addons_total"]
        assert data["total_price"] == booking_data["total_price"]


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
            
            # Cleanup test add-ons
            addons_response = requests.get(f"{BASE_URL}/api/admin/addons", headers=headers)
            if addons_response.status_code == 200:
                for addon in addons_response.json():
                    if addon.get("name", "").startswith("TEST_"):
                        requests.delete(f"{BASE_URL}/api/admin/addons/{addon['id']}", headers=headers)
            
            # Cleanup test email templates
            templates_response = requests.get(f"{BASE_URL}/api/admin/email-templates", headers=headers)
            if templates_response.status_code == 200:
                for template in templates_response.json():
                    if template.get("name", "").startswith("test_"):
                        requests.delete(f"{BASE_URL}/api/admin/email-templates/{template['id']}", headers=headers)
            
            # Cleanup test portfolio items
            portfolio_response = requests.get(f"{BASE_URL}/api/admin/portfolio", headers=headers)
            if portfolio_response.status_code == 200:
                for item in portfolio_response.json():
                    if item.get("title", "").startswith("TEST_"):
                        requests.delete(f"{BASE_URL}/api/admin/portfolio/{item['id']}", headers=headers)
            
            # Cleanup test bookings
            bookings_response = requests.get(f"{BASE_URL}/api/admin/bookings", headers=headers)
            if bookings_response.status_code == 200:
                for booking in bookings_response.json():
                    if booking.get("client_name", "").startswith("TEST_"):
                        requests.delete(f"{BASE_URL}/api/admin/bookings/{booking['id']}", headers=headers)
    except Exception as e:
        print(f"Cleanup error: {e}")

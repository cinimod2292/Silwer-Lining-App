import requests
import sys
import json
from datetime import datetime, timedelta

class SilwerLiningAPITester:
    def __init__(self, base_url="https://silwerlining.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.admin_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if headers:
            test_headers.update(headers)
        
        if self.admin_token and 'Authorization' not in test_headers:
            test_headers['Authorization'] = f'Bearer {self.admin_token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=10)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return True, response.json() if response.content else {}
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}...")
                self.failed_tests.append({
                    "test": name,
                    "expected": expected_status,
                    "actual": response.status_code,
                    "response": response.text[:200]
                })
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failed_tests.append({
                "test": name,
                "error": str(e)
            })
            return False, {}

    def test_health_check(self):
        """Test basic health endpoint"""
        return self.run_test("Health Check", "GET", "health", 200)

    def test_packages_endpoint(self):
        """Test packages endpoint"""
        success, response = self.run_test("Get Packages", "GET", "packages", 200)
        if success and response:
            print(f"   Found {len(response)} packages")
            # Verify package structure
            if response and len(response) > 0:
                pkg = response[0]
                required_fields = ['id', 'name', 'session_type', 'price', 'duration', 'includes']
                missing_fields = [field for field in required_fields if field not in pkg]
                if missing_fields:
                    print(f"   ⚠️  Missing fields in package: {missing_fields}")
        return success

    def test_portfolio_endpoint(self):
        """Test portfolio endpoint"""
        success, response = self.run_test("Get Portfolio", "GET", "portfolio", 200)
        if success:
            print(f"   Found {len(response)} portfolio items")
        return success

    def test_testimonials_endpoint(self):
        """Test testimonials endpoint"""
        success, response = self.run_test("Get Testimonials", "GET", "testimonials", 200)
        if success:
            print(f"   Found {len(response)} testimonials")
        return success

    def test_available_times(self):
        """Test available times endpoint"""
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        success, response = self.run_test(
            "Get Available Times", 
            "GET", 
            f"bookings/available-times?date={tomorrow}", 
            200
        )
        if success and response:
            print(f"   Available times for {tomorrow}: {len(response.get('available_times', []))}")
        return success

    def test_contact_submission(self):
        """Test contact form submission"""
        contact_data = {
            "name": "Test User",
            "email": "test@example.com",
            "phone": "555-123-4567",
            "subject": "Test Message",
            "message": "This is a test message from the API tester."
        }
        success, response = self.run_test(
            "Submit Contact Form", 
            "POST", 
            "contact", 
            200, 
            data=contact_data
        )
        if success and response:
            print(f"   Contact message ID: {response.get('id', 'N/A')}")
        return success

    def test_booking_creation(self):
        """Test booking creation"""
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        booking_data = {
            "client_name": "Test Client",
            "client_email": "testclient@example.com",
            "client_phone": "555-987-6543",
            "session_type": "family",
            "package_name": "Classic",
            "booking_date": tomorrow,
            "booking_time": "10:00 AM",
            "notes": "Test booking from API tester"
        }
        success, response = self.run_test(
            "Create Booking", 
            "POST", 
            "bookings", 
            200, 
            data=booking_data
        )
        if success and response:
            print(f"   Booking ID: {response.get('id', 'N/A')}")
            return response.get('id')
        return None

    def test_admin_setup(self):
        """Test admin setup (first time only)"""
        admin_data = {
            "email": "admin@silwerlining.com",
            "password": "AdminPass123!",
            "name": "Test Admin"
        }
        success, response = self.run_test(
            "Admin Setup", 
            "POST", 
            "admin/setup", 
            200, 
            data=admin_data
        )
        return success

    def test_admin_login(self):
        """Test admin login"""
        login_data = {
            "email": "admin@silwerlining.com",
            "password": "AdminPass123!"
        }
        success, response = self.run_test(
            "Admin Login", 
            "POST", 
            "admin/login", 
            200, 
            data=login_data
        )
        if success and response:
            self.admin_token = response.get('token')
            print(f"   Admin logged in: {response.get('name', 'N/A')}")
        return success

    def test_admin_me(self):
        """Test admin me endpoint"""
        if not self.admin_token:
            print("❌ No admin token available")
            return False
        
        success, response = self.run_test("Admin Me", "GET", "admin/me", 200)
        if success and response:
            print(f"   Admin info: {response.get('name', 'N/A')} ({response.get('email', 'N/A')})")
        return success

    def test_admin_bookings(self):
        """Test admin bookings endpoint"""
        if not self.admin_token:
            print("❌ No admin token available")
            return False
        
        success, response = self.run_test("Admin Get Bookings", "GET", "admin/bookings", 200)
        if success:
            print(f"   Found {len(response)} bookings")
        return success

    def test_admin_portfolio(self):
        """Test admin portfolio endpoint"""
        if not self.admin_token:
            print("❌ No admin token available")
            return False
        
        success, response = self.run_test("Admin Get Portfolio", "GET", "admin/portfolio", 200)
        if success:
            print(f"   Found {len(response)} portfolio items")
        return success

    def test_admin_testimonials(self):
        """Test admin testimonials endpoint"""
        if not self.admin_token:
            print("❌ No admin token available")
            return False
        
        success, response = self.run_test("Admin Get Testimonials", "GET", "admin/testimonials", 200)
        if success:
            print(f"   Found {len(response)} testimonials")
        return success

    def test_admin_messages(self):
        """Test admin messages endpoint"""
        if not self.admin_token:
            print("❌ No admin token available")
            return False
        
        success, response = self.run_test("Admin Get Messages", "GET", "admin/messages", 200)
        if success:
            print(f"   Found {len(response)} messages")
        return success

    def test_admin_stats(self):
        """Test admin stats endpoint"""
        if not self.admin_token:
            print("❌ No admin token available")
            return False
        
        success, response = self.run_test("Admin Get Stats", "GET", "admin/stats", 200)
        if success and response:
            stats = [f"{k}: {v}" for k, v in response.items()]
            print(f"   Stats: {', '.join(stats)}")
        return success

def main():
    print("🚀 Starting Silwer Lining Photography API Tests")
    print("=" * 60)
    
    tester = SilwerLiningAPITester()
    
    # Test public endpoints
    print("\n📋 Testing Public Endpoints...")
    tester.test_health_check()
    tester.test_packages_endpoint()
    tester.test_portfolio_endpoint()
    tester.test_testimonials_endpoint()
    tester.test_available_times()
    tester.test_contact_submission()
    booking_id = tester.test_booking_creation()
    
    # Test admin endpoints
    print("\n🔐 Testing Admin Endpoints...")
    # Try setup first (might fail if admin exists)
    tester.test_admin_setup()
    
    # Login and test authenticated endpoints
    if tester.test_admin_login():
        tester.test_admin_me()
        tester.test_admin_bookings()
        tester.test_admin_portfolio()
        tester.test_admin_testimonials()
        tester.test_admin_messages()
        tester.test_admin_stats()
    
    # Print results
    print("\n" + "=" * 60)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} passed")
    
    if tester.failed_tests:
        print(f"\n❌ Failed Tests ({len(tester.failed_tests)}):")
        for i, test in enumerate(tester.failed_tests, 1):
            print(f"   {i}. {test.get('test', 'Unknown')}")
            if 'error' in test:
                print(f"      Error: {test['error']}")
            else:
                print(f"      Expected: {test.get('expected')}, Got: {test.get('actual')}")
    
    success_rate = (tester.tests_passed / tester.tests_run) * 100 if tester.tests_run > 0 else 0
    print(f"\n🎯 Success Rate: {success_rate:.1f}%")
    
    return 0 if success_rate >= 80 else 1

if __name__ == "__main__":
    sys.exit(main())
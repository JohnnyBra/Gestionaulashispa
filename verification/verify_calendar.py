from playwright.sync_api import sync_playwright, expect
import json
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()

        # --- TEST 1: Visuals for Past Slots ---
        # Mock Date: Friday June 14, 2024 10:00 AM
        # We expect to see current week (June 10-14).
        # Slots on Monday June 10 should be restricted.

        page = context.new_page()

        # Inject User Session
        user = {
            "name": "Profesor Test",
            "email": "teacher@test.com",
            "role": "TEACHER",
            "id": "teacher1"
        }

        # Mock Date Script
        mock_date_script_1 = """
        const _Date = Date;
        const mockNow = new _Date("2024-06-14T10:00:00");
        globalThis.Date = class extends _Date {
            constructor(...args) {
                if (args.length === 0) return mockNow;
                return new _Date(...args);
            }
            static now() { return mockNow.getTime(); }
        };
        """
        page.add_init_script(mock_date_script_1)

        # Set localStorage
        page.add_init_script(f"localStorage.setItem('hispanidad_user', '{json.dumps(user)}');")

        print("Navigating to Calendar (Test 1: Visuals)...")
        page.goto("http://localhost:3001")

        # Click "Primaria" or "Secundaria"
        # Wait for Dashboard
        try:
            page.wait_for_selector("text=Etapa Primaria", timeout=5000)
            page.get_by_text("Etapa Primaria").click()

            # Wait for Calendar
            page.wait_for_selector("text=Aula de Idiomas", timeout=5000)

            time.sleep(2) # wait for render
            page.screenshot(path="verification/visuals_check.png")
            print("Screenshot 1 saved.")

        except Exception as e:
            print(f"Test 1 Error: {e}")
            page.screenshot(path="verification/error_test1.png")

        page.close()
        browser.close()

if __name__ == "__main__":
    run()

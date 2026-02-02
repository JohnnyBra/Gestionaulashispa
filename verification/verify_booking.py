
from playwright.sync_api import sync_playwright
import time
import json

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()

    # Inject user session
    user = {"email":"teacher@test.com","name":"Test Teacher","role":"TEACHER"}

    page = context.new_page()
    try:
        page.goto("http://localhost:3001/")

        # Inject user
        page.evaluate(f"localStorage.setItem('hispanidad_user', '{json.dumps(user)}');")

        # Reload to apply user
        page.reload()

        # Wait for Dashboard
        # "Etapa Primaria" is inside the card
        print("Waiting for Dashboard...")
        page.wait_for_selector("text=Etapa Primaria", timeout=10000)

        print("Clicking Etapa Primaria...")
        page.click("text=Etapa Primaria")

        # Wait for Calendar View
        print("Waiting for Calendar...")
        page.wait_for_selector("text=Aula de Idiomas", timeout=10000)

        # Take screenshot
        print("Taking screenshot...")
        page.screenshot(path="verification/calendar_view.png")

        print("Screenshot taken.")
    except Exception as e:
        print(f"Error: {e}")
        page.screenshot(path="verification/error.png")
    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)

from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    # 1. Navigate to the app
    page.goto("http://localhost:3001")

    # 2. Inject session
    user_json = '{"email":"admin@test.com","name":"Admin","role":"ADMIN"}'
    page.evaluate(f"localStorage.setItem('hispanidad_user', '{user_json}')")

    # 3. Reload to apply session
    page.reload()

    # 4. Navigate to Incidents page
    # The button might be hidden on small screens if default viewport is small, but Playwright defaults to 1280x720 usually.
    # We can use title="Gestionar Incidencias"
    page.get_by_title("Gestionar Incidencias").click()

    # 5. Verify we are on Incidents page
    expect(page.get_by_text("Registro de Incidencias")).to_be_visible()

    # 6. Check for the new button
    send_button = page.get_by_role("button", name="Enviar Reporte")
    expect(send_button).to_be_visible()

    # 7. Take screenshot
    page.screenshot(path="verification/verification.png")

    print("Verification script completed successfully.")
    browser.close()

with sync_playwright() as playwright:
    run(playwright)

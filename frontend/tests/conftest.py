"""Shared Playwright fixtures for frontend e2e tests."""
import os
import pytest
from playwright.sync_api import sync_playwright


@pytest.fixture(scope="session")
def _browser():
    """Single Chromium instance for the whole test session."""
    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path="/usr/bin/google-chrome",
            args=["--no-sandbox"],
        )
        yield browser
        browser.close()


@pytest.fixture
def page(_browser):
    """Fresh context + page per test."""
    ctx = _browser.new_context(viewport={"width": 1280, "height": 900})
    page = ctx.new_page()
    try:
        yield page
    finally:
        ctx.close()
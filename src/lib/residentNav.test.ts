import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RESIDENT_NAV_SECTIONS,
  resolveActiveResidentPath,
  isResidentNavItemActive,
  parseSidebarCollapsed,
  isPhoneUserAgent,
} from './residentNav';

test('RESIDENT_NAV_SECTIONS organizes items into MAIN, COMMUNITY, and ACCOUNT without broken routes', () => {
  assert.deepEqual(
    RESIDENT_NAV_SECTIONS.map((s) => s.label),
    ['MAIN', 'COMMUNITY', 'ACCOUNT'],
  );

  const mainLabels = RESIDENT_NAV_SECTIONS[0].items.map((i) => i.label);
  assert.deepEqual(mainLabels, ['Home', 'My Reports']);

  const communityLabels = RESIDENT_NAV_SECTIONS[1].items.map((i) => i.label);
  assert.deepEqual(communityLabels, [
    'Announcements',
    'Emergency Contacts',
    'Barangay Directory',
    'Barangay Programs',
  ]);

  const accountLabels = RESIDENT_NAV_SECTIONS[2].items.map((i) => i.label);
  assert.deepEqual(accountLabels, ['My Profile']);
});

test('resolveActiveResidentPath prioritizes specific router pathname over a stale "/" prop', () => {
  assert.equal(resolveActiveResidentPath('/my-requests', '/'), '/my-requests');
  assert.equal(resolveActiveResidentPath('/updates', '/updates'), '/updates');
  assert.equal(resolveActiveResidentPath('/dashboard', undefined), '/dashboard');
  assert.equal(resolveActiveResidentPath('/', undefined), '/');
});

test('isResidentNavItemActive matches Home on "/" and "/dashboard" and matches subroutes accurately', () => {
  assert.equal(isResidentNavItemActive('/', '/'), true);
  assert.equal(isResidentNavItemActive('/', '/dashboard'), true);
  assert.equal(isResidentNavItemActive('/', '/my-requests'), false);
  assert.equal(isResidentNavItemActive('/my-requests', '/my-requests'), true);
  assert.equal(isResidentNavItemActive('/updates', '/updates'), true);
  assert.equal(isResidentNavItemActive('/emergency', '/emergency'), true);
  assert.equal(isResidentNavItemActive('/directory', '/directory'), true);
  assert.equal(isResidentNavItemActive('/programs', '/programs'), true);
  assert.equal(isResidentNavItemActive('/profile', '/profile'), true);
});

test('parseSidebarCollapsed safely parses persisted boolean strings', () => {
  assert.equal(parseSidebarCollapsed('true'), true);
  assert.equal(parseSidebarCollapsed('false'), false);
  assert.equal(parseSidebarCollapsed(null), false);
  assert.equal(parseSidebarCollapsed(undefined), false);
});

test('isPhoneUserAgent identifies Android phones and iPhones while excluding desktop browsers', () => {
  assert.equal(
    isPhoneUserAgent(
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
    ),
    true,
  );
  assert.equal(
    isPhoneUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    ),
    true,
  );
  assert.equal(
    isPhoneUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
    ),
    false,
  );
});


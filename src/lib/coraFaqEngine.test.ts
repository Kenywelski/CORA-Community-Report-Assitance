import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CORA_FAQS,
  FAQ_CATEGORIES,
  getFaqsByCategory,
  answerSystemFaq,
} from './coraFaqEngine';

test('CORA_FAQS contains comprehensive system FAQs across all defined categories', () => {
  assert.ok(CORA_FAQS.length >= 10, 'Expected at least 10 FAQ items');
  for (const cat of FAQ_CATEGORIES) {
    const items = getFaqsByCategory(cat.id);
    assert.ok(items.length > 0, `Category ${cat.id} should have at least 1 FAQ`);
  }
});

test('answerSystemFaq matches exact question and Tagalog/English reporting queries', () => {
  const exact = answerSystemFaq('What is CORA and how does it help Barangay Purisima?');
  assert.equal(exact.matchedFaqId, 'what-is-cora');
  assert.ok(exact.answer.includes('Barangay Purisima'));
  assert.ok(exact.relatedQuestions.length > 0);

  const howToReport = answerSystemFaq('Paano mag-report ng sira na kalsada?');
  assert.ok(
    howToReport.matchedFaqId === 'how-to-report' ||
      howToReport.matchedFaqId === 'supported-concerns'
  );
});

test('answerSystemFaq enriches emergency contact answers with live barangay hotlines when provided', () => {
  const res = answerSystemFaq('Where are the emergency contact numbers?', {
    emergencyContacts: [
      {
        department_name: 'Tago Municipal Police Station',
        service_type: 'Police',
        contact_number: '0998-598-7312',
      },
    ],
  });
  assert.equal(res.matchedFaqId, 'emergency-contacts');
  assert.ok(res.answer.includes('Tago Municipal Police Station'));
  assert.ok(res.answer.includes('0998-598-7312'));
});

test('answerSystemFaq provides helpful fallback and related questions for unknown queries', () => {
  const fallback = answerSystemFaq('xyz unknown random question 123');
  assert.equal(fallback.matchedFaqId, null);
  assert.ok(fallback.answer.includes('CORA'));
  assert.ok(fallback.relatedQuestions.length >= 3);
});

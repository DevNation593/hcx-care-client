import { describe, expect, it } from 'vitest';
import { scrubEnvelopeTrace, scrubSamplingMetadata } from './sentry-envelope';

const PATIENT_ID = '3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b';

describe('scrubSamplingMetadata', () => {
  it('keeps only the allowed keys of the dynamic sampling context and drops the rest', () => {
    const event = {
      sdkProcessingMetadata: {
        normalizedRequest: { url: `https://app.example.com/patients/${PATIENT_ID}` },
        capturedSpanIsolationScope: { _user: { email: 'ana@example.com' } },
        dynamicSamplingContext: {
          trace_id: 'a'.repeat(32),
          public_key: 'pk',
          sample_rate: '1',
          sample_rand: '0.3',
          sampled: 'true',
          release: 'abc',
          environment: 'production',
          org_id: '1',
          transaction: `/patients/${PATIENT_ID}`,
          user_segment: 'ana@example.com',
          replay_id: 'r1',
        },
      },
    };

    scrubSamplingMetadata(event);

    expect(event.sdkProcessingMetadata).toEqual({
      dynamicSamplingContext: {
        trace_id: 'a'.repeat(32),
        public_key: 'pk',
        sample_rate: '1',
        sample_rand: '0.3',
        sampled: 'true',
        release: 'abc',
        environment: 'production',
        org_id: '1',
      },
    });
    expect(JSON.stringify(event)).not.toContain(PATIENT_ID);
  });

  it('removes the metadata when there is no sampling context', () => {
    const event: { sdkProcessingMetadata?: Record<string, unknown> } = {
      sdkProcessingMetadata: { normalizedRequest: { url: `/patients/${PATIENT_ID}` } },
    };

    scrubSamplingMetadata(event);

    expect(event.sdkProcessingMetadata).toBeUndefined();
  });
});

describe('scrubEnvelopeTrace', () => {
  it('reduces the trace header to the allowed keys: no transaction name', () => {
    const envelope = [
      {
        sent_at: 'now',
        trace: {
          trace_id: 'a'.repeat(32),
          public_key: 'pk',
          transaction: 'body > div > button[aria-label="Ana Pérez"]',
          sampled: 'true',
          user: 'ana@example.com',
        },
      },
      [],
    ];

    scrubEnvelopeTrace(envelope);

    expect(envelope[0]).toEqual({
      sent_at: 'now',
      trace: { trace_id: 'a'.repeat(32), public_key: 'pk', sampled: 'true' },
    });
  });

  it('does nothing without a trace header and never throws', () => {
    const envelope = [{ sent_at: 'now' }, []];
    scrubEnvelopeTrace(envelope);

    expect(envelope[0]).toEqual({ sent_at: 'now' });
    expect(() => scrubEnvelopeTrace(undefined)).not.toThrow();
    expect(() => scrubEnvelopeTrace(null)).not.toThrow();
    expect(() => scrubEnvelopeTrace([])).not.toThrow();
  });
});

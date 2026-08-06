import { ok, fail, parseBody, pdfResponse } from '../src/shared/response';

describe('response helpers', () => {
  it('ok serializa body', () => {
    const res = ok({ a: 1 }, 201);
    expect(res.statusCode).toBe(201);
    expect(JSON.parse(res.body)).toEqual({ a: 1 });
  });

  it('fail retorna error', () => {
    const res = fail('boom', 400);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body)).toEqual({ error: 'boom' });
  });

  it('parseBody valida vacío', () => {
    expect(() => parseBody(null)).toThrow('Body vacío');
    expect(parseBody<{ x: number }>('{"x":1}')).toEqual({ x: 1 });
  });

  it('pdfResponse marca base64', () => {
    const res = pdfResponse(Buffer.from('PDF'), 'a.pdf');
    expect(res.isBase64Encoded).toBe(true);
    expect(res.headers?.['Content-Type']).toBe('application/pdf');
  });
});

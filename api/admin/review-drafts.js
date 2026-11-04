export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const key = process.env.GROQ_API_KEY;
  if (!key) return res.status(503).json({ error: 'GROQ_API_KEY is not configured on the server.' });
  const { feedback, rating } = req.body || {};
  if (!feedback || !String(feedback).trim()) return res.status(400).json({ error: 'Feedback is required.' });
  const prompt = `Write exactly 3 different, short, natural English Google review options for Kiran K. Shinde & Co., Chartered Accountants in Boisar. Turn all selected facts into ONE complete, grammatically natural sentence per option. HARD RULES: output only the sentence; no bullets, numbering, labels, prefixes, rating numbers, star counts, “5/5”, “four stars”, hyphens, or metadata. Do not mention the rating at all. Keep each sentence 50-100 characters, sound like a normal person, and never invent facts beyond the input. Customer-selected facts: ${String(feedback).slice(0, 500)}`;
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'openai/gpt-oss-20b', temperature: 0.7, messages: [{ role: 'user', content: prompt }] }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return res.status(response.status).json({ error: data.error?.message || 'Draft generation failed.' });
  const drafts = String(data.choices?.[0]?.message?.content || '').split(/\n+/).map(s => s.replace(/^\s*(?:[-*]|\d+[.)])\s*/, '').trim()).filter(Boolean).slice(0, 3);
  return res.status(200).json({ drafts });
}
